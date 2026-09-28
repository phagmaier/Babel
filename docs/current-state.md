# Current state — M1-01–04 complete

Date: 2026-09-27 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [M1 evidence](test-evidence/M1.md).

## Active milestone and trust boundary

M0 and M1-01–04 are complete on the recorded Linux host. M1-04 is ready for review on `M1-04-durable-replacement-proof`, uncommitted; no next task is claimed. The app remains a skeleton unsafe for important manuscripts: New/Open are disabled and no production editor, save/recovery, PDF export, history or remote operation exists. Proofs stay under `prototypes/`; the desktop does not link the replacement crate. Production PDF/export UI stays gated to M5.

## Completed work and touched paths

M1-03 was reviewed, committed as `d47a2e0`, and fast-forwarded into local `main`. Review pinned inspected Python transitives and clarified dependency wording; no blocking scope/code finding. There is no remote and nothing was pushed. Previous source/input/PDF evidence and ADRs 0007–0009 remain applicable.
M1-04 added the dependency-free [native replacement harness](../prototypes/durable-replacement/README.md) and [ADR 0010](decisions/0010-linux-durable-replacement.md): independent safety copies, exclusive candidate, sync/verify/recheck/rename/directory sync, exact receipt, explicit post-rename uncertainty, faults and SIGKILL barriers. Only synthetic temporary files are used and cleaned by the owning test.
Touched: `Cargo.toml`, `Cargo.lock`, `prototypes/durable-replacement/`, `README.md`, `TODO.md`, `docs/decisions/0005-layered-safety.md`, `docs/decisions/0010-linux-durable-replacement.md`, persistence/development/testing/requirements/current-state docs and `docs/test-evidence/M1.md`. No Local v1 requirement is complete.

## Exact verification and remaining limits

- Passed: `pnpm check` (13 tests/build); `cargo fmt --all -- --check`; `CARGO_HOME=/tmp/babel-cargo cargo test --workspace --locked` (15 tests); feature-enabled desktop tests (2); default/feature Clippy with `--locked -- -D warnings`; `git diff --check`. Full exact commands, host and logs are in [M1-04 evidence](test-evidence/M1.md#m1-04--durable-replacement-proof).
- Passed: 13 replacement tests on tmpfs and Btrfs, including 15 SIGKILL barriers per suite, 30 injected I/O failures, simulated ENOSPC, partial writes, native permission/rename errors, external-change checks and process ownership. Initial lock-lifetime failure was corrected with explicit unlock; ten subsequent parallel-suite runs passed. No native WebView/package claim is added by filesystem tests.
- No M1-04 host blocker. Power loss, other OS/filesystems, ACL/xattr/ownership policy, secure handle-relative paths, framed/versioned recovery, session/version races and production integration remain M2/M6 work. The documented final-check external-writer race is demonstrated. PDF frozen profile, SC005/SC008, bundled-helper packaging and Tier 1 viewer checks remain M5 gates.

## Next safe action

Review M1-04 on its task branch, then undertake **M1-05 history-store proof and M1 gate review** on its own branch. Use disposable repos/remotes only. Do not begin M2 until the M1 exit review; do not build production PDF/export UI before M5.
