# AUDIT-NATIVE-R1 — F6 focus and private Mozc follow-up

Base `fcfade8`, main, local only. User authorized a bounded investigation of
F6 first, then isolated Mozc, stopping before D-02.

## Deliverable and contract

Affected trace: EDIT-03, EDIT-06 and NAV-03 in [requirements](../requirements.md).

Diagnose the repeated commands/F6 and editor/Mozc failures retained by
[AUDIT-D06](AUDIT-D06.md). Correct a proven narrow cause or record a concrete
prerequisite/blocker. Preserve the original native F6 Save/back assertion,
trusted composition start/end, literal Japanese/Chinese bytes, consumed Enter,
Undo, protection and crash attribution. Baseline reproduction establishes
preexistence, not closure. No global IME changes or personal profiles.

Focus contract: [editor behavior](../editor-behavior.md) F6 escape and
[UX](../ux.md) keyboard focus. Shared checks follow
[development tiers](../development.md#check-tiers-use-the-lowest-tier-that-covers-the-change).
Read the specific callback/test and isolated launcher before changes.

## Scope and safety

Application focus callback and focused UI tests only if the existing native
Save target is contradicted. Private test launcher/configuration only if
isolated process evidence proves the Mozc cause. The newly reached physical
GTK menu traversal may observe owned selection during physical keys; retain
Save As picker/cancellation and byte assertions. No save/recovery/IPC/native
adapter/fixture/pin changes, injected IME, weaker assertions, crash filtering,
frozen AUDIT edits, C1/F2 closure or D-02 implementation.

## Verification and evidence

Retain a fresh native diagnostic before production edits; private IME control
before launcher edits. Named commands/editor-exit modes on tmpfs and Btrfs,
with existing owned-process/journal attribution; genuine pinyin and Mozc
commit/Undo. Focused tests plus Tier 2 shared/frontend/browser/default embedded
build if application logic changes. Python syntax and launcher checks if changed.
No repeated Rust filesystem matrix absent production filesystem triggers.
Record every failure and correction in
[test evidence](../test-evidence/AUDIT.md), update TODO/current-state, commit
locally on main and stop. A clean rerun does not erase prior crash findings.

## Disposition

Specific F6/Mozc blockers corrected, plus the newly reached menu traversal.
Named commands pass strictly on both filesystems; editor content checks pass
both, but owned Btrfs WebKit SIGSEGV keeps its strict sample failed. The bounded
follow-up is complete; full native/C1/F2/M6-02/Local v1 gates remain open. Stop
before D-02; raw failures, core and PID/start attribution remain linked in evidence.
