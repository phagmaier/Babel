//! No source replacement: protect both editor generations before acknowledging disk adoption.
use super::*;
use crate::documents::{
    reload::*,
    snapshots::{SnapshotKind, SnapshotRequest},
};

#[derive(Clone, Copy, PartialEq, Eq)]
enum ReloadStage {
    LiveProtected,
    AdoptedProtected,
}

impl DocumentService {
    fn reload_source(
        &self,
        identity: &DocumentRequest,
    ) -> Result<(Vec<u8>, DiskFingerprint), DocumentError> {
        self.validate_recovery_owner(identity)?;
        let record = self.registered(identity)?;
        if !record.queue.is_empty() || record.save_uncertain {
            return Err(error(ErrorCode::SaveNeedsAttention));
        }
        let anchor = record
            .anchor
            .as_ref()
            .ok_or_else(|| error(ErrorCode::MissingSource))?;
        let (source, fingerprint) = anchor.snapshot()?;
        if !view_reasons(&fingerprint, &stat(&anchor.parent)?).is_empty() {
            return Err(error(ErrorCode::OwnershipRequired));
        }
        let (kind, id, reason) = project_identity(anchor);
        if kind != record.initial.kind
            || reason.is_some()
            || (kind == DocumentKind::Managed && id.as_ref() != Some(&identity.document_id))
        {
            return Err(error(ErrorCode::IdentityMismatch));
        }
        source_store::plain_metadata(&read_file(&anchor.parent, &anchor.name)?)?;
        Ok((source, fingerprint))
    }

    fn reload_lease(
        &self,
        identity: &DocumentRequest,
        current: &DiskFingerprint,
    ) -> Result<Option<Lease>, DocumentError> {
        let base = self
            .registered(identity)?
            .baseline
            .as_ref()
            .ok_or_else(|| error(ErrorCode::MissingSource))?;
        if base.device == current.device && base.inode == current.inode {
            return Ok(None);
        }
        let key = format!("source:{}:{}", current.device, current.inode);
        let name = format!("{}.lock", hash(key.as_bytes()));
        if self
            .registered(identity)?
            .leases
            .iter()
            .any(|lease| lease.name == name)
        {
            return Ok(None);
        }
        self.lease(&key).map(Some)
    }

    pub fn check_source(
        &mut self,
        request: &SourceCheckRequest,
    ) -> Result<SourceCheck, DocumentError> {
        if self.registered(&request.identity)?.baseline.as_ref()
            != Some(&request.expected_fingerprint)
        {
            return Err(error(ErrorCode::SourceChanged));
        }
        let (source, fingerprint) = self.reload_source(&request.identity)?;
        let status = if fingerprint == request.expected_fingerprint {
            SourceCheckStatus::Unchanged
        } else if source_hash(&source) == request.expected_fingerprint.sha256 {
            SourceCheckStatus::MetadataOnly
        } else {
            SourceCheckStatus::Changed
        };
        if status == SourceCheckStatus::MetadataOnly {
            let lease = self.reload_lease(&request.identity, &fingerprint)?;
            if self.reload_source(&request.identity)?.1 != fingerprint {
                return Err(error(ErrorCode::SourceChanged));
            }
            let transaction = self.inspect_source_save(&request.identity)?;
            if transaction.intent.is_some()
                || transaction.previous_pending.is_some()
                || transaction.observation == SaveObservation::NeedsAttention
            {
                return Err(error(ErrorCode::SaveNeedsAttention));
            }
            if let Some(lease) = &lease {
                self.verify_lease(lease)?;
            }
            let record = self
                .documents
                .get_mut(&request.identity.handle)
                .ok_or_else(|| error(ErrorCode::InvalidHandle))?;
            if let Some(lease) = lease {
                record.leases.push(lease);
            }
            record.baseline = Some(fingerprint.clone());
            record.last_save = None;
        }
        Ok(SourceCheck {
            identity: request.identity.clone(),
            status: status.clone(),
            fingerprint,
            source: (status == SourceCheckStatus::Changed).then_some(source),
        })
    }

    pub fn reload_source_document(
        &mut self,
        request: &ReloadRequest,
    ) -> Result<SaveReceipt, DocumentError> {
        self.reload_source_with(request, |_| Ok(()))
    }

    fn reload_source_with(
        &mut self,
        request: &ReloadRequest,
        mut gate: impl FnMut(ReloadStage) -> Result<(), DocumentError>,
    ) -> Result<SaveReceipt, DocumentError> {
        let current = &request.current;
        let adopted = &request.adopted;
        if current.identity != adopted.identity
            || adopted.version <= current.version
            || std::str::from_utf8(&adopted.source).is_err()
        {
            return Err(error(ErrorCode::InvalidCheckpoint));
        }
        for capture in [current, adopted] {
            persistence::payload_cost(
                capture.version,
                &capture.source,
                &capture.source_sha256,
                &capture.draft_metadata,
            )?;
            if source_hash(&capture.source) != capture.source_sha256 {
                return Err(error(ErrorCode::InvalidCheckpoint));
            }
        }
        if self.registered(&current.identity)?.baseline != current.expected_fingerprint {
            return Err(error(ErrorCode::SourceChanged));
        }
        let (source, fingerprint) = self.reload_source(&current.identity)?;
        if Some(&fingerprint) != adopted.expected_fingerprint.as_ref() || source != adopted.source {
            return Err(error(ErrorCode::SourceChanged));
        }
        let lease = self.reload_lease(&current.identity, &fingerprint)?;
        let transaction = self.inspect_source_save(&current.identity)?;
        if transaction.intent.is_some()
            || transaction.previous_pending.is_some()
            || transaction.observation == SaveObservation::NeedsAttention
        {
            return Err(error(ErrorCode::SaveNeedsAttention));
        }
        self.checkpoint_request(current.clone())?;
        self.create_snapshot(&SnapshotRequest {
            checkpoint: current.clone(),
            kind: SnapshotKind::PreDestructive,
            name: None,
        })?
        .ok_or_else(|| error(ErrorCode::SnapshotNeedsAttention))?;
        // Source ownership has diverged; held document/store leases and the reviewed disk
        // generation were checked above. This narrow helper records only the journaled live draft.
        let profile = self.native_history_profile(&current.identity)?;
        self.record_owned_revision(
            &current.identity,
            Some(current.version),
            &current.source,
            &profile,
            "Before external Reload",
            true,
        )?;
        gate(ReloadStage::LiveProtected)?;
        if self.reload_source(&current.identity)?.1 != fingerprint {
            return Err(error(ErrorCode::SourceChanged));
        }
        let recovery = self.checkpoint_with_base(
            &adopted.identity,
            adopted.version,
            &adopted.source,
            &adopted.source_sha256,
            adopted.draft_metadata.clone(),
            Some(fingerprint.clone()),
        )?;
        gate(ReloadStage::AdoptedProtected)?;
        let anchor = self
            .registered(&current.identity)?
            .anchor
            .as_ref()
            .ok_or_else(|| error(ErrorCode::MissingSource))?;
        read_file(&anchor.parent, &anchor.name)?
            .sync_all()
            .map_err(io_error)?;
        anchor.parent.sync_all().map_err(io_error)?;
        if self.reload_source(&current.identity)?.1 != fingerprint {
            return Err(error(ErrorCode::SourceChanged));
        }
        if let Some(lease) = &lease {
            self.verify_lease(lease)?;
        }
        let receipt = SaveReceipt {
            identity: current.identity.clone(),
            version: adopted.version,
            source_sha256: adopted.source_sha256.clone(),
            fingerprint: fingerprint.clone(),
            recovery,
            protection: SaveProtection::SourceFile,
        };
        let record = self
            .documents
            .get_mut(&current.identity.handle)
            .ok_or_else(|| error(ErrorCode::InvalidHandle))?;
        if let Some(lease) = lease {
            record.leases.push(lease);
        }
        record.baseline = Some(fingerprint);
        record.last_save = Some((receipt.clone(), adopted.draft_metadata.clone()));
        record.last_admitted = Some((
            adopted.version,
            adopted.source_sha256.clone(),
            adopted.draft_metadata.clone(),
        ));
        Ok(receipt)
    }
}

#[cfg(test)]
#[path = "reload_store_tests.rs"]
mod tests;
