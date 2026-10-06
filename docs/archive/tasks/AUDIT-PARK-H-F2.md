# AUDIT-PARK-H-F2 — retain empty Scene Heading drafting intent

Status: **bounded content repair done 2026-10-04**; base `fc43779`.
[Evidence](../../test-evidence/AUDIT.md#audit-park-h-f2--empty-scene-heading-recovery-intent).
Primary native content 12/12, strict 11/12; retained owned WebKit SIGABRT
remains unattributed despite a clean frozen F1 control and candidate replay.
This task does not close crash/platform admission gates.
Dependencies: AUDIT-PARK-H and F1 complete. The owner delegated task selection
and implementation decisions on 2026-10-04; no further wording/fix approval is
required. Push authorization is unchanged.
Requirements: SPEC S05.5, EDIT-02 and INV-01/04; exact-source draft intent in
[document model](../../document-model.md#m3-02-production-codec-foundation) and
[persistence](../../persistence-and-recovery.md#m2-02-recovery-checkpoints).

## Deliverable and acceptance

1. Investigate and report the capture, sparse metadata, native journal and
   reopen reach before product edits. Record the report in
   `docs/reviews/2026-10-04-empty-heading-intent.md`. Prefer the existing
   hash-bound sparse metadata over a new native recovery format.
2. If the report proves that the existing transport can carry this intent,
   use an ordinary physical blank for an empty Scene Heading and recover its
   type only from exact-source metadata. Do not emit a bare `.` or invent
   portable empty-heading semantics. Complete headings retain current syntax.
3. Red tests before the fix: codec capture, sparse metadata round-trip,
   malformed/stale/incompatible metadata, exact BOM/CRLF bytes, protected
   neighbors, heading completion/removal and Undo/Redo. Preserve ordinary
   source-only reopen as a blank and the existing empty-EOF refusal.
4. Mounted UI: edits elsewhere while the heading stays empty reach both save
   and checkpoint; exact current status and ordinary protected close succeed.
   Native disposable tmpfs/Btrfs proof checks saved bytes, journaled intent,
   owned-kill recovery, completion and ordinary close, with crash attribution.

## Do NOT do

Change native save/recovery/journal/lease/history/IPC or publication code;
change parser classification of authored `.` or other source; introduce a
full editor document mirror or new metadata schema; rewrite fixtures or
frozen root AUDIT.md; weaken protected/malformed or stale-result guards;
implement other parked findings or M6/M7; push.

## Checks and stopping

Tier 2 frontend codec/metadata behavior: focused red then green tests, full
frontend shared gates, helper and browser, Rust format/clippy/workspace on
one filesystem (no native adapter changes), fresh release build. Run the six
F1 capture-sensitive modes on tmpfs/Btrfs; update empty-heading assertions
only where the intended behavior changes. Keep historical failed evidence.
Use a task-owned Btrfs IME-wrapper root to avoid the retained tmpfs inode
pressure; the disposable app/filesystem roots and isolation mounts stay as before.
Update owning docs/affected trace, TODO/current-state and append-only audit
evidence. One F2 task-ID commit on main; finish `git diff --check` and stop.
If the investigation reveals a native format/service change is necessary,
complete the report and a ready follow-up brief instead of crossing scope.
