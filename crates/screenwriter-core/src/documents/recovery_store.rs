//! Linux journal publication. All names derive from validated native document UUIDs.
use super::*;
use crate::documents::recovery::*;

#[derive(Debug, Clone, Default)]
pub struct RecoveryInspection {
    pub current: Option<JournalRead>,
    pub previous: Option<JournalRead>,
    pub pending: Option<JournalRead>,
    pub previous_pending: Option<JournalRead>,
    pub quarantined: bool,
    /// Latest valid published generation, not proof that a receipt reached the editor.
    pub latest: Option<Checkpoint>,
}

fn name(id: &str, suffix: &str) -> String {
    format!("{id}.{suffix}")
}

fn same_generation(a: &Stat, b: &Stat) -> bool {
    // Both comparisons concern the same captured byte buffer; rehashing that buffer
    // cannot detect an external change. Compare all relevant native stat fields.
    (
        a.st_dev,
        a.st_ino,
        a.st_size,
        a.st_mtime,
        a.st_mtime_nsec,
        a.st_ctime,
        a.st_ctime_nsec,
        a.st_mode,
        a.st_uid,
        a.st_nlink,
    ) == (
        b.st_dev,
        b.st_ino,
        b.st_size,
        b.st_mtime,
        b.st_mtime_nsec,
        b.st_ctime,
        b.st_ctime_nsec,
        b.st_mode,
        b.st_uid,
        b.st_nlink,
    )
}

pub(super) fn read_bytes(dir: &File, name: &str) -> Result<Option<Vec<u8>>, DocumentError> {
    let mut file = match read_file(dir, OsStr::new(name)) {
        Ok(file) => file,
        Err(err) if err.code == ErrorCode::MissingSource => return Ok(None),
        Err(err) => return Err(err),
    };
    let before = stat(&file)?;
    if !private_file(&before) {
        return Err(error(ErrorCode::OwnershipLost));
    }
    let mut bytes = Vec::new();
    (&mut file)
        .take(MAX_JOURNAL_BYTES as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(io_error)?;
    let after = stat(&file)?;
    if !same_generation(&before, &after) {
        return Err(error(ErrorCode::SourceChanged));
    }
    let current = stat(&read_file(dir, OsStr::new(name))?)?;
    if !same_generation(&before, &current) {
        return Err(error(ErrorCode::SourceChanged));
    }
    Ok(Some(bytes))
}

pub(super) fn read(
    dir: &File,
    id: &str,
    suffix: &str,
) -> Result<Option<JournalRead>, DocumentError> {
    let value = read_bytes(dir, &name(id, suffix))?.map(|bytes| decode_journal(&bytes));
    if value
        .as_ref()
        .is_some_and(|r| r.checkpoints.iter().any(|c| c.metadata.document_id != id))
    {
        return Err(error(ErrorCode::CheckpointConflict));
    }
    Ok(value)
}

pub(super) fn inspect(dir: &File, id: &str) -> Result<RecoveryInspection, DocumentError> {
    let current = read(dir, id, "journal")?;
    let previous = read(dir, id, "previous")?;
    let mut generations = std::collections::BTreeMap::new();
    for journal in [&current, &previous].into_iter().flatten() {
        for checkpoint in &journal.checkpoints {
            if let Some(old) =
                generations.insert(checkpoint.metadata.generation, checkpoint.clone())
                && old != *checkpoint
            {
                return Err(error(ErrorCode::CheckpointConflict));
            }
        }
    }
    Ok(RecoveryInspection {
        current,
        previous,
        latest: generations.into_values().next_back(),
        pending: read(dir, id, "pending")?,
        previous_pending: read(dir, id, "previous-pending")?,
        quarantined: read_bytes(dir, &name(id, "quarantine"))?.is_some(),
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Stage {
    BeforeWrite,
    PartialWrite,
    BeforeSync,
    CandidateSynced,
    BeforePreviousWrite,
    PreviousPartialWrite,
    BeforePreviousSync,
    PreviousSynced,
    BeforePreviousPublish,
    PreviousPublished,
    BeforePublish,
    Published,
    BeforeDirectorySync,
    DirectorySynced,
    Verified,
}

pub(super) struct DraftSnapshot<'a> {
    pub version: u64,
    pub source: &'a [u8],
    pub draft_metadata: serde_json::Value,
    pub base_fingerprint: Option<DiskFingerprint>,
}

fn write_new(
    dir: &File,
    name: &str,
    bytes: &[u8],
    mut gate: impl FnMut(Stage) -> Result<(), DocumentError>,
) -> Result<(), DocumentError> {
    gate(Stage::BeforeWrite)?;
    let mut file = File::from(
        fs::openat(
            dir,
            name,
            OFlags::WRONLY | OFlags::CREATE | OFlags::EXCL | OFlags::NOFOLLOW | OFlags::CLOEXEC,
            Mode::from_raw_mode(0o600),
        )
        .map_err(|err| {
            if err == Errno::EXIST {
                error(ErrorCode::RecoveryNeedsAttention)
            } else {
                syscall_error(err)
            }
        })?,
    );
    let mid = bytes.len() / 2;
    file.write_all(&bytes[..mid]).map_err(io_error)?;
    gate(Stage::PartialWrite)?;
    file.write_all(&bytes[mid..]).map_err(io_error)?;
    gate(Stage::BeforeSync)?;
    file.sync_all().map_err(io_error)?;
    if read_bytes(dir, name)?.as_deref() != Some(bytes) {
        return Err(error(ErrorCode::Io));
    }
    gate(Stage::CandidateSynced)?;
    Ok(())
}

fn publish(dir: &File, from: &str, to: &str) -> Result<(), DocumentError> {
    // Validate destination if present; never replace a symlink/unsafe file or directory.
    let _ = read_bytes(dir, to)?;
    fs::renameat(dir, from, dir, to).map_err(syscall_error)
}

pub(super) fn checkpoint(
    dir: &File,
    request: &DocumentRequest,
    snapshot: DraftSnapshot<'_>,
    mut ownership: impl FnMut() -> Result<(), DocumentError>,
    mut gate: impl FnMut(Stage) -> Result<(), DocumentError>,
) -> Result<CheckpointReceipt, DocumentError> {
    let DraftSnapshot {
        version,
        source,
        draft_metadata,
        base_fingerprint,
    } = snapshot;
    ownership()?;
    let id = &request.document_id;
    let state = inspect(dir, id)?;
    if state.pending.is_some()
        || state.previous_pending.is_some()
        || [&state.current, &state.previous]
            .into_iter()
            .flatten()
            .any(|r| matches!(r.tail, TailStatus::UnsupportedSchema | TailStatus::TooLarge))
    {
        return Err(error(ErrorCode::RecoveryNeedsAttention));
    }
    if let Some(last) = &state.latest {
        if last.metadata.session_id != request.session_id {
            return Err(error(ErrorCode::RecoveryNeedsAttention));
        }
        if version < last.metadata.version {
            return Err(error(ErrorCode::StaleRecoveryVersion));
        }
        if version == last.metadata.version {
            if last.source != source
                || last.metadata.draft_metadata != draft_metadata
                || last.metadata.base_fingerprint != base_fingerprint
            {
                return Err(error(ErrorCode::CheckpointConflict));
            }
            if [&state.current, &state.previous]
                .into_iter()
                .flatten()
                .any(|r| r.tail != TailStatus::Clean)
            {
                return Err(error(ErrorCode::RecoveryNeedsAttention));
            }
            // A retry must perform fresh sync/verification, even if the prior call failed after rename.
            for suffix in ["journal", "previous"] {
                if read_bytes(dir, &name(id, suffix))?.is_some() {
                    let file = read_file(dir, OsStr::new(&name(id, suffix)))?;
                    file.sync_all().map_err(io_error)?;
                }
            }
            dir.sync_all().map_err(io_error)?;
            ownership()?;
            if inspect(dir, id)?.latest.as_ref() != Some(last) {
                return Err(error(ErrorCode::Io));
            }
            return Ok(receipt(request, last));
        }
    }
    let generation = state
        .latest
        .as_ref()
        .map_or(1, |last| last.metadata.generation + 1);
    let mut next = Checkpoint::capture(request, version, generation, source, draft_metadata)?;
    next.metadata.base_fingerprint = base_fingerprint;
    let encoded = next.encode()?;
    let mut candidate = Vec::new();
    if let Some(last) = &state.latest {
        candidate.extend_from_slice(&last.encode()?);
    }
    candidate.extend_from_slice(&encoded);
    // Preserve corrupt/torn bytes before publishing a repaired journal. A second unresolved
    // corruption blocks; never overwrite an existing quarantine to make space.
    let damaged: Vec<_> = [("journal", &state.current), ("previous", &state.previous)]
        .into_iter()
        .filter(|(_, r)| r.as_ref().is_some_and(|r| r.tail != TailStatus::Clean))
        .collect();
    if !damaged.is_empty() {
        if damaged.len() != 1 || state.quarantined {
            return Err(error(ErrorCode::RecoveryNeedsAttention));
        }
        let bytes =
            read_bytes(dir, &name(id, damaged[0].0))?.ok_or_else(|| error(ErrorCode::Io))?;
        write_new(dir, &name(id, "quarantine"), &bytes, |_| Ok(()))?;
        dir.sync_all().map_err(io_error)?;
    }
    ownership()?;
    write_new(dir, &name(id, "pending"), &candidate, &mut gate)?;
    ownership()?;
    if let Some(last) = &state.latest {
        // Retain an independently verified predecessor before replacing the active journal.
        let previous = last.encode()?;
        write_new(dir, &name(id, "previous-pending"), &previous, |stage| {
            gate(match stage {
                Stage::BeforeWrite => Stage::BeforePreviousWrite,
                Stage::PartialWrite => Stage::PreviousPartialWrite,
                Stage::BeforeSync => Stage::BeforePreviousSync,
                Stage::CandidateSynced => Stage::PreviousSynced,
                other => other,
            })
        })?;
        ownership()?;
        gate(Stage::BeforePreviousPublish)?;
        publish(dir, &name(id, "previous-pending"), &name(id, "previous"))?;
        dir.sync_all().map_err(io_error)?;
        if read_bytes(dir, &name(id, "previous"))?.as_deref() != Some(&previous) {
            return Err(error(ErrorCode::Io));
        }
    }
    gate(Stage::PreviousPublished)?;
    ownership()?;
    gate(Stage::BeforePublish)?;
    publish(dir, &name(id, "pending"), &name(id, "journal"))?;
    gate(Stage::Published)?;
    gate(Stage::BeforeDirectorySync)?;
    dir.sync_all().map_err(io_error)?;
    gate(Stage::DirectorySynced)?;
    ownership()?;
    if read_bytes(dir, &name(id, "journal"))?.as_deref() != Some(&candidate) {
        return Err(error(ErrorCode::Io));
    }
    gate(Stage::Verified)?;
    Ok(receipt(request, &next))
}

fn receipt(request: &DocumentRequest, checkpoint: &Checkpoint) -> CheckpointReceipt {
    CheckpointReceipt {
        identity: request.clone(),
        version: checkpoint.metadata.version,
        source_sha256: checkpoint.metadata.source_sha256.clone(),
        generation: checkpoint.metadata.generation,
        protection: CheckpointProtection::RecoveryCheckpoint,
    }
}

#[cfg(test)]
#[path = "recovery_store_tests.rs"]
mod tests;
