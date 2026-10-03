use super::*;
use crate::documents::persistence::CheckpointRequest;
use std::os::unix::fs::{MetadataExt, PermissionsExt, symlink};

const OLD: &[u8] = b"\xef\xbb\xbf!Original\r\n  \r\n";
const DISK: &[u8] = b"!Outside\r\n";
const LOCAL: &[u8] = b"!Unsaved local\r\n";
struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let root = std::env::var_os("BABEL_SAVE_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir)
            .join(format!("babel-reload-{}", uuid()));
        std::fs::create_dir(&root).unwrap();
        std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o700)).unwrap();
        std::fs::write(root.join("source.fountain"), OLD).unwrap();
        Self(root)
    }
    fn open(&self) -> (DocumentService, OpenDocument) {
        let mut service = DocumentService::new(&self.0.join("data")).unwrap();
        let opened = service
            .open_selected(&self.0.join("source.fountain"))
            .unwrap();
        assert_eq!(opened.ownership, Ownership::Exclusive);
        (service, opened)
    }
    fn source(&self) -> PathBuf {
        self.0.join("source.fountain")
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        std::fs::remove_dir_all(&self.0).unwrap();
    }
}
fn capture(
    opened: &OpenDocument,
    version: u64,
    bytes: &[u8],
    fingerprint: DiskFingerprint,
) -> CheckpointRequest {
    CheckpointRequest {
        identity: opened.identity.clone(),
        version,
        source: bytes.to_vec(),
        source_sha256: source_hash(bytes),
        expected_fingerprint: Some(fingerprint),
        draft_metadata: serde_json::json!({}),
    }
}
fn check(opened: &OpenDocument) -> SourceCheckRequest {
    SourceCheckRequest {
        identity: opened.identity.clone(),
        expected_fingerprint: opened.fingerprint.clone().unwrap(),
    }
}
fn reload(service: &mut DocumentService, opened: &OpenDocument, local: &[u8]) -> ReloadRequest {
    let observed = service.check_source(&check(opened)).unwrap();
    assert_eq!(observed.status, SourceCheckStatus::Changed);
    ReloadRequest {
        current: capture(opened, 1, local, opened.fingerprint.clone().unwrap()),
        adopted: capture(opened, 2, DISK, observed.fingerprint),
    }
}

#[test]
fn reload_preserves_dirty_draft_and_acknowledges_disk_without_replacement() {
    for atomic in [false, true] {
        let f = Fixture::new();
        let (mut s, o) = f.open();
        if atomic {
            std::fs::write(f.0.join("new"), DISK).unwrap();
            std::fs::rename(f.0.join("new"), f.source()).unwrap();
        } else {
            std::fs::write(f.source(), DISK).unwrap();
        }
        let before = std::fs::metadata(f.source()).unwrap();
        let request = reload(&mut s, &o, LOCAL);
        let receipt = s.reload_source_document(&request).unwrap();
        assert_eq!(receipt.version, 2);
        assert_eq!(
            receipt.fingerprint,
            request.adopted.expected_fingerprint.clone().unwrap()
        );
        assert_eq!(std::fs::read(f.source()).unwrap(), DISK);
        assert_eq!(std::fs::metadata(f.source()).unwrap().ino(), before.ino());
        assert_eq!(
            std::fs::metadata(f.source()).unwrap().mtime_nsec(),
            before.mtime_nsec()
        );
        assert!(
            s.list_snapshots(&o.identity)
                .unwrap()
                .entries
                .iter()
                .any(|e| e.record.source_sha256 == source_hash(LOCAL))
        );
        assert_eq!(
            s.inspect_recovery(&o.identity)
                .unwrap()
                .latest
                .unwrap()
                .source,
            DISK
        );
        s.validate_owner(&o.identity).unwrap();
        // Undo is a later exact version, saved through the unchanged native replacement engine.
        s.enqueue_save(SaveRequest {
            identity: o.identity.clone(),
            version: 3,
            source: LOCAL.to_vec(),
            source_sha256: source_hash(LOCAL),
            expected_fingerprint: receipt.fingerprint,
            draft_metadata: serde_json::json!({}),
        })
        .unwrap();
        s.save_next(&o.identity).unwrap().unwrap();
        assert_eq!(std::fs::read(f.source()).unwrap(), LOCAL);
    }
}
#[test]
fn metadata_only_recheck_transfers_inode_lease_without_save_credit() {
    let f = Fixture::new();
    let (mut s, o) = f.open();
    assert_eq!(
        s.check_source(&check(&o)).unwrap().status,
        SourceCheckStatus::Unchanged
    );
    std::fs::write(f.0.join("new"), OLD).unwrap();
    std::fs::rename(f.0.join("new"), f.source()).unwrap();
    let observed = s.check_source(&check(&o)).unwrap();
    assert_eq!(observed.status, SourceCheckStatus::MetadataOnly);
    assert!(observed.source.is_none());
    assert!(s.registered(&o.identity).unwrap().last_save.is_none());
    s.validate_owner(&o.identity).unwrap();
    assert_eq!(
        s.check_source(&check(&o)).unwrap_err().code,
        ErrorCode::SourceChanged
    );
}
#[test]
fn stale_review_or_race_retains_disk_and_protected_live_draft() {
    let f = Fixture::new();
    let (mut s, o) = f.open();
    std::fs::write(f.source(), DISK).unwrap();
    let request = reload(&mut s, &o, LOCAL);
    let err = s
        .reload_source_with(&request, |_| {
            std::fs::write(f.source(), b"later").unwrap();
            Ok(())
        })
        .unwrap_err();
    assert_eq!(err.code, ErrorCode::SourceChanged);
    assert_eq!(std::fs::read(f.source()).unwrap(), b"later");
    assert_eq!(s.registered(&o.identity).unwrap().baseline, o.fingerprint);
    assert!(
        s.list_snapshots(&o.identity)
            .unwrap()
            .entries
            .iter()
            .any(|e| e.record.source_sha256 == source_hash(LOCAL))
    );
    assert_eq!(
        s.reload_source_document(&request).unwrap_err().code,
        ErrorCode::SourceChanged
    );
}
#[test]
fn unavailable_unsafe_invalid_and_failed_protection_refuse_adoption() {
    for scenario in [
        "missing",
        "symlink",
        "permissions",
        "encoding",
        "history",
        "identity",
    ] {
        let f = Fixture::new();
        let (mut s, o) = f.open();
        std::fs::write(f.source(), DISK).unwrap();
        let mut request = reload(&mut s, &o, LOCAL);
        match scenario {
            "missing" => std::fs::remove_file(f.source()).unwrap(),
            "symlink" => {
                std::fs::remove_file(f.source()).unwrap();
                symlink("elsewhere", f.source()).unwrap();
            }
            "permissions" => {
                std::fs::set_permissions(f.source(), std::fs::Permissions::from_mode(0o666))
                    .unwrap()
            }
            "encoding" => {
                request.adopted.source = vec![255];
                request.adopted.source_sha256 = source_hash(&[255]);
            }
            "history" => {
                std::fs::create_dir(f.0.join("data/history")).unwrap();
                std::fs::set_permissions(
                    f.0.join("data/history"),
                    std::fs::Permissions::from_mode(0o500),
                )
                .unwrap();
            }
            "identity" => request.adopted.identity.session_id = uuid(),
            _ => unreachable!(),
        }
        assert!(s.reload_source_document(&request).is_err(), "{scenario}");
        assert_eq!(s.registered(&o.identity).unwrap().baseline, o.fingerprint);
        if scenario == "history" {
            assert_eq!(
                s.inspect_recovery(&o.identity)
                    .unwrap()
                    .latest
                    .unwrap()
                    .source,
                LOCAL
            );
            std::fs::set_permissions(
                f.0.join("data/history"),
                std::fs::Permissions::from_mode(0o700),
            )
            .unwrap();
        }
    }
}

#[test]
fn failure_after_adopted_checkpoint_keeps_recovery_available_at_a_newer_live_version() {
    let f = Fixture::new();
    let (mut s, o) = f.open();
    std::fs::write(f.source(), DISK).unwrap();
    let request = reload(&mut s, &o, LOCAL);
    let error = s
        .reload_source_with(&request, |adopted| {
            if adopted == ReloadStage::AdoptedProtected {
                std::fs::write(f.source(), b"third external generation").unwrap();
            }
            Ok(())
        })
        .unwrap_err();
    assert_eq!(error.code, ErrorCode::SourceChanged);
    assert_eq!(s.registered(&o.identity).unwrap().baseline, o.fingerprint);
    assert_eq!(
        s.inspect_recovery(&o.identity)
            .unwrap()
            .latest
            .unwrap()
            .metadata
            .version,
        2
    );
    // Frontend skips the reserved adopted version without changing retained content/Undo.
    s.checkpoint_request(capture(&o, 3, LOCAL, o.fingerprint.clone().unwrap()))
        .unwrap();
    assert_eq!(
        s.inspect_recovery(&o.identity)
            .unwrap()
            .latest
            .unwrap()
            .source,
        LOCAL
    );
    assert_eq!(
        std::fs::read(f.source()).unwrap(),
        b"third external generation"
    );
}

#[test]
fn exact_version_retry_after_metadata_reanchor_preserves_immutable_recovery_base() {
    let f = Fixture::new();
    let (mut s, o) = f.open();
    let retained = capture(&o, 1, OLD, o.fingerprint.clone().unwrap());
    s.checkpoint_request(retained.clone()).unwrap();
    std::fs::write(f.0.join("new"), OLD).unwrap();
    std::fs::rename(f.0.join("new"), f.source()).unwrap();
    let observed = s.check_source(&check(&o)).unwrap();
    s.checkpoint_request(retained.clone()).unwrap();
    s.enqueue_save(SaveRequest {
        identity: o.identity.clone(),
        version: 1,
        source: OLD.to_vec(),
        source_sha256: source_hash(OLD),
        expected_fingerprint: observed.fingerprint.clone(),
        draft_metadata: retained.draft_metadata,
    })
    .unwrap();
    let saved = s.save_next(&o.identity).unwrap().unwrap();
    assert_eq!(saved.fingerprint, observed.fingerprint);
    assert_eq!(
        s.inspect_recovery(&o.identity)
            .unwrap()
            .latest
            .unwrap()
            .metadata
            .base_fingerprint,
        o.fingerprint
    );
    std::fs::write(f.source(), DISK).unwrap();
    let review = s
        .check_source(&SourceCheckRequest {
            identity: o.identity.clone(),
            expected_fingerprint: saved.fingerprint.clone(),
        })
        .unwrap();
    let request = ReloadRequest {
        current: capture(&o, 1, OLD, saved.fingerprint),
        adopted: capture(&o, 2, DISK, review.fingerprint),
    };
    s.reload_source_document(&request).unwrap();
}
