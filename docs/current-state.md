# Current state — AUDIT-NATIVE-R1 complete

Date: 2026-10-04. Application: **babel**. Main; local commit only, no push.
M0–M5 and bounded M6-01 investigation remain recorded complete. **M6-02 stays
unchecked; operation findings, C1/F2 and Local v1 admission remain open.**

## Task and work

**AUDIT-NATIVE-R1 complete**, base `fcfade8`: Save-first F6 focus restored;
private Mozc server bound read-only at its compiled path. Command drill now
observes owned GTK selection during physical keys before Save As/Enter.
[Brief](tasks/AUDIT-NATIVE-R1.md),
[evidence](test-evidence/AUDIT.md#audit-native-r1--f6-focus-and-private-mozc).
Only WritingView focus logic and native test prerequisites/traversal changed;
original 819 native assertions, editor/drill/frozen AUDIT bytes remain intact.
Current frontend **876/876**, Rust **264/264**; shared/static/browser/default
embedded release pass. Full native commands **2/2 strict**; editor **2/2 content,
1/2 strict** on tmpfs/Btrfs. Selected **4/4 content, 3/4 strict**, not a clean
full matrix. Btrfs owned WebKit **SIGSEGV 251383/start 3043549** coincides with
parent disappearance during existing forced SIGKILL/restart; source/recovery
checks pass but no cause/correction or C1/F2 closure. Raw journal/core, failed
attempts and checksummed tmpfs mirrors retained in `target/audit-native-r1/`.
Original F6/Mozc blockers corrected; wider read-only F6 remains unverified after
an additional injected probe. No full keyboard/a11y/IME or admission claim.

**AUDIT-D06 complete**, base `200e375`. [Brief](tasks/AUDIT-D06.md).
Receipt-derived status with closed Save details; memory-only/snapshot alerts
remain visible. File-backed/read-only Close session, Home/Open and native window
requests automatically use the existing exact-protection/release coordinator.
Untitled drafts still ask before recovery-only close; failures retain the editor
and retry/copy/risk choices. Keep writing clears the pending close destination.
No cadence/version/receipt/native adapter, fixture or dependency changes.

Tier 2: current frontend **875/875**, Rust **264/264** unrestricted; shared
format/lint/typecheck/build, browser, default embedded release, Python/dispatch
and artifact audits pass. Selected WebKit **10/14 successful**, **14/14 owned
crash audits clean**; separate AT-SPI plain presentation **2/2 strict** on
both filesystems. Real untitled window prompt/cancel, automatic file window
exit, writable reopen and exact BOM/CRLF/draft bytes passed tmpfs/Btrfs.
Commands/F6 and editor/Mozc failures reproduce on retained frozen controls;
full command/IME coverage remains blocked. Initial focus/query/sandbox failures
and all retries remain retained. A new focus check now waits for the exact
required button; unsuccessful IME harness experiments were reverted.
[Evidence, commands, failures and limits](test-evidence/AUDIT.md#audit-d06--plain-status-and-failure-only-close-prompts).
Artifacts: `target/audit-d06/`; failed roots/ledgers and tmpfs mirrors retained.
No full native/a11y/IME, SELinux, C1/F2, M6-02 or admission closure.

**AUDIT-SIMP-F complete** (`200e375`, local; base `ef0ff02`).
[Brief](tasks/AUDIT-SIMP-F.md), [evidence](test-evidence/AUDIT.md#audit-simp-f--frontend-guard-and-native-dispatch-simplification).
Shared cleanup/locks/stamp guards/error codes/native dispatch. Prior 867/867
frontend, 264/264 Rust, 21/22 selected native; baseline F6 and initial daily
assessment failures remain retained. D-06 does not dispose of those findings.

Wave 3 prior work remains complete: [SIMP-N](tasks/AUDIT-SIMP-N.md) `ef0ff02`,
[SLP-C](tasks/AUDIT-SLP-C.md) `653f037`, [SLP-B](tasks/AUDIT-SLP-B.md) `186ea59`,
[SLP-A](tasks/AUDIT-SLP-A.md) `d463656`, [TEST](tasks/AUDIT-TEST.md) `09d496f`.
[Audit evidence](test-evidence/AUDIT.md) retains their checks/failures, including
SLP-B's owned Btrfs WebKit SIGSEGV (`69485`/start `1517917`); clean controls do
not resolve it or the M6-03 copy/prune gap. `AUDIT.md` remains frozen.

Earlier Wave 1/0 closures and evidence remain in TODO/AUDIT: C01, C04, D01,
D08A, C356 and W0/W0-R1. C356's enforcing Fedora/SELinux and native highlight
input are unverified. C04's unreproduced publication-cache failure is retained.
W0-R1's recorded CI green predates these local commits; no new CI/push claim.

## M6 findings and blockers

Prior bounded Linux hardening: Save As refusal/identity and Undo rollback,
child-kill source/recovery/local-restore, path-loss/shared-store drills and
independent byte/head audit. No cause/correction for untouched M6-01 symptoms.
[Brief](tasks/M6-02.md), [S15.2 matrix](test-evidence/M6-02-matrix.md),
[review](reviews/2026-10-03-m6-02-persistence-review.md),
[checks/failures](test-evidence/M6.md#m6-02--persistence-interruption-and-operation-investigation).

Separate-store read-only expectations conflict with ADR 0012 shared-store
lease scope. Btrfs restart preserved content but recorded owned WebKit SIGABRT
following parent SIGKILL (`274428`/start `2737907`); provenance/cores and failed
M6-01/M6-02 roots remain. Intact bytes and clean samples do not close C1/F2.
Rename path-loss is not unmount/power/controller/antivirus/sync acceptance.
Save As/IME stress symptoms remain open; M6-03 independent copy/prune has not
started. Capture-failure bundle policy remains a separate owner/ADR decision.

## Next action and stopping point

Stopped after **AUDIT-NATIVE-R1**, local commit only; do not start D-02 here.
Next ready DESIGN continuation: draft bounded **D-02** rules 1+3
(byte-identical journal reconciliation and plain divergent choice), without
rejected auto-adopt/retirement. For a separate crash follow-up, start from the
retained Btrfs owned core/ledger and matched forced-restart controls; clean
reruns cannot dispose of it. Initial SIMP-F daily assessment remains unresolved.
Never weaken assertions or substitute injected composition for native IME.

[M6-02-R1](tasks/M6-02-R1.md) remains separate. Supported-runtime
[M6-01-R1](tasks/M6-01-R1.md) needs an identified available correction; C stays
open before M6-14/16. Real interruption, full S13, security/notices, target-native/
screenreader/installed/manual update, backup/migration/owner pilot and Local v1
remain later gates. DEV-02 is owner-only. No M7, private-engine shipping,
personal manuscript/credential/upload work.
