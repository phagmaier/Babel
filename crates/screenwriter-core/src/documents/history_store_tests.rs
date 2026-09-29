use super::*;
use crate::documents::saving::{SaveProtection, SaveRequest};
use std::os::unix::fs::PermissionsExt;

const OLD: &[u8] = b"\xef\xbb\xbfTitle: Test\r\n\r\nINT. ROOM - DAY\r\n  old [[unknown]]  \r\n";
const NEW: &[u8] = b"\xef\xbb\xbfTitle: Test\r\n\r\nINT. ROOM - DAY\r\n  new [[unknown]]  \r\n";

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let base = std::env::var_os("BABEL_HISTORY_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir);
        let root = base.join(format!("babel-history-native-{}", uuid()));
        std::fs::create_dir(&root).unwrap();
        std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o700)).unwrap();
        std::fs::write(root.join("script.fountain"), OLD).unwrap();
        std::fs::set_permissions(
            root.join("script.fountain"),
            std::fs::Permissions::from_mode(0o640),
        )
        .unwrap();
        Self(root)
    }
    fn open(&self) -> (DocumentService, OpenDocument) {
        let mut service = DocumentService::new(&self.0.join("app-data")).unwrap();
        let opened = service
            .open_selected(&self.0.join("script.fountain"))
            .unwrap();
        assert_eq!(opened.ownership, Ownership::Exclusive);
        (service, opened)
    }
    fn repo_path(&self, id: &DocumentRequest) -> PathBuf {
        self.0
            .join("app-data/history")
            .join(format!("{}.git", id.document_id))
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        std::fs::remove_dir_all(&self.0).unwrap();
    }
}

fn capture<'a>(project: &'a str, source: &'a [u8], label: &'a str) -> Capture<'a> {
    Capture {
        project,
        version: None,
        source,
        profile: "profile",
        label,
        safety: true,
    }
}

#[test]
fn curated_revisions_deduplicate_and_keep_exact_source_and_safety_ref() {
    let fixture = Fixture::new();
    let (mut service, opened) = fixture.open();
    let id = &opened.identity;
    let first = service
        .record_revision(id, None, OLD, "profile-v1", "First milestone", true)
        .unwrap();
    assert!(first.changed);
    assert_eq!(first.source_sha256, hash(OLD));
    assert_eq!(
        first.safety_ref,
        Some(format!("refs/safety/{}", first.commit_id))
    );
    let repeat = service
        .record_revision(id, None, OLD, "profile-v1", "Same content", false)
        .unwrap();
    assert!(!repeat.changed);
    assert_eq!(repeat.commit_id, first.commit_id);
    let changed_profile = service
        .record_revision(id, None, OLD, "profile-v2", "Profile changed", false)
        .unwrap();
    assert!(changed_profile.changed);
    let repo = service.history_repository(id).unwrap();
    let commit = repo
        .find_commit(Oid::from_str(&changed_profile.commit_id).unwrap())
        .unwrap();
    assert_eq!(commit.parent_id(0).unwrap().to_string(), first.commit_id);
    let tree = commit.tree().unwrap();
    assert_eq!(tree.len(), 2);
    let blob = repo
        .find_blob(tree.get_name("screenplay.fountain").unwrap().id())
        .unwrap();
    assert_eq!(blob.content(), OLD);
    assert_eq!(
        repo.refname_to_id(first.safety_ref.as_deref().unwrap())
            .unwrap()
            .to_string(),
        first.commit_id
    );
    assert_eq!(service.history_health(id).unwrap(), HistoryHealth::Ready);
}

#[test]
fn interrupted_ref_publication_is_retried_without_losing_existing_head() {
    let fixture = Fixture::new();
    let (service, opened) = fixture.open();
    let id = &opened.identity;
    let repo = service.history_repository(id).unwrap();
    let err = record_with(&repo, capture(&id.document_id, OLD, "Initial"), |stage| {
        if stage == Stage::ObjectsWritten {
            Err(history_error())
        } else {
            Ok(())
        }
    });
    assert_eq!(err.unwrap_err().code, ErrorCode::HistoryNeedsAttention);
    assert_eq!(head(&repo).unwrap(), None);
    let first = record_with(&repo, capture(&id.document_id, OLD, "Initial"), |_| Ok(())).unwrap();
    assert_eq!(head(&repo).unwrap().unwrap().to_string(), first.commit_id);
    let err = record_with(&repo, capture(&id.document_id, NEW, "Next"), |stage| {
        if stage == Stage::MainAdvanced {
            Err(history_error())
        } else {
            Ok(())
        }
    });
    assert_eq!(err.unwrap_err().code, ErrorCode::HistoryNeedsAttention);
    let published = head(&repo).unwrap().unwrap();
    assert_eq!(
        service.history_health(id).unwrap(),
        HistoryHealth::NeedsAttention
    );
    assert_eq!(
        read(&repo, published, &id.document_id)
            .unwrap()
            .source_sha256,
        hash(NEW)
    );
    let retry = record_with(&repo, capture(&id.document_id, NEW, "Next"), |_| Ok(())).unwrap();
    assert!(!retry.changed);
    assert_eq!(retry.commit_id, published.to_string());
    assert_eq!(service.history_health(id).unwrap(), HistoryHealth::Ready);
    assert_eq!(
        repo.refname_to_id(retry.safety_ref.as_deref().unwrap())
            .unwrap(),
        published
    );
    assert_eq!(
        repo.find_commit(published)
            .unwrap()
            .parent_id(0)
            .unwrap()
            .to_string(),
        first.commit_id
    );
}

#[test]
fn history_corruption_stops_history_but_not_source_or_recovery() {
    let fixture = Fixture::new();
    let (mut service, opened) = fixture.open();
    let id = &opened.identity;
    service
        .record_revision(id, None, OLD, "profile", "Initial", false)
        .unwrap();
    std::fs::write(fixture.repo_path(id).join("refs/heads/main"), b"bad-ref\n").unwrap();
    let err = service
        .record_revision(id, None, OLD, "profile", "Next", true)
        .unwrap_err();
    assert_eq!(err.code, ErrorCode::HistoryNeedsAttention);
    assert_eq!(
        service.history_health(id).unwrap(),
        HistoryHealth::NeedsAttention
    );
    let saved = service
        .save_request(SaveRequest {
            identity: id.clone(),
            version: 1,
            source: NEW.to_vec(),
            source_sha256: hash(NEW),
            expected_fingerprint: opened.fingerprint.clone().unwrap(),
            draft_metadata: serde_json::json!({"synthetic": true}),
        })
        .unwrap();
    assert_eq!(saved.protection, SaveProtection::SourceFile);
    assert_eq!(
        std::fs::read(fixture.0.join("script.fountain")).unwrap(),
        NEW
    );
    assert_eq!(
        service.inspect_recovery(id).unwrap().latest.unwrap().source,
        NEW
    );
    assert_eq!(
        service.history_health(id).unwrap(),
        HistoryHealth::NeedsAttention
    );
    assert_eq!(
        std::fs::read(fixture.repo_path(id).join("refs/heads/main")).unwrap(),
        b"bad-ref\n"
    );
    drop(service);
    let (restarted, reopened) = fixture.open();
    assert_eq!(
        restarted.history_health(&reopened.identity).unwrap(),
        HistoryHealth::NeedsAttention
    );
}

#[test]
fn forged_or_unprotected_content_cannot_be_recorded() {
    let fixture = Fixture::new();
    let (mut service, opened) = fixture.open();
    let id = &opened.identity;
    assert_eq!(
        service
            .record_revision(id, None, NEW, "profile", "Forged", false)
            .unwrap_err()
            .code,
        ErrorCode::SourceChanged
    );
    assert_eq!(
        service
            .record_revision(id, Some(42), OLD, "profile", "No checkpoint", false)
            .unwrap_err()
            .code,
        ErrorCode::InvalidCheckpoint
    );
    assert!(!fixture.repo_path(id).exists());
}

#[test]
fn managed_safety_revision_uses_selected_project_profile() {
    let fixture = Fixture::new();
    let managed = fixture.0.join("managed");
    std::fs::create_dir(&managed).unwrap();
    std::fs::set_permissions(&managed, std::fs::Permissions::from_mode(0o700)).unwrap();
    let aux = managed.join(".screenwriter");
    std::fs::create_dir(&aux).unwrap();
    std::fs::set_permissions(&aux, std::fs::Permissions::from_mode(0o700)).unwrap();
    let project = uuid();
    std::fs::write(
        aux.join("project.json"),
        serde_json::json!({
            "schemaVersion": 1,
            "projectId": project,
            "sourceFilename": "script.fountain",
            "pdfProfile": "us-letter-v1"
        })
        .to_string(),
    )
    .unwrap();
    std::fs::set_permissions(
        aux.join("project.json"),
        std::fs::Permissions::from_mode(0o600),
    )
    .unwrap();
    std::fs::write(managed.join("script.fountain"), OLD).unwrap();
    std::fs::set_permissions(
        managed.join("script.fountain"),
        std::fs::Permissions::from_mode(0o600),
    )
    .unwrap();
    let mut service = DocumentService::new(&fixture.0.join("app-data")).unwrap();
    let opened = service
        .open_selected(&managed.join("script.fountain"))
        .unwrap();
    assert_eq!(opened.kind, DocumentKind::Managed);
    assert_eq!(opened.ownership, Ownership::Exclusive);
    let receipt = service
        .protect_history_before_replacement(&opened.identity, OLD)
        .unwrap();
    let repo = service.history_repository(&opened.identity).unwrap();
    let manifest = read(&repo, Oid::from_str(&receipt.commit_id).unwrap(), &project).unwrap();
    assert_eq!(manifest.profile, "us-letter-v1");
    assert_eq!(manifest.profile_sha256, hash(b"us-letter-v1"));
}

fn import_request(
    opened: &OpenDocument,
    version: u64,
    source: &[u8],
) -> persistence::CheckpointRequest {
    persistence::CheckpointRequest {
        identity: opened.identity.clone(),
        version,
        source: source.to_vec(),
        source_sha256: recovery::source_hash(source),
        expected_fingerprint: opened.fingerprint.clone(),
        draft_metadata: serde_json::json!({"schema":"synthetic-import-test"}),
    }
}

#[test]
fn editor_import_protects_exact_live_draft_with_safety_revision_without_replacing_source() {
    let fixture = Fixture::new();
    let (mut service, opened) = fixture.open();
    let receipt = service
        .protect_editor_import(import_request(&opened, 17, NEW))
        .unwrap();
    assert_eq!(receipt.checkpoint.version, 17);
    assert_eq!(receipt.revision.version, Some(17));
    assert_eq!(receipt.revision.source_sha256, hash(NEW));
    assert_eq!(receipt.checkpoint.source_sha256, hash(NEW));
    assert_eq!(
        std::fs::read(fixture.0.join("script.fountain")).unwrap(),
        OLD
    );
    let repo = service.history_repository(&opened.identity).unwrap();
    let id = repo
        .refname_to_id(receipt.revision.safety_ref.as_deref().unwrap())
        .unwrap();
    assert_eq!(id.to_string(), receipt.revision.commit_id);
    let tree = repo.find_commit(id).unwrap().tree().unwrap();
    assert_eq!(
        repo.find_blob(tree.get_name("screenplay.fountain").unwrap().id())
            .unwrap()
            .content(),
        NEW
    );
    let repeated = service
        .protect_editor_import(import_request(&opened, 17, NEW))
        .unwrap();
    assert_eq!(repeated.revision.commit_id, receipt.revision.commit_id);
    assert!(!repeated.revision.changed);
}

#[test]
fn editor_import_rejects_stale_conflicting_or_forged_capture() {
    let fixture = Fixture::new();
    let (mut service, opened) = fixture.open();
    service
        .protect_editor_import(import_request(&opened, 17, NEW))
        .unwrap();
    let mut request = import_request(&opened, 18, NEW);
    request.source_sha256 = hash(OLD);
    assert_eq!(
        service.protect_editor_import(request).unwrap_err().code,
        ErrorCode::InvalidCheckpoint
    );
    assert_eq!(
        service
            .protect_editor_import(import_request(&opened, 16, NEW))
            .unwrap_err()
            .code,
        ErrorCode::StaleRecoveryVersion
    );
    assert_eq!(
        service
            .protect_editor_import(import_request(&opened, 17, OLD))
            .unwrap_err()
            .code,
        ErrorCode::CheckpointConflict
    );
    let mut request = import_request(&opened, 18, NEW);
    request.identity.session_id = uuid();
    assert_eq!(
        service.protect_editor_import(request).unwrap_err().code,
        ErrorCode::IdentityMismatch
    );
    assert_eq!(
        std::fs::read(fixture.0.join("script.fountain")).unwrap(),
        OLD
    );
}

#[test]
fn editor_import_history_failure_keeps_exact_checkpoint_and_source() {
    let fixture = Fixture::new();
    let (mut service, opened) = fixture.open();
    service
        .protect_editor_import(import_request(&opened, 17, OLD))
        .unwrap();
    // An unsafe permissions change to the disposable repository fails closed.
    std::fs::set_permissions(
        fixture.repo_path(&opened.identity),
        std::fs::Permissions::from_mode(0o777),
    )
    .unwrap();
    assert!(
        service
            .protect_editor_import(import_request(&opened, 18, NEW))
            .is_err()
    );
    let latest = service
        .inspect_recovery(&opened.identity)
        .unwrap()
        .latest
        .unwrap();
    assert_eq!(latest.source, NEW);
    assert_eq!(latest.metadata.version, 18);
    assert_eq!(
        std::fs::read(fixture.0.join("script.fountain")).unwrap(),
        OLD
    );
}
