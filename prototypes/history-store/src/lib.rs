//! M1-05 disposable history proof; no desktop linkage or source-file writes.
#[cfg(target_os = "linux")]
pub mod proof;
use git2::{
    Config, ConfigLevel, Error, ErrorCode, Oid, Repository, RepositoryInitOptions, Signature, Time,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::Path;

pub const MAIN: &str = "refs/heads/main";
pub const PROJECT: &str = "00000000-0000-4000-8000-000000000001";
pub const PROFILE: &str = "synthetic-profile-v0";
pub const OLD: &[u8] = b"\xef\xbb\xbfTitle: Synthetic\r\n\r\nINT. ROOM - DAY\r\n  Old words.  \r\n";
pub const NEW: &[u8] =
    b"\xef\xbb\xbfTitle: Synthetic\r\n\r\nINT. ROOM - DAY\r\n  New [[unknown]] words.  \r\n";
const MAX_SOURCE: usize = 1024 * 1024;

fn error(message: &str) -> Error {
    Error::from_str(message)
}
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct Manifest {
    pub schema: u32,
    pub project: String,
    pub source_sha256: String,
    pub profile: String,
    pub profile_sha256: String,
}

#[derive(Debug, PartialEq, Eq)]
pub struct Revision {
    pub source: Vec<u8>,
    pub manifest: Manifest,
}

/// Only trusted fresh proof repositories are used. Keep their configuration
/// local, excluding default global/system config and all personal identities.
pub fn open(path: &Path) -> Result<Repository, Error> {
    let repo = Repository::open_bare(path)?;
    local_config(&repo)?;
    Ok(repo)
}

pub fn init(path: &Path) -> Result<Repository, Error> {
    let mut options = RepositoryInitOptions::new();
    options
        .bare(true)
        .external_template(false)
        .initial_head("main");
    let repo = Repository::init_opts(path, &options)?;
    local_config(&repo)?;
    Ok(repo)
}

fn local_config(repo: &Repository) -> Result<(), Error> {
    let mut config = Config::new()?;
    config.add_file(&repo.path().join("config"), ConfigLevel::Local, false)?;
    repo.set_config(&config)
}

pub fn head(repo: &Repository) -> Result<Option<Oid>, Error> {
    match repo.refname_to_id(MAIN) {
        Ok(id) => Ok(Some(id)),
        Err(e) if e.code() == ErrorCode::NotFound => Ok(None),
        Err(e) => Err(e),
    }
}

/// Create immutable curated objects WITHOUT moving any live ref. The profile
/// is a synthetic identity, not the M5 frozen publication profile.
pub fn snapshot(
    repo: &Repository,
    source: &[u8],
    profile: &str,
    parents: &[Oid],
    label: &str,
    seconds: i64,
) -> Result<Oid, Error> {
    if source.len() > MAX_SOURCE
        || std::str::from_utf8(source).is_err()
        || profile.len() > 256
        || label.len() > 512
    {
        return Err(error("proof payload invalid or over limit"));
    }
    let manifest = Manifest {
        schema: 1,
        project: PROJECT.into(),
        source_sha256: hash(source),
        profile: profile.into(),
        profile_sha256: hash(profile.as_bytes()),
    };
    let json = serde_json::to_vec(&manifest).map_err(|_| error("manifest serialization failed"))?;
    let mut tree = repo.treebuilder(None)?;
    tree.insert("screenplay.fountain", repo.blob(source)?, 0o100644)?;
    tree.insert("manifest.json", repo.blob(&json)?, 0o100644)?;
    let tree = repo.find_tree(tree.write()?)?;
    let parents = parents
        .iter()
        .map(|&id| repo.find_commit(id))
        .collect::<Result<Vec<_>, _>>()?;
    let parents = parents.iter().collect::<Vec<_>>();
    let signature = Signature::new(
        "babel synthetic proof",
        "proof@localhost.invalid",
        &Time::new(seconds, 0),
    )?;
    repo.commit(None, &signature, &signature, label, &tree, &parents)
}

pub fn read(repo: &Repository, id: Oid, project: &str) -> Result<Revision, Error> {
    let commit = repo.find_commit(id)?;
    let tree = commit.tree()?;
    if tree.len() != 2 {
        return Err(error("uncurated tree"));
    }
    for entry in tree.iter() {
        if !matches!(entry.name(), Ok("screenplay.fountain" | "manifest.json"))
            || entry.filemode() != 0o100644
        {
            return Err(error("unexpected path/type/mode"));
        }
    }
    let source_id = tree
        .get_name("screenplay.fountain")
        .ok_or_else(|| error("missing screenplay"))?
        .id();
    let manifest_id = tree
        .get_name("manifest.json")
        .ok_or_else(|| error("missing manifest"))?
        .id();
    let source = repo.find_blob(source_id)?;
    let json = repo.find_blob(manifest_id)?;
    if source.size() > MAX_SOURCE
        || json.size() > 4096
        || std::str::from_utf8(source.content()).is_err()
    {
        return Err(error("revision payload invalid or over limit"));
    }
    let manifest: Manifest =
        serde_json::from_slice(json.content()).map_err(|_| error("invalid manifest"))?;
    if manifest.schema != 1
        || manifest.project != project
        || manifest.source_sha256 != hash(source.content())
        || manifest.profile.len() > 256
        || manifest.profile_sha256 != hash(manifest.profile.as_bytes())
    {
        return Err(error("schema/identity/hash mismatch"));
    }
    Ok(Revision {
        source: source.content().to_vec(),
        manifest,
    })
}

/// Local compare-and-swap is distinct from a force push. Only commits whose
/// first parent is the expected head can advance this proof's main ref.
pub fn advance(repo: &Repository, expected: Option<Oid>, next: Oid) -> Result<(), Error> {
    read(repo, next, PROJECT)?;
    let commit = repo.find_commit(next)?;
    if commit.parent_ids().next() != expected {
        return Err(error("wrong first parent"));
    }
    match expected {
        Some(old) => {
            repo.reference_matching(MAIN, next, true, old, "proof advance")?;
        }
        None => {
            repo.reference(MAIN, next, false, "proof initial")?;
        }
    }
    Ok(())
}

pub fn record(
    repo: &Repository,
    expected: Option<Oid>,
    source: &[u8],
    profile: &str,
) -> Result<Oid, Error> {
    if head(repo)? != expected {
        return Err(error("stale head"));
    }
    if let Some(id) = expected {
        let previous = read(repo, id, PROJECT)?;
        if previous.source == source && previous.manifest.profile == profile {
            return Ok(id);
        }
    }
    let next = snapshot(
        repo,
        source,
        profile,
        &expected.into_iter().collect::<Vec<_>>(),
        "synthetic snapshot",
        100,
    )?;
    advance(repo, expected, next)?;
    Ok(next)
}

pub fn protect(repo: &Repository, namespace: &str, id: Oid) -> Result<(), Error> {
    if !matches!(namespace, "safety" | "conflicts" | "transfer") {
        return Err(error("invalid proof namespace"));
    }
    let name = format!("refs/{namespace}/{id}");
    match repo.reference(&name, id, false, "proof protection") {
        Ok(_) => Ok(()),
        Err(e) if e.code() == ErrorCode::Exists && repo.refname_to_id(&name)? == id => Ok(()),
        Err(e) => Err(e),
    }
}

/// Produces a NEW history revision; never touches a manuscript or resets HEAD.
pub fn restore(repo: &Repository, current: Oid, selected: Oid) -> Result<Oid, Error> {
    read(repo, current, PROJECT)?;
    let target = read(repo, selected, PROJECT)?;
    protect(repo, "safety", current)?;
    protect(repo, "safety", selected)?;
    let restored = snapshot(
        repo,
        &target.source,
        &target.manifest.profile,
        &[current],
        "synthetic restore",
        101,
    )?;
    advance(repo, Some(current), restored)?;
    Ok(restored)
}

#[derive(Debug, PartialEq, Eq)]
pub enum Ancestry {
    Same,
    LocalBehind,
    LocalAhead,
    Diverged,
    Unrelated,
}
#[derive(Debug, PartialEq, Eq)]
pub struct Relationship {
    pub ancestry: Ancestry,
    pub same_content: bool,
}

pub fn relationship(repo: &Repository, local: Oid, incoming: Oid) -> Result<Relationship, Error> {
    let a = read(repo, local, PROJECT)?;
    let b = read(repo, incoming, PROJECT)?;
    let ancestry = if local == incoming {
        Ancestry::Same
    } else if repo.graph_descendant_of(incoming, local)? {
        Ancestry::LocalBehind
    } else if repo.graph_descendant_of(local, incoming)? {
        Ancestry::LocalAhead
    } else {
        match repo.merge_base(local, incoming) {
            Ok(_) => Ancestry::Diverged,
            Err(e) if e.code() == ErrorCode::NotFound => Ancestry::Unrelated,
            Err(e) => return Err(e),
        }
    };
    Ok(Relationship {
        ancestry,
        same_content: a == b,
    })
}

fn local_url(remote: &Repository) -> Result<&str, Error> {
    if !remote.is_bare() {
        return Err(error("bare local remote required"));
    }
    remote
        .path()
        .to_str()
        .ok_or_else(|| error("non-UTF8 proof path"))
}

/// Local-filesystem transport only, into a distinct incoming ref. No fetch
/// changes main, source, or a previous operation's incoming ref.
pub fn fetch_local(repo: &Repository, remote: &Repository, operation: &str) -> Result<Oid, Error> {
    if operation.is_empty()
        || operation.len() > 32
        || !operation.bytes().all(|b| b.is_ascii_alphanumeric())
    {
        return Err(error("invalid operation identity"));
    }
    let name = format!("refs/incoming/{operation}");
    if repo.find_reference(&name).is_ok() {
        return Err(error("incoming operation already exists"));
    }
    let mut transport = repo.remote_anonymous(local_url(remote)?)?;
    let mut options = git2::FetchOptions::new();
    options
        .download_tags(git2::AutotagOption::None)
        .prune(git2::FetchPrune::Off);
    transport.fetch(
        &[format!("{MAIN}:{name}")],
        Some(&mut options),
        Some("synthetic fetch"),
    )?;
    let incoming = repo.refname_to_id(&name)?;
    read(repo, incoming, PROJECT)?;
    Ok(incoming)
}

/// Capture an immutable revision ref and use a normal refspec (no '+').
/// Check both transport result AND per-ref status before confirming the head.
pub fn push_local(repo: &Repository, remote: &Repository, captured: Oid) -> Result<Oid, Error> {
    read(repo, captured, PROJECT)?;
    protect(repo, "transfer", captured)?;
    let refspec = format!("refs/transfer/{captured}:{MAIN}");
    let mut status = None;
    {
        let mut callbacks = git2::RemoteCallbacks::new();
        callbacks.push_update_reference(|name, rejection| {
            if name == MAIN {
                status = Some(rejection.map(str::to_owned));
            }
            Ok(())
        });
        let mut options = git2::PushOptions::new();
        options.remote_callbacks(callbacks);
        repo.remote_anonymous(local_url(remote)?)?
            .push(&[refspec], Some(&mut options))?;
    }
    match status {
        Some(None) if head(remote)? == Some(captured) => Ok(captured),
        Some(Some(_)) => Err(error("remote ref rejected")),
        _ => Err(error("push result unconfirmed")),
    }
}
