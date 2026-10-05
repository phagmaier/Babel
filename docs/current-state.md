# Current state — other-syntax fallback 2026-10-05 (owner host)

Date: 2026-10-05. Application: **babel**. Work on `main` over base `3d55fca`.
`origin/main` is at `10650c0`; the F4-02, F4-03 and F4-04 commits are local
(the last pending). No new push authorization. Owner delegated task
selection, wording and implementation decisions. M0–M5 and bounded M6-01
remain recorded complete. **M6-02, C1/F2 and Local v1 admission remain
open.** Host: owner laptop, uid 1000, Hyprland display, Btrfs repo, tmpfs
`/tmp`.

## This session

**Owner decisions taken 2026-10-04** for F4-03, F4-04 and F4-05, recorded in
the [brief](tasks/AUDIT-PARK-H-F4.md#decisions). **F4-04 done**, with its
deliverable section in the brief and [ADR 0042](decisions/0042-other-syntax-fallback-container.md)
written before code.

**AUDIT-PARK-H-F4-04 done.**
[Deliverable](tasks/AUDIT-PARK-H-F4.md#f4-04-deliverable-and-acceptance),
[evidence](test-evidence/AUDIT.md#audit-park-h-f4-04--typed-text-fountain-reads-as-other-syntax).

- Typed text Fountain reads as other syntax saves with its exact bytes
  where those bytes are one editable Action line: headings (`'TIL DAWN`,
  `x #1#`), characters (`BOB ^`), transitions (`CUT<`) and Dialogue
  starting with `!` (the only Action-forcing marker). The typed element is
  recovery-only intent; `DraftKind` gains `transition`, schema version
  unchanged. Each such row carries one advisory SC009 naming it.
- A `!` that would end a speech mid-list refuses at its own offset, naming
  the typed row; untouched following rows are never rewritten. Marker texts
  that would reopen as a cue, heading, section or other restructuring
  element stay refused, as do `{{`/hidden/raw shapes and F4-03/group F
  parentheses. Three F3 tests moved their refusal example (`x #1#` to
  `# hey`); no command outcome changed.
- Paths: `src/domain/fountainCodec.ts`, `src/domain/scriptCheck.ts`,
  `src/app/ScriptCheckPanel.tsx`, `src/domain/fountainModel.ts`,
  `src/application/editorMetadata.ts`. Tests:
  `tests/contract/other-syntax-fallback.test.ts` (new, 61 cases), one
  mounted case in `WritingView.test.tsx`, phase H in
  `tests/native/writing-lifecycle/empty_heading.py`. Docs: brief, ADR-0042,
  document-model, editor-behavior, native README.
- Checks: red on base product files 31 fail / 110 pass, same command on the
  fix 141/141. Differential over 690 captures: **0** new refusals, **0**
  changed bytes or line facts, **28** refused drafts now save (each with
  intent and exact bytes). Tracked frontend **1283/1283**, aggregate
  3368/3368 with archives, helper **16/16**, Rust **273/273**, browser and
  fresh release pass (binary `68ebca11…`; post-hoc rebuild differs by build
  timestamps only, sources cmp-identical). Native `empty-heading` with
  phase H **2/2 content and strict** on tmpfs and Btrfs; `pdf-export`,
  `script-check`, `publication-exit`, `title-page`, `typed-export` **5/5**
  on Btrfs only (regression of unchanged paths; no Tier 3 trigger).
- Limits: recovered reopen of the new intents is contract-level only.
  Native phase H covers a Dialogue fallback intent; Scene Heading,
  Character and Transition intents have contract plus mocked-journal
  coverage only (see evidence for the possible follow-up).
  Reopened without recovery the row is Action. A `!` row orphans its cue
  (SC001 warns) and export review still blocks on the broken speech
  paragraph (SC005 pair), as with F4-03 rows. Browser gate first failed
  cold (optimizer cache deleted) on base and fix alike, then passed warm;
  native runs need the owner display variables, failing before any phase
  without them.

## Ready next

- **F4-05** (decided): a row emptied on a last line with no line ending
  gains a line ending in the file's own convention. An emptied numbered
  heading stays refused. Needs its deliverable section in the brief before
  code.

## Prior queue complete

- **AUDIT-PARK-H-F4-03**: [evidence](test-evidence/AUDIT.md#audit-park-h-f4-03--speech-that-opens-with-a-parenthesis).
  Speech opening with a parenthesis saves as typed; closed-parenthetical
  lines are editable on open.
- **AUDIT-PARK-H-F4-02**: [evidence](test-evidence/AUDIT.md#audit-park-h-f4-02--emptied-speech-rows-keep-their-speech).
  A speech row emptied above the rest of its speech saves as the two-space
  dialogue line with recovery-only intent.
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
  D-07-F, PARK-T, capitals, D-05 cheap variant and D-09 page count remain
  separately scoped with pinned reproductions authoritative; boneyard
  cleanup needs its own brief and helper proof.
- Replace-All load flake remains unreproduced here. `pnpm test` includes 61
  archived copies; tracked count uses `pnpm exec vitest run --exclude 'target/**'`.
  Keep new tests outside target archives.
- `/tmp` has 18,350 of 1,048,576 inodes free, held by retained native
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

Owner: review the local F4-02, F4-03 and F4-04 commits before any push.
Next agent: **F4-05**, starting with its deliverable section, then code. No
Local v1/C1/F2/full-platform closure; DEV-02 remains owner-only.
