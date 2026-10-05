# Current state — empty-heading intent repair 2026-10-04 (owner host)

Date: 2026-10-04. Application: **babel**. Work on `main` over base `fc43779`;
F1 and its predecessors are pushed at `origin/main`; this session adds one
local F2 commit. No new push authorization. Owner delegated task selection,
wording and implementation decisions. M0–M5 and bounded M6-01 remain recorded
complete. **M6-02, C1/F2 and Local v1 admission remain open.**
Host: owner laptop, uid 1000, Hyprland display, Btrfs repo, tmpfs `/tmp`.

## This session

**AUDIT-PARK-H-F2 — bounded content repair done; crash finding retained.**
[Brief](tasks/AUDIT-PARK-H-F2.md),
[pre-edit reach report](reviews/2026-10-04-empty-heading-intent.md),
[evidence](test-evidence/AUDIT.md#audit-park-h-f2--empty-scene-heading-recovery-intent).

- Product changes in `src/domain/fountainModel.ts`, `fountainCodec.ts` and
  `src/application/editorMetadata.ts`. Empty unnumbered Scene Heading rows
  capture as physical blanks with exact-source sparse recovery intent. Edits
  elsewhere save and journal; explicit recovery restores the type. Source-only
  reopen shows a blank. No native service/format/IPC or parser classification
  change. Numbered/whitespace/row-erasing EOF and zero-byte placeholder limits
  stay explicit in owning docs; malformed/protected guards remain intact.
- Red before fix: 9 contract failures and 2 mounted/choice failures. Focused
  280/280, tracked frontend **1135/1135**, aggregate 1998/1998 with archives,
  helper **16/16**, Rust **273/273**, browser and fresh default release pass.
  Binary `50ec9daa…`; no helper/profile/font/pin or fixture/root AUDIT.md edits.
- Six named native modes on tmpfs/Btrfs: primary **12/12 content, 11/12 strict**.
  Empty-heading proves save/journal, owned-kill/explicit-resume, retained original
  checkpoint, completion, newer Undo/Redo versions and ordinary close; F1 hidden
  rows remain covered. Initial Redo key-sequence failures retained/corrected.
- Btrfs owned **WebKit SIGABRT 1134510/start 10372570** in the first owned-kill
  session; core/info/journal/ledger retained. Frozen F1 binary is byte-identical
  to its prior release `a5b39250…`; control 1/1 strict and candidate replay 1/1
  strict. Neither explains or disposes the abort. Original strict-failed report
  stays failed; no cause/regression/C1/F2 claim. Including the replay, twelve
  selected passing roots audit 124 frames, 52 snapshots, 2 safety refs and 18
  prior sources. No gate is relabeled by a clean rerun.
- Native IME wrapper now accepts a task-owned Btrfs temp root to avoid retained
  tmpfs inode pressure, with the same private isolation mounts. Old artifacts
  stay untouched. Frozen control's frontend test copies retain bytes with a
  `.frozen` suffix so future Vitest discovery does not gain another archive.

## Prior queue complete

- **AUDIT-PARK-H-F1**: [brief](tasks/AUDIT-PARK-H-F1.md),
  [evidence](test-evidence/AUDIT.md#audit-park-h-f1--new-hidden-row-capture).
  Hidden-row capture and Omitted-material native gap complete at `fc43779`.
- **AUDIT-D04-R3**: [brief](tasks/AUDIT-D04-R3.md),
  [evidence](test-evidence/AUDIT.md#audit-d04-r3--remaining-renderercodec-reading-differences).
  Parser mirror/corpus/differential guards retained.
- **AUDIT-D07-N**: [brief](tasks/AUDIT-D07-N.md),
  [evidence](test-evidence/AUDIT.md#audit-d07-n--native-typed-export-drill).
  Typed-scene native save/export complete; its Undo/Redo remains JSDOM-only.
- **AUDIT-PARK-H**: [brief](tasks/AUDIT-PARK-H.md),
  [historical evidence](test-evidence/AUDIT.md#audit-park-h--empty-scene-heading-capture).
  Original capture/data-loss/bundle observations preserved; F1/F2 fix named cases.

## Open — agent work and separate decisions

- **AUDIT-PARK-H-F3 is next and ready**: write a brief and choose actionable
  capture-refusal wording for remaining unsupported drafts. Owner delegated
  wording/implementation decisions; no need to wait for supplied copy.
- D-07-F, PARK-T, capitals, D-05 cheap variant and D-09 page count remain
  separately scoped. Record a contract-safe decision/brief before fixing;
  pinned reproductions and requirement contradictions remain authoritative.
- Optional boneyard assessment cleanup requires separate brief and helper proof.
- Replace-All load flake remains unreproduced here. `pnpm test` includes 61
  archived copies; tracked count uses `pnpm exec vitest run --exclude 'target/**'`.
  Keep new tests outside target archives.

## Retained findings and limits

[audit evidence](test-evidence/AUDIT.md) retains prior WebKit findings:
D03 SIGABRT **477772/start 4562349**, **501063/start 4636728**; D02 SIGSEGV
**335923/start 3571811**, **353321/start 3701248**, SIGABRT **413296/start 3989180**;
NATIVE-R1 SIGSEGV **251383/start 3043549**. New F2 SIGABRT is recorded above.
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

This continuation stops after one F2 task-ID commit on main. Next agent takes
F3's bounded wording task, with red focused evidence and appropriate check tier.
No push. No Local v1/C1/F2/full-platform closure; DEV-02 remains owner-only.
