# Current state — emptied speech rows 2026-10-04 (owner host)

Date: 2026-10-04. Application: **babel**. Work on `main` over base `10650c0`,
which is even with `origin/main`; this session's F4-02 commit is local. No new
push authorization. Owner delegated task selection, wording and
implementation decisions. M0–M5 and bounded M6-01 remain recorded complete.
**M6-02, C1/F2 and Local v1 admission remain open.**
Host: owner laptop, uid 1000, Hyprland display, Btrfs repo, tmpfs `/tmp`.

## This session

**AUDIT-PARK-H-F4-02 done.**
[Brief](tasks/AUDIT-PARK-H-F4.md#f4-02-deliverable-and-acceptance),
[evidence](test-evidence/AUDIT.md#audit-park-h-f4-02--emptied-speech-rows-keep-their-speech).

- A Dialogue or Parenthetical row emptied while nonempty rows of its speech
  follow no longer pauses saving. It is written as Fountain's two-space
  dialogue line, which the break command already writes, so the rows below
  stay speech. The row's element and emptiness are recovery-only intent on
  that line; the file alone opens as a Dialogue holding two spaces.
- Paths: `src/domain/fountainCodec.ts` is the only product change. Tests:
  `tests/contract/emptied-speech-row.test.ts` (new), three flipped F3 examples
  in `capture-refusal.test.ts`, one mounted case in `WritingView.test.tsx`,
  phase F in `tests/native/writing-lifecycle/empty_heading.py`. Docs:
  document-model and editor-behavior.
- How: `replaceLines` uses the two-space line only for an edit it would
  otherwise refuse, so every capture that saved before keeps its bytes. The
  bridge, commands, parser classification, error codes and messages, the
  metadata schema, native, IPC and Rust are unchanged.
- Checks: red 32 fail / 21 pass, then 53/53. An old-against-new differential
  over 31,440 captures: **0** saved captures changed, **0** new refusals,
  **5,698** refused drafts now save. Tracked frontend **1195/1195**, aggregate
  2058/2058 with archives, helper **16/16**, Rust **273/273**, browser and
  fresh release pass; binary `89f90603…`. Native `empty-heading` with the new
  phase **2/2 content and strict** on tmpfs and Btrfs; `pdf-export`,
  `script-check`, `publication-exit`, `title-page`, `typed-export` **5/5** on
  Btrfs only (regression of unchanged paths; no Tier 3 trigger).
- Limits: the recovered reopen of this intent is contract-level only (the
  mode's one owned kill stays in phase A). An unchanged emptied row keeps its
  two spaces, so one live draft can save `two spaces, blank` after a recovery
  and `blank, blank` in one session; both recover alike. A draft with another
  unwritable row now names that row.
- Pinned, not fixed: an emptied row above a protected unclosed parenthesis
  stays refused with no row named (F4-03 shape). Base behaviour seen in
  passing: an empty Shot row recovers as Action.

## Waiting on the owner

Each decision is set out in the [brief](tasks/AUDIT-PARK-H-F4.md#decisions).

- **F4-03**: speech text that opens with a parenthesis. Saving it with
  recovery-only intent is ready to build, but alone it leaves the author's own
  line read-only after an ordinary reopen, because the parser protects such
  lines. Recommended together with un-protecting them.
- **F4-04**: typed text Fountain reads as other syntax. Recommended: save the
  exact text as Action or Dialogue, keep the typed element in recovery only,
  and tell the author. That is a saved-format choice and needs an ADR.
- **F4-05**: an emptied numbered heading, and a draft row emptied on a last
  line with no line ending.

## Prior queue complete

- **AUDIT-PARK-H-F4-01**: [brief](tasks/AUDIT-PARK-H-F4.md),
  [evidence](test-evidence/AUDIT.md#audit-park-h-f4-01--commands-refuse-instead-of-creating-a-refused-draft).
  Commands refuse with a reason instead of creating a refused draft.
- **AUDIT-PARK-H-F3**: [brief](tasks/AUDIT-PARK-H-F3.md),
  [evidence](test-evidence/AUDIT.md#audit-park-h-f3--actionable-capture-refusal-wording).
  The refusal alert names the row and how to resume; native `empty-heading`
  2/2 content and strict on tmpfs and Btrfs.
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

- **AUDIT-PARK-H-F4-03/04/05**: blocked on the decisions above; group F unscheduled.
- D-07-F, PARK-T, capitals, D-05 cheap variant and D-09 page count remain
  separately scoped. Record a contract-safe decision/brief before fixing;
  pinned reproductions and requirement contradictions remain authoritative.
- Optional boneyard assessment cleanup requires separate brief and helper proof.
- Replace-All load flake remains unreproduced here. `pnpm test` includes 61
  archived copies; tracked count uses `pnpm exec vitest run --exclude 'target/**'`.
  Keep new tests outside target archives.
- `/tmp` has 18,730 of 1,048,576 inodes free, held by retained native
  artifacts from earlier sessions and this one's tmpfs run. Nothing was removed; pruning is the owner's
  call (M6-03 copy/prune policy). Every Vitest run also leaves a cache
  directory there (21 random characters, one `client` folder); set `TMPDIR`
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

Owner: answer F4-03, F4-04 and F4-05 in the brief, and review the local F4-02
commit before any push. Next agent: the decided sub-task; no F4 agent work is
ready without a decision. No Local v1/C1/F2/full-platform closure; DEV-02
remains owner-only.
