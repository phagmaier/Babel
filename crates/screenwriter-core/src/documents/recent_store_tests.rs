//! Real native filesystem tests; repeat via BABEL_RECENT_TEST_ROOT on tmpfs/Btrfs.
use super::*;
use crate::documents::{persistence::CheckpointRequest, save_as::SaveAsRequest};
use serde_json::json;
use std::{
    fs as disk,
    io::BufRead,
    os::unix::fs::{PermissionsExt, symlink},
    process::{Command, Stdio},
};

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let root = std::env::var_os("BABEL_RECENT_TEST_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir)
            .join(format!("babel-recents-{}", uuid()));
        disk::create_dir(&root).unwrap();
        disk::set_permissions(&root, disk::Permissions::from_mode(0o700)).unwrap();
        let f = Self(root);
        f.file(
            "first.fountain",
            b"\xef\xbb\xbfINT. ROOM - DAY\r\n  unknown  \r\n",
        );
        f
    }
    fn file(&self, name: &str, bytes: &[u8]) -> PathBuf {
        let path = self.0.join(name);
        disk::write(&path, bytes).unwrap();
        disk::set_permissions(&path, disk::Permissions::from_mode(0o600)).unwrap();
        path
    }
    fn service(&self) -> DocumentService {
        DocumentService::new(&self.0.join("app-data")).unwrap()
    }
    fn open(&self, s: &mut DocumentService) -> OpenDocument {
        s.open_selected(&self.0.join("first.fountain")).unwrap()
    }
    fn request(&self, s: &DocumentService) -> RecentRequest {
        RecentRequest {
            entry_id: s.list_recent_projects().unwrap().entries[0]
                .entry_id
                .clone(),
        }
    }
    fn checkpoint(&self, o: &OpenDocument) -> CheckpointRequest {
        CheckpointRequest {
            identity: o.identity.clone(),
            version: 1,
            source: b"raw draft\xff\r\n".to_vec(),
            source_sha256: hash(b"raw draft\xff\r\n"),
            expected_fingerprint: o.fingerprint.clone(),
            draft_metadata: json!(null),
        }
    }
    fn managed(&self) -> (PathBuf, String) {
        let dir = self.0.join("project");
        disk::create_dir(&dir).unwrap();
        disk::create_dir(dir.join(".screenwriter")).unwrap();
        disk::set_permissions(
            dir.join(".screenwriter"),
            disk::Permissions::from_mode(0o700),
        )
        .unwrap();
        let id = uuid();
        disk::write(dir.join("screen.fountain"), b"INT. ROOM - DAY\n").unwrap();
        disk::set_permissions(
            dir.join("screen.fountain"),
            disk::Permissions::from_mode(0o600),
        )
        .unwrap();
        disk::write(dir.join(".screenwriter/project.json"), serde_json::to_vec(&json!({"schemaVersion":1,"projectId":id,"sourceFilename":"screen.fountain","pdfProfile":"default","unknown":{"retain":[1,2,3]}})).unwrap()).unwrap();
        disk::set_permissions(
            dir.join(".screenwriter/project.json"),
            disk::Permissions::from_mode(0o600),
        )
        .unwrap();
        (dir, id)
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        disk::remove_dir_all(&self.0).unwrap();
    }
}

#[test]
fn native_open_deduplicates_normalized_path_and_drafts_stay_out() {
    let f = Fixture::new();
    let mut s = f.service();
    assert!(s.list_recent_projects().unwrap().entries.is_empty());
    let draft = s.register_unsaved().unwrap();
    s.checkpoint_request(f.checkpoint(&draft)).unwrap();
    assert!(s.list_recent_projects().unwrap().entries.is_empty());
    let first = f.open(&mut s);
    let request = f.request(&s);
    let list = s.list_recent_projects().unwrap();
    assert_eq!(list.health, RecentHealth::Ready);
    assert_eq!(list.entries[0].availability, RecentAvailability::Available);
    assert_eq!(list.entries[0].file_name, "first.fountain");
    s.release(&first.identity).unwrap();
    let again = s.open_selected(&f.0.join("./first.fountain")).unwrap();
    assert_eq!(again.identity.document_id, first.identity.document_id);
    assert_eq!(s.list_recent_projects().unwrap().entries.len(), 1);
    assert_eq!(f.request(&s).entry_id, request.entry_id);
    let serialized = serde_json::to_string(&s.list_recent_projects().unwrap()).unwrap();
    assert!(!serialized.contains(f.0.to_str().unwrap()));
    assert!(!serialized.contains("source") && !serialized.contains("pageCount"));
}

#[test]
fn remove_only_metadata_restart_and_stat_only_listing_are_truthful() {
    let f = Fixture::new();
    let mut s = f.service();
    let o = f.open(&mut s);
    let request = f.request(&s);
    s.checkpoint_request(f.checkpoint(&o)).unwrap();
    s.release(&o.identity).unwrap();
    drop(s);
    let mut s = f.service();
    // Far above source limit and invalid UTF8: listing must not parse/read it.
    disk::write(f.0.join("first.fountain"), vec![255; MAX_SOURCE_BYTES + 1]).unwrap();
    assert_eq!(
        s.list_recent_projects().unwrap().entries[0].availability,
        RecentAvailability::Available
    );
    assert_eq!(
        s.open_recent_project(&request).unwrap_err().code,
        ErrorCode::SourceTooLarge
    );
    disk::remove_file(f.0.join("first.fountain")).unwrap();
    assert_eq!(
        s.list_recent_projects().unwrap().entries[0].availability,
        RecentAvailability::Missing
    );
    assert_eq!(
        s.open_recent_project(&request).unwrap_err().code,
        ErrorCode::MissingSource
    );
    symlink(f.0.join("missing-target"), f.0.join("first.fountain")).unwrap();
    assert_eq!(
        s.list_recent_projects().unwrap().entries[0].availability,
        RecentAvailability::Unknown
    );
    assert_eq!(
        s.list_recent_projects().unwrap().health,
        RecentHealth::Ready
    );
    s.remove_recent_project(&request).unwrap();
    assert!(
        disk::symlink_metadata(f.0.join("first.fountain"))
            .unwrap()
            .file_type()
            .is_symlink()
    );
    assert_eq!(
        s.inspect_local_recovery(&o.identity.document_id)
            .unwrap()
            .current
            .unwrap()
            .checkpoints
            .last()
            .unwrap()
            .source,
        b"raw draft\xff\r\n"
    );
    assert!(
        f.service()
            .list_recent_projects()
            .unwrap()
            .entries
            .is_empty()
    );
}

#[test]
fn readonly_open_and_duplicate_managed_id_keep_conservative_ownership() {
    let f = Fixture::new();
    let mut s = f.service();
    disk::set_permissions(
        f.0.join("first.fountain"),
        disk::Permissions::from_mode(0o400),
    )
    .unwrap();
    let readonly = f.open(&mut s);
    assert!(matches!(readonly.ownership, Ownership::ViewOnly { .. }));
    assert_eq!(s.list_recent_projects().unwrap().entries.len(), 1);
    let (project, id) = f.managed();
    let a = s.open_selected(&project.join("screen.fountain")).unwrap();
    assert_eq!(a.identity.document_id, id);
    let copy = f.0.join("copy");
    disk::create_dir(&copy).unwrap();
    disk::create_dir(copy.join(".screenwriter")).unwrap();
    disk::set_permissions(
        copy.join(".screenwriter"),
        disk::Permissions::from_mode(0o700),
    )
    .unwrap();
    disk::copy(
        project.join("screen.fountain"),
        copy.join("screen.fountain"),
    )
    .unwrap();
    disk::copy(
        project.join(".screenwriter/project.json"),
        copy.join(".screenwriter/project.json"),
    )
    .unwrap();
    let b = s.open_selected(&copy.join("screen.fountain")).unwrap();
    assert!(
        matches!(b.ownership, Ownership::ViewOnly { reasons } if reasons.contains(&ViewReason::AlreadyOwned))
    );
    assert_eq!(s.list_recent_projects().unwrap().entries.len(), 3); // duplicate project ID paths observable, never silently collapsed
}

#[test]
fn registry_failures_preserve_previous_and_do_not_block_source_or_recovery() {
    for failure in ["corrupt", "oversized", "symlink", "permissions", "pending"] {
        let f = Fixture::new();
        let mut s = f.service();
        let o = f.open(&mut s);
        s.note_recent(&o.identity, None); // two independent valid generations
        let r = s.read_recents().unwrap();
        let latest =
            f.0.join("app-data")
                .join(SLOTS[(r.generation % 2) as usize]);
        let previous =
            f.0.join("app-data")
                .join(SLOTS[((r.generation - 1) % 2) as usize]);
        let previous_bytes = disk::read(&previous).unwrap();
        match failure {
            "corrupt" => disk::write(&latest, b"{truncated").unwrap(),
            "oversized" => disk::write(&latest, vec![0; MAX_RECENT_BYTES + 1]).unwrap(),
            "symlink" => {
                disk::remove_file(&latest).unwrap();
                symlink(&previous, &latest).unwrap();
            }
            "permissions" => {
                disk::set_permissions(&latest, disk::Permissions::from_mode(0o644)).unwrap()
            }
            "pending" => {
                f.file("app-data/recents.pending", b"partial");
            }
            _ => unreachable!(),
        }
        assert_eq!(
            s.list_recent_projects().unwrap().health,
            RecentHealth::NeedsAttention,
            "{failure}"
        );
        let request = f.request(&s);
        assert_eq!(
            s.remove_recent_project(&request).unwrap_err().code,
            ErrorCode::RecentNeedsAttention
        );
        s.checkpoint_request(f.checkpoint(&o)).unwrap();
        let other = f.file("other.fountain", b"INT. OTHER - NIGHT\n");
        assert!(s.open_selected(&other).is_ok());
        assert_eq!(disk::read(&previous).unwrap(), previous_bytes);
        assert_eq!(disk::read(f.0.join("first.fountain")).unwrap(), o.source);
    }
}

#[test]
fn auxiliary_lease_contention_does_not_block_ordinary_open_and_preserves_removal() {
    let f = Fixture::new();
    let mut a = f.service();
    let o = f.open(&mut a);
    let request = f.request(&a);
    let lease = a.lease("recent-projects").unwrap();
    let mut b = f.service();
    assert!(b.list_recent_projects().is_err());
    let second = f.file("other.fountain", b"INT. OTHER - DAY\n");
    let opened = b.open_selected(&second).unwrap();
    assert_eq!(opened.ownership, Ownership::Exclusive);
    b.checkpoint_request(f.checkpoint(&opened)).unwrap();
    drop(lease);
    assert_eq!(
        b.list_recent_projects().unwrap().health,
        RecentHealth::NeedsAttention
    );
    b.remove_recent_project(&request).unwrap();
    assert!(a.list_recent_projects().unwrap().entries.is_empty());
    assert_eq!(disk::read(f.0.join("first.fountain")).unwrap(), o.source);
}

#[test]
fn moved_loose_selection_is_explicit_stale_safe_and_keeps_identity_and_recovery() {
    let f = Fixture::new();
    let mut s = f.service();
    let o = f.open(&mut s);
    let request = f.request(&s);
    s.checkpoint_request(f.checkpoint(&o)).unwrap();
    s.release(&o.identity).unwrap();
    let moved = f.0.join("moved.fountain");
    disk::rename(f.0.join("first.fountain"), &moved).unwrap();
    let selection = s.select_recent_location(&request, &moved).unwrap();
    assert!(selection.can_link_moved && selection.content_matches_last_known);
    assert_eq!(
        s.list_recent_projects().unwrap().entries[0].file_name,
        "first.fountain"
    );
    let linked = s
        .confirm_recent_location(&ConfirmLocateRequest {
            entry_id: request.entry_id.clone(),
            selection_token: selection.selection_token.clone(),
            choice: LocateChoice::LinkMoved,
        })
        .unwrap();
    assert_eq!(linked.document.identity.document_id, o.identity.document_id);
    assert_eq!(linked.document.ownership, Ownership::Exclusive);
    assert_eq!(f.request(&s).entry_id, request.entry_id);
    assert_eq!(
        s.list_recent_projects().unwrap().entries[0].file_name,
        "moved.fountain"
    );
    assert_eq!(
        s.inspect_recovery(&linked.document.identity)
            .unwrap()
            .current
            .unwrap()
            .checkpoints
            .last()
            .unwrap()
            .source,
        b"raw draft\xff\r\n"
    );
    assert_eq!(
        s.confirm_recent_location(&ConfirmLocateRequest {
            entry_id: request.entry_id,
            selection_token: selection.selection_token,
            choice: LocateChoice::LinkMoved
        })
        .unwrap_err()
        .code,
        ErrorCode::InvalidRecentSelection
    );
}

#[test]
fn mismatches_changes_live_owners_and_existing_mapping_refuse_link_but_allow_explicit_different() {
    let f = Fixture::new();
    let mut s = f.service();
    let o = f.open(&mut s);
    let request = f.request(&s);
    let moved = f.0.join("moved.fountain");
    disk::rename(f.0.join("first.fountain"), &moved).unwrap();
    let selection = s.select_recent_location(&request, &moved).unwrap();
    let confirm = |sel: &LocateSelection, choice| ConfirmLocateRequest {
        entry_id: request.entry_id.clone(),
        selection_token: sel.selection_token.clone(),
        choice,
    };
    assert_eq!(
        s.confirm_recent_location(&confirm(&selection, LocateChoice::LinkMoved))
            .unwrap_err()
            .code,
        ErrorCode::OwnershipRequired
    );
    s.release(&o.identity).unwrap();
    disk::write(&moved, b"changed").unwrap();
    assert_eq!(
        s.confirm_recent_location(&confirm(&selection, LocateChoice::LinkMoved))
            .unwrap_err()
            .code,
        ErrorCode::SourceChanged
    );
    let selected = s.select_recent_location(&request, &moved).unwrap();
    assert!(!selected.content_matches_last_known);
    let different = s
        .confirm_recent_location(&confirm(&selected, LocateChoice::OpenDifferent))
        .unwrap();
    assert_ne!(
        different.document.identity.document_id,
        o.identity.document_id
    );
    assert_eq!(s.list_recent_projects().unwrap().entries.len(), 2);
    s.release(&different.document.identity).unwrap();
    let selected = s.select_recent_location(&request, &moved).unwrap();
    assert_eq!(
        s.confirm_recent_location(&confirm(&selected, LocateChoice::LinkMoved))
            .unwrap_err()
            .code,
        ErrorCode::SaveConflict
    );
    let stale = s.select_recent_location(&request, &moved).unwrap();
    s.remove_recent_project(&request).unwrap();
    assert_eq!(
        s.confirm_recent_location(&confirm(&stale, LocateChoice::OpenDifferent))
            .unwrap_err()
            .code,
        ErrorCode::InvalidRecentSelection
    );
}

#[test]
fn managed_rename_preserves_uuid_unknown_metadata_and_previous_mapping() {
    let f = Fixture::new();
    let mut s = f.service();
    let (project, id) = f.managed();
    let old = disk::read(project.join(".screenwriter/project.json")).unwrap();
    let o = s.open_selected(&project.join("screen.fountain")).unwrap();
    let request = f.request(&s);
    s.release(&o.identity).unwrap();
    let moved = project.join("renamed.fountain");
    disk::rename(project.join("screen.fountain"), &moved).unwrap();
    let selection = s.select_recent_location(&request, &moved).unwrap();
    assert!(selection.same_managed_identity && selection.can_link_moved);
    assert_eq!(
        disk::read(project.join(".screenwriter/project.json")).unwrap(),
        old
    );
    let linked = s
        .confirm_recent_location(&ConfirmLocateRequest {
            entry_id: request.entry_id,
            selection_token: selection.selection_token,
            choice: LocateChoice::LinkMoved,
        })
        .unwrap();
    assert_eq!(linked.document.identity.document_id, id);
    assert_eq!(linked.document.ownership, Ownership::Exclusive);
    assert_eq!(
        disk::read(project.join(".screenwriter/project.locate.previous")).unwrap(),
        old
    );
    let metadata: serde_json::Value =
        serde_json::from_slice(&disk::read(project.join(".screenwriter/project.json")).unwrap())
            .unwrap();
    assert_eq!(metadata["sourceFilename"], "renamed.fountain");
    assert_eq!(metadata["unknown"], json!({"retain":[1,2,3]}));
}

#[test]
fn managed_mismatch_is_presented_and_readonly_cannot_link() {
    let f = Fixture::new();
    let mut s = f.service();
    let o = f.open(&mut s);
    let request = f.request(&s);
    s.release(&o.identity).unwrap();
    disk::remove_file(f.0.join("first.fountain")).unwrap();
    let (project, _) = f.managed();
    let other = project.join("screen.fountain");
    let selection = s.select_recent_location(&request, &other).unwrap();
    assert!(!selection.same_managed_identity && !selection.can_link_moved);
    assert_eq!(
        s.confirm_recent_location(&ConfirmLocateRequest {
            entry_id: request.entry_id.clone(),
            selection_token: selection.selection_token,
            choice: LocateChoice::LinkMoved
        })
        .unwrap_err()
        .code,
        ErrorCode::IdentityMismatch
    );
    let path = f.file("readonly.fountain", b"unrelated");
    disk::set_permissions(&path, disk::Permissions::from_mode(0o400)).unwrap();
    let selection = s.select_recent_location(&request, &path).unwrap();
    assert!(!selection.can_link_moved);
    let opened = s
        .confirm_recent_location(&ConfirmLocateRequest {
            entry_id: request.entry_id,
            selection_token: selection.selection_token,
            choice: LocateChoice::OpenDifferent,
        })
        .unwrap();
    assert!(matches!(
        opened.document.ownership,
        Ownership::ViewOnly { .. }
    ));
    assert_eq!(disk::read(&path).unwrap(), b"unrelated");
}

#[test]
fn save_as_failure_does_not_register_destination_exact_success_does() {
    let f = Fixture::new();
    let mut s = f.service();
    let o = f.open(&mut s);
    let before = f.request(&s);
    let draft = s.register_unsaved().unwrap();
    let path = f.0.join("copy.fountain");
    let d = s.select_save_destination(&draft.identity, &path).unwrap();
    let mut checkpoint = f.checkpoint(&draft);
    checkpoint.source = b"copy\r\n".to_vec();
    checkpoint.source_sha256 = hash(&checkpoint.source);
    f.file("copy.fountain", b"external");
    assert!(
        s.save_as_copy(&SaveAsRequest {
            checkpoint: checkpoint.clone(),
            destination_token: d.token
        })
        .is_err()
    );
    assert_eq!(s.list_recent_projects().unwrap().entries.len(), 1);
    assert_eq!(f.request(&s).entry_id, before.entry_id);
    let path = f.0.join("valid.fountain");
    let d = s.select_save_destination(&draft.identity, &path).unwrap();
    let receipt = s
        .save_as_copy(&SaveAsRequest {
            checkpoint,
            destination_token: d.token,
        })
        .unwrap();
    assert_ne!(
        receipt.document.identity.document_id,
        o.identity.document_id
    );
    assert_eq!(s.list_recent_projects().unwrap().entries.len(), 2);
    assert_eq!(
        s.list_recent_projects().unwrap().entries[0].document_id,
        receipt.document.identity.document_id
    );
    assert_eq!(disk::read(&path).unwrap(), b"copy\r\n");
}

#[test]
fn bounded_entries_and_candidates_safe_labels_and_strict_envelopes() {
    let f = Fixture::new();
    let mut s = f.service();
    for n in 0..MAX_RECENTS + 2 {
        let path = f.file(&format!("{n}.fountain"), b"x");
        let o = s.open_selected(&path).unwrap();
        s.release(&o.identity).unwrap();
    }
    assert_eq!(s.list_recent_projects().unwrap().entries.len(), MAX_RECENTS);
    let list = s.list_recent_projects().unwrap();
    for e in &list.entries[..MAX_LOCATE_SELECTIONS] {
        s.select_recent_location(
            &RecentRequest {
                entry_id: e.entry_id.clone(),
            },
            &f.0.join("first.fountain"),
        )
        .unwrap();
    }
    assert!(
        s.select_recent_location(
            &RecentRequest {
                entry_id: list.entries[MAX_LOCATE_SELECTIONS].entry_id.clone()
            },
            &f.0.join("first.fountain")
        )
        .is_err()
    );
    let first = RecentRequest {
        entry_id: list.entries[0].entry_id.clone(),
    };
    let old = s
        .select_recent_location(&first, &f.0.join("first.fountain"))
        .unwrap();
    let new = s
        .select_recent_location(&first, &f.0.join("first.fountain"))
        .unwrap();
    assert_ne!(old.selection_token, new.selection_token);
    assert_eq!(s.locate_selections.len(), MAX_LOCATE_SELECTIONS);
    assert_eq!(
        label(Path::new("/native/evil\n\u{202e}.fountain")),
        "evil\u{fffd}\u{fffd}.fountain"
    );
    for value in [
        json!({"entryId":"/private/path"}),
        json!({"entryId":uuid(),"path":"/injected"}),
    ] {
        assert!(serde_json::from_value::<RecentRequest>(value).is_err());
    }
    assert!(
        serde_json::from_value::<ConfirmLocateRequest>(
            json!({"entryId":uuid(),"selectionToken":uuid(),"choice":"guess"})
        )
        .is_err()
    );
}

#[test]
fn recent_publication_child() {
    let Ok(root) = std::env::var("BABEL_RECENT_CHILD_ROOT") else {
        return;
    };
    let mode = std::env::var("BABEL_RECENT_CHILD_STAGE").unwrap();
    let s = DocumentService::new(&PathBuf::from(root).join("app-data")).unwrap();
    let lease = s.lease("recent-projects").unwrap();
    let r = s.read_recents().unwrap();
    s.publish_recents_with(&r, Vec::new(), &lease, &mut |stage| {
        if format!("{stage:?}") == mode {
            println!("READY");
            std::io::stdout().flush().unwrap();
            let mut line = String::new();
            std::io::stdin().read_line(&mut line).unwrap();
        }
        Ok(())
    })
    .unwrap();
}

#[test]
fn actual_process_interruption_keeps_previous_valid_generation() {
    for stage in [
        PublishStage::PartialWrite,
        PublishStage::FileSynced,
        PublishStage::Replaced,
        PublishStage::DirectorySynced,
    ] {
        let f = Fixture::new();
        let mut s = f.service();
        let o = f.open(&mut s);
        s.release(&o.identity).unwrap();
        let old = disk::read(f.0.join("app-data/recents-1.json")).unwrap();
        drop(s);
        let mut child = Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "documents::linux::recent_store::tests::recent_publication_child",
                "--nocapture",
            ])
            .env("BABEL_RECENT_CHILD_ROOT", &f.0)
            .env("BABEL_RECENT_CHILD_STAGE", format!("{stage:?}"))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()
            .unwrap();
        let mut reader = std::io::BufReader::new(child.stdout.take().unwrap());
        let mut line = String::new();
        loop {
            line.clear();
            assert!(reader.read_line(&mut line).unwrap() > 0);
            if line.trim() == "READY" {
                break;
            }
        }
        child.kill().unwrap();
        child.wait().unwrap();
        let s = f.service();
        let list = s.list_recent_projects().unwrap();
        assert_eq!(
            disk::read(f.0.join("app-data/recents-1.json")).unwrap(),
            old
        );
        if matches!(stage, PublishStage::PartialWrite | PublishStage::FileSynced) {
            assert_eq!(list.health, RecentHealth::NeedsAttention);
            assert_eq!(list.entries.len(), 1);
        } else {
            assert_eq!(list.entries.len(), 0);
        }
        assert_eq!(disk::read(f.0.join("first.fountain")).unwrap(), o.source);
    }
}

#[test]
fn managed_faults_retain_exact_previous_and_source() {
    for stage in [ManagedStage::PreviousSynced, ManagedStage::MappingReplaced] {
        let f = Fixture::new();
        let (project, id) = f.managed();
        let old = disk::read(project.join(".screenwriter/project.json")).unwrap();
        let moved = project.join("renamed.fountain");
        disk::rename(project.join("screen.fountain"), &moved).unwrap();
        let anchor = Anchor::selected(&moved).unwrap();
        let (source, fingerprint) = anchor.snapshot().unwrap();
        assert!(
            relink_managed_mapping(&anchor, &id, &fingerprint, &mut |s| if s == stage {
                Err(error(ErrorCode::Io))
            } else {
                Ok(())
            })
            .is_err()
        );
        assert_eq!(
            disk::read(project.join(".screenwriter/project.locate.previous")).unwrap(),
            old
        );
        assert_eq!(disk::read(&moved).unwrap(), source);
        if stage == ManagedStage::PreviousSynced {
            assert_eq!(
                disk::read(project.join(".screenwriter/project.json")).unwrap(),
                old
            );
        }
    }
}

#[test]
fn replaced_registry_lock_refuses_publication_without_overwriting_previous() {
    let f = Fixture::new();
    let mut s = f.service();
    let o = f.open(&mut s);
    let old = disk::read(f.0.join("app-data/recents-1.json")).unwrap();
    let lease = s.lease("recent-projects").unwrap();
    let r = s.read_recents().unwrap();
    let lock = f.0.join("app-data").join(&lease.name);
    let result = s.publish_recents_with(&r, Vec::new(), &lease, &mut |stage| {
        if stage == PublishStage::FileSynced {
            disk::rename(&lock, lock.with_extension("old-lock")).unwrap();
            disk::write(&lock, b"").unwrap();
            disk::set_permissions(&lock, disk::Permissions::from_mode(0o600)).unwrap();
        }
        Ok(())
    });
    assert_eq!(result.unwrap_err().code, ErrorCode::OwnershipLost);
    assert_eq!(
        disk::read(f.0.join("app-data/recents-1.json")).unwrap(),
        old
    );
    assert_eq!(disk::read(f.0.join("first.fountain")).unwrap(), o.source);
}

#[test]
fn source_save_publication_updates_last_known_native_generation() {
    let f = Fixture::new();
    let mut s = f.service();
    let o = f.open(&mut s);
    let request = f.request(&s);
    let source = b"changed bytes\r\n";
    let saved = s
        .save_request(crate::documents::saving::SaveRequest {
            identity: o.identity.clone(),
            version: 1,
            source: source.to_vec(),
            source_sha256: hash(source),
            expected_fingerprint: o.fingerprint.unwrap(),
            draft_metadata: json!(null),
        })
        .unwrap();
    let list = s.list_recent_projects().unwrap();
    assert_eq!(list.entries[0].entry_id, request.entry_id);
    assert_eq!(
        list.entries[0].last_known_modified_seconds,
        saved.fingerprint.modified_seconds
    );
    assert_eq!(
        list.entries[0].last_known_modified_nanos,
        saved.fingerprint.modified_nanos
    );
    assert_eq!(
        s.read_recents().unwrap().entries[0].fingerprint,
        saved.fingerprint
    );
}

#[test]
fn future_schema_bad_checksum_and_generation_never_replace_prior_valid_metadata() {
    for failure in ["future", "checksum", "generation"] {
        let f = Fixture::new();
        let mut s = f.service();
        let o = f.open(&mut s);
        s.note_recent(&o.identity, None);
        let path = f.0.join("app-data/recents-0.json");
        let previous = disk::read(f.0.join("app-data/recents-1.json")).unwrap();
        let mut value: serde_json::Value =
            serde_json::from_slice(&disk::read(&path).unwrap()).unwrap();
        match failure {
            "future" => value["schemaVersion"] = json!(999),
            "checksum" => value["entriesSha256"] = json!("bad"),
            "generation" => value["generation"] = json!(3),
            _ => unreachable!(),
        }
        let bad = serde_json::to_vec(&value).unwrap();
        disk::write(&path, &bad).unwrap();
        assert_eq!(
            s.list_recent_projects().unwrap().health,
            RecentHealth::NeedsAttention
        );
        assert_eq!(s.list_recent_projects().unwrap().entries.len(), 1);
        s.note_recent(&o.identity, None);
        assert_eq!(disk::read(&path).unwrap(), bad);
        assert_eq!(
            disk::read(f.0.join("app-data/recents-1.json")).unwrap(),
            previous
        );
    }
}

#[test]
fn managed_publication_child() {
    let Ok(root) = std::env::var("BABEL_MANAGED_CHILD_ROOT") else {
        return;
    };
    let mode = std::env::var("BABEL_MANAGED_CHILD_STAGE").unwrap();
    let id = std::env::var("BABEL_MANAGED_CHILD_ID").unwrap();
    let s = DocumentService::new(&PathBuf::from(&root).join("app-data")).unwrap();
    let _lease = s.lease(&format!("document:{id}")).unwrap();
    let anchor = Anchor::selected(&PathBuf::from(root).join("project/renamed.fountain")).unwrap();
    let fingerprint = anchor.snapshot().unwrap().1;
    relink_managed_mapping(&anchor, &id, &fingerprint, &mut |stage| {
        if format!("{stage:?}") == mode {
            println!("READY");
            std::io::stdout().flush().unwrap();
            let mut line = String::new();
            std::io::stdin().read_line(&mut line).unwrap();
        }
        Ok(())
    })
    .unwrap();
}

#[test]
fn actual_managed_mapping_interruption_preserves_previous_source_and_identity() {
    for stage in [ManagedStage::PreviousSynced, ManagedStage::MappingReplaced] {
        let f = Fixture::new();
        let (project, id) = f.managed();
        let old = disk::read(project.join(".screenwriter/project.json")).unwrap();
        let source = disk::read(project.join("screen.fountain")).unwrap();
        disk::rename(
            project.join("screen.fountain"),
            project.join("renamed.fountain"),
        )
        .unwrap();
        let mut child = Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "documents::linux::recent_store::tests::managed_publication_child",
                "--nocapture",
            ])
            .env("BABEL_MANAGED_CHILD_ROOT", &f.0)
            .env("BABEL_MANAGED_CHILD_STAGE", format!("{stage:?}"))
            .env("BABEL_MANAGED_CHILD_ID", &id)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()
            .unwrap();
        let mut reader = std::io::BufReader::new(child.stdout.take().unwrap());
        let mut line = String::new();
        loop {
            line.clear();
            assert!(reader.read_line(&mut line).unwrap() > 0);
            if line.trim() == "READY" {
                break;
            }
        }
        child.kill().unwrap();
        child.wait().unwrap();
        assert_eq!(
            disk::read(project.join(".screenwriter/project.locate.previous")).unwrap(),
            old
        );
        assert_eq!(
            disk::read(project.join("renamed.fountain")).unwrap(),
            source
        );
        let mut s = f.service();
        let o = s.open_selected(&project.join("renamed.fountain")).unwrap();
        assert_eq!(o.identity.document_id, id);
        if stage == ManagedStage::PreviousSynced {
            assert!(
                matches!(o.ownership, Ownership::ViewOnly { reasons } if reasons.contains(&ViewReason::SourceMappingMismatch))
            );
        } else {
            assert_eq!(o.ownership, Ownership::Exclusive);
        }
    }
}

#[test]
fn staged_managed_selection_refuses_changed_project_generation() {
    let f = Fixture::new();
    let mut s = f.service();
    let (project, _) = f.managed();
    let o = s.open_selected(&project.join("screen.fountain")).unwrap();
    let request = f.request(&s);
    s.release(&o.identity).unwrap();
    let moved = project.join("renamed.fountain");
    disk::rename(project.join("screen.fountain"), &moved).unwrap();
    let selection = s.select_recent_location(&request, &moved).unwrap();
    let path = project.join(".screenwriter/project.json");
    let mut metadata: serde_json::Value =
        serde_json::from_slice(&disk::read(&path).unwrap()).unwrap();
    metadata["unknown"]["external"] = json!(true);
    let changed = serde_json::to_vec(&metadata).unwrap();
    disk::write(&path, &changed).unwrap();
    let result = s.confirm_recent_location(&ConfirmLocateRequest {
        entry_id: request.entry_id,
        selection_token: selection.selection_token,
        choice: LocateChoice::LinkMoved,
    });
    assert_eq!(result.unwrap_err().code, ErrorCode::SourceChanged);
    assert_eq!(disk::read(&path).unwrap(), changed);
    assert_eq!(
        s.list_recent_projects().unwrap().entries[0].file_name,
        "screen.fountain"
    );
    assert!(
        !project
            .join(".screenwriter/project.locate.previous")
            .exists()
    );
}
