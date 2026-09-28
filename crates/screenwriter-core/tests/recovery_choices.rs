#![cfg(target_os = "linux")]
//! M2-05B explicit choices over natively opened sources. Synthetic temp files
//! only; every fixture root is removed. No manuscript, credential or remote use.
use screenwriter_core::documents::{
    DocumentService, ErrorCode, OpenDocument,
    choices::{
        ChoiceSourceStatus, ChoiceTransaction, CompareRequest, CopyRequest, KeepRequest,
        RecoverRequest, ResolveRequest,
    },
    recovery::source_hash,
    startup::{RecoveryOrigin, RecoverySelection},
};
use serde_json::json;
use std::{
    collections::BTreeMap,
    fs,
    os::unix::fs::PermissionsExt,
    path::{Path, PathBuf},
};

const PROJECT_A: &str = "11111111-1111-4111-8111-111111111111";
const PROJECT_B: &str = "22222222-2222-4222-8222-222222222222";

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let base = std::env::var_os("BABEL_CHOICES_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let path = base.join(format!(
            "babel-choices-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir(&path).unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o700)).unwrap();
        Self(path)
    }

    fn store(&self) -> PathBuf {
        self.0.join("app-data")
    }

    fn service(&self) -> DocumentService {
        DocumentService::new(&self.store()).unwrap()
    }

    fn source(&self, name: &str, bytes: &[u8]) -> PathBuf {
        let path = self.0.join(name);
        fs::write(&path, bytes).unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
        path
    }

    fn managed_project(&self, dir: &str, file: &str, project_id: &str) -> PathBuf {
        let root = self.0.join(dir);
        fs::create_dir(&root).unwrap();
        fs::set_permissions(&root, fs::Permissions::from_mode(0o700)).unwrap();
        let aux = root.join(".screenwriter");
        fs::create_dir(&aux).unwrap();
        fs::set_permissions(&aux, fs::Permissions::from_mode(0o700)).unwrap();
        fs::write(
            aux.join("project.json"),
            json!({
                "schemaVersion": 1,
                "projectId": project_id,
                "sourceFilename": file,
                "pdfProfile": "us-letter-draft",
            })
            .to_string(),
        )
        .unwrap();
        fs::set_permissions(aux.join("project.json"), fs::Permissions::from_mode(0o600)).unwrap();
        let path = root.join(file);
        fs::write(&path, b"managed original").unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
        path
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).unwrap();
    }
}

type DiskState = BTreeMap<PathBuf, Vec<u8>>;
fn disk_state(path: &Path) -> DiskState {
    let mut output = BTreeMap::new();
    fn visit(path: &Path, output: &mut DiskState) {
        for entry in fs::read_dir(path).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();
            if fs::symlink_metadata(&path).unwrap().is_dir() {
                visit(&path, output);
            } else {
                output.insert(path, fs::read(entry.path()).unwrap());
            }
        }
    }
    visit(path, &mut output);
    output
}

fn checkpoint(service: &mut DocumentService, opened: &OpenDocument, version: u64, source: &[u8]) {
    service
        .checkpoint(
            &opened.identity,
            version,
            source,
            &source_hash(source),
            json!({"draft": true}),
        )
        .unwrap();
}

fn latest_selection(service: &DocumentService, opened: &OpenDocument) -> RecoverySelection {
    service
        .inspect_recovery(&opened.identity)
        .unwrap()
        .latest
        .map(|checkpoint| RecoverySelection {
            document_id: checkpoint.metadata.document_id.clone(),
            origin: RecoveryOrigin::Current,
            record_sha256: source_hash(&checkpoint.encode().unwrap()),
        })
        .unwrap()
}

fn compare_request(opened: &OpenDocument, selection: &RecoverySelection) -> CompareRequest {
    CompareRequest {
        identity: opened.identity.clone(),
        selection: selection.clone(),
    }
}

#[test]
fn compare_reports_identical_then_divergence_then_missing_without_choosing() {
    let fixture = Fixture::new();
    let mut service = fixture.service();
    let path = fixture.source("story.fountain", b"original");
    let opened = service.open_selected(&path).unwrap();
    checkpoint(&mut service, &opened, 21, b"original");
    let selection = latest_selection(&service, &opened);
    let compared = service
        .compare_recovery(&compare_request(&opened, &selection))
        .unwrap();
    assert!(compared.identical);
    assert!(!compared.external_divergence);
    assert_eq!(compared.transaction, ChoiceTransaction::NoTransaction);
    assert_eq!(compared.source.status, ChoiceSourceStatus::Current);

    fs::write(&path, b"external edit").unwrap();
    let compared = service
        .compare_recovery(&compare_request(&opened, &selection))
        .unwrap();
    assert!(!compared.identical);
    assert!(compared.external_divergence);
    assert_eq!(
        compared.source.source_sha256.as_deref(),
        Some(source_hash(b"external edit").as_str())
    );

    fs::remove_file(&path).unwrap();
    let compared = service
        .compare_recovery(&compare_request(&opened, &selection))
        .unwrap();
    assert!(!compared.identical);
    assert!(compared.external_divergence);
    assert_eq!(compared.source.status, ChoiceSourceStatus::Missing);
}

#[test]
fn stale_foreign_and_malformed_selections_fail_without_touching_disk() {
    let fixture = Fixture::new();
    let mut service = fixture.service();
    let path = fixture.source("story.fountain", b"original");
    let opened = service.open_selected(&path).unwrap();
    checkpoint(&mut service, &opened, 21, b"edited");
    let selection = latest_selection(&service, &opened);

    let mut wrong_origin = selection.clone();
    wrong_origin.origin = RecoveryOrigin::Previous;
    assert_eq!(
        service
            .compare_recovery(&compare_request(&opened, &wrong_origin))
            .unwrap_err()
            .code,
        ErrorCode::RecoveryNeedsAttention
    );
    let mut foreign = selection.clone();
    foreign.document_id = "33333333-3333-4333-8333-333333333333".to_owned();
    assert_eq!(
        service
            .compare_recovery(&compare_request(&opened, &foreign))
            .unwrap_err()
            .code,
        ErrorCode::IdentityMismatch
    );
    let mut malformed = selection.clone();
    malformed.record_sha256 = "not-a-hash".to_owned();
    assert_eq!(
        service
            .compare_recovery(&compare_request(&opened, &malformed))
            .unwrap_err()
            .code,
        ErrorCode::InvalidCheckpoint
    );
    // Rotating the journal twice retires the oldest selection instead of
    // substituting a newer generation for it.
    checkpoint(&mut service, &opened, 22, b"edited again");
    checkpoint(&mut service, &opened, 23, b"edited a third time");
    let before = disk_state(&fixture.0);
    assert_eq!(
        service
            .compare_recovery(&compare_request(&opened, &selection))
            .unwrap_err()
            .code,
        ErrorCode::RecoveryNeedsAttention
    );
    assert_eq!(disk_state(&fixture.0), before);
}

#[test]
fn recover_as_current_preserves_previous_and_recovery_across_restart() {
    let fixture = Fixture::new();
    let mut service = fixture.service();
    let path = fixture.source("story.fountain", b"original");
    let opened = service.open_selected(&path).unwrap();
    let baseline = opened.fingerprint.clone().unwrap();
    checkpoint(&mut service, &opened, 21, b"edited");
    let selection = latest_selection(&service, &opened);

    let receipt = service
        .recover_checkpoint_as_current(&RecoverRequest {
            identity: opened.identity.clone(),
            selection: selection.clone(),
            new_version: 22,
            expected_fingerprint: baseline,
        })
        .unwrap();
    assert_eq!(receipt.version, 22);
    assert_eq!(receipt.source_sha256, source_hash(b"edited"));
    assert_eq!(fs::read(&path).unwrap(), b"edited");
    drop(service);

    // Restart sees the adopted generation with the old source retained. The new
    // session must still make one explicit choice before it may save again.
    let mut restarted = fixture.service();
    let reopened = restarted.open_selected(&path).unwrap();
    assert_eq!(reopened.identity.document_id, opened.identity.document_id);
    assert_ne!(reopened.identity.session_id, opened.identity.session_id);
    let latest = restarted
        .inspect_recovery(&reopened.identity)
        .unwrap()
        .latest
        .unwrap();
    assert_eq!(latest.metadata.version, 22);
    assert_eq!(latest.source, b"edited");
    let inspection = restarted.inspect_source_save(&reopened.identity).unwrap();
    assert_eq!(
        inspection.previous.as_deref(),
        Some(b"original".as_slice()),
        "the replaced generation stays readable beside the adopted one"
    );
    // The new session must still make one explicit choice: admission alone is
    // not a receipt, and its first execution stays blocked on the older
    // journal until it chooses.
    restarted
        .enqueue_save(screenwriter_core::documents::saving::SaveRequest {
            identity: reopened.identity.clone(),
            version: 23,
            source: b"edited once more".to_vec(),
            source_sha256: source_hash(b"edited once more"),
            expected_fingerprint: reopened.fingerprint.clone().unwrap(),
            draft_metadata: json!({"draft": true}),
        })
        .unwrap();
    let failure = restarted.save_next(&reopened.identity).unwrap_err();
    assert_eq!(failure.error.code, ErrorCode::RecoveryNeedsAttention);
    assert_eq!(
        failure.replacement,
        screenwriter_core::documents::saving::ReplacementState::SourceUnchanged
    );
    // Comparing shows identical generations; keeping reconciles this session,
    // and ordinary saves continue on the adopted baseline.
    let selection = latest_selection(&restarted, &reopened);
    let compared = restarted
        .compare_recovery(&compare_request(&reopened, &selection))
        .unwrap();
    assert!(compared.identical);
    assert!(!compared.external_divergence);
    restarted
        .keep_current_source(&KeepRequest {
            identity: reopened.identity.clone(),
            selection,
            expected_fingerprint: reopened.fingerprint.clone().unwrap(),
        })
        .unwrap();
    restarted
        .enqueue_save(screenwriter_core::documents::saving::SaveRequest {
            identity: reopened.identity.clone(),
            version: 23,
            source: b"edited once more".to_vec(),
            source_sha256: source_hash(b"edited once more"),
            expected_fingerprint: reopened.fingerprint.clone().unwrap(),
            draft_metadata: json!({"draft": true}),
        })
        .unwrap();
    restarted.save_next(&reopened.identity).unwrap().unwrap();
    assert_eq!(fs::read(&path).unwrap(), b"edited once more");
}

#[test]
fn older_session_blocks_checkpoints_until_explicit_recover_or_keep() {
    let fixture = Fixture::new();
    let mut first = fixture.service();
    let path = fixture.source("story.fountain", b"original");
    let opened = first.open_selected(&path).unwrap();
    checkpoint(&mut first, &opened, 21, b"edited");
    let selection = latest_selection(&first, &opened);
    drop(first);

    let mut second = fixture.service();
    let reopened = second.open_selected(&path).unwrap();
    assert_ne!(reopened.identity.session_id, opened.identity.session_id);
    assert_eq!(
        second
            .checkpoint(
                &reopened.identity,
                22,
                b"new session writing",
                &source_hash(b"new session writing"),
                json!({}),
            )
            .unwrap_err()
            .code,
        ErrorCode::RecoveryNeedsAttention
    );
    // Explicit keep preserves both and unblocks this session only.
    let before = disk_state(&fixture.0);
    let compared = second
        .keep_current_source(&KeepRequest {
            identity: reopened.identity.clone(),
            selection: selection.clone(),
            expected_fingerprint: reopened.fingerprint.clone().unwrap(),
        })
        .unwrap();
    assert!(!compared.identical);
    assert_eq!(disk_state(&fixture.0), before);
    second
        .checkpoint(
            &reopened.identity,
            22,
            b"new session writing",
            &source_hash(b"new session writing"),
            json!({}),
        )
        .unwrap();
    drop(second);

    // A third session faces the older recovery again until it chooses.
    let mut third = fixture.service();
    let rethird = third.open_selected(&path).unwrap();
    assert_eq!(
        third
            .checkpoint(
                &rethird.identity,
                23,
                b"third session",
                &source_hash(b"third session"),
                json!({}),
            )
            .unwrap_err()
            .code,
        ErrorCode::RecoveryNeedsAttention
    );
    let receipt = third
        .recover_checkpoint_as_current(&RecoverRequest {
            identity: rethird.identity.clone(),
            selection: latest_selection(&third, &rethird),
            new_version: 24,
            expected_fingerprint: rethird.fingerprint.clone().unwrap(),
        })
        .unwrap();
    assert_eq!(receipt.version, 24);
}

#[test]
fn recover_rejects_stale_diverged_unsupported_and_view_only() {
    let fixture = Fixture::new();
    let mut service = fixture.service();
    let path = fixture.source("story.fountain", b"original");
    let opened = service.open_selected(&path).unwrap();
    let baseline = opened.fingerprint.clone().unwrap();
    checkpoint(&mut service, &opened, 21, b"edited");
    let selection = latest_selection(&service, &opened);

    // Stale version and stale fingerprint both fail without writing.
    assert_eq!(
        service
            .recover_checkpoint_as_current(&RecoverRequest {
                identity: opened.identity.clone(),
                selection: selection.clone(),
                new_version: 21,
                expected_fingerprint: baseline.clone(),
            })
            .unwrap_err()
            .error
            .code,
        ErrorCode::StaleRecoveryVersion
    );
    let mut stale = baseline.clone();
    stale.byte_length += 1;
    assert_eq!(
        service
            .recover_checkpoint_as_current(&RecoverRequest {
                identity: opened.identity.clone(),
                selection: selection.clone(),
                new_version: 22,
                expected_fingerprint: stale,
            })
            .unwrap_err()
            .error
            .code,
        ErrorCode::SourceChanged
    );
    // Malformed recovery is not adoptable as a UTF-8 source; the bytes stay.
    let raw = b"\xff\xfe invalid utf-8";
    checkpoint(&mut service, &opened, 22, raw);
    let malformed = latest_selection(&service, &opened);
    assert_eq!(
        service
            .recover_checkpoint_as_current(&RecoverRequest {
                identity: opened.identity.clone(),
                selection: malformed,
                new_version: 23,
                expected_fingerprint: baseline.clone(),
            })
            .unwrap_err()
            .error
            .code,
        ErrorCode::InvalidSave
    );
    assert_eq!(fs::read(&path).unwrap(), b"original");
    // External divergence preserves both generations instead of overwriting.
    fs::write(&path, b"external").unwrap();
    assert_eq!(
        service
            .recover_checkpoint_as_current(&RecoverRequest {
                identity: opened.identity.clone(),
                selection: selection.clone(),
                new_version: 24,
                expected_fingerprint: baseline.clone(),
            })
            .unwrap_err()
            .error
            .code,
        ErrorCode::SourceChanged
    );
    assert_eq!(fs::read(&path).unwrap(), b"external");

    // A read-only second holder cannot adopt.
    fs::set_permissions(&path, fs::Permissions::from_mode(0o400)).unwrap();
    let viewed = service.open_selected(&path).unwrap();
    assert!(matches!(
        viewed.ownership,
        screenwriter_core::documents::Ownership::ViewOnly { .. }
    ));
    checkpoint(&mut service, &opened, 24, b"edited again");
    let current = latest_selection(&service, &opened);
    assert_eq!(
        service
            .recover_checkpoint_as_current(&RecoverRequest {
                identity: viewed.identity.clone(),
                selection: current,
                new_version: 25,
                expected_fingerprint: viewed.fingerprint.clone().unwrap(),
            })
            .unwrap_err()
            .error
            .code,
        ErrorCode::OwnershipRequired
    );
    fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
}

#[test]
fn keep_rejects_stale_expected_and_missing_source() {
    let fixture = Fixture::new();
    let mut service = fixture.service();
    let path = fixture.source("story.fountain", b"original");
    let opened = service.open_selected(&path).unwrap();
    checkpoint(&mut service, &opened, 21, b"edited");
    let selection = latest_selection(&service, &opened);

    let mut stale = opened.fingerprint.clone().unwrap();
    stale.inode = format!("{}x", stale.inode);
    assert_eq!(
        service
            .keep_current_source(&KeepRequest {
                identity: opened.identity.clone(),
                selection: selection.clone(),
                expected_fingerprint: stale,
            })
            .unwrap_err()
            .code,
        ErrorCode::SourceChanged
    );
    fs::remove_file(&path).unwrap();
    assert_eq!(
        service
            .keep_current_source(&KeepRequest {
                identity: opened.identity.clone(),
                selection,
                expected_fingerprint: opened.fingerprint.clone().unwrap(),
            })
            .unwrap_err()
            .code,
        ErrorCode::MissingSource
    );
}

#[test]
fn save_recovered_copy_writes_sibling_and_survives_missing_source() {
    let fixture = Fixture::new();
    let mut service = fixture.service();
    let path = fixture.source("story.fountain", b"original");
    let opened = service.open_selected(&path).unwrap();
    let baseline = opened.fingerprint.clone().unwrap();
    checkpoint(&mut service, &opened, 21, b"edited");
    let selection = latest_selection(&service, &opened);

    let receipt = service
        .save_recovered_copy(&CopyRequest {
            identity: opened.identity.clone(),
            selection: selection.clone(),
            expected_fingerprint: baseline.clone(),
        })
        .unwrap();
    assert_eq!(receipt.version, 21);
    assert_eq!(receipt.source_sha256, source_hash(b"edited"));
    assert!(receipt.file_name.starts_with("story.fountain.recovered-"));
    assert!(receipt.file_name.ends_with(".fountain"));
    assert!(!receipt.file_name.contains('/'));
    let sibling = fixture.0.join(&receipt.file_name);
    assert_eq!(fs::read(&sibling).unwrap(), b"edited");
    assert_eq!(
        fs::symlink_metadata(&sibling).unwrap().permissions().mode() & 0o777,
        0o600
    );
    assert_eq!(fs::read(&path).unwrap(), b"original");

    // A stale compare against an unchanged source fails; a deleted source
    // still permits the emergency copy.
    let mut stale = baseline.clone();
    stale.byte_length += 1;
    assert_eq!(
        service
            .save_recovered_copy(&CopyRequest {
                identity: opened.identity.clone(),
                selection: selection.clone(),
                expected_fingerprint: stale,
            })
            .unwrap_err()
            .code,
        ErrorCode::SourceChanged
    );
    fs::remove_file(&path).unwrap();
    let emergency = service
        .save_recovered_copy(&CopyRequest {
            identity: opened.identity.clone(),
            selection,
            expected_fingerprint: baseline,
        })
        .unwrap();
    assert_eq!(
        fs::read(fixture.0.join(&emergency.file_name)).unwrap(),
        b"edited"
    );
}

#[test]
fn save_recovered_copy_carries_malformed_bytes_view_only_sources_cannot_copy_unsaved() {
    let fixture = Fixture::new();
    let mut service = fixture.service();
    let path = fixture.source("story.fountain", b"original");
    let opened = service.open_selected(&path).unwrap();
    let raw = b"\xff\xfe invalid utf-8";
    checkpoint(&mut service, &opened, 21, raw);
    let selection = latest_selection(&service, &opened);

    // Malformed bytes copy exactly even though adoption refuses them.
    let receipt = service
        .save_recovered_copy(&CopyRequest {
            identity: opened.identity.clone(),
            selection,
            expected_fingerprint: opened.fingerprint.clone().unwrap(),
        })
        .unwrap();
    assert_eq!(fs::read(fixture.0.join(&receipt.file_name)).unwrap(), raw);

    // A read-only holder may still export a copy of reviewed recovery.
    fs::set_permissions(&path, fs::Permissions::from_mode(0o400)).unwrap();
    let viewed = service.open_selected(&path).unwrap();
    checkpoint(&mut service, &opened, 22, b"edited");
    let current = latest_selection(&service, &opened);
    let exported = service
        .save_recovered_copy(&CopyRequest {
            identity: viewed.identity.clone(),
            selection: current,
            expected_fingerprint: viewed.fingerprint.clone().unwrap(),
        })
        .unwrap();
    assert_eq!(
        fs::read(fixture.0.join(&exported.file_name)).unwrap(),
        b"edited"
    );
    fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();

    // Unsaved drafts have no sibling directory to receive a copy.
    let unsaved = service.register_unsaved().unwrap();
    service
        .checkpoint(
            &unsaved.identity,
            21,
            b"draft",
            &source_hash(b"draft"),
            json!({}),
        )
        .unwrap();
    let draft = latest_selection(&service, &unsaved);
    let compared = service
        .compare_recovery(&compare_request(&unsaved, &draft))
        .unwrap();
    assert_eq!(compared.source.status, ChoiceSourceStatus::Missing);
}

#[test]
fn second_instance_may_compare_but_never_adopt() {
    let fixture = Fixture::new();
    let mut first = fixture.service();
    let path = fixture.source("story.fountain", b"original");
    let opened = first.open_selected(&path).unwrap();
    checkpoint(&mut first, &opened, 21, b"edited");
    let selection = latest_selection(&first, &opened);

    let mut second = fixture.service();
    let viewed = second.open_selected(&path).unwrap();
    assert!(matches!(
        viewed.ownership,
        screenwriter_core::documents::Ownership::ViewOnly { .. }
    ));
    let compared = second
        .compare_recovery(&compare_request(&viewed, &selection))
        .unwrap();
    assert!(!compared.identical);
    assert_eq!(
        second
            .recover_checkpoint_as_current(&RecoverRequest {
                identity: viewed.identity.clone(),
                selection,
                new_version: 22,
                expected_fingerprint: viewed.fingerprint.clone().unwrap(),
            })
            .unwrap_err()
            .error
            .code,
        ErrorCode::OwnershipRequired
    );
    assert_eq!(fs::read(&path).unwrap(), b"original");
}

#[test]
fn relink_follows_loose_moves_and_managed_renames_safely() {
    let fixture = Fixture::new();
    let mut service = fixture.service();
    let path = fixture.source("story.fountain", b"original");
    let opened = service.open_selected(&path).unwrap();
    checkpoint(&mut service, &opened, 21, b"edited");

    let moved = fixture.0.join("moved.fountain");
    fs::rename(&path, &moved).unwrap();
    assert!(service.validate_owner(&opened.identity).is_err());
    let relinked = service.relink_selected(&opened.identity, &moved).unwrap();
    assert_eq!(relinked.identity.document_id, opened.identity.document_id);
    assert_eq!(relinked.source, b"original");
    service.validate_owner(&opened.identity).unwrap();
    // Recovery association survives the move; adoption still works.
    let selection = latest_selection(&service, &opened);
    let receipt = service
        .recover_checkpoint_as_current(&RecoverRequest {
            identity: opened.identity.clone(),
            selection,
            new_version: 22,
            expected_fingerprint: relinked.fingerprint.clone().unwrap(),
        })
        .unwrap();
    assert_eq!(receipt.version, 22);
    assert_eq!(fs::read(&moved).unwrap(), b"edited");

    // A managed project renamed as a whole relinks with its identity.
    let managed = fixture.managed_project("project", "script.fountain", PROJECT_A);
    let mopened = service.open_selected(&managed).unwrap();
    assert_eq!(mopened.identity.document_id, PROJECT_A);
    assert!(matches!(
        mopened.ownership,
        screenwriter_core::documents::Ownership::Exclusive
    ));
    let renamed_dir = fixture.0.join("project-renamed");
    fs::rename(fixture.0.join("project"), &renamed_dir).unwrap();
    let relinked = service
        .relink_selected(&mopened.identity, &renamed_dir.join("script.fountain"))
        .unwrap();
    assert_eq!(relinked.identity.document_id, PROJECT_A);

    // An unrelated managed project is never adopted as the same document.
    let other = fixture.managed_project("other", "script.fountain", PROJECT_B);
    assert_eq!(
        service
            .relink_selected(&mopened.identity, &other)
            .unwrap_err()
            .code,
        ErrorCode::IdentityMismatch
    );
    // A loose file cannot be relinked onto a managed identity either.
    let loose = fixture.source("loose.fountain", b"loose");
    assert_eq!(
        service
            .relink_selected(&mopened.identity, &loose)
            .unwrap_err()
            .code,
        ErrorCode::IdentityMismatch
    );
    // A read-only target cannot re-establish exclusive authority.
    let moved_back = fixture.0.join("back.fountain");
    fs::write(&moved_back, b"back").unwrap();
    fs::set_permissions(&moved_back, fs::Permissions::from_mode(0o400)).unwrap();
    assert_eq!(
        service
            .relink_selected(&opened.identity, &moved_back)
            .unwrap_err()
            .code,
        ErrorCode::OwnershipRequired
    );
    fs::set_permissions(&moved_back, fs::Permissions::from_mode(0o600)).unwrap();
}

#[test]
fn resolve_reports_no_transaction_without_writing() {
    let fixture = Fixture::new();
    let mut service = fixture.service();
    let path = fixture.source("story.fountain", b"original");
    let opened = service.open_selected(&path).unwrap();
    let before = disk_state(&fixture.0);
    let resolution = service
        .finalize_interrupted_save(&ResolveRequest {
            identity: opened.identity.clone(),
        })
        .unwrap();
    assert_eq!(resolution.observation, ChoiceTransaction::NoTransaction);
    assert!(resolution.completed.is_none());
    assert!(!resolution.previous_preserved);
    assert_eq!(disk_state(&fixture.0), before);
}

#[test]
fn view_only_caller_cannot_relink_and_leaves_disk_identical() {
    // R2: a second service holds the source view-only while the owner keeps
    // exclusive leases. Relinking from the view-only registration must refuse
    // before any identity/lease mutation.
    let fixture = Fixture::new();
    let mut owner = fixture.service();
    let path = fixture.source("story.fountain", b"original");
    let owned = owner.open_selected(&path).unwrap();
    assert_eq!(
        owned.ownership,
        screenwriter_core::documents::Ownership::Exclusive
    );
    let mut other = fixture.service();
    let viewed = other.open_selected(&path).unwrap();
    assert!(matches!(
        viewed.ownership,
        screenwriter_core::documents::Ownership::ViewOnly { .. }
    ));
    let target = fixture.source("unrelated.fountain", b"unrelated");
    let before = disk_state(&fixture.0);
    assert_eq!(
        other
            .relink_selected(&viewed.identity, &target)
            .unwrap_err()
            .code,
        ErrorCode::OwnershipRequired
    );
    assert_eq!(disk_state(&fixture.0), before);
    assert_eq!(fs::read(&path).unwrap(), b"original");
    assert_eq!(fs::read(&target).unwrap(), b"unrelated");
    // The exclusive owner still relinks a genuine move.
    let moved = fixture.0.join("moved.fountain");
    fs::rename(&path, &moved).unwrap();
    let relinked = owner.relink_selected(&owned.identity, &moved).unwrap();
    assert_eq!(relinked.identity.document_id, owned.identity.document_id);
    assert_eq!(fs::read(&moved).unwrap(), b"original");
}

#[test]
fn invalidated_leases_refuse_relink_without_disk_change() {
    let fixture = Fixture::new();
    let mut service = fixture.service();
    let path = fixture.source("story.fountain", b"original");
    let opened = service.open_selected(&path).unwrap();
    assert_eq!(
        opened.ownership,
        screenwriter_core::documents::Ownership::Exclusive
    );
    // Replace held lock inodes so held leases no longer verify.
    let held_locks: Vec<_> = fs::read_dir(fixture.store())
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "lock"))
        .collect();
    assert!(!held_locks.is_empty());
    for lock in held_locks {
        fs::remove_file(&lock).unwrap();
        fs::write(&lock, b"").unwrap();
    }
    let target = fixture.source("moved.fountain", b"original");
    let before = disk_state(&fixture.0);
    let code = service
        .relink_selected(&opened.identity, &target)
        .unwrap_err()
        .code;
    assert!(
        matches!(
            code,
            ErrorCode::OwnershipLost
                | ErrorCode::OwnershipRequired
                | ErrorCode::IdentityStoreUnavailable
        ),
        "unexpected relink error {code:?}"
    );
    assert_eq!(disk_state(&fixture.0), before);
    assert_eq!(fs::read(&path).unwrap(), b"original");
}
