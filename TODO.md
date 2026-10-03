# Dependency-ordered tasks

Authority: [SPEC S02/S03/S16/S18](SPEC.md#s16). `[x]` requires evidence; `[ ]` is open even when files exist. Each task names its gate and planned verification. M1–M6 are decomposed; M7 requires bounded decomposition before implementation. No M1 investigation begins during M0. Evidence lands in `docs/test-evidence/M*.md`, one file per milestone.

Open tasks have detailed briefs in `docs/tasks/`. Completed tasks link to evidence.

## M0 — bootstrap (complete)

- [x] **M0-01 Repository/toolchain** — Evidence: [M0 report](docs/test-evidence/M0.md)
- [x] **M0-02 Truthful desktop shell** — Evidence: [M0 report](docs/test-evidence/M0.md)
- [x] **M0-03 Documentation and task trace** — Evidence: [M0 report](docs/test-evidence/M0.md)
- [x] **M0-04 Verification and handoff** — Evidence: [M0 report](docs/test-evidence/M0.md), [current-state](docs/current-state.md)

## M1 — bounded technical proofs (complete)

- [x] **M1-01 Loss-aware Fountain/editor contract** — Evidence: [M1 report](docs/test-evidence/M1.md), [ADR 0007](docs/decisions/0007-source-aware-fountain-contract.md)
- [x] **M1-02 Native editor input proof** — Evidence: [M1 report](docs/test-evidence/M1.md), [ADR 0008](docs/decisions/0008-native-editor-input.md)
- [x] **M1-03 PDF renderer proof** — Evidence: [M1 report](docs/test-evidence/M1.md), [ADR 0009](docs/decisions/0009-pdf-renderer-baseline.md)
- [x] **M1-04 Durable replacement proof** — Evidence: [M1 report](docs/test-evidence/M1.md), [ADR 0010](docs/decisions/0010-linux-durable-replacement.md)
- [x] **M1-05 History-store proof and gate review** — Evidence: [M1 report](docs/test-evidence/M1.md), [ADR 0011](docs/decisions/0011-git2-history-store.md), [gate review](docs/m1-gate-review.md)
- [x] **M1-06 Bounded codec/editor/native composition proof** — Evidence: [M1 report](docs/test-evidence/M1.md#m1-06--bounded-codeceditornative-composition-proof). Owner accepted 2026-09-28.

## M2 — headless data-safety foundation (complete)

- [x] **M2-01 Identity and safe open** — Evidence: [M2 report](docs/test-evidence/M2.md), [ADR 0012](docs/decisions/0012-native-document-identity.md)
- [x] **M2-02 Recovery checkpoint format** — Evidence: [M2 report](docs/test-evidence/M2-02.md), [ADR 0013](docs/decisions/0013-recovery-checkpoint-journal.md)
- [x] **M2-03 Serialized source replacement** — Evidence: [M2 report](docs/test-evidence/M2-03.md), [ADR 0014](docs/decisions/0014-serialized-source-replacement.md)
- [x] **M2-04 Versioned acknowledgements and IPC** — Evidence: [M2 report](docs/test-evidence/M2-04.md), [ADR 0015](docs/decisions/0015-versioned-persistence-ipc.md)
- [x] **M2-05A Startup recovery review** — Evidence: [M2 report](docs/test-evidence/M2-05A.md), [ADR 0016](docs/decisions/0016-read-only-startup-recovery-review.md)
- [x] **M2-05B Explicit recovery choices** — Evidence: [M2 report](docs/test-evidence/M2-05B.md), [ADR 0017](docs/decisions/0017-explicit-recovery-choices.md)
- [x] **M2-05B-R Independent acceptance review** — Evidence: [review](docs/reviews/2026-09-28-m2-05b-review.md)
- [x] **M2-05B-R1 Correct finalize durability and relink ownership** — Evidence: [M2 report](docs/test-evidence/M2-05B-R1.md). Owner accepted at `5e84879`.
- [x] **M2-05C Rolling snapshots and backup copies** — Evidence: [M2 report](docs/test-evidence/M2-05C.md), [ADR 0018](docs/decisions/0018-portable-snapshot-retention.md)
- [x] **M2-05D Protected close and failure escalation** — Evidence: [M2 report](docs/test-evidence/M2-05D.md), [ADR 0019](docs/decisions/0019-protected-close-lifecycle.md)
- [x] **M2-06 Small history primitives and safety gate** — Evidence: [M2 report](docs/test-evidence/M2-06.md), [ADR 0020](docs/decisions/0020-native-curated-history.md)

M2 headless Linux exit passed. This is a bounded headless foundation; no Local-v1/editor/installed-app claim.

## M3 — core Fountain editor (bounded Linux exit passed)

- [x] **M3-00 Decompose** — [Evidence](docs/test-evidence/M3.md#m3-00--decomposition)
- [x] **M3-01 Conformance corpus** — [Evidence](docs/test-evidence/M3.md#m3-01--independent-conformance-corpus-and-oracle)
- [x] **M3-02 Codec foundation** — [Evidence](docs/test-evidence/M3.md#m3-02--production-source-aware-codec-foundation)
- [x] **M3-03 Complex regions** — [Evidence](docs/test-evidence/M3.md#m3-03--complex-fountain-regions-and-inline-semantics)
- [x] **M3-04 Editor bridge** — [Evidence](docs/test-evidence/M3.md#m3-04--sole-editor-authority-and-source-bridge)
- [x] **M3-05 Smart keys/undo** — [Evidence](docs/test-evidence/M3.md#m3-05--smart-keys-joins-and-structural-undo)
- [x] **M3-06 Picker/shortcuts** — [Evidence](docs/test-evidence/M3.md#m3-06--element-picker-and-configurable-shortcut-registry)
- [x] **M3-07 Completion** — [Evidence](docs/test-evidence/M3.md#m3-07--local-character-and-heading-completion)
- [x] **M3-08 Clipboard/IME** — [Evidence](docs/test-evidence/M3.md#m3-08--paste-formatting-and-native-input)
- [x] **M3-09 Native entry** — [Evidence](docs/test-evidence/M3.md#m3-09--native-sourcedestination-picker-and-recoverable-drafts)
- [x] **M3-10 Cadence/status** — [Evidence](docs/test-evidence/M3.md#m3-10--recoverysource-cadence-and-visible-protection-state)
- [x] **M3-11 Save As** — [Evidence](docs/test-evidence/M3.md#m3-11--native-save-as-identity-and-publication)
- [x] **M3-12 Writing lifecycle** — [Evidence](docs/test-evidence/M3.md#m3-12--production-writing-lifecycle-and-failure-ui)
- [x] **M3-13 Exit + review** — [Evidence](docs/test-evidence/M3.md#m3-13--corrected-integrated-exit-re-review), [re-review](docs/reviews/2026-09-29-m3-13-rereview.md)
- [x] **M3-12-R1 Draft protection** — [Evidence](docs/test-evidence/M3.md#repository-audit-corrections)
- [x] **M3-09-R1 Checkpoint resume** — [Evidence](docs/test-evidence/M3.md#repository-audit-corrections)
- [x] **M3-11-R1 Read-only Save As** — [Evidence](docs/test-evidence/M3.md#repository-audit-corrections)
- [x] **M3-04-R1 Typing responsiveness** — [Evidence](docs/test-evidence/M3.md#repository-audit-corrections)
- [x] **M3-10-R1 Cadence liveness** — [Evidence](docs/test-evidence/M3.md#repository-audit-corrections)
- [x] **M3-12-R2 Lifecycle boundaries** — [Evidence](docs/test-evidence/M3.md#repository-audit-corrections)
- [x] **M3-03-R1 Inline complexity** — [Evidence](docs/test-evidence/M3.md#repository-audit-corrections)

### M3 verification and boundary

The bounded Linux M3 exit passed. **M4-00** decomposes the next milestone below. Full S13, native-stack hardening and Local v1 adoption remain open; see the corrected re-review above.

Planned commands: per-task focused `pnpm exec vitest run <owned-test-paths>` and relevant `cargo test -p screenwriter-core <owned-test-filter>`/host command tests, then `pnpm check`, `pnpm test:browser`, `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, and relevant `pnpm tauri build`/`pnpm tauri dev` native interaction. Implementing tasks must establish exact focused commands in docs/development.md and record them once in [M3 evidence](docs/test-evidence/M3.md), with native/mocked labels and skipped/blocked gates. Filesystem publication/recovery/identity/lease/metadata changes require the tmpfs/Btrfs matrix; pure codec/envelope/state tests do not. Shared/milestone gates cannot be replaced by focused tests. Finish with `git diff --check`.

## M4 — professional daily workflows

Prerequisite: [corrected M3-13 bounded Linux exit](docs/test-evidence/M3.md#m3-13--corrected-integrated-exit-re-review), locally tagged `m3-core-editor-linux-verified` at `97e1798`. [M4-00 brief](docs/tasks/M4-00.md) owns implementation verification policy; [M4 trace](docs/requirements.md#m4-decomposition-coverage-planned) maps requirement owners. M4-01–10 passed bounded Linux service/Home/projection/protection/move/title/find/replace/check/presentation gates; M4-11 native offline integration proof and M4-12 production spellcheck passed bounded Linux gates; M4-13 characters/counts/position passed bounded Linux gates; M4-14 palette/menus/accessibility passed bounded Linux gates; M4-15 integrated exit passed bounded Linux gates. Read each linked brief for owned paths, requirements/invariants, acceptance, focused/shared/native checks and exclusions.

- [x] **M4-00 Decomposition** — Deps: corrected M3-13. Bounded task/trace and docs/link/dependency/coverage checks passed. [Brief](docs/tasks/M4-00.md); [evidence](docs/test-evidence/M4.md#m4-00--decomposition).
- [x] **M4-01 Native recents and missing-file selection** — Bounded Linux registry, explicit locate/remove/Save As/restart and metadata failures passed on tmpfs/Btrfs. [Brief](docs/tasks/M4-01.md); [evidence](docs/test-evidence/M4.md#m4-01--native-recents-and-missing-file-selection).
- [x] **M4-02 Home and recovery workflows** — Bounded Linux New/Open/Recent/Locate/Remove, restart/full-byte recovery, read-only entry and failed protected switching passed on tmpfs/Btrfs. [Brief](docs/tasks/M4-02.md); [evidence](docs/test-evidence/M4.md#m4-02--home-and-recovery-workflows).
- [x] **M4-03 Manuscript index and outline navigation** — Versioned hierarchy/attachments/logical text, exact non-editing selection/viewport navigation, stale/unavailable bounds and typical/stress latency passed bounded Linux gates. [Brief](docs/tasks/M4-03.md); [evidence](docs/test-evidence/M4.md#m4-03--versioned-manuscript-index-and-outline-navigation).
- [x] **M4-04 Destructive-workflow protection** — Exact operation/version/length/recovery/safety-ref receipt, frozen dispatch guard, cancellation/Undo/history isolation and tmpfs/Btrfs gates passed. [Brief](docs/tasks/M4-04.md); [evidence](docs/test-evidence/M4.md#m4-04--version-bound-workflow-protection).
- [x] **M4-05 Scene/section moves** — Exact attachment/subtree previews, owned pointer/keyboard parity, protected large moves and source/selection Undo/Save/reopen passed on tmpfs/Btrfs. [Brief](docs/tasks/M4-05.md); [evidence](docs/test-evidence/M4.md#m4-05--reversible-scene-and-section-moves).
- [x] **M4-06 Title-page form** — Ordered standard/unknown/duplicate/multiline fields, exact source/Undo/Save/restore/reopen, staged-input guards and real IME/focus/failure drills passed on tmpfs/Btrfs. [Brief](docs/tasks/M4-06.md); [evidence](docs/test-evidence/M4.md#m4-06--source-preserving-title-page-form).
- [x] **M4-07 Find and hidden navigation** — Exact logical/Unicode/full/scene/filter/wrap/hidden selection, no-op source/journal/Undo and bounded current results passed; typical native find/navigation within 200 ms, stress latency remains open. [Brief](docs/tasks/M4-07.md); [evidence](docs/test-evidence/M4.md#m4-07--logical-text-find-and-hidden-navigation).
- [x] **M4-08 Replace one/all** — Current-version preview/count, atomic replacement and one-step Undo passed bounded Linux gates; [M4-08-R1](docs/tasks/M4-08-R1.md) corrects emphasis inside replaced ranges with mixed-emphasis preview refusal and fresh source/Undo/Redo/native evidence. [Brief](docs/tasks/M4-08.md); [evidence](docs/test-evidence/M4.md#m4-08--transactional-replace-one-and-replace-all).
- [x] **M4-09 Script Check** — Stable non-destructive rules/severities, false-positive/stale/navigation checks passed bounded Linux gates; production SC005/SC008 assessment remains M5. [Brief](docs/tasks/M4-09.md); [evidence](docs/test-evidence/M4.md#m4-09--non-destructive-script-check-and-issue-navigation).
- [x] **M4-10 Presentation modes** — Versioned UI-only themes/zoom/focus/typewriter, no-op source/state/selection/Undo, visible failures and native 2× caret/IME/scroll/restart passed; stress layout/Undo performance remains open. [Brief](docs/tasks/M4-10.md); [evidence](docs/test-evidence/M4.md#m4-10--presentation-modes).
- [x] **M4-11 Offline spellcheck proof** — Bounded Linux WebKit/Enchant/Hunspell suggestions/correction/Undo, language/resource failure, session Ignore/local Learn/restart, names/Unicode/IME and offline profile isolation passed; ADR 0032 selects native integration. Production activation stays M4-12. [Brief](docs/tasks/M4-11.md); [evidence](docs/test-evidence/M4.md#m4-11--offline-spellcheck-proof).
- [x] **M4-12 Production spellcheck** — Bounded Linux default-release language/suggestions/names/Ignore/durable local Add/restart/one Undo/IME and offline resource checks passed; interrupted dictionary publication/failure isolation verified on tmpfs/Btrfs. [Brief](docs/tasks/M4-12.md); [evidence](docs/test-evidence/M4.md#m4-12--production-offline-spellcheck).
- [x] **M4-13 Characters/counts/recent position** — Bounded Linux versioned inclusion-aware counts, exact character navigation/view-only highlights, UUID/hash-safe caret/manual-scroll restart, Save As/recovery precedence and auxiliary failure isolation passed. [Brief](docs/tasks/M4-13.md); [evidence](docs/test-evidence/M4.md#m4-13--characters-counts-and-recent-position).
- [x] **M4-14 Palette/menus/accessibility** — Shared remappable routing/availability, strict native menu bridge, keyboard palette/current navigation, focus/IME/scaling and AT-SPI exposure passed bounded Linux gates on tmpfs/Btrfs; screenreader/platform/installed acceptance remains open. [Brief](docs/tasks/M4-14.md), [evidence](docs/test-evidence/M4.md#m4-14--palette-menus-and-accessibility).
- [x] **M4-15 Integrated exit and separate safety review** — Real Linux preedit (M4-15-R1), ordinary-close abort mitigated (ADR 0035). Final 19-mode tmpfs/Btrfs matrix: 38/38 functional, 36/38 strict; retained/journal audits, shared gates and separate post-integration review pass. Aborts after forced WebDriver teardown (test-only, bypassing ADR 0035) are classified with C1 and carried to M6. [Evidence](docs/test-evidence/M4.md#continuation-from-a97a577--full-native-matrix-and-post-integration-review), [review](docs/reviews/2026-10-02-m4-15-post-integration-review.md), [brief](docs/tasks/M4-15.md).

- [x] **[M4-15-R2](docs/tasks/M4-15-R2.md) Save As rollback derived state** — Restore outline/counts/navigation after retained editor rollback without losing source, selection or Undo. [Evidence](docs/test-evidence/M4.md#m4-15-r2--derived-state-after-save-as-rollback); independent shutdown blocker remains open.

M4 exit tagged `m4-daily-workflows-linux-verified` at `fe0343f` and pushed.

## M5 — publication pipeline

Prerequisite: [M4 bounded Linux exit](docs/test-evidence/M4.md#continuation-from-a97a577--full-native-matrix-and-post-integration-review), tagged `m4-daily-workflows-linux-verified`; renderer baseline [ADR 0009](docs/decisions/0009-pdf-renderer-baseline.md). [M5-00 brief](docs/tasks/M5-00.md) owns the verification policy; [M5 trace](docs/requirements.md#m5-decomposition-coverage-planned) maps requirement owners. M5 is a bounded Linux gate: A4, editor page markers, other platforms' installed/offline verification and Local v1 adoption are outside it.

- [x] **M5-00 Decomposition** — Deps: M4 exit. Bounded tasks, trace and dependency audit. [Brief](docs/tasks/M5-00.md); [evidence](docs/test-evidence/M5.md#m5-00--decomposition).
- [x] **M5-01 Bundled offline renderer helper** — Deps: M5-00. Standalone CPython 3.13.16 + pinned Screenplain/ReportLab/Courier Prime with a Pillow stub; protocol 1, typed errors, reproducible tree hash, +19.5 MiB AppImage; offline render passes from the packaged AppImage. [ADR 0036](docs/decisions/0036-bundled-pdf-helper.md); [brief](docs/tasks/M5-01.md); [evidence](docs/test-evidence/M5.md#m5-01--bundled-offline-renderer-helper).
- [x] **M5-02 Native render service and adapter contract** — Deps: M5-01. Captured-snapshot jobs, supersede/cancel, exact-version results, app-owned artifacts, failure isolation. [Brief](docs/tasks/M5-02.md); [evidence](docs/test-evidence/M5.md#m5-02--native-render-service-and-adapter-contract).
- [x] **M5-03 Frozen US Letter profile and regression corpus** — Deps: M5-01/02. `(MORE)`/`(CONT'D)`, title numbering, keep rules, lyrics/dual leaks, font audit; layout/text/image goldens. [Brief](docs/tasks/M5-03.md).
- [x] **M5-04 Production SC005/SC008 assessment** — Deps: M5-03, M4-09. Primary-codec support/paragraph limitations, independently reviewed four-face cmap coverage, actual native identity/in-memory layout checks, versioned non-dismissable findings; unavailable/stale never implies export success. [Brief](docs/tasks/M5-04.md); [evidence](docs/test-evidence/M5.md#m5-04--production-sc005sc008-assessment).
- [x] **M5-05 Authoritative preview and page-count freshness** — Deps: M5-02/03. Bundled local-worker PDF.js viewer, current-only binary reads, exact-job display/count confirmation and stale render/read/display refusal; source/Save independent. [ADR 0038](docs/decisions/0038-offline-pdf-viewer.md); [brief](docs/tasks/M5-05.md); [evidence](docs/test-evidence/M5.md#m5-05--authoritative-preview-and-page-count-freshness).
- [x] **M5-06 Export PDF workflow** — Deps: M5-04/05. Protected exact-version review, informed SC005/SC008 decisions, native capture/destination tokens, same-pipeline rendering and verified atomic PDF replacement; Save/source independent. [ADR 0039](docs/decisions/0039-pdf-export-publication.md); [brief](docs/tasks/M5-06.md); [evidence](docs/test-evidence/M5.md#m5-06--captured-pdf-export).
- [x] **M5-07 Integrated publication exit and separate review** — Deps: M5-01–06. Bounded Linux S12.6 corpus/two-viewer and native offline AppRun tmpfs/Btrfs gates passed; preview-close/Save focus race corrected. [Brief](docs/tasks/M5-07.md); [evidence](docs/test-evidence/M5.md#m5-07--integrated-publication-exit-and-separate-review); [separate review](docs/reviews/2026-10-02-m5-07-publication-review.md).

- [x] **DEV-01 Laptop development setup** — Pinned tools/dependencies, portable renderer identity, native listener cleanup, laptop test concurrency and real development/package checks. [Brief](docs/tasks/DEV-01.md); [evidence](docs/test-evidence/M5.md#dev-01--laptop-development-setup).

- [ ] **DEV-02 Second-machine smoothness** — One-command bootstrap, pin/host/doctor checks, safe `target/` pruning, per-host test workers and target-dir fix. Tooling slice landed; second-host bootstrap run still open. [Brief](docs/tasks/DEV-02.md); [evidence](docs/test-evidence/M5.md#dev-02--second-machine-smoothness-tooling-slice).

- [x] **DEV-03 WritingView decomposition** — Slices 1–9 complete: helpers plus find/check/spelling/title/move/outline/palette/publication sessions; component 2,483 → 1,939 lines. Verbatim bodies and typed boundaries; lifecycle/protection/dispatch/JSX and original focus-effect order stay composed. Shared gates and named native drills pass; slices 8–9 have no blocked sections. [Brief](docs/tasks/DEV-03.md); [evidence](docs/test-evidence/M5.md#dev-03--writingview-decomposition-slice-9).

M5 bounded Linux publication gate and DEV-03 are complete. M6-00 planning is
complete; M6-01 bounded investigation/review is complete. Further tasks and
Local v1 admission retain their explicit gates.

## M6 — local history, hardening and adoption (planned)

- [x] **M6-00 Planning and decomposition** — Documentation acceptance only; [proposal](docs/tasks/M6-00.md), [planning evidence](docs/test-evidence/M6.md#m6-00--decomposition), [trace](docs/requirements.md#m6-decomposition-coverage-planned). No implementation or milestone admission.
- [ ] **M6-G Local history, hardening, adoption** — Deps: M2 history and M4/M5 bounded gates; M6-01–16 and all Local v1 evidence. Reqs: HIST-01/02, SAVE-04/05, QA-01–03, SEC-01/02, APP-01. Remains open.

Owner declared Linux for now on 2026-10-02; the observed x86_64 target and
future portability are recorded in `docs/development.md` (ADR 0040). M6-01
implementation is authorized; other target admission remains a future decision.
M1-02 remains the performance reference. Numeric order prioritizes shutdown/recovery safety, history workflows,
then performance and installed adoption; exact dependencies and unresolved gates
are in M6-00. C1/F2 failures remain retained; ordinary-close passes do not resolve
them. M6-00 admitted no implementation; later owner direction authorized this
bounded M6-01 continuation. Exact release-target confirmation remains M6-13/14.

- [x] **M6-01 Shutdown hardening and retained crash disposition** — Bounded investigation/review complete on current Linux host; close-guard regressions/shared checks pass. Candidate paired matrix 7/8 functional, 6/8 strict; fresh F2 core retained, C1/F2 release gate C remains open. [Brief](docs/tasks/M6-01.md), [evidence](docs/test-evidence/M6.md#m6-01--linux-scope-and-shutdown-hardening), [review](docs/reviews/2026-10-02-m6-01-shutdown-review.md), [gated runtime follow-up](docs/tasks/M6-01-R1.md). No crash resolution/admission.
- [ ] **M6-02 Persistence interruption and restart hardening** — Deps: M6-01; platform/authorization gate P. [Brief](docs/tasks/M6-02.md).
- [ ] **M6-03 Independent snapshot and retention workflow** — Deps: M6-02; platform/authorization gate P. [Brief](docs/tasks/M6-03.md).
- [ ] **M6-04 Configured external backup destination** — Deps: M6-03; platform/authorization gate P. [Brief](docs/tasks/M6-04.md).
- [ ] **M6-05 Bounded native history inspection and selection** — Deps: M6-02/04; platform/authorization gate P. [Brief](docs/tasks/M6-05.md).
- [ ] **M6-06 Automatic and named local revision cadence** — Deps: M6-05; platform/authorization gate P. [Brief](docs/tasks/M6-06.md).
- [ ] **M6-07 History timeline preview and readable comparison** — Deps: M6-05/06; platform/authorization gate P. [Brief](docs/tasks/M6-07.md).
- [ ] **M6-08 Non-destructive historical restore** — Deps: M6-03/06/07; platform/authorization gate P. [Brief](docs/tasks/M6-08.md).
- [ ] **M6-09 Explicit history corruption recovery** — Deps: M6-05/08; platform/authorization gate P. [Brief](docs/tasks/M6-09.md).
- [ ] **M6-10 Release security and locked dependency review** — Deps: M6-01/02/09; platform/authorization gate P. [Brief](docs/tasks/M6-10.md).
- [ ] **M6-11 Full responsiveness and long-session baseline** — Deps: M6-04/06/08/10; platform/authorization gate P. [Brief](docs/tasks/M6-11.md).
- [ ] **M6-12 Measured responsiveness correction** — Deps: M6-11; platform/authorization gate P. [Brief](docs/tasks/M6-12.md).
- [ ] **M6-13 Declared-target native and accessibility matrix** — Deps: M6-02/09/10/12; platform/authorization gate P. [Brief](docs/tasks/M6-13.md).
- [ ] **M6-14 Installed offline package and manual update checks** — Deps: M6-10/13; platform/authorization gate P. [Brief](docs/tasks/M6-14.md).
- [ ] **M6-15 Disposable migration and independent backup restore** — Deps: M6-04/08/14; platform/authorization gate P. [Brief](docs/tasks/M6-15.md).
- [ ] **M6-16 Owner writing pilot and Local v1 release review** — Deps: M6-01/02/03/04/05/06/07/08/09/10/11/12/13/14/15; platform/authorization gate P. [Brief](docs/tasks/M6-16.md).

M6-02 needs the M6-01 review artifact; an unresolved C1/F2 release gate may remain
while independent safety work proceeds. M6-12 requires a measured scope addendum
before correction; M6-13 needs new bounded briefs for missing target adapters.
Next agent-executable task: **M6-02**, current Linux scope, beginning with the
retained Save As/refusal and stress IME Undo/readiness investigation addendum.
The supported-runtime M6-01-R1 follow-up remains gated by actual availability;
C stays open before M6-14/16. Stop after the M6-01 commit.
DEV-02 second-host acceptance remains owner-only and outside M6 work.

## M7 — explicit remote extension (gated)

Each `M*-G` group needs an `M*-00` decomposition and refined trace before coding.
M7 remains unchanged in scope and cannot begin before Local v1 adoption and the
owner's privacy/destination decision.

- [ ] **M7-G Explicit remote extension** — Deps: M6 local adoption gate and owner privacy/destination decision. Reqs: SYNC-01–05, INV-07/09/15. Read: SPEC S11; docs/sync-and-versioning.md.

## M8 — optional, separately scoped

FDX exchange if migration needs it; richer comparisons/statistics/shortcut profiles; index cards/source view; encrypted remote adapter; broader platforms; production revision tools. Each needs a new bounded task/requirement and tests. None blocks local v1 by default. [SPEC S16](SPEC.md#s16).
