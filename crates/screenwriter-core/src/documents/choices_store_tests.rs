//! In-crate choice tests. Fault gates compile into test binaries only; no
//! runtime hook or general filesystem endpoint is added.
use super::*;
use crate::documents::recovery::source_hash;
use crate::test_support::TestRoot;
use std::os::unix::fs::PermissionsExt;

struct Fixture {
    _root: TestRoot,
    store: PathBuf,
    source: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        let root = TestRoot::new("BABEL_CHOICES_TEST_ROOT", "babel-choices");
        let source = root.join("story.fountain");
        std::fs::write(&source, b"original").unwrap();
        std::fs::set_permissions(&source, std::fs::Permissions::from_mode(0o600)).unwrap();
        Self {
            store: root.join("app-data"),
            source,
            _root: root,
        }
    }

    fn service(&self) -> DocumentService {
        DocumentService::new(&self.store).unwrap()
    }

    fn save_request(
        identity: &DocumentRequest,
        version: u64,
        source: &[u8],
        baseline: &DiskFingerprint,
    ) -> SaveRequest {
        SaveRequest {
            identity: identity.clone(),
            version,
            source: source.to_vec(),
            source_sha256: source_hash(source),
            expected_fingerprint: baseline.clone(),
            draft_metadata: serde_json::json!({"draft": true}),
        }
    }
}

#[test]
fn finalize_completes_replaced_but_unconfirmed_save() {
    let fixture = Fixture::new();
    let mut service = fixture.service();
    let opened = service.open_selected(&fixture.source).unwrap();
    let baseline = opened.fingerprint.clone().unwrap();
    service
        .enqueue_save(Fixture::save_request(
            &opened.identity,
            21,
            b"edited",
            &baseline,
        ))
        .unwrap();
    let failure = service
        .save_next_with(&opened.identity, |stage| {
            if format!("{stage:?}") == "Verified" {
                Err(error(ErrorCode::Io))
            } else {
                Ok(())
            }
        })
        .unwrap_err();
    assert_eq!(
        failure.replacement,
        ReplacementState::ReplacedButUnconfirmed
    );
    assert_eq!(
        std::fs::read(&fixture.source).unwrap(),
        b"edited",
        "post-rename failure keeps the installed generation"
    );
    let state = service.inspect_source_save(&opened.identity).unwrap();
    assert_eq!(
        state.observation,
        SaveObservation::InstalledCandidateUnconfirmed
    );
    // A stuck post-replacement transaction blocks ordinary adoption first.
    let compare = service
        .compare_recovery(&CompareRequest {
            identity: opened.identity.clone(),
            selection: service
                .inspect_recovery(&opened.identity)
                .unwrap()
                .latest
                .map(|checkpoint| crate::documents::startup::RecoverySelection {
                    document_id: checkpoint.metadata.document_id.clone(),
                    origin: crate::documents::startup::RecoveryOrigin::Current,
                    record_sha256: source_hash(&checkpoint.encode().unwrap()),
                })
                .unwrap(),
        })
        .unwrap();
    assert_eq!(
        compare.transaction,
        ChoiceTransaction::InstalledCandidateUnconfirmed
    );
    let resolution = service
        .finalize_interrupted_save(&ResolveRequest {
            identity: opened.identity.clone(),
        })
        .unwrap();
    assert_eq!(
        resolution.observation,
        ChoiceTransaction::ConfirmedRecordMatchesSource
    );
    let completed = resolution.completed.expect("finalize completes");
    assert_eq!(completed.version, 21);
    assert!(resolution.previous_preserved);
    assert_eq!(
        std::fs::read(&fixture.source).unwrap(),
        b"edited",
        "finalize never rewrites an installed generation"
    );
    let state = service.inspect_source_save(&opened.identity).unwrap();
    assert_eq!(
        state.observation,
        SaveObservation::ConfirmedRecordMatchesSource
    );
    assert_eq!(state.previous.as_deref(), Some(b"original".as_slice()));
    // A crash between confirmed publication and acknowledgement completes
    // without renaming again.
    let selection = service
        .inspect_recovery(&opened.identity)
        .unwrap()
        .latest
        .map(|checkpoint| crate::documents::startup::RecoverySelection {
            document_id: checkpoint.metadata.document_id.clone(),
            origin: crate::documents::startup::RecoveryOrigin::Current,
            record_sha256: source_hash(&checkpoint.encode().unwrap()),
        })
        .unwrap();
    let baseline = service
        .compare_recovery(&CompareRequest {
            identity: opened.identity.clone(),
            selection: selection.clone(),
        })
        .unwrap()
        .source
        .fingerprint
        .unwrap();
    service
        .enqueue_save(Fixture::save_request(
            &opened.identity,
            22,
            b"edited again",
            &baseline,
        ))
        .unwrap();
    let failure = service
        .save_next_with(&opened.identity, |stage| {
            if format!("{stage:?}") == "Confirmed" {
                Err(error(ErrorCode::Io))
            } else {
                Ok(())
            }
        })
        .unwrap_err();
    assert_eq!(
        failure.replacement,
        ReplacementState::ReplacedButUnconfirmed
    );
    let resolution = service
        .finalize_interrupted_save(&ResolveRequest {
            identity: opened.identity.clone(),
        })
        .unwrap();
    assert_eq!(
        resolution.observation,
        ChoiceTransaction::ConfirmedRecordMatchesSource
    );
    assert_eq!(
        resolution.completed.expect("finalize completes").version,
        22
    );
    assert_eq!(std::fs::read(&fixture.source).unwrap(), b"edited again");
    // Uncertainty clears: the registration releases and saves again cleanly.
    service.release(&opened.identity).unwrap();
}

#[test]
fn interrupted_save_keeps_identical_recovery_choice_required_until_verified_finalize() {
    let fixture = Fixture::new();
    let mut first = fixture.service();
    let opened = first.open_selected(&fixture.source).unwrap();
    first
        .enqueue_save(Fixture::save_request(
            &opened.identity,
            21,
            b"edited",
            opened.fingerprint.as_ref().unwrap(),
        ))
        .unwrap();
    first
        .save_next_with(&opened.identity, |stage| {
            if stage == source_store::Stage::Verified {
                Err(error(ErrorCode::Io))
            } else {
                Ok(())
            }
        })
        .unwrap_err();
    assert!(
        !first
            .list_document_recovery(&opened.identity)
            .unwrap()
            .reconciled,
        "an own-session checkpoint cannot admit an unresolved replacement"
    );
    drop(first);
    let mut second = fixture.service();
    let reopened = second.open_selected(&fixture.source).unwrap();
    assert_eq!(
        second
            .inspect_source_save(&reopened.identity)
            .unwrap()
            .observation,
        SaveObservation::InstalledCandidateUnconfirmed
    );
    assert!(
        !second
            .list_document_recovery(&reopened.identity)
            .unwrap()
            .reconciled
    );
    let latest = second
        .inspect_recovery(&reopened.identity)
        .unwrap()
        .latest
        .unwrap();
    let selection = crate::documents::startup::RecoverySelection {
        document_id: reopened.identity.document_id.clone(),
        origin: crate::documents::startup::RecoveryOrigin::Current,
        record_sha256: source_hash(&latest.encode().unwrap()),
    };
    assert_eq!(
        second
            .keep_current_source(&KeepRequest {
                identity: reopened.identity.clone(),
                selection,
                expected_fingerprint: reopened.fingerprint.clone().unwrap()
            })
            .unwrap_err()
            .code,
        ErrorCode::SaveNeedsAttention
    );
    let resolved = second
        .finalize_interrupted_save(&ResolveRequest {
            identity: reopened.identity.clone(),
        })
        .unwrap();
    assert_eq!(resolved.completed.unwrap().version, 21);
    assert!(
        second
            .list_document_recovery(&reopened.identity)
            .unwrap()
            .reconciled
    );
    assert_eq!(std::fs::read(&fixture.source).unwrap(), b"edited");
}

#[test]
fn failed_save_then_save_as_never_auto_adopts_redirected_work_on_original_reopen() {
    let fixture = Fixture::new();
    let mut first = fixture.service();
    let opened = first.open_selected(&fixture.source).unwrap();
    let redirected = b"work deliberately redirected to B";
    first
        .enqueue_save(Fixture::save_request(
            &opened.identity,
            21,
            redirected,
            opened.fingerprint.as_ref().unwrap(),
        ))
        .unwrap();
    let failure = first
        .save_next_with(&opened.identity, |stage| {
            if stage == source_store::Stage::RecoveryProtected {
                Err(error(ErrorCode::Io))
            } else {
                Ok(())
            }
        })
        .unwrap_err();
    assert!(failure.recovery.is_some());
    assert_eq!(failure.replacement, ReplacementState::SourceUnchanged);
    let destination = fixture.source.with_file_name("B.fountain");
    let target = first
        .select_save_destination(&opened.identity, &destination)
        .unwrap();
    let copied = first
        .save_as_copy(&crate::documents::save_as::SaveAsRequest {
            checkpoint: crate::documents::persistence::CheckpointRequest {
                identity: opened.identity.clone(),
                version: 21,
                source: redirected.to_vec(),
                source_sha256: source_hash(redirected),
                expected_fingerprint: opened.fingerprint.clone(),
                draft_metadata: serde_json::json!({"draft": true}),
            },
            destination_token: target.token,
        })
        .unwrap();
    assert_ne!(
        copied.document.identity.document_id,
        opened.identity.document_id
    );
    let journal = fixture
        .store
        .join("recovery")
        .join(format!("{}.journal", opened.identity.document_id));
    let retained = std::fs::read(&journal).unwrap();
    drop(first);
    let mut second = fixture.service();
    let reopened = second.open_selected(&fixture.source).unwrap();
    assert_eq!(
        second
            .inspect_source_save(&reopened.identity)
            .unwrap()
            .observation,
        SaveObservation::NoTransaction
    );
    assert!(
        !second
            .list_document_recovery(&reopened.identity)
            .unwrap()
            .reconciled
    );
    assert_eq!(std::fs::read(&fixture.source).unwrap(), b"original");
    assert_eq!(std::fs::read(&destination).unwrap(), redirected);
    assert_eq!(std::fs::read(&journal).unwrap(), retained);
}

#[test]
fn finalize_leaves_prepared_and_diverged_states_untouched() {
    let fixture = Fixture::new();
    let mut service = fixture.service();
    let opened = service.open_selected(&fixture.source).unwrap();
    let baseline = opened.fingerprint.clone().unwrap();
    service
        .enqueue_save(Fixture::save_request(
            &opened.identity,
            21,
            b"edited",
            &baseline,
        ))
        .unwrap();
    let failure = service
        .save_next_with(&opened.identity, |stage| {
            if format!("{stage:?}") == "BeforeCandidateWrite" {
                Err(error(ErrorCode::Io))
            } else {
                Ok(())
            }
        })
        .unwrap_err();
    assert_eq!(failure.replacement, ReplacementState::SourceUnchanged);
    assert_eq!(std::fs::read(&fixture.source).unwrap(), b"original");
    let resolution = service
        .finalize_interrupted_save(&ResolveRequest {
            identity: opened.identity.clone(),
        })
        .unwrap();
    assert_eq!(resolution.observation, ChoiceTransaction::Prepared);
    assert!(resolution.completed.is_none());
    assert!(resolution.previous_preserved);
    // Recovery is blocked while the prepared intent is unresolved.
    let selection = service
        .inspect_recovery(&opened.identity)
        .unwrap()
        .latest
        .map(|checkpoint| crate::documents::startup::RecoverySelection {
            document_id: checkpoint.metadata.document_id.clone(),
            origin: crate::documents::startup::RecoveryOrigin::Current,
            record_sha256: source_hash(&checkpoint.encode().unwrap()),
        })
        .unwrap();
    let failure = service
        .recover_checkpoint_as_current(&RecoverRequest {
            replacement_metadata: None,
            identity: opened.identity.clone(),
            selection,
            new_version: 22,
            expected_fingerprint: baseline,
        })
        .unwrap_err();
    assert_eq!(failure.error.code, ErrorCode::SaveNeedsAttention);
    // An external edit after the interruption reports divergence, still unowned.
    std::fs::write(&fixture.source, b"external").unwrap();
    let resolution = service
        .finalize_interrupted_save(&ResolveRequest {
            identity: opened.identity.clone(),
        })
        .unwrap();
    assert_eq!(resolution.observation, ChoiceTransaction::Diverged);
    assert!(resolution.completed.is_none());
    assert_eq!(std::fs::read(&fixture.source).unwrap(), b"external");
}

#[test]
fn finalize_after_rename_before_directory_sync_completes_and_reconfirms() {
    // R1: an interruption at Replaced skips the ordinary source-directory
    // sync. Finalize must finish file/directory durability before any receipt,
    // preserve previous/recovery, and allow an already-confirmed retry.
    let fixture = Fixture::new();
    let mut service = fixture.service();
    let opened = service.open_selected(&fixture.source).unwrap();
    let baseline = opened.fingerprint.clone().unwrap();
    service
        .enqueue_save(Fixture::save_request(
            &opened.identity,
            21,
            b"edited",
            &baseline,
        ))
        .unwrap();
    let failure = service
        .save_next_with(&opened.identity, |stage| {
            if format!("{stage:?}") == "Replaced" {
                Err(error(ErrorCode::Io))
            } else {
                Ok(())
            }
        })
        .unwrap_err();
    assert_eq!(
        failure.replacement,
        ReplacementState::ReplacedButUnconfirmed
    );
    assert_eq!(std::fs::read(&fixture.source).unwrap(), b"edited");
    let state = service.inspect_source_save(&opened.identity).unwrap();
    assert_eq!(
        state.observation,
        SaveObservation::InstalledCandidateUnconfirmed
    );
    let resolution = service
        .finalize_interrupted_save(&ResolveRequest {
            identity: opened.identity.clone(),
        })
        .unwrap();
    assert_eq!(
        resolution.observation,
        ChoiceTransaction::ConfirmedRecordMatchesSource
    );
    let completed = resolution.completed.expect("finalize completes");
    assert_eq!(completed.version, 21);
    assert_eq!(completed.source_sha256, source_hash(b"edited"));
    assert!(resolution.previous_preserved);
    assert_eq!(std::fs::read(&fixture.source).unwrap(), b"edited");
    let state = service.inspect_source_save(&opened.identity).unwrap();
    assert_eq!(
        state.observation,
        SaveObservation::ConfirmedRecordMatchesSource
    );
    assert_eq!(state.previous.as_deref(), Some(b"original".as_slice()));
    assert_eq!(
        service
            .inspect_recovery(&opened.identity)
            .unwrap()
            .latest
            .unwrap()
            .source,
        b"edited"
    );
    // Already-confirmed retry completes again without rewriting the source.
    let retry = service
        .finalize_interrupted_save(&ResolveRequest {
            identity: opened.identity.clone(),
        })
        .unwrap();
    assert_eq!(
        retry.observation,
        ChoiceTransaction::ConfirmedRecordMatchesSource
    );
    assert_eq!(retry.completed.expect("retry completes").version, 21);
    assert_eq!(std::fs::read(&fixture.source).unwrap(), b"edited");
    // Uncertainty clears: the registration releases and saves again cleanly.
    service.release(&opened.identity).unwrap();
}

#[test]
fn finalize_after_restart_completes_pre_directory_sync_interruption() {
    let fixture = Fixture::new();
    let mut service = fixture.service();
    let opened = service.open_selected(&fixture.source).unwrap();
    let baseline = opened.fingerprint.clone().unwrap();
    service
        .enqueue_save(Fixture::save_request(
            &opened.identity,
            21,
            b"edited",
            &baseline,
        ))
        .unwrap();
    let failure = service
        .save_next_with(&opened.identity, |stage| {
            if format!("{stage:?}") == "BeforeDirectorySync" {
                Err(error(ErrorCode::Io))
            } else {
                Ok(())
            }
        })
        .unwrap_err();
    assert_eq!(
        failure.replacement,
        ReplacementState::ReplacedButUnconfirmed
    );
    assert_eq!(std::fs::read(&fixture.source).unwrap(), b"edited");
    drop(service);
    // Restart sees the installed generation with the old copy retained; a
    // fresh registration finalizes the same transaction to a receipt.
    let mut restarted = fixture.service();
    let reopened = restarted.open_selected(&fixture.source).unwrap();
    assert_eq!(reopened.identity.document_id, opened.identity.document_id);
    let resolution = restarted
        .finalize_interrupted_save(&ResolveRequest {
            identity: reopened.identity.clone(),
        })
        .unwrap();
    assert_eq!(
        resolution.observation,
        ChoiceTransaction::ConfirmedRecordMatchesSource
    );
    assert_eq!(resolution.completed.expect("restart finalize").version, 21);
    assert!(resolution.previous_preserved);
    assert_eq!(std::fs::read(&fixture.source).unwrap(), b"edited");
    let state = restarted.inspect_source_save(&reopened.identity).unwrap();
    assert_eq!(state.previous.as_deref(), Some(b"original".as_slice()));
    restarted.release(&reopened.identity).unwrap();
}

#[test]
fn finalize_source_directory_sync_failure_returns_no_receipt() {
    let fixture = Fixture::new();
    let mut service = fixture.service();
    let opened = service.open_selected(&fixture.source).unwrap();
    let baseline = opened.fingerprint.clone().unwrap();
    service
        .enqueue_save(Fixture::save_request(
            &opened.identity,
            21,
            b"edited",
            &baseline,
        ))
        .unwrap();
    let failure = service
        .save_next_with(&opened.identity, |stage| {
            if format!("{stage:?}") == "Replaced" {
                Err(error(ErrorCode::Io))
            } else {
                Ok(())
            }
        })
        .unwrap_err();
    assert_eq!(
        failure.replacement,
        ReplacementState::ReplacedButUnconfirmed
    );
    // Injected source-directory sync failure: no receipt, uncertainty and
    // both generations retained.
    let err = service
        .finalize_interrupted_save_with(
            &ResolveRequest {
                identity: opened.identity.clone(),
            },
            |stage| {
                if format!("{stage:?}") == "BeforeDirectorySync" {
                    Err(error(ErrorCode::Io))
                } else {
                    Ok(())
                }
            },
        )
        .unwrap_err();
    assert_eq!(err.code, ErrorCode::Io);
    assert_eq!(std::fs::read(&fixture.source).unwrap(), b"edited");
    let state = service.inspect_source_save(&opened.identity).unwrap();
    assert_eq!(
        state.observation,
        SaveObservation::InstalledCandidateUnconfirmed
    );
    assert_eq!(state.previous.as_deref(), Some(b"original".as_slice()));
    assert_eq!(
        service
            .inspect_recovery(&opened.identity)
            .unwrap()
            .latest
            .unwrap()
            .source,
        b"edited"
    );
    assert_eq!(
        service.release(&opened.identity).unwrap_err().code,
        ErrorCode::SaveNeedsAttention
    );
    // Retry without the injected failure completes to the exact receipt.
    let resolution = service
        .finalize_interrupted_save(&ResolveRequest {
            identity: opened.identity.clone(),
        })
        .unwrap();
    assert_eq!(resolution.completed.expect("retry completes").version, 21);
    service.release(&opened.identity).unwrap();
}
