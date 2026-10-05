# Current state — hidden-row capture fix 2026-10-04 (owner host)

Date: 2026-10-04. Application: **babel**. Work on `main` over base `86ce08d`;
three prior commits `c36c7d7`, `53a4b65`, `86ce08d` are unpushed over
`origin/main` `bb0fd45`; this session adds one F1 commit. **No push authorized.** M0–M5 and bounded M6-01
remain recorded complete. **M6-02, C1/F2 and Local v1 admission remain open.**
Host: owner laptop, uid 1000, Hyprland display, Btrfs repo, tmpfs `/tmp`.

## This session

**AUDIT-PARK-H-F1 — done.** [Brief](tasks/AUDIT-PARK-H-F1.md);
[evidence](test-evidence/AUDIT.md#audit-park-h-f1--new-hidden-row-capture).

- Product change only in `src/editor/sourceBridge.ts`: a new Note or Omitted
  material group in opened source gets a source insertion anchor, or owns
  contiguous old rows when mixed with new rows. Whole-region/neighbor checks
  and structural reconciliation remain checked; missing EOF break is owned.
- Red first: 27 intended failures. New byte/reopen/identity/Undo/Redo tests
  cover empty/populated, beginning/middle/end, unknown/protected neighbors,
  multiple groups and multiline regions; mounted UI checks save and journal.
  Zero-byte authoring, existing-row conversion and existing Note edits stay
  covered. Focused checks pass; frontend **1125/1125 tracked**, aggregate
  **1988/1988 with archives**, helper **16/16**, browser and Rust **273/273** pass.
- Native `empty_heading.py` phase D now checks both Note and Omitted material:
  empty/populated/later text saved and journaled, Undo, exact reopen and close.
  A-C retain the empty-heading finding and emergency draft-bundle path.
- Fresh release `a5b39250…`: all six named native modes verified on tmpfs and
  Btrfs with clean crash audits. First matrix 10/12; the two phase-D reopen
  failures came from rewriting a managed file after Undo. Fresh-path reopen
  correction passed 2/2. Failed runs retained; no product change for the retry.
- Native launcher exhausted `/tmp` inodes. Only this session's IME wrapper
  directories moved into `target/audit-park-h-f1/retained-ime-*`; original paths
  are symlinks. All artifacts retained. No F1 native check remains pending.
- No write-service, Rust, IPC, codec-classification, helper/profile/font/pin
  changes. Owner decision tasks remain blocked; no M6/M7 work.

## Prior queue complete

- **AUDIT-D04-R3**: [brief](tasks/AUDIT-D04-R3.md),
  [evidence](test-evidence/AUDIT.md#audit-d04-r3--remaining-renderercodec-reading-differences).
  Pinned parser mirror gates remaining role/scene-number disagreements;
  corpus 117, 70,000-source differential clean, 16/16 injected faults detected.
- **AUDIT-D07-N**: [brief](tasks/AUDIT-D07-N.md),
  [evidence](test-evidence/AUDIT.md#audit-d07-n--native-typed-export-drill).
  Native typed scene save/export on tmpfs and Btrfs; Undo/Redo JSDOM-only.
- **AUDIT-PARK-H**: [brief](tasks/AUDIT-PARK-H.md),
  [evidence](test-evidence/AUDIT.md#audit-park-h--empty-scene-heading-capture).
  Empty Scene Heading stops all capture until text; elsewhere edits can be
  lost after owned SIGKILL. Close refuses; draft bundle retains unsaved rows.
  Found new hidden-row bug H1, now handled by F1; historical evidence retained.
- Prior tree: frontend 1100/1100, helper 16/16, browser/Rust gates pass;
  native six named modes on both filesystems with clean crash audits. Those
  results are snapshot-specific; fresh sourceBridge gates are recorded above.

## Open — owner decisions or separate tasks

- **AUDIT-PARK-H-F2**: investigate whether retaining empty Scene Heading intent
  extends into recovery metadata/Rust; report before any change. Owner chooses
  a fix or clearer alert. **F3**: owner supplies capture-alert wording.
- **AUDIT-D07-F**: empty speech Enter separator, Note exit at document end,
  Page Break caret before `===`, empty-cue suggestions intercept element Tab.
- **AUDIT-PARK-T**: replace-all protection, 256 rolling-snapshot cap without
  automatic pruning, duplicate draft after a failed resume.
- **Capitals**: keep/drop export guards, or show capitals in editor and PDF.
- D-05 cheap variant and D-09 page count wait on the owner answers.
- Optional separate task: existing export limitations beside boneyards
  over-report with old wording; helper proof required before removing any.
- Replace-All load flake (retained cloud 1/10): not reproduced on this host.
- `pnpm test` includes 61 archived copies under `target/`; tracked count uses
  `pnpm exec vitest run --exclude 'target/**'`. No scratch tests under target.

## Retained findings and limits

Details remain in [audit evidence](test-evidence/AUDIT.md). AUDIT-D03 owned
WebKit SIGABRT **477772/start 4562349**, **501063/start 4636728**; AUDIT-D02
SIGSEGV **335923/start 3571811**, **353321/start 3701248**, SIGABRT
**413296/start 3989180**; AUDIT-NATIVE-R1 SIGSEGV **251383/start 3043549**.
No cause or C1/F2 disposition. Earlier failures stay historical evidence;
frozen root `AUDIT.md` is unchanged. Full native keyboard/a11y/IME, C356
SELinux/native highlight input and C04 unreproduced cache failure stay open.
[M6-02](tasks/M6-02.md), [matrix](test-evidence/M6-02-matrix.md),
[review](reviews/2026-10-03-m6-02-persistence-review.md) and
[evidence](test-evidence/M6.md#m6-02--persistence-interruption-and-operation-investigation)
retain Save As/IME, shared-store lease scope and Btrfs SIGABRT after parent
SIGKILL. M6-03 copy/prune and capture-failure bundle policy open. A copied
native binary must resolve helper resources as documented in the
[native guide](../tests/native/writing-lifecycle/README.md).

## Next action

Agent: F1 and its native gap are complete; stop after the one task-ID commit.
Next queued F2/F3, D-05 and D-09 require owner answers. Optional boneyard
assessment cleanup needs a separate brief and helper proof before removing
limitations. Prior typed-scene native Undo/Redo remains unverified.
Work on `main`; no push. No Local v1/C1/F2/full-platform closure; DEV-02 is
owner-only. No personal manuscript/credentials/upload work.
