#![cfg(target_os = "linux")]
mod common;
use common::TestRoot;
use screenwriter_core::documents::{recovery::*, saving::*, *};
use std::{fs, os::unix::fs::PermissionsExt};
use uuid::Uuid;

const ORIGINAL: &[u8] = b"\xef\xbb\xbfTitle:  Synthetic\r\n\r\n  \r\n[[unknown";
struct Fixture(TestRoot);
impl Fixture {
    fn new() -> Self {
        let root = TestRoot::new("BABEL_SAVE_TEST_ROOT", "babel-save-api");
        root.write("script.fountain", ORIGINAL, 0o640);
        Self(root)
    }
    fn service(&self) -> DocumentService {
        DocumentService::new(&self.0.join("app-data")).unwrap()
    }
    fn open(&self) -> (DocumentService, OpenDocument) {
        let mut service = self.service();
        let opened = service
            .open_selected(&self.0.join("script.fountain"))
            .unwrap();
        (service, opened)
    }
    fn bytes(&self) -> Vec<u8> {
        fs::read(self.0.join("script.fountain")).unwrap()
    }
}
fn request(open: &OpenDocument, version: u64, source: &[u8]) -> SaveRequest {
    SaveRequest {
        identity: open.identity.clone(),
        version,
        source: source.to_vec(),
        source_sha256: source_hash(source),
        expected_fingerprint: open.fingerprint.clone().unwrap(),
        draft_metadata: serde_json::json!({"emptyBlock":"character","unknownState":[1,null]}),
    }
}

#[test]
fn no_op_save_preserves_bom_crlf_spaces_and_unknown_fountain_bytes() {
    let f = Fixture::new();
    let (mut service, opened) = f.open();
    service.enqueue_save(request(&opened, 1, ORIGINAL)).unwrap();
    let saved = service.save_next(&opened.identity).unwrap().unwrap();
    assert_eq!(saved.version, 1);
    assert_eq!(saved.source_sha256, source_hash(ORIGINAL));
    assert_eq!(saved.fingerprint.sha256, source_hash(&f.bytes()));
    assert_eq!(saved.protection, SaveProtection::SourceFile);
    assert_eq!(
        saved.recovery.protection,
        CheckpointProtection::RecoveryCheckpoint
    );
    assert_eq!(f.bytes(), ORIGINAL);
    assert_eq!(service.read_initial(&opened.identity).unwrap(), opened);
    service.validate_owner(&opened.identity).unwrap();
    // SPEC S06.1 no-op fidelity: identical bytes are acknowledged without a rewrite,
    // so no transaction or previous-generation copy is published (AUDIT-C04).
    assert_eq!(Some(&saved.fingerprint), opened.fingerprint.as_ref());
    let inspection = service.inspect_source_save(&opened.identity).unwrap();
    assert!(inspection.previous.is_none() && inspection.confirmed.is_none());
    assert_eq!(inspection.observation, SaveObservation::NoTransaction);
    let duplicate_recovery = service
        .checkpoint(
            &opened.identity,
            1,
            ORIGINAL,
            &source_hash(ORIGINAL),
            request(&opened, 1, ORIGINAL).draft_metadata,
        )
        .unwrap();
    assert_eq!(duplicate_recovery, saved.recovery);
    // An ordinary checkpoint after saving uses the new disk fingerprint.
    service
        .checkpoint(
            &opened.identity,
            2,
            b"draft after save",
            &source_hash(b"draft after save"),
            serde_json::Value::Null,
        )
        .unwrap();
    assert_eq!(
        service
            .inspect_recovery(&opened.identity)
            .unwrap()
            .latest
            .unwrap()
            .metadata
            .base_fingerprint,
        Some(saved.fingerprint)
    );
}

#[test]
fn immutable_queue_is_bounded_fifo_and_document_scoped() {
    let f = Fixture::new();
    let (mut service, opened) = f.open();
    let mut copied = request(&opened, 1, b"captured snapshot");
    service.enqueue_save(copied.clone()).unwrap();
    copied.source.fill(b'x');
    for version in 2..=MAX_QUEUED_SAVES as u64 {
        service
            .enqueue_save(request(&opened, version, b"later draft"))
            .unwrap();
    }
    assert_eq!(
        service
            .enqueue_save(request(&opened, 9, b"queue overflow"))
            .unwrap_err()
            .code,
        ErrorCode::SaveQueueFull
    );
    assert_eq!(
        service
            .enqueue_save(request(&opened, 8, b"stale"))
            .unwrap_err()
            .code,
        ErrorCode::StaleSaveVersion
    );
    assert_eq!(f.bytes(), ORIGINAL);
    assert_eq!(
        service.release(&opened.identity).unwrap_err().code,
        ErrorCode::SaveNeedsAttention
    );
    assert_eq!(
        service
            .save_next(&opened.identity)
            .unwrap()
            .unwrap()
            .version,
        1
    );
    assert_eq!(f.bytes(), b"captured snapshot");
    for version in 2..=MAX_QUEUED_SAVES as u64 {
        assert_eq!(
            service
                .save_next(&opened.identity)
                .unwrap()
                .unwrap()
                .version,
            version
        );
    }
    assert!(service.save_next(&opened.identity).unwrap().is_none());
    service.validate_owner(&opened.identity).unwrap();
    assert_eq!(
        fs::read_dir(
            f.0.join("app-data/source-save")
                .join(&opened.identity.document_id)
        )
        .unwrap()
        .count(),
        2
    );
    assert!(!fs::read_dir(&f.0).unwrap().any(|entry| {
        entry
            .unwrap()
            .file_name()
            .to_string_lossy()
            .starts_with(".babel-save-")
    }));
}

#[test]
fn queued_payload_byte_limit_applies_across_documents() {
    let f = Fixture::new();
    let (mut service, opened) = f.open();
    let large = vec![b' '; MAX_SOURCE_BYTES];
    service.enqueue_save(request(&opened, 1, &large)).unwrap();
    let other_path = f.0.join("other.fountain");
    fs::write(&other_path, b"other").unwrap();
    fs::set_permissions(&other_path, fs::Permissions::from_mode(0o600)).unwrap();
    let other = service.open_selected(&other_path).unwrap();
    assert_eq!(
        service
            .enqueue_save(request(&other, 1, &large))
            .unwrap_err()
            .code,
        ErrorCode::SaveQueueFull
    );
    assert_eq!(f.bytes(), ORIGINAL);
    assert_eq!(fs::read(other_path).unwrap(), b"other");
}

#[test]
fn malformed_requests_reject_without_source_or_recovery_writes() {
    let f = Fixture::new();
    let (mut service, opened) = f.open();
    for case in 0..8 {
        let mut req = request(&opened, 1, b"[[unfinished");
        let expected = match case {
            0 => {
                req.version = 0;
                ErrorCode::InvalidSave
            }
            1 => {
                req.version = MAX_VERSION + 1;
                ErrorCode::InvalidSave
            }
            2 => {
                req.source = vec![0xff];
                req.source_sha256 = source_hash(&req.source);
                ErrorCode::InvalidSave
            }
            3 => {
                req.source_sha256 = "0".repeat(64);
                ErrorCode::InvalidSave
            }
            4 => {
                req.expected_fingerprint.sha256 = "0".repeat(64);
                ErrorCode::SourceChanged
            }
            5 => {
                req.identity.session_id = Uuid::new_v4().to_string();
                ErrorCode::IdentityMismatch
            }
            6 => {
                req.identity.handle = Uuid::new_v4().to_string();
                ErrorCode::InvalidHandle
            }
            _ => {
                req.draft_metadata = serde_json::json!("x".repeat(MAX_DRAFT_METADATA_BYTES));
                ErrorCode::InvalidSave
            }
        };
        assert_eq!(service.enqueue_save(req).unwrap_err().code, expected);
    }
    assert_eq!(f.bytes(), ORIGINAL);
    assert!(service.save_next(&opened.identity).unwrap().is_none());
    assert!(
        service
            .inspect_recovery(&opened.identity)
            .unwrap()
            .latest
            .is_none()
    );
    assert_eq!(
        service
            .inspect_source_save(&opened.identity)
            .unwrap()
            .observation,
        SaveObservation::NoTransaction
    );
}

#[test]
fn external_divergence_protects_local_checkpoint_without_overwriting_or_adopting_external() {
    let f = Fixture::new();
    let (mut service, opened) = f.open();
    service
        .enqueue_save(request(&opened, 21, b"local unsaved draft"))
        .unwrap();
    fs::write(f.0.join("script.fountain"), b"external writer draft").unwrap();
    let failure = service.save_next(&opened.identity).unwrap_err();
    assert_eq!(failure.replacement, ReplacementState::SourceUnchanged);
    assert_eq!(failure.error.code, ErrorCode::SourceChanged);
    assert_eq!(failure.recovery.unwrap().version, 21);
    assert_eq!(f.bytes(), b"external writer draft");
    assert_eq!(
        service
            .inspect_recovery(&opened.identity)
            .unwrap()
            .latest
            .unwrap()
            .source,
        b"local unsaved draft"
    );
    assert_eq!(
        service.read_initial(&opened.identity).unwrap().source,
        ORIGINAL
    );
    assert_eq!(
        service.enqueue_save(request(&opened, 22, b"even newer local draft")),
        Ok(())
    );
    assert_eq!(
        service.save_next(&opened.identity).unwrap_err().error.code,
        ErrorCode::SourceChanged
    );
    assert_eq!(f.bytes(), b"external writer draft");
}

#[test]
fn deletion_rename_and_changed_parent_block_source_replacement_but_keep_recovery() {
    for case in 0..3 {
        let f = Fixture::new();
        let (mut service, opened) = f.open();
        service
            .enqueue_save(request(&opened, 21, b"local source"))
            .unwrap();
        match case {
            0 => fs::remove_file(f.0.join("script.fountain")).unwrap(),
            1 => fs::rename(f.0.join("script.fountain"), f.0.join("moved.fountain")).unwrap(),
            _ => {
                fs::set_permissions(&f.0, fs::Permissions::from_mode(0o500)).unwrap();
            }
        }
        let failed = service.save_next(&opened.identity).unwrap_err();
        assert_eq!(failed.replacement, ReplacementState::SourceUnchanged);
        assert_eq!(
            service
                .inspect_recovery(&opened.identity)
                .unwrap()
                .latest
                .unwrap()
                .source,
            b"local source"
        );
        assert!(!f.0.join("script.fountain").exists() || f.bytes() == ORIGINAL);
        if case == 2 {
            fs::set_permissions(&f.0, fs::Permissions::from_mode(0o700)).unwrap();
        }
    }
}

#[test]
fn managed_storage_is_private_and_project_metadata_is_never_changed() {
    let f = Fixture::new();
    fs::create_dir(f.0.join(".screenwriter")).unwrap();
    fs::set_permissions(f.0.join(".screenwriter"), fs::Permissions::from_mode(0o700)).unwrap();
    let metadata = serde_json::to_vec(&serde_json::json!({"schemaVersion":1,"projectId":Uuid::new_v4().to_string(),"sourceFilename":"script.fountain","pdfProfile":"default","unknown":{"keep":true}})).unwrap();
    fs::write(f.0.join(".screenwriter/project.json"), &metadata).unwrap();
    let (mut service, opened) = f.open();
    assert_eq!(opened.kind, DocumentKind::Managed);
    service
        .enqueue_save(request(&opened, 21, b"managed draft\r\n  "))
        .unwrap();
    let receipt = service.save_next(&opened.identity).unwrap().unwrap();
    assert_eq!(receipt.identity, opened.identity);
    assert_eq!(
        fs::read(f.0.join(".screenwriter/project.json")).unwrap(),
        metadata
    );
    let dir =
        f.0.join(".screenwriter/source-save")
            .join(&opened.identity.document_id);
    assert_eq!(
        fs::metadata(&dir).unwrap().permissions().mode() & 0o7777,
        0o700
    );
    for name in ["previous", "confirmed"] {
        assert_eq!(
            fs::metadata(dir.join(name)).unwrap().permissions().mode() & 0o7777,
            0o600
        );
    }
    assert!(!f.0.join("app-data/source-save").exists());
    drop(service);
    let (mut restarted, reopened) = f.open();
    assert_eq!(reopened.identity.document_id, opened.identity.document_id);
    assert_eq!(
        restarted
            .inspect_source_save(&reopened.identity)
            .unwrap()
            .observation,
        SaveObservation::ConfirmedRecordMatchesSource
    );
    restarted
        .enqueue_save(request(&reopened, 22, b"draft from new session"))
        .unwrap();
    assert_eq!(
        restarted
            .save_next(&reopened.identity)
            .unwrap_err()
            .error
            .code,
        ErrorCode::RecoveryNeedsAttention
    );
    assert_eq!(f.bytes(), b"managed draft\r\n  ");
}

#[test]
fn read_only_and_unsaved_identities_cannot_replace_a_named_source() {
    let f = Fixture::new();
    fs::set_permissions(
        f.0.join("script.fountain"),
        fs::Permissions::from_mode(0o400),
    )
    .unwrap();
    let (mut service, opened) = f.open();
    assert_eq!(
        service
            .enqueue_save(request(&opened, 1, b"new"))
            .unwrap_err()
            .code,
        ErrorCode::OwnershipRequired
    );
    let unsaved = service.register_unsaved().unwrap();
    let mut req = request(&opened, 1, b"new");
    req.identity = unsaved.identity.clone();
    assert_eq!(
        service.enqueue_save(req).unwrap_err().code,
        ErrorCode::MissingSource
    );
    service
        .checkpoint(
            &unsaved.identity,
            1,
            b"\xffraw emergency",
            &source_hash(b"\xffraw emergency"),
            serde_json::Value::Null,
        )
        .unwrap();
    assert_eq!(
        service
            .inspect_recovery(&unsaved.identity)
            .unwrap()
            .latest
            .unwrap()
            .source,
        b"\xffraw emergency"
    );
    assert_eq!(f.bytes(), ORIGINAL);
}

#[test]
fn source_acl_and_extended_attributes_are_rejected_without_silent_metadata_loss() {
    let mut acl = 2u32.to_le_bytes().to_vec(); // Linux POSIX ACL xattr version.
    for (tag, permission, user) in [
        (1u16, 6u16, u32::MAX),
        (2, 0, rustix::process::geteuid().as_raw() + 1),
        (4, 0, u32::MAX),
        (16, 0, u32::MAX),
        (32, 0, u32::MAX),
    ] {
        acl.extend_from_slice(&tag.to_le_bytes());
        acl.extend_from_slice(&permission.to_le_bytes());
        acl.extend_from_slice(&user.to_le_bytes());
    }
    for (name, value) in [
        ("user.babel-test", b"preserve synthetic metadata".to_vec()),
        ("system.posix_acl_access", acl),
    ] {
        let f = Fixture::new();
        let file = fs::File::open(f.0.join("script.fountain")).unwrap();
        rustix::fs::fsetxattr(&file, name, &value, rustix::fs::XattrFlags::CREATE).unwrap();
        let (mut service, opened) = f.open();
        assert_eq!(opened.ownership, Ownership::Exclusive);
        service
            .enqueue_save(request(&opened, 21, b"draft needing save"))
            .unwrap();
        let failure = service.save_next(&opened.identity).unwrap_err();
        assert_eq!(failure.error.code, ErrorCode::SaveNeedsAttention);
        assert_eq!(failure.replacement, ReplacementState::SourceUnchanged);
        assert_eq!(f.bytes(), ORIGINAL);
        let mut captured = [0u8; 64];
        let length = rustix::fs::fgetxattr(&file, name, &mut captured[..]).unwrap();
        assert_eq!(&captured[..length], &value);
        assert_eq!(
            service
                .inspect_recovery(&opened.identity)
                .unwrap()
                .latest
                .unwrap()
                .source,
            b"draft needing save"
        );
    }
}
