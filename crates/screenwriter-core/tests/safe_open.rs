#![cfg(target_os = "linux")]

mod common;
use common::TestRoot;
use screenwriter_core::documents::*;
use std::fs;
use std::os::unix::fs::{PermissionsExt, symlink};
use std::path::{Path, PathBuf};
use std::process::Command;
use uuid::Uuid;

struct Fixture(TestRoot);

impl Fixture {
    fn new() -> Self {
        let root = TestRoot::new("BABEL_OPEN_TEST_ROOT", "babel-safe-open");
        Self(root)
    }

    fn service(&self) -> DocumentService {
        DocumentService::new(&self.0.join("app-data")).unwrap()
    }

    fn source(&self, name: &str, bytes: &[u8]) -> PathBuf {
        let path = self.0.join(name);
        fs::write(&path, bytes).unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
        path
    }

    fn project(&self, id: &str, source: &str, schema: u32) -> Vec<u8> {
        let aux = self.0.join(".screenwriter");
        fs::create_dir_all(&aux).unwrap();
        fs::set_permissions(&aux, fs::Permissions::from_mode(0o700)).unwrap();
        let bytes = serde_json::to_vec(&serde_json::json!({
            "schemaVersion": schema, "projectId": id, "sourceFilename": source,
            "pdfProfile": "screenplay-default", "unknownField": {"preserve": true}
        }))
        .unwrap();
        fs::write(aux.join("project.json"), &bytes).unwrap();
        bytes
    }
}

fn has_reason(open: &OpenDocument, reason: ViewReason) -> bool {
    matches!(&open.ownership, Ownership::ViewOnly { reasons } if reasons.contains(&reason))
}

fn code<T: std::fmt::Debug>(result: Result<T, DocumentError>, expected: ErrorCode) {
    assert_eq!(result.unwrap_err().code, expected);
}

#[test]
fn exact_bytes_no_source_or_project_side_effects_and_native_hash() {
    let f = Fixture::new();
    let mut service = f.service();
    for (name, bytes) in [
        (
            "bom.fountain",
            b"\xef\xbb\xbfTitle: Synthetic\r\n\r\nINT. LAB - DAY\r\n  unknown  \r\n".as_slice(),
        ),
        (
            "raw.fountain",
            b"X-Unknown: <script>do not execute</script>\n\n@\n  \n[[incomplete".as_slice(),
        ),
        ("empty.fountain", b"".as_slice()),
        ("abc.fountain", b"abc".as_slice()),
    ] {
        let path = f.source(name, bytes);
        let before = fs::metadata(&path).unwrap();
        let opened = service.open_selected(&path).unwrap();
        assert_eq!(opened.source, bytes);
        assert_eq!(opened.ownership, Ownership::Exclusive);
        assert_eq!(opened.encoding, SourceEncoding::Utf8);
        assert_eq!(service.read_initial(&opened.identity).unwrap(), opened);
        service.validate_owner(&opened.identity).unwrap();
        service.release(&opened.identity).unwrap();
        assert_eq!(fs::read(&path).unwrap(), bytes);
        assert_eq!(
            fs::metadata(&path).unwrap().modified().unwrap(),
            before.modified().unwrap()
        );
        assert_eq!(
            fs::metadata(&path).unwrap().permissions().mode(),
            before.permissions().mode()
        );
        if name == "abc.fountain" {
            assert_eq!(
                opened.fingerprint.unwrap().sha256,
                "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
            );
        }
    }
    assert!(!f.0.join(".screenwriter").exists());
}

#[test]
fn invalid_utf8_is_byte_preserving_view_only() {
    let f = Fixture::new();
    let path = f.source("invalid.fountain", b"raw\xff\xc0\xaf\r\n");
    let mut service = f.service();
    let opened = service.open_selected(&path).unwrap();
    assert_eq!(opened.source, fs::read(&path).unwrap());
    assert_eq!(opened.encoding, SourceEncoding::Unsupported);
    assert!(has_reason(&opened, ViewReason::UnsupportedEncoding));
    code(
        service.validate_owner(&opened.identity),
        ErrorCode::OwnershipRequired,
    );
}

#[test]
fn read_only_source_and_directory_remain_viewable() {
    let f = Fixture::new();
    let path = f.source("read-only.fountain", b"INT. LAB - DAY\n");
    let mut service = f.service();
    fs::set_permissions(&path, fs::Permissions::from_mode(0o400)).unwrap();
    let opened = service.open_selected(&path).unwrap();
    assert!(has_reason(&opened, ViewReason::ReadOnly));
    assert_eq!(opened.source, b"INT. LAB - DAY\n");
    fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
    fs::set_permissions(&f.0, fs::Permissions::from_mode(0o500)).unwrap();
    let opened = service.open_selected(&path).unwrap();
    assert!(has_reason(&opened, ViewReason::ReadOnly));
    fs::set_permissions(&f.0, fs::Permissions::from_mode(0o700)).unwrap();
}

#[test]
fn missing_permission_denied_oversized_and_nonregular_sources_are_typed_errors() {
    let f = Fixture::new();
    let mut service = f.service();
    code(
        service.open_selected(&f.0.join("missing.fountain")),
        ErrorCode::MissingSource,
    );
    let path = f.source("unreadable.fountain", b"synthetic");
    fs::set_permissions(&path, fs::Permissions::from_mode(0o0)).unwrap();
    code(service.open_selected(&path), ErrorCode::PermissionDenied);
    fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
    fs::File::options()
        .write(true)
        .open(&path)
        .unwrap()
        .set_len(MAX_SOURCE_BYTES as u64 + 1)
        .unwrap();
    code(service.open_selected(&path), ErrorCode::SourceTooLarge);
    code(service.open_selected(&f.0), ErrorCode::NotRegularFile);
    let fifo = f.0.join("pipe.fountain");
    rustix::fs::mknodat(
        rustix::fs::CWD,
        &fifo,
        rustix::fs::FileType::Fifo,
        rustix::fs::Mode::from_raw_mode(0o600),
        0,
    )
    .unwrap();
    code(service.open_selected(&fifo), ErrorCode::NotRegularFile);
}

#[test]
fn symlinks_in_source_parent_store_and_project_are_never_followed() {
    let f = Fixture::new();
    let source = f.source("source.fountain", b"synthetic");
    let mut service = f.service();
    let link = f.0.join("link.fountain");
    symlink(&source, &link).unwrap();
    code(service.open_selected(&link), ErrorCode::UnsafePath);
    let directory_link = f.0.join("linked-parent");
    symlink(&f.0, &directory_link).unwrap();
    code(
        service.open_selected(&directory_link.join("source.fountain")),
        ErrorCode::UnsafePath,
    );
    let store_link = f.0.join("linked-store");
    symlink(f.0.join("app-data"), &store_link).unwrap();
    code(
        DocumentService::new(&store_link).map(|_| ()),
        ErrorCode::UnsafePath,
    );
    symlink(&f.0, f.0.join(".screenwriter")).unwrap();
    let opened = service.open_selected(&source).unwrap();
    assert!(has_reason(&opened, ViewReason::InvalidProjectMetadata));
    assert_eq!(opened.source, b"synthetic");
}

#[test]
fn traversal_relative_paths_and_special_permissions_cannot_gain_ownership() {
    let f = Fixture::new();
    let path = f.source("source.fountain", b"synthetic");
    let mut service = f.service();
    code(
        service.open_selected(Path::new("source.fountain")),
        ErrorCode::UnsafePath,
    );
    code(
        service.open_selected(&f.0.join("../escape.fountain")),
        ErrorCode::UnsafePath,
    );
    fs::set_permissions(&path, fs::Permissions::from_mode(0o666)).unwrap();
    assert!(has_reason(
        &service.open_selected(&path).unwrap(),
        ViewReason::UnsafePermissions
    ));
    fs::set_permissions(&path, fs::Permissions::from_mode(0o4600)).unwrap();
    assert!(has_reason(
        &service.open_selected(&path).unwrap(),
        ViewReason::UnsafePermissions
    ));
    fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
    fs::set_permissions(&f.0, fs::Permissions::from_mode(0o777)).unwrap();
    assert!(has_reason(
        &service.open_selected(&path).unwrap(),
        ViewReason::UnsafePermissions
    ));
    fs::set_permissions(&f.0, fs::Permissions::from_mode(0o700)).unwrap();
}

#[test]
fn hard_links_are_view_only() {
    let f = Fixture::new();
    let path = f.source("source.fountain", b"synthetic");
    fs::hard_link(&path, f.0.join("alias.fountain")).unwrap();
    let opened = f.service().open_selected(&path).unwrap();
    assert!(has_reason(&opened, ViewReason::HardLinked));
}

#[test]
fn loose_identity_survives_restart_and_content_replacement_but_copies_are_independent() {
    let f = Fixture::new();
    let path = f.source("source.fountain", b"first");
    let first = f.service().open_selected(&path).unwrap();
    let replacement = f.source("replacement.fountain", b"second");
    fs::rename(&replacement, &path).unwrap();
    let next = f.service().open_selected(&path).unwrap();
    assert_eq!(next.identity.document_id, first.identity.document_id);
    assert_ne!(next.identity.handle, first.identity.handle);
    assert_ne!(next.identity.session_id, first.identity.session_id);
    assert_eq!(next.source, b"second");
    let copy = f.source("copy.fountain", b"second");
    let copied = f.service().open_selected(&copy).unwrap();
    assert_ne!(copied.identity.document_id, next.identity.document_id);
    assert!(next.persistent_identity);
    let equivalent_path = f.0.join(".").join("source.fountain");
    assert_eq!(
        f.service()
            .open_selected(&equivalent_path)
            .unwrap()
            .identity
            .document_id,
        next.identity.document_id
    );
}

#[test]
fn corrupt_or_future_identity_registry_is_preserved_and_falls_back_to_view_only() {
    for bytes in [
        b"{torn".as_slice(),
        b"{\"schemaVersion\":999,\"documentId\":\"unknown\"}".as_slice(),
    ] {
        let f = Fixture::new();
        let path = f.source("source.fountain", b"synthetic");
        f.service().open_selected(&path).unwrap();
        let registry = fs::read_dir(f.0.join("app-data"))
            .unwrap()
            .map(|e| e.unwrap().path())
            .find(|p| {
                p.file_name()
                    .unwrap()
                    .to_string_lossy()
                    .ends_with(".identity.json")
            })
            .unwrap();
        fs::write(&registry, bytes).unwrap();
        let opened = f.service().open_selected(&path).unwrap();
        assert!(has_reason(&opened, ViewReason::IdentityUnavailable));
        assert!(!opened.persistent_identity);
        assert_eq!(fs::read(&registry).unwrap(), bytes);
        assert_eq!(opened.source, b"synthetic");
    }
}

#[test]
fn managed_identity_unknown_fields_and_profile_survive_no_op_open() {
    let f = Fixture::new();
    let path = f.source("source.fountain", b"synthetic");
    let id = Uuid::new_v4().to_string();
    let metadata = f.project(&id, "source.fountain", 1);
    let opened = f.service().open_selected(&path).unwrap();
    assert_eq!(opened.kind, DocumentKind::Managed);
    assert_eq!(opened.identity.document_id, id);
    assert_eq!(opened.ownership, Ownership::Exclusive);
    assert_eq!(
        fs::read(f.0.join(".screenwriter/project.json")).unwrap(),
        metadata
    );
    assert!(fs::read_dir(f.0.join("app-data")).unwrap().all(|e| {
        let path = e.unwrap().path();
        path.extension().unwrap() == "lock" || path.file_name().unwrap() == "recents-1.json"
    }));
}

#[test]
fn malformed_future_and_unsafe_project_metadata_stays_read_only_and_unmodified() {
    let f = Fixture::new();
    let path = f.source("source.fountain", b"synthetic");
    let id = Uuid::new_v4().to_string();
    for source in [
        "../source.fountain",
        "/source.fountain",
        "sub/source.fountain",
    ] {
        let metadata = f.project(&id, source, 1);
        let opened = f.service().open_selected(&path).unwrap();
        assert!(has_reason(&opened, ViewReason::InvalidProjectMetadata));
        assert_eq!(
            fs::read(f.0.join(".screenwriter/project.json")).unwrap(),
            metadata
        );
    }
    let metadata = f.project(&id, "source.fountain", 999);
    let opened = f.service().open_selected(&path).unwrap();
    assert!(has_reason(&opened, ViewReason::UnknownProjectSchema));
    assert_eq!(
        fs::read(f.0.join(".screenwriter/project.json")).unwrap(),
        metadata
    );
    fs::write(f.0.join(".screenwriter/project.json"), b"{torn").unwrap();
    assert!(has_reason(
        &f.service().open_selected(&path).unwrap(),
        ViewReason::InvalidProjectMetadata
    ));
}

#[test]
fn unrelated_loose_source_in_managed_folder_does_not_inherit_identity() {
    let f = Fixture::new();
    f.source("managed.fountain", b"managed");
    let loose = f.source("loose.fountain", b"loose");
    let id = Uuid::new_v4().to_string();
    f.project(&id, "managed.fountain", 1);
    let opened = f.service().open_selected(&loose).unwrap();
    assert_eq!(opened.kind, DocumentKind::Loose);
    assert_ne!(opened.identity.document_id, id);
    assert!(!f.0.join(".screenwriter/recovery").exists());
}

#[test]
fn renamed_managed_source_preserves_identity_as_view_only_mapping_candidate() {
    let f = Fixture::new();
    let old = f.source("old.fountain", b"synthetic");
    let id = Uuid::new_v4().to_string();
    let metadata = f.project(&id, "old.fountain", 1);
    let renamed = f.0.join("renamed.fountain");
    fs::rename(&old, &renamed).unwrap();
    let opened = f.service().open_selected(&renamed).unwrap();
    assert_eq!(opened.kind, DocumentKind::Managed);
    assert_eq!(opened.identity.document_id, id);
    assert!(has_reason(&opened, ViewReason::SourceMappingMismatch));
    assert_eq!(
        fs::read(f.0.join(".screenwriter/project.json")).unwrap(),
        metadata
    );
}

#[test]
fn duplicate_or_insecure_project_metadata_is_not_authoritative() {
    let f = Fixture::new();
    let source = f.source("source.fountain", b"synthetic");
    f.project(&Uuid::new_v4().to_string(), "source.fountain", 1);
    let metadata = f.0.join(".screenwriter/project.json");
    fs::write(&metadata, b"{\"schemaVersion\":999,\"schemaVersion\":1}").unwrap();
    assert!(has_reason(
        &f.service().open_selected(&source).unwrap(),
        ViewReason::InvalidProjectMetadata
    ));
    f.project(&Uuid::new_v4().to_string(), "source.fountain", 1);
    fs::set_permissions(&metadata, fs::Permissions::from_mode(0o666)).unwrap();
    assert!(has_reason(
        &f.service().open_selected(&source).unwrap(),
        ViewReason::InvalidProjectMetadata
    ));
}

#[test]
fn moved_identity_store_invalidates_owner_without_touching_source() {
    let f = Fixture::new();
    let source = f.source("source.fountain", b"synthetic");
    let mut service = f.service();
    let opened = service.open_selected(&source).unwrap();
    fs::rename(f.0.join("app-data"), f.0.join("moved-app-data")).unwrap();
    fs::create_dir(f.0.join("app-data")).unwrap();
    fs::set_permissions(f.0.join("app-data"), fs::Permissions::from_mode(0o700)).unwrap();
    code(
        service.validate_owner(&opened.identity),
        ErrorCode::IdentityStoreUnavailable,
    );
    assert_eq!(service.read_initial(&opened.identity).unwrap(), opened);
    assert_eq!(fs::read(&source).unwrap(), b"synthetic");
}

#[test]
fn second_owner_is_view_only_until_lease_is_released() {
    let f = Fixture::new();
    let path = f.source("source.fountain", b"synthetic");
    let mut first = f.service();
    let mut second = f.service();
    let owner = first.open_selected(&path).unwrap();
    let viewer = second.open_selected(&path).unwrap();
    assert!(has_reason(&viewer, ViewReason::AlreadyOwned));
    assert_eq!(viewer.identity.document_id, owner.identity.document_id);
    code(
        second.validate_owner(&viewer.identity),
        ErrorCode::OwnershipRequired,
    );
    first.release(&owner.identity).unwrap();
    assert_eq!(
        second.open_selected(&path).unwrap().ownership,
        Ownership::Exclusive
    );
}

#[test]
fn copied_managed_identity_cannot_be_owned_twice() {
    let f = Fixture::new();
    let copy = Fixture::new();
    let id = Uuid::new_v4().to_string();
    let path = f.source("source.fountain", b"synthetic");
    let other = copy.source("source.fountain", b"synthetic");
    f.project(&id, "source.fountain", 1);
    copy.project(&id, "source.fountain", 1);
    let mut service = f.service();
    let owner = service.open_selected(&path).unwrap();
    let viewer = service.open_selected(&other).unwrap();
    assert_eq!(viewer.identity.document_id, owner.identity.document_id);
    assert!(has_reason(&viewer, ViewReason::AlreadyOwned));
}

#[test]
fn stale_cross_document_and_released_handles_are_rejected() {
    let f = Fixture::new();
    let mut service = f.service();
    let one = service.register_unsaved().unwrap();
    let two = service.register_unsaved().unwrap();
    let mut forged = one.identity.clone();
    forged.session_id = two.identity.session_id.clone();
    code(service.read_initial(&forged), ErrorCode::IdentityMismatch);
    code(service.release(&forged), ErrorCode::IdentityMismatch);
    forged = one.identity.clone();
    forged.document_id = two.identity.document_id.clone();
    code(service.validate_owner(&forged), ErrorCode::IdentityMismatch);
    forged.handle = "arbitrary-path".into();
    code(service.read_initial(&forged), ErrorCode::InvalidHandle);
    service.release(&one.identity).unwrap();
    code(
        service.read_initial(&one.identity),
        ErrorCode::InvalidHandle,
    );
    assert_eq!(service.read_initial(&two.identity).unwrap(), two);
}

#[test]
fn unsaved_identity_and_open_capacity_are_bounded_without_false_recovery_claims() {
    let f = Fixture::new();
    let mut service = f.service();
    let first = service.register_unsaved().unwrap();
    assert_eq!(first.kind, DocumentKind::Unsaved);
    assert!(first.source.is_empty());
    assert!(first.fingerprint.is_none());
    assert!(!first.persistent_identity);
    for _ in 1..MAX_OPEN_DOCUMENTS {
        service.register_unsaved().unwrap();
    }
    code(service.register_unsaved(), ErrorCode::TooManyDocuments);
    service.release(&first.identity).unwrap();
    service.register_unsaved().unwrap();
}

#[test]
fn external_edits_replacement_and_missing_source_preserve_initial_snapshot() {
    for operation in ["edit", "replace", "delete", "symlink", "chmod"] {
        let f = Fixture::new();
        let path = f.source("source.fountain", b"first");
        let mut service = f.service();
        let opened = service.open_selected(&path).unwrap();
        match operation {
            "edit" => fs::write(&path, b"other").unwrap(),
            "replace" => {
                let new = f.source("new.fountain", b"first");
                fs::rename(new, &path).unwrap();
            }
            "delete" => fs::remove_file(&path).unwrap(),
            "symlink" => {
                fs::remove_file(&path).unwrap();
                symlink(f.source("other.fountain", b"other"), &path).unwrap();
            }
            "chmod" => fs::set_permissions(&path, fs::Permissions::from_mode(0o400)).unwrap(),
            _ => unreachable!(),
        }
        assert!(
            service.validate_owner(&opened.identity).is_err(),
            "{operation}"
        );
        assert_eq!(
            service.read_initial(&opened.identity).unwrap().source,
            b"first"
        );
        if operation == "edit" {
            assert_eq!(fs::read(&path).unwrap(), b"other");
        }
    }
}

#[test]
fn moved_parent_and_replaced_lock_inode_invalidate_ownership() {
    let f = Fixture::new();
    let sub = f.0.join("project");
    fs::create_dir(&sub).unwrap();
    fs::set_permissions(&sub, fs::Permissions::from_mode(0o700)).unwrap();
    let path = sub.join("source.fountain");
    fs::write(&path, b"original").unwrap();
    fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
    let mut service = f.service();
    let opened = service.open_selected(&path).unwrap();
    fs::rename(&sub, f.0.join("moved-project")).unwrap();
    fs::create_dir(&sub).unwrap();
    fs::write(&path, b"impostor").unwrap();
    code(
        service.validate_owner(&opened.identity),
        ErrorCode::SourceChanged,
    );
    assert_eq!(
        fs::read(f.0.join("moved-project/source.fountain")).unwrap(),
        b"original"
    );
    service.release(&opened.identity).unwrap();
    let source = f.source("next.fountain", b"synthetic");
    let opened = service.open_selected(&source).unwrap();
    let held_locks: Vec<_> = fs::read_dir(f.0.join("app-data"))
        .unwrap()
        .map(|e| e.unwrap().path())
        .filter(|p| p.extension().is_some_and(|e| e == "lock"))
        .collect();
    for lock in held_locks {
        fs::remove_file(&lock).unwrap();
        fs::write(&lock, b"").unwrap();
    }
    assert!(service.validate_owner(&opened.identity).is_err());
    assert_eq!(fs::read(&source).unwrap(), b"synthetic");
}

#[test]
fn metadata_changed_after_open_invalidates_managed_owner() {
    let f = Fixture::new();
    let path = f.source("source.fountain", b"synthetic");
    f.project(&Uuid::new_v4().to_string(), "source.fountain", 1);
    let mut service = f.service();
    let opened = service.open_selected(&path).unwrap();
    f.project(&Uuid::new_v4().to_string(), "source.fountain", 1);
    code(
        service.validate_owner(&opened.identity),
        ErrorCode::SourceChanged,
    );
    assert_eq!(service.read_initial(&opened.identity).unwrap(), opened);
}

#[test]
fn insecure_store_permissions_are_rejected_without_repair() {
    let f = Fixture::new();
    let store = f.0.join("app-data");
    fs::create_dir(&store).unwrap();
    fs::set_permissions(&store, fs::Permissions::from_mode(0o755)).unwrap();
    code(
        DocumentService::new(&store).map(|_| ()),
        ErrorCode::IdentityStoreUnavailable,
    );
    assert_eq!(
        fs::metadata(store).unwrap().permissions().mode() & 0o777,
        0o755
    );
}

#[test]
fn independent_process_honors_owner_and_needs_no_git() {
    let f = Fixture::new();
    let path = f.source("source.fountain", b"synthetic");
    let mut service = f.service();
    let opened = service.open_selected(&path).unwrap();
    let child = Command::new(std::env::current_exe().unwrap())
        .args(["--exact", "ownership_child", "--nocapture"])
        .env("BABEL_OWNERSHIP_CHILD_ROOT", &f.0)
        .env("PATH", "/nonexistent")
        .output()
        .unwrap();
    assert!(
        child.status.success(),
        "{}",
        String::from_utf8_lossy(&child.stdout)
    );
    service.validate_owner(&opened.identity).unwrap();
}

#[test]
fn ownership_child() {
    let Some(root) = std::env::var_os("BABEL_OWNERSHIP_CHILD_ROOT") else {
        return;
    };
    let root = PathBuf::from(root);
    let opened = DocumentService::new(&root.join("app-data"))
        .unwrap()
        .open_selected(&root.join("source.fountain"))
        .unwrap();
    assert!(has_reason(&opened, ViewReason::AlreadyOwned));
    assert_eq!(opened.source, b"synthetic");
}

#[test]
fn ipc_envelope_rejects_extra_paths_and_errors_exclude_content_and_paths() {
    let request = serde_json::json!({"handle": "h", "documentId": "d", "sessionId": "s", "path": "/private/source"});
    assert!(serde_json::from_value::<DocumentRequest>(request).is_err());
    let err = serde_json::to_value(DocumentError::new(ErrorCode::MissingSource)).unwrap();
    assert_eq!(
        err,
        serde_json::json!({"code": "missingSource", "action": "selectSourceAgain"})
    );
}
