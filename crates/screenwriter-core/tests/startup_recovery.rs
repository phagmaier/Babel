#![cfg(target_os = "linux")]
mod common;
use common::TestRoot;
use screenwriter_core::documents::{
    DocumentService, ErrorCode, LocalRecoveryReader,
    recovery::{Checkpoint, source_hash},
    startup::{
        CatalogRequest, MAX_DIRECTORY_ENTRIES, MAX_REVIEW_DOCUMENTS, RecoveryNotice,
        RecoveryOrigin, RecoverySelection,
    },
};
use serde_json::json;
use std::{
    collections::BTreeMap,
    fs,
    os::unix::fs::{MetadataExt, PermissionsExt, symlink},
    path::{Path, PathBuf},
};

struct Fixture(TestRoot);
impl Fixture {
    fn new() -> Self {
        let path = TestRoot::new("BABEL_STARTUP_TEST_ROOT", "babel-startup");
        Self(path)
    }
    fn store(&self) -> PathBuf {
        self.0.join("app-data")
    }
    fn artifact(&self, id: &str, suffix: &str) -> PathBuf {
        self.store().join("recovery").join(format!("{id}.{suffix}"))
    }
    fn seed(&self) -> screenwriter_core::documents::DocumentRequest {
        let mut service = DocumentService::new(&self.store()).unwrap();
        let identity = service.register_unsaved().unwrap().identity;
        service
            .checkpoint(
                &identity,
                21,
                b"\xef\xbb\xbfunknown\r\n  \xff",
                &source_hash(b"\xef\xbb\xbfunknown\r\n  \xff"),
                json!({"unknown":{"preserve":true}}),
            )
            .unwrap();
        service
            .checkpoint(
                &identity,
                22,
                b"<script>not executable</script>\r\n  ",
                &source_hash(b"<script>not executable</script>\r\n  "),
                json!({"unknown":{"preserve":true}}),
            )
            .unwrap();
        identity
    }
    fn reader(&self) -> LocalRecoveryReader {
        LocalRecoveryReader::open(&self.store()).unwrap().unwrap()
    }
}

type DiskState = BTreeMap<PathBuf, (Vec<u8>, u64, u32, i64, i64)>;
fn disk_state(path: &Path) -> DiskState {
    let mut output = BTreeMap::new();
    fn visit(path: &Path, output: &mut DiskState) {
        for entry in fs::read_dir(path).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();
            let info = fs::symlink_metadata(&path).unwrap();
            if info.is_dir() {
                visit(&path, output);
            } else {
                output.insert(
                    path,
                    (
                        fs::read(entry.path()).unwrap(),
                        info.ino(),
                        info.mode(),
                        info.mtime(),
                        info.mtime_nsec(),
                    ),
                );
            }
        }
    }
    visit(path, &mut output);
    output
}

#[test]
fn missing_startup_store_is_empty_without_creating_directories_or_locks() {
    let fixture = Fixture::new();
    assert!(
        LocalRecoveryReader::open(&fixture.store())
            .unwrap()
            .is_none()
    );
    assert!(!fixture.store().exists());
    DocumentService::new(&fixture.store()).unwrap();
    let before = disk_state(&fixture.0);
    assert!(
        LocalRecoveryReader::open(&fixture.store())
            .unwrap()
            .is_none()
    );
    assert_eq!(disk_state(&fixture.0), before);
    assert!(!fixture.store().join("recovery").exists());
}

#[test]
fn selected_managed_recovery_is_visible_without_the_private_catalog() {
    use screenwriter_core::documents::startup::SelectedRecoveryRequest;
    let f = Fixture::new();
    let source = f.0.join("source.fountain");
    fs::write(&source, b"old\n").unwrap();
    fs::set_permissions(&source, fs::Permissions::from_mode(0o600)).unwrap();
    let aux = f.0.join(".screenwriter");
    fs::create_dir(&aux).unwrap();
    fs::set_permissions(&aux, fs::Permissions::from_mode(0o700)).unwrap();
    fs::write(aux.join("project.json"),serde_json::to_vec(&json!({"schemaVersion":1,"projectId":uuid::Uuid::new_v4().to_string(),"sourceFilename":"source.fountain","pdfProfile":"default"})).unwrap()).unwrap();
    let mut service = DocumentService::new(&f.store()).unwrap();
    let opened = service.open_selected(&source).unwrap();
    service
        .checkpoint(
            &opened.identity,
            50,
            b"new\r\n",
            &source_hash(b"new\r\n"),
            json!({"unknown":true}),
        )
        .unwrap();
    drop(service);
    let mut service = DocumentService::new(&f.store()).unwrap();
    let next = service.open_selected(&source).unwrap();
    let entry = service.list_document_recovery(&next.identity).unwrap();
    assert!(entry.candidates.iter().any(|c| c.version == 50));
    let selection = entry
        .candidates
        .iter()
        .find(|c| c.version == 50)
        .unwrap()
        .selection
        .clone();
    let preview = service
        .read_document_recovery(&SelectedRecoveryRequest {
            identity: next.identity,
            selection,
        })
        .unwrap();
    assert_eq!(preview.source, b"new\r\n");
    assert_eq!(preview.metadata.draft_metadata, json!({"unknown":true}));
    assert_eq!(fs::read(source).unwrap(), b"old\n");
}

#[test]
fn resume_uses_full_revalidated_checkpoint_and_preserves_original_generations() {
    let f = Fixture::new();
    let identity = f.seed();
    let before = disk_state(&f.store().join("recovery"));
    let entry = f.reader().catalog().unwrap().entries.remove(0);
    let selection = entry
        .candidates
        .iter()
        .find(|c| c.version == 22)
        .unwrap()
        .selection
        .clone();
    let mut service = DocumentService::new(&f.store()).unwrap();
    let resumed = service.resume_local_recovery(&selection).unwrap();
    assert_ne!(resumed.document.identity.document_id, identity.document_id);
    assert_eq!(
        resumed.document.source,
        b"<script>not executable</script>\r\n  "
    );
    assert_eq!(resumed.draft_metadata, json!({"unknown":{"preserve":true}}));
    let checkpoint = service
        .inspect_recovery(&resumed.document.identity)
        .unwrap()
        .latest
        .unwrap();
    assert_eq!(checkpoint.source, resumed.document.source);
    assert_eq!(checkpoint.metadata.version, 1);
    for (path, value) in before {
        assert_eq!(
            disk_state(&f.store().join("recovery")).get(&path),
            Some(&value)
        );
    }
    let mut stale = selection;
    stale.record_sha256 = "0".repeat(64);
    assert_eq!(
        service.resume_local_recovery(&stale).unwrap_err().code,
        ErrorCode::RecoveryNeedsAttention
    );
}

#[test]
fn resume_never_truncates_large_checkpoints_or_decodes_invalid_source() {
    let f = Fixture::new();
    let mut service = DocumentService::new(&f.store()).unwrap();
    let original = service.register_unsaved().unwrap();
    let large = b"!Full recovery content.\r\n".repeat(6000);
    service
        .checkpoint(
            &original.identity,
            21,
            &large,
            &source_hash(&large),
            json!({"opaque":true}),
        )
        .unwrap();
    let selection = service
        .list_document_recovery(&original.identity)
        .unwrap()
        .candidates
        .into_iter()
        .find(|c| c.version == 21)
        .unwrap()
        .selection;
    let resumed = service.resume_local_recovery(&selection).unwrap();
    assert!(resumed.document.source.len() > 128 * 1024);
    assert_eq!(resumed.document.source, large);
    let raw = service.register_unsaved().unwrap();
    let invalid = b"\xff\0\r\n";
    service
        .checkpoint(
            &raw.identity,
            22,
            invalid,
            &source_hash(invalid),
            serde_json::Value::Null,
        )
        .unwrap();
    let selected = service
        .list_document_recovery(&raw.identity)
        .unwrap()
        .candidates
        .into_iter()
        .find(|c| c.version == 22)
        .unwrap()
        .selection;
    let view = service.resume_local_recovery(&selected).unwrap();
    assert_eq!(view.document.source, invalid);
    assert_eq!(
        view.document.encoding,
        screenwriter_core::documents::SourceEncoding::Unsupported
    );
    assert!(matches!(
        view.document.ownership,
        screenwriter_core::documents::Ownership::ViewOnly { .. }
    ));
}

#[test]
fn restart_review_is_read_only_and_preserves_every_raw_generation_and_metadata() {
    let fixture = Fixture::new();
    let identity = fixture.seed();
    let source = fixture.0.join("synthetic.fountain");
    fs::write(&source, b"EXTERNAL SOURCE\r\n  ").unwrap();
    let before = disk_state(&fixture.0);
    let reader = fixture.reader();
    let catalog = reader.catalog().unwrap();
    assert_eq!(catalog, reader.catalog().unwrap());
    assert_eq!(catalog.entries.len(), 1);
    assert!(!catalog.truncated);
    assert_eq!(catalog.unrecognized_artifacts, 0);
    let entry = &catalog.entries[0];
    assert_eq!(entry.document_id, identity.document_id);
    assert!(entry.error.is_none());
    assert!(entry.notices.is_empty());
    assert_eq!(entry.candidates.len(), 3); // two current, one independently published predecessor
    for candidate in &entry.candidates {
        let preview = reader.preview(&candidate.selection).unwrap();
        assert_eq!(preview.candidate, *candidate);
        assert_eq!(
            preview.metadata.draft_metadata,
            json!({"unknown":{"preserve":true}})
        );
        assert_eq!(source_hash(&preview.source), candidate.source_sha256);
        if candidate.version == 21 {
            assert_eq!(preview.source, b"\xef\xbb\xbfunknown\r\n  \xff");
        } else {
            assert_eq!(preview.source, b"<script>not executable</script>\r\n  ");
        }
    }
    assert_eq!(disk_state(&fixture.0), before);
}

#[test]
fn damaged_tail_retains_prior_preview_and_stale_selection_cannot_switch_generations() {
    let fixture = Fixture::new();
    let identity = fixture.seed();
    let reader = fixture.reader();
    let catalog = reader.catalog().unwrap();
    let newest = catalog.entries[0]
        .candidates
        .iter()
        .find(|c| c.version == 22)
        .unwrap()
        .selection
        .clone();
    let path = fixture.artifact(&identity.document_id, "journal");
    let mut bytes = fs::read(&path).unwrap();
    bytes.pop();
    fs::write(&path, &bytes).unwrap();
    let before = disk_state(&fixture.0);
    assert_eq!(
        reader.preview(&newest).unwrap_err().code,
        ErrorCode::RecoveryNeedsAttention
    );
    let catalog = reader.catalog().unwrap();
    assert!(
        catalog.entries[0]
            .notices
            .contains(&RecoveryNotice::TruncatedTail)
    );
    for candidate in &catalog.entries[0].candidates {
        assert_eq!(
            reader
                .preview(&candidate.selection)
                .unwrap()
                .candidate
                .version,
            21
        );
    }
    assert_eq!(disk_state(&fixture.0), before);
}

#[test]
fn pending_future_quarantined_and_conflicting_generations_are_never_chosen_or_deleted() {
    let fixture = Fixture::new();
    let identity = fixture.seed();
    fs::copy(
        fixture.artifact(&identity.document_id, "journal"),
        fixture.artifact(&identity.document_id, "pending"),
    )
    .unwrap();
    let altered = Checkpoint::capture(&identity, 21, 1, b"different valid generation", json!({}))
        .unwrap()
        .encode()
        .unwrap();
    fs::write(fixture.artifact(&identity.document_id, "previous"), altered).unwrap();
    fs::write(
        fixture.artifact(&identity.document_id, "quarantine"),
        b"raw corrupt bytes",
    )
    .unwrap();
    fs::set_permissions(
        fixture.artifact(&identity.document_id, "quarantine"),
        fs::Permissions::from_mode(0o600),
    )
    .unwrap();
    let mut future = fs::read(fixture.artifact(&identity.document_id, "journal")).unwrap();
    future[8..12].copy_from_slice(&99u32.to_le_bytes());
    fs::write(
        fixture.artifact(&identity.document_id, "previous-pending"),
        future,
    )
    .unwrap();
    fs::set_permissions(
        fixture.artifact(&identity.document_id, "previous-pending"),
        fs::Permissions::from_mode(0o600),
    )
    .unwrap();
    let before = disk_state(&fixture.0);
    let reader = fixture.reader();
    let catalog = reader.catalog().unwrap();
    for expected in [
        RecoveryNotice::Pending,
        RecoveryNotice::Quarantined,
        RecoveryNotice::UnsupportedSchema,
        RecoveryNotice::ConflictingGeneration,
    ] {
        assert!(catalog.entries[0].notices.contains(&expected));
    }
    assert!(
        catalog.entries[0]
            .candidates
            .iter()
            .any(|c| c.selection.origin == RecoveryOrigin::Pending)
    );
    for candidate in &catalog.entries[0].candidates {
        reader.preview(&candidate.selection).unwrap();
    }
    assert_eq!(disk_state(&fixture.0), before);
}

#[test]
fn metadata_only_change_and_arbitrary_path_selection_fail_without_adoption() {
    let fixture = Fixture::new();
    let identity = fixture.seed();
    let reader = fixture.reader();
    let original = reader.catalog().unwrap().entries[0]
        .candidates
        .iter()
        .find(|c| c.version == 22)
        .unwrap()
        .selection
        .clone();
    let preview = reader.preview(&original).unwrap();
    let mut replacement = Checkpoint {
        metadata: preview.metadata,
        source: preview.source,
    };
    replacement.metadata.draft_metadata = json!({"changed": true});
    fs::write(
        fixture.artifact(&identity.document_id, "journal"),
        replacement.encode().unwrap(),
    )
    .unwrap();
    assert_eq!(
        reader.preview(&original).unwrap_err().code,
        ErrorCode::RecoveryNeedsAttention
    );
    let new = reader.catalog().unwrap().entries[0]
        .candidates
        .iter()
        .find(|c| c.version == 22)
        .unwrap()
        .selection
        .clone();
    assert_ne!(new.record_sha256, original.record_sha256);
    reader.preview(&new).unwrap();
    assert_eq!(
        reader
            .preview(&RecoverySelection {
                document_id: "/private/manuscript".into(),
                ..new.clone()
            })
            .unwrap_err()
            .code,
        ErrorCode::InvalidCheckpoint
    );
    assert!(
        serde_json::from_value::<CatalogRequest>(json!({"path":"/private/manuscript"})).is_err()
    );
    let mut extra = serde_json::to_value(new).unwrap();
    extra["path"] = json!("/private/manuscript");
    assert!(serde_json::from_value::<RecoverySelection>(extra).is_err());
}

#[test]
fn unsafe_artifacts_and_directory_substitution_are_visible_without_following_them() {
    let fixture = Fixture::new();
    let identity = fixture.seed();
    let reader = fixture.reader();
    let journal = fixture.artifact(&identity.document_id, "journal");
    let protected = fixture.0.join("protected");
    fs::write(&protected, b"private unrelated source").unwrap();
    fs::remove_file(&journal).unwrap();
    symlink(&protected, &journal).unwrap();
    let catalog = reader.catalog().unwrap();
    assert!(catalog.entries[0].error.is_some());
    assert!(
        catalog.entries[0]
            .notices
            .contains(&RecoveryNotice::UnreadableArtifact)
    );
    assert!(!catalog.entries[0].candidates.is_empty());
    assert_eq!(fs::read(&protected).unwrap(), b"private unrelated source");
    assert!(fs::symlink_metadata(&journal).unwrap().is_symlink());
    let moved = fixture.0.join("moved-store");
    fs::rename(fixture.store(), &moved).unwrap();
    DocumentService::new(&fixture.store()).unwrap();
    assert_eq!(reader.catalog().unwrap_err().code, ErrorCode::MissingSource);
    fs::set_permissions(fixture.store(), fs::Permissions::from_mode(0o755)).unwrap();
    assert_eq!(
        LocalRecoveryReader::open(&fixture.store())
            .err()
            .unwrap()
            .code,
        ErrorCode::IdentityStoreUnavailable
    );
}

#[test]
fn directory_and_document_limits_are_reported_instead_of_claiming_complete_discovery() {
    let fixture = Fixture::new();
    DocumentService::new(&fixture.store()).unwrap();
    let recovery = fixture.store().join("recovery");
    fs::create_dir(&recovery).unwrap();
    fs::set_permissions(&recovery, fs::Permissions::from_mode(0o700)).unwrap();
    for i in 1..=MAX_REVIEW_DOCUMENTS + 1 {
        let id = format!("{i:08x}-1111-4111-8111-111111111111");
        let path = fixture.artifact(&id, "journal");
        fs::write(&path, b"").unwrap();
        fs::set_permissions(path, fs::Permissions::from_mode(0o600)).unwrap();
    }
    let reader = fixture.reader();
    let first = reader.catalog().unwrap();
    assert_eq!(first.entries.len(), MAX_REVIEW_DOCUMENTS);
    assert!(first.truncated);
    for i in 0..MAX_DIRECTORY_ENTRIES + 1 {
        fs::write(recovery.join(format!("unrecognized-{i}")), b"x").unwrap();
    }
    let result = reader.catalog().unwrap();
    assert!(result.truncated);
    assert!(result.unrecognized_artifacts > 0);
    assert!(result.entries.len() <= MAX_REVIEW_DOCUMENTS);
    assert_eq!(
        fs::read_dir(recovery).unwrap().count(),
        MAX_DIRECTORY_ENTRIES + MAX_REVIEW_DOCUMENTS + 2
    );
}
