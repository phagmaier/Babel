//! Linux-only source transactions. Native anchors, no frontend paths or runtime fault hooks.
use super::*;
use crate::documents::recovery::{Checkpoint, JournalRead, MAX_FRAME_BYTES, TailStatus};

#[derive(Debug, Clone)]
pub struct SaveInspection {
    pub intent: Option<JournalRead>,
    pub confirmed: Option<JournalRead>,
    pub previous: Option<Vec<u8>>,
    pub previous_pending: Option<Vec<u8>>,
    pub candidate: Option<Vec<u8>>,
    pub observation: SaveObservation,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Transaction {
    schema_version: u32,
    pub(super) candidate_name: String,
    pub(super) draft_metadata: serde_json::Value,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Stage {
    RecoveryProtected,
    BeforeIntentWrite,
    IntentPartialWrite,
    IntentBeforeSync,
    IntentSynced,
    BeforePreviousWrite,
    PreviousPartialWrite,
    PreviousBeforeSync,
    PreviousSynced,
    PreviousPublished,
    BeforeCandidateWrite,
    CandidatePartialWrite,
    CandidateBeforeSync,
    CandidateSynced,
    BeforeReplace,
    Replaced,
    BeforeDirectorySync,
    DirectorySynced,
    Verified,
    Confirmed,
}

pub(super) fn read_optional(
    dir: &File,
    name: &str,
    limit: usize,
) -> Result<Option<Vec<u8>>, DocumentError> {
    let file = match read_file(dir, OsStr::new(name)) {
        Ok(file) => file,
        Err(e) if e.code == ErrorCode::MissingSource => return Ok(None),
        Err(e) => return Err(e),
    };
    if !private_file(&stat(&file)?) {
        return Err(error(ErrorCode::SaveNeedsAttention));
    }
    let (bytes, captured) = snapshot(file, limit)?;
    if fingerprint(&stat(&read_file(dir, OsStr::new(name))?)?, &bytes) != captured {
        return Err(error(ErrorCode::SourceChanged));
    }
    Ok(Some(bytes))
}

pub(super) fn transaction(checkpoint: &Checkpoint) -> Result<Transaction, DocumentError> {
    let t: Transaction = serde_json::from_value(checkpoint.metadata.draft_metadata.clone())
        .map_err(|_| error(ErrorCode::SaveNeedsAttention))?;
    let prefix = ".babel-save-";
    if t.schema_version != 1
        || !t.candidate_name.starts_with(prefix)
        || !valid_uuid(&t.candidate_name[prefix.len()..])
        || checkpoint.metadata.base_fingerprint.is_none()
    {
        return Err(error(ErrorCode::SaveNeedsAttention));
    }
    Ok(t)
}

/// Fail-closed metadata length: serialization failure counts as full budget so
/// admission denies new work instead of panicking on an infallible type.
fn metadata_len(value: &serde_json::Value) -> usize {
    serde_json::to_vec(value)
        .map(|bytes| bytes.len())
        .unwrap_or(recovery::MAX_DRAFT_METADATA_BYTES)
}

pub(super) fn single<'a>(read: &'a JournalRead, id: &str) -> Result<&'a Checkpoint, DocumentError> {
    if read.tail != TailStatus::Clean || read.checkpoints.len() != 1 {
        return Err(error(ErrorCode::SaveNeedsAttention));
    }
    let checkpoint = &read.checkpoints[0];
    if checkpoint.metadata.document_id != id {
        return Err(error(ErrorCode::SaveNeedsAttention));
    }
    transaction(checkpoint)?;
    Ok(checkpoint)
}

impl DocumentService {
    /// Bounded FIFO admission, taking ownership of an immutable payload. No receipt is issued.
    /// The expected fingerprint must be the native baseline at admission; queued successors
    /// use the baseline advanced by their confirmed predecessor, never an external generation.
    pub fn enqueue_save(&mut self, request: SaveRequest) -> Result<(), DocumentError> {
        self.validate_recovery_owner(&request.identity)?;
        let record = self.registered(&request.identity)?;
        if record.anchor.is_none() {
            return Err(error(ErrorCode::MissingSource)); // Save As belongs to M2-05.
        }
        if request.version == 0
            || request.version > recovery::MAX_VERSION
            || request.source.len() > MAX_SOURCE_BYTES
            || std::str::from_utf8(&request.source).is_err()
            || source_hash(&request.source) != request.source_sha256
            || serde_json::to_vec(&request.draft_metadata)
                .map_err(|_| error(ErrorCode::InvalidSave))?
                .len()
                > recovery::MAX_DRAFT_METADATA_BYTES - 2048
        {
            return Err(error(ErrorCode::InvalidSave));
        }
        if record.baseline.as_ref() != Some(&request.expected_fingerprint) {
            return Err(error(ErrorCode::SourceChanged));
        }
        if record.save_uncertain {
            return Err(error(ErrorCode::SaveNeedsAttention));
        }
        if let Some(last) = record.queue.back()
            && request.version <= last.version
        {
            return Err(error(ErrorCode::StaleSaveVersion));
        }
        if let Some((version, sha256, metadata)) = &record.last_admitted {
            if request.version < *version {
                return Err(error(ErrorCode::StaleSaveVersion));
            }
            if request.version == *version
                && (request.source_sha256 != *sha256 || request.draft_metadata != *metadata)
            {
                return Err(error(ErrorCode::SaveConflict));
            }
        }
        let count: usize = self.documents.values().map(|r| r.queue.len()).sum();
        let bytes: usize = self
            .documents
            .values()
            .flat_map(|r| &r.queue)
            .map(|s| s.source.len() + metadata_len(&s.draft_metadata))
            .sum();
        if count >= MAX_QUEUED_SAVES
            || bytes + request.source.len() + metadata_len(&request.draft_metadata)
                > MAX_QUEUED_BYTES
        {
            return Err(error(ErrorCode::SaveQueueFull));
        }
        let record = self
            .documents
            .get_mut(&request.identity.handle)
            .ok_or_else(|| error(ErrorCode::InvalidHandle))?;
        record.last_admitted = Some((
            request.version,
            request.source_sha256.clone(),
            request.draft_metadata.clone(),
        ));
        record.queue.push_back(request);
        Ok(())
    }

    /// Atomic IPC admission+execution. Do not consume a different native controller's queue entry.
    pub fn save_request(&mut self, request: SaveRequest) -> Result<SaveReceipt, Box<SaveFailure>> {
        self.save_request_with(request, |_| Ok(()))
    }

    /// Private deterministic fault stages; production callers supply a no-op.
    pub(super) fn save_request_with(
        &mut self,
        request: SaveRequest,
        gate: impl FnMut(Stage) -> Result<(), DocumentError>,
    ) -> Result<SaveReceipt, Box<SaveFailure>> {
        let failure = |error| {
            Box::new(SaveFailure {
                identity: request.identity.clone(),
                version: request.version,
                error,
                replacement: ReplacementState::SourceUnchanged,
                recovery: None,
            })
        };
        if !self
            .registered(&request.identity)
            .map_err(failure)?
            .queue
            .is_empty()
        {
            return Err(failure(error(ErrorCode::SaveQueueFull)));
        }
        let identity = request.identity.clone();
        let empty_failure = failure(error(ErrorCode::SaveNeedsAttention));
        self.enqueue_save(request).map_err(|error| {
            let mut f = empty_failure.clone();
            f.error = error;
            f
        })?;
        self.save_next_with(&identity, gate)?.ok_or(empty_failure)
    }

    /// Executes one document's oldest admitted request. Must run on a native worker, not a key handler.
    /// `&mut self` serializes source/recovery/release operations; there is no reentrant writer.
    pub fn save_next(
        &mut self,
        identity: &DocumentRequest,
    ) -> Result<Option<SaveReceipt>, Box<SaveFailure>> {
        self.save_next_with(identity, |_| Ok(()))
    }

    /// Test-only fault injection. Unit test binaries only; no runtime hook.
    pub(super) fn save_next_with(
        &mut self,
        identity: &DocumentRequest,
        mut gate: impl FnMut(Stage) -> Result<(), DocumentError>,
    ) -> Result<Option<SaveReceipt>, Box<SaveFailure>> {
        let mut failure = SaveFailure {
            identity: identity.clone(),
            version: 0,
            error: error(ErrorCode::InvalidHandle),
            replacement: ReplacementState::SourceUnchanged,
            recovery: None,
        };
        self.registered(identity).map_err(|e| {
            failure.error = e;
            Box::new(failure.clone())
        })?;
        let Some(request) = self
            .documents
            .get_mut(&identity.handle)
            .ok_or_else(|| {
                failure.error = error(ErrorCode::InvalidHandle);
                Box::new(failure.clone())
            })?
            .queue
            .pop_front()
        else {
            return Ok(None);
        };
        failure.version = request.version;
        let mut replaced = false;
        let result = (|| {
            self.validate_recovery_owner(identity)?;
            let record = self.registered(identity)?;
            if record.save_uncertain {
                return Err(error(ErrorCode::SaveNeedsAttention));
            }
            let duplicate = record
                .last_save
                .as_ref()
                .is_some_and(|(r, _)| r.version == request.version);
            let base = if duplicate {
                let inspection = self.inspect_recovery(identity)?;
                let latest = inspection
                    .latest
                    .ok_or_else(|| error(ErrorCode::SaveNeedsAttention))?;
                if latest.metadata.version != request.version {
                    return Err(error(ErrorCode::StaleSaveVersion));
                }
                latest.metadata.base_fingerprint
            } else {
                record.baseline.clone()
            };
            let receipt = self.checkpoint_with_base(
                identity,
                request.version,
                &request.source,
                &request.source_sha256,
                request.draft_metadata.clone(),
                base,
            )?;
            failure.recovery = Some(receipt.clone());
            gate(Stage::RecoveryProtected)?;
            self.validate_owner(identity)?;
            let dir = self.source_directory(identity, true)?;
            let state = self.inspect_source_save(identity)?;
            if state.intent.is_some()
                || state.previous_pending.is_some()
                || state.observation == SaveObservation::NeedsAttention
            {
                return Err(error(ErrorCode::SaveNeedsAttention));
            }
            if duplicate {
                let record = self.registered(identity)?;
                let anchor = record.anchor.as_ref().ok_or_else(|| error(ErrorCode::Io))?;
                read_file(&anchor.parent, &anchor.name)?
                    .sync_all()
                    .map_err(io_error)?;
                anchor.parent.sync_all().map_err(io_error)?;
                self.validate_owner(identity)?;
                let mut last = record
                    .last_save
                    .as_ref()
                    .ok_or_else(|| error(ErrorCode::Io))?
                    .0
                    .clone();
                last.recovery = receipt;
                return Ok(last);
            }
            let record = self.registered(identity)?;
            let anchor = record.anchor.as_ref().ok_or_else(|| error(ErrorCode::Io))?;
            plain_metadata(&read_file(&anchor.parent, &anchor.name)?)?;
            let (old, baseline) = anchor.snapshot()?;
            if record.baseline.as_ref() != Some(&baseline)
                || !view_reasons(&baseline, &stat(&anchor.parent)?).is_empty()
            {
                return Err(error(ErrorCode::SourceChanged));
            }
            let candidate_name = format!(".babel-save-{}", uuid());
            let mut intent = Checkpoint::capture(
                identity,
                request.version,
                receipt.generation,
                &request.source,
                serde_json::to_value(Transaction {
                    schema_version: 1,
                    candidate_name: candidate_name.clone(),
                    draft_metadata: request.draft_metadata.clone(),
                })
                .map_err(|_| error(ErrorCode::InvalidSave))?,
            )?;
            intent.metadata.base_fingerprint = Some(baseline.clone());
            let encoded = intent.encode()?;
            write_new(
                &dir,
                "intent",
                &encoded,
                &mut gate,
                [
                    Stage::BeforeIntentWrite,
                    Stage::IntentPartialWrite,
                    Stage::IntentBeforeSync,
                    Stage::IntentSynced,
                ],
            )?;
            dir.sync_all().map_err(io_error)?;
            self.validate_save_location(identity, &dir)?;
            write_new(
                &dir,
                "previous-pending",
                &old,
                &mut gate,
                [
                    Stage::BeforePreviousWrite,
                    Stage::PreviousPartialWrite,
                    Stage::PreviousBeforeSync,
                    Stage::PreviousSynced,
                ],
            )?;
            let _ = read_optional(&dir, "previous", MAX_SOURCE_BYTES)?;
            fs::renameat(&dir, "previous-pending", &dir, "previous").map_err(syscall_error)?;
            dir.sync_all().map_err(io_error)?;
            if read_optional(&dir, "previous", MAX_SOURCE_BYTES)?.as_deref() != Some(&old) {
                return Err(error(ErrorCode::Io));
            }
            gate(Stage::PreviousPublished)?;
            self.validate_owner(identity)?;
            let candidate = write_new(
                &anchor.parent,
                &candidate_name,
                &request.source,
                &mut gate,
                [
                    Stage::BeforeCandidateWrite,
                    Stage::CandidatePartialWrite,
                    Stage::CandidateBeforeSync,
                    Stage::CandidateSynced,
                ],
            )?;
            // Apply ordinary owner/group mode on the prepared file; special bits were rejected at open.
            // Group ownership is preserved too, or save fails before replacement.
            plain_metadata(&candidate)?;
            let source_info = stat(&read_file(&anchor.parent, &anchor.name)?)?;
            fs::fchown(
                &candidate,
                None,
                Some(rustix::process::Gid::from_raw(source_info.st_gid)),
            )
            .map_err(syscall_error)?;
            fs::fchmod(&candidate, Mode::from_raw_mode(baseline.mode & 0o777))
                .map_err(syscall_error)?;
            candidate.sync_all().map_err(io_error)?;
            anchor.parent.sync_all().map_err(io_error)?;
            let candidate_info = stat(&candidate)?;
            let new_lease = self.lease(&format!(
                "source:{}:{}",
                candidate_info.st_dev, candidate_info.st_ino
            ))?;
            gate(Stage::BeforeReplace)?;
            self.validate_save_location(identity, &dir)?;
            self.validate_owner(identity)?;
            plain_metadata(&read_file(&anchor.parent, &anchor.name)?)?;
            plain_metadata(&candidate)?;
            let (candidate_bytes, candidate_fingerprint) = snapshot(
                read_file(&anchor.parent, OsStr::new(&candidate_name))?,
                MAX_SOURCE_BYTES,
            )?;
            if candidate_bytes != request.source
                || !same_file(
                    &candidate_info,
                    &stat(&read_file(&anchor.parent, OsStr::new(&candidate_name))?)?,
                )
            {
                return Err(error(ErrorCode::SourceChanged));
            }
            fs::renameat(
                &anchor.parent,
                candidate_name.as_str(),
                &anchor.parent,
                &anchor.name,
            )
            .map_err(syscall_error)?;
            replaced = true;
            // Retain the new inode's lease even when any subsequent confirmation fails.
            self.documents
                .get_mut(&identity.handle)
                .ok_or_else(|| error(ErrorCode::Io))?
                .leases
                .push(new_lease);
            gate(Stage::Replaced)?;
            gate(Stage::BeforeDirectorySync)?;
            let record = self.registered(identity)?;
            let anchor = record.anchor.as_ref().ok_or_else(|| error(ErrorCode::Io))?;
            anchor.parent.sync_all().map_err(io_error)?;
            gate(Stage::DirectorySynced)?;
            self.validate_save_location(identity, &dir)?;
            let (installed, fingerprint) = anchor.snapshot()?;
            // Rename updates ctime; identity, content and ordinary ownership/mode must still match.
            if installed != request.source
                || fingerprint.device != candidate_fingerprint.device
                || fingerprint.inode != candidate_fingerprint.inode
                || fingerprint.mode != candidate_fingerprint.mode
                || fingerprint.owner != candidate_fingerprint.owner
                || fingerprint.links != 1
                || stat(&read_file(&anchor.parent, &anchor.name)?)?.st_gid != source_info.st_gid
                || read_optional(&dir, "previous", MAX_SOURCE_BYTES)?.as_deref() != Some(&old)
                || read_optional(&dir, "intent", MAX_FRAME_BYTES)?.as_deref() != Some(&encoded)
            {
                return Err(error(ErrorCode::SourceChanged));
            }
            gate(Stage::Verified)?;
            let _ = read_optional(&dir, "confirmed", MAX_FRAME_BYTES)?;
            fs::renameat(&dir, "intent", &dir, "confirmed").map_err(syscall_error)?;
            dir.sync_all().map_err(io_error)?;
            gate(Stage::Confirmed)?;
            self.validate_save_location(identity, &dir)?;
            if anchor.snapshot()?.1 != fingerprint
                || read_optional(&dir, "confirmed", MAX_FRAME_BYTES)?.as_deref() != Some(&encoded)
            {
                return Err(error(ErrorCode::SourceChanged));
            }
            let saved = SaveReceipt {
                identity: identity.clone(),
                version: request.version,
                source_sha256: source_hash(&installed),
                fingerprint: fingerprint.clone(),
                recovery: receipt,
                protection: SaveProtection::SourceFile,
            };
            let record = self
                .documents
                .get_mut(&identity.handle)
                .ok_or_else(|| error(ErrorCode::Io))?;
            record.baseline = Some(fingerprint);
            // Keep the document lease and new source lease; explicitly unlock the superseded inode.
            record.leases.remove(0);
            record.leases.rotate_right(1); // restore [source, document] ordering
            record.last_save = Some((saved.clone(), request.draft_metadata.clone()));
            self.note_recent(identity, None);
            Ok(saved)
        })();
        result.map(Some).map_err(|e| {
            failure.error = e;
            if replaced {
                failure.replacement = ReplacementState::ReplacedButUnconfirmed;
                if let Some(record) = self.documents.get_mut(&identity.handle) {
                    record.save_uncertain = true;
                }
            }
            Box::new(failure)
        })
    }

    pub(super) fn source_directory(
        &self,
        identity: &DocumentRequest,
        create: bool,
    ) -> Result<File, DocumentError> {
        self.verify_store()?;
        let record = self.registered(identity)?;
        let root = if record.initial.kind == DocumentKind::Managed {
            let anchor = record
                .anchor
                .as_ref()
                .ok_or_else(|| error(ErrorCode::MissingSource))?;
            anchor.verify_location()?;
            child_directory(&anchor.parent, OsStr::new(".screenwriter"))?
        } else {
            self.store.try_clone().map_err(io_error)?
        };
        private_directory(&root, "source-save", create)
            .and_then(|dir| private_directory(&dir, &identity.document_id, create))
    }

    pub(super) fn validate_save_location(
        &self,
        identity: &DocumentRequest,
        dir: &File,
    ) -> Result<(), DocumentError> {
        self.validate_recovery_owner(identity)?;
        let current = self.source_directory(identity, false)?;
        if !same_file(&stat(dir)?, &stat(&current)?) {
            return Err(error(ErrorCode::OwnershipLost));
        }
        let record = self.registered(identity)?;
        let anchor = record.anchor.as_ref().ok_or_else(|| error(ErrorCode::Io))?;
        let (kind, id, reason) = project_identity(anchor);
        if kind != record.initial.kind
            || reason.is_some()
            || (kind == DocumentKind::Managed && id.as_ref() != Some(&identity.document_id))
        {
            return Err(error(ErrorCode::SourceChanged));
        }
        Ok(())
    }

    /// Read-only restart inspection. Never promotes a candidate, deletes artifacts or adopts recovery.
    pub fn inspect_source_save(
        &self,
        identity: &DocumentRequest,
    ) -> Result<SaveInspection, DocumentError> {
        let record = self.registered(identity)?;
        let mut result = SaveInspection {
            intent: None,
            confirmed: None,
            previous: None,
            previous_pending: None,
            candidate: None,
            observation: SaveObservation::NoTransaction,
        };
        let dir = match self.source_directory(identity, false) {
            Ok(dir) => dir,
            Err(e) if e.code == ErrorCode::MissingSource => return Ok(result),
            Err(e) => return Err(e),
        };
        result.intent =
            read_optional(&dir, "intent", MAX_FRAME_BYTES)?.map(|b| recovery::decode_journal(&b));
        result.confirmed = read_optional(&dir, "confirmed", MAX_FRAME_BYTES)?
            .map(|b| recovery::decode_journal(&b));
        result.previous = read_optional(&dir, "previous", MAX_SOURCE_BYTES)?;
        result.previous_pending = read_optional(&dir, "previous-pending", MAX_SOURCE_BYTES)?;
        if [&result.intent, &result.confirmed]
            .into_iter()
            .flatten()
            .any(|journal| single(journal, &identity.document_id).is_err())
        {
            result.observation = SaveObservation::NeedsAttention;
            return Ok(result);
        }
        if let Some(read) = result.intent.as_ref().or(result.confirmed.as_ref()) {
            let checkpoint = single(read, &identity.document_id)?;
            let anchor = record
                .anchor
                .as_ref()
                .ok_or_else(|| error(ErrorCode::MissingSource))?;
            let t = transaction(checkpoint)?;
            // Candidates stay private until mode is applied immediately before replacement.
            // Inspect either private or final ordinary mode, without following links.
            result.candidate = match read_file(&anchor.parent, OsStr::new(&t.candidate_name)) {
                Ok(file) => {
                    let info = stat(&file)?;
                    if info.st_uid != geteuid().as_raw()
                        || info.st_nlink != 1
                        || info.st_mode & 0o7022 != 0
                    {
                        return Err(error(ErrorCode::SaveNeedsAttention));
                    }
                    Some(snapshot(file, MAX_SOURCE_BYTES)?.0)
                }
                Err(e) if e.code == ErrorCode::MissingSource => None,
                Err(e) => return Err(e),
            };
            result.observation = match anchor.snapshot() {
                Ok((source, fp))
                    if source == checkpoint.source
                        && Some(&fp) != checkpoint.metadata.base_fingerprint.as_ref() =>
                {
                    if result.intent.is_some() {
                        SaveObservation::InstalledCandidateUnconfirmed
                    } else {
                        SaveObservation::ConfirmedRecordMatchesSource
                    }
                }
                Ok((_, fp))
                    if Some(&fp) == checkpoint.metadata.base_fingerprint.as_ref()
                        && result.intent.is_some() =>
                {
                    SaveObservation::Prepared
                }
                _ => SaveObservation::Diverged,
            };
            if result.confirmed.is_some()
                && result.intent.is_none()
                && result.previous.as_ref().map(|b| source_hash(b))
                    != checkpoint
                        .metadata
                        .base_fingerprint
                        .as_ref()
                        .map(|f| f.sha256.clone())
            {
                result.observation = SaveObservation::NeedsAttention;
            }
        } else if result.previous.is_some() || result.previous_pending.is_some() {
            result.observation = SaveObservation::NeedsAttention;
        }
        Ok(result)
    }
}

// Do not silently discard ACLs or extended attributes that this adapter cannot preserve.
pub(super) fn plain_metadata(file: &File) -> Result<(), DocumentError> {
    if fs::flistxattr(file, &mut [] as &mut [u8]).map_err(syscall_error)? != 0 {
        return Err(error(ErrorCode::SaveNeedsAttention));
    }
    Ok(())
}

fn private_directory(parent: &File, name: &str, create: bool) -> Result<File, DocumentError> {
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

fn write_new(
    dir: &File,
    name: &str,
    bytes: &[u8],
    gate: &mut impl FnMut(Stage) -> Result<(), DocumentError>,
    stages: [Stage; 4],
) -> Result<File, DocumentError> {
    gate(stages[0])?;
    let mut file = File::from(
        fs::openat(
            dir,
            name,
            OFlags::RDWR | OFlags::CREATE | OFlags::EXCL | OFlags::NOFOLLOW | OFlags::CLOEXEC,
            Mode::from_raw_mode(0o600),
        )
        .map_err(syscall_error)?,
    );
    let mid = bytes.len() / 2;
    file.write_all(&bytes[..mid]).map_err(io_error)?;
    gate(stages[1])?;
    file.write_all(&bytes[mid..]).map_err(io_error)?;
    gate(stages[2])?;
    file.sync_all().map_err(io_error)?;
    if read_optional(dir, name, MAX_FRAME_BYTES)?.as_deref() != Some(bytes) {
        return Err(error(ErrorCode::Io));
    }
    gate(stages[3])?;
    Ok(file)
}

#[cfg(test)]
#[path = "source_store_tests.rs"]
mod tests;
