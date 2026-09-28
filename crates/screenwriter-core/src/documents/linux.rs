use super::*;
use rustix::fs::{self, FileType, FlockOperation, Mode, OFlags, Stat};
use rustix::io::Errno;
use rustix::process::geteuid;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::ffi::{OsStr, OsString};
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use uuid::Uuid;

#[path = "recovery_store.rs"]
mod recovery_store;
use super::recovery::{CheckpointReceipt, source_hash};
pub use recovery_store::RecoveryInspection;

const MAX_METADATA_BYTES: usize = 16 * 1024;

fn error(code: ErrorCode) -> DocumentError {
    DocumentError::new(code)
}

fn io_error(err: std::io::Error) -> DocumentError {
    match err.kind() {
        std::io::ErrorKind::NotFound => error(ErrorCode::MissingSource),
        std::io::ErrorKind::PermissionDenied => error(ErrorCode::PermissionDenied),
        _ => error(ErrorCode::Io),
    }
}

fn syscall_error(err: Errno) -> DocumentError {
    match err {
        Errno::NOENT => error(ErrorCode::MissingSource),
        Errno::ACCESS | Errno::PERM => error(ErrorCode::PermissionDenied),
        Errno::LOOP | Errno::NOTDIR => error(ErrorCode::UnsafePath),
        _ => error(ErrorCode::Io),
    }
}

fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn uuid() -> String {
    Uuid::new_v4().to_string()
}

fn stat(file: &File) -> Result<Stat, DocumentError> {
    fs::fstat(file).map_err(syscall_error)
}

fn same_file(a: &Stat, b: &Stat) -> bool {
    a.st_dev == b.st_dev && a.st_ino == b.st_ino
}

/// Walk every component from root with NOFOLLOW; never canonicalize a symlink.
fn directory(path: &Path) -> Result<File, DocumentError> {
    if !path.is_absolute() {
        return Err(error(ErrorCode::UnsafePath));
    }
    let flags = OFlags::RDONLY | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC;
    let mut current = File::from(fs::open("/", flags, Mode::empty()).map_err(syscall_error)?);
    for part in path.components() {
        match part {
            Component::RootDir => (),
            Component::Normal(name) => {
                current = File::from(
                    fs::openat(&current, name, flags, Mode::empty()).map_err(syscall_error)?,
                );
            }
            _ => return Err(error(ErrorCode::UnsafePath)),
        }
    }
    Ok(current)
}

fn child_directory(parent: &File, name: &OsStr) -> Result<File, DocumentError> {
    fs::openat(
        parent,
        name,
        OFlags::RDONLY | OFlags::DIRECTORY | OFlags::NOFOLLOW | OFlags::CLOEXEC,
        Mode::empty(),
    )
    .map(File::from)
    .map_err(syscall_error)
}

fn read_file(parent: &File, name: &OsStr) -> Result<File, DocumentError> {
    // NONBLOCK prevents a selected FIFO from hanging before fstat rejects it.
    let file = File::from(
        fs::openat(
            parent,
            name,
            OFlags::RDONLY | OFlags::NOFOLLOW | OFlags::NONBLOCK | OFlags::CLOEXEC,
            Mode::empty(),
        )
        .map_err(syscall_error)?,
    );
    if FileType::from_raw_mode(stat(&file)?.st_mode) != FileType::RegularFile {
        return Err(error(ErrorCode::NotRegularFile));
    }
    Ok(file)
}

fn fingerprint(info: &Stat, bytes: &[u8]) -> DiskFingerprint {
    DiskFingerprint {
        device: info.st_dev.to_string(),
        inode: info.st_ino.to_string(),
        byte_length: bytes.len() as u64,
        sha256: hash(bytes),
        modified_seconds: info.st_mtime,
        modified_nanos: info.st_mtime_nsec as i64,
        changed_seconds: info.st_ctime,
        changed_nanos: info.st_ctime_nsec as i64,
        mode: info.st_mode,
        owner: info.st_uid,
        links: info.st_nlink,
    }
}

fn snapshot(mut file: File, limit: usize) -> Result<(Vec<u8>, DiskFingerprint), DocumentError> {
    let before = stat(&file)?;
    if before.st_size < 0 || before.st_size as u64 > limit as u64 {
        return Err(error(ErrorCode::SourceTooLarge));
    }
    let mut bytes = Vec::new();
    (&mut file)
        .take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(io_error)?;
    if bytes.len() > limit {
        return Err(error(ErrorCode::SourceTooLarge));
    }
    let after = stat(&file)?;
    if fingerprint(&before, &bytes) != fingerprint(&after, &bytes)
        || after.st_size as u64 != bytes.len() as u64
    {
        return Err(error(ErrorCode::SourceChanged));
    }
    let captured = fingerprint(&after, &bytes);
    Ok((bytes, captured))
}

fn private_file(info: &Stat) -> bool {
    FileType::from_raw_mode(info.st_mode) == FileType::RegularFile
        && info.st_uid == geteuid().as_raw()
        && info.st_nlink == 1
        && info.st_mode & 0o7777 == 0o600
}

struct Anchor {
    parent: File,
    path: PathBuf,
    name: OsString,
}

impl Anchor {
    fn selected(path: &Path) -> Result<Self, DocumentError> {
        let name = path
            .file_name()
            .ok_or_else(|| error(ErrorCode::UnsafePath))?
            .to_os_string();
        // Reject parent traversal even when the final component is innocuous.
        if path
            .components()
            .any(|c| !matches!(c, Component::RootDir | Component::Normal(_)))
        {
            return Err(error(ErrorCode::UnsafePath));
        }
        let parent = directory(path.parent().ok_or_else(|| error(ErrorCode::UnsafePath))?)?;
        Ok(Self {
            parent,
            path: path.components().collect(),
            name,
        })
    }

    fn verify_location(&self) -> Result<(), DocumentError> {
        let current = directory(
            self.path
                .parent()
                .ok_or_else(|| error(ErrorCode::UnsafePath))?,
        )?;
        if !same_file(&stat(&self.parent)?, &stat(&current)?) {
            return Err(error(ErrorCode::SourceChanged));
        }
        Ok(())
    }

    fn snapshot(&self) -> Result<(Vec<u8>, DiskFingerprint), DocumentError> {
        self.verify_location()?;
        let result = snapshot(read_file(&self.parent, &self.name)?, MAX_SOURCE_BYTES)?;
        // Confirm the selected directory entry still denotes the captured inode/generation.
        let current = stat(&read_file(&self.parent, &self.name)?)?;
        if fingerprint(&current, &result.0) != result.1 {
            return Err(error(ErrorCode::SourceChanged));
        }
        self.verify_location()?;
        Ok(result)
    }
}

struct Lease {
    file: File,
    name: String,
}

impl Drop for Lease {
    fn drop(&mut self) {
        // Stable lock inodes are never unlinked. Explicit unlock avoids inherited-fd delays.
        let _ = fs::flock(&self.file, FlockOperation::Unlock);
    }
}

struct Registered {
    initial: OpenDocument,
    anchor: Option<Anchor>,
    leases: Vec<Lease>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LooseIdentity {
    schema_version: u32,
    document_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectIdentity {
    schema_version: u32,
    project_id: String,
    source_filename: String,
    pdf_profile: serde_json::Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProjectSchema {
    schema_version: u32,
}

/// All path-bearing methods are native-only. The frontend receives only OpenDocument.
pub struct DocumentService {
    store: File,
    store_path: PathBuf,
    documents: HashMap<String, Registered>,
}

impl DocumentService {
    /// Caller supplies the OS app-data location, never a frontend string.
    /// Parent must exist; creates only the private final directory, mode 0700.
    pub fn new(app_data: &Path) -> Result<Self, DocumentError> {
        let anchor = Anchor::selected(app_data)?;
        match fs::mkdirat(&anchor.parent, &anchor.name, Mode::from_raw_mode(0o700)) {
            Ok(()) => anchor.parent.sync_all().map_err(io_error)?,
            Err(Errno::EXIST) => (),
            Err(err) => return Err(syscall_error(err)),
        }
        let store = child_directory(&anchor.parent, &anchor.name)?;
        let info = stat(&store)?;
        if info.st_uid != geteuid().as_raw() || info.st_mode & 0o7777 != 0o700 {
            return Err(error(ErrorCode::IdentityStoreUnavailable));
        }
        Ok(Self {
            store,
            store_path: app_data.to_path_buf(),
            documents: HashMap::new(),
        })
    }

    fn verify_store(&self) -> Result<(), DocumentError> {
        let current = directory(&self.store_path)?;
        let held = stat(&self.store)?;
        if !same_file(&held, &stat(&current)?)
            || held.st_uid != geteuid().as_raw()
            || held.st_mode & 0o7777 != 0o700
        {
            return Err(error(ErrorCode::IdentityStoreUnavailable));
        }
        Ok(())
    }

    fn lease(&self, key: &str) -> Result<Lease, DocumentError> {
        self.verify_store()?;
        let name = format!("{}.lock", hash(key.as_bytes()));
        let file = File::from(
            fs::openat(
                &self.store,
                name.as_str(),
                OFlags::RDWR
                    | OFlags::CREATE
                    | OFlags::NOFOLLOW
                    | OFlags::NONBLOCK
                    | OFlags::CLOEXEC,
                Mode::from_raw_mode(0o600),
            )
            .map_err(syscall_error)?,
        );
        if !private_file(&stat(&file)?) {
            return Err(error(ErrorCode::OwnershipLost));
        }
        fs::flock(&file, FlockOperation::NonBlockingLockExclusive)
            .map_err(|_| error(ErrorCode::OwnershipRequired))?;
        let lease = Lease { file, name };
        self.verify_lease(&lease)?;
        Ok(lease)
    }

    fn verify_lease(&self, lease: &Lease) -> Result<(), DocumentError> {
        self.verify_store()?;
        let current = read_file(&self.store, OsStr::new(&lease.name))?;
        let held = stat(&lease.file)?;
        if !private_file(&held) || !same_file(&held, &stat(&current)?) {
            return Err(error(ErrorCode::OwnershipLost));
        }
        Ok(())
    }

    fn loose_identity(&self, anchor: &Anchor) -> Result<String, DocumentError> {
        // Path mapping survives source replacement; copies at other paths get new random IDs.
        use std::os::unix::ffi::OsStrExt;
        let key = hash(anchor.path.as_os_str().as_bytes());
        let _registration_lease = self.lease(&format!("registry:{key}"))?;
        let name = format!("{key}.identity.json");
        match read_file(&self.store, OsStr::new(&name)) {
            Ok(file) => {
                if !private_file(&stat(&file)?) {
                    return Err(error(ErrorCode::IdentityStoreUnavailable));
                }
                let (bytes, _) = snapshot(file, MAX_METADATA_BYTES)?;
                let record: LooseIdentity = serde_json::from_slice(&bytes)
                    .map_err(|_| error(ErrorCode::IdentityStoreUnavailable))?;
                if record.schema_version != 1 || !valid_uuid(&record.document_id) {
                    return Err(error(ErrorCode::IdentityStoreUnavailable));
                }
                Ok(record.document_id)
            }
            Err(err) if err.code == ErrorCode::MissingSource => {
                let document_id = uuid();
                let bytes = serde_json::to_vec(&LooseIdentity {
                    schema_version: 1,
                    document_id: document_id.clone(),
                })
                .map_err(|_| error(ErrorCode::IdentityStoreUnavailable))?;
                let mut file = File::from(
                    fs::openat(
                        &self.store,
                        name.as_str(),
                        OFlags::WRONLY
                            | OFlags::CREATE
                            | OFlags::EXCL
                            | OFlags::NOFOLLOW
                            | OFlags::CLOEXEC,
                        Mode::from_raw_mode(0o600),
                    )
                    .map_err(syscall_error)?,
                );
                file.write_all(&bytes).map_err(io_error)?;
                file.sync_all().map_err(io_error)?;
                self.store.sync_all().map_err(io_error)?;
                self.verify_store()?;
                Ok(document_id)
            }
            Err(err) => Err(err),
        }
    }

    pub fn open_selected(&mut self, path: &Path) -> Result<OpenDocument, DocumentError> {
        self.check_capacity()?;
        let anchor = Anchor::selected(path)?;
        let (source, fingerprint) = anchor.snapshot()?;
        let encoding = if std::str::from_utf8(&source).is_ok() {
            SourceEncoding::Utf8
        } else {
            SourceEncoding::Unsupported
        };
        let mut reasons = view_reasons(&fingerprint, &stat(&anchor.parent)?);
        if encoding == SourceEncoding::Unsupported {
            reasons.push(ViewReason::UnsupportedEncoding);
        }
        let (kind, managed, metadata_reason) = project_identity(&anchor);
        if let Some(reason) = metadata_reason {
            reasons.push(reason);
        }
        let (document_id, persistent_identity) = match managed {
            Some(id) => (id, true),
            None if kind == DocumentKind::Loose
                && !reasons.contains(&ViewReason::InvalidProjectMetadata)
                && !reasons.contains(&ViewReason::UnknownProjectSchema) =>
            {
                match self.loose_identity(&anchor) {
                    Ok(id) => (id, true),
                    Err(_) => {
                        reasons.push(ViewReason::IdentityUnavailable);
                        (uuid(), false)
                    }
                }
            }
            None => (uuid(), false),
        };
        let mut leases = Vec::new();
        if reasons.is_empty() {
            for key in [
                format!("source:{}:{}", fingerprint.device, fingerprint.inode),
                format!("document:{document_id}"),
            ] {
                match self.lease(&key) {
                    Ok(lease) => leases.push(lease),
                    Err(err) => {
                        reasons.push(if err.code == ErrorCode::OwnershipRequired {
                            ViewReason::AlreadyOwned
                        } else {
                            ViewReason::IdentityUnavailable
                        });
                        leases.clear();
                        break;
                    }
                }
            }
        }
        // An open races with external writers too; do not publish a stale exclusive lease.
        let (_, current) = anchor.snapshot()?;
        if current != fingerprint {
            return Err(error(ErrorCode::SourceChanged));
        }
        let initial = OpenDocument {
            identity: DocumentRequest {
                handle: uuid(),
                document_id,
                session_id: uuid(),
            },
            kind,
            persistent_identity,
            ownership: if reasons.is_empty() {
                Ownership::Exclusive
            } else {
                Ownership::ViewOnly { reasons }
            },
            encoding,
            source,
            fingerprint: Some(fingerprint),
        };
        self.documents.insert(
            initial.identity.handle.clone(),
            Registered {
                initial: initial.clone(),
                anchor: Some(anchor),
                leases,
            },
        );
        Ok(initial)
    }

    /// Allocates identity/lease only. Recovery availability requires a checkpoint receipt.
    pub fn register_unsaved(&mut self) -> Result<OpenDocument, DocumentError> {
        self.check_capacity()?;
        let initial = OpenDocument {
            identity: DocumentRequest {
                handle: uuid(),
                document_id: uuid(),
                session_id: uuid(),
            },
            kind: DocumentKind::Unsaved,
            persistent_identity: false,
            ownership: Ownership::Exclusive,
            encoding: SourceEncoding::Utf8,
            source: Vec::new(),
            fingerprint: None,
        };
        let lease = self.lease(&format!("document:{}", initial.identity.document_id))?;
        self.documents.insert(
            initial.identity.handle.clone(),
            Registered {
                initial: initial.clone(),
                anchor: None,
                leases: vec![lease],
            },
        );
        Ok(initial)
    }

    fn check_capacity(&self) -> Result<(), DocumentError> {
        if self.documents.len() >= MAX_OPEN_DOCUMENTS {
            Err(error(ErrorCode::TooManyDocuments))
        } else {
            Ok(())
        }
    }

    fn registered(&self, request: &DocumentRequest) -> Result<&Registered, DocumentError> {
        // Bound caller-controlled identifiers before lookup; avoid cross-session messages.
        if [&request.handle, &request.document_id, &request.session_id]
            .iter()
            .any(|s| s.len() != 36)
        {
            return Err(error(ErrorCode::InvalidHandle));
        }
        let record = self
            .documents
            .get(&request.handle)
            .ok_or_else(|| error(ErrorCode::InvalidHandle))?;
        if record.initial.identity != *request {
            return Err(error(ErrorCode::IdentityMismatch));
        }
        Ok(record)
    }

    /// Immutable initial snapshot, never a second live authoring buffer or disk reload.
    pub fn read_initial(&self, request: &DocumentRequest) -> Result<OpenDocument, DocumentError> {
        Ok(self.registered(request)?.initial.clone())
    }

    /// M2-01 relinquish only. No close-after-edits promise until the M2-05 close protocol.
    pub fn release(&mut self, request: &DocumentRequest) -> Result<(), DocumentError> {
        self.registered(request)?;
        self.documents.remove(&request.handle);
        Ok(())
    }

    /// Native pre-operation validation; not a save acknowledgement or universal external lock.
    pub fn validate_owner(&self, request: &DocumentRequest) -> Result<(), DocumentError> {
        let record = self.registered(request)?;
        if record.initial.ownership != Ownership::Exclusive {
            return Err(error(ErrorCode::OwnershipRequired));
        }
        for lease in &record.leases {
            self.verify_lease(lease)?;
        }
        if let Some(anchor) = &record.anchor {
            let (_, current) = anchor.snapshot()?;
            if Some(&current) != record.initial.fingerprint.as_ref()
                || !view_reasons(&current, &stat(&anchor.parent)?).is_empty()
            {
                return Err(error(ErrorCode::SourceChanged));
            }
            let (kind, id, reason) = project_identity(anchor);
            if kind != record.initial.kind
                || reason.is_some()
                || (kind == DocumentKind::Managed && id.as_ref() != Some(&request.document_id))
            {
                return Err(error(ErrorCode::SourceChanged));
            }
        }
        Ok(())
    }

    fn validate_recovery_owner(&self, request: &DocumentRequest) -> Result<(), DocumentError> {
        let record = self.registered(request)?;
        if record.initial.ownership != Ownership::Exclusive {
            return Err(error(ErrorCode::OwnershipRequired));
        }
        self.verify_store()?;
        for lease in &record.leases {
            self.verify_lease(lease)?;
        }
        // External source divergence must not block independent raw recovery protection.
        Ok(())
    }

    fn recovery_directory(
        &self,
        request: Option<&DocumentRequest>,
        create: bool,
    ) -> Result<File, DocumentError> {
        self.verify_store()?;
        let managed = request
            .map(|r| self.registered(r))
            .transpose()?
            .filter(|r| r.initial.kind == DocumentKind::Managed);
        let parent = if let Some(record) = managed {
            let anchor = record
                .anchor
                .as_ref()
                .ok_or_else(|| error(ErrorCode::UnsafePath))?;
            anchor.verify_location()?;
            child_directory(&anchor.parent, OsStr::new(".screenwriter"))?
        } else {
            self.store.try_clone().map_err(io_error)?
        };
        let info = stat(&parent)?;
        if info.st_uid != geteuid().as_raw() || info.st_mode & 0o7022 != 0 {
            return Err(error(ErrorCode::IdentityStoreUnavailable));
        }
        if create {
            match fs::mkdirat(&parent, "recovery", Mode::from_raw_mode(0o700)) {
                Ok(()) => parent.sync_all().map_err(io_error)?,
                Err(Errno::EXIST) => (),
                Err(err) => return Err(syscall_error(err)),
            }
        }
        let dir = child_directory(&parent, OsStr::new("recovery"))?;
        let info = stat(&dir)?;
        if info.st_uid != geteuid().as_raw() || info.st_mode & 0o7777 != 0o700 {
            return Err(error(ErrorCode::IdentityStoreUnavailable));
        }
        Ok(dir)
    }

    /// Native-only serialized recovery write. No source file is changed or acknowledged.
    pub fn checkpoint(
        &mut self,
        request: &DocumentRequest,
        version: u64,
        source: &[u8],
        declared_sha256: &str,
        draft_metadata: serde_json::Value,
    ) -> Result<CheckpointReceipt, DocumentError> {
        self.validate_recovery_owner(request)?;
        if source.len() > MAX_SOURCE_BYTES || source_hash(source) != declared_sha256 {
            return Err(error(ErrorCode::InvalidCheckpoint));
        }
        let dir = self.recovery_directory(Some(request), true)?;
        let _lease = self.lease(&format!("recovery:{}", request.document_id))?;
        recovery_store::checkpoint(
            &dir,
            request,
            recovery_store::DraftSnapshot {
                version,
                source,
                draft_metadata,
                base_fingerprint: self.registered(request)?.initial.fingerprint.clone(),
            },
            || {
                self.validate_recovery_owner(request)?;
                let current = self.recovery_directory(Some(request), false)?;
                if !same_file(&stat(&dir)?, &stat(&current)?) {
                    return Err(error(ErrorCode::OwnershipLost));
                }
                Ok(())
            },
            |_| Ok(()),
        )
    }

    pub fn inspect_recovery(
        &self,
        request: &DocumentRequest,
    ) -> Result<RecoveryInspection, DocumentError> {
        self.registered(request)?;
        self.inspect_in(
            self.recovery_directory(Some(request), false),
            &request.document_id,
        )
    }

    /// Native restart lookup for loose/unsaved identities; no frontend path or disk write.
    pub fn inspect_local_recovery(
        &self,
        document_id: &str,
    ) -> Result<RecoveryInspection, DocumentError> {
        if !valid_uuid(document_id) {
            return Err(error(ErrorCode::InvalidHandle));
        }
        self.inspect_in(self.recovery_directory(None, false), document_id)
    }

    fn inspect_in(
        &self,
        dir: Result<File, DocumentError>,
        document_id: &str,
    ) -> Result<RecoveryInspection, DocumentError> {
        match dir {
            Ok(dir) => recovery_store::inspect(&dir, document_id),
            Err(err) if err.code == ErrorCode::MissingSource => Ok(RecoveryInspection::default()),
            Err(err) => Err(err),
        }
    }
}

fn valid_uuid(id: &str) -> bool {
    Uuid::parse_str(id).is_ok_and(|v| !v.is_nil() && v.to_string() == id)
}

fn view_reasons(info: &DiskFingerprint, parent: &Stat) -> Vec<ViewReason> {
    let mut reasons = Vec::new();
    if info.owner != geteuid().as_raw() {
        reasons.push(ViewReason::ForeignOwner);
    }
    if info.mode & 0o200 == 0 || parent.st_mode & 0o200 == 0 {
        reasons.push(ViewReason::ReadOnly);
    }
    if info.links != 1 {
        reasons.push(ViewReason::HardLinked);
    }
    if info.mode & 0o7022 != 0
        || parent.st_uid != geteuid().as_raw()
        || parent.st_mode & 0o7022 != 0
    {
        reasons.push(ViewReason::UnsafePermissions);
    }
    reasons
}

fn project_identity(anchor: &Anchor) -> (DocumentKind, Option<String>, Option<ViewReason>) {
    let aux = match child_directory(&anchor.parent, OsStr::new(".screenwriter")) {
        Ok(dir) => dir,
        Err(err) if err.code == ErrorCode::MissingSource => {
            return (DocumentKind::Loose, None, None);
        }
        Err(_) => {
            return (
                DocumentKind::Managed,
                None,
                Some(ViewReason::InvalidProjectMetadata),
            );
        }
    };
    let parsed = (|| {
        let directory_info = stat(&aux)?;
        if directory_info.st_uid != geteuid().as_raw() || directory_info.st_mode & 0o7022 != 0 {
            return Err(error(ErrorCode::Io));
        }
        let file = read_file(&aux, OsStr::new("project.json"))?;
        let info = stat(&file)?;
        if info.st_uid != geteuid().as_raw() || info.st_nlink != 1 || info.st_mode & 0o7022 != 0 {
            return Err(error(ErrorCode::Io));
        }
        let (bytes, _) = snapshot(file, MAX_METADATA_BYTES)?;
        let schema: ProjectSchema =
            serde_json::from_slice(&bytes).map_err(|_| error(ErrorCode::Io))?;
        if schema.schema_version != 1 {
            return Ok::<_, DocumentError>((None, Some(ViewReason::UnknownProjectSchema)));
        }
        let metadata: ProjectIdentity =
            serde_json::from_slice(&bytes).map_err(|_| error(ErrorCode::Io))?;
        let source = Path::new(&metadata.source_filename);
        if metadata.schema_version != 1
            || !valid_uuid(&metadata.project_id)
            || source.components().count() != 1
            || !matches!(source.components().next(), Some(Component::Normal(_)))
            || !metadata.pdf_profile.is_string()
        {
            return Err(error(ErrorCode::Io));
        }
        if source.as_os_str() != anchor.name {
            // A missing declared source may be a renamed managed screenplay. Preserve its
            // identity as a view-only candidate; no automatic mapping/metadata repair.
            return match read_file(&anchor.parent, source.as_os_str()) {
                Ok(_) => Ok((None, None)),
                Err(err) if err.code == ErrorCode::MissingSource => Ok((
                    Some(metadata.project_id),
                    Some(ViewReason::SourceMappingMismatch),
                )),
                Err(_) => Err(error(ErrorCode::Io)),
            };
        }
        Ok((Some(metadata.project_id), None))
    })();
    match parsed {
        Ok((Some(id), reason)) => (DocumentKind::Managed, Some(id), reason),
        Ok((None, None)) => (DocumentKind::Loose, None, None),
        Ok((_, reason)) => (DocumentKind::Managed, None, reason),
        Err(_) => (
            DocumentKind::Managed,
            None,
            Some(ViewReason::InvalidProjectMetadata),
        ),
    }
}
