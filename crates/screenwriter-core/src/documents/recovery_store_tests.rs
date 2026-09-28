use super::*;
use std::io::{BufRead, BufReader};
use std::os::unix::fs::PermissionsExt;
use std::process::{Command, Stdio};

fn checkpoint(
    dir: &File,
    request: &DocumentRequest,
    version: u64,
    source: &[u8],
    draft_metadata: serde_json::Value,
    ownership: impl FnMut() -> Result<(), DocumentError>,
    gate: impl FnMut(Stage) -> Result<(), DocumentError>,
) -> Result<CheckpointReceipt, DocumentError> {
    super::checkpoint(
        dir,
        request,
        DraftSnapshot {
            version,
            source,
            draft_metadata,
            base_fingerprint: None,
        },
        ownership,
        gate,
    )
}

struct Fixture(PathBuf);

impl Fixture {
    fn new() -> Self {
        let base = std::env::var_os("BABEL_RECOVERY_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let path = base.join(format!("babel-recovery-{}", uuid()));
        std::fs::create_dir(&path).unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o700)).unwrap();
        Self(path)
    }

    fn dir(&self) -> File {
        directory(&self.0).unwrap()
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        std::fs::remove_dir_all(&self.0).unwrap();
    }
}

fn identity() -> DocumentRequest {
    DocumentRequest {
        handle: uuid(),
        document_id: uuid(),
        session_id: uuid(),
    }
}

fn save(dir: &File, id: &DocumentRequest, version: u64) -> CheckpointReceipt {
    let mut source = format!("synthetic {version}\r\n  ").into_bytes();
    source.push(0xff);
    checkpoint(
        dir,
        id,
        version,
        &source,
        serde_json::json!({"selection": version}),
        || Ok(()),
        |_| Ok(()),
    )
    .unwrap()
}

#[test]
fn fault_matrix_retains_acknowledged_checkpoint_and_never_returns_false_receipt() {
    for failed in [
        Stage::BeforeWrite,
        Stage::PartialWrite,
        Stage::BeforeSync,
        Stage::CandidateSynced,
        Stage::BeforePreviousWrite,
        Stage::PreviousPartialWrite,
        Stage::BeforePreviousSync,
        Stage::PreviousSynced,
        Stage::BeforePreviousPublish,
        Stage::PreviousPublished,
        Stage::BeforePublish,
        Stage::Published,
        Stage::BeforeDirectorySync,
        Stage::DirectorySynced,
        Stage::Verified,
    ] {
        let f = Fixture::new();
        let dir = f.dir();
        let id = identity();
        let receipt = save(&dir, &id, 21);
        let result = checkpoint(
            &dir,
            &id,
            22,
            b"new synthetic",
            serde_json::Value::Null,
            || Ok(()),
            |stage| {
                if stage == failed {
                    Err(error(ErrorCode::Io))
                } else {
                    Ok(())
                }
            },
        );
        assert!(result.is_err(), "{failed:?}");
        let recovered = inspect(&dir, &id.document_id).unwrap();
        let protected = [&recovered.current, &recovered.previous]
            .into_iter()
            .flatten()
            .flat_map(|j| &j.checkpoints)
            .any(|c| {
                c.metadata.version == receipt.version
                    && c.metadata.source_sha256 == receipt.source_sha256
            });
        assert!(protected, "{failed:?} lost v21");
        if failed == Stage::PartialWrite {
            assert_eq!(recovered.pending.unwrap().tail, TailStatus::Truncated);
        }
        if matches!(
            failed,
            Stage::Published
                | Stage::BeforeDirectorySync
                | Stage::DirectorySynced
                | Stage::Verified
        ) {
            // An uncertain publish can be retried only with fresh native sync/verification.
            let retry = checkpoint(
                &dir,
                &id,
                22,
                b"new synthetic",
                serde_json::Value::Null,
                || Ok(()),
                |_| Ok(()),
            )
            .unwrap();
            assert_eq!(retry.version, 22);
        }
    }
}

#[test]
fn simulated_disk_full_and_lost_ownership_preserve_previous_generation() {
    let f = Fixture::new();
    let dir = f.dir();
    let id = identity();
    save(&dir, &id, 1);
    let before = read_bytes(&dir, &name(&id.document_id, "journal"))
        .unwrap()
        .unwrap();
    let result = checkpoint(
        &dir,
        &id,
        2,
        b"new",
        serde_json::Value::Null,
        || Ok(()),
        |stage| {
            if stage == Stage::PartialWrite {
                Err(io_error(std::io::Error::from_raw_os_error(28))) // ENOSPC simulation, not host disk exhaustion.
            } else {
                Ok(())
            }
        },
    );
    assert!(result.is_err());
    assert_eq!(
        read_bytes(&dir, &name(&id.document_id, "journal"))
            .unwrap()
            .unwrap(),
        before
    );
    assert!(
        checkpoint(
            &dir,
            &id,
            3,
            b"retry",
            serde_json::Value::Null,
            || Ok(()),
            |_| Ok(())
        )
        .is_err()
    ); // Pending data is never discarded to make room.
    let f = Fixture::new();
    let dir = f.dir();
    let id = identity();
    save(&dir, &id, 1);
    let mut checks = 0;
    assert!(
        checkpoint(
            &dir,
            &id,
            2,
            b"new",
            serde_json::Value::Null,
            || {
                checks += 1;
                if checks >= 4 {
                    Err(error(ErrorCode::OwnershipLost))
                } else {
                    Ok(())
                }
            },
            |_| Ok(())
        )
        .is_err()
    );
    assert_eq!(
        inspect(&dir, &id.document_id)
            .unwrap()
            .latest
            .unwrap()
            .metadata
            .version,
        1
    );
}

#[test]
fn conflicting_overlap_and_unknown_schema_are_preserved_without_winner() {
    let f = Fixture::new();
    let dir = f.dir();
    let id = identity();
    save(&dir, &id, 1);
    save(&dir, &id, 2);
    let conflicting = Checkpoint::capture(&id, 1, 1, b"different", serde_json::Value::Null)
        .unwrap()
        .encode()
        .unwrap();
    std::fs::write(f.0.join(name(&id.document_id, "previous")), &conflicting).unwrap();
    assert_eq!(
        inspect(&dir, &id.document_id).unwrap_err().code,
        ErrorCode::CheckpointConflict
    );
    assert_eq!(
        std::fs::read(f.0.join(name(&id.document_id, "previous"))).unwrap(),
        conflicting
    );
    let f = Fixture::new();
    let dir = f.dir();
    let id = identity();
    save(&dir, &id, 1);
    let current = f.0.join(name(&id.document_id, "journal"));
    let mut bytes = std::fs::read(&current).unwrap();
    bytes[8..12].copy_from_slice(&99u32.to_le_bytes());
    std::fs::write(&current, &bytes).unwrap();
    assert_eq!(
        checkpoint(
            &dir,
            &id,
            2,
            b"new",
            serde_json::Value::Null,
            || Ok(()),
            |_| Ok(())
        )
        .unwrap_err()
        .code,
        ErrorCode::RecoveryNeedsAttention
    );
    assert_eq!(std::fs::read(current).unwrap(), bytes);
}

#[test]
fn sigkill_at_native_publication_boundaries_preserves_acknowledged_generation() {
    for stage in [
        Stage::PartialWrite,
        Stage::CandidateSynced,
        Stage::PreviousPartialWrite,
        Stage::PreviousPublished,
        Stage::Published,
        Stage::DirectorySynced,
    ] {
        let f = Fixture::new();
        let dir = f.dir();
        let id = identity();
        let old = save(&dir, &id, 21);
        let mut child = Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "documents::linux::recovery_store::tests::crash_child",
                "--nocapture",
            ])
            .env("BABEL_RECOVERY_CHILD_DIR", &f.0)
            .env(
                "BABEL_RECOVERY_CHILD_ID",
                serde_json::to_string(&id).unwrap(),
            )
            .env("BABEL_RECOVERY_CHILD_STAGE", format!("{stage:?}"))
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
            if line.contains("BABEL_RECOVERY_BARRIER") {
                break;
            }
        }
        child.kill().unwrap();
        assert!(!child.wait().unwrap().success());
        let restarted = inspect(&directory(&f.0).unwrap(), &id.document_id).unwrap();
        assert!(
            [&restarted.current, &restarted.previous]
                .into_iter()
                .flatten()
                .flat_map(|j| &j.checkpoints)
                .any(|c| c.metadata.version == 21 && c.metadata.source_sha256 == old.source_sha256),
            "{stage:?}"
        );
        if stage == Stage::PartialWrite {
            assert_eq!(restarted.pending.unwrap().tail, TailStatus::Truncated);
        }
    }
}

#[test]
fn crash_child() {
    let Some(root) = std::env::var_os("BABEL_RECOVERY_CHILD_DIR") else {
        return;
    };
    let id: DocumentRequest =
        serde_json::from_str(&std::env::var("BABEL_RECOVERY_CHILD_ID").unwrap()).unwrap();
    let stage_name = std::env::var("BABEL_RECOVERY_CHILD_STAGE").unwrap();
    let _ = checkpoint(
        &directory(Path::new(&root)).unwrap(),
        &id,
        22,
        b"new after crash barrier",
        serde_json::Value::Null,
        || Ok(()),
        |stage| {
            if format!("{stage:?}") == stage_name {
                println!("BABEL_RECOVERY_BARRIER");
                std::io::stdout().flush().unwrap();
                let mut input = [0u8];
                std::io::stdin().read_exact(&mut input).unwrap();
            }
            Ok(())
        },
    );
}
