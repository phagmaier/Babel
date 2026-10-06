# AUDIT-D02 — safe reopen reconciliation and recovery choice

Status: **complete within bounded D02 acceptance; native crash gates remain open**. Base `e595393`, clean main at claim.
Authority: accepted D-02 rules 1+3 in TODO and frozen AUDIT.md; SPEC S10.5,
[ADR 0017](../../decisions/0017-explicit-recovery-choices.md),
[persistence](../../persistence-and-recovery.md), [UX](../../ux.md).

## Deliverable and safety contract

Reconcile natively at open only for an exclusive registration, clean latest
published recovery generation and safe transaction observation (NoTransaction
or ConfirmedRecordMatchesSource). Revalidate source, recovery and ownership.
Byte-identical content needs no ritual; no source save receipt is fabricated.

Persist explicit Keep as a private, synced and verified marker bound to document,
latest canonical recovery record and exact source hash. Reopen honors it only
after fresh safe inspection; changed bytes/generation, unresolved transactions,
unsafe/corrupt artifacts and lost ownership cannot grant reconciliation.
Preserve all source/journal generations; failed marker publication leaves the
choice unresolved. No automatic adoption, journal retirement or deletion.

Before editing a reopened file, complete discovery and require a plain choice
for unresolved recovery. Keep Restore, Keep saved file and Save Recovered Copy;
missing/unreadable source or malformed recovery retains emergency copying.
Inspect Later permits review, not unprotected typing. Present one primary
latest-generation choice; retain older reviewed material behind Inspect without
deleting it. This presentation is necessary to avoid simultaneous contradictory
decisions; no generation is automatically adopted or discarded.

AUDIT-D02 distinguishes a prior confirmed record whose source later changed
from an unresolved replacement: only an explicit reviewed Keep may bind that
source when no intent, previous-pending copy or candidate remains. Identical-byte
automatic admission still requires NoTransaction or ConfirmedRecordMatchesSource.
A verified latest checkpoint from the current registration needs no older-session
choice. Exporting a standalone copy does not resolve a pending review; successful
Save As adoption switches to a fresh identity without carrying the old gate.

## Verification and boundary

Record red native and mounted UI tests before production edits. Cover identical
reopen, explicit Keep/restart, metadata-only source changes, changed source/latest
generation, corrupt/pending journal, interrupted save, failed/unsafe marker,
view-only ownership, failed-save/Save-As redirect, deferred/failed discovery,
choice failure and successful subsequent editing/save/Undo. Final admission
facts must reuse source/transaction guards even for an own-session checkpoint;
choice success returns the retained caret, and title/spelling/find/move/Import
mutators remain gated during review.

Tier 3: focused Rust/recovery/UI tests; full current frontend and workspace
tests, format/lint/typecheck/build, Rust fmt/clippy, tmpfs/Btrfs workspace matrix,
browser smoke, default embedded release and affected native reopen/recovery
drills with fresh artifacts. Preserve failed attempts and genuine IME assertions;
unrelated timing modes need no repetition. Append one labeled evidence line per
check in [AUDIT evidence](../../test-evidence/AUDIT.md); amend ADR/owning docs and
affected trace together. Frozen AUDIT.md stays untouched.

Commit locally on main. No push. Stop after D-02 before D-03. Retained WebKit
crashes, initial SIMP-F assessment, SELinux, C1/F2, M6-02 and admission stay open.

Final evidence: current frontend 885/885, workspace 273/273 on each filesystem;
shared/browser/default release pass. Final ten-mode native matrix 20/20 content,
19/20 strict; owned Btrfs WebKit SIGABRT and earlier failures/cores retained.
No C1/F2, full native/a11y/IME, M6-02, SELinux or Local v1 admission closure.
Stopped before D-03; local main commit only, no push.
