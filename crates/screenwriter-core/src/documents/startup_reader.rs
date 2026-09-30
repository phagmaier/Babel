//! Anchored, bounded read-only local inventory. Managed projects need native selection later.
use super::*;
use crate::documents::{recovery::*, startup::*};
use std::collections::{BTreeMap, BTreeSet};

pub struct LocalRecoveryReader {
    store: File,
    recovery: File,
    path: PathBuf,
}

fn private_directory(file: &File) -> Result<(), DocumentError> {
    let info = stat(file)?;
    if info.st_uid != geteuid().as_raw() || info.st_mode & 0o7777 != 0o700 {
        return Err(error(ErrorCode::IdentityStoreUnavailable));
    }
    Ok(())
}

impl LocalRecoveryReader {
    /// Native OS app-data location only. A missing store/journal directory is empty, never created.
    pub fn open(path: &Path) -> Result<Option<Self>, DocumentError> {
        let open = || -> Result<Self, DocumentError> {
            let store = directory(path)?;
            private_directory(&store)?;
            let recovery = child_directory(&store, OsStr::new("recovery"))?;
            private_directory(&recovery)?;
            let reader = Self {
                store,
                recovery,
                path: path.to_path_buf(),
            };
            reader.verify()?;
            Ok(reader)
        };
        match open() {
            Ok(reader) => Ok(Some(reader)),
            Err(err) if err.code == ErrorCode::MissingSource => Ok(None),
            Err(err) => Err(err),
        }
    }

    fn verify(&self) -> Result<(), DocumentError> {
        let store = directory(&self.path)?;
        let recovery = child_directory(&store, OsStr::new("recovery"))?;
        private_directory(&store)?;
        private_directory(&recovery)?;
        if !same_file(&stat(&store)?, &stat(&self.store)?)
            || !same_file(&stat(&recovery)?, &stat(&self.recovery)?)
        {
            return Err(error(ErrorCode::OwnershipLost));
        }
        Ok(())
    }

    pub fn catalog(&self) -> Result<RecoveryCatalog, DocumentError> {
        self.verify()?;
        let mut catalog = RecoveryCatalog::default();
        let mut ids = BTreeSet::new();
        let entries = fs::Dir::read_from(&self.recovery).map_err(syscall_error)?;
        let mut count = 0;
        for entry in entries {
            let entry = entry.map_err(syscall_error)?;
            let bytes = entry.file_name().to_bytes();
            if bytes == b"." || bytes == b".." {
                continue;
            }
            if count == MAX_DIRECTORY_ENTRIES {
                catalog.truncated = true;
                break;
            }
            count += 1;
            let parsed = std::str::from_utf8(bytes)
                .ok()
                .and_then(|name| name.split_once('.'));
            if let Some((id, suffix)) = parsed
                && valid_uuid(id)
                && [
                    "journal",
                    "previous",
                    "pending",
                    "previous-pending",
                    "quarantine",
                ]
                .contains(&suffix)
            {
                if ids.len() < MAX_REVIEW_DOCUMENTS || ids.contains(id) {
                    ids.insert(id.to_owned());
                } else {
                    catalog.truncated = true;
                }
            } else {
                catalog.unrecognized_artifacts += 1;
            }
        }
        for id in ids {
            catalog.entries.push(self.entry(&id));
        }
        self.verify()?;
        Ok(catalog)
    }

    fn entry(&self, id: &str) -> RecoveryEntry {
        Self::entry_at(&self.recovery, id)
    }

    pub(super) fn entry_at(dir: &File, id: &str) -> RecoveryEntry {
        let mut entry = RecoveryEntry {
            document_id: id.to_owned(),
            candidates: Vec::new(),
            notices: Vec::new(),
            error: None,
        };
        let mut generations = BTreeMap::new();
        for origin in [
            RecoveryOrigin::Current,
            RecoveryOrigin::Previous,
            RecoveryOrigin::Pending,
            RecoveryOrigin::PreviousPending,
        ] {
            match recovery_store::read(dir, id, origin.suffix()) {
                Ok(Some(journal)) => {
                    let notice = match journal.tail {
                        TailStatus::Clean => None,
                        TailStatus::Truncated => Some(RecoveryNotice::TruncatedTail),
                        TailStatus::Corrupt => Some(RecoveryNotice::CorruptTail),
                        TailStatus::UnsupportedSchema => Some(RecoveryNotice::UnsupportedSchema),
                        TailStatus::TooLarge => Some(RecoveryNotice::TooLarge),
                    };
                    if let Some(notice) = notice {
                        entry.notices.push(notice);
                    }
                    if matches!(
                        origin,
                        RecoveryOrigin::Pending | RecoveryOrigin::PreviousPending
                    ) {
                        entry.notices.push(RecoveryNotice::Pending);
                    }
                    for checkpoint in journal.checkpoints {
                        match candidate(&checkpoint, origin.clone()) {
                            Ok(candidate) => {
                                if let Some(old) = generations.insert(
                                    candidate.generation,
                                    candidate.selection.record_sha256.clone(),
                                ) && old != candidate.selection.record_sha256
                                {
                                    entry.notices.push(RecoveryNotice::ConflictingGeneration);
                                }
                                entry.candidates.push(candidate);
                            }
                            Err(err) => {
                                entry.notices.push(RecoveryNotice::UnreadableArtifact);
                                entry.error = Some(err);
                            }
                        }
                    }
                }
                Ok(None) => (),
                Err(err) => {
                    entry.notices.push(RecoveryNotice::UnreadableArtifact);
                    entry.error = Some(err);
                }
            }
        }
        match recovery_store::read_bytes(dir, &format!("{id}.quarantine")) {
            Ok(Some(_)) => entry.notices.push(RecoveryNotice::Quarantined),
            Ok(None) => (),
            Err(err) => {
                entry.notices.push(RecoveryNotice::UnreadableArtifact);
                entry.error = Some(err);
            }
        }
        entry.notices.sort();
        entry.notices.dedup();
        entry
    }

    /// Re-read the selected artifact and require the whole checkpoint identity/hash to match.
    /// Returns raw bytes only, never a persistence receipt or permission to adopt a source.
    pub fn preview(&self, selection: &RecoverySelection) -> Result<RecoveryPreview, DocumentError> {
        self.verify()?;
        let result = Self::preview_at(&self.recovery, selection)?;
        self.verify()?;
        Ok(result)
    }

    pub(super) fn preview_at(
        dir: &File,
        selection: &RecoverySelection,
    ) -> Result<RecoveryPreview, DocumentError> {
        if !valid_uuid(&selection.document_id)
            || selection.record_sha256.len() != 64
            || !selection
                .record_sha256
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        {
            return Err(error(ErrorCode::InvalidCheckpoint));
        }
        let journal = recovery_store::read(dir, &selection.document_id, selection.origin.suffix())?
            .ok_or_else(|| error(ErrorCode::RecoveryNeedsAttention))?;
        for checkpoint in journal.checkpoints {
            let candidate = candidate(&checkpoint, selection.origin.clone())?;
            if candidate.selection == *selection {
                return Ok(RecoveryPreview {
                    candidate,
                    metadata: checkpoint.metadata,
                    source: checkpoint.source,
                });
            }
        }
        Err(error(ErrorCode::RecoveryNeedsAttention))
    }
}

impl DocumentService {
    pub fn list_document_recovery(
        &self,
        identity: &DocumentRequest,
    ) -> Result<RecoveryEntry, DocumentError> {
        self.registered(identity)?;
        let dir = match self.recovery_directory(Some(identity), false) {
            Ok(dir) => dir,
            Err(err) if err.code == ErrorCode::MissingSource => {
                return Ok(RecoveryEntry {
                    document_id: identity.document_id.clone(),
                    candidates: Vec::new(),
                    notices: Vec::new(),
                    error: None,
                });
            }
            Err(err) => return Err(err),
        };
        let result = LocalRecoveryReader::entry_at(&dir, &identity.document_id);
        self.recovery_directory(Some(identity), false)?;
        Ok(result)
    }

    pub fn read_document_recovery(
        &self,
        request: &SelectedRecoveryRequest,
    ) -> Result<RecoveryPreview, DocumentError> {
        self.registered(&request.identity)?;
        if request.selection.document_id != request.identity.document_id {
            return Err(error(ErrorCode::IdentityMismatch));
        }
        let dir = self.recovery_directory(Some(&request.identity), false)?;
        let result = LocalRecoveryReader::preview_at(&dir, &request.selection)?;
        self.recovery_directory(Some(&request.identity), false)?;
        Ok(result)
    }

    /// Explicitly resume full revalidated bytes under a fresh unsaved identity.
    /// The selected original is never modified or removed.
    pub fn resume_local_recovery(
        &mut self,
        selection: &RecoverySelection,
    ) -> Result<ResumedDraft, DocumentError> {
        let preview = LocalRecoveryReader::open(&self.store_path)?
            .ok_or_else(|| error(ErrorCode::RecoveryNeedsAttention))?
            .preview(selection)?;
        let mut document = self.register_unsaved()?;
        if let Err(err) = self.checkpoint(
            &document.identity,
            1,
            &preview.source,
            &preview.metadata.source_sha256,
            preview.metadata.draft_metadata.clone(),
        ) {
            self.release_at_risk(&document.identity)?;
            return Err(err);
        }
        document.source = preview.source;
        if std::str::from_utf8(&document.source).is_err() {
            document.encoding = SourceEncoding::Unsupported;
            document.ownership = Ownership::ViewOnly {
                reasons: vec![ViewReason::UnsupportedEncoding],
            };
        }
        self.documents
            .get_mut(&document.identity.handle)
            .ok_or_else(|| error(ErrorCode::InvalidHandle))?
            .initial = document.clone();
        Ok(ResumedDraft {
            document,
            draft_metadata: preview.metadata.draft_metadata,
        })
    }
}

fn candidate(
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
