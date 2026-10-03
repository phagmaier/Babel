# AUDIT-D08A — protected Reload on external change

Status: **done 2026-10-03**; base `2bc2311`, clean main at claim.
[Evidence](../test-evidence/AUDIT.md#audit-d08a--protected-external-reload).
Dependencies: AUDIT-W0/C01/C04/D01 done. Requirements: SPEC S10.7/S10.8,
SAVE-05 and INV-05/07/10/20. Covers D-08(A); AUDIT.md stays frozen.

## Deliverable and safety contract

Check the selected native source on window focus and with bounded periodic
checks (one outstanding read, hashes/fingerprints distinguish self-writes).
Offer explicit Reload when content differs, retaining editor and disk versions;
never reload automatically. The same flow works for dirty sessions: show both
literal generations for comparison, Keep editing with source writes blocked,
Save As/export a separate copy, or explicitly Reload after protecting the live
version. Missing/unreadable/unsafe sources refuse reload while recovery/copy
remain available. Unsaved and read-only sessions do not acquire new authority.

Native handle-only inspection re-anchors identical-byte metadata changes after
ownership, metadata, identity and generation revalidation; it grants no new
file-saved version. A content Reload binds the reviewed disk fingerprint and
both exact editor captures. Native code serializes it with saves, protects the
old editor through checkpoint, pre-destructive snapshot and safety revision,
protects the adopted capture, syncs/rechecks disk, transfers an inode lease when
necessary, and returns an exact source receipt without replacing source bytes.
The editor adopts as one Undo-able transaction; Undo requires its own later
save. Failures retain both generations and no unsupported save credit.

## Verification and boundary

Tier 3: focused native reload/IPC tests and writing-session/UI/controller tests;
shared frontend tests, lint/typecheck/build; Rust fmt/clippy; complete workspace
matrix on tmpfs/Btrfs; browser smoke; default `pnpm tauri build --no-bundle`.
A focused production WebKit Reload drill runs on both filesystems if host
prerequisites are available, otherwise record the precise blocked prerequisite.
Tests cover clean/dirty reload, metadata-only recheck, atomic external replace,
stale review, missing/unsafe/invalid UTF-8, ownership/identity, failed protection,
subsequent saves, Undo and in-flight checks. Run touched prettier, links, Python
checks and git diff --check; record failures/reruns in AUDIT evidence.

Update persistence contract and SAVE-05 mapping plus the bounded handoff/tracker.
Commit on main. Owner permits a warranted push; no force-push. Stop at D08A;
D-06, schema rewrite, sync-folder policy and C1/F2 disposition remain separate.
