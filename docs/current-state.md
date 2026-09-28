# Current state — M2-01 complete

Date: 2026-09-28 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [M2 evidence](test-evidence/M2.md), [ADR 0012](decisions/0012-native-document-identity.md).

## Active task and trust boundary

M0 and bounded M1 proofs are complete; M1-05 is committed on main (`7b9533f`). **M2-01 Identity and safe open is complete**, uncommitted and ready for review on `M2-01-identity-safe-open`. No next task is claimed. The app remains unsafe for important manuscripts: New/Open are disabled and native picker integration is unwired. No source saving/recovery, production editor, PDF export, history UI or remote operation exists. M2 exit is open; production PDF UI stays gated to M5.

## Completed work and touched paths

- Native Linux `DocumentService`: exact immutable source bytes and strong fingerprint, opaque random handles/session/document IDs, persistent loose identity, conservative managed metadata and view-only fallbacks, no-follow anchored paths, stable cooperating leases and native ownership revalidation. Source and project metadata are never written by open. Unsaved identity is allocated without claiming recovery protection.
- Strict path-free `read_open_document`/`release_open_document` IPC and TypeScript port. Default desktop state is unavailable until a native controller supplies selection; no filesystem plugin permissions or write endpoint added. Tauri MockRuntime dispatch tests are contract evidence, not WebView E2E.
- Touched: `crates/screenwriter-core/{Cargo.toml,src/,tests/}`, `Cargo.lock`, `src-tauri/{Cargo.toml,src/}`, `src/application/documents.ts`, `src/infrastructure/nativeDocuments.ts`, `tests/contract/document-ipc.test.ts`, README/TODO and architecture/document-model/persistence/development/testing/requirements/index/current-state docs, ADR 0012 and `docs/test-evidence/M2.md`.

## Exact verification

Host: Linux 7.2.5-3-omarchy x86_64; Rust/Cargo 1.97.1, Node 26.7.0, pnpm 11.22.0; tmpfs and Btrfs. Every command below passed; exact logs and earlier corrected failures are in [M2 evidence](test-evidence/M2.md).

- `pnpm check` — format/lint/typecheck, 16 tests, frontend build.
- `pnpm test:browser` — Chromium disabled-shell smoke, not native WebView.
- `cargo fmt --all -- --check` — workspace formatting.
- `CARGO_HOME=/tmp/babel-cargo cargo test --workspace --locked` — 56 tests including 26 safe-open entries (one child harness entry runs its assertions only in the explicit subprocess).
- `BABEL_OPEN_TEST_ROOT=/home/phagmaier/Code/babel CARGO_HOME=/tmp/babel-cargo cargo test -p screenwriter-core --test safe_open --locked` — 26 Btrfs entries.
- `env PATH=/nonexistent ./target/debug/deps/safe_open-262d79d050ef77a7` — 26 tmpfs entries; Git absent.
- `CARGO_HOME=/tmp/babel-cargo cargo test -p babel-desktop --features native-editor-proof --locked` — 4 desktop/IPC tests.
- `CARGO_HOME=/tmp/babel-cargo cargo clippy --workspace --all-targets --locked -- -D warnings` — default lint.
- `CARGO_HOME=/tmp/babel-cargo cargo clippy -p babel-desktop --all-targets --features native-editor-proof --locked -- -D warnings` — feature lint.
- `CARGO_HOME=/tmp/babel-cargo cargo build -p babel-desktop --locked` — default-feature debug build, no test hooks.
- `git diff --check` and local relative-Markdown-link audit — passed.

## Remaining limits and next safe action

No M2-01 host blocker. Linux-only adapter; conservative symlink rejection, ordinary mode/owner checks, no ACL/xattr/network/power-loss/non-Linux/package claim. No privileged foreign-owner fixture was run. Advisory leases require cooperating writers and a common app-data store; external programs can race checks. Corrupt/newer identity records remain untouched/view-only. Managed rename is a view-only mapping candidate, not automatic repair. Stable lock/registry cleanup and loose relinking remain future work. M1 durability, PDF and packaging limits remain in their owning ADRs/evidence.

Review M2-01, then claim **M2-02 Recovery checkpoint format** on its own branch. Read SPEC S10/S15, persistence/testing docs, ADRs 0010/0012 and M2 evidence; implement independent framed/checksummed recovery for named/unsaved identities, exact acknowledged versions and safe compaction. Saving waits for M2-02/03; editor work waits for full M2 exit. No real remote operation before M7 privacy/destination approval.
