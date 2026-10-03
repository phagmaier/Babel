#![cfg(target_os = "linux")]
use screenwriter_core::documents::{recovery::*, *};
use std::{
    fs,
    os::unix::fs::{PermissionsExt, symlink},
    path::PathBuf,
};
use uuid::Uuid;

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let base = std::env::var_os("BABEL_RECOVERY_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let root = base.join(format!("babel-recovery-api-{}", Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        fs::set_permissions(&root, fs::Permissions::from_mode(0o700)).unwrap();
        Self(root)
    }
    fn service(&self) -> DocumentService {
        DocumentService::new(&self.0.join("app-data")).unwrap()
    }
    fn source(&self) -> PathBuf {
        let path = self.0.join("source.fountain");
        fs::write(&path, b"original\r\n").unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
        path
    }
    fn journal(&self, id: &str) -> PathBuf {
        self.0
            .join("app-data/recovery")
            .join(format!("{id}.journal"))
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).unwrap();
    }
}

fn save(
    service: &mut DocumentService,
    id: &DocumentRequest,
    version: u64,
    source: &[u8],
) -> CheckpointReceipt {
    service
        .checkpoint(
            id,
            version,
            source,
            &source_hash(source),
            serde_json::json!({"emptyBlock":"character","caret":version}),
        )
        .unwrap()
}

#[test]
fn named_checkpoint_receipt_is_exact_and_source_file_is_untouched() {
    let f = Fixture::new();
    let path = f.source();
    let mut service = f.service();
    let opened = service.open_selected(&path).unwrap();
    let source = b"\xef\xbb\xbf@\r\n  \xff[[unfinished";
    let receipt = save(&mut service, &opened.identity, 21, source);
    assert_eq!(receipt.identity, opened.identity);
    assert_eq!(receipt.version, 21);
    assert_eq!(receipt.source_sha256, source_hash(source));
    assert_eq!(receipt.protection, CheckpointProtection::RecoveryCheckpoint);
    assert_eq!(fs::read(&path).unwrap(), b"original\r\n");
    assert_eq!(service.read_initial(&opened.identity).unwrap(), opened);
    let restored = service
        .inspect_recovery(&opened.identity)
        .unwrap()
        .latest
        .unwrap();
    assert_eq!(restored.source, source);
    assert_eq!(restored.metadata.base_fingerprint, opened.fingerprint);
    assert_eq!(
        restored.metadata.draft_metadata,
        serde_json::json!({"emptyBlock":"character","caret":21})
    );
    assert_eq!(
        fs::metadata(f.journal(&opened.identity.document_id))
            .unwrap()
            .permissions()
            .mode()
            & 0o7777,
        0o600
    );
}

#[test]
fn managed_recovery_uses_project_auxiliary_folder_and_preserves_metadata() {
    let f = Fixture::new();
    let path = f.source();
    fs::create_dir(f.0.join(".screenwriter")).unwrap();
    fs::set_permissions(f.0.join(".screenwriter"), fs::Permissions::from_mode(0o700)).unwrap();
    let metadata = serde_json::to_vec(&serde_json::json!({"schemaVersion":1,"projectId":Uuid::new_v4().to_string(),"sourceFilename":"source.fountain","pdfProfile":"default"})).unwrap();
    fs::write(f.0.join(".screenwriter/project.json"), &metadata).unwrap();
    let mut service = f.service();
    let opened = service.open_selected(&path).unwrap();
    save(&mut service, &opened.identity, 1, b"raw changed source");
    drop(service);
    let mut restarted = f.service();
    let next = restarted.open_selected(&path).unwrap();
    assert_eq!(
        restarted
            .inspect_recovery(&next.identity)
            .unwrap()
            .latest
            .unwrap()
            .source,
        b"raw changed source"
    );
    assert!(
        f.0.join(".screenwriter/recovery")
            .join(format!("{}.journal", opened.identity.document_id))
            .exists()
    );
    assert_eq!(
        fs::read(f.0.join(".screenwriter/project.json")).unwrap(),
        metadata
    );
    assert!(!f.0.join("app-data/recovery").exists());
}

#[test]
fn duplicate_retry_is_idempotent_and_stale_or_conflicting_versions_are_rejected() {
    let f = Fixture::new();
    let mut service = f.service();
    let draft = service.register_unsaved().unwrap();
    let first = save(&mut service, &draft.identity, 21, b"first");
    assert_eq!(save(&mut service, &draft.identity, 21, b"first"), first);
    save(&mut service, &draft.identity, 22, b"second");
    assert_eq!(
        service
            .checkpoint(
                &draft.identity,
                21,
                b"first",
                &source_hash(b"first"),
                serde_json::Value::Null
            )
            .unwrap_err()
            .code,
        ErrorCode::StaleRecoveryVersion
    );
    assert_eq!(
        service
            .checkpoint(
                &draft.identity,
                22,
                b"different",
                &source_hash(b"different"),
                serde_json::Value::Null
            )
            .unwrap_err()
            .code,
        ErrorCode::CheckpointConflict
    );
}

#[test]
fn cross_session_and_declared_hash_failures_never_replace_recovery() {
    let f = Fixture::new();
    let path = f.source();
    let mut service = f.service();
    let opened = service.open_selected(&path).unwrap();
    save(&mut service, &opened.identity, 21, b"first");
    let before = fs::read(f.journal(&opened.identity.document_id)).unwrap();
    assert_eq!(
        service
            .checkpoint(
                &opened.identity,
                22,
                b"second",
                "claimed hash",
                serde_json::Value::Null
            )
            .unwrap_err()
            .code,
        ErrorCode::InvalidCheckpoint
    );
    let mut wrong = opened.identity.clone();
    wrong.session_id = Uuid::new_v4().to_string();
    assert_eq!(
        service
            .checkpoint(
                &wrong,
                22,
                b"second",
                &source_hash(b"second"),
                serde_json::Value::Null
            )
            .unwrap_err()
            .code,
        ErrorCode::IdentityMismatch
    );
    drop(service);
    let mut restarted = f.service();
    let next = restarted.open_selected(&path).unwrap();
    assert_eq!(
        restarted
            .checkpoint(
                &next.identity,
                1,
                b"new session",
                &source_hash(b"new session"),
                serde_json::Value::Null
            )
            .unwrap_err()
            .code,
        ErrorCode::RecoveryNeedsAttention
    );
    assert_eq!(
        fs::read(f.journal(&opened.identity.document_id)).unwrap(),
        before
    );
}

#[test]
fn truncated_and_corrupt_tail_preserve_predecessor_and_quarantine_before_continuing() {
    for corrupt in [false, true] {
        let f = Fixture::new();
        let mut service = f.service();
        let draft = service.register_unsaved().unwrap();
        save(&mut service, &draft.identity, 1, b"first");
        save(&mut service, &draft.identity, 2, b"second");
        let path = f.journal(&draft.identity.document_id);
        let mut damaged = fs::read(&path).unwrap();
        if corrupt {
            let last = damaged.len() - 1;
            damaged[last] ^= 1;
        } else {
            damaged.truncate(damaged.len() - 10);
        }
        fs::write(&path, &damaged).unwrap();
        let recovered = service.inspect_recovery(&draft.identity).unwrap();
        assert_eq!(recovered.latest.unwrap().metadata.version, 1);
        assert_eq!(
            recovered.current.unwrap().tail,
            if corrupt {
                TailStatus::Corrupt
            } else {
                TailStatus::Truncated
            }
        );
        save(&mut service, &draft.identity, 3, b"third");
        let quarantine = path.with_extension("quarantine");
        assert_eq!(fs::read(quarantine).unwrap(), damaged);
        assert_eq!(
            service
                .inspect_recovery(&draft.identity)
                .unwrap()
                .latest
                .unwrap()
                .metadata
                .version,
            3
        );
        assert_eq!(
            service
                .inspect_recovery(&draft.identity)
                .unwrap()
                .current
                .unwrap()
                .checkpoints
                .len(),
            2
        );
        let mut bytes = fs::read(&path).unwrap();
        bytes.pop();
        fs::write(&path, &bytes).unwrap();
        assert_eq!(
            service
                .checkpoint(
                    &draft.identity,
                    4,
                    b"fourth",
                    &source_hash(b"fourth"),
                    serde_json::Value::Null
                )
                .unwrap_err()
                .code,
            ErrorCode::RecoveryNeedsAttention
        );
        assert_eq!(fs::read(path).unwrap(), bytes);
    }
}

#[test]
fn damaged_first_frame_falls_back_to_independent_previous_generation() {
    let f = Fixture::new();
    let mut service = f.service();
    let draft = service.register_unsaved().unwrap();
    save(&mut service, &draft.identity, 1, b"first");
    save(&mut service, &draft.identity, 2, b"second");
    let path = f.journal(&draft.identity.document_id);
    let mut bytes = fs::read(&path).unwrap();
    bytes[0] ^= 1;
    fs::write(&path, &bytes).unwrap();
    assert_eq!(
        service
            .inspect_recovery(&draft.identity)
            .unwrap()
            .latest
            .unwrap()
            .source,
        b"first"
    );
}

#[test]
fn external_edit_or_deleted_source_does_not_block_raw_recovery() {
    let f = Fixture::new();
    let path = f.source();
    let mut service = f.service();
    let opened = service.open_selected(&path).unwrap();
    fs::write(&path, b"external").unwrap();
    assert!(service.validate_owner(&opened.identity).is_err());
    save(&mut service, &opened.identity, 1, b"local unsaved draft");
    assert_eq!(fs::read(&path).unwrap(), b"external");
    fs::remove_file(&path).unwrap();
    save(&mut service, &opened.identity, 2, b"more local work");
    assert_eq!(
        service
            .inspect_recovery(&opened.identity)
            .unwrap()
            .latest
            .unwrap()
            .source,
        b"more local work"
    );
}

#[test]
fn unsafe_recovery_paths_and_released_handles_do_not_gain_write_authority() {
    let f = Fixture::new();
    let mut service = f.service();
    let draft = service.register_unsaved().unwrap();
    let outside = f.0.join("outside");
    fs::create_dir(&outside).unwrap();
    symlink(&outside, f.0.join("app-data/recovery")).unwrap();
    assert!(
        service
            .checkpoint(
                &draft.identity,
                1,
                b"raw",
                &source_hash(b"raw"),
                serde_json::Value::Null
            )
            .is_err()
    );
    assert!(fs::read_dir(&outside).unwrap().next().is_none());
    fs::remove_file(f.0.join("app-data/recovery")).unwrap();
    service.release(&draft.identity).unwrap();
    assert_eq!(
        service
            .checkpoint(
                &draft.identity,
                1,
                b"raw",
                &source_hash(b"raw"),
                serde_json::Value::Null
            )
            .unwrap_err()
            .code,
        ErrorCode::InvalidHandle
    );
}

#[test]
fn unknown_schema_and_oversized_tail_retain_known_prefix_without_overwrite() {
    for future in [false, true] {
        let f = Fixture::new();
        let mut service = f.service();
        let draft = service.register_unsaved().unwrap();
        save(&mut service, &draft.identity, 1, b"first");
        save(&mut service, &draft.identity, 2, b"second");
        let path = f.journal(&draft.identity.document_id);
        let mut bytes = fs::read(&path).unwrap();
        let first_len = decode_journal(&bytes).checkpoints[0]
            .encode()
            .unwrap()
            .len();
        if future {
            bytes[first_len + 8..first_len + 12].copy_from_slice(&2u32.to_le_bytes());
        } else {
            bytes[first_len + 16..first_len + 24].copy_from_slice(&u64::MAX.to_le_bytes());
        }
        fs::write(&path, &bytes).unwrap();
        assert_eq!(
            service
                .inspect_recovery(&draft.identity)
                .unwrap()
                .latest
                .unwrap()
                .source,
            b"first"
        );
        assert_eq!(
            service
                .checkpoint(
                    &draft.identity,
                    3,
                    b"third",
                    &source_hash(b"third"),
                    serde_json::Value::Null
                )
                .unwrap_err()
                .code,
            ErrorCode::RecoveryNeedsAttention
        );
        assert_eq!(fs::read(path).unwrap(), bytes);
    }
}

#[test]
fn physically_oversized_journal_is_not_quarantined_as_a_truncated_copy() {
    let f = Fixture::new();
    let mut service = f.service();
    let draft = service.register_unsaved().unwrap();
    save(&mut service, &draft.identity, 1, b"first");
    save(&mut service, &draft.identity, 2, b"second");
    let path = f.journal(&draft.identity.document_id);
    fs::OpenOptions::new()
        .write(true)
        .open(&path)
        .unwrap()
        .set_len(MAX_JOURNAL_BYTES as u64 + 9)
        .unwrap();
    let inspection = service.inspect_recovery(&draft.identity).unwrap();
    assert_eq!(inspection.current.unwrap().tail, TailStatus::TooLarge);
    assert_eq!(inspection.latest.unwrap().source, b"second");
    assert_eq!(
        service
            .checkpoint(
                &draft.identity,
                3,
                b"third",
                &source_hash(b"third"),
                serde_json::Value::Null
            )
            .unwrap_err()
            .code,
        ErrorCode::RecoveryNeedsAttention
    );
    assert_eq!(
        fs::metadata(&path).unwrap().len(),
        MAX_JOURNAL_BYTES as u64 + 9
    );
    assert!(!path.with_extension("quarantine").exists());
}

#[test]
fn large_stress_fixture_has_bounded_growth_and_measured_checkpoint_latency() {
    // Exact M1-02 600-workload algorithm; this is a workload label, not PDF pagination.
    let mut paragraphs = Vec::new();
    for page in 0..600 {
        for block in 0..20 {
            let index = page * 20 + block;
            let line = if block % 10 == 0 {
                format!("INT. SYNTHETIC ROOM {} - DAY", page + 1)
            } else if block % 10 == 4 {
                format!("MARA {index}")
            } else if block % 10 == 5 || block % 10 == 6 {
                format!("A quiet line of dialogue {index}. The signal stays local.")
            } else if block % 10 == 8 {
                format!("The long synthetic paragraph {index} holds a lantern, a timetable, and a string of ordinary words repeated for wrapping. ").repeat(3)
            } else {
                format!(
                    "Action {index}: rain crosses the empty platform while a distant light moves behind the windows."
                )
            };
            paragraphs.push(line);
        }
    }
    let mut source = paragraphs.join("\n").into_bytes();
    assert_eq!(source.len(), 1_164_762);
    assert_eq!(
        source_hash(&source),
        "9448e9b2ef9129245463a5c23b9a835004d43a66b3fd2b0ca3ac0e84f36336c8"
    );
    let f = Fixture::new();
    let mut service = f.service();
    let draft = service.register_unsaved().unwrap();
    let mut peak = 0;
    let mut timings = Vec::new();
    for version in 1..=32 {
        source[0] = if version % 2 == 0 { b'I' } else { b'E' };
        let start = std::time::Instant::now();
        save(&mut service, &draft.identity, version, &source);
        timings.push(start.elapsed().as_micros());
        let bytes: u64 = fs::read_dir(f.0.join("app-data/recovery"))
            .unwrap()
            .map(|p| fs::metadata(p.unwrap().path()).unwrap().len())
            .sum();
        peak = peak.max(bytes);
        assert!(
            bytes
                <= 3 * (source.len() + MAX_DRAFT_METADATA_BYTES + HEADER_BYTES + CHECKSUM_BYTES)
                    as u64
        );
    }
    let state = service.inspect_recovery(&draft.identity).unwrap();
    assert_eq!(state.current.unwrap().checkpoints.len(), 2);
    assert_eq!(state.previous.unwrap().checkpoints.len(), 1);
    timings.sort_unstable();
    println!(
        "RECOVERY_STRESS bytes={} checkpoints=32 peak_journal_bytes={peak} p50_us={} max_us={}",
        source.len(),
        timings[16],
        timings[31]
    );
}
