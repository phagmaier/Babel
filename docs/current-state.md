# Current state — speech parenthesis rows 2026-10-04 (owner host)

Date: 2026-10-04. Application: **babel**. Work on `main` over base `15d5da8`.
`origin/main` is at `10650c0`; the F4-02 and F4-03 commits are local. No new
push authorization. Owner delegated task selection, wording and
implementation decisions. M0–M5 and bounded M6-01 remain recorded complete.
**M6-02, C1/F2 and Local v1 admission remain open.**
Host: owner laptop, uid 1000, Hyprland display, Btrfs repo, tmpfs `/tmp`.

## This session

**Owner decisions taken 2026-10-04** for F4-03, F4-04 and F4-05, recorded in
the [brief](tasks/AUDIT-PARK-H-F4.md#decisions).

**AUDIT-PARK-H-F4-03 done.**
[Deliverable](tasks/AUDIT-PARK-H-F4.md#f4-03-deliverable-and-acceptance),
[evidence](test-evidence/AUDIT.md#audit-park-h-f4-03--speech-that-opens-with-a-parenthesis).

- Speech that opens with a parenthesis no longer pauses saving. Dialogue
  `(laughs) Oh no.` is ordinary Dialogue. A Dialogue row `(laughs)` and a
  Parenthetical `(beat) x` are written exactly and keep their element as
  recovery-only intent; the file alone opens as Fountain reads them.
- Opening a file: a speech or Action line that begins with a closed
  parenthetical is editable where it was read-only. Bytes, element and text
  are unchanged. A parenthesis that never closes stays protected.
- Paths: `src/domain/fountainCodec.ts`; one rule sentence in
  `src/app/writingHelpers.ts`. Tests: `tests/contract/speech-parenthesis.test.ts`
  (new), one mounted case in `WritingView.test.tsx`, phase G in
  `tests/native/writing-lifecycle/empty_heading.py`. Docs: document-model,
  editor-behavior, native README.
- The F3 alert examples moved: `(beat) x` now saves, so ten incumbent cases
  and native phase E use text before a Parenthetical's opening parenthesis
  (`x (beat)`), which stays refused. Its alert now says "A Parenthetical
  starts with an opening parenthesis." The codec refusal keeps `invalid-edit`
  with the message "Parenthetical must begin with an opening parenthesis".
- Checks: red 22 fail / 3 pass, final tests on the base 30 fail, then 79/79.
  Old-against-new differential over 27,260 captures: **0** new refusals,
  **0** changed bytes or line facts, **3,139** refused drafts now save, 1,949
  save the same bytes with a row now editable; no typed row reopens
  read-only. Tracked frontend **1221/1221**, aggregate 2084/2084 with
  archives, helper **16/16**, Rust **273/273**, browser and fresh release
  pass; binary `2bdf3fcf…`. Native `empty-heading` with the new phase **2/2
  content and strict** on tmpfs and Btrfs; `pdf-export`, `script-check`,
  `publication-exit`, `title-page`, `typed-export` **5/5** on Btrfs only
  (regression of unchanged paths; no Tier 3 trigger).
- Limits: recovered reopen of the new intents is contract-level only. Export
  review still blocks on a speech line that starts with `(` (SC005, print
  profile reading); Script Check no longer lists the unprotected line. Join,
  hard-break and conversion commands keep their parenthesis refusals.

## Ready next

- **F4-04** (decided): save typed text Fountain reads as other syntax as
  Action or Dialogue, typed element in recovery only, non-blocking notice
  naming the row. Needs its deliverable section in the brief and an ADR for
  the saved-format choice before code.
- **F4-05** (decided): add a line ending in the file's own convention when a
  row is emptied on an unterminated last line. An emptied numbered heading
  stays refused.

## Prior queue complete

- **AUDIT-PARK-H-F4-02**: [evidence](test-evidence/AUDIT.md#audit-park-h-f4-02--emptied-speech-rows-keep-their-speech).
  A Dialogue or Parenthetical row emptied above the rest of its speech saves
  as the two-space dialogue line with recovery-only intent.
- **AUDIT-PARK-H-F4-01**: [brief](tasks/AUDIT-PARK-H-F4.md),
  [evidence](test-evidence/AUDIT.md#audit-park-h-f4-01--commands-refuse-instead-of-creating-a-refused-draft).
  Commands refuse with a reason instead of creating a refused draft.
- **AUDIT-PARK-H-F3**: [brief](tasks/AUDIT-PARK-H-F3.md),
  [evidence](test-evidence/AUDIT.md#audit-park-h-f3--actionable-capture-refusal-wording).
  The refusal alert names the row and how to resume.
- **AUDIT-PARK-H-F2**: [brief](tasks/AUDIT-PARK-H-F2.md),
  [evidence](test-evidence/AUDIT.md#audit-park-h-f2--empty-scene-heading-recovery-intent).
  Empty unnumbered headings capture as blanks with recovery intent. Primary
  native 12/12 content, 11/12 strict; owned Btrfs **WebKit SIGABRT
  1134510/start 10372570** retained without cause or disposition.
- **AUDIT-PARK-H-F1**: [brief](tasks/AUDIT-PARK-H-F1.md),
  [evidence](test-evidence/AUDIT.md#audit-park-h-f1--new-hidden-row-capture).
  Hidden-row capture complete at `fc43779`.
- **AUDIT-D04-R3**, **AUDIT-D07-N**, **AUDIT-PARK-H**: briefs under
  [tasks](tasks/AUDIT-PARK-H.md); evidence sections in
  [AUDIT.md](test-evidence/AUDIT.md). D07-N Undo/Redo remains JSDOM-only.

## Open — agent work and separate decisions

- **AUDIT-PARK-H-F4** group F is unscheduled; the F3 alert names the row.
- D-07-F, PARK-T, capitals, D-05 cheap variant and D-09 page count remain
  separately scoped. Record a contract-safe decision/brief before fixing;
  pinned reproductions and requirement contradictions remain authoritative.
- Optional boneyard assessment cleanup requires separate brief and helper proof.
- Replace-All load flake remains unreproduced here. `pnpm test` includes 61
  archived copies; tracked count uses `pnpm exec vitest run --exclude 'target/**'`.
  Keep new tests outside target archives.
- `/tmp` has 18,352 of 1,048,576 inodes free, held by retained native
  artifacts from earlier sessions and this one's tmpfs run. Nothing was
  removed; pruning is the owner's call (M6-03 copy/prune policy). Set `TMPDIR`
  to a task folder under `target/` for Vitest runs, and point
  `BABEL_NATIVE_IME_TEMP_ROOT` at a Btrfs task folder for native runs.

## Retained findings and limits

[audit evidence](test-evidence/AUDIT.md) retains prior WebKit findings:
D03 SIGABRT **477772/start 4562349**, **501063/start 4636728**; D02 SIGSEGV
**335923/start 3571811**, **353321/start 3701248**, SIGABRT **413296/start 3989180**;
NATIVE-R1 SIGSEGV **251383/start 3043549**; F2 SIGABRT as above.
No cause or C1/F2 disposition. Full native keyboard/a11y/IME, C356 enforcing
SELinux/native highlight input and C04 unreproduced cache failure remain open.
[M6-02](tasks/M6-02.md), [matrix](test-evidence/M6-02-matrix.md),
[review](reviews/2026-10-03-m6-02-persistence-review.md) and
[evidence](test-evidence/M6.md#m6-02--persistence-interruption-and-operation-investigation)
retain Save As/IME, shared-store lease scope and parent-SIGKILL Btrfs abort.
M6-03 copy/prune and capture-failure bundle policy remain open. Copied binaries
must preserve helper-resource layout from the
[native guide](../tests/native/writing-lifecycle/README.md).

## Next action

Owner: review the local F4-02 and F4-03 commits before any push. Next agent:
**F4-04**, starting with its deliverable section and ADR, then F4-05. No Local
v1/C1/F2/full-platform closure; DEV-02 remains owner-only.
