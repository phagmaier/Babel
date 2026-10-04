//! Real disposable native files. Injected errors and SIGKILL are labeled separately.
use super::*;
use crate::documents::persistence::CheckpointRequest;
use crate::test_support::TestRoot;
use std::io::{BufRead, BufReader};
use std::os::unix::fs::PermissionsExt;
use std::process::{Command, Stdio};

const ORIGINAL: &[u8] = b"\xef\xbb\xbfINT. OLD - DAY\r\n\r\nKeep  spaces.\r\n";
const NEW: &[u8] = b"INT. NEW - NIGHT\n\nExact  text without final newline";

#[test]
fn draft_bundle_copy_is_exact_labeled_version_bound_and_independent_of_source_save() {
    let f = Fixture::new();
    let (mut service, open) = f.open();
    let destination = service
        .select_copy_destination(&open.identity, &f.0)
        .unwrap();
    let bytes = br#"{"schema":"babel-draft-copy-v1","version":21,"originalSourceBase64":"/wA=","rows":[{"kind":"parenthetical","runs":[{"text":"(sof","styles":["bold"]}]}],"selection":{"anchor":4,"head":4}}"#;
    let mut request = ExternalCopyRequest {
        checkpoint: checkpoint(&open, 21, bytes),
        destination_token: destination.token,
        format: CopyFormat::DraftBundle,
    };
    let receipt = service.save_external_copy(&request).unwrap();
    assert!(receipt.file_name.ends_with(".draft.json"));
    assert_eq!(std::fs::read(f.0.join(receipt.file_name)).unwrap(), bytes);
    assert_eq!(
        std::fs::read(f.0.join("source.fountain")).unwrap(),
        ORIGINAL
    );
    request.checkpoint.version = 22;
    assert_eq!(
        service.save_external_copy(&request).unwrap_err().code,
        ErrorCode::InvalidCheckpoint
    );
}

#[test]
fn repeated_copy_selection_retires_old_tokens_without_exhausting_a_session() {
    let f = Fixture::new();
    let (mut service, open) = f.open();
    let first = service
        .select_copy_destination(&open.identity, &f.0)
        .unwrap();
    let mut latest = first.clone();
    for _ in 0..(MAX_OPEN_DOCUMENTS + 5) {
        latest = service
            .select_copy_destination(&open.identity, &f.0)
            .unwrap();
    }
    assert_eq!(
        service
            .save_external_copy(&ExternalCopyRequest {
                checkpoint: checkpoint(&open, 21, NEW),
                destination_token: first.token,
                format: CopyFormat::Fountain
            })
            .unwrap_err()
            .code,
        ErrorCode::InvalidDestination
    );
    assert!(
        service
            .select_copy_destination(&open.identity, &f.0.join("missing"))
            .is_err()
    );
    let receipt = service
        .save_external_copy(&ExternalCopyRequest {
            checkpoint: checkpoint(&open, 21, NEW),
            destination_token: latest.token,
            format: CopyFormat::Fountain,
        })
        .unwrap();
    assert_eq!(std::fs::read(f.0.join(receipt.file_name)).unwrap(), NEW);
}

#[test]
fn restore_uses_replacement_metadata_and_accepts_an_immediate_same_version_save() {
    let f = Fixture::new();
    let (mut service, open) = f.open();
    let entry = service
        .create_snapshot(&SnapshotRequest {
            checkpoint: checkpoint(&open, 1, NEW),
            kind: SnapshotKind::Named,
            name: Some("Earlier".into()),
        })
        .unwrap()
        .unwrap();
    let metadata = serde_json::json!({"schema":"babel-editor-capture-v1","sourceSha256":hash(NEW),"selection":null,"drafts":[]});
    let mut current = checkpoint(&open, 2, ORIGINAL);
    current.draft_metadata = serde_json::json!({"sourceSha256":hash(ORIGINAL)});
    let restored = service
        .restore_snapshot(&RestoreSnapshotRequest {
            current,
            selection: entry.selection,
            new_version: 3,
            replacement_metadata: Some(metadata.clone()),
            expected_fingerprint: open.fingerprint.clone().unwrap(),
        })
        .unwrap();
    assert_eq!(
        service
            .inspect_recovery(&open.identity)
            .unwrap()
            .latest
            .unwrap()
            .metadata
            .draft_metadata,
        metadata
    );
    service
        .checkpoint(&open.identity, 3, NEW, &hash(NEW), metadata.clone())
        .unwrap();
    let saved = service
        .save_request(SaveRequest {
            identity: open.identity,
            version: 3,
            source: NEW.to_vec(),
            source_sha256: hash(NEW),
            expected_fingerprint: restored.fingerprint,
            draft_metadata: metadata,
        })
        .unwrap();
    assert_eq!(saved.version, 3);
    assert_eq!(std::fs::read(f.0.join("source.fountain")).unwrap(), NEW);
}
struct Fixture(TestRoot);
impl Fixture {
    fn new() -> Self {
        let root = TestRoot::new("BABEL_SNAPSHOT_TEST_ROOT", "babel-snapshots");
        root.write("source.fountain", ORIGINAL, 0o600);
        Self(root)
    }
    fn open(&self) -> (DocumentService, OpenDocument) {
        let mut service = DocumentService::new(&self.0.join("app-data")).unwrap();
        let opened = service
            .open_selected(&self.0.join("source.fountain"))
            .unwrap();
        (service, opened)
    }
    fn dir(&self, opened: &OpenDocument) -> PathBuf {
        self.0
            .join("app-data/snapshots")
            .join(&opened.identity.document_id)
    }
}
fn checkpoint(open: &OpenDocument, version: u64, bytes: &[u8]) -> CheckpointRequest {
    CheckpointRequest {
        identity: open.identity.clone(),
        version,
        source: bytes.to_vec(),
        source_sha256: hash(bytes),
        expected_fingerprint: open.fingerprint.clone(),
        draft_metadata: serde_json::json!({"draft": {"keep": true}}),
    }
}
fn named(open: &OpenDocument, version: u64, bytes: &[u8]) -> SnapshotRequest {
    SnapshotRequest {
        checkpoint: checkpoint(open, version, bytes),
        kind: SnapshotKind::Named,
        name: Some("Before experiment".into()),
    }
}
fn create_at(
    service: &DocumentService,
    open: &OpenDocument,
    source: &[u8],
    kind: SnapshotKind,
    clock: u64,
) -> SnapshotEntry {
    service
        .snapshot_with(
            &open.identity,
            Some(1),
            source,
            kind,
            (kind == SnapshotKind::Named).then(|| "Named".into()),
            clock,
            |_| Ok(()),
        )
        .unwrap()
        .unwrap()
}
#[test]
fn portable_exact_bytes_dedup_interval_raw_and_restart() {
    let f = Fixture::new();
    let (mut service, opened) = f.open();
    let original = service
        .create_snapshot(&named(&opened, 1, ORIGINAL))
        .unwrap()
        .unwrap();
    let raw = b"\0\xffraw\r\n  ";
    let raw_entry = service
        .create_snapshot(&named(&opened, 2, raw))
        .unwrap()
        .unwrap();
    service
        .create_snapshot(&named(&opened, 3, ORIGINAL))
        .unwrap()
        .unwrap();
    let catalog = service.list_snapshots(&opened.identity).unwrap();
    assert_eq!(catalog.source_bytes, (ORIGINAL.len() + raw.len()) as u64);
    assert_eq!(catalog.entries.len(), 3);
    assert!(!catalog.needs_attention);
    assert_eq!(
        std::fs::read(f.dir(&opened).join(blob_name(&hash(ORIGINAL)))).unwrap(),
        ORIGINAL
    );
    assert_eq!(
        service
            .read_snapshot(&SnapshotReadRequest {
                identity: opened.identity.clone(),
                selection: raw_entry.selection
            })
            .unwrap()
            .source,
        raw
    );
    create_at(&service, &opened, NEW, SnapshotKind::Rolling, 1000);
    assert!(
        service
            .snapshot_with(
                &opened.identity,
                Some(4),
                b"too soon",
                SnapshotKind::Rolling,
                None,
                1299,
                |_| Ok(())
            )
            .unwrap()
            .is_none()
    );
    assert!(
        service
            .snapshot_with(
                &opened.identity,
                Some(4),
                NEW,
                SnapshotKind::Rolling,
                None,
                1300,
                |_| Ok(())
            )
            .unwrap()
            .is_none()
    );
    drop(service);
    let (service, reopened) = f.open();
    assert_eq!(
        service
            .read_snapshot(&SnapshotReadRequest {
                identity: reopened.identity.clone(),
                selection: original.selection
            })
            .unwrap()
            .source,
        ORIGINAL
    );
    assert_eq!(
        std::fs::read(f.0.join("source.fountain")).unwrap(),
        ORIGINAL
    );
}
#[test]
fn retention_buckets_protected_newest_and_backward_clock() {
    let f = Fixture::new();
    let (service, open) = f.open();
    let clock = 40 * 86400;
    let protected = create_at(&service, &open, b"named", SnapshotKind::Named, 1);
    let destructive = create_at(&service, &open, b"safety", SnapshotKind::PreDestructive, 2);
    let expired = create_at(&service, &open, b"expired", SnapshotKind::Rolling, 3);
    let daily_old = create_at(
        &service,
        &open,
        b"day old",
        SnapshotKind::Rolling,
        20 * 86400,
    );
    let daily_new = create_at(
        &service,
        &open,
        b"day new",
        SnapshotKind::Rolling,
        20 * 86400 + 300,
    );
    let hourly_old = create_at(
        &service,
        &open,
        b"hour old",
        SnapshotKind::Rolling,
        clock - 7200,
    );
    let hourly_new = create_at(
        &service,
        &open,
        b"hour new",
        SnapshotKind::Rolling,
        clock - 6900,
    );
    let recent = create_at(
        &service,
        &open,
        b"recent",
        SnapshotKind::Rolling,
        clock - 600,
    );
    let future = create_at(
        &service,
        &open,
        b"future",
        SnapshotKind::Rolling,
        clock + 600,
    );
    let catalog = service
        .prune_with(&open.identity, clock, |_| Ok(()))
        .unwrap();
    let ids: BTreeSet<_> = catalog
        .entries
        .iter()
        .map(|e| e.record.snapshot_id.clone())
        .collect();
    for keep in [
        protected,
        destructive,
        daily_new,
        hourly_new,
        recent,
        future,
    ] {
        assert!(ids.contains(&keep.record.snapshot_id));
    }
    for remove in [expired, daily_old, hourly_old] {
        assert!(!ids.contains(&remove.record.snapshot_id));
    }
    assert!(!catalog.needs_attention);
    assert_eq!(
        service.prune_with(&open.identity, 0, |_| Ok(())).unwrap(),
        catalog
    );
}
#[test]
fn cap_never_removes_protected_material_and_hash_name_validation() {
    let f = Fixture::new();
    let (mut service, open) = f.open();
    let mut bad = named(&open, 1, NEW);
    bad.checkpoint.source_sha256 = hash(ORIGINAL);
    assert_eq!(
        service.create_snapshot(&bad).unwrap_err().code,
        ErrorCode::InvalidCheckpoint
    );
    bad = named(&open, 1, NEW);
    bad.name = Some("\n".into());
    assert_eq!(
        service.create_snapshot(&bad).unwrap_err().code,
        ErrorCode::InvalidSnapshot
    );
    let first = service
        .create_snapshot(&named(&open, 1, NEW))
        .unwrap()
        .unwrap();
    // Independent record seeding avoids 256 production publication passes.
    for n in 1..MAX_SNAPSHOT_RECORDS {
        let mut record = first.record.clone();
        record.snapshot_id = uuid();
        record.version = Some(n as u64 + 1);
        let e = Envelope {
            record_sha256: record_hash(&record).unwrap(),
            record,
        };
        let path = f.dir(&open).join(record_name(&e.record.snapshot_id));
        std::fs::write(&path, serde_json::to_vec(&e).unwrap()).unwrap();
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600)).unwrap();
    }
    let before = service.list_snapshots(&open.identity).unwrap();
    assert!(before.at_limit);
    assert_eq!(
        service
            .create_snapshot(&named(&open, 257, ORIGINAL))
            .unwrap_err()
            .code,
        ErrorCode::SnapshotLimit
    );
    assert_eq!(service.prune_snapshots(&open.identity).unwrap(), before);
    assert_eq!(service.list_snapshots(&open.identity).unwrap(), before);
}
#[test]
fn publication_failure_matrix_preserves_source_previous_and_pending() {
    for target in [
        Stage::MetadataPartial,
        Stage::MetadataSynced,
        Stage::SourcePartial,
        Stage::SourceSynced,
        Stage::BlobPublished,
        Stage::RecordPublished,
        Stage::DirectorySynced,
    ] {
        let f = Fixture::new();
        let (service, open) = f.open();
        let prior = create_at(&service, &open, ORIGINAL, SnapshotKind::Named, 1);
        let err = service
            .snapshot_with(
                &open.identity,
                Some(2),
                NEW,
                SnapshotKind::Named,
                Some("New".into()),
                2,
                |s| {
                    if s == target {
                        Err(syscall_error(Errno::NOSPC))
                    } else {
                        Ok(())
                    }
                },
            )
            .unwrap_err();
        assert_eq!(err.code, ErrorCode::Io);
        assert_eq!(
            std::fs::read(f.0.join("source.fountain")).unwrap(),
            ORIGINAL
        );
        assert_eq!(
            service
                .read_snapshot(&SnapshotReadRequest {
                    identity: open.identity.clone(),
                    selection: prior.selection
                })
                .unwrap()
                .source,
            ORIGINAL
        );
        let catalog = service.list_snapshots(&open.identity).unwrap();
        if !matches!(target, Stage::RecordPublished | Stage::DirectorySynced) {
            assert!(catalog.needs_attention);
            assert_eq!(
                service
                    .prune_with(&open.identity, 40 * 86400, |_| Ok(()))
                    .unwrap_err()
                    .code,
                ErrorCode::SnapshotNeedsAttention
            );
        }
    }
}
#[test]
fn prune_failure_matrix_never_dangles_survivors_or_touches_recovery() {
    for target in [
        Stage::BeforePrune,
        Stage::RecordRemoved,
        Stage::PruneSynced,
        Stage::BlobRemoved,
    ] {
        let f = Fixture::new();
        let (mut service, open) = f.open();
        service
            .checkpoint_request(checkpoint(&open, 1, b"live recovery"))
            .unwrap();
        create_at(&service, &open, b"expired", SnapshotKind::Rolling, 1);
        let kept = create_at(&service, &open, NEW, SnapshotKind::Rolling, 40 * 86400);
        assert!(
            service
                .prune_with(&open.identity, 40 * 86400, |s| if s == target {
                    Err(error(ErrorCode::Io))
                } else {
                    Ok(())
                })
                .is_err()
        );
        assert_eq!(
            service
                .read_snapshot(&SnapshotReadRequest {
                    identity: open.identity.clone(),
                    selection: kept.selection
                })
                .unwrap()
                .source,
            NEW
        );
        assert_eq!(
            service
                .inspect_recovery(&open.identity)
                .unwrap()
                .latest
                .unwrap()
                .source,
            b"live recovery"
        );
        assert_eq!(
            std::fs::read(f.0.join("source.fountain")).unwrap(),
            ORIGINAL
        );
        let catalog = service.list_snapshots(&open.identity).unwrap();
        assert_eq!(
            catalog.needs_attention,
            matches!(target, Stage::RecordRemoved | Stage::PruneSynced)
        );
    }
}
#[test]
fn unresolved_recovery_external_source_and_view_only_block_pruning() {
    let f = Fixture::new();
    let (mut service, open) = f.open();
    create_at(&service, &open, NEW, SnapshotKind::Rolling, 1);
    service
        .checkpoint_request(checkpoint(&open, 1, NEW))
        .unwrap();
    drop(service);
    let (service, reopened) = f.open();
    assert_eq!(
        service
            .prune_with(&reopened.identity, 40 * 86400, |_| Ok(()))
            .unwrap_err()
            .code,
        ErrorCode::RecoveryNeedsAttention
    );
    let (mut other, view) = f.open();
    assert_eq!(
        other
            .create_snapshot(&named(&view, 1, NEW))
            .unwrap_err()
            .code,
        ErrorCode::OwnershipRequired
    );
    drop(other);
    drop(service);
    let (service, reopened) = f.open();
    std::fs::write(f.0.join("source.fountain"), b"external").unwrap();
    // Older-session recovery wins the conservative guard first; no deletion.
    assert!(
        service
            .prune_with(&reopened.identity, 40 * 86400, |_| Ok(()))
            .is_err()
    );
    assert_eq!(
        std::fs::read(f.0.join("source.fountain")).unwrap(),
        b"external"
    );
}
#[test]
fn stale_future_corrupt_orphan_and_symlink_material_is_preserved() {
    let f = Fixture::new();
    let (mut service, open) = f.open();
    let first = service
        .create_snapshot(&named(&open, 1, ORIGINAL))
        .unwrap()
        .unwrap();
    let path = f.dir(&open).join(record_name(&first.record.snapshot_id));
    let original = std::fs::read(&path).unwrap();
    let mut envelope: Envelope = serde_json::from_slice(&original).unwrap();
    envelope.record.schema_version = 2;
    std::fs::write(&path, serde_json::to_vec(&envelope).unwrap()).unwrap();
    assert!(
        service
            .list_snapshots(&open.identity)
            .unwrap()
            .needs_attention
    );
    assert!(
        service
            .read_snapshot(&SnapshotReadRequest {
                identity: open.identity.clone(),
                selection: first.selection.clone()
            })
            .is_err()
    );
    assert_eq!(
        service
            .create_snapshot(&named(&open, 2, NEW))
            .unwrap_err()
            .code,
        ErrorCode::SnapshotNeedsAttention
    );
    std::fs::write(&path, &original).unwrap();
    std::os::unix::fs::symlink(
        f.0.join("source.fountain"),
        f.dir(&open).join("pending.fountain"),
    )
    .unwrap();
    assert!(
        service
            .list_snapshots(&open.identity)
            .unwrap()
            .needs_attention
    );
    assert!(service.prune_snapshots(&open.identity).is_err());
    assert_eq!(std::fs::read(&path).unwrap(), original);
}
#[test]
fn restore_protects_live_and_disk_as_new_version_and_rejects_stale_or_raw() {
    let f = Fixture::new();
    let (mut service, open) = f.open();
    let old = service
        .create_snapshot(&named(&open, 1, NEW))
        .unwrap()
        .unwrap();
    let raw = service
        .create_snapshot(&named(&open, 2, b"\xffraw"))
        .unwrap()
        .unwrap();
    let mut request = RestoreSnapshotRequest {
        replacement_metadata: None,
        current: checkpoint(&open, 21, b"unsaved live"),
        selection: raw.selection,
        new_version: 22,
        expected_fingerprint: open.fingerprint.clone().unwrap(),
    };
    assert!(service.restore_snapshot(&request).is_err());
    request.selection = old.selection.clone();
    request.new_version = 21;
    assert!(service.restore_snapshot(&request).is_err());
    request.new_version = 22;
    let receipt = service.restore_snapshot(&request).unwrap();
    assert_eq!(receipt.version, 22);
    assert_eq!(receipt.source_sha256, hash(NEW));
    assert_eq!(std::fs::read(f.0.join("source.fountain")).unwrap(), NEW);
    let catalog = service.list_snapshots(&open.identity).unwrap();
    let protected: Vec<_> = catalog
        .entries
        .iter()
        .filter(|e| e.record.kind == SnapshotKind::PreDestructive)
        .collect();
    assert!(
        protected.iter().any(
            |e| e.record.source_sha256 == hash(b"unsaved live") && e.record.version == Some(21)
        )
    );
    assert!(
        protected
            .iter()
            .any(|e| e.record.source_sha256 == hash(ORIGINAL) && e.record.version.is_none())
    );
    assert_eq!(
        service
            .inspect_source_save(&open.identity)
            .unwrap()
            .previous
            .unwrap(),
        ORIGINAL
    );
    assert_eq!(
        service
            .inspect_recovery(&open.identity)
            .unwrap()
            .latest
            .unwrap()
            .source,
        NEW
    );
    assert!(service.restore_snapshot(&request).is_err());
}
#[test]
fn external_copy_exact_raw_native_scope_removed_destination_and_failure_isolation() {
    let f = Fixture::new();
    let (mut service, open) = f.open();
    let backup = f.0.join("backup");
    std::fs::create_dir(&backup).unwrap();
    std::fs::set_permissions(&backup, std::fs::Permissions::from_mode(0o700)).unwrap();
    let destination = service
        .select_copy_destination(&open.identity, &backup)
        .unwrap();
    assert_eq!(
        destination.storage_relation,
        StorageRelation::SameFilesystem
    );
    let request = ExternalCopyRequest {
        checkpoint: checkpoint(&open, 21, b"\xff\0exact raw\r\n"),
        destination_token: destination.token.clone(),
        format: CopyFormat::Fountain,
    };
    let receipt = service.save_external_copy(&request).unwrap();
    assert_eq!(receipt.version, 21);
    assert_eq!(
        std::fs::read(backup.join(receipt.file_name)).unwrap(),
        request.checkpoint.source
    );
    for target in [Stage::CopyPartial, Stage::CopySynced, Stage::CopyPublished] {
        assert!(
            service
                .copy_with(&request, |s| if s == target {
                    Err(syscall_error(Errno::NOSPC))
                } else {
                    Ok(())
                })
                .is_err()
        );
    }
    assert_eq!(
        std::fs::read(f.0.join("source.fountain")).unwrap(),
        ORIGINAL
    );
    // Backup failure is independent: ordinary recovery/source save still succeeds.
    let saved = service
        .save_request(SaveRequest {
            identity: open.identity.clone(),
            version: 22,
            source: NEW.to_vec(),
            source_sha256: hash(NEW),
            expected_fingerprint: open.fingerprint.clone().unwrap(),
            draft_metadata: serde_json::json!({}),
        })
        .unwrap();
    assert_eq!(saved.version, 22);
    let other = service.register_unsaved().unwrap();
    let mut foreign = request.clone();
    foreign.checkpoint.identity = other.identity;
    assert_eq!(
        service.save_external_copy(&foreign).unwrap_err().code,
        ErrorCode::InvalidDestination
    );
    std::fs::rename(&backup, f.0.join("moved-backup")).unwrap();
    std::fs::create_dir(&backup).unwrap();
    assert!(service.save_external_copy(&request).is_err());
    service.release(&open.identity).unwrap();
    assert!(service.save_external_copy(&request).is_err());
}
#[test]
fn native_sigkill_publication_and_prune_keep_valid_paths() {
    for target in [
        Stage::MetadataPartial,
        Stage::SourcePartial,
        Stage::BlobPublished,
        Stage::RecordPublished,
        Stage::RecordRemoved,
        Stage::PruneSynced,
        Stage::BlobRemoved,
    ] {
        let f = Fixture::new();
        let mut child = Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "documents::linux::snapshot_store::tests::crash_child",
                "--nocapture",
            ])
            .env("BABEL_SNAPSHOT_CHILD_ROOT", &f.0)
            .env("BABEL_SNAPSHOT_CHILD_STAGE", format!("{target:?}"))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        let mut output = BufReader::new(child.stdout.take().unwrap());
        let mut line = String::new();
        loop {
            line.clear();
            assert_ne!(
                output.read_line(&mut line).unwrap(),
                0,
                "child exited before {target:?}"
            );
            if line.contains("BABEL_SNAPSHOT_BARRIER") {
                break;
            }
        }
        child.kill().unwrap();
        assert!(!child.wait().unwrap().success());
        let (service, open) = f.open();
        let catalog = service.list_snapshots(&open.identity).unwrap();
        assert_eq!(
            std::fs::read(f.0.join("source.fountain")).unwrap(),
            ORIGINAL
        );
        assert!(
            catalog
                .entries
                .iter()
                .any(|e| e.record.source_sha256 == hash(ORIGINAL))
        );
        for e in catalog.entries {
            let preview = service
                .read_snapshot(&SnapshotReadRequest {
                    identity: open.identity.clone(),
                    selection: e.selection,
                })
                .unwrap();
            assert_eq!(hash(&preview.source), preview.entry.record.source_sha256);
        }
    }
}
#[test]
fn sigkill_during_local_restore_retains_disk_live_and_selected_generations() {
    for stage in [
        source_store::Stage::RecoveryProtected,
        source_store::Stage::BeforeReplace,
        source_store::Stage::Replaced,
    ] {
        let f = Fixture::new();
        let mut child = Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "documents::linux::snapshot_store::tests::restore_crash_child",
                "--nocapture",
            ])
            .env("BABEL_RESTORE_CHILD_ROOT", &f.0)
            .env("BABEL_RESTORE_CHILD_STAGE", format!("{stage:?}"))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        let mut output = BufReader::new(child.stdout.take().unwrap());
        let mut line = String::new();
        loop {
            line.clear();
            assert_ne!(
                output.read_line(&mut line).unwrap(),
                0,
                "child exited before {stage:?}"
            );
            if line.contains("BABEL_RESTORE_BARRIER") {
                break;
            }
        }
        child.kill().unwrap();
        assert!(!child.wait().unwrap().success());
        let (service, open) = f.open();
        let expected = if stage == source_store::Stage::Replaced {
            NEW
        } else {
            ORIGINAL
        };
        assert_eq!(open.source, expected, "{stage:?}");
        assert_eq!(open.fingerprint.as_ref().unwrap().sha256, hash(expected));
        let entries = service.list_snapshots(&open.identity).unwrap().entries;
        for literal in [ORIGINAL, NEW, b"unsaved live before restore\r\n"] {
            let entry = entries
                .iter()
                .find(|e| e.record.source_sha256 == hash(literal))
                .unwrap();
            let preview = service
                .read_snapshot(&SnapshotReadRequest {
                    identity: open.identity.clone(),
                    selection: entry.selection.clone(),
                })
                .unwrap();
            assert_eq!(preview.source, literal, "{stage:?}");
            assert_eq!(preview.entry.record.source_sha256, hash(literal));
        }
        let recovery = service.inspect_recovery(&open.identity).unwrap();
        assert_eq!(recovery.latest.unwrap().source, NEW);
        let transaction = service.inspect_source_save(&open.identity).unwrap();
        if stage != source_store::Stage::RecoveryProtected {
            assert_eq!(transaction.previous.as_deref(), Some(ORIGINAL));
        }
        if stage == source_store::Stage::BeforeReplace {
            assert_eq!(transaction.candidate.as_deref(), Some(NEW));
        }
    }
}

#[test]
fn restore_crash_child() {
    let Some(root) = std::env::var_os("BABEL_RESTORE_CHILD_ROOT") else {
        return;
    };
    let f = Fixture(PathBuf::from(root).into());
    let (mut service, open) = f.open();
    let selected = service
        .create_snapshot(&named(&open, 1, NEW))
        .unwrap()
        .unwrap();
    let request = RestoreSnapshotRequest {
        replacement_metadata: None,
        current: checkpoint(&open, 21, b"unsaved live before restore\r\n"),
        selection: selected.selection,
        new_version: 22,
        expected_fingerprint: open.fingerprint.clone().unwrap(),
    };
    let target = std::env::var("BABEL_RESTORE_CHILD_STAGE").unwrap();
    let _ = service.restore_snapshot_with(&request, |stage| {
        if format!("{stage:?}") == target {
            println!("BABEL_RESTORE_BARRIER");
            std::io::stdout().flush().unwrap();
            let mut byte = [0];
            std::io::stdin().read_exact(&mut byte).unwrap();
        }
        Ok(())
    });
    std::mem::forget(f);
}

#[test]
fn crash_child() {
    let Some(root) = std::env::var_os("BABEL_SNAPSHOT_CHILD_ROOT") else {
        return;
    };
    let f = Fixture(PathBuf::from(root).into());
    let (service, open) = f.open();
    create_at(&service, &open, ORIGINAL, SnapshotKind::Named, 1);
    let target = std::env::var("BABEL_SNAPSHOT_CHILD_STAGE").unwrap();
    let gate = |stage| {
        if format!("{stage:?}") == target {
            println!("BABEL_SNAPSHOT_BARRIER");
            std::io::stdout().flush().unwrap();
            let mut byte = [0];
            std::io::stdin().read_exact(&mut byte).unwrap();
        }
        Ok(())
    };
    if ["RecordRemoved", "PruneSynced", "BlobRemoved"].contains(&target.as_str()) {
        create_at(&service, &open, b"expired", SnapshotKind::Rolling, 2);
        create_at(&service, &open, NEW, SnapshotKind::Rolling, 40 * 86400);
        let _ = service.prune_with(&open.identity, 40 * 86400, gate);
    } else {
        let _ = service.snapshot_with(
            &open.identity,
            Some(2),
            NEW,
            SnapshotKind::Named,
            Some("new".into()),
            2,
            gate,
        );
    }
    std::mem::forget(f);
}

#[test]
fn byte_cap_admission_is_checked_without_pruning_or_overflow() {
    let mut catalog = SnapshotCatalog {
        source_bytes: MAX_SNAPSHOT_BYTES - 3,
        ..Default::default()
    };
    assert!(within_budget(&catalog, 3));
    assert!(!within_budget(&catalog, 4));
    catalog.source_bytes = MAX_SNAPSHOT_BYTES;
    assert!(within_budget(&catalog, 0));
    assert!(!within_budget(&catalog, 1));
    catalog.source_bytes = u64::MAX;
    assert!(!within_budget(&catalog, 1));
}
#[test]
fn managed_and_unsaved_snapshots_use_anchored_private_stores() {
    let f = Fixture::new();
    let mut service = DocumentService::new(&f.0.join("app-data")).unwrap();
    let unsaved = service.register_unsaved().unwrap();
    let snapshot = service
        .create_snapshot(&named(&unsaved, 1, b"\xffunsaved\r\n"))
        .unwrap()
        .unwrap();
    assert_eq!(
        service
            .read_snapshot(&SnapshotReadRequest {
                identity: unsaved.identity.clone(),
                selection: snapshot.selection
            })
            .unwrap()
            .source,
        b"\xffunsaved\r\n"
    );
    let aux = f.0.join(".screenwriter");
    std::fs::create_dir(&aux).unwrap();
    std::fs::set_permissions(&aux, std::fs::Permissions::from_mode(0o700)).unwrap();
    let meta = aux.join("project.json");
    std::fs::write(&meta,serde_json::json!({"schemaVersion":1,"projectId":"11111111-1111-4111-8111-111111111111","sourceFilename":"source.fountain","pdfProfile":"us-letter-draft"}).to_string()).unwrap();
    std::fs::set_permissions(&meta, std::fs::Permissions::from_mode(0o600)).unwrap();
    let managed = service.open_selected(&f.0.join("source.fountain")).unwrap();
    assert_eq!(managed.kind, DocumentKind::Managed);
    let snapshot = service
        .create_snapshot(&named(&managed, 1, ORIGINAL))
        .unwrap()
        .unwrap();
    assert!(
        aux.join("snapshots")
            .join(&managed.identity.document_id)
            .join(blob_name(&hash(ORIGINAL)))
            .exists()
    );
    assert_eq!(
        service
            .read_snapshot(&SnapshotReadRequest {
                identity: managed.identity.clone(),
                selection: snapshot.selection
            })
            .unwrap()
            .source,
        ORIGINAL
    );
    std::fs::rename(aux.join("snapshots"), aux.join("moved-snapshots")).unwrap();
    std::os::unix::fs::symlink(aux.join("moved-snapshots"), aux.join("snapshots")).unwrap();
    assert_eq!(
        service
            .create_snapshot(&named(&managed, 2, NEW))
            .unwrap_err()
            .code,
        ErrorCode::UnsafePath
    );
    assert_eq!(
        std::fs::read(f.0.join("source.fountain")).unwrap(),
        ORIGINAL
    );
}
#[test]
fn restore_snapshot_failure_before_source_write_keeps_live_recovery_and_disk() {
    let f = Fixture::new();
    let (mut service, open) = f.open();
    let saved = service
        .create_snapshot(&named(&open, 1, NEW))
        .unwrap()
        .unwrap();
    // The selected snapshot is valid, but unresolved publication blocks making
    // the required pre-destructive snapshot. Recovery of the live bytes precedes it.
    std::fs::write(f.dir(&open).join("pending.json"), b"interrupted").unwrap();
    std::fs::set_permissions(
        f.dir(&open).join("pending.json"),
        std::fs::Permissions::from_mode(0o600),
    )
    .unwrap();
    let failure = service
        .restore_snapshot(&RestoreSnapshotRequest {
            replacement_metadata: None,
            current: checkpoint(&open, 21, b"live newest"),
            selection: saved.selection,
            new_version: 22,
            expected_fingerprint: open.fingerprint.unwrap(),
        })
        .unwrap_err();
    assert_eq!(failure.error.code, ErrorCode::SnapshotNeedsAttention);
    assert_eq!(failure.replacement, ReplacementState::SourceUnchanged);
    assert_eq!(failure.recovery.unwrap().version, 21);
    assert_eq!(
        std::fs::read(f.0.join("source.fountain")).unwrap(),
        ORIGINAL
    );
    assert_eq!(
        service
            .inspect_recovery(&open.identity)
            .unwrap()
            .latest
            .unwrap()
            .source,
        b"live newest"
    );
}
#[test]
fn snapshot_and_destination_permissions_anchors_and_cross_session_are_revalidated() {
    let f = Fixture::new();
    let (mut service, open) = f.open();
    service.create_snapshot(&named(&open, 1, ORIGINAL)).unwrap();
    let dir = f.dir(&open);
    std::fs::rename(&dir, dir.with_extension("moved")).unwrap();
    std::fs::create_dir(&dir).unwrap();
    std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o777)).unwrap();
    assert_eq!(
        service
            .create_snapshot(&named(&open, 2, NEW))
            .unwrap_err()
            .code,
        ErrorCode::OwnershipLost
    );
    let backup = f.0.join("backup");
    std::fs::create_dir(&backup).unwrap();
    std::fs::set_permissions(&backup, std::fs::Permissions::from_mode(0o777)).unwrap();
    assert_eq!(
        service
            .select_copy_destination(&open.identity, &backup)
            .unwrap_err()
            .code,
        ErrorCode::InvalidDestination
    );
    std::fs::set_permissions(&backup, std::fs::Permissions::from_mode(0o700)).unwrap();
    let d = service
        .select_copy_destination(&open.identity, &backup)
        .unwrap();
    std::fs::set_permissions(&backup, std::fs::Permissions::from_mode(0o500)).unwrap();
    assert_eq!(
        service
            .save_external_copy(&ExternalCopyRequest {
                checkpoint: checkpoint(&open, 2, NEW),
                destination_token: d.token,
                format: CopyFormat::Fountain,
            })
            .unwrap_err()
            .code,
        ErrorCode::InvalidDestination
    );
    let mut foreign = named(&open, 2, NEW);
    foreign.checkpoint.identity.session_id = uuid();
    assert_eq!(
        service.create_snapshot(&foreign).unwrap_err().code,
        ErrorCode::IdentityMismatch
    );
}

#[test]
fn pruning_refuses_external_queued_and_unconfirmed_source_operations() {
    let f = Fixture::new();
    let (service, open) = f.open();
    let old = create_at(&service, &open, ORIGINAL, SnapshotKind::Rolling, 1);
    create_at(&service, &open, NEW, SnapshotKind::Rolling, 40 * 86400);
    std::fs::write(f.0.join("source.fountain"), b"external writer").unwrap();
    assert_eq!(
        service
            .prune_with(&open.identity, 40 * 86400, |_| Ok(()))
            .unwrap_err()
            .code,
        ErrorCode::SourceChanged
    );
    assert_eq!(
        service
            .read_snapshot(&SnapshotReadRequest {
                identity: open.identity.clone(),
                selection: old.selection
            })
            .unwrap()
            .source,
        ORIGINAL
    );
    drop(service);
    let (mut service, open) = f.open();
    service
        .enqueue_save(SaveRequest {
            identity: open.identity.clone(),
            version: 21,
            source: NEW.to_vec(),
            source_sha256: hash(NEW),
            expected_fingerprint: open.fingerprint.clone().unwrap(),
            draft_metadata: serde_json::json!({}),
        })
        .unwrap();
    assert_eq!(
        service
            .prune_with(&open.identity, 40 * 86400, |_| Ok(()))
            .unwrap_err()
            .code,
        ErrorCode::SaveNeedsAttention
    );
    let failure = service
        .save_next_with(&open.identity, |s| {
            if s == source_store::Stage::Replaced {
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
        service
            .prune_with(&open.identity, 40 * 86400, |_| Ok(()))
            .unwrap_err()
            .code,
        ErrorCode::SaveNeedsAttention
    );
    assert_eq!(
        service
            .inspect_source_save(&open.identity)
            .unwrap()
            .previous
            .unwrap(),
        b"external writer"
    );
    assert_eq!(
        service
            .list_snapshots(&open.identity)
            .unwrap()
            .entries
            .len(),
        2
    );
}
