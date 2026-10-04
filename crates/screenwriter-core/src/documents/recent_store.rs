//! Linux auxiliary registry: bounded checksummed alternating generations and
//! a stable cooperating lease. Failure never invalidates source/recovery receipts.
use super::*;
use crate::documents::recents::*;
use std::os::unix::ffi::{OsStrExt, OsStringExt};

const SLOTS: [&str; 2] = ["recents-0.json", "recents-1.json"];
const PENDING: &str = "recents.pending";
const MAX_PATH: usize = 4096;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct StoredEntry {
    entry_id: String,
    document_id: String,
    kind: DocumentKind,
    native_path: Vec<u8>,
    fingerprint: DiskFingerprint,
}

impl StoredEntry {
    fn path(&self) -> PathBuf {
        PathBuf::from(OsString::from_vec(self.native_path.clone()))
    }
    fn summary(&self) -> RecentEntry {
        RecentEntry {
            entry_id: self.entry_id.clone(),
            document_id: self.document_id.clone(),
            kind: self.kind.clone(),
            file_name: label(&self.path()),
            last_known_modified_seconds: self.fingerprint.modified_seconds,
            last_known_modified_nanos: self.fingerprint.modified_nanos,
            availability: availability(&self.path()),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Generation {
    schema_version: u32,
    generation: u64,
    entries: Vec<StoredEntry>,
    entries_sha256: String,
}

struct ReadRegistry {
    generation: u64,
    entries: Vec<StoredEntry>,
    attention: bool,
}

pub(super) struct PendingLocate {
    entry: StoredEntry,
    anchor: Anchor,
    fingerprint: DiskFingerprint,
    project_fingerprint: Option<DiskFingerprint>,
    can_link: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PublishStage {
    PartialWrite,
    FileSynced,
    Replaced,
    DirectorySynced,
}

fn label(path: &Path) -> String {
    path.file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .chars()
        .take(120)
        .map(|c| {
            if c.is_control() || matches!(c, '\u{202a}'..='\u{202e}' | '\u{2066}'..='\u{2069}') {
                '\u{fffd}'
            } else {
                c
            }
        })
        .collect()
}

/// Stat only; warm listing never reads/decodes a manuscript or derives pages.
fn availability(path: &Path) -> RecentAvailability {
    match Anchor::selected(path).and_then(|a| {
        a.verify_location()?;
        let info = stat(&read_file(&a.parent, &a.name)?)?;
        if info.st_mode & 0o400 == 0 {
            return Err(error(ErrorCode::PermissionDenied));
        }
        Ok(())
    }) {
        Ok(()) => RecentAvailability::Available,
        Err(e) if e.code == ErrorCode::MissingSource => RecentAvailability::Missing,
        Err(_) => RecentAvailability::Unknown,
    }
}

fn validate(g: &Generation) -> Result<(), DocumentError> {
    if g.schema_version != 1 || g.generation == 0 || g.entries.len() > MAX_RECENTS {
        return Err(attention());
    }
    let bytes = serde_json::to_vec(&g.entries).map_err(|_| attention())?;
    if hash(&bytes) != g.entries_sha256 {
        return Err(attention());
    }
    let mut ids = std::collections::HashSet::new();
    let mut paths = std::collections::HashSet::new();
    for e in &g.entries {
        if !valid_uuid(&e.entry_id)
            || !valid_uuid(&e.document_id)
            || e.kind == DocumentKind::Unsaved
            || e.native_path.len() > MAX_PATH
            || e.native_path.contains(&0)
            || !e.path().is_absolute()
            || e.path()
                .components()
                .any(|c| !matches!(c, Component::RootDir | Component::Normal(_)))
            || e.path().components().collect::<PathBuf>() != e.path()
            || !ids.insert(&e.entry_id)
            || !paths.insert(&e.native_path)
            || e.fingerprint.sha256.len() != 64
            || !e.fingerprint.sha256.bytes().all(|b| b.is_ascii_hexdigit())
            || !(0..1_000_000_000).contains(&e.fingerprint.modified_nanos)
        {
            return Err(attention());
        }
    }
    Ok(())
}

fn selected_project_fingerprint(anchor: &Anchor) -> Result<Option<DiskFingerprint>, DocumentError> {
    match child_directory(&anchor.parent, OsStr::new(".screenwriter")) {
        Ok(aux) => snapshot(
            read_file(&aux, OsStr::new("project.json"))?,
            MAX_METADATA_BYTES,
        )
        .map(|(_, fingerprint)| Some(fingerprint)),
        Err(e) if e.code == ErrorCode::MissingSource => Ok(None),
        Err(e) => Err(e),
    }
}

// Explicit managed rename only: preserve unknown metadata and a synced prior mapping.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ManagedStage {
    PreviousSynced,
    MappingReplaced,
}

fn relink_managed_mapping(
    anchor: &Anchor,
    document_id: &str,
    fingerprint: &DiskFingerprint,
    gate: &mut impl FnMut(ManagedStage) -> Result<(), DocumentError>,
) -> Result<(), DocumentError> {
    anchor.verify_location()?;
    let aux = child_directory(&anchor.parent, OsStr::new(".screenwriter"))?;
    let aux_info = stat(&aux)?;
    let project_info = stat(&read_file(&aux, OsStr::new("project.json"))?)?;
    if aux_info.st_uid != geteuid().as_raw()
        || aux_info.st_mode & 0o7022 != 0
        || aux_info.st_mode & 0o300 != 0o300
        || project_info.st_uid != geteuid().as_raw()
        || project_info.st_nlink != 1
        || project_info.st_mode & 0o7022 != 0
        || project_info.st_mode & 0o200 == 0
    {
        return Err(error(ErrorCode::PermissionDenied));
    }
    let (old, old_fingerprint) = snapshot(
        read_file(&aux, OsStr::new("project.json"))?,
        MAX_METADATA_BYTES,
    )?;
    let mut metadata: serde_json::Value =
        serde_json::from_slice(&old).map_err(|_| error(ErrorCode::IdentityMismatch))?;
    if metadata["schemaVersion"] != 1 || metadata["projectId"].as_str() != Some(document_id) {
        return Err(error(ErrorCode::IdentityMismatch));
    }
    let old_name = metadata["sourceFilename"]
        .as_str()
        .ok_or_else(|| error(ErrorCode::IdentityMismatch))?;
    if !matches!(
        Path::new(old_name).components().next(),
        Some(Component::Normal(_))
    ) || Path::new(old_name).components().count() != 1
    {
        return Err(error(ErrorCode::IdentityMismatch));
    }
    match read_file(&anchor.parent, OsStr::new(old_name)) {
        Err(e) if e.code == ErrorCode::MissingSource => (),
        _ => return Err(error(ErrorCode::IdentityMismatch)),
    }
    metadata["sourceFilename"] = serde_json::Value::String(
        anchor
            .name
            .to_str()
            .ok_or_else(|| error(ErrorCode::UnsafePath))?
            .to_owned(),
    );
    let new = serde_json::to_vec(&metadata).map_err(|_| error(ErrorCode::IdentityMismatch))?;
    if new.len() > MAX_METADATA_BYTES {
        return Err(error(ErrorCode::IdentityMismatch));
    }
    let write = |bytes: &[u8]| -> Result<String, DocumentError> {
        let name = format!("project.locate-{}.pending", uuid());
        let mut file = File::from(
            fs::openat(
                &aux,
                name.as_str(),
                OFlags::WRONLY | OFlags::CREATE | OFlags::EXCL | OFlags::NOFOLLOW | OFlags::CLOEXEC,
                Mode::from_raw_mode(0o600),
            )
            .map_err(syscall_error)?,
        );
        file.write_all(bytes).map_err(io_error)?;
        file.sync_all().map_err(io_error)?;
        if snapshot(read_file(&aux, OsStr::new(&name))?, MAX_METADATA_BYTES)?.0 != bytes {
            return Err(error(ErrorCode::Io));
        }
        Ok(name)
    };
    // Refuse unsafe backup anchors instead of overwriting them.
    match read_file(&aux, OsStr::new("project.locate.previous")) {
        Ok(file) if private_file(&stat(&file)?) => (),
        Err(e) if e.code == ErrorCode::MissingSource => (),
        _ => return Err(error(ErrorCode::UnsafePath)),
    }
    let previous = write(&old)?;
    fs::renameat(&aux, previous.as_str(), &aux, "project.locate.previous")
        .map_err(syscall_error)?;
    aux.sync_all().map_err(io_error)?;
    gate(ManagedStage::PreviousSynced)?;
    let pending = write(&new)?;
    anchor.verify_location()?;
    if !same_file(
        &stat(&aux)?,
        &stat(&child_directory(
            &anchor.parent,
            OsStr::new(".screenwriter"),
        )?)?,
    ) || snapshot(
        read_file(&aux, OsStr::new("project.json"))?,
        MAX_METADATA_BYTES,
    )?
    .1 != old_fingerprint
        || anchor.snapshot()?.1 != *fingerprint
    {
        return Err(error(ErrorCode::SourceChanged));
    }
    fs::renameat(&aux, pending.as_str(), &aux, "project.json").map_err(syscall_error)?;
    gate(ManagedStage::MappingReplaced)?;
    aux.sync_all().map_err(io_error)?;
    anchor.verify_location()?;
    if !same_file(
        &stat(&aux)?,
        &stat(&child_directory(
            &anchor.parent,
            OsStr::new(".screenwriter"),
        )?)?,
    ) || snapshot(
        read_file(&aux, OsStr::new("project.json"))?,
        MAX_METADATA_BYTES,
    )?
    .0 != new
    {
        return Err(error(ErrorCode::SourceChanged));
    }
    Ok(())
}

impl DocumentService {
    fn read_recents(&self) -> Result<ReadRegistry, DocumentError> {
        self.verify_store()?;
        let mut good = Vec::new();
        let mut bad = false;
        for name in SLOTS {
            match read_file(&self.store, OsStr::new(name)) {
                Ok(file) => {
                    let read = (|| {
                        if !private_file(&stat(&file)?) {
                            return Err(attention());
                        }
                        let (bytes, _) = snapshot(file, MAX_RECENT_BYTES)?;
                        let g: Generation =
                            serde_json::from_slice(&bytes).map_err(|_| attention())?;
                        validate(&g)?;
                        if SLOTS[(g.generation % 2) as usize] != name {
                            return Err(attention());
                        }
                        Ok(g)
                    })();
                    match read {
                        Ok(g) => good.push(g),
                        Err(_) => bad = true,
                    }
                }
                Err(e) if e.code == ErrorCode::MissingSource => (),
                Err(_) => bad = true,
            }
        }
        // A crash leftover is never deleted/overwritten to obtain green status.
        match read_file(&self.store, OsStr::new(PENDING)) {
            Err(e) if e.code == ErrorCode::MissingSource => (),
            _ => bad = true,
        }
        self.verify_store()?;
        good.sort_by_key(|g| g.generation);
        if good.len() == 2
            && (good[0].generation == good[1].generation
                || good[1].generation - good[0].generation != 1)
        {
            bad = true;
        }
        let g = good.pop();
        Ok(ReadRegistry {
            generation: g.as_ref().map_or(0, |g| g.generation),
            entries: g.map_or_else(Vec::new, |g| g.entries),
            attention: bad,
        })
    }

    fn publish_recents(
        &self,
        r: &ReadRegistry,
        entries: Vec<StoredEntry>,
        lease: &Lease,
    ) -> Result<(), DocumentError> {
        self.publish_recents_with(r, entries, lease, &mut |_| Ok(()))
    }

    fn publish_recents_with(
        &self,
        r: &ReadRegistry,
        entries: Vec<StoredEntry>,
        lease: &Lease,
        gate: &mut impl FnMut(PublishStage) -> Result<(), DocumentError>,
    ) -> Result<(), DocumentError> {
        if r.attention {
            return Err(attention());
        }
        let generation = r.generation.checked_add(1).ok_or_else(attention)?;
        let entries_sha256 = hash(&serde_json::to_vec(&entries).map_err(|_| attention())?);
        let g = Generation {
            schema_version: 1,
            generation,
            entries,
            entries_sha256,
        };
        validate(&g)?;
        let bytes = serde_json::to_vec(&g).map_err(|_| attention())?;
        if bytes.len() > MAX_RECENT_BYTES {
            return Err(attention());
        }
        self.verify_lease(lease)?;
        let mut file = File::from(
            fs::openat(
                &self.store,
                PENDING,
                OFlags::WRONLY | OFlags::CREATE | OFlags::EXCL | OFlags::NOFOLLOW | OFlags::CLOEXEC,
                Mode::from_raw_mode(0o600),
            )
            .map_err(syscall_error)?,
        );
        // Retain failed/interrupted artifacts for inspection; the old generation remains intact.
        let half = bytes.len() / 2;
        file.write_all(&bytes[..half]).map_err(io_error)?;
        gate(PublishStage::PartialWrite)?;
        file.write_all(&bytes[half..]).map_err(io_error)?;
        file.sync_all().map_err(io_error)?;
        gate(PublishStage::FileSynced)?;
        let (verified, _) = snapshot(
            read_file(&self.store, OsStr::new(PENDING))?,
            MAX_RECENT_BYTES,
        )?;
        if verified != bytes {
            return Err(attention());
        }
        self.verify_lease(lease)?;
        fs::renameat(
            &self.store,
            PENDING,
            &self.store,
            SLOTS[(generation % 2) as usize],
        )
        .map_err(syscall_error)?;
        gate(PublishStage::Replaced)?;
        self.store.sync_all().map_err(io_error)?;
        gate(PublishStage::DirectorySynced)?;
        self.verify_lease(lease)?;
        Ok(())
    }

    pub fn list_recent_projects(&self) -> Result<RecentList, DocumentError> {
        let lease = self.lease("recent-projects")?;
        let r = self.read_recents()?;
        self.verify_lease(&lease)?;
        Ok(RecentList {
            entries: r.entries.iter().map(StoredEntry::summary).collect(),
            health: if r.attention || self.recent_attention {
                RecentHealth::NeedsAttention
            } else {
                RecentHealth::Ready
            },
        })
    }

    pub fn remove_recent_project(&mut self, request: &RecentRequest) -> Result<(), DocumentError> {
        let lease = self.lease("recent-projects")?;
        let r = self.read_recents()?;
        if !r.entries.iter().any(|e| e.entry_id == request.entry_id) {
            return Err(error(ErrorCode::InvalidRecentSelection));
        }
        let entries = r
            .entries
            .iter()
            .filter(|e| e.entry_id != request.entry_id)
            .cloned()
            .collect();
        self.publish_recents(&r, entries, &lease)?;
        self.locate_selections
            .retain(|_, p| p.entry.entry_id != request.entry_id);
        Ok(())
    }

    /// Called only after successful source open/publication. Unsaved/ephemeral identities never register.
    pub(super) fn note_recent(&mut self, identity: &DocumentRequest, moved_from: Option<&str>) {
        let result = (|| {
            let record = self.registered(identity)?;
            if !record.initial.persistent_identity {
                return Ok(());
            }
            let Some(anchor) = &record.anchor else {
                return Ok(());
            };
            let native_path = anchor.path.as_os_str().as_bytes().to_vec();
            if native_path.len() > MAX_PATH {
                return Err(attention());
            }
            let Some(fingerprint) = record.baseline.clone() else {
                return Ok(());
            };
            let kind = record.initial.kind.clone();
            let lease = self.lease("recent-projects")?;
            let r = self.read_recents()?;
            let entry_id = moved_from
                .map(str::to_owned)
                .or_else(|| {
                    r.entries
                        .iter()
                        .find(|e| e.native_path == native_path)
                        .map(|e| e.entry_id.clone())
                })
                .unwrap_or_else(uuid);
            let mut entries = r.entries.clone();
            entries.retain(|e| e.native_path != native_path && e.entry_id != entry_id);
            entries.insert(
                0,
                StoredEntry {
                    entry_id,
                    document_id: identity.document_id.clone(),
                    kind,
                    native_path,
                    fingerprint,
                },
            );
            entries.truncate(MAX_RECENTS);
            self.publish_recents(&r, entries, &lease)
        })();
        if result.is_err() {
            self.recent_attention = true;
        }
    }

    fn recent_entry(&self, request: &RecentRequest) -> Result<StoredEntry, DocumentError> {
        let lease = self.lease("recent-projects")?;
        let r = self.read_recents()?;
        self.verify_lease(&lease)?;
        r.entries
            .into_iter()
            .find(|e| e.entry_id == request.entry_id)
            .ok_or_else(|| error(ErrorCode::InvalidRecentSelection))
    }

    pub fn open_recent_project(
        &mut self,
        request: &RecentRequest,
    ) -> Result<RecentOpen, DocumentError> {
        let entry = self.recent_entry(request)?;
        let opened = self.open_selected_unlisted(&entry.path())?;
        if opened.identity.document_id != entry.document_id || opened.kind != entry.kind {
            let _ = self.release(&opened.identity);
            return Err(error(ErrorCode::IdentityMismatch));
        }
        self.note_recent(&opened.identity, None);
        Ok(RecentOpen {
            document: opened,
            registry_health: self
                .list_recent_projects()
                .map_or(RecentHealth::NeedsAttention, |r| r.health),
        })
    }

    /// Picker output is native-only. Stages a selection without opening/minting identities or mutating registry/recovery.
    pub fn select_recent_location(
        &mut self,
        request: &RecentRequest,
        path: &Path,
    ) -> Result<LocateSelection, DocumentError> {
        let entry = self.recent_entry(request)?;
        let anchor = Anchor::selected(path)?;
        let (bytes, fingerprint) = anchor.snapshot()?;
        let project_fingerprint = selected_project_fingerprint(&anchor)?;
        let (kind, managed, reason) = project_identity(&anchor);
        if selected_project_fingerprint(&anchor)? != project_fingerprint {
            return Err(error(ErrorCode::SourceChanged));
        }
        let same_managed_identity = kind == DocumentKind::Managed
            && managed.as_ref() == Some(&entry.document_id)
            && (reason.is_none() || reason == Some(ViewReason::SourceMappingMismatch));
        let can_link = availability(&entry.path()) == RecentAvailability::Missing
            && (reason.is_none()
                || (same_managed_identity && reason == Some(ViewReason::SourceMappingMismatch)))
            && kind == entry.kind
            && (kind == DocumentKind::Loose || same_managed_identity)
            && view_reasons(&fingerprint, &stat(&anchor.parent)?).is_empty()
            && std::str::from_utf8(&bytes).is_ok();
        // Replace only this entry's prior candidate. Invalid/cancel selection retains it.
        if self.locate_selections.len() >= MAX_LOCATE_SELECTIONS
            && !self
                .locate_selections
                .values()
                .any(|p| p.entry.entry_id == request.entry_id)
        {
            return Err(error(ErrorCode::InvalidRecentSelection));
        }
        let selection_token = uuid();
        let selection = LocateSelection {
            entry_id: request.entry_id.clone(),
            selection_token: selection_token.clone(),
            file_name: label(path),
            same_managed_identity,
            content_matches_last_known: fingerprint.sha256 == entry.fingerprint.sha256,
            can_link_moved: can_link,
        };
        self.locate_selections
            .retain(|_, p| p.entry.entry_id != request.entry_id);
        self.locate_selections.insert(
            selection_token,
            PendingLocate {
                entry,
                anchor,
                fingerprint,
                project_fingerprint,
                can_link,
            },
        );
        Ok(selection)
    }

    pub fn confirm_recent_location(
        &mut self,
        request: &ConfirmLocateRequest,
    ) -> Result<RecentOpen, DocumentError> {
        let entry = self.recent_entry(&RecentRequest {
            entry_id: request.entry_id.clone(),
        })?;
        let pending = self
            .locate_selections
            .get(&request.selection_token)
            .filter(|p| p.entry == entry)
            .ok_or_else(|| error(ErrorCode::InvalidRecentSelection))?;
        if pending.anchor.snapshot()?.1 != pending.fingerprint
            || selected_project_fingerprint(&pending.anchor)? != pending.project_fingerprint
        {
            return Err(error(ErrorCode::SourceChanged));
        }
        self.check_capacity()?;
        let path = pending.anchor.path.clone();
        let selected_fingerprint = pending.fingerprint.clone();
        if request.choice == LocateChoice::LinkMoved {
            if !pending.can_link || availability(&entry.path()) != RecentAvailability::Missing {
                return Err(error(ErrorCode::IdentityMismatch));
            }
            // Refuse a live owner, including this instance. No recovery/lease transfer behind its back.
            let document_lease = self.lease(&format!("document:{}", entry.document_id))?;
            let source_lease = self.lease(&format!(
                "source:{}:{}",
                pending.fingerprint.device, pending.fingerprint.inode
            ))?;
            let (kind, managed, reason) = project_identity(&pending.anchor);
            if (reason.is_some() && reason != Some(ViewReason::SourceMappingMismatch))
                || kind != entry.kind
                || (kind == DocumentKind::Managed && managed.as_ref() != Some(&entry.document_id))
            {
                return Err(error(ErrorCode::IdentityMismatch));
            }
            if !view_reasons(&pending.fingerprint, &stat(&pending.anchor.parent)?).is_empty() {
                return Err(error(ErrorCode::OwnershipRequired));
            }
            if entry.kind == DocumentKind::Loose {
                choices_store::link_loose_identity(self, &pending.anchor, &entry.document_id)?;
            } else if reason == Some(ViewReason::SourceMappingMismatch) {
                relink_managed_mapping(
                    &pending.anchor,
                    &entry.document_id,
                    &pending.fingerprint,
                    &mut |_| Ok(()),
                )?;
            }
            self.verify_lease(&document_lease)?;
            self.verify_lease(&source_lease)?;
            // open_selected obtains the same stable locks and revalidates. Another instance may
            // win this interval; the conservative result then remains view-only, never a second writer.
            drop(source_lease);
            drop(document_lease);
        }
        let opened = self.open_selected_unlisted(&path)?;
        if opened.fingerprint.as_ref() != Some(&selected_fingerprint) {
            let _ = self.release(&opened.identity);
            return Err(error(ErrorCode::SourceChanged));
        }
        if request.choice == LocateChoice::LinkMoved
            && (opened.identity.document_id != entry.document_id || opened.kind != entry.kind)
        {
            let _ = self.release(&opened.identity);
            return Err(error(ErrorCode::IdentityMismatch));
        }
        self.locate_selections.remove(&request.selection_token);
        self.note_recent(
            &opened.identity,
            if request.choice == LocateChoice::LinkMoved {
                Some(&entry.entry_id)
            } else {
                None
            },
        );
        Ok(RecentOpen {
            document: opened,
            registry_health: self
                .list_recent_projects()
                .map_or(RecentHealth::NeedsAttention, |r| r.health),
        })
    }
}

#[cfg(test)]
#[path = "recent_store_tests.rs"]
mod tests;
