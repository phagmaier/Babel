# AUDIT-PARK-H-F4-PREFIX — Parenthetical prefix feasibility

Selected 2026-10-05 from clean `18c4314` on `main`, under the owner's delegated
decision authority. Status: **complete; mechanism remains blocked as-is**. This is the one narrowed investigation
proposed by the [F4 review](../test-evidence/AUDIT-PARK-H-F4-REVIEW.md#concrete-narrowed-follow-up).
F4-01–05 and the review are complete; no native prerequisite is needed here.
[Evidence and correction outline](../test-evidence/AUDIT-PARK-H-F4-PREFIX.md).

## Question and deliverable

Can the authored bytes `x (beat)` and the typed Parenthetical intent coexist
through the existing codec/recovery mechanism without parser, schema or neighbor
changes? Produce literal source-only and recovery results, identify every gate
that prevents capture, and leave a concrete feasible-or-blocked correction outline.
Ordinary prefix typing currently pauses protection of the whole draft, making
this a higher-value independent question than new corpus or blocked native work.
Authority: SPEC S03/S05.5/S07.1, [document model](../document-model.md#m3-02-production-codec-foundation),
[ADR 0027](../decisions/0027-uncapturable-draft-preservation.md).

## Acceptance and scope

1. Compare two literal sources: ordinary LF and BOM/CRLF with an untouched
   unknown region. Show byte identity, physical row/element/text, cue ownership,
   following speech and all unaffected line facts. Use an explicit Dialogue edit
   only as a control, never as an automatic conversion or product repair.
2. Demonstrate current Parenthetical capture refusal and editor Undo/Redo.
   Construct exact-source, hash-bound existing `parenthetical` intent; distinguish
   envelope/hash verification from codec compatibility and actual restored intent.
   Include one existing supported trailing-text Parenthetical control.
3. Retain a named investigation reproducer outside default tests/CI. Its green
   assertions characterize the current refusal; they do not claim repaired save
   or journal protection. Rerun existing prefix codec and mounted refusal cases.
4. Explain whether an unchanged schema/parser suffices structurally, what narrow
   behavior/guard changes a future repair needs, and what evidence remains absent.
   A static candidate is not proven production feasibility or native acceptance.
5. Preserve all tracked bytes outside the seven editable paths below and the
   prior review's 11,754 retained F4 artifacts. Update handoff/tracker, commit
   locally with the task ID, and stop; F4 remains open without retirement.

Editable paths: this brief, `docs/test-evidence/AUDIT-PARK-H-F4-PREFIX.md`,
`tests/investigation/f4-prefix.test.ts`, `docs/tasks/AUDIT-PARK-H-F4.md`,
`docs/tasks/AUDIT-TRACKER.md`, `TODO.md`, `docs/current-state.md`.
No product/guard/parser/schema/saved-format implementation; Enter splitting,
Section/Synopsis or dual-pair work; new corpus, native trial/repeat, snapshot,
register change, crash closure, limitation acceptance, pruning, push/tag/amend.
All owner-only M6/DEV-02/PARK-T/D07-F blocks remain binding.

## Checks and stop

Tier 1 report plus investigation-test lint/typecheck; no changed product boundary.
Use `mise exec node@26.7.0 pnpm@11.22.0 --` for pinned pnpm and task-local
`TMPDIR=$PWD/target/audit-park-h-f4-prefix/tmp`. Exact focused commands:

```sh
pnpm exec vitest run --config tests/investigation/vitest.config.ts tests/investigation/f4-prefix.test.ts
pnpm exec vitest run tests/contract/speech-parenthesis.test.ts tests/contract/capture-refusal.test.ts tests/ui/WritingView.test.tsx -t 'AUDIT-PARK-H-F4-03|AUDIT-PARK-H-F3'
```

Run `pnpm lint`, `pnpm typecheck`, touched-file `pnpm exec prettier --check`,
`python3 tools/check-links.py` on the six editable Markdown paths,
`pnpm check:guidance`, `git diff --check`, and
`python3 target/audit-park-h-f4-prefix/verify_preservation.py`.
Retain command argv/results/logs and baseline manifest under that output root.
No red-before-fix run: this task characterizes an open defect and changes no
behavior. Skip builds, differential/helper/renderer gates, browser, Rust/matrix
and native: unchanged executable boundaries, no new save/journal/native claim.
Stop after report, handoff and one local commit; no subsequent task selected.
