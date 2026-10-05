# Current state — refused-draft decomposition 2026-10-04 (owner host)

Date: 2026-10-04. Application: **babel**. Work on `main` over base `2456c2c`;
F1 and its predecessors are pushed at `origin/main`; F2 (`5a707b8`), F3
(`2456c2c`) and this session's F4 commits are local. No new push authorization. Owner delegated task
selection, wording and implementation decisions. M0–M5 and bounded M6-01
remain recorded complete. **M6-02, C1/F2 and Local v1 admission remain open.**
Host: owner laptop, uid 1000, Hyprland display, Btrfs repo, tmpfs `/tmp`.

## Previous session

**AUDIT-PARK-H-F3 — done.** [Brief](tasks/AUDIT-PARK-H-F3.md),
[evidence](test-evidence/AUDIT.md#audit-park-h-f3--actionable-capture-refusal-wording).

- A refused capture now tells the author that saving and recovery are paused,
  which row cannot be saved (`Row N`, element, quoted excerpt, or "an empty …
  row"), to change that row or Undo, and that Close session offers an
  emergency copy. The protection alert and an explicit Save use the same text.
- The row is the codec's, not a guess: `FountainEditError.edit` is the offset
  of the one submitted edit it cannot write (`src/domain/fountainCodec.ts`),
  `refusedRow` maps it to the live row (`src/editor/sourceBridge.ts`), and
  `writingFailureMessage` words it (`src/app/writingHelpers.ts`). A refusal
  about a whole context names no row. Codes, messages, the refused set and
  every captured byte are unchanged; no native, IPC or Rust change.
- The named row is the one Fountain cannot hold. That can be a stranded
  neighbour (the Dialogue below an emptied first line) rather than the row
  typed in; tests pin this as found.
- Red 11 fail / 3 pass, then green. Tracked frontend **1149/1149**, aggregate
  2012/2012 with archives, helper **16/16**, Rust **273/273**, browser and
  fresh release pass; binary `41fd4a0d…`. One incumbent test (`AUDIT-C02`
  alert clears) pinned the old raw text and was flipped deliberately.
- Native `empty-heading` mode with a new refused-row phase, tmpfs and Btrfs:
  **2/2 content, 2/2 strict**. The real app shows the exact alert, saves and
  journals nothing typed meanwhile, and resumes with nothing lost once the row
  changes. One run per filesystem; it does not dispose the F2 SIGABRT.

## AUDIT-PARK-H-F4 — decomposed, F4-01 claimed

[Brief and decomposition](tasks/AUDIT-PARK-H-F4.md). A wider probe (logs
`target/audit-park-h-f4/`) refused **229 of 848** single-row cases plus 47
structural ones. Ordinary typing such as a Dialogue row `(laughs) Oh no.`, or
bold on a Scene Heading, leaves the whole draft unsaved and unjournaled until
that row changes; F3 names the row.

- **F4-01** (claimed): commands refuse with a reason instead of creating a
  refused draft. **F4-02** (ready): two-space spelling for a speech row
  emptied while its speech continues.
- **F4-03, F4-04, F4-05** each wait on one owner decision recorded in the
  brief: un-protecting lines that open with a parenthesis, saving a typed
  element as Action or Dialogue with recovery-only intent, and bytes or
  metadata for emptied numbered or last-line rows.

## Prior queue complete

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

- **AUDIT-PARK-H-F4** above: F4-01 and F4-02 are agent work; F4-03 to F4-05
  need the owner decisions in the brief.
- D-07-F, PARK-T, capitals, D-05 cheap variant and D-09 page count remain
  separately scoped. Record a contract-safe decision/brief before fixing;
  pinned reproductions and requirement contradictions remain authoritative.
- Optional boneyard assessment cleanup requires separate brief and helper proof.
- Replace-All load flake remains unreproduced here. `pnpm test` includes 61
  archived copies; tracked count uses `pnpm exec vitest run --exclude 'target/**'`.
  Keep new tests outside target archives.
- `/tmp` has 20436 of 1048576 inodes free, held by retained native artifacts
  from this and earlier sessions. Nothing was removed; pruning is the owner's
  call (M6-03 copy/prune policy). Point `BABEL_NATIVE_IME_TEMP_ROOT` at a
  Btrfs task folder for native runs.

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

Finish AUDIT-PARK-H-F4-01, then F4-02. Ask the owner for the F4-03 to F4-05
decisions. No push. No Local v1/C1/F2/full-platform closure; DEV-02 remains
owner-only.
