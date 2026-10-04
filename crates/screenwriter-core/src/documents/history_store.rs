//! Linux native local history. No checkout, shell Git, transport or frontend path.
use super::*;
use crate::documents::history::{
    HistoryHealth, RevisionReceipt, WorkflowProtectionReceipt, WorkflowProtectionRequest,
};
use git2::{
    Config, ErrorCode as GitErrorCode, Oid, Repository, RepositoryInitOptions, Signature, Time,
};
use std::time::{SystemTime, UNIX_EPOCH};

const MAIN: &str = "refs/heads/main";
const MAX_PROFILE_BYTES: usize = 1024;
const MAX_LABEL_BYTES: usize = 512;

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Manifest {
    schema: u32,
    project: String,
    source_sha256: String,
    profile: String,
    profile_sha256: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Stage {
    ObjectsWritten,
    MainAdvanced,
    SafetyPublished,
}

struct Capture<'a> {
    project: &'a str,
    version: Option<u64>,
    source: &'a [u8],
    profile: &'a str,
    label: &'a str,
    safety: bool,
}

fn history_error() -> DocumentError {
    error(ErrorCode::HistoryNeedsAttention)
}

fn git<T>(result: Result<T, git2::Error>) -> Result<T, DocumentError> {
    result.map_err(|_| history_error())
}

fn private_dir(parent: &File, name: &str, create: bool) -> Result<File, DocumentError> {
    super::private_dir(parent, name, create, ErrorCode::HistoryNeedsAttention)
}

fn verify_marker(dir: &File, project: &str, fresh: bool) -> Result<(), DocumentError> {
    let expected = format!("babel-history-v1\n{project}\n");
    if fresh {
        let mut marker =
            create_private(dir, "babel-project", OFlags::WRONLY).map_err(syscall_error)?;
        marker.write_all(expected.as_bytes()).map_err(io_error)?;
        marker.sync_all().map_err(io_error)?;
        dir.sync_all().map_err(io_error)?;
    }
    let marker = read_file(dir, OsStr::new("babel-project"))?;
    if !private_file(&stat(&marker)?) || snapshot(marker, 128)?.0 != expected.as_bytes() {
        return Err(history_error());
    }
    Ok(())
}

fn now() -> Result<i64, DocumentError> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .map_err(|_| history_error())
}

fn validate_payload(source: &[u8], profile: &str, label: &str) -> Result<(), DocumentError> {
    if source.len() > MAX_SOURCE_BYTES
        || std::str::from_utf8(source).is_err()
        || profile.is_empty()
        || profile.len() > MAX_PROFILE_BYTES
        || label.is_empty()
        || label.len() > MAX_LABEL_BYTES
        || label.chars().any(char::is_control)
    {
        return Err(error(ErrorCode::InvalidSave));
    }
    Ok(())
}

fn open_repository(path: &Path, fresh: bool) -> Result<Repository, DocumentError> {
    let repo = if fresh {
        let mut options = RepositoryInitOptions::new();
        options
            .bare(true)
            .external_template(false)
            .initial_head("main");
        git(Repository::init_opts(path, &options))?
    } else {
        git(Repository::open_bare(path))?
    };
    // Git operations use a blank in-memory config and an explicit app-local
    // signature. No user/system config, hooks, credentials or transport.
    git(repo.set_config(&git(Config::new())?))?;
    Ok(repo)
}

fn head(repo: &Repository) -> Result<Option<Oid>, DocumentError> {
    match repo.refname_to_id(MAIN) {
        Ok(id) => Ok(Some(id)),
        Err(err) if err.code() == GitErrorCode::NotFound => Ok(None),
        Err(_) => Err(history_error()),
    }
}

fn read(repo: &Repository, id: Oid, project: &str) -> Result<Manifest, DocumentError> {
    let commit = git(repo.find_commit(id))?;
    let tree = git(commit.tree())?;
    if tree.len() != 2
        || tree.iter().any(|entry| {
            !matches!(entry.name(), Ok("screenplay.fountain" | "manifest.json"))
                || entry.filemode() != 0o100644
        })
    {
        return Err(history_error());
    }
    let source = git(repo.find_blob(
        tree.get_name("screenplay.fountain")
            .ok_or_else(history_error)?
            .id(),
    ))?;
    let metadata = git(repo.find_blob(
        tree.get_name("manifest.json")
            .ok_or_else(history_error)?
            .id(),
    ))?;
    if source.size() > MAX_SOURCE_BYTES
        || metadata.size() > 4096
        || std::str::from_utf8(source.content()).is_err()
    {
        return Err(history_error());
    }
    let manifest: Manifest =
        serde_json::from_slice(metadata.content()).map_err(|_| history_error())?;
    if manifest.schema != 1
        || manifest.project != project
        || manifest.source_sha256 != hash(source.content())
        || manifest.profile.is_empty()
        || manifest.profile.len() > MAX_PROFILE_BYTES
        || manifest.profile_sha256 != hash(manifest.profile.as_bytes())
    {
        return Err(history_error());
    }
    Ok(manifest)
}

fn publish_safety(repo: &Repository, id: Oid) -> Result<String, DocumentError> {
    let name = format!("refs/safety/{id}");
    match repo.reference(&name, id, false, "babel safety revision") {
        Ok(_) => (),
        Err(err) if err.code() == GitErrorCode::Exists && git(repo.refname_to_id(&name))? == id => {
        }
        Err(_) => return Err(history_error()),
    }
    if git(repo.refname_to_id(&name))? != id {
        return Err(history_error());
    }
    Ok(name)
}

fn record_with(
    repo: &Repository,
    capture: Capture<'_>,
    mut gate: impl FnMut(Stage) -> Result<(), DocumentError>,
) -> Result<RevisionReceipt, DocumentError> {
    let Capture {
        project,
        version,
        source,
        profile,
        label,
        safety,
    } = capture;
    validate_payload(source, profile, label)?;
    let expected = head(repo)?;
    if let Some(old) = expected {
        let previous = read(repo, old, project)?;
        let old_tree = git(git(repo.find_commit(old))?.tree())?;
        let old_source = git(repo.find_blob(
            old_tree
                .get_name("screenplay.fountain")
                .ok_or_else(history_error)?
                .id(),
        ))?;
        if previous.source_sha256 == hash(source)
            && previous.profile == profile
            && old_source.content() == source
        {
            let safety_ref = if safety {
                Some(publish_safety(repo, old)?)
            } else {
                None
            };
            return Ok(RevisionReceipt {
                document_id: project.into(),
                version,
                source_sha256: hash(source),
                profile_sha256: hash(profile.as_bytes()),
                commit_id: old.to_string(),
                changed: false,
                safety_ref,
            });
        }
    }
    let manifest = Manifest {
        schema: 1,
        project: project.into(),
        source_sha256: hash(source),
        profile: profile.into(),
        profile_sha256: hash(profile.as_bytes()),
    };
    let json = serde_json::to_vec(&manifest).map_err(|_| history_error())?;
    let mut builder = git(repo.treebuilder(None))?;
    git(builder.insert("screenplay.fountain", git(repo.blob(source))?, 0o100644))?;
    git(builder.insert("manifest.json", git(repo.blob(&json))?, 0o100644))?;
    let tree = git(repo.find_tree(git(builder.write())?))?;
    let parent = expected.map(|id| git(repo.find_commit(id))).transpose()?;
    let parents = parent.iter().collect::<Vec<_>>();
    let signature = git(Signature::new(
        "babel local writer",
        "local@babel.invalid",
        &Time::new(now()?, 0),
    ))?;
    let message = if safety {
        format!("babel safety revision\n\n{label}")
    } else {
        label.into()
    };
    let next = git(repo.commit(None, &signature, &signature, &message, &tree, &parents))?;
    gate(Stage::ObjectsWritten)?;
    if head(repo)? != expected {
        return Err(history_error());
    }
    match expected {
        Some(old) => {
            git(repo.reference_matching(MAIN, next, true, old, "babel revision"))?;
        }
        None => {
            git(repo.reference(MAIN, next, false, "babel initial revision"))?;
        }
    }
    gate(Stage::MainAdvanced)?;
    if head(repo)? != Some(next) || read(repo, next, project)?.source_sha256 != hash(source) {
        return Err(history_error());
    }
    let safety_ref = if safety {
        Some(publish_safety(repo, next)?)
    } else {
        None
    };
    gate(Stage::SafetyPublished)?;
    Ok(RevisionReceipt {
        document_id: project.into(),
        version,
        source_sha256: hash(source),
        profile_sha256: hash(profile.as_bytes()),
        commit_id: next.to_string(),
        changed: true,
        safety_ref,
    })
}

impl DocumentService {
    pub(super) fn native_history_profile(
        &self,
        identity: &DocumentRequest,
    ) -> Result<String, DocumentError> {
        let record = self.registered(identity)?;
        if record.initial.kind != DocumentKind::Managed {
            return Ok("source-only-v1".into());
        }
        let anchor = record.anchor.as_ref().ok_or_else(history_error)?;
        anchor.verify_location()?;
        let aux = child_directory(&anchor.parent, OsStr::new(".screenwriter"))?;
        let file = read_file(&aux, OsStr::new("project.json"))?;
        let (bytes, _) = snapshot(file, MAX_METADATA_BYTES)?;
        let metadata: ProjectIdentity =
            serde_json::from_slice(&bytes).map_err(|_| history_error())?;
        if metadata.schema_version != 1 || metadata.project_id != identity.document_id {
            return Err(history_error());
        }
        let profile = metadata.pdf_profile.as_str().ok_or_else(history_error)?;
        if profile.is_empty() || profile.len() > MAX_PROFILE_BYTES {
            return Err(history_error());
        }
        Ok(profile.into())
    }

    fn history_repository(&self, identity: &DocumentRequest) -> Result<Repository, DocumentError> {
        self.verify_store()?;
        self.registered(identity)?;
        let parent = private_dir(&self.store, "history", true)?;
        let name = format!("{}.git", identity.document_id);
        let fresh = match child_directory(&parent, OsStr::new(&name)) {
            Ok(_) => false,
            Err(err) if err.code == ErrorCode::MissingSource => true,
            Err(_) => return Err(history_error()),
        };
        let held = private_dir(&parent, &name, true)?;
        let path = self.store_path.join("history").join(&name);
        let opened = directory(&path)?;
        if !same_file(&stat(&held)?, &stat(&opened)?) {
            return Err(history_error());
        }
        let repo = open_repository(&path, fresh)?;
        verify_marker(&held, &identity.document_id, fresh)?;
        if !same_file(&stat(&held)?, &stat(&directory(&path)?)?) {
            return Err(history_error());
        }
        Ok(repo)
    }

    pub fn history_health(
        &self,
        identity: &DocumentRequest,
    ) -> Result<HistoryHealth, DocumentError> {
        if self.registered(identity)?.history_attention {
            return Ok(HistoryHealth::NeedsAttention);
        }
        self.verify_store()?;
        let parent = match private_dir(&self.store, "history", false) {
            Ok(dir) => dir,
            Err(err) if err.code == ErrorCode::MissingSource => return Ok(HistoryHealth::Ready),
            Err(_) => return Ok(HistoryHealth::NeedsAttention),
        };
        let name = format!("{}.git", identity.document_id);
        let held = match private_dir(&parent, &name, false) {
            Ok(dir) => dir,
            Err(err) if err.code == ErrorCode::MissingSource => return Ok(HistoryHealth::Ready),
            Err(_) => return Ok(HistoryHealth::NeedsAttention),
        };
        let path = self.store_path.join("history").join(name);
        let healthy = verify_marker(&held, &identity.document_id, false).and_then(|_| {
            let repo = open_repository(&path, false)?;
            let id = head(&repo)?.ok_or_else(history_error)?;
            read(&repo, id, &identity.document_id)?;
            let commit = git(repo.find_commit(id))?;
            if commit
                .message_bytes()
                .starts_with(b"babel safety revision\n\n")
            {
                let safety = format!("refs/safety/{id}");
                if git(repo.refname_to_id(&safety))? != id {
                    return Err(history_error());
                }
            }
            Ok(())
        });
        Ok(if healthy.is_ok() {
            HistoryHealth::Ready
        } else {
            HistoryHealth::NeedsAttention
        })
    }

    /// Caller holds native document ownership. This records only curated bytes;
    /// an exact checkpoint/source receipt must be obtained separately.
    pub fn record_revision(
        &mut self,
        identity: &DocumentRequest,
        version: Option<u64>,
        source: &[u8],
        profile: &str,
        label: &str,
        safety: bool,
    ) -> Result<RevisionReceipt, DocumentError> {
        self.validate_owner(identity)?;
        self.record_owned_revision(identity, version, source, profile, label, safety)
    }

    /// Internal only: caller has validated document/store leases and any disk adoption.
    pub(super) fn record_owned_revision(
        &mut self,
        identity: &DocumentRequest,
        version: Option<u64>,
        source: &[u8],
        profile: &str,
        label: &str,
        safety: bool,
    ) -> Result<RevisionReceipt, DocumentError> {
        self.validate_recovery_owner(identity)?;
        let registered = self.registered(identity)?;
        if !registered.queue.is_empty() {
            return Err(error(ErrorCode::SaveQueueFull));
        }
        if registered.save_uncertain {
            return Err(error(ErrorCode::SaveNeedsAttention));
        }
        if registered.anchor.is_some() {
            let state = self.inspect_source_save(identity)?;
            if state.intent.is_some()
                || state.previous_pending.is_some()
                || state.observation == saving::SaveObservation::NeedsAttention
            {
                return Err(error(ErrorCode::SaveNeedsAttention));
            }
        }
        match version {
            Some(version) => {
                let latest = self.inspect_recovery(identity)?.latest;
                if !latest.is_some_and(|entry| {
                    entry.metadata.session_id == identity.session_id
                        && entry.metadata.version == version
                        && entry.source == source
                }) {
                    return Err(error(ErrorCode::InvalidCheckpoint));
                }
            }
            None => {
                let anchor = self
                    .registered(identity)?
                    .anchor
                    .as_ref()
                    .ok_or_else(|| error(ErrorCode::MissingSource))?;
                if anchor.snapshot()?.0 != source {
                    return Err(error(ErrorCode::SourceChanged));
                }
            }
        }
        let result = self.history_repository(identity).and_then(|repo| {
            record_with(
                &repo,
                Capture {
                    project: &identity.document_id,
                    version,
                    source,
                    profile,
                    label,
                    safety,
                },
                |_| Ok(()),
            )
        });
        if let Some(record) = self.documents.get_mut(&identity.handle) {
            record.history_attention = result.is_err();
        }
        result
    }

    /// Serialize with native document ownership. Checkpoint survives a history failure;
    /// source/Undo are never changed here, and labels/profile remain native-owned.
    pub fn protect_editor_workflow(
        &mut self,
        request: WorkflowProtectionRequest,
    ) -> Result<WorkflowProtectionReceipt, DocumentError> {
        let operation = request.operation;
        let request = request.checkpoint;
        let checkpoint = self.checkpoint_request(request.clone())?;
        let profile = self.native_history_profile(&request.identity)?;
        let revision = self.record_revision(
            &request.identity,
            Some(request.version),
            &request.source,
            &profile,
            operation.label(),
            true,
        )?;
        Ok(WorkflowProtectionReceipt {
            operation,
            byte_length: request.source.len() as u64,
            checkpoint,
            revision,
        })
    }

    pub(super) fn protect_history_before_replacement(
        &mut self,
        identity: &DocumentRequest,
        source: &[u8],
    ) -> Result<RevisionReceipt, DocumentError> {
        let profile = self.native_history_profile(identity)?;
        self.record_revision(
            identity,
            None,
            source,
            &profile,
            "Before source replacement",
            true,
        )
    }
}

#[cfg(test)]
#[path = "history_store_tests.rs"]
mod tests;
