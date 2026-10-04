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
            replacement_metadata: None,
            identity: opened.identity.clone(),
            selection: selection.clone(),
            new_version: 22,
            expected_fingerprint: baseline,
        })
        .unwrap();
    assert_eq!(receipt.version, 22);
    assert_eq!(receipt.source_sha256, source_hash(b"edited"));
    assert_eq!(fs::read(&path).unwrap(), b"edited");
    let history = git2::Repository::open_bare(
        fixture
            .store()
            .join("history")
            .join(format!("{}.git", opened.identity.document_id)),
    )
    .unwrap();
    let prior = history.refname_to_id("refs/heads/main").unwrap();
    let safety = format!("refs/safety/{prior}");
    assert_eq!(history.refname_to_id(&safety).unwrap(), prior);
    let tree = history.find_commit(prior).unwrap().tree().unwrap();
    assert_eq!(tree.len(), 2);
    assert_eq!(
        history
            .find_blob(tree.get_name("screenplay.fountain").unwrap().id())
            .unwrap()
            .content(),
        b"original"
    );
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
fn corrupt_history_blocks_destructive_adoption_but_keeps_recovery_and_normal_save() {
    let fixture = Fixture::new();
    let mut service = fixture.service();
    let path = fixture.source("story.fountain", b"original");
    let opened = service.open_selected(&path).unwrap();
    let id = &opened.identity;
    service
        .record_revision(id, None, b"original", "source-only-v1", "First", false)
        .unwrap();
    let history_main = fixture
        .store()
        .join("history")
        .join(format!("{}.git", id.document_id))
        .join("refs/heads/main");
    fs::write(&history_main, b"bad-ref\n").unwrap();
    checkpoint(&mut service, &opened, 21, b"edited");
    let selection = latest_selection(&service, &opened);
    let failure = service
        .recover_checkpoint_as_current(&RecoverRequest {
            replacement_metadata: None,
            identity: id.clone(),
            selection,
            new_version: 22,
            expected_fingerprint: opened.fingerprint.clone().unwrap(),
        })
        .unwrap_err();
    assert_eq!(failure.error.code, ErrorCode::HistoryNeedsAttention);
    assert_eq!(fs::read(&path).unwrap(), b"original");
    assert_eq!(
        service.inspect_recovery(id).unwrap().latest.unwrap().source,
        b"edited"
    );
    assert_eq!(fs::read(&history_main).unwrap(), b"bad-ref\n");
    let saved = service
        .save_request(screenwriter_core::documents::saving::SaveRequest {
            identity: id.clone(),
            version: 22,
            source: b"edited".to_vec(),
            source_sha256: source_hash(b"edited"),
            expected_fingerprint: opened.fingerprint.clone().unwrap(),
            draft_metadata: json!({"draft": true}),
        })
        .unwrap();
    assert_eq!(saved.version, 22);
    assert_eq!(fs::read(&path).unwrap(), b"edited");
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
            replacement_metadata: None,
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
                replacement_metadata: None,
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
                replacement_metadata: None,
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
                replacement_metadata: None,
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
                replacement_metadata: None,
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
                replacement_metadata: None,
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
                replacement_metadata: None,
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
