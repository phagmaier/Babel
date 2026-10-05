# AUDIT-PARK-H-F1 — capture newly authored hidden rows in opened source

Status: **done 2026-10-04**; base `86ce08d`.
[Evidence](../test-evidence/AUDIT.md#audit-park-h-f1--new-hidden-row-capture).
Dependencies: AUDIT-PARK-H complete; owner authorizes the sourceBridge fix
and the native Omitted-material gap in this task. No push.
Requirements: EDIT-02 (structural source/picker capture; unchanged contract),
existing source-preservation and whole-region capture contracts
in [document model](../document-model.md#m3-03-complex-source-structures-and-editing)
and [editor behavior](../editor-behavior.md#m3-06-picker-and-shared-shortcuts).

## Deliverable and acceptance

- Hand-written red tests before the fix for new Note and Omitted material
  rows in an opened screenplay: empty and populated, beginning/middle/end,
  directly beside retained protected source, two distinct groups, and a
  multiline group. Enter inside a Note creates its second literal line;
  Omitted material uses complete multiline selection conversion (its existing
  Enter refusal is unchanged).
- Exact expected bytes preserve every existing byte in BOM/CRLF and
  unknown-region sources; only inserted rows are added. Reopen captured
  bytes with the same row kinds/text and capture again byte-identically.
  Undo/Redo through the new region stays capturable at every step.
- Preserve zero-byte authoring, conversion of an existing source row, and
  editing a Note already present in the file; retain malformed/protected
  ownership refusals.
- Flip only the owner-named as-found Note/boneyard contract cases, the
  WritingView new-Note case, and native phase D. Mounted UI proves empty
  and populated hidden rows plus later text are saved and journaled and
  ordinary protected close succeeds. Native phase D verifies both Note and
  Omitted material with distinct markers and exact saved bytes.
- `src/editor/sourceBridge.ts` places groups without prior rows using the
  nearest preceding surviving source row, or index zero. Verify this idea
  against the checked concrete transaction and structural reconciliation;
  preserve all source/neighbor/whole-region checks.

## Do NOT do

Change save, recovery, journal, snapshot, lease, history, IPC or Rust code;
change codec classification, helper, profile, fonts or dependency pins;
rewrite existing fixture bytes or frozen root AUDIT.md; change empty-heading
intent or alert wording; implement owner-decision tasks; weaken other tests;
start M6/M7 or push.

## Checks and stopping

Record red focused contract/UI tests before editing product source. Tier 2
frontend capture change: full frontend suite, formatting/lint/typecheck/build,
PDF helper, browser smoke, Rust format/clippy/workspace tests. No filesystem
adapter change, so one shared Rust filesystem run; the explicitly requested
native pdf-export, script-check, publication-exit, title-page, typed-export
and empty-heading modes run on tmpfs and Btrfs after a fresh default release
build. Retain failed runs and strict owned-process crash audits. Update
owning capture docs, TODO/current-state and evidence; one task-ID commit on
main. Stop with decision-dependent work blocked; finish `git diff --check`.
