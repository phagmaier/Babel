# Current state — audit session 2026-10-04 (cloud, no display)

Date: 2026-10-04. Application: **babel**. Base `718c6e8`. Session commits on
branch `claude/nifty-carson-adcfu6` (owner override: one commit per task).
M0–M5 and bounded M6-01 work remain recorded complete. **M6-02, C1/F2 and
Local v1 admission remain open.**

## This session — stopped after the queue

Host: Linux container, uid 0, no display, `target/` not in git (no retained
artifacts, frozen binaries or IME prerequisites).
[Baseline](test-evidence/AUDIT.md#session-baseline--cloud-container-2026-10-04):
frontend 927/927, browser pass (orphaned Vite stopped by hand), helper 14/14,
fmt/clippy pass, Rust 272/273 (root-only `safe_open` permission failure).
Final: frontend **999/999**, helper **15/15**, browser pass; no Rust change.

- **AUDIT-D07 complete** ([brief](tasks/AUDIT-D07.md),
  [evidence](test-evidence/AUDIT.md#audit-d07--typed-scene-oracle)): typed-scene
  oracle from zero bytes through the mounted editor with live completion, and
  the same hand-written fixture checked by the pinned renderer. Findings F1–F4
  pinned as found and tracked as **AUDIT-D07-F** (owner decisions).
- **AUDIT-D04-R2 complete** ([brief](tasks/AUDIT-D04-R2.md),
  [evidence](test-evidence/AUDIT.md#audit-d04-r2--renderercodec-disagreement-sweep)):
  corpus 27 → 68 cases; 18 clean-but-different cases now blocking SC005
  (assessment only). Capitals in headings and forced transitions are reported
  per SPEC S09.2; the owner may treat them as print style instead.
- **AUDIT-PARK complete** ([brief](tasks/AUDIT-PARK.md),
  [evidence](test-evidence/AUDIT.md#audit-park--confirm-first-parking-verdicts)):
  every parked item has a test and verdict; confirmed save/recovery/snapshot
  items are tracked as **AUDIT-PARK-T**. T-05 not reproduced in 40 runs; D02's
  retained Replace-All test failure reproduced once in 10 loaded runs, cause
  not isolated, no text lost.
- **AUDIT-D04-R1 complete** ([brief](tasks/AUDIT-D04-R1.md),
  [evidence](test-evidence/AUDIT.md#audit-d04-r1--all-empty-leading-key-block)):
  owner-approved rule in the codec; `FADE IN:` is body text; the title form
  cannot leave an all-empty block; the assessment mirrors the renderer's
  title-page reading. Corpus now 76 cases.

## Needs native rerun (owner, with a display)

Binary in place beside its helper (`target/release`), tmpfs and Btrfs, with
owned shutdown attribution:

- `integrated_exit.py --modes pdf-export script-check publication-exit` (D04-R2
  and D04-R1 assessment changes).
- `integrated_exit.py --modes title-page` (D04-R1 codec/title form; its add of
  an empty `Contact:` is pinned at domain level only).
- D-07 typed-export case: no drill mode exists; write one (type the fixture
  scene, Export PDF, `pdftotext`) and run it.
- Rust `cargo test --workspace` as a non-root user (baseline root failure).

## Open from this session

AUDIT-D07-F (F1 empty Dialogue/Lyrics exit without separator, F2 no keyboard
exit from a note at document end, F3 Page Break caret before `===`, F4
empty-cue suggestions capture the element-cycle Tab) and AUDIT-PARK-T (D-05
protection/snapshot cap; duplicate draft after a failed resume) need owner
decisions or briefs. Scratch core-crate probes and logs were not retained.

## Retained findings and limits (detail in linked evidence)

**AUDIT-D04** (`718c6e8`): native 6/6 strict pdf-export/script-check/
publication-exit there. A copied binary finds `pdf-helper` only in a folder
ending `target/release` that holds `.cargo-lock`
([README](../tests/native/writing-lifecycle/README.md)).
**AUDIT-D03** (`21a6180`, `02dc86c`): owned WebKit SIGABRT
**477772/start 4562349** and **501063/start 4636728** (cores retained, no
cause); the actions block above the editor is still tall.
**AUDIT-D02** (`ffede1d`): retained owned WebKit crashes Btrfs SIGSEGV
**335923/start 3571811**, tmpfs SIGSEGV **353321/start 3701248**, Btrfs SIGABRT
**413296/start 3989180**; no cause or C1/F2 disposition.
**AUDIT-NATIVE-R1** (`e595393`): owned Btrfs SIGSEGV **251383/start 3043549**;
full native keyboard/a11y/IME unverified. **AUDIT-D06**/**SIMP-F** complete;
earlier native failures stay historical evidence. `AUDIT.md` stays frozen.
C356 enforcing SELinux/native highlight input is unverified; C04's
unreproduced cache failure remains retained.
[M6-02](tasks/M6-02.md), [matrix](test-evidence/M6-02-matrix.md),
[review](reviews/2026-10-03-m6-02-persistence-review.md) and
[evidence](test-evidence/M6.md#m6-02--persistence-interruption-and-operation-investigation)
retain Save As/IME findings, shared-store lease scope and owned Btrfs SIGABRT
after parent SIGKILL. M6-03 copy/prune and capture-failure bundle policy open.

## Next action

Owner: run the native list above and decide AUDIT-D07-F / AUDIT-PARK-T and the
capitals guard. Agent: remaining accepted DESIGN items without a brief are D-05
cheap variant (now with AUDIT-PARK-T facts) and D-09 page count. Never
substitute injected composition for genuine IME; unset `FORCE_COLOR` for
`pnpm test:browser`. No full native/a11y/keyboard, SELinux, M6-02, C1/F2 or
Local v1 closure; [M6-02-R1](tasks/M6-02-R1.md) and
[M6-01-R1](tasks/M6-01-R1.md) remain separate; DEV-02 is owner-only. No M6/M7
work, private-engine shipping, personal manuscript/credentials/upload work.
