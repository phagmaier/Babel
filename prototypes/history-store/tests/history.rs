#![cfg(target_os = "linux")]
use git2::{Oid, Repository, Signature, Time};
use history_store_proof::{proof::Sandbox, *};
use std::fs;

fn initial(repo: &Repository) -> Oid {
    record(repo, None, OLD, PROFILE).unwrap()
}

#[test]
fn byte_exact_curated_snapshot_reopen_dedup_profile_and_identity() {
    let s = Sandbox::new().unwrap();
    let repo = s.repo("local.git");
    let first = initial(&repo);
    assert!(repo.is_bare());
    assert!(repo.workdir().is_none());
    assert_eq!(read(&repo, first, PROJECT).unwrap().source, OLD);
    assert_eq!(record(&repo, Some(first), OLD, PROFILE).unwrap(), first);
    let second = record(&repo, Some(first), OLD, "synthetic-profile-v1").unwrap();
    assert_ne!(first, second);
    let commit = repo.find_commit(second).unwrap();
    assert_eq!(commit.author().email().unwrap(), "proof@localhost.invalid");
    let tree = commit.tree().unwrap();
    let mut paths = tree
        .iter()
        .map(|entry| entry.name().unwrap().to_owned())
        .collect::<Vec<_>>();
    paths.sort();
    assert_eq!(paths, ["manifest.json", "screenplay.fountain"]);
    assert_eq!(
        read(&repo, second, PROJECT)
            .unwrap()
            .manifest
            .source_sha256
            .len(),
        64
    );
    assert!(read(&repo, second, "foreign-project").is_err());
    let reopened = open(repo.path()).unwrap();
    assert_eq!(head(&reopened).unwrap(), Some(second));
    assert_eq!(read(&reopened, second, PROJECT).unwrap().source, OLD);
    assert!(reopened.config().unwrap().get_string("user.email").is_err());
}

#[test]
fn source_bounds_invalid_encoding_and_changed_content() {
    let s = Sandbox::new().unwrap();
    let repo = s.repo("local.git");
    let first = initial(&repo);
    assert!(record(&repo, Some(first), &[0xff], PROFILE).is_err());
    assert!(record(&repo, Some(first), &vec![b'x'; 1024 * 1024 + 1], PROFILE).is_err());
    assert_eq!(head(&repo).unwrap(), Some(first));
    let second = record(&repo, Some(first), NEW, PROFILE).unwrap();
    assert_ne!(first, second);
    assert_eq!(read(&repo, second, PROJECT).unwrap().source, NEW);
    assert_eq!(read(&repo, first, PROJECT).unwrap().source, OLD);
}

#[test]
fn restore_creates_new_revision_and_keeps_later_history_and_safety_refs() {
    let s = Sandbox::new().unwrap();
    let repo = s.repo("local.git");
    let first = initial(&repo);
    let second = record(&repo, Some(first), NEW, PROFILE).unwrap();
    let restored = restore(&repo, second, first).unwrap();
    assert_ne!(restored, first);
    assert_eq!(
        repo.find_commit(restored).unwrap().parent_id(0).unwrap(),
        second
    );
    assert_eq!(read(&repo, restored, PROJECT).unwrap().source, OLD);
    assert!(repo.graph_descendant_of(restored, second).unwrap());
    for id in [first, second] {
        assert_eq!(
            repo.refname_to_id(&format!("refs/safety/{id}")).unwrap(),
            id
        );
    }
    fs::write(s.0.join("active.src"), NEW).unwrap();
    restore(&repo, restored, first).unwrap();
    assert_eq!(fs::read(s.0.join("active.src")).unwrap(), NEW);
}

#[test]
fn stale_head_and_native_ref_lock_failure_preserve_existing_heads() {
    let s = Sandbox::new().unwrap();
    let repo = s.repo("local.git");
    let first = initial(&repo);
    let winner = snapshot(&repo, NEW, PROFILE, &[first], "winner", 101).unwrap();
    let loser = snapshot(
        &repo,
        b"Synthetic losing draft",
        PROFILE,
        &[first],
        "loser",
        102,
    )
    .unwrap();
    advance(&repo, Some(first), winner).unwrap();
    assert!(advance(&repo, Some(first), loser).is_err());
    protect(&repo, "conflicts", loser).unwrap();
    assert!(record(&repo, Some(first), OLD, PROFILE).is_err());
    let candidate = snapshot(&repo, OLD, PROFILE, &[winner], "candidate", 103).unwrap();
    fs::write(repo.path().join("refs/heads/main.lock"), b"another owner").unwrap();
    assert!(advance(&repo, Some(winner), candidate).is_err());
    assert_eq!(head(&repo).unwrap(), Some(winner));
    assert_eq!(
        read(&repo, loser, PROJECT).unwrap().source,
        b"Synthetic losing draft"
    );
    assert_eq!(
        fs::read(repo.path().join("refs/heads/main.lock")).unwrap(),
        b"another owner"
    );
}

#[test]
fn concurrent_native_ref_updates_have_one_winner_and_preserve_both_candidates() {
    let s = Sandbox::new().unwrap();
    let repo = s.repo("local.git");
    let base = initial(&repo);
    let a = snapshot(&repo, NEW, PROFILE, &[base], "candidate a", 101).unwrap();
    let b = snapshot(&repo, OLD, PROFILE, &[base], "candidate b", 102).unwrap();
    let barrier = std::sync::Barrier::new(2);
    let path = repo.path().to_path_buf();
    let outcomes = std::thread::scope(|scope| {
        let handles = [a, b].map(|id| {
            let path = &path;
            let barrier = &barrier;
            scope.spawn(move || {
                let independent = open(path).unwrap();
                barrier.wait();
                advance(&independent, Some(base), id).is_ok()
            })
        });
        handles.map(|handle| handle.join().unwrap())
    });
    assert_eq!(outcomes.into_iter().filter(|won| *won).count(), 1);
    assert!(matches!(head(&repo).unwrap(), Some(id) if id == a || id == b));
    for id in [a, b] {
        protect(&repo, "conflicts", id).unwrap();
        assert!(read(&repo, id, PROJECT).is_ok());
    }
}

#[test]
fn ancestry_not_timestamps_classifies_conflicts_and_explicit_resolution_keeps_parents() {
    let s = Sandbox::new().unwrap();
    let repo = s.repo("local.git");
    let base = initial(&repo);
    let local = snapshot(&repo, NEW, PROFILE, &[base], "local", 999).unwrap();
    let incoming = snapshot(&repo, OLD, PROFILE, &[base], "incoming", 1).unwrap();
    let unrelated = snapshot(&repo, NEW, PROFILE, &[], "unrelated", 1000).unwrap();
    assert!(advance(&repo, None, unrelated).is_err());
    assert_eq!(
        relationship(&repo, base, base).unwrap().ancestry,
        Ancestry::Same
    );
    assert_eq!(
        relationship(&repo, base, local).unwrap().ancestry,
        Ancestry::LocalBehind
    );
    assert_eq!(
        relationship(&repo, local, base).unwrap().ancestry,
        Ancestry::LocalAhead
    );
    assert_eq!(
        relationship(&repo, local, incoming).unwrap().ancestry,
        Ancestry::Diverged
    );
    let same = relationship(&repo, local, unrelated).unwrap();
    assert_eq!(same.ancestry, Ancestry::Unrelated);
    assert!(same.same_content);
    advance(&repo, Some(base), local).unwrap();
    for id in [local, incoming] {
        protect(&repo, "conflicts", id).unwrap();
    }
    assert_eq!(head(&repo).unwrap(), Some(local));
    // Explicit synthetic choice; no textual merge or timestamp winner.
    let selected = snapshot(
        &repo,
        OLD,
        PROFILE,
        &[local, incoming],
        "reviewed choice",
        1001,
    )
    .unwrap();
    advance(&repo, Some(local), selected).unwrap();
    let commit = repo.find_commit(selected).unwrap();
    assert_eq!(commit.parent_count(), 2);
    assert_eq!(commit.parent_id(0).unwrap(), local);
    assert_eq!(commit.parent_id(1).unwrap(), incoming);
    assert_eq!(read(&repo, selected, PROJECT).unwrap().source, OLD);
}

#[test]
fn local_bare_transport_round_trip_fetch_never_changes_main() {
    let s = Sandbox::new().unwrap();
    let a = s.repo("a.git");
    let b = s.repo("b.git");
    let remote = s.repo("remote.git");
    let first = initial(&a);
    assert_eq!(push_local(&a, &remote, first).unwrap(), first);
    let fetched = fetch_local(&b, &remote, "first").unwrap();
    assert_eq!(fetched, first);
    assert_eq!(head(&b).unwrap(), None);
    advance(&b, None, fetched).unwrap();
    let second = record(&b, Some(first), NEW, PROFILE).unwrap();
    push_local(&b, &remote, second).unwrap();
    assert_eq!(fetch_local(&a, &remote, "second").unwrap(), second);
    assert_eq!(head(&a).unwrap(), Some(first));
    assert!(fetch_local(&a, &remote, "second").is_err());
    assert!(fetch_local(&a, &remote, "../main").is_err());
    assert_eq!(read(&a, second, PROJECT).unwrap().source, NEW);
    advance(&a, Some(first), second).unwrap();
    assert_eq!(head(&remote).unwrap(), Some(second));
}

#[test]
fn remote_advance_rejects_stale_non_force_push_and_preserves_divergence() {
    let s = Sandbox::new().unwrap();
    let a = s.repo("a.git");
    let b = s.repo("b.git");
    let remote = s.repo("remote.git");
    let base = initial(&a);
    push_local(&a, &remote, base).unwrap();
    let shared = fetch_local(&b, &remote, "base").unwrap();
    advance(&b, None, shared).unwrap();
    let local = record(&a, Some(base), NEW, PROFILE).unwrap();
    let other = record(&b, Some(base), b"Synthetic other draft", PROFILE).unwrap();
    push_local(&b, &remote, other).unwrap();
    assert!(push_local(&a, &remote, local).is_err());
    assert_eq!(head(&remote).unwrap(), Some(other));
    let incoming = fetch_local(&a, &remote, "conflict").unwrap();
    assert_eq!(
        relationship(&a, local, incoming).unwrap().ancestry,
        Ancestry::Diverged
    );
    protect(&a, "conflicts", local).unwrap();
    protect(&a, "conflicts", incoming).unwrap();
    assert_eq!(head(&a).unwrap(), Some(local));
    assert_eq!(read(&a, local, PROJECT).unwrap().source, NEW);
    assert_eq!(
        read(&a, incoming, PROJECT).unwrap().source,
        b"Synthetic other draft"
    );
    let resolution = snapshot(
        &a,
        NEW,
        PROFILE,
        &[local, incoming],
        "reviewed resolution",
        200,
    )
    .unwrap();
    advance(&a, Some(local), resolution).unwrap();
    push_local(&a, &remote, resolution).unwrap();
    assert_eq!(head(&remote).unwrap(), Some(resolution));
}

#[test]
fn captured_push_is_immutable_even_when_local_head_has_newer_edits() {
    let s = Sandbox::new().unwrap();
    let local = s.repo("local.git");
    let remote = s.repo("remote.git");
    let captured = initial(&local);
    let newer = record(&local, Some(captured), NEW, PROFILE).unwrap();
    assert_eq!(push_local(&local, &remote, captured).unwrap(), captured);
    assert_eq!(head(&remote).unwrap(), Some(captured));
    assert_eq!(head(&local).unwrap(), Some(newer));
}

fn malformed(repo: &Repository, good: Oid, variant: usize) -> Oid {
    let commit = repo.find_commit(good).unwrap();
    let tree = commit.tree().unwrap();
    let mut builder = repo.treebuilder(Some(&tree)).unwrap();
    match variant {
        0 => {
            builder
                .insert(
                    "private.txt",
                    repo.blob(b"synthetic excluded data").unwrap(),
                    0o100644,
                )
                .unwrap();
        }
        1 => {
            builder
                .insert(
                    "screenplay.fountain",
                    repo.blob(b"../private").unwrap(),
                    0o120000,
                )
                .unwrap();
        }
        2 => {
            builder
                .insert("screenplay.fountain", good, 0o160000)
                .unwrap();
        }
        _ => {
            let blob = repo
                .find_blob(tree.get_name("manifest.json").unwrap().id())
                .unwrap();
            let mut manifest: serde_json::Value = serde_json::from_slice(blob.content()).unwrap();
            match variant {
                3 => manifest["schema"] = 99.into(),
                4 => manifest["project"] = "foreign-project".into(),
                5 => manifest["source_sha256"] = "incorrect".into(),
                6 => manifest["profile_sha256"] = "incorrect".into(),
                _ => manifest["window_state"] = "excluded".into(),
            }
            builder
                .insert(
                    "manifest.json",
                    repo.blob(&serde_json::to_vec(&manifest).unwrap()).unwrap(),
                    0o100644,
                )
                .unwrap();
        }
    }
    let tree = repo.find_tree(builder.write().unwrap()).unwrap();
    let sig = Signature::new("synthetic", "proof@localhost.invalid", &Time::new(100, 0)).unwrap();
    repo.commit(None, &sig, &sig, "untrusted synthetic revision", &tree, &[])
        .unwrap()
}

#[test]
fn untrusted_tree_modes_manifest_identity_and_hash_are_rejected_without_checkout() {
    let s = Sandbox::new().unwrap();
    let repo = s.repo("local.git");
    let good = initial(&repo);
    for variant in 0..8 {
        let bad = malformed(&repo, good, variant);
        assert!(read(&repo, bad, PROJECT).is_err());
        assert!(advance(&repo, Some(good), bad).is_err());
        assert_eq!(head(&repo).unwrap(), Some(good));
    }
}

#[test]
fn corrupt_history_and_missing_remote_do_not_touch_source_or_recovery() {
    let s = Sandbox::new().unwrap();
    let repo = s.repo("local.git");
    let remote = s.repo("remote.git");
    let first = initial(&repo);
    fs::write(s.0.join("active.src"), NEW).unwrap();
    fs::write(s.0.join("recovery.src"), NEW).unwrap();
    let object = first.to_string();
    let path = repo
        .path()
        .join("objects")
        .join(&object[..2])
        .join(&object[2..]);
    // libgit2 correctly creates immutable loose objects read-only. Make ONLY
    // this disposable fixture writable to inject on-disk corruption.
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
    fs::write(&path, b"corrupt loose commit").unwrap();
    // Reopen so an object cache cannot mask on-disk corruption.
    let reopened = open(repo.path()).unwrap();
    assert!(read(&reopened, first, PROJECT).is_err());
    assert!(record(&reopened, Some(first), NEW, PROFILE).is_err());
    assert_eq!(fs::read(&path).unwrap(), b"corrupt loose commit");
    fs::rename(remote.path(), s.0.join("moved-remote.git")).unwrap();
    assert!(fetch_local(&reopened, &remote, "missing").is_err());
    assert_eq!(fs::read(s.0.join("active.src")).unwrap(), NEW);
    assert_eq!(fs::read(s.0.join("recovery.src")).unwrap(), NEW);
    assert_eq!(head(&reopened).unwrap(), Some(first));
}

#[test]
fn foreign_remote_objects_are_retained_for_inspection_without_adoption() {
    let s = Sandbox::new().unwrap();
    let local = s.repo("local.git");
    let remote = s.repo("remote.git");
    let good = initial(&local);
    let seed = initial(&remote);
    let foreign = malformed(&remote, seed, 4);
    remote
        .reference(MAIN, foreign, true, "synthetic foreign remote")
        .unwrap();
    assert!(fetch_local(&local, &remote, "foreign").is_err());
    assert_eq!(head(&local).unwrap(), Some(good));
    assert_eq!(
        local.refname_to_id("refs/incoming/foreign").unwrap(),
        foreign
    );
    assert!(local.find_commit(foreign).is_ok());
}

#[test]
fn synthetic_identity_and_repository_hooks_are_not_used_for_execution() {
    use std::os::unix::fs::PermissionsExt;
    let s = Sandbox::new().unwrap();
    let repo = s.repo("local.git");
    let remote = s.repo("remote.git");
    fs::create_dir_all(repo.path().join("hooks")).unwrap();
    // Executable hooks would create a marker if invoked. Source-controlled
    // synthetic script only; native library operations must not execute it.
    let marker = s.0.join("hook-ran");
    for name in ["post-commit", "pre-push"] {
        let hook = repo.path().join("hooks").join(name);
        fs::write(
            &hook,
            format!("#!/bin/sh\nprintf ran > '{}'\n", marker.display()),
        )
        .unwrap();
        fs::set_permissions(hook, fs::Permissions::from_mode(0o700)).unwrap();
    }
    let first = initial(&repo);
    push_local(&repo, &remote, first).unwrap();
    assert!(!marker.exists());
    assert_eq!(
        repo.find_commit(first).unwrap().author().email().unwrap(),
        "proof@localhost.invalid"
    );
    assert!(
        repo.config()
            .unwrap()
            .get_string("credential.helper")
            .is_err()
    );
}
