# Current state — M1 proofs complete

Date: 2026-09-27 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [M1 evidence](test-evidence/M1.md), [M1 gate review](m1-gate-review.md).

## Active milestone and trust boundary

M0 and M1-01–05 are complete for the bounded proofs on the recorded Linux host. M1-05 is ready for review on `M1-05-history-store-proof`, uncommitted; no next task is claimed. The app is still a skeleton unsafe for important manuscripts: New/Open are disabled; no production editor, saving/recovery, PDF export, history or remote operation exists. Proofs stay under `prototypes/`; the desktop links neither native proof crate. Production PDF/export UI stays gated to M5.

## Completed work and touched paths

M1-03 (`d47a2e0`) and M1-04 (`9cdadcb`) were reviewed, committed and fast-forwarded into local `main` at owner request. No remote is configured and nothing was pushed. Prior source/input/PDF/replacement evidence and ADRs 0007–0010 remain applicable.
M1-05 adds the [native history proof](../prototypes/history-store/README.md), [ADR 0011](decisions/0011-git2-history-store.md) and [M1 exit/M2 contract review](m1-gate-review.md): vendored git2, byte-exact curated snapshots/manifests, exclusive/CAS refs, new-child restore, protected conflicts, ancestry and local bare transport, corruption isolation and no-Git host runtime. No Local v1 requirement is complete.
Touched: `Cargo.toml`, `Cargo.lock`, `prototypes/history-store/`, `README.md`, `TODO.md`, `docs/decisions/0005-layered-safety.md`, `docs/decisions/0011-git2-history-store.md`, `docs/m1-gate-review.md`, index/development/testing/history/requirements/current-state docs and `docs/test-evidence/M1.md`. Tests use owned synthetic directories only; no personal credential/config discovery or user config changes.

## Exact verification and remaining limits

- Passed: `pnpm check` (13 frontend tests/build); `cargo fmt --all -- --check`; `CARGO_HOME=/tmp/babel-cargo cargo test --workspace --locked` (28 tests); feature-enabled desktop tests (2); default/feature Clippy with `--locked -- -D warnings`; `git diff --check`. Full exact commands, host and logs are in [M1-05 evidence](test-evidence/M1.md#m1-05--history-store-proof-and-m1-gate-review).
- Passed: 13 history tests on tmpfs/Btrfs and with Git absent from PATH, including concurrent CAS, divergent push, preserved restore/conflict ancestry and corruption isolation. Release probe reports vendored libgit2 1.9.7 and passes snapshots/fetch/push/restore with no Git; 2,042,304-byte executable links host zlib/libc/libgcc, not system libgit2. This is no installed-app/platform or authenticated-provider claim.
- No M1 host blocker. M2 source/recovery/queue/ack/history integration, native path security, Git power-loss/multi-ref durability and retention, pack limits, Tier 1 targets/packages/notices, and M7 auth/privacy remain open. M1-04 final-check external-writer race remains documented. PDF frozen profile, SC005/SC008, bundled helper and Tier 1 viewers remain M5 gates.

## Next safe action

Review M1-05 on its task branch, then start **M2-01 Identity and safe open** on its own branch using the reviewed native handle/source/ownership contracts. M1 exit is satisfied; M2 must prove the full safety foundation before M3. No production PDF/export UI before M5 or real remote operation before M7 privacy/destination approval.
