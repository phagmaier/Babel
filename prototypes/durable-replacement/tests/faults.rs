#![cfg(target_os = "linux")]

use durable_replacement_proof::linux::{NEW, OLD, STAGES, Sandbox, Stage, normal_write, replace};
use std::fs::{self, File, OpenOptions};
use std::io::{self, BufRead, BufReader, Write};
use std::os::unix::fs::{MetadataExt, PermissionsExt, symlink};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::time::Duration;

fn sandbox() -> Sandbox {
    let root = std::env::var_os("BABEL_PROOF_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    Sandbox::new(&root).unwrap()
}

fn read(s: &Sandbox, name: &str) -> Vec<u8> {
    fs::read(s.0.join(name)).unwrap()
}

#[test]
fn exact_receipt_permissions_and_independent_generations() {
    let s = sandbox();
    let original = File::open(s.0.join("current.src")).unwrap();
    let receipt = replace(&s.0, 21, |_| Ok(()), normal_write).unwrap();
    assert_eq!(receipt.version, 21);
    assert_eq!(receipt.source, NEW);
    assert_eq!(read(&s, "current.src"), NEW);
    assert_eq!(read(&s, "previous.src"), OLD);
    assert_eq!(read(&s, "recovery.src"), NEW);
    let current = fs::metadata(s.0.join("current.src")).unwrap();
    assert_eq!(current.permissions().mode() & 0o777, 0o640);
    assert_ne!(current.ino(), original.metadata().unwrap().ino());
    for name in ["previous.src", "recovery.src"] {
        assert_eq!(
            fs::metadata(s.0.join(name)).unwrap().permissions().mode() & 0o777,
            0o600
        );
    }
    // Safety copy is not a hard link to a source that an external writer can mutate.
    fs::write(s.0.join("current.src"), b"external writer").unwrap();
    assert_eq!(read(&s, "previous.src"), OLD);
    assert_eq!(read(&s, "recovery.src"), NEW);
}

#[test]
fn injected_io_failures_never_issue_a_receipt() {
    for &fault in STAGES {
        for kind in [io::ErrorKind::PermissionDenied, io::ErrorKind::Other] {
            let s = sandbox();
            let failure = replace(
                &s.0,
                21,
                |stage| {
                    if stage == fault {
                        Err(io::Error::new(kind, "injected operation failure"))
                    } else {
                        Ok(())
                    }
                },
                normal_write,
            )
            .unwrap_err();
            assert_eq!(failure.stage, fault);
            let renamed = matches!(fault, Stage::DirectorySync | Stage::FinalVerify);
            assert_eq!(failure.replaced, renamed);
            assert_eq!(read(&s, "current.src"), if renamed { NEW } else { OLD });
            if renamed {
                assert_eq!(read(&s, "previous.src"), OLD);
                assert_eq!(read(&s, "recovery.src"), NEW);
            }
        }
    }
}

#[test]
fn simulated_disk_full_in_each_storage_layer() {
    for fault in [Stage::RecoveryWrite, Stage::PriorWrite, Stage::TempWrite] {
        let s = sandbox();
        let failure = replace(
            &s.0,
            21,
            |stage| {
                if stage == fault {
                    Err(io::Error::from_raw_os_error(28))
                } else {
                    Ok(())
                }
            },
            normal_write,
        )
        .unwrap_err();
        assert_eq!(failure.error.raw_os_error(), Some(28));
        assert_eq!(read(&s, "current.src"), OLD);
        assert!(!failure.replaced);
    }
}

struct ShortWriter<'a>(&'a mut File);
impl Write for ShortWriter<'_> {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.0.write(&bytes[..bytes.len().min(3)])
    }
    fn flush(&mut self) -> io::Result<()> {
        self.0.flush()
    }
}

#[test]
fn write_all_handles_short_writes_and_rejects_partial_failure_or_silent_truncation() {
    let s = sandbox();
    replace(
        &s.0,
        21,
        |_| Ok(()),
        |f, bytes| ShortWriter(f).write_all(bytes),
    )
    .unwrap();
    assert_eq!(read(&s, "current.src"), NEW);
    for fail in [true, false] {
        let s = sandbox();
        let failure = replace(
            &s.0,
            21,
            |_| Ok(()),
            |f, bytes| {
                f.write_all(&bytes[..7])?;
                if fail {
                    Err(io::Error::from_raw_os_error(28))
                } else {
                    Ok(())
                }
            },
        )
        .unwrap_err();
        assert!(!failure.replaced);
        assert_eq!(
            failure.stage,
            if fail {
                Stage::TempWrite
            } else {
                Stage::TempVerify
            }
        );
        assert_eq!(read(&s, "current.src"), OLD);
        assert_eq!(read(&s, "previous.src"), OLD);
        assert_eq!(read(&s, "recovery.src"), NEW);
        assert_eq!(read(&s, "candidate.src"), &NEW[..7]);
    }
}

#[test]
fn external_bytes_identity_deletion_and_permissions_are_rechecked() {
    for variant in 0..4 {
        let s = sandbox();
        let current = s.0.join("current.src");
        let failure = replace(
            &s.0,
            21,
            |stage| {
                if stage == Stage::Recheck {
                    match variant {
                        0 => fs::write(&current, b"external generation")?,
                        1 => {
                            fs::write(s.0.join("external.src"), OLD)?;
                            fs::rename(s.0.join("external.src"), &current)?;
                        }
                        2 => fs::rename(&current, s.0.join("moved.src"))?,
                        _ => fs::set_permissions(&current, fs::Permissions::from_mode(0o444))?,
                    }
                }
                Ok(())
            },
            normal_write,
        )
        .unwrap_err();
        assert_eq!(failure.stage, Stage::Recheck);
        assert!(!failure.replaced);
        assert_eq!(read(&s, "previous.src"), OLD);
        assert_eq!(read(&s, "recovery.src"), NEW);
        match variant {
            0 => assert_eq!(read(&s, "current.src"), b"external generation"),
            2 => {
                assert!(!current.exists());
                assert_eq!(read(&s, "moved.src"), OLD);
            }
            _ => assert_eq!(read(&s, "current.src"), OLD),
        }
    }
}

#[test]
fn read_only_symlink_and_hardlinked_sources_are_refused() {
    for variant in 0..3 {
        let s = sandbox();
        let current = s.0.join("current.src");
        match variant {
            0 => fs::set_permissions(&current, fs::Permissions::from_mode(0o444)).unwrap(),
            1 => {
                fs::rename(&current, s.0.join("original.src")).unwrap();
                symlink("original.src", &current).unwrap();
            }
            _ => fs::hard_link(&current, s.0.join("alias.src")).unwrap(),
        }
        assert!(replace(&s.0, 21, |_| Ok(()), normal_write).is_err());
        assert_eq!(read(&s, "current.src"), OLD);
        assert!(!s.0.join("recovery.src").exists());
    }
}

#[test]
fn exclusive_creation_never_overwrites_leftovers_or_symlink_targets() {
    for name in ["recovery.src", "previous.src", "candidate.src"] {
        for link in [true, false] {
            let s = sandbox();
            fs::write(s.0.join("sentinel"), b"do not overwrite").unwrap();
            if link {
                symlink("sentinel", s.0.join(name)).unwrap();
            } else {
                fs::write(s.0.join(name), b"do not overwrite").unwrap();
            }
            let failure = replace(&s.0, 21, |_| Ok(()), normal_write).unwrap_err();
            assert_eq!(failure.error.kind(), io::ErrorKind::AlreadyExists);
            assert_eq!(read(&s, name), b"do not overwrite");
            assert_eq!(read(&s, "sentinel"), b"do not overwrite");
            assert_eq!(read(&s, "current.src"), OLD);
        }
    }
}

#[test]
fn native_permission_error_retains_source() {
    let s = sandbox();
    fs::set_permissions(&s.0, fs::Permissions::from_mode(0o500)).unwrap();
    let result = replace(&s.0, 21, |_| Ok(()), normal_write);
    fs::set_permissions(&s.0, fs::Permissions::from_mode(0o700)).unwrap();
    let error = result.expect_err("run proof as an unprivileged user; root bypasses this gate");
    assert_eq!(error.error.kind(), io::ErrorKind::PermissionDenied);
    assert_eq!(read(&s, "current.src"), OLD);
}

#[test]
fn cooperating_second_process_cannot_replace_and_lock_can_be_reacquired() {
    let s = sandbox();
    let lock = OpenOptions::new()
        .read(true)
        .write(true)
        .open(s.0.join("writer.lock"))
        .unwrap();
    lock.try_lock().unwrap();
    let child = Command::new(env!("CARGO_BIN_EXE_durable-replacement-proof"))
        .arg(&s.0)
        .arg("complete")
        .output()
        .unwrap();
    assert!(!child.status.success());
    assert!(!String::from_utf8_lossy(&child.stdout).contains("ACK"));
    assert_eq!(read(&s, "current.src"), OLD);
    assert!(!s.0.join("recovery.src").exists());
    lock.unlock().unwrap();
    drop(lock);
    replace(&s.0, 21, |_| Ok(()), normal_write).unwrap();
}

#[test]
fn sigkill_at_each_barrier_preserves_whole_generations_without_acknowledgement() {
    for &checkpoint in STAGES {
        let s = sandbox();
        let mut child = Command::new(env!("CARGO_BIN_EXE_durable-replacement-proof"))
            .arg(&s.0)
            .arg(format!("{checkpoint:?}"))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        let stdout = child.stdout.take().unwrap();
        let (tx, rx) = mpsc::channel();
        let reader = std::thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            let mut first = String::new();
            reader.read_line(&mut first).unwrap();
            tx.send(first).unwrap();
            reader.lines().map(Result::unwrap).collect::<Vec<_>>()
        });
        let barrier = rx.recv_timeout(Duration::from_secs(10));
        // Always stop the child even if the barrier assertion would fail.
        child.kill().unwrap();
        let status = child.wait().unwrap();
        assert!(!status.success());
        assert_eq!(barrier.unwrap().trim(), format!("READY {checkpoint:?}"));
        assert!(
            !reader
                .join()
                .unwrap()
                .iter()
                .any(|line| line.starts_with("ACK"))
        );
        let renamed = matches!(checkpoint, Stage::DirectorySync | Stage::FinalVerify);
        assert_eq!(read(&s, "current.src"), if renamed { NEW } else { OLD });
        if renamed {
            assert_eq!(read(&s, "previous.src"), OLD);
            assert_eq!(read(&s, "recovery.src"), NEW);
        }
        if checkpoint == Stage::TempSync {
            assert_eq!(read(&s, "candidate.src"), NEW);
            assert_eq!(read(&s, "previous.src"), OLD);
        }
        let lock = OpenOptions::new()
            .read(true)
            .write(true)
            .open(s.0.join("writer.lock"))
            .unwrap();
        lock.try_lock().unwrap(); // Dead worker no longer holds ownership.
        lock.unlock().unwrap();
    }
}

#[test]
fn successful_child_receipt_follows_completed_replacement() {
    let s = sandbox();
    let output = Command::new(env!("CARGO_BIN_EXE_durable-replacement-proof"))
        .arg(&s.0)
        .arg("complete")
        .output()
        .unwrap();
    assert!(output.status.success());
    assert_eq!(
        String::from_utf8(output.stdout).unwrap().trim(),
        format!("ACK 21 {}", NEW.len())
    );
    assert_eq!(read(&s, "current.src"), NEW);
    assert_eq!(read(&s, "previous.src"), OLD);
    assert_eq!(read(&s, "recovery.src"), NEW);
}

#[test]
fn native_rename_failure_and_corrupt_candidate_keep_safety_copies() {
    for corrupt in [true, false] {
        let s = sandbox();
        let result = replace(
            &s.0,
            21,
            |stage| {
                if corrupt && stage == Stage::TempVerify {
                    fs::write(s.0.join("candidate.src"), b"corrupt")?;
                } else if !corrupt && stage == Stage::Replace {
                    fs::rename(s.0.join("current.src"), s.0.join("moved.src"))?;
                    fs::create_dir(s.0.join("current.src"))?;
                }
                Ok(())
            },
            normal_write,
        )
        .unwrap_err();
        assert!(!result.replaced);
        assert_eq!(
            result.stage,
            if corrupt {
                Stage::TempVerify
            } else {
                Stage::Replace
            }
        );
        assert_eq!(read(&s, "previous.src"), OLD);
        assert_eq!(read(&s, "recovery.src"), NEW);
        if corrupt {
            assert_eq!(read(&s, "current.src"), OLD);
        } else {
            assert_eq!(read(&s, "moved.src"), OLD);
        }
    }
}

#[test]
fn final_check_cannot_guarantee_protection_against_noncooperating_writers() {
    let s = sandbox();
    replace(
        &s.0,
        21,
        |stage| {
            if stage == Stage::Replace {
                fs::write(s.0.join("current.src"), b"racing external bytes")?;
            }
            Ok(())
        },
        normal_write,
    )
    .unwrap();
    // Intentional demonstration of the documented check/rename race, NOT a
    // production safety claim: app locks cannot constrain arbitrary editors.
    assert_eq!(read(&s, "current.src"), NEW);
    assert_eq!(read(&s, "previous.src"), OLD);
}
