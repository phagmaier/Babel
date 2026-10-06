# AUDIT-W0 — CI gate, desktop crate types, dead symbols

Status: **ready; first audit-execution brief**
Dependencies: none (runs first; unblocks later gates)
Requirements: QA-01 (CI gate). No behavior, persistence, IPC, or native-runtime change.

Covers three S-effort audit items with one shared Tier 2 gate: [T-02](../AUDIT.md#t-02--ci-has-not-executed-any-src-tauri-test-since-m4-12-and-nobody-recorded-that-it-is-red-medium-s-m-with-more-suites) (CI red since M4-12), [S-15](../AUDIT.md#s-15--staticlibcdylib-crate-types-in-the-desktop-crate-low-s-not-needed-before-v1) (crate types), [S-13](../AUDIT.md#s-13--small-dead-or-duplicated-symbols-low-s-45-lines-free-77-with-test-rewrites) (dead symbols). All locations verified 2026-10-03; re-grep before deleting (lines drift).

## T-02 — make `native-linux` run again

Cause: `src-tauri/src/enchant.rs:8` (`#[link(name = "enchant-2")]`, added M4-12) with no `libenchant-2-dev` on the runner. HEAD run shape: `rust-lld: unable to find library -lenchant-2`, no test `Running` lines, `tauri build` skipped.

1. Append `libenchant-2-dev` to the apt line in `.github/workflows/check.yml:31`.
2. Run `pnpm pdf-helper` before `cargo test --workspace --locked` (the helper runs today only via `beforeBuildCommand`; publication tests otherwise exercise an empty runtime dir).
3. The spellcheck host tests may also need a Hunspell dictionary on the runner (unverified per audit): if the first green run shows dictionary failures, record the exact missing package in evidence instead of broadening the install blindly.

Local CI cannot be executed here; the workflow itself is the gate and runs on the next owner-authorized push. Do not claim local green as CI green.

## S-15 — drop `staticlib`/`cdylib` from the desktop crate

`src-tauri/Cargo.toml:10` → `crate-type = ["rlib"]`. Mobile is a non-goal (`SPEC.md:115`); the audit refuted `windows_subsystem` (`main.rs:1`) and `mobile_entry_point` (`lib.rs:228`) as leftovers, so both stay. Rebuild and run the workspace suite once; expected payoff is ~2 GiB less `target/debug/deps` per tree, ~1–2 s link time.

## S-13 — verify-then-delete table

| Symbol                              | Location                                                                                                                    | Verified 2026-10-03                                                                                                                                 | Action                                                                                                                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `applyStructuralEditorTransaction`  | `src/editor/state.ts:~307`                                                                                                  | 1 hit repo-wide (the export)                                                                                                                        | delete (9 lines)                                                                                                                                                             |
| `CheckpointFailure` / `SaveFailure` | `src/application/documents.ts:~127/133`                                                                                     | 0 references outside definitions (shape parsed from `unknown` at `persistenceState.ts:~418-440`)                                                    | delete, or use the type at the parse site                                                                                                                                    |
| `MAX_VERSION`                       | `src/application/persistenceState.ts:~57`                                                                                   | 0 references (bound enforced by `Number.isSafeInteger`)                                                                                             | delete                                                                                                                                                                       |
| `.footer` rule                      | `src/styles.css:~99`                                                                                                        | 0 usages in tsx/ts/css                                                                                                                              | delete rule                                                                                                                                                                  |
| `sameIdentity` duplicate            | `src/application/snapshots.ts:~78` vs `persistenceState.ts:~64` (byte-identical bodies)                                     | canonical is `persistenceState.ts` (5 importers); `snapshots.ts` copy imported by `SnapshotPanel.tsx`, `workflowProtection.ts`, `writingSession.ts` | repoint those 3 imports, delete the copy                                                                                                                                     |
| SHA-256-to-hex ×3                   | `editorCapture.ts:~23` (private `sha256`, injection seam `options.hash`), `editorMetadata.ts:~19`, `writingSession.ts:~465` | 3 copies                                                                                                                                            | export the `editorCapture.ts` helper, reuse at the other two sites, keep the injection seam                                                                                  |
| `navigateLogicalText`               | `src/editor/outlineNavigation.ts:~98`                                                                                       | only caller coverage is `tests/ui/Outline.test.tsx` (it is the only coverage of live `logicalEditorOffset`)                                         | rewrite the 4 call sites onto the production navigation entry; if no production entry expresses an assertion, KEEP the function and record why instead of weakening the test |
| `unavailablePublication`            | `src/infrastructure/nativePublication.ts:~29`                                                                               | only used in `tests/contract/publication.test.ts`                                                                                                   | inline into the test or delete with its assertions                                                                                                                           |
| `inspect_local_recovery`            | `crates/.../linux.rs:~830`                                                                                                  | restart oracle for 2 tests (`recent_store_tests.rs`, `tests/recovery.rs`); documented native-only API                                               | reclassify as a test accessor (`#[cfg(test)]`/test module), do NOT delete                                                                                                    |

## Do NOT do

Remove `windows_subsystem` or `mobile_entry_point` (refuted, [dropped list](../AUDIT.md#dropped-or-refuted)); add packages beyond `libenchant-2-dev` (+ Hunspell dict only with evidence); touch any other audit item.

## Checks and stopping

Tier 2 (no Tier 3 matrix: no filesystem/IPC/packaging behavior change; the crate-type edit relinks identical code — record that rationale): focused `tsc --noEmit` + `eslint` on touched files, then full `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace` on a single filesystem (`CARGO_HOME=/tmp/babel-cargo`), plus `prettier --check`, `python3 tools/check-links.py`, `git diff --check`. Record one line per check in `docs/test-evidence/AUDIT.md` (new file, created here) with native-vs-mocked labels and the unverified Hunspell-dict question. Stop at this brief; no M6-03 or Local v1 admission.
