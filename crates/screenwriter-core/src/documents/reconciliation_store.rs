//! Reopen admission and durable explicit Keep. No author bytes are replaced or deleted.
use super::*;
use crate::documents::recovery::{Checkpoint, TailStatus};

#[derive(Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct KeepMarker {
    schema_version: u32,
    document_id: String,
    record_sha256: String,
    source_sha256: String,
}

fn marker(
    identity: &DocumentRequest,
    latest: &Checkpoint,
    source: &[u8],
) -> Result<KeepMarker, DocumentError> {
    Ok(KeepMarker {
        schema_version: 1,
        document_id: identity.document_id.clone(),
        record_sha256: source_hash(&latest.encode()?),
        source_sha256: source_hash(source),
    })
}

fn clean_latest(
    service: &DocumentService,
    identity: &DocumentRequest,
) -> Result<Option<Checkpoint>, DocumentError> {
    let state = service.inspect_recovery(identity)?;
    if state.pending.is_some()
        || state.previous_pending.is_some()
        || state.quarantined
        || [&state.current, &state.previous]
            .into_iter()
            .flatten()
            .any(|journal| journal.tail != TailStatus::Clean)
    {
        return Err(error(ErrorCode::RecoveryNeedsAttention));
    }
    Ok(state.latest)
}

fn verify_safe(
    service: &DocumentService,
    identity: &DocumentRequest,
    latest: &Checkpoint,
    explicit_keep: bool,
) -> Result<Vec<u8>, DocumentError> {
    service.validate_recovery_owner(identity)?;
    let record = service.registered(identity)?;
    if record.save_uncertain || !record.queue.is_empty() {
        return Err(error(ErrorCode::SaveNeedsAttention));
    }
    let state = service.inspect_source_save(identity)?;
    if state.intent.is_some()
        || state.previous_pending.is_some()
        || !(matches!(
            state.observation,
            SaveObservation::NoTransaction | SaveObservation::ConfirmedRecordMatchesSource
        ) || (explicit_keep
            && state.observation == SaveObservation::Diverged
            && state.confirmed.is_some()
            && state.candidate.is_none()))
    {
        return Err(error(ErrorCode::SaveNeedsAttention));
    }
    if clean_latest(service, identity)?.as_ref() != Some(latest) {
        return Err(error(ErrorCode::RecoveryNeedsAttention));
    }
    let (source, current) = record
        .anchor
        .as_ref()
        .ok_or_else(|| error(ErrorCode::MissingSource))?
        .snapshot()?;
    if record.baseline.as_ref() != Some(&current) {
        return Err(error(ErrorCode::SourceChanged));
    }
    Ok(source)
}

impl DocumentService {
    /// Admission facts remain bound to the inspected generation and safe source state.
    pub(super) fn recovery_admission_is_safe(
        &self,
        identity: &DocumentRequest,
        candidate: &startup::RecoveryCandidate,
    ) -> bool {
        let Ok(Some(latest)) = clean_latest(self, identity) else {
            return false;
        };
        latest
            .encode()
            .is_ok_and(|bytes| source_hash(&bytes) == candidate.selection.record_sha256)
            && verify_safe(self, identity, &latest, true).is_ok()
    }

    /// Conservative open-time fast path; failures leave explicit choices required.
    pub(super) fn reconcile_recovery_at_open(
        &mut self,
        identity: &DocumentRequest,
    ) -> Result<(), DocumentError> {
        self.validate_recovery_owner(identity)?;
        let _lease = self.lease(&format!("recovery:{}", identity.document_id))?;
        let Some(latest) = clean_latest(self, identity)? else {
            return Ok(());
        };
        let source = verify_safe(self, identity, &latest, true)?;
        let identical =
            latest.source == source && verify_safe(self, identity, &latest, false).is_ok();
        let accepted = if identical {
            true
        } else {
            let dir = self.recovery_directory(Some(identity), false)?;
            match recovery_store::read_bytes(&dir, &format!("{}.keep", identity.document_id))? {
                Some(bytes) if bytes.len() <= MAX_METADATA_BYTES => {
                    serde_json::from_slice::<KeepMarker>(&bytes).ok().as_ref()
                        == Some(&marker(identity, &latest, &source)?)
                }
                _ => false,
            }
        };
        if accepted {
            if verify_safe(self, identity, &latest, !identical)? != source {
                return Err(error(ErrorCode::SourceChanged));
            }
            self.documents
                .get_mut(&identity.handle)
                .ok_or_else(|| error(ErrorCode::InvalidHandle))?
                .recovery_reconciled = true;
        }
        Ok(())
    }

    pub(super) fn persist_keep(
        &mut self,
        identity: &DocumentRequest,
        selection: &startup::RecoverySelection,
    ) -> Result<(), DocumentError> {
        let latest = clean_latest(self, identity)?
            .ok_or_else(|| error(ErrorCode::RecoveryNeedsAttention))?;
        let source = verify_safe(self, identity, &latest, true)?;
        let decision = marker(identity, &latest, &source)?;
        if selection.record_sha256 != decision.record_sha256 {
            return Err(error(ErrorCode::RecoveryNeedsAttention));
        }
        let dir = self.recovery_directory(Some(identity), false)?;
        let _lease = self.lease(&format!("recovery:{}", identity.document_id))?;
        let name = format!("{}.keep", identity.document_id);
        let _ = recovery_store::read_bytes(&dir, &name)?;
        let pending = format!("{}.keep-{}.pending", identity.document_id, uuid());
        let bytes =
            serde_json::to_vec(&decision).map_err(|_| error(ErrorCode::RecoveryNeedsAttention))?;
        let mut file = create_private(&dir, &pending, OFlags::WRONLY).map_err(syscall_error)?;
        file.write_all(&bytes).map_err(io_error)?;
        file.sync_all().map_err(io_error)?;
        if recovery_store::read_bytes(&dir, &pending)?.as_deref() != Some(&bytes)
            || verify_safe(self, identity, &latest, true)? != source
        {
            return Err(error(ErrorCode::RecoveryNeedsAttention));
        }
        // Destination is private and verified; publication never touches a journal.
        let _ = recovery_store::read_bytes(&dir, &name)?;
        fs::renameat(&dir, &pending, &dir, &name).map_err(syscall_error)?;
        dir.sync_all().map_err(io_error)?;
        let current = self.recovery_directory(Some(identity), false)?;
        if !same_file(&stat(&dir)?, &stat(&current)?)
            || recovery_store::read_bytes(&dir, &name)?.as_deref() != Some(&bytes)
            || verify_safe(self, identity, &latest, true)? != source
        {
            return Err(error(ErrorCode::RecoveryNeedsAttention));
        }
        self.documents
            .get_mut(&identity.handle)
            .ok_or_else(|| error(ErrorCode::InvalidHandle))?
            .recovery_reconciled = true;
        Ok(())
    }
}
