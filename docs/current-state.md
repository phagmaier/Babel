# Current state — audit session 2026-10-04 (cloud, no display)

Date: 2026-10-04. Application: **babel**. Base `718c6e8`. Session commits on
branch `claude/nifty-carson-adcfu6` (owner override: one commit per task).
M0–M5 and bounded M6-01 work remain recorded complete. **M6-02, C1/F2 and
Local v1 admission remain open.**

## This session

Host: Linux container, uid 0, no display, `target/` not in git (no retained
artifacts, frozen binaries or IME prerequisites).
[Baseline](test-evidence/AUDIT.md#session-baseline--cloud-container-2026-10-04):
frontend 927/927, browser pass (orphaned Vite stopped by hand), helper 14/14,
fmt/clippy pass, Rust 272/273 (root-only `safe_open` permission failure).

Queue: AUDIT-D07 → AUDIT-D04-R2 → AUDIT-PARK → AUDIT-D04-R1 (owner-approved rule).

- **AUDIT-D07 complete.** [Brief](tasks/AUDIT-D07.md),
  [evidence](test-evidence/AUDIT.md#audit-d07--typed-scene-oracle). Typed-scene
  oracle: `tests/contract/typed-scene.test.ts` +
  `fixtures/assessment/typed-scene.json` +
  `test_helper.py::test_typed_scene_oracle`. Four findings pinned and tracked as
  **AUDIT-D07-F** in TODO (owner decisions; none fixed).
- **AUDIT-D04-R2 complete.** [Brief](tasks/AUDIT-D04-R2.md),
  [evidence](test-evidence/AUDIT.md#audit-d04-r2--renderercodec-disagreement-sweep).
  Corpus 27 → 68 cases; 18 clean-but-different cases now blocking SC005 in
  `src/domain/exportAssessment.ts` (assessment only). Capitals in headings and
  forced transitions are reported per SPEC S09.2; owner may relax that guard.
- **AUDIT-PARK complete.** [Brief](tasks/AUDIT-PARK.md),
  [evidence](test-evidence/AUDIT.md#audit-park--confirm-first-parking-verdicts).
  Every parked item has a test and verdict; confirmed save/recovery/snapshot
  items are tracked as **AUDIT-PARK-T** (D-05 protection and snapshot cap;
  duplicate draft after a failed resume). T-05 not reproduced in 40 runs; D02's
  retained Replace-All test failure reproduced once in 10 loaded runs, cause
  not isolated, no text lost.

## Needs native rerun (owner, with a display)

- D-07 typed-export case: no drill mode exists; write one (type the fixture
  scene, Export PDF, `pdftotext`) and run it on tmpfs/Btrfs.
- D04-R2 assessment change: `pdf-export`, `script-check` and
  `publication-exit` modes (binary in place beside its helper), tmpfs/Btrfs.
- Rust `cargo test --workspace` as a non-root user (baseline root failure).

## Retained findings and limits (detail in linked evidence)

**AUDIT-D04 complete** (`718c6e8`): non-blocking omission summary, inline
hidden spans read through for assessment, renderer-disagreement guards;
[evidence](test-evidence/AUDIT.md#audit-d04--non-blocking-omissions-and-inline-note-assessment).
Native 6/6 strict pdf-export/script-check/publication-exit and 4/4
daily-session/commands there. Harness fact: a copied binary finds `pdf-helper`
only in a folder ending `target/release` that holds `.cargo-lock`
([README](../tests/native/writing-lifecycle/README.md)).

**AUDIT-D03 complete** (`21a6180`, `02dc86c`); open: owned WebKit SIGABRT
`free(): corrupted unsorted chunks` **477772/start 4562349** and **501063/start
4636728** (cores retained, no cause); the actions block above the editor is
still tall. [A](test-evidence/AUDIT.md#audit-d03a--on-screen-screenplay-element-styling),
[B](test-evidence/AUDIT.md#audit-d03b--writing-layout-shell).

**AUDIT-D02 complete** (`ffede1d`): strict identical-latest reopen, hash-bound
Keep, plain review; no automatic adoption/retirement.
[Evidence](test-evidence/AUDIT.md#audit-d02--safe-reopen-reconciliation-and-recovery-choice).
Retained owned WebKit crashes: Btrfs SIGSEGV **335923/start 3571811**, tmpfs
SIGSEGV **353321/start 3701248**, Btrfs SIGABRT **413296/start 3989180**; no
cause, correction or C1/F2 disposition. D02 also retains a combined frontend
Replace-All assertion failure that did not reproduce in isolation.

**AUDIT-NATIVE-R1** (`e595393`): Save-first F6, read-only Mozc bind, owned GTK
menu traversal; owned Btrfs SIGSEGV **251383/start 3043549** retained. Broader
F6 and full native keyboard/a11y/IME remain unverified.
[Evidence](test-evidence/AUDIT.md#audit-native-r1--f6-focus-and-private-mozc).

**AUDIT-D06** (`fcfade8`) and **AUDIT-SIMP-F** (`200e375`) complete; earlier
native failures remain historical evidence. Wave 0–3 closures and failures stay
in TODO and the linked audit evidence, including SLP-B's owned WebKit crash.
`AUDIT.md` stays frozen. C356 enforcing SELinux/native highlight input is
unverified; C04's unreproduced cache failure remains retained.

[M6-02](tasks/M6-02.md), [matrix](test-evidence/M6-02-matrix.md),
[review](reviews/2026-10-03-m6-02-persistence-review.md) and
[evidence](test-evidence/M6.md#m6-02--persistence-interruption-and-operation-investigation)
retain original Save As/IME findings, shared-store lease scope and owned Btrfs
SIGABRT after parent SIGKILL. Intact bytes/clean reruns do not close C1/F2.
M6-03 independent copy/prune and capture-failure bundle policy remain open.

## Next action and stopping point

Continue the session queue with AUDIT-D04-R1. Remaining accepted DESIGN items
without a brief: D-05 cheap variant and D-09 page count. Run
publication-dependent native modes with `target/release` in place or a
helper-capable frozen layout. Never substitute injected composition for
genuine IME. Unset `FORCE_COLOR` for `pnpm test:browser`. No full
native/a11y/keyboard, SELinux, M6-02, C1/F2 or Local v1 closure.
[M6-02-R1](tasks/M6-02-R1.md) and [M6-01-R1](tasks/M6-01-R1.md) remain separate;
DEV-02 is owner-only. No M6/M7 work, private-engine shipping, personal
manuscript/credentials/upload work.
