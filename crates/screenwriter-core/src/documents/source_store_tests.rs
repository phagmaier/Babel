use super::*;
use std::io::{BufRead, BufReader};
use std::os::unix::fs::{MetadataExt, PermissionsExt, symlink};
use std::process::{Command, Stdio};

const ORIGINAL: &[u8] = b"\xef\xbb\xbforiginal\r\n  \r\n";
const OLD: &[u8] = b"old successful source\r\n  ";
const NEW: &[u8] = b"[[unfinished\r\n@\r\n  \r\n";

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let base = std::env::var_os("BABEL_SAVE_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let root = base.join(format!("babel-source-save-{}", uuid()));
        std::fs::create_dir(&root).unwrap();
        std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o700)).unwrap();
        std::fs::write(root.join("source.fountain"), ORIGINAL).unwrap();
        std::fs::set_permissions(
            root.join("source.fountain"),
            std::fs::Permissions::from_mode(0o640),
        )
        .unwrap();
        Self(root)
    }
    fn open(&self) -> (DocumentService, OpenDocument) {
        let mut service = DocumentService::new(&self.0.join("app-data")).unwrap();
        let opened = service
            .open_selected(&self.0.join("source.fountain"))
            .unwrap();
        assert_eq!(opened.ownership, Ownership::Exclusive);
        (service, opened)
    }
    fn artifacts(&self, id: &str) -> PathBuf {
        self.0.join("app-data/source-save").join(id)
    }
    fn bytes(&self) -> Vec<u8> {
        std::fs::read(self.0.join("source.fountain")).unwrap()
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        std::fs::remove_dir_all(&self.0).unwrap();
    }
}
fn request(
    service: &DocumentService,
    id: &DocumentRequest,
    version: u64,
    source: &[u8],
) -> SaveRequest {
    SaveRequest {
        identity: id.clone(),
        version,
        source: source.to_vec(),
        source_sha256: source_hash(source),
        expected_fingerprint: service.registered(id).unwrap().baseline.clone().unwrap(),
        draft_metadata: serde_json::json!({"unfinished":"character", "version":version}),
    }
}
fn enqueue(service: &mut DocumentService, id: &DocumentRequest, version: u64, source: &[u8]) {
    service
        .enqueue_save(request(service, id, version, source))
        .unwrap();
}
fn save(
    service: &mut DocumentService,
    id: &DocumentRequest,
    version: u64,
    source: &[u8],
) -> SaveReceipt {
    enqueue(service, id, version, source);
    service.save_next(id).unwrap().unwrap()
}

#[test]
fn fifo_advances_baseline_and_inode_lease_without_mutating_initial_source() {
    let f = Fixture::new();
    let (mut service, opened) = f.open();
    let id = &opened.identity;
    let initial_group = std::fs::metadata(f.0.join("source.fountain"))
        .unwrap()
        .gid();
    enqueue(&mut service, id, 21, OLD);
    enqueue(&mut service, id, 22, NEW); // both admitted against the original native baseline
    assert_eq!(f.bytes(), ORIGINAL);
    assert!(service.inspect_recovery(id).unwrap().latest.is_none());
    let first = service.save_next(id).unwrap().unwrap();
    assert_eq!(first.version, 21);
    assert_eq!(f.bytes(), OLD);
    assert_eq!(first.protection, SaveProtection::SourceFile);
    service.validate_owner(id).unwrap();
    let mut peer = DocumentService::new(&f.0.join("app-data")).unwrap();
    assert!(
        matches!(peer.open_selected(&f.0.join("source.fountain")).unwrap().ownership, Ownership::ViewOnly { reasons } if reasons.contains(&ViewReason::AlreadyOwned))
    );
    let captured = opened.fingerprint.as_ref().unwrap();
    let old_lease = peer
        .lease(&format!("source:{}:{}", captured.device, captured.inode))
        .unwrap();
    drop(old_lease);
    assert!(
        peer.lease(&format!(
            "source:{}:{}",
            first.fingerprint.device, first.fingerprint.inode
        ))
        .is_err()
    );
    let second = service.save_next(id).unwrap().unwrap();
    assert_eq!(second.version, 22);
    assert_eq!(f.bytes(), NEW);
    assert_eq!(second.source_sha256, source_hash(NEW));
    assert_ne!(second.fingerprint.inode, first.fingerprint.inode);
    assert_eq!(second.fingerprint.mode & 0o7777, 0o640);
    assert_eq!(
        second.fingerprint.owner,
        opened.fingerprint.as_ref().unwrap().owner
    );
    assert_eq!(
        std::fs::metadata(f.0.join("source.fountain"))
            .unwrap()
            .gid(),
        initial_group
    );
    assert_eq!(service.read_initial(id).unwrap(), opened);
    service.validate_owner(id).unwrap();
    let recovered = service.inspect_recovery(id).unwrap();
    assert_eq!(
        recovered.latest.unwrap().metadata.base_fingerprint,
        Some(first.fingerprint)
    );
    let state = service.inspect_source_save(id).unwrap();
    assert_eq!(
        state.observation,
        SaveObservation::ConfirmedRecordMatchesSource
    );
    assert_eq!(state.previous.unwrap(), OLD);
    assert!(
        state.intent.is_none() && state.candidate.is_none() && state.previous_pending.is_none()
    );
    assert!(service.save_next(id).unwrap().is_none());
    // Independent copy survives an uncooperative in-place source mutation.
    std::fs::write(f.0.join("source.fountain"), b"external edit").unwrap();
    assert_eq!(
        std::fs::read(f.artifacts(&id.document_id).join("previous")).unwrap(),
        OLD
    );
    assert_eq!(
        service.validate_owner(id).unwrap_err().code,
        ErrorCode::SourceChanged
    );
}

#[test]
fn exact_duplicate_freshly_verifies_without_replacement_and_conflicts_are_rejected() {
    let f = Fixture::new();
    let (mut service, opened) = f.open();
    let id = &opened.identity;
    let first = save(&mut service, id, 21, NEW);
    let duplicate = save(&mut service, id, 21, NEW);
    assert_eq!(first, duplicate);
    assert_eq!(
        service
            .enqueue_save(request(&service, id, 20, OLD))
            .unwrap_err()
            .code,
        ErrorCode::StaleSaveVersion
    );
    assert_eq!(
        service
            .enqueue_save(request(&service, id, 21, OLD))
            .unwrap_err()
            .code,
        ErrorCode::SaveConflict
    );
    let mut conflicting = request(&service, id, 21, NEW);
    conflicting.draft_metadata = serde_json::Value::Null;
    assert_eq!(
        service.enqueue_save(conflicting).unwrap_err().code,
        ErrorCode::SaveConflict
    );
    std::fs::write(f.0.join("source.fountain"), b"external").unwrap();
    enqueue(&mut service, id, 21, NEW);
    let failed = service.save_next(id).unwrap_err();
    assert_eq!(failed.error.code, ErrorCode::SourceChanged);
    assert_eq!(failed.replacement, ReplacementState::SourceUnchanged);
    assert_eq!(f.bytes(), b"external");
}

#[test]
fn fault_matrix_preserves_whole_generations_recovery_and_truthful_failure() {
    for failed in [
        Stage::RecoveryProtected,
        Stage::BeforeIntentWrite,
        Stage::IntentPartialWrite,
        Stage::IntentBeforeSync,
        Stage::IntentSynced,
        Stage::BeforePreviousWrite,
        Stage::PreviousPartialWrite,
        Stage::PreviousBeforeSync,
        Stage::PreviousSynced,
        Stage::PreviousPublished,
        Stage::BeforeCandidateWrite,
        Stage::CandidatePartialWrite,
        Stage::CandidateBeforeSync,
        Stage::CandidateSynced,
        Stage::BeforeReplace,
        Stage::Replaced,
        Stage::BeforeDirectorySync,
        Stage::DirectorySynced,
        Stage::Verified,
        Stage::Confirmed,
    ] {
        let f = Fixture::new();
        let (mut service, opened) = f.open();
        let id = &opened.identity;
        save(&mut service, id, 20, OLD);
        enqueue(&mut service, id, 21, NEW);
        let result = service.save_next_with(id, |stage| {
            if stage == failed {
                Err(error(ErrorCode::Io))
            } else {
                Ok(())
            }
        });
        let failure = result.unwrap_err();
        assert_eq!(failure.version, 21, "{failed:?}");
        assert_eq!(failure.recovery.unwrap().version, 21);
        let after_replace = matches!(
            failed,
            Stage::Replaced
                | Stage::BeforeDirectorySync
                | Stage::DirectorySynced
                | Stage::Verified
                | Stage::Confirmed
        );
        assert_eq!(
            failure.replacement,
            if after_replace {
                ReplacementState::ReplacedButUnconfirmed
            } else {
                ReplacementState::SourceUnchanged
            },
            "{failed:?}"
        );
        assert_eq!(f.bytes(), if after_replace { NEW } else { OLD });
        let state = service.inspect_source_save(id).unwrap();
        if after_replace {
            assert_eq!(state.previous.as_deref(), Some(OLD), "{failed:?}");
        }
        assert_eq!(
            service.inspect_recovery(id).unwrap().latest.unwrap().source,
            NEW
        );
        if failed == Stage::IntentPartialWrite {
            assert_eq!(state.observation, SaveObservation::NeedsAttention);
            assert_eq!(state.intent.unwrap().tail, TailStatus::Truncated);
        }
        if failed == Stage::CandidatePartialWrite {
            assert_ne!(state.candidate.as_deref(), Some(NEW));
        }
        if after_replace {
            assert_eq!(
                service
                    .enqueue_save(request(&service, id, 22, NEW))
                    .unwrap_err()
                    .code,
                ErrorCode::SaveNeedsAttention
            );
        }
        drop(service);
        let (restarted, current) = f.open();
        assert_eq!(current.source, if after_replace { NEW } else { OLD });
        assert_eq!(
            restarted
                .inspect_recovery(&current.identity)
                .unwrap()
                .latest
                .unwrap()
                .source,
            NEW
        );
        let inspection = restarted.inspect_source_save(&current.identity).unwrap();
        if after_replace {
            assert!(matches!(
                inspection.observation,
                SaveObservation::InstalledCandidateUnconfirmed
                    | SaveObservation::ConfirmedRecordMatchesSource
            ));
        }
    }
}

#[test]
fn external_edit_before_replace_preserves_external_local_and_previous_versions() {
    let f = Fixture::new();
    let (mut service, opened) = f.open();
    let id = &opened.identity;
    save(&mut service, id, 20, OLD);
    enqueue(&mut service, id, 21, NEW);
    let result = service
        .save_next_with(id, |stage| {
            if stage == Stage::BeforeReplace {
                std::fs::write(f.0.join("source.fountain"), b"external writer").unwrap();
            }
            Ok(())
        })
        .unwrap_err();
    assert_eq!(result.error.code, ErrorCode::SourceChanged);
    assert_eq!(result.replacement, ReplacementState::SourceUnchanged);
    assert_eq!(f.bytes(), b"external writer");
    let state = service.inspect_source_save(id).unwrap();
    assert_eq!(state.previous.unwrap(), OLD);
    assert_eq!(state.candidate.unwrap(), NEW);
    assert_eq!(state.observation, SaveObservation::Diverged);
    assert_eq!(
        service.inspect_recovery(id).unwrap().latest.unwrap().source,
        NEW
    );
}

#[test]
fn simulated_disk_full_permission_loss_and_directory_substitution_never_replace_source() {
    for failure in 0..3 {
        let f = Fixture::new();
        let (mut service, opened) = f.open();
        let id = &opened.identity;
        enqueue(&mut service, id, 21, NEW);
        let result = service
            .save_next_with(id, |stage| {
                if failure == 0 && stage == Stage::PreviousPartialWrite {
                    return Err(io_error(std::io::Error::from_raw_os_error(28)));
                }
                if stage == Stage::BeforeReplace && failure == 1 {
                    std::fs::set_permissions(
                        f.0.join("source.fountain"),
                        std::fs::Permissions::from_mode(0o400),
                    )
                    .unwrap();
                }
                if stage == Stage::BeforeReplace && failure == 2 {
                    std::fs::rename(
                        f.artifacts(&id.document_id),
                        f.0.join("displaced-artifacts"),
                    )
                    .unwrap();
                    std::fs::create_dir(f.artifacts(&id.document_id)).unwrap();
                    std::fs::set_permissions(
                        f.artifacts(&id.document_id),
                        std::fs::Permissions::from_mode(0o700),
                    )
                    .unwrap();
                }
                Ok(())
            })
            .unwrap_err();
        assert_eq!(result.replacement, ReplacementState::SourceUnchanged);
        assert_eq!(f.bytes(), ORIGINAL);
        assert_eq!(
            service.inspect_recovery(id).unwrap().latest.unwrap().source,
            NEW
        );
    }
}

#[test]
fn unsafe_unknown_corrupt_and_pending_artifacts_are_preserved_and_block_replacement() {
    for kind in 0..5 {
        let f = Fixture::new();
        let (mut service, opened) = f.open();
        let id = &opened.identity;
        save(&mut service, id, 20, OLD);
        let dir = f.artifacts(&id.document_id);
        let name = if kind == 0 {
            "previous-pending"
        } else {
            "confirmed"
        };
        let path = dir.join(name);
        let bytes = match kind {
            0 | 1 => b"unresolved partial".to_vec(),
            2 => {
                let mut bytes = std::fs::read(&path).unwrap();
                bytes[8..12].copy_from_slice(&99u32.to_le_bytes());
                bytes
            }
            3 => {
                std::fs::remove_file(&path).unwrap();
                symlink(f.0.join("source.fountain"), &path).unwrap();
                OLD.to_vec()
            }
            _ => {
                let bytes = std::fs::read(&path).unwrap();
                std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o644)).unwrap();
                bytes
            }
        };
        if kind < 3 {
            std::fs::write(&path, &bytes).unwrap();
        }
        enqueue(&mut service, id, 21, NEW);
        assert!(service.save_next(id).is_err(), "case {kind}");
        assert_eq!(f.bytes(), OLD);
        assert_eq!(std::fs::read(&path).unwrap(), bytes);
    }
}

#[test]
fn recovery_failure_stops_save_and_original_source_remains_intact() {
    let f = Fixture::new();
    let (mut service, opened) = f.open();
    let id = &opened.identity;
    service
        .checkpoint(id, 30, OLD, &source_hash(OLD), serde_json::Value::Null)
        .unwrap();
    enqueue(&mut service, id, 21, NEW);
    let failure = service.save_next(id).unwrap_err();
    assert_eq!(failure.error.code, ErrorCode::StaleRecoveryVersion);
    assert!(failure.recovery.is_none());
    assert_eq!(f.bytes(), ORIGINAL);
    assert_eq!(
        service.inspect_source_save(id).unwrap().observation,
        SaveObservation::NoTransaction
    );
}

#[test]
fn sigkill_boundaries_leave_whole_source_prior_copy_and_discoverable_transaction() {
    for stage in [
        Stage::RecoveryProtected,
        Stage::IntentPartialWrite,
        Stage::PreviousPartialWrite,
        Stage::PreviousPublished,
        Stage::CandidatePartialWrite,
        Stage::CandidateSynced,
        Stage::BeforeReplace,
        Stage::Replaced,
        Stage::DirectorySynced,
        Stage::Confirmed,
    ] {
        let f = Fixture::new();
        let mut child = Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "documents::linux::source_store::tests::crash_child",
                "--nocapture",
            ])
            .env("BABEL_SAVE_CHILD_ROOT", &f.0)
            .env("BABEL_SAVE_CHILD_STAGE", format!("{stage:?}"))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        let mut output = BufReader::new(child.stdout.take().unwrap());
        let mut line = String::new();
        loop {
            line.clear();
            assert_ne!(
                output.read_line(&mut line).unwrap(),
                0,
                "child exited before {stage:?}"
            );
            if line.contains("BABEL_SAVE_BARRIER") {
                break;
            }
        }
        child.kill().unwrap();
        assert!(!child.wait().unwrap().success());
        let (service, opened) = f.open();
        let id = &opened.identity;
        let after = matches!(
            stage,
            Stage::Replaced | Stage::DirectorySynced | Stage::Confirmed
        );
        assert_eq!(opened.source, if after { NEW } else { ORIGINAL });
        assert_eq!(
            opened.fingerprint.as_ref().unwrap().sha256,
            source_hash(if after { NEW } else { ORIGINAL })
        );
        assert_eq!(
            service.inspect_recovery(id).unwrap().latest.unwrap().source,
            NEW
        );
        let state = service.inspect_source_save(id).unwrap();
        if after {
            assert_eq!(state.previous.as_deref(), Some(ORIGINAL));
        }
        if stage == Stage::IntentPartialWrite {
            assert_eq!(state.observation, SaveObservation::NeedsAttention);
        }
        if stage == Stage::CandidatePartialWrite {
            assert_ne!(state.candidate.as_deref(), Some(NEW));
        }
        if stage == Stage::BeforeReplace {
            assert_eq!(state.previous.as_deref(), Some(ORIGINAL));
            assert_eq!(state.candidate.as_deref(), Some(NEW));
            assert_eq!(
                source_hash(state.candidate.as_ref().unwrap()),
                source_hash(NEW)
            );
        }
    }
}

#[test]
fn crash_child() {
    let Some(root) = std::env::var_os("BABEL_SAVE_CHILD_ROOT") else {
        return;
    };
    let fixture = Fixture(PathBuf::from(root));
    let (mut service, opened) = fixture.open();
    enqueue(&mut service, &opened.identity, 21, NEW);
    let target = std::env::var("BABEL_SAVE_CHILD_STAGE").unwrap();
    let _ = service.save_next_with(&opened.identity, |stage| {
        if format!("{stage:?}") == target {
            println!("BABEL_SAVE_BARRIER");
            std::io::stdout().flush().unwrap();
            let mut byte = [0];
            std::io::stdin().read_exact(&mut byte).unwrap();
        }
        Ok(())
    });
    // Child harness is only run in tests; parent owns cleanup of these synthetic files.
    std::mem::forget(fixture);
}

#[test]
fn post_replace_external_edit_reports_uncertainty_and_blocks_relinquishment() {
    for changed in [Stage::Replaced, Stage::Confirmed] {
        let f = Fixture::new();
        let (mut service, opened) = f.open();
        let id = &opened.identity;
        enqueue(&mut service, id, 21, NEW);
        let failure = service
            .save_next_with(id, |stage| {
                if stage == changed {
                    std::fs::write(f.0.join("source.fountain"), b"racing external generation")
                        .unwrap();
                }
                Ok(())
            })
            .unwrap_err();
        assert_eq!(
            failure.replacement,
            ReplacementState::ReplacedButUnconfirmed
        );
        assert_eq!(f.bytes(), b"racing external generation");
        let state = service.inspect_source_save(id).unwrap();
        assert_eq!(state.previous.unwrap(), ORIGINAL);
        assert_eq!(state.observation, SaveObservation::Diverged);
        assert_eq!(
            service.inspect_recovery(id).unwrap().latest.unwrap().source,
            NEW
        );
        assert_eq!(
            service.release(id).unwrap_err().code,
            ErrorCode::SaveNeedsAttention
        );
        assert_eq!(
            service
                .enqueue_save(request(&service, id, 22, OLD))
                .unwrap_err()
                .code,
            ErrorCode::SaveNeedsAttention
        );
        // Independent emergency protection remains usable even after uncertain replacement.
        service
            .checkpoint(id, 22, OLD, &source_hash(OLD), serde_json::Value::Null)
            .unwrap();
        assert_eq!(
            service.inspect_recovery(id).unwrap().latest.unwrap().source,
            OLD
        );
        let transaction_entries = std::fs::read_dir(f.artifacts(&id.document_id))
            .unwrap()
            .count();
        assert!(transaction_entries > 0);
        service.release_at_risk(id).unwrap();
        assert_eq!(
            service.read_initial(id).unwrap_err().code,
            ErrorCode::InvalidHandle
        );
        assert_eq!(f.bytes(), b"racing external generation");
        assert_eq!(
            std::fs::read_dir(f.artifacts(&id.document_id))
                .unwrap()
                .count(),
            transaction_entries
        );
    }
}

#[test]
fn failed_request_keeps_session_version_order_and_exact_retry_identity() {
    let f = Fixture::new();
    let (mut service, opened) = f.open();
    let id = &opened.identity;
    enqueue(&mut service, id, 21, NEW);
    service
        .save_next_with(id, |stage| {
            if stage == Stage::RecoveryProtected {
                Err(error(ErrorCode::Io))
            } else {
                Ok(())
            }
        })
        .unwrap_err();
    assert_eq!(
        service
            .enqueue_save(request(&service, id, 20, OLD))
            .unwrap_err()
            .code,
        ErrorCode::StaleSaveVersion
    );
    assert_eq!(
        service
            .enqueue_save(request(&service, id, 21, OLD))
            .unwrap_err()
            .code,
        ErrorCode::SaveConflict
    );
    // Before intent creation there is no unresolved source transaction; exact retry performs fresh checks.
    let saved = save(&mut service, id, 21, NEW);
    assert_eq!(saved.version, 21);
    assert_eq!(f.bytes(), NEW);
}
