# Dependency-ordered tasks

Authority: [SPEC S02/S03/S16/S18](SPEC.md#s16). `[x]` requires evidence; `[ ]` is open even when files exist. Each task names its gate and planned verification. M1–M4 are decomposed; M5–M7 groups must be decomposed into bounded tasks before implementation. No M1 investigation begins during M0. Evidence lands in `docs/test-evidence/M*.md`, one file per milestone.

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

- [x] **M3-00 Decompose M3-G** — Evidence: [M3 report](docs/test-evidence/M3.md#m3-00--decomposition)
- [x] **M3-01 Independent conformance corpus and oracle** — Evidence: [M3 report](docs/test-evidence/M3.md#m3-01--independent-conformance-corpus-and-oracle)
- [x] **M3-02 Production source-aware codec foundation** — Evidence: [M3 report](docs/test-evidence/M3.md#m3-02--production-source-aware-codec-foundation)
- [x] **M3-03 Complex Fountain regions and inline semantics** — Evidence: [M3 report](docs/test-evidence/M3.md#m3-03--complex-fountain-regions-and-inline-semantics)

- [x] **M3-04 Sole editor authority and source bridge** — Evidence: [M3 report](docs/test-evidence/M3.md#m3-04--sole-editor-authority-and-source-bridge).
- [x] **M3-05 Smart keys, joins and structural undo** — Evidence: [M3 report](docs/test-evidence/M3.md#m3-05--smart-keys-joins-and-structural-undo). Deps: M3-04.
- [x] **M3-06 Element picker and configurable shortcut registry** — [Evidence](docs/test-evidence/M3.md#m3-06--element-picker-and-configurable-shortcut-registry). Deps: M3-05.
- [x] **M3-07 Local character and heading completion** — [Evidence](docs/test-evidence/M3.md#m3-07--local-character-and-heading-completion). Deps: M3-06.
- [x] **M3-08 Paste, inline formatting and native input matrix** — Evidence: [M3 report](docs/test-evidence/M3.md#m3-08--paste-formatting-and-native-input). Deps: M3-05, M3-06, M3-07. Real IME commit/cancel/Enter passed; S13 proxy measurements retain later full-performance gates.
- [x] **M3-09 Native source/destination picker and recoverable drafts** — Evidence: [M3 report](docs/test-evidence/M3.md#m3-09--native-sourcedestination-picker-and-recoverable-drafts). Deps: M3-00, M2-06.
- [x] **M3-10 Recovery/source cadence and visible protection state** — Evidence: [M3 report](docs/test-evidence/M3.md#m3-10--recoverysource-cadence-and-visible-protection-state). Deps: M3-04, M3-09, M2-04, M2-05C.
- [x] **M3-11 Native Save As identity and publication** — Evidence: [M3 report](docs/test-evidence/M3.md#m3-11--native-save-as-identity-and-publication). Deps: M3-09, M3-10.
- [x] **M3-12 Production writing lifecycle and failure UI** — [Brief](docs/tasks/M3-12.md). Deps: M3-08, M3-10, M3-11, M2-05D.
- [x] **M3-13 Core editor exit and separate safety review** — [Brief](docs/tasks/M3-13.md), [corrected re-review](docs/reviews/2026-09-29-m3-13-rereview.md), [evidence](docs/test-evidence/M3.md#m3-13--corrected-integrated-exit-re-review). Fresh full default-app input/IME/lifecycle and native tmpfs/Btrfs safety gates pass. Deps: M3-01–12 and corrections below.
- [x] **M3-12-R1 Uncapturable draft protection and truthful status** — [Brief](docs/tasks/M3-12-R1.md). Deps: M3-12; review R03. Evidence: [audit corrections](docs/test-evidence/M3.md#repository-audit-corrections).
- [x] **M3-09-R1 Resume/export unsaved checkpoints after restart** — [Brief](docs/tasks/M3-09-R1.md). Deps: M3-09, M3-12; review R02. Evidence: [audit corrections](docs/test-evidence/M3.md#repository-audit-corrections).
- [x] **M3-11-R1 Read-only source Save As** — [Brief](docs/tasks/M3-11-R1.md). Deps: M3-11, M3-12; review R01. Evidence: [audit corrections](docs/test-evidence/M3.md#repository-audit-corrections).
- [x] **M3-04-R1 Integrated capture/cadence typing responsiveness** — [Brief](docs/tasks/M3-04-R1.md). Deps: M3-04, M3-10, M3-12; review R04. Complete trusted-input/latency audit required. Evidence: [audit corrections](docs/test-evidence/M3.md#repository-audit-corrections).
- [x] **M3-10-R1 Coalesced cadence liveness** — [Brief](docs/tasks/M3-10-R1.md). Deps: M3-10, M3-12; repository audit A2. Evidence: [audit corrections](docs/test-evidence/M3.md#repository-audit-corrections).
- [x] **M3-12-R2 Recovery and identity lifecycle boundaries** — [Brief](docs/tasks/M3-12-R2.md). Deps: M3-09–12; repository audit A3/A7/A9/A10/A11. Evidence: [audit corrections](docs/test-evidence/M3.md#repository-audit-corrections).
- [x] **M3-03-R1 Inline/capture complexity** — [Brief](docs/tasks/M3-03-R1.md). Deps: M3-03; repository audit A6 and M3-04-R1 measurements. Evidence: [audit corrections](docs/test-evidence/M3.md#repository-audit-corrections).

### M3 verification and boundary

The bounded Linux M3 exit passed. **M4-00** decomposes the next milestone below. Full S13, native-stack hardening and Local v1 adoption remain open; see the corrected re-review above.

Planned commands: per-task focused `pnpm exec vitest run <owned-test-paths>` and relevant `cargo test -p screenwriter-core <owned-test-filter>`/host command tests, then `pnpm check`, `pnpm test:browser`, `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, and relevant `pnpm tauri build`/`pnpm tauri dev` native interaction. Implementing tasks must establish exact focused commands in docs/development.md and record them once in [M3 evidence](docs/test-evidence/M3.md), with native/mocked labels and skipped/blocked gates. Filesystem publication/recovery/identity/lease/metadata changes require the tmpfs/Btrfs matrix; pure codec/envelope/state tests do not. Shared/milestone gates cannot be replaced by focused tests. Finish with `git diff --check`.

## M4 — professional daily workflows

Prerequisite: [corrected M3-13 bounded Linux exit](docs/test-evidence/M3.md#m3-13--corrected-integrated-exit-re-review), locally tagged `m3-core-editor-linux-verified` at `97e1798`. [M4-00 brief](docs/tasks/M4-00.md) owns implementation verification policy; [M4 trace](docs/requirements.md#m4-decomposition-coverage-planned) maps requirement owners. M4-01/02/03 passed their bounded Linux service/Home/projection gates; M4-04–15 remain open. Read each linked brief for owned paths, requirements/invariants, acceptance, focused/shared/native checks and exclusions.

- [x] **M4-00 Decomposition** — Deps: corrected M3-13. Bounded task/trace and docs/link/dependency/coverage checks passed. [Brief](docs/tasks/M4-00.md); [evidence](docs/test-evidence/M4.md#m4-00--decomposition).
- [x] **M4-01 Native recents and missing-file selection** — Bounded Linux registry, explicit locate/remove/Save As/restart and metadata failures passed on tmpfs/Btrfs. [Brief](docs/tasks/M4-01.md); [evidence](docs/test-evidence/M4.md#m4-01--native-recents-and-missing-file-selection).
- [x] **M4-02 Home and recovery workflows** — Bounded Linux New/Open/Recent/Locate/Remove, restart/full-byte recovery, read-only entry and failed protected switching passed on tmpfs/Btrfs. [Brief](docs/tasks/M4-02.md); [evidence](docs/test-evidence/M4.md#m4-02--home-and-recovery-workflows).
- [x] **M4-03 Manuscript index and outline navigation** — Versioned hierarchy/attachments/logical text, exact non-editing selection/viewport navigation, stale/unavailable bounds and typical/stress latency passed bounded Linux gates. [Brief](docs/tasks/M4-03.md); [evidence](docs/test-evidence/M4.md#m4-03--versioned-manuscript-index-and-outline-navigation).
- [ ] **M4-04 Destructive-workflow protection** — Deps: M4-00, completed M2-06/M3 protection gates. Gate: narrow exact-version recovery/safety-ref receipt and history/stale/failure isolation on tmpfs/Btrfs. [Brief](docs/tasks/M4-04.md).
- [ ] **M4-05 Scene/section moves** — Deps: M4-03/04. Gate: attachment preview, drag/keyboard parity, large-move protection, exact source/selection and one-step Undo. [Brief](docs/tasks/M4-05.md).
- [ ] **M4-06 Title-page form** — Deps: M4-00, completed M3 source/Undo/lifecycle gates. Gate: standard/unknown/duplicate/multiline fields, staged-input protection and exact no-op/edit/Undo/save. [Brief](docs/tasks/M4-06.md).
- [ ] **M4-07 Find and hidden navigation** — Deps: M4-03/06. Gate: logical text, full/scene scope, case/whole-word, hidden filters/reveal, bounded current results. [Brief](docs/tasks/M4-07.md).
- [ ] **M4-08 Replace one/all** — Deps: M4-07, completed M3 protection. Gate: current-version preview/count, atomic source/mark-preserving replacement and one-step Undo. [Brief](docs/tasks/M4-08.md).
- [ ] **M4-09 Script Check** — Deps: M4-03/06/07. Gate: stable non-destructive rules/severities, false-positive/stale/navigation checks; production SC005/SC008 assessment remains M5. [Brief](docs/tasks/M4-09.md).
- [ ] **M4-10 Presentation modes** — Deps: M4-02/03, completed M3 input. Gate: light/dark/zoom/focus/typewriter preferences, persistent errors and native caret/IME/scroll fidelity. [Brief](docs/tasks/M4-10.md).
- [ ] **M4-11 Offline spellcheck proof** — Deps: M4-00, completed M3 native input. Gate: tested native languages/suggestions/ignore/add/Undo, resource/license evidence and bounded ADR decision. [Brief](docs/tasks/M4-11.md).
- [ ] **M4-12 Production spellcheck** — Deps: successful M4-11, M4-03/10. Gate: offline language/name/ignore/add/correction with exact Undo, failure isolation and default-release resources. [Brief](docs/tasks/M4-12.md).
- [ ] **M4-13 Characters/counts/recent position** — Deps: M4-01/03/06/10. Gate: documented inclusion rules, non-editing focus and hash/identity-safe caret/scroll restart. [Brief](docs/tasks/M4-13.md).
- [ ] **M4-14 Palette/menus/accessibility** — Deps: M4-02/05/06/08/09/10/12/13. Gate: shared remappable command availability, native keyboard/menu/palette/focus/scaling and honest assistive-technology coverage. [Brief](docs/tasks/M4-14.md).
- [ ] **M4-15 Integrated exit and separate safety review** — Deps: accepted M4-01–14. Gate: realistic default native drafting/editing/failure/restart session on tmpfs/Btrfs, full shared checks, exact source/Undo audits and separate post-integration review. [Brief](docs/tasks/M4-15.md).

Recommended next: **M4-04**. M4-04/06/11 remain dependency-ready; one editing agent proceeds sequentially, preserving shared editor/lifecycle ownership. An unsuccessful spellcheck proof blocks M4-12/15. M4 does not require the M5 production renderer and does not claim full S13 or Local v1 adoption.

## M5–M7 — gated task groups (decompose before starting)

Each `M*-G` group requires a prior `M*-00` decomposition with refined requirement trace before implementation. Create M5-00–M7-00 when dependencies near completion. Owner decision required before M6 implementation: declare Tier 1 OS/arch targets and record them in docs/development.md; M1-02 remains the performance hardware baseline.

Carry [M3 re-review C1](docs/reviews/2026-09-29-m3-13-rereview.md#c1--recurring-webkit-child-heap-abort-at-forced-shutdown) into native hardening before adoption: recurring owned WebKit heap abort during deliberate parent SIGKILL, exact cause and ordinary-close impact unresolved. Transitive advisory warnings and full performance/platform gaps remain in that review.

- [ ] **M5-G Publication** — Deps: M1 PDF proof, M3 source gate, M4-15 UX gate. Reqs: PDF-01–04, CHECK-02 production SC005/SC008 assessment. Read: SPEC S09/S12; docs/pdf-and-formatting.md and M4-09. Gate includes verified renderer/profile/font diagnostics connected to Script Check before any successful export claim.
- [ ] **M6-G Local history, hardening, adoption** — Deps: M2 history gate, M4/M5 gates. Reqs: HIST-01/02, SAVE-04/05, QA-01–03, SEC-01/02, APP-01. Read: SPEC S11/S14/S15; docs/testing.md.
- [ ] **M7-G Explicit remote extension** — Deps: M6 local adoption gate and owner privacy/destination decision. Reqs: SYNC-01–05, INV-07/09/15. Read: SPEC S11; docs/sync-and-versioning.md.

## M8 — optional, separately scoped

FDX exchange if migration needs it; richer comparisons/statistics/shortcut profiles; index cards/source view; encrypted remote adapter; broader platforms; production revision tools. Each needs a new bounded task/requirement and tests. None blocks local v1 by default. [SPEC S16](SPEC.md#s16).
