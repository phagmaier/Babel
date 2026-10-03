//! Independent portable blobs + checksummed immutable records. No journal/history pruning.
use super::*;
use crate::documents::{persistence::payload_cost, snapshots::*};
use std::collections::{BTreeMap, BTreeSet};
use std::time::{SystemTime, UNIX_EPOCH};

pub(super) struct Destination {
    pub identity: DocumentRequest,
    dir: File,
    path: PathBuf,
    relation: StorageRelation,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Stage {
    MetadataPartial,
    MetadataSynced,
    SourcePartial,
    SourceSynced,
    BlobPublished,
    RecordPublished,
    DirectorySynced,
    BeforePrune,
    RecordRemoved,
    PruneSynced,
    BlobRemoved,
    CopyPartial,
    CopySynced,
    CopyPublished,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Envelope {
    record: SnapshotRecord,
    record_sha256: String,
}

fn now() -> Result<u64, DocumentError> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|t| t.as_secs())
        .map_err(|_| error(ErrorCode::Io))
}
fn sha(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
fn record_hash(record: &SnapshotRecord) -> Result<String, DocumentError> {
    serde_json::to_vec(record)
        .map(|b| hash(&b))
        .map_err(|_| error(ErrorCode::InvalidSnapshot))
}
fn entry(record: SnapshotRecord) -> Result<SnapshotEntry, DocumentError> {
    Ok(SnapshotEntry {
        selection: SnapshotSelection {
            snapshot_id: record.snapshot_id.clone(),
            record_sha256: record_hash(&record)?,
        },
        record,
    })
}
fn within_budget(catalog: &SnapshotCatalog, additional: u64) -> bool {
    catalog.entries.len() < MAX_SNAPSHOT_RECORDS
        && catalog.source_bytes <= MAX_SNAPSHOT_BYTES
        && additional <= MAX_SNAPSHOT_BYTES.saturating_sub(catalog.source_bytes)
}
fn valid_name(kind: SnapshotKind, name: &Option<String>) -> bool {
    match (kind, name) {
        (SnapshotKind::Named, Some(name)) => {
            !name.trim().is_empty()
                && name.chars().count() <= 80
                && !name.chars().any(char::is_control)
        }
        (SnapshotKind::Named, None) => false,
        (_, None) => true,
        _ => false,
    }
}
fn private_dir(parent: &File, name: &str, create: bool) -> Result<File, DocumentError> {
    let info = stat(parent)?;
    if info.st_uid != geteuid().as_raw() || info.st_mode & 0o7022 != 0 {
        return Err(error(ErrorCode::OwnershipLost));
    }
    if create {
        match fs::mkdirat(parent, name, Mode::from_raw_mode(0o700)) {
            Ok(()) => parent.sync_all().map_err(io_error)?,
            Err(Errno::EXIST) => (),
            Err(e) => return Err(syscall_error(e)),
        }
    }
    let dir = child_directory(parent, OsStr::new(name))?;
    let info = stat(&dir)?;
    if info.st_uid != geteuid().as_raw() || info.st_mode & 0o7777 != 0o700 {
        return Err(error(ErrorCode::OwnershipLost));
    }
    Ok(dir)
}
fn read(dir: &File, name: &str, limit: usize) -> Result<Option<Vec<u8>>, DocumentError> {
    source_store::read_optional(dir, name, limit)
}
fn blob_name(hash: &str) -> String {
    format!("{hash}.fountain")
}
fn record_name(id: &str) -> String {
    format!("{id}.json")
}
fn publish(dir: &File, from: &str, to: &str) -> Result<(), DocumentError> {
    fs::renameat_with(dir, from, dir, to, fs::RenameFlags::NOREPLACE).map_err(syscall_error)
}
fn write_new(
    dir: &File,
    name: &str,
    bytes: &[u8],
    gate: &mut impl FnMut(Stage) -> Result<(), DocumentError>,
    partial: Stage,
    synced: Stage,
) -> Result<(), DocumentError> {
    let mut file = File::from(
        fs::openat(
            dir,
            name,
            OFlags::WRONLY | OFlags::CREATE | OFlags::EXCL | OFlags::NOFOLLOW | OFlags::CLOEXEC,
            Mode::from_raw_mode(0o600),
        )
        .map_err(syscall_error)?,
    );
    let mid = bytes.len() / 2;
    file.write_all(&bytes[..mid]).map_err(io_error)?;
    gate(partial)?;
    file.write_all(&bytes[mid..]).map_err(io_error)?;
    file.sync_all().map_err(io_error)?;
    if read(dir, name, bytes.len())?.as_deref() != Some(bytes) {
        return Err(error(ErrorCode::Io));
    }
    gate(synced)
}
fn scan(dir: &File, id: &str) -> Result<SnapshotCatalog, DocumentError> {
    let mut catalog = SnapshotCatalog::default();
    let mut blobs = BTreeMap::new();
    let mut records = Vec::new();
    let mut count = 0;
    for item in fs::Dir::read_from(dir).map_err(syscall_error)? {
        let item = item.map_err(syscall_error)?;
        let bytes = item.file_name().to_bytes();
        if bytes == b"." || bytes == b".." {
            continue;
        }
        count += 1;
        if count > 1024 {
            catalog.needs_attention = true;
            catalog.unresolved_artifacts += 1;
            break;
        }
        let Some(name) = std::str::from_utf8(bytes).ok() else {
            catalog.needs_attention = true;
            catalog.unresolved_artifacts += 1;
            continue;
        };
        if let Some(hash) = name.strip_suffix(".fountain").filter(|s| sha(s)) {
            match read(dir, name, MAX_SOURCE_BYTES) {
                Ok(Some(b)) if crate::documents::recovery::source_hash(&b) == hash => {
                    blobs.insert(hash.to_owned(), b.len() as u64);
                }
                _ => {
                    catalog.needs_attention = true;
                    catalog.unresolved_artifacts += 1;
                }
            }
        } else if let Some(snapshot_id) = name.strip_suffix(".json").filter(|s| valid_uuid(s)) {
            let parsed = read(dir, name, 4096)
                .ok()
                .flatten()
                .and_then(|b| serde_json::from_slice::<Envelope>(&b).ok());
            match parsed {
                Some(e)
                    if e.record.schema_version == 1
                        && e.record.document_id == id
                        && e.record.snapshot_id == snapshot_id
                        && valid_uuid(&e.record.session_id)
                        && e.record
                            .version
                            .is_none_or(|v| v > 0 && v <= recovery::MAX_VERSION)
                        && sha(&e.record.source_sha256)
                        && e.record.byte_length <= MAX_SOURCE_BYTES as u64
                        && valid_name(e.record.kind, &e.record.name)
                        && record_hash(&e.record).ok().as_ref() == Some(&e.record_sha256) =>
                {
                    records.push(e.record)
                }
                _ => {
                    catalog.needs_attention = true;
                    catalog.unresolved_artifacts += 1;
                }
            }
        } else {
            catalog.needs_attention = true;
            catalog.unresolved_artifacts += 1;
        }
    }
    let mut used = BTreeSet::new();
    for record in records {
        if blobs.get(&record.source_sha256) == Some(&record.byte_length) {
            used.insert(record.source_sha256.clone());
            catalog.entries.push(entry(record)?);
        } else {
            catalog.needs_attention = true;
            catalog.unresolved_artifacts += 1;
        }
    }
    catalog.orphan_blobs = blobs.keys().filter(|h| !used.contains(*h)).count();
    if catalog.orphan_blobs > 0 {
        catalog.needs_attention = true;
    }
    catalog.source_bytes = blobs.values().sum();
    catalog.entries.sort_by(|a, b| {
        (a.record.created_seconds, &a.record.snapshot_id)
            .cmp(&(b.record.created_seconds, &b.record.snapshot_id))
    });
    catalog.at_limit =
        catalog.entries.len() >= MAX_SNAPSHOT_RECORDS || catalog.source_bytes >= MAX_SNAPSHOT_BYTES;
    Ok(catalog)
}

/// Always preserve newest, all protected versions, future-clock entries, newest
/// per five-minute bucket for one hour, per hour for 48 hours, per day for 30 days.
fn retained(catalog: &SnapshotCatalog, clock: u64) -> BTreeSet<String> {
    let mut keep = BTreeSet::new();
    let mut buckets = BTreeSet::new();
    if let Some(last) = catalog.entries.last() {
        keep.insert(last.record.snapshot_id.clone());
    }
    for e in catalog.entries.iter().rev() {
        let r = &e.record;
        let age = clock.saturating_sub(r.created_seconds);
        let bucket = if age <= 3600 {
            Some((0, r.created_seconds / 300))
        } else if age <= 48 * 3600 {
            Some((1, r.created_seconds / 3600))
        } else if age <= 30 * 86400 {
            Some((2, r.created_seconds / 86400))
        } else {
            None
        };
        if r.kind != SnapshotKind::Rolling
            || r.created_seconds > clock
            || bucket.is_some_and(|b| buckets.insert(b))
        {
            keep.insert(r.snapshot_id.clone());
        }
    }
    keep
}

impl DocumentService {
    fn snapshot_directory(
        &self,
        identity: &DocumentRequest,
        create: bool,
    ) -> Result<File, DocumentError> {
        self.verify_store()?;
        let record = self.registered(identity)?;
        let parent = if record.initial.kind == DocumentKind::Managed {
            let anchor = record
                .anchor
                .as_ref()
                .ok_or_else(|| error(ErrorCode::MissingSource))?;
            anchor.verify_location()?;
            child_directory(&anchor.parent, OsStr::new(".screenwriter"))?
        } else {
            self.store.try_clone().map_err(io_error)?
        };
        private_dir(&parent, "snapshots", create)
            .and_then(|dir| private_dir(&dir, &identity.document_id, create))
    }
    fn verify_snapshots(
        &self,
        identity: &DocumentRequest,
        dir: &File,
    ) -> Result<(), DocumentError> {
        self.validate_recovery_owner(identity)?;
        let current = self.snapshot_directory(identity, false)?;
        if !same_file(&stat(dir)?, &stat(&current)?) {
            return Err(error(ErrorCode::OwnershipLost));
        }
        Ok(())
    }
    pub fn list_snapshots(
        &self,
        identity: &DocumentRequest,
    ) -> Result<SnapshotCatalog, DocumentError> {
        self.registered(identity)?;
        match self.snapshot_directory(identity, false) {
            Ok(dir) => {
                let value = scan(&dir, &identity.document_id)?;
                let current = self.snapshot_directory(identity, false)?;
                if !same_file(&stat(&dir)?, &stat(&current)?) {
                    return Err(error(ErrorCode::OwnershipLost));
                }
                Ok(value)
            }
            Err(e) if e.code == ErrorCode::MissingSource => Ok(SnapshotCatalog::default()),
            Err(e) => Err(e),
        }
    }
    pub fn read_snapshot(
        &self,
        request: &SnapshotReadRequest,
    ) -> Result<SnapshotPreview, DocumentError> {
        self.registered(&request.identity)?;
        if !valid_uuid(&request.selection.snapshot_id) || !sha(&request.selection.record_sha256) {
            return Err(error(ErrorCode::InvalidSnapshot));
        }
        let catalog = self.list_snapshots(&request.identity)?;
        let entry = catalog
            .entries
            .into_iter()
            .find(|e| e.selection == request.selection)
            .ok_or_else(|| error(ErrorCode::InvalidSnapshot))?;
        let dir = self.snapshot_directory(&request.identity, false)?;
        let source = read(
            &dir,
            &blob_name(&entry.record.source_sha256),
            MAX_SOURCE_BYTES,
        )?
        .ok_or_else(|| error(ErrorCode::InvalidSnapshot))?;
        if hash(&source) != entry.record.source_sha256
            || source.len() as u64 != entry.record.byte_length
        {
            return Err(error(ErrorCode::InvalidSnapshot));
        }
        // Re-read the exact record after blob capture; metadata-only changes invalidate selection.
        if !scan(&dir, &request.identity.document_id)?
            .entries
            .contains(&entry)
        {
            return Err(error(ErrorCode::InvalidSnapshot));
        }
        let current = self.snapshot_directory(&request.identity, false)?;
        if !same_file(&stat(&dir)?, &stat(&current)?) {
            return Err(error(ErrorCode::OwnershipLost));
        }
        Ok(SnapshotPreview { entry, source })
    }
    pub fn create_snapshot(
        &mut self,
        request: &SnapshotRequest,
    ) -> Result<Option<SnapshotEntry>, DocumentError> {
        let c = &request.checkpoint;
        payload_cost(c.version, &c.source, &c.source_sha256, &c.draft_metadata)?;
        if hash(&c.source) != c.source_sha256 {
            return Err(error(ErrorCode::InvalidCheckpoint));
        }
        self.snapshot_with(
            &c.identity,
            Some(c.version),
            &c.source,
            request.kind,
            request.name.clone(),
            now()?,
            |_| Ok(()),
        )
    }
    #[allow(clippy::too_many_arguments)]
    fn snapshot_with(
        &self,
        identity: &DocumentRequest,
        version: Option<u64>,
        source: &[u8],
        kind: SnapshotKind,
        name: Option<String>,
        clock: u64,
        mut gate: impl FnMut(Stage) -> Result<(), DocumentError>,
    ) -> Result<Option<SnapshotEntry>, DocumentError> {
        self.validate_recovery_owner(identity)?;
        if source.len() > MAX_SOURCE_BYTES
            || version.is_some_and(|v| v == 0 || v > recovery::MAX_VERSION)
            || !valid_name(kind, &name)
        {
            return Err(error(ErrorCode::InvalidSnapshot));
        }
        let dir = self.snapshot_directory(identity, true)?;
        let _lease = self.lease(&format!("snapshots:{}", identity.document_id))?;
        let catalog = scan(&dir, &identity.document_id)?;
        if catalog.needs_attention {
            return Err(error(ErrorCode::SnapshotNeedsAttention));
        }
        let source_sha256 = hash(source);
        if kind == SnapshotKind::Rolling
            && let Some(last) = catalog
                .entries
                .iter()
                .rev()
                .find(|e| e.record.kind == SnapshotKind::Rolling)
            && (last.record.source_sha256 == source_sha256
                || clock.saturating_sub(last.record.created_seconds) < ROLLING_INTERVAL_SECONDS)
        {
            return Ok(None);
        }
        let blob_exists = catalog
            .entries
            .iter()
            .any(|e| e.record.source_sha256 == source_sha256);
        if !within_budget(&catalog, if blob_exists { 0 } else { source.len() as u64 }) {
            return Err(error(ErrorCode::SnapshotLimit));
        }
        let record = SnapshotRecord {
            schema_version: 1,
            snapshot_id: uuid(),
            document_id: identity.document_id.clone(),
            session_id: identity.session_id.clone(),
            version,
            source_sha256: source_sha256.clone(),
            byte_length: source.len() as u64,
            created_seconds: clock,
            kind,
            name,
        };
        let result = entry(record)?;
        let bytes = serde_json::to_vec(&Envelope {
            record: result.record.clone(),
            record_sha256: result.selection.record_sha256.clone(),
        })
        .map_err(|_| error(ErrorCode::InvalidSnapshot))?;
        self.verify_snapshots(identity, &dir)?;
        write_new(
            &dir,
            "pending.json",
            &bytes,
            &mut gate,
            Stage::MetadataPartial,
            Stage::MetadataSynced,
        )?;
        dir.sync_all().map_err(io_error)?;
        if !blob_exists {
            write_new(
                &dir,
                "pending.fountain",
                source,
                &mut gate,
                Stage::SourcePartial,
                Stage::SourceSynced,
            )?;
            self.verify_snapshots(identity, &dir)?;
            publish(&dir, "pending.fountain", &blob_name(&source_sha256))?;
            gate(Stage::BlobPublished)?;
        } else {
            let file = read_file(&dir, OsStr::new(&blob_name(&source_sha256)))?;
            file.sync_all().map_err(io_error)?;
        }
        dir.sync_all().map_err(io_error)?;
        if read(&dir, &blob_name(&source_sha256), MAX_SOURCE_BYTES)?.as_deref() != Some(source) {
            return Err(error(ErrorCode::Io));
        }
        self.verify_snapshots(identity, &dir)?;
        publish(
            &dir,
            "pending.json",
            &record_name(&result.record.snapshot_id),
        )?;
        gate(Stage::RecordPublished)?;
        dir.sync_all().map_err(io_error)?;
        gate(Stage::DirectorySynced)?;
        self.verify_snapshots(identity, &dir)?;
        if !scan(&dir, &identity.document_id)?.entries.contains(&result) {
            return Err(error(ErrorCode::Io));
        }
        Ok(Some(result))
    }
    fn maintenance_guard(&self, identity: &DocumentRequest) -> Result<(), DocumentError> {
        self.validate_recovery_owner(identity)?;
        let record = self.registered(identity)?;
        if record.save_uncertain || !record.queue.is_empty() {
            return Err(error(ErrorCode::SaveNeedsAttention));
        }
        let r = self.inspect_recovery(identity)?;
        if r.pending.is_some()
            || r.previous_pending.is_some()
            || r.quarantined
            || [&r.current, &r.previous]
                .into_iter()
                .flatten()
                .any(|j| j.tail != recovery::TailStatus::Clean)
            || r.latest.as_ref().is_some_and(|c| {
                c.metadata.session_id != identity.session_id && !record.recovery_reconciled
            })
        {
            return Err(error(ErrorCode::RecoveryNeedsAttention));
        }
        if record.anchor.is_some() {
            self.validate_owner(identity)?;
            let s = self.inspect_source_save(identity)?;
            if s.intent.is_some()
                || s.previous_pending.is_some()
                || !matches!(
                    s.observation,
                    SaveObservation::NoTransaction | SaveObservation::ConfirmedRecordMatchesSource
                )
            {
                return Err(error(ErrorCode::SaveNeedsAttention));
            }
        }
        Ok(())
    }
    /// Explicit maintenance; never invoked to make room after ENOSPC/cap failures.
    pub fn prune_snapshots(
        &mut self,
        identity: &DocumentRequest,
    ) -> Result<SnapshotCatalog, DocumentError> {
        self.prune_with(identity, now()?, |_| Ok(()))
    }
    fn prune_with(
        &self,
        identity: &DocumentRequest,
        clock: u64,
        mut gate: impl FnMut(Stage) -> Result<(), DocumentError>,
    ) -> Result<SnapshotCatalog, DocumentError> {
        self.maintenance_guard(identity)?;
        let catalog = self.list_snapshots(identity)?;
        if catalog.needs_attention {
            return Err(error(ErrorCode::SnapshotNeedsAttention));
        }
        if catalog.entries.is_empty() {
            return Ok(catalog);
        }
        let dir = self.snapshot_directory(identity, false)?;
        let _lease = self.lease(&format!("snapshots:{}", identity.document_id))?;
        let mut catalog = scan(&dir, &identity.document_id)?;
        if catalog.needs_attention {
            return Err(error(ErrorCode::SnapshotNeedsAttention));
        }
        let keep = retained(&catalog, clock);
        while let Some(item) = catalog
            .entries
            .iter()
            .find(|e| !keep.contains(&e.record.snapshot_id))
            .cloned()
        {
            let space = fs::fstatvfs(&dir).map_err(syscall_error)?;
            if space.f_bavail.saturating_mul(space.f_frsize) < 64 * 1024 * 1024 {
                return Err(error(ErrorCode::SnapshotNeedsAttention));
            }
            self.maintenance_guard(identity)?;
            self.verify_snapshots(identity, &dir)?;
            gate(Stage::BeforePrune)?;
            let fresh = scan(&dir, &identity.document_id)?;
            if fresh != catalog {
                return Err(error(ErrorCode::SnapshotNeedsAttention));
            }
            // The newest and every protected record have verified blobs before deletion.
            fs::unlinkat(
                &dir,
                record_name(&item.record.snapshot_id).as_str(),
                fs::AtFlags::empty(),
            )
            .map_err(syscall_error)?;
            gate(Stage::RecordRemoved)?;
            dir.sync_all().map_err(io_error)?;
            gate(Stage::PruneSynced)?;
            // One record per pass permits a fresh catalog after each durable deletion.
            let remaining = scan(&dir, &identity.document_id)?;
            let expected: Vec<_> = catalog
                .entries
                .iter()
                .filter(|e| e.selection != item.selection)
                .cloned()
                .collect();
            if remaining.entries != expected
                || remaining.unresolved_artifacts != 0
                || remaining.source_bytes != catalog.source_bytes
            {
                return Err(error(ErrorCode::SnapshotNeedsAttention));
            }
            if !remaining
                .entries
                .iter()
                .any(|e| e.record.source_sha256 == item.record.source_sha256)
            {
                self.maintenance_guard(identity)?;
                self.verify_snapshots(identity, &dir)?;
                if read(
                    &dir,
                    &blob_name(&item.record.source_sha256),
                    MAX_SOURCE_BYTES,
                )?
                .is_none_or(|b| hash(&b) != item.record.source_sha256)
                {
                    return Err(error(ErrorCode::SnapshotNeedsAttention));
                }
                fs::unlinkat(
                    &dir,
                    blob_name(&item.record.source_sha256).as_str(),
                    fs::AtFlags::empty(),
                )
                .map_err(syscall_error)?;
                gate(Stage::BlobRemoved)?;
                dir.sync_all().map_err(io_error)?;
            }
            self.verify_snapshots(identity, &dir)?;
            catalog = scan(&dir, &identity.document_id)?;
            if catalog.needs_attention {
                return Err(error(ErrorCode::SnapshotNeedsAttention));
            }
        }
        Ok(catalog)
    }
    pub(super) fn protect_disk_before_replacement(
        &self,
        identity: &DocumentRequest,
    ) -> Result<(), DocumentError> {
        self.validate_owner(identity)?;
        let anchor = self
            .registered(identity)?
            .anchor
            .as_ref()
            .ok_or_else(|| error(ErrorCode::MissingSource))?;
        let (source, _) = anchor.snapshot()?;
        self.snapshot_with(
            identity,
            None,
            &source,
            SnapshotKind::PreDestructive,
            None,
            now()?,
            |_| Ok(()),
        )?;
        self.validate_owner(identity)
    }
    pub fn restore_snapshot(
        &mut self,
        request: &RestoreSnapshotRequest,
    ) -> Result<SaveReceipt, Box<SaveFailure>> {
        self.restore_snapshot_with(request, |_| Ok(()))
    }

    fn restore_snapshot_with(
        &mut self,
        request: &RestoreSnapshotRequest,
        gate: impl FnMut(source_store::Stage) -> Result<(), DocumentError>,
    ) -> Result<SaveReceipt, Box<SaveFailure>> {
        let identity = &request.current.identity;
        let failure = |error| {
            Box::new(SaveFailure {
                identity: identity.clone(),
                version: request.new_version,
                error,
                replacement: ReplacementState::SourceUnchanged,
                recovery: None,
            })
        };
        let preview = self
            .read_snapshot(&SnapshotReadRequest {
                identity: identity.clone(),
                selection: request.selection.clone(),
            })
            .map_err(failure)?;
        if request.new_version <= request.current.version
            || request.new_version > recovery::MAX_VERSION
            || std::str::from_utf8(&preview.source).is_err()
        {
            return Err(failure(error(ErrorCode::InvalidSave)));
        }
        payload_cost(
            request.new_version,
            &preview.source,
            &hash(&preview.source),
            request
                .replacement_metadata
                .as_ref()
                .unwrap_or(&serde_json::Value::Null),
        )
        .map_err(failure)?;
        self.maintenance_guard(identity).map_err(failure)?;
        if self
            .registered(identity)
            .map_err(failure)?
            .baseline
            .as_ref()
            != Some(&request.expected_fingerprint)
            || request.current.expected_fingerprint.as_ref() != Some(&request.expected_fingerprint)
        {
            return Err(failure(error(ErrorCode::SourceChanged)));
        }
        let recovery = self
            .checkpoint_request(request.current.clone())
            .map_err(failure)?;
        let failure = |error| {
            let mut f = failure(error);
            f.recovery = Some(recovery.clone());
            f
        };
        self.create_snapshot(&SnapshotRequest {
            checkpoint: request.current.clone(),
            kind: SnapshotKind::PreDestructive,
            name: None,
        })
        .map_err(failure)?;
        self.protect_disk_before_replacement(identity)
            .map_err(failure)?;
        let profile = self.native_history_profile(identity).map_err(failure)?;
        self.record_revision(
            identity,
            Some(request.current.version),
            &request.current.source,
            &profile,
            "Before snapshot restore",
            true,
        )
        .map_err(failure)?;
        self.save_request_with(
            SaveRequest {
                identity: identity.clone(),
                version: request.new_version,
                source_sha256: hash(&preview.source),
                source: preview.source,
                expected_fingerprint: request.expected_fingerprint.clone(),
                draft_metadata: request
                    .replacement_metadata
                    .clone()
                    .unwrap_or(serde_json::Value::Null),
            },
            gate,
        )
    }
    /// Called only after explicit native folder selection. No IPC accepts a path.
    pub fn select_copy_destination(
        &mut self,
        identity: &DocumentRequest,
        path: &Path,
    ) -> Result<CopyDestination, DocumentError> {
        self.registered(identity)?;
        if self.copy_destinations.len() >= MAX_OPEN_DOCUMENTS
            && !self
                .copy_destinations
                .values()
                .any(|d| &d.identity == identity)
        {
            return Err(error(ErrorCode::InvalidDestination));
        }
        let dir = directory(path)?;
        let info = stat(&dir)?;
        if info.st_uid != geteuid().as_raw()
            || info.st_mode & 0o7022 != 0
            || info.st_mode & 0o300 != 0o300
        {
            return Err(error(ErrorCode::InvalidDestination));
        }
        source_store::plain_metadata(&dir)?;
        let source_device = self
            .registered(identity)?
            .baseline
            .as_ref()
            .map(|f| f.device.clone())
            .unwrap_or(stat(&self.store)?.st_dev.to_string());
        let relation = if info.st_dev.to_string() == source_device {
            StorageRelation::SameFilesystem
        } else {
            StorageRelation::UnknownPhysicalDisk
        };
        let result = CopyDestination {
            token: uuid(),
            storage_relation: relation,
        };
        // Selection replaces this registration's prior capability. The service
        // mutex serializes selection with native copies already in progress.
        self.copy_destinations
            .retain(|_, d| &d.identity != identity);
        self.copy_destinations.insert(
            result.token.clone(),
            Destination {
                identity: identity.clone(),
                dir,
                path: path.to_path_buf(),
                relation,
            },
        );
        Ok(result)
    }
    pub fn save_external_copy(
        &self,
        request: &ExternalCopyRequest,
    ) -> Result<ExternalCopyReceipt, DocumentError> {
        self.copy_with(request, |_| Ok(()))
    }
    fn copy_with(
        &self,
        request: &ExternalCopyRequest,
        mut gate: impl FnMut(Stage) -> Result<(), DocumentError>,
    ) -> Result<ExternalCopyReceipt, DocumentError> {
        let c = &request.checkpoint;
        self.registered(&c.identity)?;
        payload_cost(c.version, &c.source, &c.source_sha256, &c.draft_metadata)?;
        if hash(&c.source) != c.source_sha256 {
            return Err(error(ErrorCode::InvalidCheckpoint));
        }
        if request.format == CopyFormat::DraftBundle {
            let value: serde_json::Value = serde_json::from_slice(&c.source)
                .map_err(|_| error(ErrorCode::InvalidCheckpoint))?;
            if value["schema"] != "babel-draft-copy-v1"
                || value["version"].as_u64() != Some(c.version)
            {
                return Err(error(ErrorCode::InvalidCheckpoint));
            }
        }
        let d = self
            .copy_destinations
            .get(&request.destination_token)
            .filter(|d| d.identity == c.identity)
            .ok_or_else(|| error(ErrorCode::InvalidDestination))?;
        let verify = || {
            self.registered(&c.identity)?;
            let current = directory(&d.path)?;
            let info = stat(&current)?;
            if !same_file(&info, &stat(&d.dir)?)
                || info.st_uid != geteuid().as_raw()
                || info.st_mode & 0o7022 != 0
                || info.st_mode & 0o300 != 0o300
            {
                return Err(error(ErrorCode::InvalidDestination));
            }
            source_store::plain_metadata(&current)
        };
        verify()?;
        let id = uuid();
        let pending = format!(".babel-copy-{id}.pending");
        let final_name = match request.format {
            CopyFormat::Fountain => format!("babel-copy-{id}.fountain"),
            CopyFormat::DraftBundle => format!("babel-copy-{id}.draft.json"),
        };
        write_new(
            &d.dir,
            &pending,
            &c.source,
            &mut gate,
            Stage::CopyPartial,
            Stage::CopySynced,
        )?;
        verify()?;
        publish(&d.dir, &pending, &final_name)?;
        gate(Stage::CopyPublished)?;
        d.dir.sync_all().map_err(io_error)?;
        verify()?;
        if read(&d.dir, &final_name, MAX_SOURCE_BYTES)?.as_deref() != Some(c.source.as_slice()) {
            return Err(error(ErrorCode::Io));
        }
        Ok(ExternalCopyReceipt {
            identity: c.identity.clone(),
            version: c.version,
            source_sha256: hash(&c.source),
            byte_length: c.source.len() as u64,
            file_name: final_name,
            storage_relation: d.relation,
        })
    }
}

#[cfg(test)]
#[path = "snapshot_store_tests.rs"]
mod tests;
