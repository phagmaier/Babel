# Current state — refused-draft commands 2026-10-04 (owner host)

Date: 2026-10-04. Application: **babel**. Work on `main` over base `2456c2c`;
F1 and its predecessors are pushed at `origin/main`; F2 (`5a707b8`), F3
(`2456c2c`), the F4 brief (`a9287ed`) and this session's F4-01 commit are
local. No new push authorization. Owner delegated task selection, wording and
implementation decisions. M0–M5 and bounded M6-01 remain recorded complete.
**M6-02, C1/F2 and Local v1 admission remain open.**
Host: owner laptop, uid 1000, Hyprland display, Btrfs repo, tmpfs `/tmp`.

## This session

**AUDIT-PARK-H-F4 decomposed; F4-01 done.**
[Brief](tasks/AUDIT-PARK-H-F4.md),
[probe evidence](test-evidence/AUDIT.md#audit-park-h-f4--refused-drafts-probe-and-decomposition),
[F4-01 evidence](test-evidence/AUDIT.md#audit-park-h-f4-01--commands-refuse-instead-of-creating-a-refused-draft).

- Probe (logs `target/audit-park-h-f4/`): capture refused **229 of 848**
  single-row cases plus 47 structural ones. Ordinary typing such as a Dialogue
  row `(laughs) Oh no.` leaves the whole draft unsaved and unjournaled until
  that row changes; F3 names the row. The reach is wider than F3 listed.
- F4-01: formatting and conversion commands refuse with a reason instead of
  creating such a draft. Emphasis cannot begin a Scene Heading (selection or
  stored mark at the row start). A speech row cannot leave its speech while
  nonempty rows of it follow. A row cannot become an element that cannot hold
  its text. Each asks the codec about one row read alone
  (`spellsAlone` in `src/domain/fountainCodec.ts`, `rowSpells` in
  `src/editor/sourceBridge.ts`); no capture runs in a command.
- Unchanged: the codec's accepted and refused set, parser rules, messages,
  recovery metadata and every captured byte; no native, IPC or Rust change.
  Typed shapes stay refused by capture.
- Consequences to know: Select All plus bold is refused when the selection
  starts a Scene Heading. The Tab cycle stops at an element that cannot hold
  the row's text; Shift+Tab and the picker still work.
- Withdrawn: refusing Enter inside a Parenthetical. M3-05 documents that split
  as accepted with the emergency copy as its route, and three incumbent tests
  pin it. It is tracked in the brief's group F.
- Checks: red 5 fail / 6 pass, then green. An old-against-new differential over
  27,069 command cases shows 1,642 refused drafts closed, **0** commands that
  saved before now refused and 0 changed reasons. Tracked frontend
  **1159/1159**, aggregate 2022/2022 with archives, helper **16/16**, Rust
  **273/273**, browser and fresh release pass; binary `8b153538…`. One F3
  test that built its draft through the old conversion was flipped
  deliberately. No native drill: no saved byte or native boundary changed.

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

- **AUDIT-PARK-H-F4-02** (ready): spell a Dialogue or Parenthetical row
  emptied while its speech continues as Fountain's two-space dialogue line.
  It changes saved bytes, so it needs the capture-sensitive native modes.
- D-07-F, PARK-T, capitals, D-05 cheap variant and D-09 page count remain
  separately scoped. Record a contract-safe decision/brief before fixing;
  pinned reproductions and requirement contradictions remain authoritative.
- Optional boneyard assessment cleanup requires separate brief and helper proof.
- Replace-All load flake remains unreproduced here. `pnpm test` includes 61
  archived copies; tracked count uses `pnpm exec vitest run --exclude 'target/**'`.
  Keep new tests outside target archives.
- `/tmp` has 19,071 of 1,048,576 inodes free, held by retained native
  artifacts from earlier sessions. Nothing was removed; pruning is the owner's
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

Owner: answer F4-03, F4-04 and F4-05 in the brief. Next agent: AUDIT-PARK-H-F4-02,
or the decided sub-task. No push. No Local v1/C1/F2/full-platform closure;
DEV-02 remains owner-only.
