# AUDIT evidence — audit execution

Shared evidence file for `docs/tasks/AUDIT-*.md` briefs. `AUDIT.md` is frozen; progress is tracked in [TODO](../../TODO.md#audit-execution-auditmd-frozen-check-off-here-never-in-auditmd).

## AUDIT-W0 — CI gate, desktop crate types, dead symbols

Date: 2026-10-03. Base `d7e700f`, `main`, no push. Host: Linux x86_64 over SSH (no display); node 26.7.0, pnpm 11.22.0, Rust 1.97.1 (`RUSTUP_TOOLCHAIN=1.97.1`, `CARGO_HOME=/tmp/babel-cargo`). [Brief](../tasks/AUDIT-W0.md).

Tier 2, single filesystem (test roots on tmpfs `/tmp`). No Tier 3 matrix: no filesystem/IPC/packaging behavior change; the crate-type edit relinks identical code; the one moved Rust test keeps its body and `BABEL_RECOVERY_TEST_ROOT` selector. No `tauri build`, browser smoke or native/WebView run.

### Changes

- T-02: `.github/workflows/check.yml` `native-linux` — `libenchant-2-dev` appended to the apt line; `pnpm pdf-helper` runs before `cargo test --workspace --locked`.
- S-15: `src-tauri/Cargo.toml` `crate-type = ["rlib"]`. `windows_subsystem` and `mobile_entry_point` untouched.
- S-13 deleted: `applyStructuralEditorTransaction`, `CheckpointFailure`/`SaveFailure`, `MAX_VERSION`, `.footer` rule, `snapshots.ts` `sameIdentity` copy (3 importers repointed to `persistenceState.ts`), `navigateLogicalText`, `unavailablePublication` (with its one assertion).
- S-13 SHA-256: `editorCapture.ts` `sha256` exported and reused in `editorMetadata.ts` and `writingSession.ts`; `options.hash` injection seam unchanged.
- S-13 `navigateLogicalText`: all 4 `Outline.test.tsx` call sites now call production `navigateOutline(…, logicalEditorOffset(…))`; every assertion kept. None relied on the removed `try/catch`.
- S-13 `inspect_local_recovery`: kept as `#[cfg(test)] pub(crate)`. Integration tests cannot see `cfg(test)` items, so `unsaved_draft_reopens_by_recovery_identity_after_service_restart` moved from `tests/recovery.rs` into `recovery_store_tests.rs` with identical assertions. `docs/architecture.md` note updated.

### Checks

| Check                                                            | Kind                        | Result                                                         |
| ---------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------- |
| S-13 re-grep before deleting (all table rows)                    | static                      | pass — locations and reference counts match the brief          |
| `pnpm exec tsc --noEmit` (focused, first run)                    | static                      | fail — 4× `sameIdentity` unresolved in `writingSession.ts`     |
| `pnpm exec tsc --noEmit` (after adding the import)               | static                      | pass                                                           |
| `pnpm exec eslint <13 touched ts/tsx files>`                     | static                      | pass                                                           |
| `pnpm test`                                                      | mocked (vitest/jsdom)       | pass — 774/774                                                 |
| `pnpm lint`                                                      | static                      | pass                                                           |
| `pnpm typecheck`                                                 | static                      | pass                                                           |
| `pnpm build`                                                     | build                       | pass                                                           |
| `cargo fmt --all -- --check`                                     | static                      | pass                                                           |
| `cargo clippy --workspace --all-targets --locked -- -D warnings` | static, native build        | pass                                                           |
| `cargo test --workspace --locked`                                | native (tmpfs), MockRuntime | pass — 265/265, 19 suites                                      |
| `prettier --check` (touched files)                               | static                      | pass                                                           |
| `python3 tools/check-links.py`                                   | static                      | pass                                                           |
| `git diff --check`                                               | static                      | pass                                                           |
| GitHub `native-linux` / `frontend-and-core` workflow             | CI                          | **not run** — needs an owner-authorized push; local ≠ CI green |

### Open

- Hunspell dictionary on the CI runner: **unverified**. If the first pushed run shows spellcheck dictionary failures, record the exact missing package here before adding it.
- S-15 payoff not measured as freed space: the stale `libbabel_desktop_lib.a` (810 MB) and `.so` (230 MB) from earlier builds stay in `target/debug/deps` until that tree is cleaned; they are no longer produced.
