//! Save As publication and identity tests on real Linux files. Fixtures live
//! under BABEL_SAVE_TEST_ROOT or the system temp dir; M3-11 evidence repeats
//! this file on the reference Btrfs root.
use super::*;
use crate::documents::{
    persistence::CheckpointRequest, recovery::source_hash, save_as::SaveAsRequest,
};
use serde_json::json;
use std::{
    fs,
    io::BufRead,
    os::unix::fs::PermissionsExt,
    path::PathBuf,
    process::{Command, Stdio},
};

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let root = std::env::var_os("BABEL_SAVE_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir)
            .join(format!(
                "babel-save-as-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
        fs::create_dir(&root).unwrap();
        fs::set_permissions(&root, fs::Permissions::from_mode(0o700)).unwrap();
        fs::write(root.join("source.fountain"), b"INT. HOUSE - DAY\n").unwrap();
        fs::set_permissions(
            root.join("source.fountain"),
            fs::Permissions::from_mode(0o600),
        )
        .unwrap();
        Self(root)
    }
    fn service(&self) -> (DocumentService, OpenDocument) {
        let mut service = DocumentService::new(&self.0.join("app-data")).unwrap();
        let opened = service
            .open_selected(&self.0.join("source.fountain"))
            .unwrap();
        assert_eq!(opened.ownership, Ownership::Exclusive);
        (service, opened)
    }
    fn checkpoint(&self, opened: &OpenDocument, version: u64, source: &[u8]) -> CheckpointRequest {
        CheckpointRequest {
            identity: opened.identity.clone(),
            version,
            source: source.to_vec(),
            source_sha256: source_hash(source),
            expected_fingerprint: opened.fingerprint.clone(),
            draft_metadata: json!({"saveAs": true}),
        }
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).unwrap();
    }
}

fn identity_records(fixture: &Fixture) -> Vec<serde_json::Value> {
    let mut records = Vec::new();
    for item in fs::read_dir(fixture.0.join("app-data")).unwrap() {
        let path = item.unwrap().path();
        if path.extension().map(|e| e == "json").unwrap_or(false)
            && path
                .file_name()
                .unwrap()
                .to_string_lossy()
                .ends_with(".identity.json")
        {
            records.push(serde_json::from_slice(&fs::read(path).unwrap()).unwrap());
        }
    }
    records
}

#[test]
fn publishes_exact_bytes_with_a_fresh_identity_and_keeps_the_source() {
    let f = Fixture::new();
    let (mut service, opened) = f.service();
    let target = service
        .select_save_destination(&opened.identity, &f.0.join("Copy.fountain"))
        .unwrap();
    assert_eq!(target.file_name, "Copy.fountain");
    let edited = b"INT. HOUSE - DAY\nNew action.\n";
    let receipt = service
        .save_as_copy(&SaveAsRequest {
            checkpoint: f.checkpoint(&opened, 21, edited),
            destination_token: target.token.clone(),
        })
        .unwrap();
    assert_eq!(receipt.version, 21);
    assert_eq!(receipt.source_sha256, source_hash(edited));
    assert_eq!(receipt.file_name, "Copy.fountain");
    assert_eq!(fs::read(f.0.join("Copy.fountain")).unwrap(), edited);
    assert_eq!(receipt.document.kind, DocumentKind::Loose);
    assert!(receipt.document.persistent_identity);
    assert_eq!(receipt.document.source, edited);
    assert_ne!(receipt.document.identity, opened.identity);
    assert_ne!(
        receipt.document.identity.document_id,
        opened.identity.document_id
    );
    assert_eq!(
        receipt.document.fingerprint.unwrap().sha256,
        source_hash(edited)
    );
    // The source registration is untouched and still readable.
    assert_eq!(service.read_initial(&opened.identity).unwrap(), opened);
    assert_eq!(
        fs::read(f.0.join("source.fountain")).unwrap(),
        b"INT. HOUSE - DAY\n"
    );
    // Tokens are single-use.
    assert_eq!(
        service
            .save_as_copy(&SaveAsRequest {
                checkpoint: f.checkpoint(&opened, 22, edited),
                destination_token: target.token,
            })
            .unwrap_err()
            .code,
        ErrorCode::InvalidDestination
    );
}

#[test]
fn existing_destinations_fail_closed_without_touching_either_file() {
    let f = Fixture::new();
    let (mut service, opened) = f.service();
    fs::write(f.0.join("Taken.fountain"), b"someone else\n").unwrap();
    let target = service
        .select_save_destination(&opened.identity, &f.0.join("Taken.fountain"))
        .unwrap_err();
    assert_eq!(target.code, ErrorCode::InvalidDestination);
    // A token issued before the file appeared still refuses at publication.
    let target = service
        .select_save_destination(&opened.identity, &f.0.join("Race.fountain"))
        .unwrap();
    fs::write(f.0.join("Race.fountain"), b"someone else\n").unwrap();
    assert_eq!(
        service
            .save_as_copy(&SaveAsRequest {
                checkpoint: f.checkpoint(&opened, 21, b"new"),
                destination_token: target.token,
            })
            .unwrap_err()
            .code,
        ErrorCode::InvalidDestination
    );
    assert_eq!(
        fs::read(f.0.join("Race.fountain")).unwrap(),
        b"someone else\n"
    );
    assert_eq!(
        fs::read(f.0.join("source.fountain")).unwrap(),
        b"INT. HOUSE - DAY\n"
    );
    assert_eq!(service.read_initial(&opened.identity).unwrap(), opened);
}

#[test]
fn tokens_bind_the_source_session_and_die_with_release() {
    let f = Fixture::new();
    let (mut service, opened) = f.service();
    let other = service.register_unsaved().unwrap();
    let target = service
        .select_save_destination(&opened.identity, &f.0.join("Copy.fountain"))
        .unwrap();
    // A foreign registration cannot spend this token.
    assert_eq!(
        service
            .save_as_copy(&SaveAsRequest {
                checkpoint: f.checkpoint(&other, 1, b"foreign"),
                destination_token: target.token.clone(),
            })
            .unwrap_err()
            .code,
        ErrorCode::InvalidDestination
    );
    // Neither can a stale session of the same handle.
    let mut stale = f.checkpoint(&opened, 21, b"new");
    stale.identity.session_id = "00000000-0000-4000-8000-000000000000".to_string();
    assert_eq!(
        service
            .save_as_copy(&SaveAsRequest {
                checkpoint: stale,
                destination_token: target.token.clone(),
            })
            .unwrap_err()
            .code,
        ErrorCode::IdentityMismatch
    );
    // Release revokes the token.
    service.release(&opened.identity).unwrap();
    assert_eq!(
        service
            .save_as_copy(&SaveAsRequest {
                checkpoint: f.checkpoint(&opened, 21, b"new"),
                destination_token: target.token,
            })
            .unwrap_err()
            .code,
        ErrorCode::InvalidHandle
    );
    assert!(!f.0.join("Copy.fountain").exists());
}

#[test]
fn stale_sessions_select_nothing_and_bad_names_refuse() {
    let f = Fixture::new();
    let (mut service, opened) = f.service();
    let mut stale = opened.identity.clone();
    stale.session_id = "00000000-0000-4000-8000-000000000000".to_string();
    assert_eq!(
        service
            .select_save_destination(&stale, &f.0.join("Copy.fountain"))
            .unwrap_err()
            .code,
        ErrorCode::IdentityMismatch
    );
    assert_eq!(
        service
            .select_save_destination(&opened.identity, &f.0.join(".."))
            .unwrap_err()
            .code,
        ErrorCode::UnsafePath,
        ".."
    );
    for name in [".", "", &"x".repeat(256), "bad\nname.fountain"] {
        assert_eq!(
            service
                .select_save_destination(&opened.identity, &f.0.join(name))
                .unwrap_err()
                .code,
            ErrorCode::InvalidDestination,
            "{name}"
        );
    }
    assert!(!f.0.join("Copy.fountain").exists());
}

#[test]
fn unsaved_and_unencoded_sources_publish_exact_bytes() {
    let f = Fixture::new();
    let mut service = f.service().0;
    let unsaved = service.register_unsaved().unwrap();
    let target = service
        .select_save_destination(&unsaved.identity, &f.0.join("Draft.fountain"))
        .unwrap();
    let raw = b"\xff\xfenew draft\r\n  ";
    let receipt = service
        .save_as_copy(&SaveAsRequest {
            checkpoint: CheckpointRequest {
                identity: unsaved.identity.clone(),
                version: 3,
                source: raw.to_vec(),
                source_sha256: source_hash(raw),
                expected_fingerprint: None,
                draft_metadata: json!({}),
            },
            destination_token: target.token,
        })
        .unwrap();
    assert_eq!(fs::read(f.0.join("Draft.fountain")).unwrap(), raw);
    assert_eq!(receipt.document.source, raw);
    assert_ne!(
        receipt.document.identity.document_id,
        unsaved.identity.document_id
    );
}

#[test]
fn read_only_parents_and_managed_adoption_refuse() {
    let f = Fixture::new();
    let (mut service, opened) = f.service();
    let locked = f.0.join("locked");
    fs::create_dir(&locked).unwrap();
    fs::set_permissions(&locked, fs::Permissions::from_mode(0o500)).unwrap();
    assert_eq!(
        service
            .select_save_destination(&opened.identity, &locked.join("Copy.fountain"))
            .unwrap_err()
            .code,
        ErrorCode::InvalidDestination
    );
    fs::set_permissions(&locked, fs::Permissions::from_mode(0o700)).unwrap();
    // A managed project never gains a Save As duplicate: refuse, don't hijack.
    let project = f.0.join("project");
    fs::create_dir(&project).unwrap();
    fs::set_permissions(&project, fs::Permissions::from_mode(0o700)).unwrap();
    let aux = project.join(".screenwriter");
    fs::create_dir(&aux).unwrap();
    fs::set_permissions(&aux, fs::Permissions::from_mode(0o700)).unwrap();
    fs::write(
        aux.join("project.json"),
        br#"{"schemaVersion":1,"projectId":"44444444-4444-4444-8444-444444444444","sourceFilename":"Script.fountain","pdfProfile":"us-letter"}"#,
    )
    .unwrap();
    fs::set_permissions(aux.join("project.json"), fs::Permissions::from_mode(0o600)).unwrap();
    let target = service
        .select_save_destination(&opened.identity, &project.join("Script.fountain"))
        .unwrap();
    assert_eq!(
        service
            .save_as_copy(&SaveAsRequest {
                checkpoint: f.checkpoint(&opened, 21, b"new"),
                destination_token: target.token,
            })
            .unwrap_err()
            .code,
        ErrorCode::InvalidDestination
    );
    // The refused adoption leaks no registration: reopening the published
    // file holds exclusive leases and the original registration is intact.
    let reopened = service
        .open_selected(&project.join("Script.fountain"))
        .unwrap();
    assert_eq!(reopened.ownership, Ownership::Exclusive);
    assert_eq!(service.read_initial(&opened.identity).unwrap(), opened);
}

#[test]
fn duplicate_identities_carry_no_remote_linkage() {
    let f = Fixture::new();
    let (mut service, opened) = f.service();
    let target = service
        .select_save_destination(&opened.identity, &f.0.join("Copy.fountain"))
        .unwrap();
    service
        .save_as_copy(&SaveAsRequest {
            checkpoint: f.checkpoint(&opened, 21, b"new"),
            destination_token: target.token,
        })
        .unwrap();
    let records = identity_records(&f);
    assert!(records.len() >= 2);
    for record in records {
        let map = record.as_object().unwrap();
        assert_eq!(
            map.keys().collect::<Vec<_>>(),
            vec!["documentId", "schemaVersion"]
        );
    }
}

const DRILL: &[u8] = b"INT. NIGHT - DAY\nSave As drill.\n";

#[test]
fn sigkill_boundaries_leave_source_intact_and_new_bytes_discoverable() {
    for stage in [
        SaveAsStage::TempWritten,
        SaveAsStage::Published,
        SaveAsStage::IdentityRecorded,
    ] {
        let f = Fixture::new();
        let mut child = Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "documents::linux::save_as_store::tests::crash_child",
                "--nocapture",
            ])
            .env("BABEL_SAVE_AS_CHILD_ROOT", &f.0)
            .env("BABEL_SAVE_AS_CHILD_STAGE", format!("{stage:?}"))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        let mut output = std::io::BufReader::new(child.stdout.take().unwrap());
        let mut line = String::new();
        loop {
            line.clear();
            assert_ne!(
                output.read_line(&mut line).unwrap(),
                0,
                "child exited before {stage:?}"
            );
            if line.contains("BABEL_SAVE_AS_BARRIER") {
                break;
            }
        }
        child.kill().unwrap();
        assert!(!child.wait().unwrap().success());
        let mut service = DocumentService::new(&f.0.join("app-data")).unwrap();
        let source = service.open_selected(&f.0.join("source.fountain")).unwrap();
        assert_eq!(source.source, b"INT. HOUSE - DAY\n");
        let copy_id = if stage == SaveAsStage::TempWritten {
            assert!(!f.0.join("Copy.fountain").exists());
            assert!(
                fs::read_dir(&f.0).unwrap().any(|item| item
                    .unwrap()
                    .file_name()
                    .to_string_lossy()
                    .starts_with(".babel-save-as-")),
                "temp orphan stays inspectable"
            );
            None
        } else {
            assert_eq!(fs::read(f.0.join("Copy.fountain")).unwrap(), DRILL);
            let copy = service.open_selected(&f.0.join("Copy.fountain")).unwrap();
            assert_eq!(copy.source, DRILL);
            assert!(copy.persistent_identity);
            Some(copy.identity.document_id.clone())
        };
        // A fresh Save As retry always succeeds after the kill.
        let target = service
            .select_save_destination(&source.identity, &f.0.join("Retry.fountain"))
            .unwrap();
        let receipt = service
            .save_as_copy(&SaveAsRequest {
                checkpoint: CheckpointRequest {
                    identity: source.identity.clone(),
                    version: 22,
                    source: DRILL.to_vec(),
                    source_sha256: source_hash(DRILL),
                    expected_fingerprint: source.fingerprint.clone(),
                    draft_metadata: json!({}),
                },
                destination_token: target.token,
            })
            .unwrap();
        assert_eq!(receipt.document.source, DRILL);
        drop(service);
        // Identity records survive the restart in every case.
        if let Some(id) = copy_id {
            let mut reopened = DocumentService::new(&f.0.join("app-data")).unwrap();
            let again = reopened.open_selected(&f.0.join("Copy.fountain")).unwrap();
            assert_eq!(again.identity.document_id, id);
        }
    }
}

#[test]
fn crash_child() {
    let Some(root) = std::env::var_os("BABEL_SAVE_AS_CHILD_ROOT") else {
        return;
    };
    let fixture = Fixture(PathBuf::from(root));
    let mut service = DocumentService::new(&fixture.0.join("app-data")).unwrap();
    let opened = service
        .open_selected(&fixture.0.join("source.fountain"))
        .unwrap();
    let target = service
        .select_save_destination(&opened.identity, &fixture.0.join("Copy.fountain"))
        .unwrap();
    let stop = std::env::var("BABEL_SAVE_AS_CHILD_STAGE").unwrap();
    let request = SaveAsRequest {
        checkpoint: CheckpointRequest {
            identity: opened.identity.clone(),
            version: 21,
            source: DRILL.to_vec(),
            source_sha256: source_hash(DRILL),
            expected_fingerprint: opened.fingerprint.clone(),
            draft_metadata: json!({}),
        },
        destination_token: target.token,
    };
    let _ = service.save_as_copy_with(&request, &mut |stage| {
        if format!("{stage:?}") == stop {
            println!("BABEL_SAVE_AS_BARRIER");
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
fn restart_keeps_the_new_identity_and_tolerates_orphan_temps() {
    let f = Fixture::new();
    let new_id = {
        let (mut service, opened) = f.service();
        // A crashed predecessor's temp never blocks a later Save As.
        fs::write(f.0.join(".babel-save-as-stale.pending"), b"orphan").unwrap();
        let target = service
            .select_save_destination(&opened.identity, &f.0.join("Copy.fountain"))
            .unwrap();
        let receipt = service
            .save_as_copy(&SaveAsRequest {
                checkpoint: f.checkpoint(&opened, 21, b"restart me"),
                destination_token: target.token,
            })
            .unwrap();
        assert_eq!(
            fs::read(f.0.join(".babel-save-as-stale.pending")).unwrap(),
            b"orphan"
        );
        receipt.document.identity.document_id.clone()
    };
    let mut reopened = DocumentService::new(&f.0.join("app-data")).unwrap();
    let copy = reopened.open_selected(&f.0.join("Copy.fountain")).unwrap();
    assert_eq!(copy.identity.document_id, new_id);
    assert_eq!(copy.source, b"restart me");
    let source = reopened
        .open_selected(&f.0.join("source.fountain"))
        .unwrap();
    assert_eq!(source.source, b"INT. HOUSE - DAY\n");
}
