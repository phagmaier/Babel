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

## AUDIT-D01 — portable Enter separators and explicit speech/break authoring

Date: 2026-10-03. Base `bc1476e`, clean main at claim; no push. [Brief](../tasks/AUDIT-D01.md). Same pinned toolchains as above. Tier 2, frontend-only; no filesystem/IPC/packaging changes, no second-filesystem matrix or native WebView drill. Browser smoke required; native Rust gates exercise existing services, not editor input. D-07's independent renderer/native scene oracle remains separate.

### Checks

- `pnpm exec vitest run tests/contract/editor-d01.test.ts tests/contract/editor-unforced.test.ts tests/ui/EditorControls.test.tsx --reporter=verbose --silent=false` — mocked/JSDOM, **red before fix**, 19 failed / 41 passed; missing separators/continuation, hard-break and dual commands/controls, newly included speech property cases; `/tmp/babel-audit-d01-red.log`.

- First implementation rerun of the same red command — mocked/JSDOM, fail 4 / pass 56; break-call insertion ownership missing, new dual test incorrectly held absolute byte offset constant, and two old Enter byte pins need approved separator changes; `/tmp/babel-audit-d01-first.log`.
- Deliberate expectations: `editor-keys` new Action caret moves past a separator (Shot likewise); hard-break refusal now tests unsupported Scene Heading, retaining refusal coverage; C01 heading/transition Enter pins gain separators and retain unforced spelling because grammar context no longer drifts. New dual test keeps logical selection and expects absolute byte anchors to advance by the inserted three marker bytes.

- `pnpm typecheck` first implementation — static, pass; `/tmp/babel-audit-d01-type-first.log`.
- Brief's 8-file focused run — mocked/JSDOM, fail 6 / pass 254; remaining old Enter index/byte/count pins, new unsupported-break test selected its leading blank, and a broad test-text substitution accidentally changed one unrelated transition-blank pin (restored); `/tmp/babel-audit-d01-focused.log`.
- Deliberate expectations: page-break/EOF append and composition-boundary tests gain the separator row; protected-neighbour regression moves the later typing target by one row and retains its exact protected bytes. Enter-table length checks strengthened to literal source bytes.

- Focused 8-file rerun — mocked/JSDOM, pass 260/260; `/tmp/babel-audit-d01-focused2.log`.
- `pnpm test` first shared run — mocked/JSDOM, pass 833/833 (34.32s); `/tmp/babel-audit-d01-shared-first.log`.
- Added edge regressions `pnpm exec vitest run tests/contract/editor-d01.test.ts --reporter=verbose --silent=false` — mocked/JSDOM, red 2 / pass 20: new capture postpass dereferenced a source-less virtual cue; remap test omitted storage and correctly refused to persist preferences; `/tmp/babel-audit-d01-edge-red.log` (guard added, test supplies storage).
- `cargo test --workspace --locked --offline` (Rust pin/cache above) — native files + MockRuntime, fail (57.24s log interval) at existing `source_acl_and_extended_attributes_are_rejected_without_silent_metadata_loss`: POSIX ACL fixture `fsetxattr` returns EINVAL in sandbox; `/tmp/babel-audit-d01-rust.log`.
- Same Rust command approved outside sandbox — native tmpfs files + MockRuntime, pass 268/268 (41.77s from fresh log birth-to-final-write timestamps); `/tmp/babel-audit-d01-rust-unrestricted.log`; no persistence code or test changed.
- `cargo fmt --all -- --check` — static, pass; `/tmp/babel-audit-d01-fmt.log`.
- `cargo clippy --workspace --all-targets --locked --offline -- -D warnings` — static/native compilation, pass; `/tmp/babel-audit-d01-clippy.log`.
- `pnpm lint` — static, pass; `/tmp/babel-audit-d01-lint.log`.
- `pnpm build` — frontend build, pass (existing >500 kB chunk advisory); `/tmp/babel-audit-d01-build.log`.
- `pnpm test:browser` restricted run — browser, fail before Chromium: local Vite server exits 1; `/tmp/babel-audit-d01-browser.log`; unrestricted retry approval interrupted by accidental owner denial, owner then explicitly resumed with unrestricted environment.

- Final focused 8-file command from the brief (`--reporter=verbose --silent=false`) — mocked/JSDOM, pass 262/262; `/tmp/babel-audit-d01-focused-final.log`.
- Final `pnpm test` — mocked/JSDOM, pass 835/835 (35.35s); `/tmp/babel-audit-d01-shared-final.log`.
- Final `pnpm lint` — static, pass; `/tmp/babel-audit-d01-lint-final.log`.
- Final `pnpm typecheck` — static, pass; `/tmp/babel-audit-d01-type-final.log`.
- Final `pnpm build` — frontend build, pass (same chunk-size advisory); `/tmp/babel-audit-d01-build-final.log`.
- `pnpm test:browser` unrestricted rerun — Chromium/browser + bundled offline helper, pass; `/tmp/babel-audit-d01-browser-unrestricted.log`; generic Home/viewer smoke, not D01 native writing/renderer acceptance.

### Behavior and limits

- SPEC S07.2 now explicitly describes the separator/caret and continuing-speech exception; its resulting element kinds stay unchanged, and table/source/caret/Undo tests changed together. Owning editor behavior and EDIT-02/03/05 correction mapping updated; frozen `AUDIT.md` unchanged.
- S-08 keep-set calls run at deferred capture, not on keys; tests spy on actual codec calls, preserve logical selection/marks/IDs and CRLF neighbour bytes, verify Undo/Redo and visible/remapped dual routing. The missing virtual-cue guard was found and corrected before completion.
- C01's mid-speech Enter exclusion removed; its independent dual-regroup/protected-neighbour exclusions remain. Other unsupported splits, whole-speech/select-all operations, inline-note authoring, schema rewrite and draft-bundle fallback remain outside this brief; D-07 still owns an independent Screenplain/PDF/native scene oracle.
- Recorded Btrfs cache issue remains untouched (no matrix run here); CI/Hunspell and native-click verification remain unrun/unverified. No unrelated finding fixed. Native editor input cases covering Character continuation/middle splits remain unchanged and were not rerun.

- Final-review Shot assertion `pnpm exec vitest run tests/contract/editor-keys.test.ts -t 'explicit Shot' --reporter=verbose --silent=false` — mocked/JSDOM, red 1/1 (33 skipped): new separator incorrectly inherited Shot metadata; `/tmp/babel-audit-d01-shot-red.log`; separator now clears subtype, authored Shot retained.
- `prettier --check` touched files — static, pass; `/tmp/babel-audit-d01-prettier.log`.
- `python3 tools/check-links.py` — static, pass 246 changed links; `/tmp/babel-audit-d01-links.log`.
- `sh tools/lint-py.sh` — static, pass 80 files; `/tmp/babel-audit-d01-python.log`.
- `git diff --check` — static, pass before final-review Shot correction; final check follows.

- Post-Shot focused 8-file rerun — mocked/JSDOM, pass 262/262 (13.75s); `/tmp/babel-audit-d01-focused-shot.log`.
- Post-Shot `pnpm test` — mocked/JSDOM, pass 835/835 (36.18s); `/tmp/babel-audit-d01-shared-shot.log`.
- Post-Shot `pnpm lint` — static, pass; `/tmp/babel-audit-d01-lint-shot.log`.
- Post-Shot `pnpm build` (includes `tsc --noEmit`) — static/frontend build, pass; `/tmp/babel-audit-d01-build-shot.log`.
- Final touched-file `prettier --check` — static, pass; `/tmp/babel-audit-d01-final-prettier.log`.
- Final `python3 tools/check-links.py` — static, pass 245 changed links; `/tmp/babel-audit-d01-final-links.log`.
- Final `sh tools/lint-py.sh` — static, pass 80 files; `/tmp/babel-audit-d01-final-python.log`.
- Final `git diff --check` — static, pass; frozen `AUDIT.md` diff empty; handoff 85 lines / 7,265 bytes.

## AUDIT-D08A — protected external Reload

Date: 2026-10-03. Base `2bc2311`, clean main at claim; owner permits a warranted
push. Same pinned toolchains/host as above, unrestricted environment. [Brief](../tasks/AUDIT-D08A.md).
Tier 3: native IPC, metadata/ownership/baseline behavior and protected disk adoption.
All fixtures synthetic/disposable; frozen AUDIT.md unchanged. Editor/JSDOM tests
remain mocked; source-store/IPC tests use actual files, IPC uses MockRuntime.

### Checks and retained failures

- `cargo test -p screenwriter-core reload_store --locked --offline` — native tmpfs, first implementation pass 4/4; `/tmp/babel-d08-native-first.log`.
- `pnpm typecheck` first implementation — fail: missing export `isDiskFingerprint`; existing validator exported/reused; `/tmp/babel-d08-type-first.log`; second run pass `/tmp/babel-d08-type-second.log`.
- Focused writing-session/controller/WritingView/command-dispatch Vitest — mocked/JSDOM, first run fail 1 / pass 81; Undo assertion ran before Reload thaw, corrected to wait for Save availability; `/tmp/babel-d08-focused-first.log`.
- Focused Undo rerun — mocked/JSDOM, pass 1/1 (30 skipped); `/tmp/babel-d08-undo-second.log`.
- `cargo test -p babel-desktop document_ipc --locked --offline` — actual tmpfs files + MockRuntime, pass 8/8; `/tmp/babel-d08-ipc-first.log`.
- First default `pnpm tauri build --no-bundle` — fail before native build: new UI-test mock literal/narrowing TypeScript errors; corrected without changing product behavior; `/tmp/babel-d08-release-first.log`, `/tmp/babel-d08-type-final.log`.
- First `pnpm lint` — pass; `/tmp/babel-d08-lint-first.log`.

### Scope and limits

- Source checks are serialized with frontend/native saves, never grant a saved version, and never import content automatically. Native window focus plus five-second polling are hints; existing pre-write guards remain authoritative. Comparison decoding is lazy on explicit expansion.
- Reload binds old live capture, exact reviewed disk fingerprint and prepared adopted capture; protects the old draft in checkpoint/snapshot/safety revision, then checkpoints/syncs/rechecks and acknowledges the adopted generation without source replacement. A new inode lease is acquired before adoption; ordinary history ownership checks remain unchanged.
- Native tests cover metadata-only atomic replacement, content replacement, subsequent Undo-version save, stale review/race and missing/unsafe/invalid-UTF8/history/identity refusal. Full target/platform/sync-product/power-loss and C1/F2 acceptance remain open.

- First `pnpm test` — mocked/JSDOM, pass 842/842 (34.66s), before lazy-comparison/version-reservation changes; `/tmp/babel-d08-shared-first.log`.
- Second focused Vitest — fail 1 / pass 81: test used unavailable `fireEvent.toggle`; fixed to dispatch the actual toggle event; third typecheck reported the same test API error; `/tmp/babel-d08-focused-second.log`, `/tmp/babel-d08-type-third.log`.
- Third focused Vitest — fail 1 / pass 81: existing recovered-outline availability assertion timed out during concurrent release/static builds; new Reload tests pass; no product/test expectation weakened, rerun below; `/tmp/babel-d08-focused-third.log`.
- First `pnpm test:browser` — fail at `page.goto` 30-second load timeout during concurrent builds; cause unconfirmed, rerun below; `/tmp/babel-d08-browser.log`.
- Second `pnpm tauri build --no-bundle` — default release build pass (native compile 3m03s), before final version-reservation/native race changes; `/tmp/babel-d08-release-second.log`.
- `cargo clippy --workspace --all-targets --locked --offline -- -D warnings` — pass (1m40s), before final version-reservation/native race changes; `/tmp/babel-d08-clippy.log`.
- Final-design focused `cargo test -p screenwriter-core reload_store --locked --offline` — native tmpfs pass 5/5, including post-adopted-checkpoint race and newer retained-draft recovery; `/tmp/babel-d08-native-final.log`.
- Latest static `pnpm lint` — fail: caught-error rule requires `cause` on Reload/protection AggregateError; cause retained, rerun below; `/tmp/babel-d08-lint-final.log`.
- Latest `pnpm typecheck` — pass; `/tmp/babel-d08-type-checked.log`.

- Latest focused six-file Vitest — mocked/JSDOM pass 129/129; `/tmp/babel-d08-focused-final.log`.
- Final `pnpm test` — mocked/JSDOM pass 843/843 (43.06s); `/tmp/babel-d08-shared-final.log`.
- `pnpm test:browser` rerun — Chromium + offline helper pass; `/tmp/babel-d08-browser-second.log`; generic smoke, not native Reload proof.
- First workspace matrix — actual tmpfs/Btrfs + MockRuntime pass 274/274 each (66.346s / 132.064s); `/tmp/babel-d08-matrix-first.log`, `target/audit-d08a/matrix/`; before the native-drill retry correction below.
- Final-design default release build — pass (native 44.89s); `/tmp/babel-d08-release-final.log`; before native-drill retry correction.
- Final-design Rust fmt/clippy — pass (clippy 9.98s); `/tmp/babel-d08-fmt-final.log`, `/tmp/babel-d08-clippy-final.log`; before native-drill retry correction.
- Lint rerun — fail: nested AggregateError must retain the inner caught protection error as cause; both errors remain in its array, cause corrected; `/tmp/babel-d08-lint-checked.log`; next `pnpm lint` pass `/tmp/babel-d08-lint-last.log`.
- `sh tools/lint-py.sh` — pass 80 files; `/tmp/babel-d08-python.log`.
- First actual default-WebKit Reload drill via `integrated_exit.py /tmp target --modes external-reload` — **0/2 strict**, retained `target/audit-d08a/native-first/`; tmpfs 41.44s `/tmp/babel-writing-4239ocuw`, Btrfs 29.30s `target/babel-writing-6rmeux7r`. Identical-byte re-anchor passed, clean Reload refused `checkpointConflict`; immutable same-version recovery base was lost after metadata re-anchoring. Retained draft was independently checkpointed at a skipped newer version. Cleanup ordinary-close precondition also failed because the writing session remained open; fallback owned teardown retained, crash audit clean on both, no gate credited.
- Corrected native exact-version retry regression `cargo test -p screenwriter-core reload_store --locked --offline` — actual tmpfs pass 6/6; `/tmp/babel-d08-native-retry.log`; exact existing frame reuses its original baseline, later versions use the rechecked baseline; save credit still needs a fresh receipt.

- Workspace rerun during `tauri build` — tmpfs desktop fail 5 / pass 53: publication `Internal`/`RendererUnavailable`; `/tmp/babel-d08-matrix-final.log`, `target/audit-d08a/matrix-final/`; build concurrently replaced `target/pdf-helper/runtime` (`build.py` deletes then renames it), so the stable-artifact precondition was not met. This orchestration error is retained; subsequent builds/matrix are sequenced, no test disabled.
- Corrected-retry default `pnpm tauri build --no-bundle` — pass (native 35.16s); `/tmp/babel-d08-release-retry.log`; bundled helper tree `c805d61692438d7ce7a8e5cd4fb0918b492296e41343be4a2847da7ad88748a8`.
- Corrected-retry Rust fmt/clippy — pass (clippy 4.55s); `/tmp/babel-d08-fmt-retry.log`, `/tmp/babel-d08-clippy-retry.log`.
- Second actual WebKit drill — **0/2 strict**, `target/audit-d08a/native-second/`: native identical-byte re-anchor and clean Reload/literal snapshot/revision/disk-inode assertions pass; harness clicked the hidden Undo button and WebDriver refused interaction. Replaced that harness step with the existing trusted Ctrl+Z route. Tmpfs 15.51s `/tmp/babel-writing-xfmzp6yp`, Btrfs 14.80s `target/babel-writing-5f6gvgc2`; failed ordinary-close precondition/fallback teardown retained, crash audit clean on both; no full native gate credited.

- Stable-runtime workspace matrix after build — native tmpfs/Btrfs + MockRuntime **pass 275/275 each**, 55.919s / 144.390s; `/tmp/babel-d08-matrix-after-build.log`, `target/audit-d08a/matrix-after-build/`; all root selectors bound, no check disabled.
- Final actual default-WebKit Reload drill — **2/2 strict**, tmpfs 25.09s `/tmp/babel-writing-y9xsmdo1`, Btrfs 26.41s `target/babel-writing-2x7dpxvg`; `/tmp/babel-d08-native-drill-third.log`, `target/audit-d08a/native-third/results.json`. Exact identical-byte re-anchor/clean and dirty Reload/snapshot and Git revision bytes/unchanged disk inode/Undo/later Save/Keep editing/protected close pass; continuous owned PID/start ledger, ordinary-close phases, bounded crash journal and no survivors retained.
- `audit_process_watch.py target/audit-d08a/native-third/results.json --output target/audit-d08a/native-third-replay` — read-only independent exact journal-window replay pass 2/2, zero owned crash events; `/tmp/babel-d08-crash-replay.log`; bounded clean samples do not resolve earlier C1/F2.
- Final `pnpm lint` / `pnpm typecheck` — static pass; `/tmp/babel-d08-lint-complete.log`, `/tmp/babel-d08-type-complete.log`.
- Final `sh tools/lint-py.sh` — pass 80 files; `/tmp/babel-d08-python-final.log`.

Native UI proof covers periodic detection and actual Reload/input/copy protection. Window-focus handler is wired through Tauri and JSDOM focus routing is tested; no independent timing-isolated native-focus-only gate is claimed. Full storage interruption/sync-product/platform acceptance remains separate.

- Final shared frontend after double-failure regression — `pnpm test`, mocked/JSDOM **pass 844/844** (33.43s); `/tmp/babel-d08-shared-complete.log`; added regression confirms both original Reload/protection failures, retained draft and visible copy route.
- Touched-file `prettier --check` — pass; `/tmp/babel-d08-format-check.log`; final doc refresh rerun below.
- `python3 tools/check-links.py` — pass 226 changed links; `/tmp/babel-d08-links-final.log`; final doc refresh rerun below.
- `git diff --check` — pass; final precommit rerun below. Frozen `AUDIT.md` remains untouched.

Push to existing `origin/main` is owner-authorized; CI is unrun until the completed
commit is pushed. Local checks/native samples do not imply GitHub CI success or
close the older C1/F2 failures. Final push/CI state is reported in the owner handoff.

- Final double-failure focused Vitest — mocked/JSDOM pass 1/1 (37 skipped); `/tmp/babel-d08-double-failure.log`.
- `python3 -m py_compile` new external Reload drill and changed drill/integrated runner — pass; actual native imports also exercised the new mode.
- Final touched prettier/local-link check and `git diff --check` — pass; `/tmp/babel-d08-format-precommit.log`, `/tmp/babel-d08-links-precommit.log`; no fixture source bytes formatted.

## AUDIT-W0-R1 — Enchant CI ABI prerequisite

Date: 2026-10-03. Base `e284a33`, main, owner continuation. Same pinned Linux
x86_64 host/toolchains as D08A; `RUSTUP_TOOLCHAIN=1.97.1`,
`CARGO_HOME=/tmp/babel-cargo`. [Brief](../tasks/AUDIT-W0-R1.md).

Tier 3: dependency/build cross-boundary failure, temporary-prefix native linking
and packaging checks. Application Enchant adapter/PWL/ownership behavior is
unchanged. CI uses upstream 2.8.21 (LGPL-2.1-or-later, existing dependency),
SHA-256 `dd2a762697c463148a8f59867089a5ebf2dd1449d869f93764b76c12bcf8acc0`;
Hunspell build headers and English resources are explicit runner prerequisites.
`pkg-config` 0.3.34 (MIT OR Apache-2.0, already transitive) is now a pinned direct
build-only dependency. No new application engine or runtime environment mutation.

### Checks and retained failures

- `gh run view 37124370824 --json status,conclusion,headSha,url,jobs` / `--log-failed` — actual pushed `e284a33` CI **fail**: frontend/core pass; `native-linux` linker cannot find `enchant_broker_request_dict_with_pwl`, desktop tests never start and release build skipped; Ubuntu installs `libenchant-2-dev` 2.3.3-2build2. Full log `/tmp/babel-audit-w0-r1-ci-failure.log`, [run](https://github.com/phagmaier/Babel/actions/runs/37124370824).
- Context7 Enchant/rrthomas and Rust pkg-config lookups — no matching C/crate documentation; verified [upstream NEWS](https://github.com/rrthomas/enchant/blob/v2.8.21/NEWS), release source/header/build options and [pkg-config 0.3.34 API](https://docs.rs/pkg-config/0.3.34/pkg_config/struct.Config.html) directly. The API was introduced in 2.4.0.
- First timing-wrapper command — **fail** before source build: `/usr/bin/time` absent (exit 127); corrected to shell `time`, no prerequisite bypass.
- `bash tools/ci-enchant.sh /tmp/babel-w0-r1-enchant` — actual native source build/English empty-PWL probe **pass**, 26.910s; `/tmp/babel-w0-r1-enchant-build.log`.
- Final builder `bash tools/ci-enchant.sh /tmp/babel-w0-r1-enchant-final` — actual native **pass**, 43.640s; positive ordinary-PWL control reads the seeded learned word and exclusion; explicit `/dev/null` ignores both; exact profile-tree comparison unchanged. `/tmp/babel-w0-r1-enchant-final.log`, source/install/probe/profile artifacts retained in that disposable root.
- Ubuntu dev `.deb` extracted to `/tmp/babel-w0-r1-old-enchant`; `PKG_CONFIG_PATH=<old>/usr/lib/x86_64-linux-gnu/pkgconfig cargo check -p babel-desktop --offline` — expected negative **pass** (exit 101): build script refuses actual 2.3.3 metadata with Enchant >=2.4 diagnostic before desktop link; `/tmp/babel-w0-r1-old-refusal.log`.
- `PKG_CONFIG_PATH=<prefix>/lib/pkgconfig LD_LIBRARY_PATH=<prefix>/lib cargo test -p babel-desktop spellcheck --locked --offline` — actual native **pass 3/3**, 1m34s compile + 0.75s tests; prefix is `/tmp/babel-w0-r1-enchant-final/install`; `/tmp/babel-w0-r1-spellcheck.log`.
- First `ldd` verification — **fail**, mistakenly used CI binary's hash in local path; corrected read-only lookup extracts local test binary from its log and proves `libenchant-2.so.2` loaded from the tested prefix; `/tmp/babel-w0-r1-loader.txt`.
- `pnpm check` first — mocked/JSDOM **fail**, 843/844, 91.91s overall: `Spellcheck.test.tsx` effective-language refresh focus expected SELECT, got BODY; during source/Rust builds, cause unproved. Full output `/tmp/babel-w0-r1-pnpm-check.log`; no frontend code/test changed or check disabled.
- `pnpm exec vitest run tests/ui/Spellcheck.test.tsx` — mocked/JSDOM focused rerun **pass 4/4**, 2.01s; `/tmp/babel-w0-r1-focus-rerun.log`; does not erase initial failure.
- `cargo fmt --all -- --check` — **pass**.
- Prefix-selected `cargo clippy --workspace --all-targets --locked --offline -- -D warnings` — static/native build **pass**, 37.08s; `/tmp/babel-w0-r1-clippy.log`.
- `shellcheck tools/ci-enchant.sh`, `bash -n tools/ci-enchant.sh` — **pass**.
- Final `pnpm check` — mocked/JSDOM/static/build **pass 844/844**, 73.18s overall (35.10s Vitest); formatting/lint/typecheck/build pass; `/tmp/babel-w0-r1-pnpm-check-final.log`. Existing bundle-size warning retained; initial focus failure not erased.
- `pnpm test:browser` — generic Chromium smoke **pass**; `/tmp/babel-w0-r1-browser.log`; no native IPC claim.
- Prefix-selected `python3 tools/run-workspace-matrix.py /tmp /home/phagmaier/Code/Babel/target --output target/audit-w0-r1/matrix -- cargo test --workspace --locked --offline` — actual native/filesystem + MockRuntime **pass 275/275 each**, tmpfs 70.047s / Btrfs 158.528s; every root selector bound; `/tmp/babel-w0-r1-matrix.log`, structured reports/raw logs under `target/audit-w0-r1/matrix/`. No PDF-helper build overlapped the matrix.
- Prefix-selected `XDG_CACHE_HOME=/tmp/babel-cache pnpm tauri build` — default release/package **pass**, Rust optimized build 2m28s, AppImage 119.73 MiB; `/tmp/babel-w0-r1-release.log`. Frozen binary SHA-256 `a6e57a4aff5258a1db6707b3c8d35d578c78952820517b73ca8e5ca3d1bfb18a`, loader/provenance `target/audit-w0-r1/bin/provenance.json`; no installed-AppImage claim.
- First native spelling launch — harness **fail 0/2**, wrong frozen-binary path (nonexistent basename); no app launched, zero recorded crash events/survivors; `/tmp/babel-w0-r1-native.log`, `target/audit-w0-r1/native/`.
- Correct-path spelling attempt — actual native **fail 0/2**, tmpfs 39.58s file-picker-close timeout, Btrfs 15.50s expected `babel-desktop` window-ownership assertion after correction/Undo byte checks; secondary teardown-at-Home assertions fail, no owned recorded crash/survivor. Owner reports concurrent manual input/interruption; the frozen executable also had a changed basename. Attribution is not established. `/tmp/babel-w0-r1-native-final.log`, `target/audit-w0-r1/native-final/`; both roots retained. Rerun preserves original executable basename in a hash directory; no harness assertion relaxed.

Completed raw logs are also copied to `target/audit-w0-r1/logs/` for retention.

- Original-basename offline spelling rerun — actual native content checks **pass 2/2**, strict **fail 0/2** (23.48s tmpfs / 27.67s Btrfs): scenario prints PASS but never closes the document, so ordinary teardown's Home assertion fails; zero recorded owned crashes/survivors. `target/audit-w0-r1/native-rerun/`, `/tmp/babel-w0-r1-native-rerun.log`. Original-basename client identity independently observed as `babel-desktop`; `target/audit-w0-r1/frozen-clients.json`. Add the missing protected close + independent source/fault audits; no assertion or check weakened.

- Protected-close spelling rerun — actual default-WebKit offline/native **pass 2/2 strict**, tmpfs 24.51s / Btrfs 29.71s; same frozen binary and tested Enchant prefix. Trusted correction, literal BOM/CRLF/marks/Unicode/Undo, Ignore/Add/restart, language/resource states, dictionary-only fault/source-save independence and protected close pass; literal source/fault bytes remain intact after close, bounded owned crash scans empty, zero survivors. `/tmp/babel-w0-r1-native-close.log`, `target/audit-w0-r1/native-close/results.json`, per-case ledgers/journals/phases and roots retained.
- `python3 -m py_compile tests/native/writing-lifecycle/spellcheck_workflows.py` — **pass**; later three-line harness-only protected-close correction is covered by the named real two-filesystem rerun against the unchanged binary; shared app gates were not unnecessarily repeated.
- Final touched prettier / changed local links (177) / shellcheck / shell syntax / `git diff --check` — **pass**; no author-content fixtures formatted.

Local acceptance complete; actual corrected pushed CI result is recorded below.
Implementation push is warranted under the owner's recorded origin/main permission.
C1/F2 unchanged; no
installed-distribution acceptance or full integrated/native-editor claim.

- Implementation commit `7d45253` pushed to existing `origin/main`; [first corrected CI](https://github.com/phagmaier/Babel/actions/runs/37157414707) **fail** in source-build prerequisite: `groff: fatal error: cannot load 'DESC' description file for device 'html'`, upstream `make enchant.html` exit 2 before Rust gates. Full log `/tmp/babel-w0-r1-ci-source-failure.log` (also retained under `target/audit-w0-r1/logs/`); add exactly `groff` to the runner's apt prerequisites, preserving upstream build/checks.
- `49129df` groff prerequisite follow-up pushed; `gh run view 37157598075 --json status,conclusion,headSha,url,jobs` / `--log` — [actual corrected CI **pass**](https://github.com/phagmaier/Babel/actions/runs/37157598075), completed success at exact `49129df390d8ad39593dc2d1b152b6676161fb7e`; frontend/core job 105s (frontend 844/844, Rust fmt/core suites), native job 631s (pinned source build/ordinary-PWL control/empty-PWL probe, clippy, PDF helper, native workspace **275/275**, default package build). Full metadata `target/audit-w0-r1/ci-final.json`, raw log `target/audit-w0-r1/logs/ci-final.log`; initial corrected-run metadata `ci-first.json`. Runner is Ubuntu 24.04; no installed/native-UI distribution support claim.
- Final evidence/handoff-only update: touched prettier, changed local-link checks and `git diff --check` pass; no additional executable change or repeated expensive gate. Implementation/prerequisite commits are pushed; completion evidence is committed locally for review.

## AUDIT-C356 — Literal escapes, SELinux metadata and advisory highlights

Date: 2026-10-03. Base `08986eb`, clean main at claim; owner authorizes warranted
push. [Brief](../tasks/AUDIT-C356.md). Same pinned host toolchains; Tier 3 for
native metadata. Frozen audit and all prior failed roots/logs/cores preserved.

- `gh run view 37158997960 --json status,conclusion,headSha,url,jobs` — actual CI **pass** on `08986eb`, both frontend/core and native-linux jobs successful; no prior expensive suite rerun for the documentation commit.
- `pnpm exec vitest run tests/contract/fountain-complex.test.ts tests/ui/FindPanel.test.tsx` — JSDOM/codec expected **red**, 2 failed/54 passed, unnecessary bracket/path escaping and Find erased by clearing check; `/tmp/babel-c356-red-frontend.log`.
- `python3 tools/pdf-helper/test_helper.py HelperTest.test_frozen_profile_literal_escapes` — actual frozen-helper + independent Poppler expected **red**, escaped brackets/backslashes printed and escaped underscores misstyled; `/tmp/babel-c356-red-renderer.log`.
- `cargo test -p screenwriter-core selinux_xattr_name --locked --offline` — prerequisite **blocked** in sandbox temporary cache (missing rfd); network retry failed DNS, `/tmp/babel-c356-red-metadata.log`, `/tmp/babel-c356-red-metadata-retry.log`; unrestricted retry resolved prerequisites and produced expected **red** exact SELinux-name refusal, `/tmp/babel-c356-red-metadata-unrestricted.log`.
- `pnpm exec vitest run tests/ui/WritingView.test.tsx -t AUDIT-C356` — initial harness **fail** (no scene/outline target); corrected synthetic scene fixture retained, then expected **red 2/2** on Next match, with/without retained Script Check; `/tmp/babel-c356-red-integration.log`, `/tmp/babel-c356-red-integration-retry.log`.
- Initial focused 7-file frontend run — **fail 1/168** only the deliberately obsolete blanket backslash expectation; independent literal review updates that one spelling to a single ordinary backslash, keeps round-trip/no-op/style/neighbor assertions; `/tmp/babel-c356-focused-full.log`.
- Final focused `vitest` codec/editor-bridge/find/script-check/FindPanel/ScriptCheckPanel/WritingView — JSDOM/codec **pass 168/168**, 11.92s; independent plugin clearing, retained-report Next/Previous/caret, state identity/source/Undo, existing stale/composition/frozen gates; `/tmp/babel-c356-focused-final.log`.
- `cargo test -p screenwriter-core metadata --locked --offline` — unrestricted native/injected-name tests **pass**; exact label exemption, bounded single-call read and read-failure refusal, existing metadata safety checks; `/tmp/babel-c356-metadata-full.log`.
- `python3 tools/pdf-helper/build.py --offline` — actual pinned helper **pass**, final tree `808d2276543fce73967f8c66166d5e61a676282e094716da3e42b7831454086a`; native pin/review identity advance together, profile/dependency/font versions unchanged; `/tmp/babel-c356-helper-build-final.log`.
- `python3 tools/pdf-helper/test_helper.py` — actual helper/Poppler/native offline namespace **pass 13/13**, 3.648s, including literal PDF escapes/title and direct AST style assertions; `/tmp/babel-c356-helper-tests.log`.
- `target/dev-python/bin/python tools/pdf-helper/test_profile.py --output target/audit-c356/profile-final` — actual helper/pypdf/Poppler **pass**, 13 corpus cases/22 unchanged accepted raster pages/13 boundaries; all golden/fixture bytes preserved, fresh outputs retained; `/tmp/babel-c356-profile.log`.
- Initial `pnpm check` — **fail** at lint, redundant bracket regex escape (`no-useless-escape`); removed the redundant escape without changing matching, `/tmp/babel-c356-check.log`; timed rerun below.
- Initial `cargo clippy --workspace --all-targets --locked --offline -- -D warnings` — prerequisite **blocked**, missing cached adler2; `/tmp/babel-c356-clippy.log`, online unrestricted retry required.
- `python3 -m py_compile tools/pdf-helper/frozen_profile.py tools/pdf-helper/test_helper.py` — **pass**. Initial changed-link check — **fail**, new evidence heading not yet appended plus draft C-03 anchor typo; `/tmp/babel-c356-links-initial.log`; corrected final checks below.

- `pnpm check` final timed rerun — JSDOM/shared static/build **pass 848/848** across 65 files, 72.116s; formatting/lint/typecheck/production build pass, existing chunk-size advisory retained; `/tmp/babel-c356-check-final.{log,json}`.
- `cargo fmt --all -- --check` — unrestricted **pass**; `cargo clippy --workspace --all-targets --locked -- -D warnings` — unrestricted **pass**, 39.51s; `/tmp/babel-c356-clippy-retry.log`.
- `python3 tools/check-links.py` — **pass 205 changed links** after heading/anchor completion; unsupported `--help` was interpreted as a file in an initial CLI probe, no source change; `/tmp/babel-c356-links-final.log`. `git diff --check` — **pass** at this stage; final rerun after handoff.

- `RUSTUP_TOOLCHAIN=1.97.1 CARGO_HOME=/tmp/babel-cargo python3 tools/run-workspace-matrix.py /tmp/babel-c356-matrix $PWD/target/audit-c356/matrix-root --output target/audit-c356/workspace -- cargo test --workspace --locked --offline` — unrestricted actual native **pass 277/277 each**, tmpfs 109.538s/Btrfs 155.014s; canonical complete selector list, native metadata/source save/Save As/PDF/snapshot/recovery/history/lease/IPC and publication integrity regressions; logs/reports retained under `target/audit-c356/workspace/`. No generated-runtime build overlapped either run.
- `pnpm test:browser` — sandbox **blocked**, Vite exited 1 before launch; `/tmp/babel-c356-browser.{log,json}`. Unrestricted headless Chromium rerun **pass**, 36.408s; `/tmp/babel-c356-browser-unrestricted.{log,json}`. No shared keyboard/mouse input.
- Host metadata coverage — `/sys/fs/selinux/enforce` absent; exact SELinux-name injected test **pass 1/1** (`/tmp/babel-c356-focused-metadata.log`). Real ACL/user-xattr refusal uses existing source-save tests in both matrix runs; no fabricated enforcing-label success.

- `RUSTUP_TOOLCHAIN=1.97.1 CARGO_HOME=/tmp/babel-cargo XDG_CACHE_HOME=/tmp/babel-cache pnpm tauri build` — unrestricted default release/AppImage **pass**, 142.378s; `/tmp/babel-c356-package.{log,json}`. Build ran after matrix completion; deterministic helper tree stays `808d2276…`.
- AppImage `--appimage-extract` into fresh `target/audit-c356/package/`, then `python3 tools/pdf-helper/verify_runtime.py <extracted>/usr/lib/babel/pdf-helper` — actual packaged integrity **pass**, no problems and exact expected tree; `/tmp/babel-c356-extract.log`, `/tmp/babel-c356-packaged-integrity.log`.
- `BABEL_PDF_HELPER_RUNTIME=<extracted>/usr/lib/babel/pdf-helper unshare --user --net python3 tools/pdf-helper/test_helper.py HelperTest.test_frozen_profile_literal_escapes HelperTest.test_frozen_escape_styles_and_title` — actual packaged helper, offline namespace/Poppler **pass 2/2**, 1.061s; `/tmp/babel-c356-packaged-escapes.log`. No GUI or shared input.
- Retained check logs/reports copied from `/tmp/babel-c356-*` files into `target/audit-c356/logs/`; prior audit/M6 failed roots/logs/cores untouched. Frozen `AUDIT.md`, Fountain fixture bytes and accepted goldens have no Git diff.

- Final `pnpm format:check`, changed-link checker and `git diff --check` — **pass** after completion/handoff; final logs `/tmp/babel-c356-final-format-check.log`, `/tmp/babel-c356-final-links.log`.

Coverage limits: SELinux names/syscall failures are injected unit evidence; actual
Arch tmpfs/Btrfs descriptors, ACL/user-xattr refusal and publication safety use
real syscalls. No enforcing SELinux/Fedora host is available; label transition
policy and target-host acceptance remain unverified. Unknown metadata retains
the existing typed refusal, with no IPC/error-shape change. Frontend highlights
are JSDOM/browser evidence; no native WebKit/editor/input timing claim. Direct
helper tests and native publication resource checks cover rendering/integrity;
no shared-keyboard GUI drill/full integrated matrix for this cluster. C1/F2,
M6-02 disposition and Local v1 admission remain open. Stop after C356.
