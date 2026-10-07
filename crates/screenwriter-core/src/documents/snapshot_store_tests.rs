//! Real disposable native files. Injected errors and SIGKILL are labeled separately.
use super::*;
use crate::documents::persistence::CheckpointRequest;
use crate::test_support::TestRoot;
use std::io::{BufRead, BufReader};
use std::os::unix::fs::{MetadataExt, PermissionsExt};
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
fn m6_03_rolling_cap_retention_makes_room_without_touching_protected_or_newest() {
    // The frontend cadence prunes once and retries when a rolling snapshot
    // reaches the cap (ADR 0018, M6-03). Native retention must free room.
    let f = Fixture::new();
    let (service, open) = f.open();
    let clock = 40 * 86400;
    let protected = create_at(&service, &open, b"named", SnapshotKind::Named, 1);
    let first = create_at(&service, &open, b"rolling", SnapshotKind::Rolling, 2);
    // Independent record seeding: a day of five-minute rolling records that
    // are now older than the 30-day window.
    let mut newest = first.clone();
    for n in 2..MAX_SNAPSHOT_RECORDS {
        let mut record = first.record.clone();
        record.snapshot_id = uuid();
        record.created_seconds = 2 + n as u64 * 300;
        let e = Envelope {
            record_sha256: record_hash(&record).unwrap(),
            record,
        };
        let path = f.dir(&open).join(record_name(&e.record.snapshot_id));
        std::fs::write(&path, serde_json::to_vec(&e).unwrap()).unwrap();
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600)).unwrap();
        newest = entry(e.record).unwrap();
    }
    assert!(service.list_snapshots(&open.identity).unwrap().at_limit);
    let next = |service: &DocumentService| {
        service.snapshot_with(
            &open.identity,
            Some(2),
            b"next rolling",
            SnapshotKind::Rolling,
            None,
            clock,
            |_| Ok(()),
        )
    };
    assert_eq!(next(&service).unwrap_err().code, ErrorCode::SnapshotLimit);
    let pruned = service
        .prune_with(&open.identity, clock, |_| Ok(()))
        .unwrap();
    assert!(!pruned.at_limit);
    let ids: BTreeSet<_> = pruned
        .entries
        .iter()
        .map(|e| e.record.snapshot_id.clone())
        .collect();
    assert_eq!(
        ids,
        BTreeSet::from([
            protected.record.snapshot_id.clone(),
            newest.record.snapshot_id.clone()
        ])
    );
    let added = next(&service).unwrap().unwrap();
    let after = service.list_snapshots(&open.identity).unwrap();
    assert_eq!(after.entries.len(), 3);
    assert!(after.entries.contains(&added));
    assert!(
        after
            .entries
            .iter()
            .any(|e| e.selection == protected.selection)
    );
    assert!(!after.needs_attention);
}
#[test]
fn external_copy_names_sort_by_utc_time_with_a_short_unique_suffix() {
    let id = "ad7fdedc-e01a-4893-9470-a2d5c13e8467";
    assert_eq!(copy_stem(0, id), "babel-copy-1970-01-01-000000Z-ad7fdedc");
    // 2026-10-06 17:26:05 UTC; leap day and century boundaries.
    assert_eq!(
        copy_stem(1_791_307_565, id),
        "babel-copy-2026-10-06-172605Z-ad7fdedc"
    );
    assert_eq!(
        copy_stem(951_782_400, id),
        "babel-copy-2000-02-29-000000Z-ad7fdedc"
    );
    assert_eq!(
        copy_stem(4_107_542_399, id),
        "babel-copy-2100-02-28-235959Z-ad7fdedc"
    );
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

// External drill roots are deliberately not TestRoot-owned: the driver retains
// the real files and reports after both SIGKILL and a successful child exit.
const RETENTION_CLOCK: u64 = 40 * 86400;
const RETENTION_PREVIOUS: &[u8] = b"\xef\xbb\xbfEXT. PREVIOUS - DAWN\r\n\r\nPrevious  source.\r\n";
const RETENTION_SHARED: &[u8] =
    b"\xef\xbb\xbfINT. SHARED - DAY\r\n\r\nNamed and expired share this.\r\n";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RetentionFileOracle {
    device: u64,
    inode: u64,
    mode: u32,
    byte_length: u64,
    sha256: String,
    bytes: Vec<u8>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RetentionVersionOracle {
    role: String,
    entry: SnapshotEntry,
    bytes: Vec<u8>,
    retained: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RetentionDrillFixture {
    schema: String,
    mode: String,
    clock_seconds: u64,
    document_id: String,
    source: Vec<u8>,
    recovery: Vec<u8>,
    previous_source: Vec<u8>,
    versions: Vec<RetentionVersionOracle>,
    catalog: SnapshotCatalog,
    snapshot_files: BTreeMap<String, RetentionFileOracle>,
    protected_files: BTreeMap<String, RetentionFileOracle>,
    save_receipt: crate::documents::saving::SaveReceipt,
}

fn retention_file_oracle(path: &Path) -> RetentionFileOracle {
    let metadata = std::fs::symlink_metadata(path).unwrap();
    assert!(metadata.is_file() && !metadata.file_type().is_symlink());
    let bytes = std::fs::read(path).unwrap();
    RetentionFileOracle {
        device: metadata.dev(),
        inode: metadata.ino(),
        mode: metadata.mode(),
        byte_length: metadata.len(),
        sha256: hash(&bytes),
        bytes,
    }
}

fn retention_inventory(root: &Path) -> BTreeMap<String, RetentionFileOracle> {
    fn visit(base: &Path, path: &Path, files: &mut BTreeMap<String, RetentionFileOracle>) {
        let metadata = std::fs::symlink_metadata(path).unwrap();
        assert!(!metadata.file_type().is_symlink());
        if metadata.is_dir() {
            for entry in std::fs::read_dir(path).unwrap() {
                visit(base, &entry.unwrap().path(), files);
            }
        } else {
            files.insert(
                path.strip_prefix(base)
                    .unwrap()
                    .to_str()
                    .unwrap()
                    .to_owned(),
                retention_file_oracle(path),
            );
        }
    }
    let mut files = BTreeMap::new();
    visit(root, root, &mut files);
    files
}

fn retention_protected_files(root: &Path) -> BTreeMap<String, RetentionFileOracle> {
    let mut files = BTreeMap::new();
    for relative in [
        "source.fountain",
        "app-data/recovery",
        "app-data/source-save",
    ] {
        let path = root.join(relative);
        if path.is_file() {
            files.insert(relative.to_owned(), retention_file_oracle(&path));
        } else {
            for (name, oracle) in retention_inventory(&path) {
                files.insert(format!("{relative}/{name}"), oracle);
            }
        }
    }
    files
}

fn retention_report(root: &Path, name: &str, report: &impl Serialize) {
    let bytes = serde_json::to_vec_pretty(report).unwrap();
    let mut file = std::fs::File::create(root.join(name)).unwrap();
    file.write_all(&bytes).unwrap();
    file.sync_all().unwrap();
    std::fs::File::open(root).unwrap().sync_all().unwrap();
}

fn retention_open(root: &Path) -> (DocumentService, OpenDocument) {
    let mut service = DocumentService::new(&root.join("app-data")).unwrap();
    let open = service
        .open_selected(&root.join("source.fountain"))
        .unwrap();
    (service, open)
}

fn retention_snapshot_dir(root: &Path, document_id: &str) -> PathBuf {
    root.join("app-data/snapshots").join(document_id)
}

fn retention_fixture(root: &Path, mode: &str) -> RetentionDrillFixture {
    assert!(root.is_absolute() && root.is_dir());
    assert!(!root.join("retention-fixture.json").exists());
    std::fs::write(root.join("source.fountain"), RETENTION_PREVIOUS).unwrap();
    std::fs::set_permissions(
        root.join("source.fountain"),
        std::fs::Permissions::from_mode(0o600),
    )
    .unwrap();
    let (mut service, open) = retention_open(root);
    // A real ordinary Save establishes three independent oracles: exact BOM/
    // CRLF disk bytes, current recovery bytes, and a distinct previous source.
    let receipt = service
        .save_request(SaveRequest {
            identity: open.identity.clone(),
            version: 21,
            source: ORIGINAL.to_vec(),
            source_sha256: hash(ORIGINAL),
            expected_fingerprint: open.fingerprint.clone().unwrap(),
            draft_metadata: serde_json::json!({"retentionDrill": "source oracle"}),
        })
        .unwrap();
    assert_eq!(receipt.version, 21);
    assert_eq!(receipt.source_sha256, hash(ORIGINAL));
    let mut versions = Vec::new();
    for (role, bytes, kind, seconds, retained) in [
        (
            "expiredUnique",
            &b"expired unique blob\r\n"[..],
            SnapshotKind::Rolling,
            1,
            false,
        ),
        (
            "namedShared",
            RETENTION_SHARED,
            SnapshotKind::Named,
            2,
            true,
        ),
        (
            "named",
            &b"independent named bytes\r\n"[..],
            SnapshotKind::Named,
            3,
            true,
        ),
        (
            "preDestructive",
            &b"pre-destructive safety bytes\r\n"[..],
            SnapshotKind::PreDestructive,
            4,
            true,
        ),
        (
            "expiredShared",
            RETENTION_SHARED,
            SnapshotKind::Rolling,
            601,
            false,
        ),
        (
            "futureClock",
            &b"future clock bytes\r\n"[..],
            SnapshotKind::Rolling,
            RETENTION_CLOCK + 600,
            true,
        ),
        (
            "newest",
            &b"newest exact bytes without final newline"[..],
            SnapshotKind::Rolling,
            RETENTION_CLOCK + 1200,
            true,
        ),
    ] {
        versions.push(RetentionVersionOracle {
            role: role.to_owned(),
            entry: create_at(&service, &open, bytes, kind, seconds),
            bytes: bytes.to_vec(),
            retained,
        });
    }
    let fixture = RetentionDrillFixture {
        schema: "babel-retention-drill-v1".into(),
        mode: mode.to_owned(),
        clock_seconds: RETENTION_CLOCK,
        document_id: open.identity.document_id.clone(),
        source: ORIGINAL.to_vec(),
        recovery: ORIGINAL.to_vec(),
        previous_source: RETENTION_PREVIOUS.to_vec(),
        versions,
        catalog: service.list_snapshots(&open.identity).unwrap(),
        snapshot_files: retention_inventory(&retention_snapshot_dir(
            root,
            &open.identity.document_id,
        )),
        protected_files: retention_protected_files(root),
        save_receipt: receipt,
    };
    assert!(!fixture.catalog.needs_attention);
    retention_assert_oracles(root, &service, &open, &fixture);
    retention_report(root, "retention-fixture.json", &fixture);
    fixture
}

fn retention_assert_oracles(
    root: &Path,
    service: &DocumentService,
    open: &OpenDocument,
    fixture: &RetentionDrillFixture,
) {
    assert_eq!(open.identity.document_id, fixture.document_id);
    assert_eq!(
        std::fs::read(root.join("source.fountain")).unwrap(),
        fixture.source
    );
    let recovery = service
        .inspect_recovery(&open.identity)
        .unwrap()
        .latest
        .unwrap();
    assert_eq!(recovery.source, fixture.recovery);
    assert_eq!(recovery.metadata.version, 21);
    let transaction = service.inspect_source_save(&open.identity).unwrap();
    assert_eq!(
        transaction.previous.as_deref(),
        Some(fixture.previous_source.as_slice())
    );
    assert!(transaction.intent.is_none() && transaction.previous_pending.is_none());
    assert_eq!(
        transaction.observation,
        SaveObservation::ConfirmedRecordMatchesSource
    );
    assert_eq!(retention_protected_files(root), fixture.protected_files);
    for version in fixture.versions.iter().filter(|v| v.retained) {
        let preview = service
            .read_snapshot(&SnapshotReadRequest {
                identity: open.identity.clone(),
                selection: version.entry.selection.clone(),
            })
            .unwrap();
        assert_eq!(preview.entry, version.entry);
        assert_eq!(preview.source, version.bytes);
    }
    for entry in service.list_snapshots(&open.identity).unwrap().entries {
        let oracle = fixture.versions.iter().find(|v| v.entry == entry).unwrap();
        let preview = service
            .read_snapshot(&SnapshotReadRequest {
                identity: open.identity.clone(),
                selection: entry.selection,
            })
            .unwrap();
        assert_eq!(
            preview.source, oracle.bytes,
            "no retained dangling reference"
        );
    }
}

fn retention_reopen(root: &Path) {
    let fixture: RetentionDrillFixture =
        serde_json::from_slice(&std::fs::read(root.join("retention-fixture.json")).unwrap())
            .unwrap();
    assert!(["RecordRemoved", "PruneSynced", "BlobRemoved"].contains(&fixture.mode.as_str()));
    let dir = retention_snapshot_dir(root, &fixture.document_id);
    let before_open = retention_inventory(&dir);
    let unique = fixture
        .versions
        .iter()
        .find(|v| v.role == "expiredUnique")
        .unwrap();
    let mut expected = fixture.snapshot_files.clone();
    expected
        .remove(&record_name(&unique.entry.record.snapshot_id))
        .unwrap();
    let orphan_expected = fixture.mode != "BlobRemoved";
    if !orphan_expected {
        expected
            .remove(&blob_name(&unique.entry.record.source_sha256))
            .unwrap();
    }
    assert_eq!(before_open, expected);
    let (service, open) = retention_open(root);
    retention_assert_oracles(root, &service, &open, &fixture);
    assert_eq!(
        retention_inventory(&dir),
        before_open,
        "reopen must not repair orphans"
    );
    let catalog = service.list_snapshots(&open.identity).unwrap();
    assert_eq!(catalog.needs_attention, orphan_expected);
    assert_eq!(catalog.orphan_blobs, usize::from(orphan_expected));
    assert_eq!(catalog.unresolved_artifacts, 0);
    let refusal = if orphan_expected {
        let refusal = service
            .prune_with(&open.identity, fixture.clock_seconds, |_| Ok(()))
            .unwrap_err();
        assert_eq!(refusal.code, ErrorCode::SnapshotNeedsAttention);
        assert_eq!(
            retention_inventory(&dir),
            before_open,
            "refusal preserves every byte and file identity"
        );
        Some(refusal)
    } else {
        let pruned = service
            .prune_with(&open.identity, fixture.clock_seconds, |_| Ok(()))
            .unwrap();
        assert!(!pruned.needs_attention);
        assert_eq!(pruned.orphan_blobs, 0);
        let retained: Vec<_> = fixture
            .versions
            .iter()
            .filter(|v| v.retained)
            .map(|v| v.entry.clone())
            .collect();
        assert_eq!(pruned.entries, retained);
        let shared = fixture
            .versions
            .iter()
            .find(|v| v.role == "expiredShared")
            .unwrap();
        expected
            .remove(&record_name(&shared.entry.record.snapshot_id))
            .unwrap();
        assert_eq!(
            retention_inventory(&dir),
            expected,
            "shared named blob survives further maintenance"
        );
        None
    };
    retention_assert_oracles(root, &service, &open, &fixture);
    retention_report(
        root,
        "retention-reopen.json",
        &serde_json::json!({
            "schema": "babel-retention-reopen-v1",
            "mode": fixture.mode,
            "verified": true,
            "exactRetainedSelections": fixture.versions.iter().filter(|v| v.retained).collect::<Vec<_>>(),
            "catalogBeforeMaintenance": catalog,
            "catalogAfterMaintenance": service.list_snapshots(&open.identity).unwrap(),
            "typedRefusal": refusal,
            "snapshotFilesBeforeReopen": before_open,
            "snapshotFilesAfterMaintenance": retention_inventory(&dir),
            "protectedFiles": retention_protected_files(root),
            "orphanAutoRepaired": false,
        }),
    );
}

fn retention_low_space(root: &Path, fixture: &RetentionDrillFixture) {
    let (mut service, open) = retention_open(root);
    let dir = retention_snapshot_dir(root, &fixture.document_id);
    let native_dir = std::fs::File::open(&dir).unwrap();
    let space = fs::fstatvfs(&native_dir).unwrap();
    let available = space.f_bavail.saturating_mul(space.f_frsize);
    assert!(
        available < 64 * 1024 * 1024,
        "requires a real private low-space filesystem"
    );
    // Do not synthesize ENOSPC or fill a shared /tmp filesystem.
    retention_assert_oracles(root, &service, &open, fixture);
    let before = retention_inventory(&dir);
    let refusal = service
        .prune_with(&open.identity, fixture.clock_seconds, |_| Ok(()))
        .unwrap_err();
    assert_eq!(refusal.code, ErrorCode::SnapshotNeedsAttention);
    assert_eq!(retention_inventory(&dir), before);
    retention_assert_oracles(root, &service, &open, fixture);
    let saved_bytes =
        b"\xef\xbb\xbfINT. LOW SPACE SAVE - DAY\r\n\r\nOrdinary Save remains exact.\r\n";
    let receipt = service
        .save_request(SaveRequest {
            identity: open.identity.clone(),
            version: 22,
            source: saved_bytes.to_vec(),
            source_sha256: hash(saved_bytes),
            expected_fingerprint: open.fingerprint.clone().unwrap(),
            draft_metadata: serde_json::json!({"retentionDrill": "ordinary Save after refusal"}),
        })
        .unwrap();
    assert_eq!(receipt.version, 22);
    assert_eq!(receipt.source_sha256, hash(saved_bytes));
    assert_eq!(receipt.recovery.version, 22);
    assert_eq!(receipt.identity, open.identity);
    assert_eq!(receipt.recovery.identity, open.identity);
    assert_eq!(receipt.recovery.source_sha256, hash(saved_bytes));
    assert_eq!(receipt.protection, SaveProtection::SourceFile);
    let source_metadata = std::fs::metadata(root.join("source.fountain")).unwrap();
    assert_eq!(
        receipt.fingerprint.device,
        source_metadata.dev().to_string()
    );
    assert_eq!(receipt.fingerprint.inode, source_metadata.ino().to_string());
    assert_eq!(receipt.fingerprint.byte_length, saved_bytes.len() as u64);
    assert_eq!(receipt.fingerprint.sha256, hash(saved_bytes));
    assert_eq!(
        std::fs::read(root.join("source.fountain")).unwrap(),
        saved_bytes
    );
    assert_eq!(
        service
            .inspect_recovery(&open.identity)
            .unwrap()
            .latest
            .unwrap()
            .source,
        saved_bytes
    );
    assert_eq!(
        service
            .inspect_source_save(&open.identity)
            .unwrap()
            .previous
            .as_deref(),
        Some(fixture.source.as_slice())
    );
    assert_eq!(
        service
            .inspect_source_save(&open.identity)
            .unwrap()
            .observation,
        SaveObservation::ConfirmedRecordMatchesSource,
    );
    assert_eq!(
        retention_inventory(&dir),
        before,
        "ordinary Save never prunes snapshots"
    );
    retention_report(
        root,
        "retention-low-space.json",
        &serde_json::json!({
            "schema": "babel-retention-low-space-v1",
            "verified": true,
            "availableBytes": available,
            "guardBytes": 64 * 1024 * 1024,
            "filesystem": {"availableBlocks": space.f_bavail, "fragmentSize": space.f_frsize, "device": native_dir.metadata().unwrap().dev()},
            "typedRefusal": refusal,
            "snapshotFilesBefore": before,
            "snapshotFilesAfterSave": retention_inventory(&dir),
            "catalog": service.list_snapshots(&open.identity).unwrap(),
            "saveReceipt": receipt,
            "saveSourceBytes": saved_bytes.as_slice(),
            "protectedFilesAfterSave": retention_protected_files(root),
        }),
    );
}

#[test]
fn retention_drill_child() {
    let Some(root) = std::env::var_os("BABEL_RETENTION_DRILL_ROOT") else {
        return;
    };
    let root = PathBuf::from(root);
    assert!(root.is_absolute() && root.is_dir());
    let mode = std::env::var("BABEL_RETENTION_DRILL_MODE").unwrap();
    if mode == "reopen" {
        retention_reopen(&root);
        return;
    }
    assert!(["RecordRemoved", "PruneSynced", "BlobRemoved", "low-space"].contains(&mode.as_str()));
    let fixture = retention_fixture(&root, &mode);
    if mode == "low-space" {
        retention_low_space(&root, &fixture);
        return;
    }
    let (service, open) = retention_open(&root);
    service
        .prune_with(&open.identity, fixture.clock_seconds, |stage| {
            if format!("{stage:?}") == mode {
                println!("BABEL_RETENTION_BARRIER:{mode}");
                std::io::stdout().flush().unwrap();
                let mut byte = [0];
                std::io::stdin().read_exact(&mut byte).unwrap();
                panic!("interruption driver must kill its owned child at the barrier");
            }
            Ok(())
        })
        .unwrap();
    panic!("requested retention barrier was not reached");
}

#[test]
fn shared_blob_retention_removes_only_expired_record() {
    let f = Fixture::new();
    let (service, open) = f.open();
    let expired = create_at(&service, &open, RETENTION_SHARED, SnapshotKind::Rolling, 1);
    let named = create_at(&service, &open, RETENTION_SHARED, SnapshotKind::Named, 2);
    let newest = create_at(&service, &open, NEW, SnapshotKind::Rolling, RETENTION_CLOCK);
    let before = retention_inventory(&f.dir(&open));
    let catalog = service
        .prune_with(&open.identity, RETENTION_CLOCK, |_| Ok(()))
        .unwrap();
    assert_eq!(catalog.entries, vec![named.clone(), newest]);
    assert!(!catalog.needs_attention);
    assert_eq!(catalog.orphan_blobs, 0);
    let mut expected = before;
    expected
        .remove(&record_name(&expired.record.snapshot_id))
        .unwrap();
    assert_eq!(retention_inventory(&f.dir(&open)), expected);
    assert_eq!(
        service
            .read_snapshot(&SnapshotReadRequest {
                identity: open.identity.clone(),
                selection: named.selection,
            })
            .unwrap()
            .source,
        RETENTION_SHARED
    );
}

#[test]
fn native_sigkill_retention_reopen_preserves_oracles_and_refuses_orphans() {
    for mode in ["RecordRemoved", "PruneSynced", "BlobRemoved"] {
        let f = Fixture::new();
        let mut child = Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "documents::linux::snapshot_store::tests::retention_drill_child",
                "--nocapture",
            ])
            .env("BABEL_RETENTION_DRILL_ROOT", &f.0)
            .env("BABEL_RETENTION_DRILL_MODE", mode)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .unwrap();
        let mut output = BufReader::new(child.stdout.take().unwrap());
        let mut line = String::new();
        loop {
            line.clear();
            assert_ne!(
                output.read_line(&mut line).unwrap(),
                0,
                "child exited before {mode}"
            );
            if line.contains(&format!("BABEL_RETENTION_BARRIER:{mode}")) {
                break;
            }
        }
        child.kill().unwrap();
        let status = child.wait().unwrap();
        use std::os::unix::process::ExitStatusExt;
        assert_eq!(status.signal(), Some(9));
        retention_reopen(&f.0);
    }
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
