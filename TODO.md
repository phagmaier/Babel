# Dependency-ordered tasks

Authority: [SPEC S02/S03/S16/S18](SPEC.md#s16). `[x]` requires evidence; `[ ]` is open even when files exist. Each task names its gate and planned verification. M1–M3 are decomposed; M4–M7 groups must be decomposed into bounded tasks before implementation. No M1 investigation begins during M0. Evidence lands in `docs/test-evidence/M*.md`, one file per milestone.

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

## M3 — core Fountain editor (in progress)

- [x] **M3-00 Decompose M3-G** — Evidence: [M3 report](docs/test-evidence/M3.md#m3-00--decomposition)
- [x] **M3-01 Independent conformance corpus and oracle** — Evidence: [M3 report](docs/test-evidence/M3.md#m3-01--independent-conformance-corpus-and-oracle)
- [x] **M3-02 Production source-aware codec foundation** — Evidence: [M3 report](docs/test-evidence/M3.md#m3-02--production-source-aware-codec-foundation)
- [x] **M3-03 Complex Fountain regions and inline semantics** — Evidence: [M3 report](docs/test-evidence/M3.md#m3-03--complex-fountain-regions-and-inline-semantics)

- [x] **M3-04 Sole editor authority and source bridge** — Evidence: [M3 report](docs/test-evidence/M3.md#m3-04--sole-editor-authority-and-source-bridge).
- [x] **M3-05 Smart keys, joins and structural undo** — Evidence: [M3 report](docs/test-evidence/M3.md#m3-05--smart-keys-joins-and-structural-undo). Deps: M3-04.
- [x] **M3-06 Element picker and configurable shortcut registry** — [Evidence](docs/test-evidence/M3.md#m3-06--element-picker-and-configurable-shortcut-registry). Deps: M3-05.
- [x] **M3-07 Local character and heading completion** — [Evidence](docs/test-evidence/M3.md#m3-07--local-character-and-heading-completion). Deps: M3-06.
- [ ] **M3-08 Paste, inline formatting and native input matrix** — [Brief](docs/tasks/M3-08.md). Deps: M3-05, M3-06, M3-07. Bounded implementation/checks recorded; acceptance blocked by full real IME/cancellation; S13 proxy measurements retain later full-performance gates.
- [x] **M3-09 Native source/destination picker and recoverable drafts** — Evidence: [M3 report](docs/test-evidence/M3.md#m3-09--native-sourcedestination-picker-and-recoverable-drafts). Deps: M3-00, M2-06.
- [x] **M3-10 Recovery/source cadence and visible protection state** — Evidence: [M3 report](docs/test-evidence/M3.md#m3-10--recoverysource-cadence-and-visible-protection-state). Deps: M3-04, M3-09, M2-04, M2-05C.
- [ ] **M3-11 Native Save As identity and publication** — [Brief](docs/tasks/M3-11.md). Deps: M3-09, M3-10.
- [ ] **M3-12 Production writing lifecycle and failure UI** — [Brief](docs/tasks/M3-12.md). Deps: M3-08, M3-10, M3-11, M2-05D.
- [ ] **M3-13 Core editor exit and separate safety review** — [Brief](docs/tasks/M3-13.md). Deps: M3-01–12.

### M3 verification and boundary

Planned commands: per-task focused `pnpm exec vitest run <owned-test-paths>` and relevant `cargo test -p screenwriter-core <owned-test-filter>`/host command tests, then `pnpm check`, `pnpm test:browser`, `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, and relevant `pnpm tauri build`/`pnpm tauri dev` native interaction. Implementing tasks must establish exact focused commands in docs/development.md and record them once in [M3 evidence](docs/test-evidence/M3.md), with native/mocked labels and skipped/blocked gates. Filesystem publication/recovery/identity/lease/metadata changes require the tmpfs/Btrfs matrix; pure codec/envelope/state tests do not. Shared/milestone gates cannot be replaced by focused tests. Finish with `git diff --check`.

## M4–M7 — gated task groups (decompose before starting)

Each `M*-G` group requires a prior `M*-00` decomposition with refined requirement trace before implementation. Create M4-00–M7-00 when dependencies near completion. Owner decision required before M6 implementation: declare Tier 1 OS/arch targets and record them in docs/development.md; M1-02 remains the performance hardware baseline.

- [ ] **M4-G Daily workflows** — Deps: M3 gate. Reqs: APP-02, NAV-01–03, CHECK-01/02, UX-01–03. Read: SPEC S08/S09/S14; docs/ux.md/screenplay-validation.md.
- [ ] **M5-G Publication** — Deps: M1 PDF proof, M3 source gate, M4 UX gate. Reqs: PDF-01–04. Read: SPEC S12; docs/pdf-and-formatting.md.
- [ ] **M6-G Local history, hardening, adoption** — Deps: M2 history gate, M4/M5 gates. Reqs: HIST-01/02, SAVE-04/05, QA-01–03, SEC-01/02, APP-01. Read: SPEC S11/S14/S15; docs/testing.md.
- [ ] **M7-G Explicit remote extension** — Deps: M6 local adoption gate and owner privacy/destination decision. Reqs: SYNC-01–05, INV-07/09/15. Read: SPEC S11; docs/sync-and-versioning.md.

## M8 — optional, separately scoped

FDX exchange if migration needs it; richer comparisons/statistics/shortcut profiles; index cards/source view; encrypted remote adapter; broader platforms; production revision tools. Each needs a new bounded task/requirement and tests. None blocks local v1 by default. [SPEC S16](SPEC.md#s16).
