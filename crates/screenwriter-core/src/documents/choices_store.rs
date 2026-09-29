//! Explicit recovery choices for natively opened sources. Every request is
//! path-free: the source is the registration's native anchor, never a frontend
//! string. No choice deletes recovery or source material, and timestamps never
//! select a winner. Retention, pruning and Save As belong to M2-05C.
use super::*;
use crate::documents::choices::{
    ChoiceSourceSnapshot, ChoiceSourceStatus, ChoiceTransaction, CompareRequest, CopyReceipt,
    CopyRequest, KeepRequest, RecoverRequest, RecoveryComparison, ResolveRequest,
    TransactionResolution,
};
use crate::documents::recovery::decode_journal;
use crate::documents::recovery::{
    Checkpoint, CheckpointProtection, CheckpointReceipt, MAX_FRAME_BYTES, MAX_VERSION, source_hash,
};
use crate::documents::saving::{
    ReplacementState, SaveFailure, SaveObservation, SaveProtection, SaveReceipt, SaveRequest,
};
use crate::documents::startup::{RecoveryCandidate, RecoveryOrigin, RecoverySelection};

fn find_checkpoint(
    service: &DocumentService,
    identity: &DocumentRequest,
    selection: &RecoverySelection,
) -> Result<(Checkpoint, RecoveryCandidate), DocumentError> {
    if selection.document_id != identity.document_id {
        return Err(error(ErrorCode::IdentityMismatch));
    }
    if selection.record_sha256.len() != 64
        || !selection
            .record_sha256
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    {
        return Err(error(ErrorCode::InvalidCheckpoint));
    }
    let inspection = service.inspect_recovery(identity)?;
    let artifacts = [
        (RecoveryOrigin::Current, inspection.current),
        (RecoveryOrigin::Previous, inspection.previous),
        (RecoveryOrigin::Pending, inspection.pending),
        (RecoveryOrigin::PreviousPending, inspection.previous_pending),
    ];
    for (origin, journal) in artifacts {
        let Some(journal) = journal else { continue };
        for checkpoint in &journal.checkpoints {
            let candidate = candidate_of(checkpoint, origin.clone())?;
            if candidate.selection == *selection {
                if origin != selection.origin {
                    return Err(error(ErrorCode::RecoveryNeedsAttention));
                }
                return Ok((checkpoint.clone(), candidate));
            }
        }
    }
    Err(error(ErrorCode::RecoveryNeedsAttention))
}

fn candidate_of(
    checkpoint: &Checkpoint,
    origin: RecoveryOrigin,
) -> Result<RecoveryCandidate, DocumentError> {
    Ok(RecoveryCandidate {
        selection: RecoverySelection {
            document_id: checkpoint.metadata.document_id.clone(),
            origin,
            record_sha256: source_hash(&checkpoint.encode()?),
        },
        session_id: checkpoint.metadata.session_id.clone(),
        version: checkpoint.metadata.version,
        generation: checkpoint.metadata.generation,
        source_sha256: checkpoint.metadata.source_sha256.clone(),
        byte_length: checkpoint.source.len(),
        encoding: if std::str::from_utf8(&checkpoint.source).is_ok() {
            SourceEncoding::Utf8
        } else {
            SourceEncoding::Unsupported
        },
    })
}

fn verify_choice_leases(
    service: &DocumentService,
    identity: &DocumentRequest,
) -> Result<(), DocumentError> {
    let record = service.registered(identity)?;
    if record.initial.ownership != Ownership::Exclusive {
        // Compare/keep/copy may still report on a read-only source; adoption may not.
        return Ok(());
    }
    service.verify_store()?;
    for lease in &record.leases {
        service.verify_lease(lease)?;
    }
    Ok(())
}

fn snapshot_status(
    record: &Registered,
) -> Result<(ChoiceSourceSnapshot, Option<Vec<u8>>), DocumentError> {
    let Some(anchor) = record.anchor.as_ref() else {
        return Ok((
            ChoiceSourceSnapshot {
                status: ChoiceSourceStatus::Missing,
                fingerprint: None,
                source_sha256: None,
                byte_length: None,
                encoding: None,
            },
            None,
        ));
    };
    match anchor.snapshot() {
        Ok((bytes, fingerprint)) => {
            let snapshot = ChoiceSourceSnapshot {
                status: ChoiceSourceStatus::Current,
                fingerprint: Some(fingerprint.clone()),
                source_sha256: Some(source_hash(&bytes)),
                byte_length: Some(bytes.len() as u64),
                encoding: Some(if std::str::from_utf8(&bytes).is_ok() {
                    SourceEncoding::Utf8
                } else {
                    SourceEncoding::Unsupported
                }),
            };
            Ok((snapshot, Some(bytes)))
        }
        Err(err)
            if matches!(
                err.code,
                ErrorCode::MissingSource
                    | ErrorCode::PermissionDenied
                    | ErrorCode::UnsafePath
                    | ErrorCode::NotRegularFile
                    | ErrorCode::SourceTooLarge
                    | ErrorCode::Io
            ) =>
        {
            let status = if err.code == ErrorCode::MissingSource {
                ChoiceSourceStatus::Missing
            } else {
                ChoiceSourceStatus::Unreadable
            };
            Ok((
                ChoiceSourceSnapshot {
                    status,
                    fingerprint: None,
                    source_sha256: None,
                    byte_length: None,
                    encoding: None,
                },
                None,
            ))
        }
        Err(err) => Err(err),
    }
}

fn transaction_status(
    service: &DocumentService,
    identity: &DocumentRequest,
) -> Result<ChoiceTransaction, DocumentError> {
    match service.inspect_source_save(identity) {
        Ok(state) => Ok(state.observation.into()),
        Err(err) if err.code == ErrorCode::MissingSource => Ok(ChoiceTransaction::NoTransaction),
        Err(err) if err.code == ErrorCode::SaveNeedsAttention => {
            Ok(ChoiceTransaction::NeedsAttention)
        }
        Err(err) => Err(err),
    }
}

fn comparison(
    service: &DocumentService,
    identity: &DocumentRequest,
    selection: &RecoverySelection,
) -> Result<RecoveryComparison, DocumentError> {
    let record = service.registered(identity)?;
    let (checkpoint, candidate) = find_checkpoint(service, identity, selection)?;
    let (source, bytes) = snapshot_status(record)?;
    let identical = bytes.as_deref() == Some(checkpoint.source.as_slice());
    let external_divergence = match (&record.baseline, &source.fingerprint) {
        (Some(base), Some(current)) => current != base,
        (Some(_), None) => record.anchor.is_some(),
        _ => false,
    };
    let transaction = transaction_status(service, identity)?;
    Ok(RecoveryComparison {
        identity: identity.clone(),
        selection: selection.clone(),
        recovery: candidate,
        source,
        identical,
        external_divergence,
        transaction,
    })
}

fn link_loose_identity(
    service: &DocumentService,
    anchor: &Anchor,
    document_id: &str,
) -> Result<(), DocumentError> {
    use std::os::unix::ffi::OsStrExt;
    let key = hash(anchor.path.as_os_str().as_bytes());
    let _registration_lease = service.lease(&format!("registry:{key}"))?;
    let name = format!("{key}.identity.json");
    match read_file(&service.store, OsStr::new(&name)) {
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
            if record.document_id != document_id {
                return Err(error(ErrorCode::SaveConflict));
            }
            Ok(())
        }
        Err(err) if err.code == ErrorCode::MissingSource => {
            let bytes = serde_json::to_vec(&LooseIdentity {
                schema_version: 1,
                document_id: document_id.to_owned(),
            })
            .map_err(|_| error(ErrorCode::IdentityStoreUnavailable))?;
            let mut file = File::from(
                fs::openat(
                    &service.store,
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
            service.store.sync_all().map_err(io_error)?;
            service.verify_store()?;
            Ok(())
        }
        Err(err) => Err(err),
    }
}

/// Refuse to copy when the readable source carries metadata this adapter cannot
/// preserve. A missing or unreadable source still permits an emergency copy of
/// the recovery bytes.
fn plain_metadata_probe(parent: &File, name: &OsString) -> Result<(), DocumentError> {
    match read_file(parent, name) {
        Ok(file) => source_store::plain_metadata(&file),
        Err(err)
            if matches!(
                err.code,
                ErrorCode::MissingSource
                    | ErrorCode::PermissionDenied
                    | ErrorCode::UnsafePath
                    | ErrorCode::NotRegularFile
                    | ErrorCode::SourceTooLarge
                    | ErrorCode::Io
            ) =>
        {
            Ok(())
        }
        Err(err) => Err(err),
    }
}

impl DocumentService {
    /// Facts about both generations without choosing a winner. Read-only sources
    /// may be compared; only exclusive registrations may adopt.
    pub fn compare_recovery(
        &self,
        request: &CompareRequest,
    ) -> Result<RecoveryComparison, DocumentError> {
        self.registered(&request.identity)?;
        verify_choice_leases(self, &request.identity)?;
        comparison(self, &request.identity, &request.selection)
    }

    /// Protected adoption: the selected recovery bytes become a new source
    /// version through the standard recovery-first transaction. The previous
    /// source copy and the recovery journal are both retained.
    pub fn recover_checkpoint_as_current(
        &mut self,
        request: &RecoverRequest,
    ) -> Result<SaveReceipt, Box<SaveFailure>> {
        let failure = |error| {
            Box::new(SaveFailure {
                identity: request.identity.clone(),
                version: request.new_version,
                error,
                replacement: ReplacementState::SourceUnchanged,
                recovery: None,
            })
        };
        if request.new_version == 0 || request.new_version > MAX_VERSION {
            return Err(failure(error(ErrorCode::InvalidSave)));
        }
        self.registered(&request.identity).map_err(failure)?;
        self.validate_recovery_owner(&request.identity)
            .map_err(failure)?;
        let record = self.registered(&request.identity).map_err(failure)?;
        if record.anchor.is_none() {
            return Err(failure(error(ErrorCode::MissingSource)));
        }
        if !record.queue.is_empty() {
            return Err(failure(error(ErrorCode::SaveQueueFull)));
        }
        if record.save_uncertain {
            return Err(failure(error(ErrorCode::SaveNeedsAttention)));
        }
        let (checkpoint, _) =
            find_checkpoint(self, &request.identity, &request.selection).map_err(failure)?;
        if std::str::from_utf8(&checkpoint.source).is_err() {
            // Malformed recovery stays protectable; only a raw copy may carry it.
            return Err(failure(error(ErrorCode::InvalidSave)));
        }
        let latest_version = self
            .inspect_recovery(&request.identity)
            .map_err(failure)?
            .latest
            .map(|checkpoint| checkpoint.metadata.version)
            .unwrap_or(0);
        if request.new_version <= latest_version
            || request.new_version <= checkpoint.metadata.version
        {
            return Err(failure(error(ErrorCode::StaleRecoveryVersion)));
        }
        let baseline = self
            .registered(&request.identity)
            .map_err(failure)?
            .baseline
            .clone()
            .ok_or_else(|| failure(error(ErrorCode::MissingSource)))?;
        if request.expected_fingerprint != baseline {
            return Err(failure(error(ErrorCode::SourceChanged)));
        }
        let anchor = self
            .registered(&request.identity)
            .map_err(failure)?
            .anchor
            .as_ref()
            .ok_or_else(|| failure(error(ErrorCode::MissingSource)))?;
        match anchor.snapshot() {
            Ok((_, current)) if current == baseline => (),
            Ok(_) => return Err(failure(error(ErrorCode::SourceChanged))),
            Err(err) => return Err(failure(err)),
        }
        let state = self.inspect_source_save(&request.identity).map_err(|err| {
            let mut failure = failure(err);
            // Inspection failures precede replacement by definition.
            failure.replacement = ReplacementState::SourceUnchanged;
            failure
        })?;
        if state.intent.is_some()
            || state.previous_pending.is_some()
            || state.observation == SaveObservation::NeedsAttention
        {
            return Err(failure(error(ErrorCode::SaveNeedsAttention)));
        }
        self.protect_disk_before_replacement(&request.identity)
            .map_err(failure)?;
        // This explicit choice reconciles an older session for this registration.
        if let Some(record) = self.documents.get_mut(&request.identity.handle) {
            record.recovery_reconciled = true;
        }
        self.save_request(SaveRequest {
            identity: request.identity.clone(),
            version: request.new_version,
            source: checkpoint.source.clone(),
            source_sha256: checkpoint.metadata.source_sha256.clone(),
            expected_fingerprint: baseline,
            draft_metadata: checkpoint.metadata.draft_metadata.clone(),
        })
    }

    /// Explicit keep: verifies both generations are unchanged and reconciles
    /// this session for future writes. Nothing is written or deleted.
    pub fn keep_current_source(
        &mut self,
        request: &KeepRequest,
    ) -> Result<RecoveryComparison, DocumentError> {
        self.registered(&request.identity)?;
        verify_choice_leases(self, &request.identity)?;
        let compared = comparison(self, &request.identity, &request.selection)?;
        let record = self.registered(&request.identity)?;
        let Some(anchor) = record.anchor.as_ref() else {
            // Unsaved drafts have no file to keep; reconciling lets drafting
            // continue in this session. The file-level Save As belongs to M2-05C.
            if record.baseline.is_some() {
                return Err(error(ErrorCode::MissingSource));
            }
            if let Some(record) = self.documents.get_mut(&request.identity.handle) {
                record.recovery_reconciled = true;
            }
            return Ok(compared);
        };
        let baseline = record
            .baseline
            .clone()
            .ok_or_else(|| error(ErrorCode::MissingSource))?;
        if request.expected_fingerprint != baseline {
            return Err(error(ErrorCode::SourceChanged));
        }
        let (_, current) = anchor.snapshot().map_err(|err| {
            if err.code == ErrorCode::MissingSource {
                error(ErrorCode::MissingSource)
            } else {
                err
            }
        })?;
        if current != baseline {
            return Err(error(ErrorCode::SourceChanged));
        }
        if compared.transaction == ChoiceTransaction::NeedsAttention {
            return Err(error(ErrorCode::SaveNeedsAttention));
        }
        if let Some(record) = self.documents.get_mut(&request.identity.handle) {
            record.recovery_reconciled = true;
        }
        Ok(compared)
    }

    /// Sibling-file emergency copy of the exact recovery bytes. The source and
    /// journal are untouched; only the new file name (never a path) is reported.
    /// Works even when the source is missing or unreadable.
    pub fn save_recovered_copy(&self, request: &CopyRequest) -> Result<CopyReceipt, DocumentError> {
        self.registered(&request.identity)?;
        verify_choice_leases(self, &request.identity)?;
        let (checkpoint, _) = find_checkpoint(self, &request.identity, &request.selection)?;
        let record = self.registered(&request.identity)?;
        let anchor = record
            .anchor
            .as_ref()
            .ok_or_else(|| error(ErrorCode::MissingSource))?;
        anchor.verify_location()?;
        if let Some(baseline) = record.baseline.as_ref()
            && let Ok((_, current)) = anchor.snapshot()
            && request.expected_fingerprint != *baseline
            && current == *baseline
        {
            // The compare result is stale; refresh before copying a named source.
            // A missing/diverged source still permits an emergency copy below.
            return Err(error(ErrorCode::SourceChanged));
        }
        let parent_info = stat(&anchor.parent)?;
        if parent_info.st_uid != geteuid().as_raw() || parent_info.st_mode & 0o7022 != 0 {
            return Err(error(ErrorCode::UnsafePath));
        }
        if parent_info.st_mode & 0o200 == 0 {
            return Err(error(ErrorCode::PermissionDenied));
        }
        plain_metadata_probe(&anchor.parent, &anchor.name)?;
        let mut sibling = anchor.name.clone();
        sibling.push(format!(".recovered-{}.fountain", uuid()));
        let name = sibling
            .to_str()
            .ok_or_else(|| error(ErrorCode::UnsafePath))?;
        if name.len() > 240 {
            return Err(error(ErrorCode::UnsafePath));
        }
        let mut file = File::from(
            fs::openat(
                &anchor.parent,
                name,
                OFlags::RDWR | OFlags::CREATE | OFlags::EXCL | OFlags::NOFOLLOW | OFlags::CLOEXEC,
                Mode::from_raw_mode(0o600),
            )
            .map_err(syscall_error)?,
        );
        file.write_all(&checkpoint.source).map_err(io_error)?;
        file.sync_all().map_err(io_error)?;
        let info = stat(&file)?;
        if !private_file(&info) {
            return Err(error(ErrorCode::SaveNeedsAttention));
        }
        source_store::plain_metadata(&file)?;
        drop(file);
        anchor.parent.sync_all().map_err(io_error)?;
        let (bytes, fingerprint) = snapshot(
            read_file(&anchor.parent, OsStr::new(name))?,
            MAX_SOURCE_BYTES,
        )?;
        if bytes != checkpoint.source {
            return Err(error(ErrorCode::Io));
        }
        Ok(CopyReceipt {
            identity: request.identity.clone(),
            version: checkpoint.metadata.version,
            file_name: name.to_owned(),
            fingerprint,
            source_sha256: source_hash(&bytes),
            byte_length: bytes.len() as u64,
        })
    }

    /// Completes the two safe post-replacement states without deleting anything.
    /// Every other observation returns unchanged with no receipt.
    pub fn finalize_interrupted_save(
        &mut self,
        request: &ResolveRequest,
    ) -> Result<TransactionResolution, DocumentError> {
        self.finalize_interrupted_save_with(request, |_| Ok(()))
    }

    /// Test-only fault injection for finalize durability. The gate runs before
    /// source-directory durability; production IPC uses the no-op gate above,
    /// so no runtime hook or general filesystem endpoint is added.
    pub(super) fn finalize_interrupted_save_with(
        &mut self,
        request: &ResolveRequest,
        mut gate: impl FnMut(source_store::Stage) -> Result<(), DocumentError>,
    ) -> Result<TransactionResolution, DocumentError> {
        let identity = &request.identity;
        self.validate_recovery_owner(identity)?;
        let state = self.inspect_source_save(identity)?;
        let observation = ChoiceTransaction::from(state.observation);
        let previous_preserved = state.previous.is_some();
        match state.observation {
            SaveObservation::InstalledCandidateUnconfirmed
            | SaveObservation::ConfirmedRecordMatchesSource => (),
            _ => {
                return Ok(TransactionResolution {
                    identity: identity.clone(),
                    observation,
                    completed: None,
                    previous_preserved,
                });
            }
        }
        let completed = self.complete_replacement(identity, &state, &mut gate)?;
        Ok(TransactionResolution {
            identity: identity.clone(),
            observation: ChoiceTransaction::ConfirmedRecordMatchesSource,
            completed: Some(completed),
            previous_preserved: true,
        })
    }

    fn complete_replacement(
        &mut self,
        identity: &DocumentRequest,
        state: &SaveInspection,
        gate: &mut impl FnMut(source_store::Stage) -> Result<(), DocumentError>,
    ) -> Result<SaveReceipt, DocumentError> {
        let frame = state.intent.as_ref().or(state.confirmed.as_ref());
        let Some(read) = frame else {
            return Err(error(ErrorCode::SaveNeedsAttention));
        };
        let checkpoint = source_store::single(read, &identity.document_id)
            .map_err(|_| error(ErrorCode::SaveNeedsAttention))?;
        let candidate_name = source_store::transaction(checkpoint)
            .map(|transaction| transaction.candidate_name)
            .map_err(|_| error(ErrorCode::SaveNeedsAttention))?;
        let draft_metadata = source_store::transaction(checkpoint)
            .map(|transaction| transaction.draft_metadata)
            .map_err(|_| error(ErrorCode::SaveNeedsAttention))?;
        let base = checkpoint
            .metadata
            .base_fingerprint
            .clone()
            .ok_or_else(|| error(ErrorCode::SaveNeedsAttention))?;
        let dir = self.source_directory(identity, false)?;
        if self.validate_save_location(identity, &dir).is_err() {
            return Err(error(ErrorCode::SaveNeedsAttention));
        }
        let record = self.registered(identity)?;
        let anchor = record
            .anchor
            .as_ref()
            .ok_or_else(|| error(ErrorCode::SaveNeedsAttention))?;
        let previous = source_store::read_optional(&dir, "previous", MAX_SOURCE_BYTES)?
            .ok_or_else(|| error(ErrorCode::SaveNeedsAttention))?;
        if source_hash(&previous) != base.sha256 {
            return Err(error(ErrorCode::SaveNeedsAttention));
        }
        if state.intent.is_some() {
            // Post-rename the candidate was consumed by the source; a stray
            // file under the spent candidate name needs attention instead.
            match read_file(&anchor.parent, OsStr::new(&candidate_name)) {
                Ok(candidate) => {
                    let info = stat(&candidate)?;
                    if info.st_uid != geteuid().as_raw()
                        || info.st_nlink != 1
                        || info.st_mode & 0o7022 != 0
                    {
                        return Err(error(ErrorCode::SaveNeedsAttention));
                    }
                    source_store::plain_metadata(&candidate)?;
                    return Err(error(ErrorCode::SaveNeedsAttention));
                }
                Err(err) if err.code == ErrorCode::MissingSource => (),
                Err(_) => return Err(error(ErrorCode::SaveNeedsAttention)),
            }
        }
        let (installed, fingerprint) = anchor
            .snapshot()
            .map_err(|_| error(ErrorCode::SourceChanged))?;
        if installed != checkpoint.source {
            return Err(error(ErrorCode::SourceChanged));
        }
        if fingerprint.mode != base.mode
            || fingerprint.owner != base.owner
            || fingerprint.links != 1
        {
            return Err(error(ErrorCode::SourceChanged));
        }
        source_store::plain_metadata(&read_file(&anchor.parent, &anchor.name)?)?;
        // SPEC S10.4 step 8: the ordinary save syncs the source directory
        // after rename, but an interruption at Replaced/BeforeDirectorySync
        // skips it. Finalize must finish source/file/directory durability and
        // revalidate before any receipt; failure preserves uncertainty and
        // returns no receipt. This covers both the post-rename intent branch
        // and the already-confirmed branch after restart.
        gate(source_store::Stage::BeforeDirectorySync)?;
        read_file(&anchor.parent, &anchor.name)?
            .sync_all()
            .map_err(io_error)?;
        anchor.parent.sync_all().map_err(io_error)?;
        gate(source_store::Stage::DirectorySynced)?;
        let (installed_after, fingerprint_after) = anchor
            .snapshot()
            .map_err(|_| error(ErrorCode::SourceChanged))?;
        if installed_after != checkpoint.source {
            return Err(error(ErrorCode::SourceChanged));
        }
        if fingerprint_after.device != fingerprint.device
            || fingerprint_after.inode != fingerprint.inode
            || fingerprint_after.mode != fingerprint.mode
            || fingerprint_after.owner != fingerprint.owner
            || fingerprint_after.links != 1
        {
            return Err(error(ErrorCode::SourceChanged));
        }
        source_store::plain_metadata(&read_file(&anchor.parent, &anchor.name)?)?;
        self.validate_save_location(identity, &dir)
            .map_err(|_| error(ErrorCode::SaveNeedsAttention))?;
        if source_store::read_optional(&dir, "previous", MAX_SOURCE_BYTES)?.as_deref()
            != Some(previous.as_slice())
        {
            return Err(error(ErrorCode::SaveNeedsAttention));
        }
        if state.intent.is_some() {
            fs::renameat(&dir, "intent", &dir, "confirmed").map_err(syscall_error)?;
            dir.sync_all().map_err(io_error)?;
            let confirmed = source_store::read_optional(&dir, "confirmed", MAX_FRAME_BYTES)?
                .ok_or_else(|| error(ErrorCode::Io))?;
            if decode_journal(&confirmed).checkpoints.first() != Some(checkpoint) {
                return Err(error(ErrorCode::Io));
            }
            if anchor.snapshot()?.1 != fingerprint_after {
                return Err(error(ErrorCode::SourceChanged));
            }
        } else {
            // Already-confirmed records were synced at publication; refresh
            // transaction-directory durability before acknowledging.
            dir.sync_all().map_err(io_error)?;
        }
        self.validate_save_location(identity, &dir)
            .map_err(|_| error(ErrorCode::SaveNeedsAttention))?;
        let recovery = CheckpointReceipt {
            identity: identity.clone(),
            version: checkpoint.metadata.version,
            source_sha256: checkpoint.metadata.source_sha256.clone(),
            generation: checkpoint.metadata.generation,
            protection: CheckpointProtection::RecoveryCheckpoint,
        };
        let saved = SaveReceipt {
            identity: identity.clone(),
            version: checkpoint.metadata.version,
            source_sha256: source_hash(&installed_after),
            fingerprint: fingerprint_after.clone(),
            recovery,
            protection: SaveProtection::SourceFile,
        };
        let record = self
            .documents
            .get_mut(&identity.handle)
            .ok_or_else(|| error(ErrorCode::InvalidHandle))?;
        if record.save_uncertain {
            // In-process interruption retains old, new and document leases.
            if record.leases.len() == 3 {
                record.leases.remove(0);
                record.leases.rotate_right(1);
            }
            record.save_uncertain = false;
        }
        record.baseline = Some(fingerprint_after);
        record.last_save = Some((saved.clone(), draft_metadata));
        Ok(saved)
    }

    /// Native-only relinking for a moved or missing source. The caller supplies
    /// the new location inside Rust; no IPC path exists. Managed continuity
    /// requires the same project identity; loose moves link the same document
    /// ID. The old file is never deleted. Unsaved Save As belongs to M2-05C.
    pub fn relink_selected(
        &mut self,
        identity: &DocumentRequest,
        path: &Path,
    ) -> Result<OpenDocument, DocumentError> {
        // ADR 0017 requires exclusive ownership for relink. A view-only caller
        // must not mutate identity/lease storage, and invalidated leases must
        // refuse before any write. The obsolete source may be missing or
        // renamed, so only caller ownership/held leases are validated here;
        // source divergence is handled by the move continuity checks below.
        self.validate_recovery_owner(identity)?;
        let record = self.registered(identity)?;
        if record.anchor.is_none() {
            return Err(error(ErrorCode::InvalidSave));
        }
        if !record.queue.is_empty() || record.save_uncertain {
            return Err(error(ErrorCode::SaveNeedsAttention));
        }
        let old_kind = record.initial.kind.clone();
        let anchor = Anchor::selected(path)?;
        let (bytes, fingerprint) = anchor.snapshot()?;
        let encoding = if std::str::from_utf8(&bytes).is_ok() {
            SourceEncoding::Utf8
        } else {
            SourceEncoding::Unsupported
        };
        let reasons = {
            let mut reasons = view_reasons(&fingerprint, &stat(&anchor.parent)?);
            if encoding == SourceEncoding::Unsupported {
                reasons.push(ViewReason::UnsupportedEncoding);
            }
            reasons
        };
        let (kind, managed, metadata_reason) = project_identity(&anchor);
        if metadata_reason.is_some() || kind != old_kind {
            return Err(error(ErrorCode::IdentityMismatch));
        }
        if kind == DocumentKind::Managed && managed.as_ref() != Some(&identity.document_id) {
            return Err(error(ErrorCode::IdentityMismatch));
        }
        if !reasons.is_empty() {
            return Err(error(ErrorCode::OwnershipRequired));
        }
        if kind == DocumentKind::Loose {
            link_loose_identity(self, &anchor, &identity.document_id)?;
        }
        // A rename preserves the inode, so the held source lease still applies;
        // acquiring it again would contend with this same registration.
        let same_inode = self
            .registered(identity)?
            .baseline
            .as_ref()
            .is_some_and(|base| {
                base.device == fingerprint.device && base.inode == fingerprint.inode
            });
        let pending = if same_inode {
            self.verify_store()?;
            let record = self.registered(identity)?;
            for lease in &record.leases {
                self.verify_lease(lease)?;
            }
            None
        } else {
            let lease = self.lease(&format!(
                "source:{}:{}",
                fingerprint.device, fingerprint.inode
            ))?;
            self.verify_lease(&lease)?;
            Some(lease)
        };
        let (_, current) = anchor.snapshot()?;
        if current != fingerprint {
            return Err(error(ErrorCode::SourceChanged));
        }
        let record = self
            .documents
            .get_mut(&identity.handle)
            .ok_or_else(|| error(ErrorCode::InvalidHandle))?;
        if let Some(lease) = pending {
            if record.leases.len() >= 2 {
                record.leases.remove(0);
            }
            record.leases.push(lease);
        }
        record.anchor = Some(anchor);
        record.baseline = Some(fingerprint.clone());
        record.initial.source = bytes;
        record.initial.fingerprint = Some(fingerprint);
        record.initial.encoding = encoding;
        record.initial.kind = kind;
        record.initial.persistent_identity = true;
        Ok(record.initial.clone())
    }
}

#[cfg(test)]
#[path = "choices_store_tests.rs"]
mod tests;
