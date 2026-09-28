#![cfg(target_os = "linux")]
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

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let base = std::env::var_os("BABEL_STARTUP_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let path = base.join(format!(
            "babel-startup-{}-{}",
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
impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).unwrap();
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
