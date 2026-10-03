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
- S-15 payoff: the stale `libbabel_desktop_lib.a`/`.so` copies under `target/debug{,/deps}` and `target/release{,/deps}` (8 files, about 2.2 GiB, no longer produced) were removed after the commit; nothing else in `target/` was touched.

## AUDIT-C01 — capture stays possible on standard Fountain edits and edge-space emphasis

Date: 2026-10-03. Base `004bd6d`, `main`, no push. Same host and toolchains as AUDIT-W0. [Brief](../tasks/AUDIT-C01.md).

Tier 2, single filesystem. No Tier 3 matrix: frontend codec/editor/UI state only; no Rust, filesystem, IPC or packaging change. **All evidence is mocked (vitest/JSDOM); typing is ProseMirror `tr.insertText`, not native WebView input.** No native drill was run.

### Changes

- C-01 codec: `replaceLines` tries an unchanged row's retained spelling, then the forcing marker inserted into it, then the generated spelling; `neighbor-drift` carries the drifting line; validation resolves priors by retained ID. Error codes and their order are unchanged.
- C-01 bridge: `captureEditor` widens to the drifting line in the structural and same-row-count branches, never across a protected row.
- C-01 commands: Enter at offset 0 of a speech row refuses; the tail of a split Scene Heading becomes Action; a join that would leave text after a closed parenthetical refuses.
- C-02: capture-only edge-whitespace unstyling in `sourceForInline`; `WritingView` clears its own capture alert after the next successful capture. Selection toggles and `replaceInline` keep their refusals.
- Docs: `docs/editor-behavior.md` (Enter/split/join, unforced-source re-spelling, edge whitespace, alert).

### Checks

| Check                                                                                                                                | Kind                  | Result                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------ | --------------------- | --------------------------------------------------------------------------------------- |
| `vitest run tests/contract/editor-unforced.test.ts` before the fix                                                                   | mocked                | red as intended — 34 failed / 3 passed (37)                                             |
| same file after the fix                                                                                                              | mocked                | pass — 37/37                                                                            |
| C-02 test in `editor-input.test.ts` with `fountainInline.ts` change stashed                                                          | mocked                | red as intended — 1 failed                                                              |
| alert test in `WritingView.test.tsx` with `WritingView.tsx` change stashed                                                           | mocked                | red as intended — 1 failed                                                              |
| Trial: report `neighbor-drift` ahead of owned-row `round-trip`                                                                       | mocked                | fail — 1 `production-fountain` code expectation; trial dropped, not needed, test intact |
| Trial: edge unstyling for every `sourceForInline` caller                                                                             | mocked                | fail — 2 existing refusal tests; narrowed to capture-only, both tests intact            |
| Focused: `editor-unforced`, `editor-keys`, `editor-bridge`, `production-fountain`, `fountain-complex`, `editor-input`, `WritingView` | mocked                | pass — 299/299                                                                          |
| `pnpm test`                                                                                                                          | mocked (vitest/jsdom) | pass — 813/813 (774 + 39 new); no existing expectation changed                          |
| `pnpm lint`, `pnpm typecheck`, `pnpm build`                                                                                          | static/build          | pass                                                                                    |
| `cargo fmt --all -- --check`                                                                                                         | static                | pass                                                                                    |
| `cargo clippy --workspace --all-targets --locked -- -D warnings`                                                                     | static, native build  | pass                                                                                    |
| `cargo test --workspace --locked`                                                                                                    | native (tmpfs)        | pass — 265/265 (no Rust change in this brief)                                           |
| `pnpm format:check`, `python3 tools/check-links.py`, `git diff --check`                                                              | static                | pass                                                                                    |

### Remaining uncapturable shapes (excluded from the property test by explicit predicates)

- Enter at the end of a speech row that is followed by another row of the same speech, then typing: the new Action row detaches the rest of the speech and Dialogue has no forcing marker. The Enter table belongs to AUDIT-D01.
- Edits that regroup dual dialogue (for example text typed between the two speeches): needs explicit group intent, unchanged contract.
- Edits beside protected rows (malformed parenthetical, unknown regions): the neighbour cannot be owned.
- Typing into non-blank rows (for example before a parenthetical's bracket or on a page break) is outside this brief's property domain.
- Not built, per the brief: journaling a draft bundle when capture fails and naming the offending row in the alert (needs an ADR and owner call; Tier 3).

The audit finder's random fuzz script is not in the repository; the deterministic property test over `fixtures/fountain/*.fountain` and the audit scene is the regression gate instead.

## AUDIT-C04 — a caret move no longer rewrites the manuscript

Date: 2026-10-03. Base `fe103bf`, `main`, no push. Same host and toolchains; native runs used the live Hyprland session over SSH. [Brief](../tasks/AUDIT-C04.md).

Tier 3 (`source_store.rs` is a filesystem-matrix path). Logs and JSON reports: `target/audit-c04/matrix/`; drill artifacts: `/tmp/babel-writing-eikyub67`, `target/babel-writing-mlti69k5`.

### Changes

- `source_store.rs` `save_next_with`: when the bytes read from the source equal the request, flush file and parent, re-validate ownership, return a `sourceFile` receipt for the new version with the unchanged fingerprint, and record it as `last_save`. No intent, candidate, `previous`, `confirmed`, lease or recents write. The recovery checkpoint for the version still runs first.
- No frontend, receipt, schema or IPC shape change.
- Changed expectation: `tests/source_save.rs` `no_op_save_preserves_bom_crlf_spaces_and_unknown_fountain_bytes` asserted that a no-op save published `previous` and a confirmed transaction. That was the defect (`SPEC.md:379`: "prefer not writing at all for a no-op"); it now asserts the unchanged fingerprint, no `previous`, `NoTransaction`. Byte-preservation assertions are unchanged.
- Docs: `docs/persistence-and-recovery.md`.

### Checks

| Check                                                                                          | Kind                            | Result                                                                                                             |
| ---------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `cargo test -p screenwriter-core --lib later_version_with_identical` with the fix stashed      | native (tmpfs)                  | red as intended — full replacement stages ran                                                                      |
| `cargo test -p screenwriter-core --locked source_store`                                        | native (tmpfs)                  | pass — 13/13 (2 new)                                                                                               |
| `cargo test -p babel-desktop --locked save_dispatch_acknowledges`                              | native files, MockRuntime IPC   | pass — 1/1 (new)                                                                                                   |
| `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`                                       | mocked / static / build         | pass — 813/813                                                                                                     |
| `cargo fmt --all -- --check`; `cargo clippy --workspace --all-targets --locked -- -D warnings` | static                          | pass                                                                                                               |
| `tools/run-workspace-matrix.py /tmp/babel-audit-c04 $PWD/target/audit-c04/btrfs`, run 1        | native (tmpfs)                  | fail — the `source_save.rs` no-op expectation above; Btrfs pass not reached                                        |
| same, run 2                                                                                    | native (tmpfs, Btrfs)           | tmpfs pass; Btrfs fail — `publication_cache_lease_restart_cleanup_and_private_modes` `CacheUnavailable` (log kept) |
| that publication test alone ×5 and `-p babel-desktop --lib` ×2 on the Btrfs root               | native (Btrfs), real PDF helper | pass 7/7 — not reproduced; cause not determined; publication code untouched by this brief                          |
| same matrix, run 3                                                                             | native (tmpfs, Btrfs)           | pass — 268/268 on each filesystem (265 + 3 new)                                                                    |
| `pnpm test:browser`                                                                            | browser (Chromium), no native   | pass                                                                                                               |
| `pnpm tauri build --no-bundle`                                                                 | native release build            | pass (also the first release link with the AUDIT-W0 `rlib`-only crate type)                                        |
| `python3 tests/native/writing-lifecycle/drill.py /tmp`                                         | native WebView + GTK (tmpfs)    | pass — 7/7 groups                                                                                                  |
| `python3 tests/native/writing-lifecycle/drill.py $PWD/target`                                  | native WebView + GTK (Btrfs)    | pass — 7/7 groups                                                                                                  |
| `pnpm format:check`, `python3 tools/check-links.py`, `git diff --check`                        | static                          | pass                                                                                                               |

### Limits

- No drill asserts the end-to-end case (a real click in the WebView leaves inode and mtime unchanged). The no-rewrite proof is the Rust tests on real files on both filesystems plus the MockRuntime IPC test; the drills show ordinary save, recovery, snapshot and divergence paths still pass on the new build.
- The intermittent Btrfs publication-cache failure is retained as an open observation, not explained.
- The status line still changes on every caret move (D-06, ordered after this brief). `prime()` still starts the dirty clock at open (optional in the audit; not done).
