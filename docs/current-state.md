# Current state — M2-02 complete

Date: 2026-09-28 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [M2 evidence](test-evidence/M2.md), [ADR 0013](decisions/0013-recovery-checkpoint-journal.md).

## Active task and trust boundary

M0 and bounded M1 proofs are complete. M2-01 is committed (`7e1ea90`) and merged into local main at owner request. **M2-02 Recovery checkpoint format is complete**, committed (`6039ccc`) on `M2-02-recovery-checkpoints` and fast-forwarded into local main at owner request. Both M2-01/02 implementation commits are local; nothing was pushed. No next task is claimed. The app remains unsafe for important manuscripts: New/Open are disabled and native picker/checkpoint IPC/startup UI are unwired. No source saving, production editor, PDF export, history UI or remote operation exists. M2 exit is open; production PDF UI stays gated to M5.

## Completed work and touched paths

- Native schema-1 checksummed full-source recovery records with document/session/version/generation/hash/base disk fingerprint and opaque draft metadata; byte-preserving invalid/incomplete text independent of Script Check or external source divergence. Managed recovery is in `.screenwriter/recovery/`; loose/unsaved recovery is in private app data. Unsaved identities own a native document lease.
- Verified/synced two-record journal rotation and independent predecessor, bounded artifacts, exact recovery-only receipts, fresh duplicate verification, stale/conflicting/session rejection. Tail corruption retains the valid prefix and exact quarantine; future schema/oversize/pending/conflict cases remain untouched and require attention. Native restart inspection never rewrites source or equates a valid record with a delivered receipt.
- Touched: `crates/screenwriter-core/src/documents/{linux.rs,mod.rs,recovery*.rs}`, `crates/screenwriter-core/tests/recovery.rs`, `src/application/documents.ts`, README/TODO, architecture/document-model/persistence/development/testing/requirements/current-state docs, ADR 0013 and `docs/test-evidence/M2.md`. No new dependency, permission, production test hook or remote action.

## Exact verification

Host: Linux 7.2.5-3-omarchy x86_64; Rust/Cargo 1.97.1, Node 26.7.0, pnpm 11.22.0; tmpfs and Btrfs. Exact commands/logs, corrected development failures and measurement limits are in [M2-02 evidence](test-evidence/M2.md#m2-02--recovery-checkpoint-format).

- Passed: `CARGO_HOME=/tmp/babel-cargo cargo test --workspace --locked -- --nocapture` — 80 tests (13 core unit, 12 recovery API, 26 safe-open, 3 desktop, 13 replacement, 13 history). The two child harness entries execute their operations only in explicit subprocesses.
- Passed: `BABEL_RECOVERY_TEST_ROOT=/home/phagmaier/Code/babel CARGO_HOME=/tmp/babel-cargo cargo test -p screenwriter-core --lib --test recovery --locked -- --nocapture` — 25 entries on Btrfs, 15 injected fault stages and six SIGKILL barriers.
- Passed: `BABEL_RECOVERY_TEST_ROOT=/home/phagmaier/Code/babel CARGO_HOME=/tmp/babel-cargo cargo test -p screenwriter-core --test recovery --release --locked large_stress_fixture_has_bounded_growth_and_measured_checkpoint_latency -- --nocapture` — 32 checkpoints, fixed 3,495,330 journal bytes; p50 18.027 ms/max 27.580 ms. Debug Btrfs p50 486.909 ms/max 493.187 ms. Not a cadence, installed-app or power-loss guarantee.
- Passed: `pnpm check`, `pnpm test:browser`, `cargo fmt --all -- --check`, both default/feature Clippy commands with `--locked -- -D warnings`, feature-enabled desktop tests (4), default native build and `git diff --check`. Full exact commands are in M2 evidence.
- Passed: `env PATH=/nonexistent ./target/debug/deps/screenwriter_core-3be30fe149d9718f` (13) and `env PATH=/nonexistent ./target/debug/deps/recovery-2378064dda07a3aa` (12); final Prettier and local Markdown-link checks. No Git dependency.

## Remaining limits and next safe action

No recovery format/publication host blocker. Linux-only; no hardware power-loss, ACL/xattr/network filesystem or Tier 1 package claim. Errors after publication return failure; pending/quarantine artifacts remain protected. Older-session recovery blocks writes until explicit M2-05 adoption; no automatic cleanup, global orphan retention, restore, protected close or UI acknowledgement state. Same-disk recovery is not a disaster backup. Advisory ownership cannot exclude arbitrary external writers.

Claim **M2-03 Serialized source replacement** on its own branch. Read SPEC S10/S15, persistence/testing docs and ADRs 0010/0012/0013. Use native anchors/leases, independently protect recovery/previous source, implement serialized immutable requests and exact replacement success/failure classification. M2-04 owns IPC/UI stale receipts; M2-05 owns startup/retention/close. No editor before full M2 exit or real remote operation before M7 privacy/destination approval.
