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

- Git boundary — sandbox staging/commit refused `.git/index.lock` (read-only); explicitly authorized unrestricted commit/push succeeded. Implementation `614cb8d` pushed to existing origin/main, clean tree; no force or branch change. CI queries that failed sandbox API access were retried read-only unrestricted.
- `gh run view 37161598998 --json status,conclusion,headSha,url,jobs` — actual implementation CI **pass** on `614cb8db97a52c6fd324bb8ab03b07904d83afec`, both frontend/core and native-linux workspace/package jobs successful; [run](https://github.com/phagmaier/Babel/actions/runs/37161598998). Documentation-only completion records this actual result; completed expensive local suites were not rerun.

Coverage limits: SELinux names/syscall failures are injected unit evidence; actual
Arch tmpfs/Btrfs descriptors, ACL/user-xattr refusal and publication safety use
real syscalls. No enforcing SELinux/Fedora host is available; label transition
policy and target-host acceptance remain unverified. Unknown metadata retains
the existing typed refusal, with no IPC/error-shape change. Frontend highlights
are JSDOM/browser evidence; no native WebKit/editor/input timing claim. Direct
helper tests and native publication resource checks cover rendering/integrity;
no shared-keyboard GUI drill/full integrated matrix for this cluster. C1/F2,
M6-02 disposition and Local v1 admission remain open. Stop after C356.

## AUDIT-TEST — Wave 2 regression gaps

Date: 2026-10-03. Base `fb7d6bd`, clean main at claim. Authorized continuation
from Wave 1; [brief](../tasks/AUDIT-TEST.md). Node 26.7.0, pnpm 11.22.0,
Rust 1.97.1 and host Enchant 2.8.21 verified. Tier 2 frontend/session change;
frozen audit, earlier failures/cores, fixtures and PDF goldens preserved.

- Initial `pnpm exec vitest run tests/contract/writing-session.test.ts tests/contract/persistence-controller.test.ts` — injected-port/JSDOM expected **red 4/100**, 4.21s: disposed resume/inspect/capture dereferences null cadence; release rejection replaces protection error. `/tmp/babel-audit-test-initial.log`. Both parked T-03 observations reproduced before production edit; no native loss finding inferred.
- Initial editor-input/Script Check focused run — test-harness **fail 1/32**, same-byte cross-realm Uint8Array comparison; corrected to explicit byte arrays, no expected-byte change. `/tmp/babel-audit-test-input-initial.log`.
- Initial WritingView focused runs — test-harness **fail**, incorrect mount return shape/button/status labels, click before replace freshness, automatic check refresh expectation and assumption selection cannot advance draft metadata. Corrected to real view API, fresh enabled controls, explicit Refresh check and unchanged doc/source/Undo assertions. `/tmp/babel-audit-test-view-{initial,rerun,rerun2,final-focus,focus-corrected}.log`; `/tmp/babel-audit-test-replace-rerun.log`.
- Initial/final-in-progress typecheck — test-fixture **fail**, used route kind `recovered` as native document kind and widened literal types. Corrected to actual native resumed `unsaved` registration and typed literals; `/tmp/babel-audit-test-types.log`; corrected typecheck **pass**, `/tmp/babel-audit-test-types-final.log`.
- `pnpm exec vitest run tests/contract/writing-session.test.ts tests/contract/persistence-controller.test.ts tests/contract/editor-input.test.ts tests/contract/script-check.test.ts tests/ui/Home.test.tsx tests/ui/RecoveryReview.test.tsx` — injected-port/JSDOM/codec **pass 148/148**, 3.21s, before fixture type corrections; `/tmp/babel-audit-test-contracts.log`.
- `pnpm exec vitest run tests/ui/WritingView.test.tsx -t AUDIT-TEST` — injected-port/JSDOM **pass 7/7**, 4.73s: recovered route, replace-one/all and composition refusal, Check/Go to/stale Refresh, prepared restore/lock/Undo/adoption failure, resolve identity/baseline; `/tmp/babel-audit-test-view-focus-final.log`. Later strengthened adoption-failure next Save to inject sourceChanged instead of fake success; final full focused check below.
- `python3 tools/audit-test-mutations.py target/audit-test/mutations` — in-memory fault injection **pass 25/25 detected**, 71.193s summed child elapsed: eight named session guards plus resolution identity, five controller guards, paste prefix/suffix, SC002/SC004, prepared restore/resolve adoption, replace-one/all/check navigation, Resume button/Home routing. Each fresh process records transformed-module load and real failed test assertions; import/compile errors do not count. Production files never written; JSON/config/raw logs under `target/audit-test/mutations/`, `/tmp/babel-audit-test-mutations.log`.
- First full seven-file focused rerun — test-fixture **fail 1/188**, 14.68s: one stale expected `recovered` native kind remained after typing corrected it to `unsaved`; assertion corrected to the native contract, `/tmp/babel-audit-test-focused.log`.

T-08 remainder: the existing tracked canonical runner was already exercised by
[AUDIT-C356's full-selector tmpfs/Btrfs matrix](#audit-c356--literal-escapes-selinux-metadata-and-advisory-highlights),
277/277 each; this closes the tracker condition "first Tier 3 run". No older M6
selector claim is rewritten and no new two-filesystem run is claimed here.
Coverage remains injected-port/JSDOM/codec, with generic browser smoke below;
no trusted IME, real native restore failure/cleanup, package or target-host gate.
Native disk/IPC/packaging code is unchanged, so no Tier 3/native drill or repeated
PDF corpus/package run is required. The original recovery stays preserved;
native release retries and duplicate persisted draft entries remain outside this
frontend task. C1/F2, enforcing SELinux, M6-02 and Local v1 admission remain open.

- `pnpm exec vitest run` with the seven focused files above — injected-port/JSDOM/codec **pass 188/188**, 15.17s; `/tmp/babel-audit-test-focused-final.log`. Includes strengthened post-restore sourceChanged refusal after editor adoption failure; this is simulated native behavior, not a real filesystem/crash claim.
- First `pnpm check` — **fail** at lint, 12.914s: `preserve-caught-error` requires nested cleanup as the AggregateError cause. Corrected cause chain, retaining both errors and the original protection message; `/tmp/babel-audit-test-check.{log,json}`. No rule disabled.
- Final `pnpm check` — JSDOM/shared static/build **pass 914/914** across 65 files, 64.194s, **66 added tests**; formatting/lint/typecheck/production Vite build pass. Existing JSDOM scrollBy notices and bundle-size advisory retained; `/tmp/babel-audit-test-check-final.{log,json}`.
- `CARGO_HOME=/tmp/babel-cargo RUSTUP_TOOLCHAIN=1.97.1 cargo fmt --all -- --check` — **pass**, 0.472s; `cargo clippy --workspace --all-targets --locked --offline -- -D warnings` — native/static **pass**, 5.365s; `/tmp/babel-audit-test-{rust-format,clippy}.{log,json}`.
- Same environment `cargo test --workspace --locked --offline` — actual native/filesystem + MockRuntime shared **pass 277/277**, 61.553s, single default filesystem; `/tmp/babel-audit-test-workspace.{log,json}`. Native publication/recovery/restore/lease suites unchanged; no helper build overlapped it, no second-filesystem claim.
- `gh run view 37162233268 --json status,conclusion,headSha,url` — actual prior documentation CI **pass** at exact `fb7d6bd5bf034458afd950d5f9632382b6d5b99b`; [run](https://github.com/phagmaier/Babel/actions/runs/37162233268), `/tmp/babel-audit-test-prior-ci.json`. This is the pre-task checkout, not CI for AUDIT-TEST.
- Read-only inspection of `target/audit-c356/workspace/workspace-{tmpfs,btrfs}.json` — **pass**, exit 0 and all 16 selectors (including open and M2 exit) retained, tmpfs 109.538s/Btrfs 155.014s; validates T-08's prior completed runner evidence, not a new run.

- Final `python3 tools/audit-test-mutations.py target/audit-test/mutations-final` — unmodified injected-port/JSDOM **control pass 188/188**, 16.206s, then **25/25 faults detected**, 70.998s summed child elapsed. Strengthened runner requires the passing control before mutation; each mutant is an in-memory transform, production files remain unchanged. Complete control/config/load-marker/report/raw-log artifacts retained in the new root; `/tmp/babel-audit-test-mutations-final.log`.
- `pnpm test:browser` — generic headless Chromium smoke **pass**, 12.187s; `/tmp/babel-audit-test-browser.{log,json}`. No shared mouse/keyboard, native IPC or trusted composition claim.
- `python3 -m py_compile tools/audit-test-mutations.py` — **pass**; runner executable path also verified by both recorded runs.

Acceptance complete: **66 added tests** and the two directly reproduced frontend
resume corrections. All eight named session guards and the controller/structured
paste/report mappings are covered; the mutation tool is tracked and repeatable.
No existing assertions were weakened and no production mutation was persisted.
Work remains local on main for review; no new CI result or push claimed.
Stop after AUDIT-TEST; Wave 3 is unstarted. Native release retries and duplicate
persisted draft entries remain separate follow-ups; enforcing SELinux, C1/F2,
M6-02 and Local v1 admission stay open.

- Completion `pnpm format:check`, `python3 tools/check-links.py` (**165 changed links; final handoff compression rerun 164**) and `git diff --check` — **pass**; `/tmp/babel-audit-test-final-format-check.log`, `/tmp/babel-audit-test-final-links.log`, final reruns `/tmp/babel-audit-test-last-{format-check,links}.log`. Handoff stays bounded (92 lines / 8,116 bytes); frozen audit, byte-sensitive fixtures, accepted goldens, native sources and dependency files have no diff.

## AUDIT-SLP-A — unused import, read, relink and status paths

Base `09d496f`, main, 2026-10-03. S-06/S-07/S-09/S-10; [brief](../tasks/AUDIT-SLP-A.md). Sole workflow import preserves existing coordinator refusal wording, staged text, exact safety protection and Undo. Removed read IPC is covered through native entry/release and internal registration oracles; approved native-only relink deletion retains M4-01 locate/confirm coverage. Unmounted SaveStatus assertions now exercise WritingView. `AUDIT.md`, byte-sensitive fixtures, dependencies and PDF pins/goldens remain unchanged. Artifacts below are retained under `target/audit-slp-a/` unless absolute roots are named.

- `python3 target/audit-slp-a/check-removed.py` before production edits — expected **red**, all ten obsolete surfaces/registrations present; `removed-red.log`. Equivalent check is now tracked in `tools/audit-test-mutations.py --slp-a`.
- Initial `pnpm typecheck` — **fail**, seven remaining migration sites (obsolete reader/import adapter/constructor and view fixture); corrected to the live entry/coordinator contracts, `types-initial.log`; `types-rewire.log` and `types-status.log` **pass**.
- Six-file focused `pnpm exec vitest run tests/ui/EditorInput.test.ts tests/ui/WritingView.test.tsx tests/contract/workflow-protection.test.ts tests/contract/document-ipc.test.ts tests/contract/document-entry.test.ts tests/contract/recent-projects.test.ts` — injected-port/JSDOM **pass 80/80** before the added receipt/stale guard cases, 15.08s; `focused-1.log`.
- Focused `focused-2.log` and full `pnpm-check-2.log` — **fail 1/84 and 1/918**, 14.90s/60.195s: synthetic composition event cannot enter a frozen editor; adversarial composing state now explicitly mocked, no production defect or oracle change. Final focused same six files **pass 84/84**, 21.296s, `focused-3.{log,json}`; later snapshot-attention sample is covered by the final shared/control runs.
- First timing wrapper `/usr/bin/time -p pnpm check` — **blocked**, executable absent (exit 127); `pnpm-check-1.log`; task-local Python subprocess timer used for subsequent commands, no packages/settings changed.
- `CARGO_HOME=/tmp/babel-cargo cargo test -p babel-desktop --locked document_ipc_tests` — Tauri MockRuntime/native filesystem **pass 8/8**, 13.04s compilation + 0.06s tests; `ipc-focused-1.log`; initial unused WorkflowOperation warning moved to test-only import. Release dispatch still refuses injected paths/foreign sessions and revokes the handle; removed commands refuse dispatch.
- `CARGO_HOME=/tmp/babel-cargo cargo clippy --workspace --all-targets --locked -- -D warnings` — first **fail** on three helpers/constants used only by deleted relink tests, `clippy-1.log`; removed dedicated scaffolding; final **pass**, 0.545s, `clippy-2.{log,json}`.
- `CARGO_HOME=/tmp/babel-cargo cargo test --workspace --locked editor_import` — native filesystem **pass 3/3**, 0.256s; `rust-focused.{log,json}`. The three safety/hash/session/stale/history-failure tests now call protect_editor_workflow directly; Btrfs coverage also runs in the full matrix.
- `CARGO_HOME=/tmp/babel-cargo python3 tools/run-workspace-matrix.py /tmp "$PWD/target" --output target/audit-slp-a/matrix` — native filesystem + MockRuntime **pass 273/273 each**, tmpfs 67.168s/Btrfs 144.34s, all 16 selectors; `matrix/workspace-{tmpfs,btrfs}.{json,log}`. Four tests dedicated to the deleted relink capability were removed; live moved-source/recovery/ownership/identity/token refusals remain checked in recent_store_tests.
- `python3 target/audit-slp-a/mutations.py` preliminary in-memory trial — **six faults detected; one survivor**, `mutations/results.json`: deleting the boundary busy check still refuses concurrent imports through the session's independent busy guard; not a loss of the concurrency contract. No assertion weakened to force detection. `python3 target/audit-slp-a/mutations-import.py` replacement-byte fault separately **detected**, `mutations-import/`; both preliminary roots retained.
- `python3 tools/audit-test-mutations.py target/audit-slp-a/mutations-final --slp-a` — **pass removed surfaces, injected/JSDOM control 60/60, 7/7 faults detected**, 44.745s; `slp-mutations-final.{log,json}`, `mutations-final/`. Mounted wording/memory warning/snapshot attention/rolling version, workflow operation/length and imported exact bytes each produce real failed assertions; production files never written. Exact comparison with HEAD confirms original 25 AUDIT-TEST cases retained; that original suite was not rerun here.
- `pnpm check` — final **pass frontend 919/919**, format/lint/typecheck/Vite build, 69.899s; `pnpm-check-final.{log,json}`. Earlier post-composition correction **pass 918/918**, 69.602s, `pnpm-check-3.{log,json}`; final adds the independent saved-with-snapshot-attention sample. Existing Vite chunk-size advisory remains.
- `pnpm test:browser` — generic headless Chromium smoke **pass**, 14.991s; `browser.{log,json}`; no native/trusted-input claim.
- `CARGO_HOME=/tmp/babel-cargo pnpm tauri build --no-bundle` — default production release/helper **pass**, 55.418s; `default-build.{log,json}`; no AppImage/installed/packaging claim.
- `python3 tests/native/editor-input/build-keyboard.py` — disposable pinned physical-key helper **pass**; `keyboard-build.log`; no global settings or privileged package changes.
- `BABEL_SHUTDOWN_MODE=ordinary GTK_IM_MODULE=gtk-im-context-simple python3 tests/native/writing-lifecycle/integrated_exit.py /tmp "$PWD/target" --modes workflow-protection --output target/audit-slp-a/native-workflows` — native import/cancel/Undo/history-failure/source-saving assertions **pass**, overall **fail; 0/2 successful**, 39.722s: existing drill omitted final protected session close, violating shutdown's Home precondition; `native-workflows/`, roots `/tmp/babel-writing-26pnbhdo` and `target/babel-writing-vqf8x0sh`. No crash events recorded; cleanup failure is retained, not credited as ordinary close.
- Same native command with fresh `--output target/audit-slp-a/native-workflows-2` after the final-session close correction — default WebKit/GTK **pass 2/2**, tmpfs 15.19s/Btrfs 17.38s, total 32.615s; roots `/tmp/babel-writing-vwvekd89`, `target/babel-writing-txcvtz6x`; `native-workflows-2/results.json` owns exact root/ledger/journal attribution. Exact safety-ref/checkpoint/source bytes, trusted frozen cancellation, Undo, staged text, history failure and independent Save remain asserted; ordinary window close precedes stale driver cleanup, no owned crash/survivor observed in these bounded samples.
- Feature fixture: `CARGO_HOME=/tmp/babel-cargo BABEL_EDITOR_COMPOSITION_ROOT=/tmp/babel-editor-composition-jpbihe9o XDG_DATA_HOME=/tmp/babel-editor-composition-jpbihe9o/data GSETTINGS_BACKEND=memory GTK_IM_MODULE=gtk-im-context-simple pnpm tauri dev --features editor-composition-proof --config tests/native/editor-input/tauri.conf.json --no-watch`, then `python3 tests/native/editor-input/native-input.py target/audit-slp-a/feature-native.log --import-only` and `python3 tests/native/editor-input/verify-protection.py target/audit-slp-a/feature-native.log /tmp/babel-editor-composition-jpbihe9o` — real WebKit/trusted F4 **pass 1/1**, 33.8s including build; `feature-native.log`, `feature-input.{log,json}`, `input-seed.json`. Exact BOM/CRLF import/Undo/Redo and independent Git safety blob/unchanged fixture sources verified. Feature-owned PID 45801; diagnostic process-group SIGTERM is forced teardown, not ordinary close evidence. No feature Btrfs, IME, clipboard, latency or full S13 rerun claim.
- `python3 -m py_compile tools/audit-test-mutations.py tests/native/editor-input/native-input.py tests/native/writing-lifecycle/workflow_protection.py`, `cargo fmt --all -- --check`, changed local links and `git diff --check` — **pass**; completion formatting/link outcomes below.

Acceptance complete for this deletion cluster. Eight added live import/status cases replace the obsolete status component's three tests; four removed Rust tests cover only the deliberately deleted native relink API. No live import/locate/save/close behavior is weakened. Prior acceptance/evidence is preserved; no new CI/push result. Bounded native samples do not close enforcing SELinux, C1/F2, M6-02, hardware/network-filesystem/power-loss or Local v1 admission gates. SLP-B/C, SIMP-N/F and D-06 remain unstarted.

- Completion `pnpm format:check`, `python3 tools/check-links.py` (**320 changed links**), `cargo fmt --all -- --check`, Python compilation and `git diff --check` — **pass**; `format-check-final.log`, `links-final.log`; handoff stays under 120 lines/8 KiB. `git diff --exit-code -- AUDIT.md SPEC.md fixtures prototypes Cargo.lock pnpm-lock.yaml package.json tools/pdf-helper/pins.json` — **pass**, frozen audit/spec/fixtures/proofs/dependency/helper pins unchanged.

## AUDIT-SLP-B — retired prototype proofs with production coverage

Base `d463656`, clean main, 2026-10-03. S-02 precedes S-01; S-03/S-04 retired
with their composition page caller; S-11 follows ported candidate tests.
[Brief](../tasks/AUDIT-SLP-B.md). No production codec/writer behavior changes.
Kept exact composition fixtures/seed/ignore rule and native backend, independent
Screenplain renderer/PDF inputs, all independent oracles and history-store.
Historical evidence/failed artifacts remain; deleted-source links use the last
pushed pre-deletion snapshot `fb7d6bd`. Artifacts: `target/audit-slp-b/`.

- `python3 tools/audit-slp-b.py` before implementation — expected **red 35 removed surfaces**, retained bytes pass; `red-surfaces.json`. Same tracked check after removals/lock generation **pass 63 retained files**, including frozen AUDIT.md, all Fountain/oracle bytes, seed/renderer/pins/history-store; `surfaces-final.json`.
- `pnpm exec vitest run tests/contract/production-fountain.test.ts` before deleting proof tests — production codec/test-only **pass 78/78**, 1.22s; `ported-frontend.log`. Ported original hash/literal/path/exclusion/23-topic guards and three fixture no-op/isolation assertions; invalid UTF-8 already has production coverage.
- `CARGO_HOME=/tmp/babel-cargo cargo test -p screenwriter-core candidate_tamper_and_silent_truncation --locked` — real disposable filesystem/injected boundary, initial **fail 0/1**: new test wrongly expected NeedsAttention while inspection returns Prepared for unchanged source + retained intent; `ported-candidate.log`. Corrected that extra expectation before deleting M1 proof; corrected control **pass 1/1 (four damage/stage cases)**, exact damaged candidate retained, no source receipt, unchanged source/previous and exact recovery; `ported-candidate-corrected.log`. Writer unchanged.
- `CARGO_HOME=/tmp/babel-cargo cargo test -p screenwriter-core source_store --offline` — real tmpfs/filesystem + injected faults **pass 16/16**, tests 0.19s; `source-focused.log`. Cargo regenerated only the deleted proof package entry; no version changes.
- `pnpm exec vitest run tests/contract/production-fountain.test.ts tests/contract/fountain-complex.test.ts tests/contract/editor-bridge.test.ts tests/contract/editor-input.test.ts` — codec/JSDOM **pass 207/207**, 1.96s; `focused-frontend.log`.
- `python3 tools/audit-test-mutations.py target/audit-slp-b/corpus-mutations --slp-b` — transform-injected corpus guard **pass control 78/78, 3/3 faults detected**, 9.714s total; `corpus-mutations/`. Separate wrong hash/literal/path mutants fail real assertions, not compilation; default AUDIT-TEST and --slp-a suites remain intact and were not rerun.
- `CARGO_HOME=/tmp/babel-cargo python3 tools/audit-slp-b.py --candidate-mutations target/audit-slp-b/candidate-mutations` — copied core/real IO/injected guard bypass **pass control 1/1, 2/2 faults detected**, 13.768s; `candidate-mutations/results.json`. Candidate write verification and pre-replace byte verification bypass each fail the new test; production source bytes untouched.
- `pnpm remove --save-dev pdf-lib prosemirror-commands prosemirror-keymap prosemirror-schema-basic`, then `pnpm install --frozen-lockfile` — **pass**, 902ms/46ms; `pnpm-remove.log`, `frozen-install.log`. Four direct/nine total proof-only packages removed; no dependency version/pin changes. Initial `cargo metadata --offline --no-deps` did not prune Cargo.lock; source focused run regenerated it, then locked checks pass.
- Existing `target/dev-python/bin/python` Screenplain prerequisite — **unavailable (ModuleNotFoundError)**; used the already-built pinned helper CPython + app/lib instead, no installation or pin change.
- `PYTHONPATH=$PWD/target/pdf-helper/runtime/app/lib node tests/tooling/fountain-complex-compare.ts target/pdf-helper/runtime/python/bin/python3.13 target/audit-slp-b/production-comparison` — independent pinned renderer/production codec **pass 37 literal source checks, 30 renderer checks, 26 supported agreements**, 0.243s; `production-comparison/comparison.json`, `production-comparison.log`.
- `CARGO_HOME=/tmp/babel-cargo cargo test -p babel-desktop --features editor-composition-proof --locked` — real native stores/MockRuntime, retained feature **pass 62/62**, compile 16.40s; `feature-tests.log`. Marker/private-root/fixed-ID/report-size guards retained; no actual WebView claim from this check.
- `pnpm check` — **pass 862/862**, format/lint/typecheck/build; initial `pnpm-check.log`, final strengthened byte-isolation run 64.437s `pnpm-check-final.{log,json}`. Removed 61 prototype-only tests, added four production tests (919 → 862); existing Vite chunk advisory retained.
- `cargo fmt --all -- --check` and `CARGO_HOME=/tmp/babel-cargo cargo clippy --workspace --all-targets --all-features --locked -- -D warnings` — **pass**, Clippy 16.302s; `clippy.{log,json}`. Retained feature included, no warning suppression.
- `CARGO_HOME=/tmp/babel-cargo python3 tools/run-workspace-matrix.py /tmp "$PWD/target" --output target/audit-slp-b/matrix` — native tmpfs/Btrfs + MockRuntime **pass 261/261 each**, 64.418s/136.971s, all 15 live selectors bound; `matrix/`. Removed 13 obsolete proof tests, added one production test with four cases (273 → 261); history-store 13/13 retained on both filesystems. Removed only the obsolete BABEL_PROOF_ROOT selector.
- `pnpm test:browser` — actual Chromium/browser **pass**, 16.117s; `browser.{log,json}`. Native ports remain disabled in browser preview.
- `sh tools/lint-py.sh` — **pass 76 tracked Python files**, including the new boundary/mutation tool; `python.log`.
- Historical link target Git audit — **pass 6 targets exist** in pinned pushed `fb7d6bd`; `historical-link-audit.json`. Changed relative links initially **pass 375**; final link/diff checks follow the handoff update.
- `CARGO_HOME=/tmp/babel-cargo pnpm tauri build --no-bundle` — actual default release + pinned helper **pass**, 60.572s; `release-build.{log,json}`, `frozen-native.json`. No package/installed/CI claim.
- `BABEL_SHUTDOWN_MODE=ordinary GTK_IM_MODULE=gtk-im-context-simple python3 tests/native/writing-lifecycle/integrated_exit.py /tmp "$PWD/target" --modes recovery-shutdown --output target/audit-slp-b/native-lifecycle` — actual default WebKit/GTK, full lifecycle via the runner alias **content pass 2/2, strict fail 1/2**, 32.79s tmpfs/45.44s Btrfs; `native-lifecycle/results.json`. Exact New/Protect/Save As/cancel/autosave/snapshot/restore/Undo/source-failure/recovery/history-refusal/emergency-copy bytes pass. Btrfs owned first-session WebKit PID `69485`/start `1517917`, parent `69455`/start `1517903`, records SIGSEGV at `1791082737` at the parent-SIGKILL/restart boundary, before the final-session ordinary quit at `1791082757`; no final survivors. Attribution does not establish cause or repair.
- `python3 tests/native/writing-lifecycle/audit_process_watch.py target/audit-slp-b/native-lifecycle/results.json --output target/audit-slp-b/native-lifecycle-replay` — independent read-only replay **fail strict 1/2**, same kernel + delayed coredump records for one owned crash, not two crashes; `native-lifecycle-replay/`, `native-lifecycle-replay.log`. Core event has omitted MESSAGE; PID/start/timestamp attribution remains valid.
- `coredumpctl info 69485 --no-pager` and `coredumpctl dump 69485 --output target/audit-slp-b/native-lifecycle/owned-69485.core` — **pass**, raw core/provenance retained, SIGSEGV/libc/system WebKit executable; `owned-69485-core-info.txt`, `owned-69485-core-dump.log` beside the core. Later clean runs cannot erase this failure or close C1/F2.
- Feature fixture: `CARGO_HOME=/tmp/babel-cargo BABEL_EDITOR_COMPOSITION_ROOT=/tmp/babel-editor-composition-9b6fz736 XDG_DATA_HOME=/tmp/babel-editor-composition-9b6fz736/data GSETTINGS_BACKEND=memory GTK_IM_MODULE=gtk-im-context-simple pnpm tauri dev --features editor-composition-proof --config tests/native/editor-input/tauri.conf.json --no-watch`, then `python3 tests/native/editor-input/native-input.py target/audit-slp-b/feature-native.log --import-only` and `python3 tests/native/editor-input/verify-protection.py target/audit-slp-b/feature-native.log /tmp/babel-editor-composition-9b6fz736` — actual WebKit/trusted F4 **pass 1/1**, 24.488s including build; `feature-result.json`, `feature-{native,input,protection}.log`, `feature-seed.json`. Exact BOM/CRLF import/Undo/Redo, independent native Git safety blob and unchanged fixture source verified. Owned dev process-group SIGTERM is forced teardown, not ordinary close; no feature Btrfs/IME/clipboard/latency/S13 claim.
- Same full native command with fresh `--output target/audit-slp-b/native-lifecycle-control` — actual default WebKit/GTK **pass 2/2 strict**, 30.38s tmpfs/35.77s Btrfs; roots `/tmp/babel-writing-urk9_cfm`, `target/babel-writing-okhnfmcc`; `native-lifecycle-control/results.json`. Same exact content/fault/parent-kill/restart/ordinary-quit checks, no owned crash/survivor observed in these bounded samples; original Btrfs failure is retained, not closed.
- `python3 tests/native/writing-lifecycle/audit_process_watch.py target/audit-slp-b/native-lifecycle-control/results.json --output target/audit-slp-b/native-lifecycle-control-replay` — read-only independent journal replay **pass 2/2**, zero owned events; `native-lifecycle-control-replay/`, its sibling log. Same frozen release/source hashes confirmed; default command list exactly equals base, retained feature removes only the two retired commands (`handler-parity.json`).

Scoped deletion acceptance complete; stopped before AUDIT-SLP-C, local commit
only. No new package/installed/IME/S13/CI/SELinux/admission claim. M6-03 retains
independent production-native snapshot copy/prune audit; known C1/F2 and the new
owned SIGSEGV remain open. Core/journal/protected byte success is not crash-safety
closure, and the two crash records describe one event, not duplicate crashes.

- Final `python3 tools/audit-slp-b.py` — **pass 63 retained files and full handler parity**: default 45 commands unchanged, retained feature 47 after only the two retired commands; `surfaces-final.json`, `handler-parity.json`.
- Final `pnpm format:check`, `cargo fmt --all -- --check`, `sh tools/lint-py.sh`, `python3 tools/check-links.py`, `git diff --check` — **pass**, 77 Python files/469 changed links; `format-final.log`, `python-final.log`, `links-final.log`. Handoff 117 lines/8,133 bytes; frozen bytes and original failed native artifacts retained.

## AUDIT-SLP-C — unused complex codec edit APIs

Base `186ea59`, clean main at claim, 2026-10-03. [Brief](../tasks/AUDIT-SLP-C.md).
S-08 deletion only; no live editor/native/persistence behavior or dependency
change. Removed unused inline/hidden/conversion APIs, proposal state/type/error
and bypass parameters. Supported inline/Note/title edits now tested through
production guarded EditorState/deferred capture/title actions; standalone hidden
source edits use complete known context. Retired mixed-hidden/raw-conversion
successes remain independent parser samples plus current protection refusals.
Independent fixture bytes/hashes and historical recipes unchanged. Renderer
reports explicitly identify four historical edited parser samples. Artifacts:
`target/audit-slp-c/`; observed host/pins remain as recorded above.

- `python3 tools/audit-slp-c.py` before edits — expected **red 19 removed surfaces/bypasses**, retained bytes pass; `red-surfaces.json`. After deletion **pass 168 retained files** plus byte-identical existingSource/setDualDialogue/replaceLineWithBreaks; `surfaces.json`. Includes frozen AUDIT.md, fixtures, native sources, editor capture/commands, inline encoder and dependency pins.
- `pnpm exec vitest run tests/contract/fountain-complex.test.ts` before deleting APIs — JSDOM/live-editor control initial **fail 48/49**, migrated ambiguous-note expectation wrongly required round-trip rather than unrepresentable; `ported-control.log`. A failed edit-script attempt left the assertion unchanged and repeat failed identically (`ported-control-corrected.log`); corrected per-case error expectations **pass 49/49**, 1.09s (`ported-control-final.log`). Production code unchanged throughout this control.
- `pnpm exec vitest run tests/contract/fountain-complex.test.ts tests/contract/production-fountain.test.ts tests/contract/editor-bridge.test.ts tests/contract/editor-keys.test.ts tests/contract/editor-shortcuts.test.ts tests/contract/editor-input.test.ts` — codec/JSDOM/synthetic production transactions **pass 275/275**, initial 2.77s `focused.log`, final 4.815s `focused-final.{log,json}`. Exact live capture/Undo/Redo, raw/mixed/unclosed/malformed protection, D01 wiring and fixture semantics retained; no native trusted-input claim.
- Strengthened rich-request assertion exploration (`pnpm exec vitest run tests/contract/fountain-complex.test.ts`) — **fail 48/49** expecting all 128 successes; actual 112 successes/16 typed refusals (`rich-requests.log`). Refusal-shape probe **fail 48/49** expecting no refusals (`rich-refusals.log`): only modulo-8 variant 7, styled boneyard literal, refuses round-trip. Final assertion requires exactly 112 successes and this refusal shape, replacing the old acceptance of any typed refusal; no production behavior changed.
- `pnpm exec vitest run tests/contract/fountain-complex.test.ts --config target/audit-slp-c/baseline.config.ts` — in-memory pre-change `186ea59` codec with current live/editor tests **pass 49/49**, 2.589s; `baseline-live.{log,json}`, `baseline-loaded.json`. Confirms the pinned 112/16 outcome against unchanged baseline; production files never overwritten. This is a JSDOM baseline control, not native verification.
- `pnpm check` — first **fail 862 pass/1 assertion fail**, 56.091s, during the too-strong 128-success exploration (`frontend.{log,json}`); final **pass 863/863**, formatting/lint/typecheck/build, 63.373s (`frontend-final.{log,json}`). One added live Undo/Redo test; original 862 → 863. Existing Vite chunk advisory retained.
- `cargo fmt --all -- --check` and `CARGO_HOME=/tmp/babel-cargo cargo clippy --workspace --all-targets --all-features --locked -- -D warnings` — **pass**, 3.417s combined; `rust-static.{log,json}`. Native retained feature statically checked; no new native runtime claim.
- `CARGO_HOME=/tmp/babel-cargo cargo test --workspace --locked` — real disposable tmpfs IO + MockRuntime **pass 261/261**, 64.144s; `workspace.{log,json}`. Optional unavailable Enchant providers warn; Hunspell tests pass. Tier 2: codec/tests/tooling only, native filesystem/IPC/packaging source unchanged; no second filesystem, embedded native rebuild or native drill required. Prior SLP-B owned SIGSEGV and all C1/F2 evidence remain open.
- `PYTHONPATH=$PWD/target/pdf-helper/runtime/app/lib node tests/tooling/fountain-complex-compare.ts target/pdf-helper/runtime/python/bin/python3.13 target/audit-slp-c/production-comparison` — independent pinned renderer/production parser **pass 37 literal source checks, 30 renderer checks, 26 supported agreements**, 2.165s; `renderer.{log,json}`, `production-comparison/comparison.json`. Four historical edited samples explicitly listed; this no longer asserts execution of their retired codec helpers, and is not a production PDF/editor/native flow.
- `pnpm test:browser` — actual Chromium/browser **pass**, 13.701s; `browser.{log,json}`. Browser native ports disabled; no new WebKit/IME/persistence evidence.
- `sh tools/lint-py.sh` — **pass 77 tracked/current Python files**, 3.922s; `python.{log,json}`. New boundary checker included; no global settings or dependency changes.

Acceptance complete; local commit only, stopped before AUDIT-SIMP-N. No new
SELinux, C1/F2, M6-02 or Local v1 admission claim. Prior failures/cores untouched.
Final changed-doc formatting/link/diff checks recorded below.

- Final `pnpm format:check`, `python3 tools/check-links.py`, `python3 tools/audit-slp-c.py`, `git diff --check` — **pass**, 170 changed links/168 retained files; `format-final.{log,json}`, `links-final.log`, `surfaces-final.json`. Handoff 115 lines/8,156 bytes; frozen audit/fixture/native/editor bytes and earlier failure artifacts retained.

## AUDIT-SIMP-N — shared native workers and storage/test primitives

Base `653f037`, clean main/four local commits ahead at claim, 2026-10-03.
[Brief](../tasks/AUDIT-SIMP-N.md). Accepted X-01/05/02/03 only. Nine simple
DocumentError workers plus prior snapshot/recent/startup callers share the
cost-aware worker; payload-before-reserve and error/permit behavior retained.
One handler list preserves all four cfg inventories. Shared test-only TestRoot
and IPC transport preserve per-suite literals/modes/envelopes/cleanup policies;
publication cancellation/wait stays local. Legacy hard-coded desktop temp root
now honors BABEL_IPC_TEST_ROOT; canonical matrix adds the retained composition
selector. Thirteen exclusive creates share flags/access/Errno only; child-dir
checks share original error codes while parent policy remains local. Destination
checks/storage relation retain stat order and the eager store-stat fallback.
Write/gate/fsync/read-back sequences, lease open, picker/release/SaveFailure
workers, frontend/fixtures and pins remain unchanged. Artifacts:
`target/audit-simp-n/`. No new protocol, dependency or admission decision.

- `python3 tools/audit-simp-n.py` before edits — expected **red 10 structural findings**, **pass 289 retained files/1,468 existing assertion literals**; `red-structure.json`. Expanded protected-method guard initially **fail** because it named nonexistent pick_save_destination; corrected to the actual unchanged pick_save_target (`protected-boundary.json`). Final **pass**, handler inventories 45/47 Linux and 39/39 non-Linux, protected worker/picker/lease bodies unchanged; `structure-final.json`. Source cfg parity is not non-Linux compilation/runtime evidence.
- `CARGO_HOME=/tmp/babel-cargo cargo check --workspace --all-targets --all-features --locked` — first **compile fail**: extraction used nonexistent HistoryUnavailable instead of the original HistoryNeedsAttention (`early-check.log`); corrected compile **fail** on three missed startup snapshot_worker callers (`early-check-corrected.log`). Fixture compile **fail**: Path/TestRoot child-fixture and subprocess argument types, test-only import at production scope and old worker callers (`fixture-check.log`). Corrected without changing production error policies or existing assertions.
- `CARGO_HOME=/tmp/babel-cargo cargo fix --workspace --all-targets --all-features --locked --allow-dirty` — **pass**, unused imports removed; two remaining dead-code warnings resolved by removing the superseded UUID helper and naming the cleanup-owning choices field _root (`fixture-fix.log`). No warning suppression added except the audit-requested integration support module's dead_code allowance for per-binary unused helper methods.
- `CARGO_HOME=/tmp/babel-cargo cargo test -p babel-desktop -p screenwriter-core --lib --locked` — initial real IO/MockRuntime **fail desktop 55/61**, six inline fixtures removed their TestRoot by value and triggered strict duplicate Drop cleanup (`focused-rust.log`). Preserve original explicit cleanup timing via cleanup/disarm; corrected **pass 61/61 desktop +122/122 core** (`focused-rust-corrected.log`); final **pass 183/183**, 7.003s (`focused-final.{log,json}`). Three added worker tests cover absent/poison/join panic, exact cost/refusal-before-operation, core success/error and full byte/job budget release; injected failure boundaries, not GTK termination proof.
- `CARGO_HOME=/tmp/babel-cargo cargo clippy --workspace --all-targets --all-features --locked -- -D warnings` — intermediate **compile fail** after the retained feature fixture port: missing PermissionsExt, attempted TestRoot clone and unused mut (`clippy.log`); partial correction still **fail** missing trait (`clippy-corrected.log`). Final **pass**, 3.02s (`clippy-final.log`); `cargo fmt --all -- --check` **pass**. All-feature static coverage preserves native feature; only x86_64-unknown-linux-gnu target is installed, so non-Linux build remains unverified.
- `pnpm check` — **pass 863/863**, format/lint/typecheck/build, 63.647s; `frontend.{log,json}`. Frontend byte-identical; existing Vite chunk advisory retained.
- `CARGO_HOME=/tmp/babel-cargo python3 tools/run-workspace-matrix.py /tmp "$PWD/target" --output target/audit-simp-n/matrix` — real disposable tmpfs/Btrfs IO + MockRuntime **pass 264/264 each**, 64.475s/138.966s; `matrix/`, `matrix.{log,json}`. All 15 default selectors bound, including the formerly hard-coded release-dispatch root. Original 261 →264 from the three new worker tests; all 1,468 prior assertion literals unchanged. Optional unavailable Enchant providers warn; Hunspell backend passes.
- `CARGO_HOME=/tmp/babel-cargo python3 tools/run-workspace-matrix.py /tmp "$PWD/target" --output target/audit-simp-n/feature-matrix -- cargo test -p babel-desktop --features editor-composition-proof --locked` — retained feature real IO/MockRuntime **pass 65/65 each**, 17.764s/17.927s; `feature-matrix/`, `feature-matrix.{log,json}`. Added composition selector makes 16 bound selectors; fixed marker/private-root/IDs/report-size assertions retained. No new native composition/IME claim.
- `pnpm test:browser` — actual Chromium/browser **pass**, 20.549s; `browser.{log,json}`. Browser native ports disabled; no WebKit claim from this check.
- `CARGO_HOME=/tmp/babel-cargo pnpm tauri build --no-bundle` — actual default embedded release/pinned helper **pass**, 61.296s; `release-build.{log,json}`. `frozen-native.json`: binary SHA-256 65322606db77a451fbe810b0c47815159b8cca13d4877f8350c6a8e5c655c7bc, GTK 3.24.52/WebKitGTK 2.52.6, unchanged helper tree 808d2276543fce73967f8c66166d5e61a676282e094716da3e42b7831454086a. No installed/package/CI claim.
- `CARGO_HOME=/tmp/babel-cargo cargo build -p babel-desktop --features editor-composition-proof --locked` — actual retained-feature build **pass**, 10.706s; `feature-build.{log,json}`. Default and feature handler branches compile; source parity alone covers the unavailable non-Linux branches.
- `sh tools/lint-py.sh` — **pass 78 current/tracked Python files**, initial 4.693s (`python.{log,json}`), final including matrix selector update (`python-final.log`). Failed one-off fixture-summary regex inspection left source untouched; no unavailable prerequisite was bypassed or installed.

- `BABEL_SHUTDOWN_MODE=ordinary GTK_IM_MODULE=gtk-im-context-simple python3 tests/native/writing-lifecycle/integrated_exit.py /tmp "$PWD/target" --modes workflow-protection audit-fixes --output target/audit-simp-n/native` — actual WebKit **pass 4/4 content and strict owned-process/crash audits**, 149.265s; `native.{log,json}`, `native/results.json` and per-run logs/ledgers/journals. Tmpfs workflow/audit-fixes 18.01s/50.28s; Btrfs 18.22s/62.70s. No owned crash events or live native processes left. Builds/shared tests idle; ordinary final close distinguished from the audit-fixes intentional parent-kill scenario. Clean samples do not resolve retained SLP-B SIGSEGV, M6-02 SIGABRT or C1/F2.
- `python3 tests/native/writing-lifecycle/audit_retained.py target/audit-simp-n/native/results.json --output target/audit-simp-n/native-retained-audit.json` — independent retained-artifact **pass 4 roots/58 frames/24 snapshots/4 safety refs/6 previous sources**, 0.088s; `native-retained.{log,json}`, `native-retained-audit.json`. Exact literal/hash/version/head checks; no new independent snapshot-copy/prune, universal durability or admission claim.

Acceptance complete; local commit only, stopped before AUDIT-SIMP-F. Frozen
AUDIT.md and prior failure roots/cores untouched. SELinux, C1/F2, M6-02,
M6-03 independent snapshot copy/prune and Local v1 admission remain open.
Final changed-document and boundary checks recorded below.

- Final `pnpm format:check`, `cargo fmt --all -- --check`, `python3 tools/check-links.py`, `python3 tools/audit-simp-n.py`, `git diff --check` — **pass**, 132 changed links/289 retained files/1,468 existing assertions; `format-final.{log,json}`, `links-final.{log,json}`, `structure-final.json`. Handoff 90 lines/7,327 bytes; prior evidence prefix, frozen audit/fixtures/native/frontend/pins and earlier failure artifacts retained.

## AUDIT-SIMP-F — frontend guard and native dispatch simplification

Base `ef0ff02`, clean main/five local commits ahead at claim, 2026-10-03.
[Brief](../tasks/AUDIT-SIMP-F.md). Accepted X-04 cleanup/three throwing locks,
X-06 13 full editor-state guards +9 full stamp guards/six constructions, X-08
one error-code constant/derived type/runtime allow-list and X-07 ordered uniform
dispatch. Current native table has 22 uniform modes (frozen audit's 21 plus
external Reload); four special branches retain their exact AST and position.
Optional scroll/toolbar/refs changes, DEV-03 fold-back and native helper sharing
excluded. Doc-first isCurrent preserves foreign-state short-circuit; partial
guards, view/selection/composition/lifetime guards and cleanup/refresh order
remain local. Error list now includes all 31 native codes, including the seven
previously omitted from runtime recognition; unknown code/action fails closed.
No Rust, native command, filesystem algorithm, renderer, fixture or pin changes.
Artifacts: `target/audit-simp-f/`; prior evidence/failure roots/cores retained.

- `pnpm exec vitest run tests/contract/audit-simp-f.test.ts` before production edits — expected **red 4/4**, missing helpers/constant and previously unrecognized exportNeedsAttention (`red-helpers.{log,json}`, 2.678s). New replacement-evidence test initially guessed a nonexistent failure.replacement property; corrected its oracle to the actual fileBlocked effect, without changing any existing assertion.
- `python3 tests/tooling/test_simp_f_dispatch.py` before native dispatch edits — expected **red 4 test methods**, no MODES/dispatcher to extract (`red-dispatch.{log,json}`, 0.294s); corrected production table/dispatcher **pass 4/4**, covering all 22 routes, lazy imports, owned context, first-match priority, special arguments and fall-through (`dispatch.{log,json}`, 0.227s). AST/mock dispatch only, no native claim.
- Extraction draft/typecheck — **fail** cleanup-range script IndexError before writing; corrected the range. Early `pnpm typecheck` **fail** on superseded imports, not-yet-written constant and new test's nonexistent replacement property; corrected imports/actual fileBlocked oracle. Removed unrelated import-only edits before shared checks. Final `pnpm typecheck` **pass**, 6.671s (`typecheck.{log,json}`); no production-policy or prior-test weakening.
- `pnpm exec vitest run tests/contract/audit-simp-f.test.ts tests/contract/manuscript-projection.test.ts tests/contract/persistence-state.test.ts tests/ui/WritingView.test.tsx` — injected/JSDOM **pass 64/64**, 16.56s (`focused-helpers.{log,json}`). Four added helper/error-parity tests; original UI/controller/receipt assertions unchanged.
- `python3 tools/audit-simp-f.py` — **pass 661 retained files, 21 explicit partial guards, 27 native drill assertions and exact four special branch ASTs**, all 22 runner/module/flag mappings retained (`boundary.{log,json}`, 0.091s). All original test files, frozen AUDIT.md, Rust, fixtures/native runners except dispatch, helper and dependency pins byte-identical.
- `pnpm check` — **pass 867/867**, formatting/lint/typecheck/build, 65.167s (`frontend.{log,json}`); prior 863 +4 new contracts. Existing Vite chunk advisory retained.
- `cargo fmt --all -- --check` and `CARGO_HOME=/tmp/babel-cargo cargo clippy --workspace --all-targets --all-features --locked -- -D warnings` — **pass**, 4.208s (`rust-static.{log,json}`). Rust source/pins unchanged; no new feature/non-Linux runtime claim.
- `CARGO_HOME=/tmp/babel-cargo cargo test --workspace --locked` — real disposable tmpfs IO + MockRuntime **pass 264/264**, 64.772s (`workspace.{log,json}`). Tier 2: frontend guards/allow-list and dispatch only; no native IPC/filesystem/packaging source change, no second filesystem matrix. Optional Enchant providers warn; Hunspell passes.
- `sh tools/lint-py.sh` — **pass**, 3.763s (`python.{log,json}`); 79 files, new boundary tool included; AST dispatch test executed separately. No settings, dependencies or privileged installations.
- Native IME prerequisite — documented `/tmp/babel-m4-15-fcitx/prefix` **missing**. Read-only package enumeration returned no missing packages; retained `target/m6-01/prerequisites/verified.json` located ten signed archives. Each retained SHA-256 matched and `gpgv --keyring /etc/pacman.d/gnupg/pubring.gpg <archive>.sig <archive>` **passed** before fresh task-local `bsdtar` extraction (`prerequisites/verified.json`, ten signature logs, `prerequisites/prefix`). No personal profile/global installation/daemon replacement.

- `pnpm test:browser` — actual Chromium/browser **pass**, 14.844s (`browser.{log,json}`); native ports disabled, no WebKit claim from this check.
- `CARGO_HOME=/tmp/babel-cargo pnpm tauri build --no-bundle` — actual default embedded release/pinned helper **pass**, 50.126s (`release-build.{log,json}`). `frozen-native.json`: binary SHA-256 f29e71551d45f47992ca7471a2cb4e79ad09bb59ad6e986cdfc7ca1fc3c2d4ab, GTK 3.24.52/WebKitGTK 2.52.6. `python3 tools/pdf-helper/verify_runtime.py target/pdf-helper/runtime --exact` **pass 1,475 files**, unchanged tree 808d2276543fce73967f8c66166d5e61a676282e094716da3e42b7831454086a (`helper-exact.json`). No installed/package/CI claim.

- `BABEL_SHUTDOWN_MODE=ordinary python3 tests/native/writing-lifecycle/isolated_ime.py target/audit-simp-f/prerequisites/prefix -- python3 /tmp/babel-simp-f-native.py /tmp --output target/audit-simp-f/native` — actual WebKit initial **17/22 exit/content+strict passes**, 611.847s; **22/22 owned-process/crash audits clean** (`native.{log,json}`, per-run logs/ledgers/journals and roots). Untracked wrapper only supplies all 22 migrated choices to the unchanged integrated_exit observer. Daily-session fails its assertion expecting unavailable export assessment although UI records completed SC005/SC008; spellcheck/scene-moves fail missing disposable pointer, commands fails missing /tmp/wtype. Title-page completes its byte/input assertions but ordinary shutdown fails the Home precondition for its intentional read-only inspection ending. Failed ordinary-close attempts and fallback forced teardown retained; no crash/gate closure or 22/22 native success claim.

- Disposable prerequisites — `python3 tests/native/editor-completion/build-pointer.py` **pass**, 1.679s; `python3 tests/native/editor-input/build-keyboard.py` **pass**, 0.588s; pinned protocol hashes checked by existing tools. Fresh /tmp/wtype symlink targets the signature-verified task-local binary; `input-helper-hashes.json`. No global/compositor setting changes (`pointer-build.{log,json}`, `keyboard-build.{log,json}`).
- Frozen candidate, ordinary-close prerequisite retry — isolated native `spellcheck commands scene-moves` **pass 2/3**, 80.832s; spellcheck/scene-moves pass after bootstrap, commands progresses to **F6 writing actions failure** (`native-prerequisite-retry/`, `native-prerequisite-retry.{log,json}`). **3/3 owned crash audits clean**; failed ordinary shutdown/fallback preserved. No assertion disabled.
- Frozen candidate, existing title inspection teardown — isolated native `title-page` with BABEL_SHUTDOWN_MODE unset **pass 1/1 strict**, 32.045s (`native-title-retry/`, `native-title-retry.{log,json}`). Real pinyin and exact restore/recovery/Save As/read-only oracles; final forced WebDriver teardown is explicitly not ordinary quit. This corrects the runner-mode mismatch without touching its assertions.
- Frozen pre-refactor control — `git archive ef0ff02`, baseline Vite build **pass** 1.315s, `pnpm tauri build --no-bundle --config target/audit-simp-f/baseline-tauri.json` **pass** 31.59s (`baseline-frontend.{log,json}`, `baseline-build.{log,json}`, `baseline/provenance.json`). Frozen frontend + byte-identical native Rust, original config except generated frontendDist and skipped rebuild hook; same AST-verified dispatch/runner. Binary ba32db6ec17624f5f3abf74655fbd6b11a01cd2eb9e20feab1f050ac90680f03.
- Frozen control native `daily-session commands`, ordinary-close — **pass 1/2**, 41.846s; daily-session pass, commands reproduces **F6 writing actions failure**; **2/2 owned crash audits clean** (`baseline-native/`, `baseline-native.{log,json}`). F6 is a baseline-confirmed open native finding, not claimed fixed by this refactor.
- Fresh frozen candidate native `daily-session`, ordinary-close — **pass 1/1 strict**, 16.492s (`native-daily-retry/`, `native-daily-retry.{log,json}`). Initial assessment assertion failure remains retained; baseline/fresh passes do not establish its cause. No clean-rerun closure claim.
- Selected final candidate manifest — **21/22 native exit+content/strict passes, 22/22 owned crash audits clean** (`native-final-results.json`); all 22 migrated modes executed, all 27 candidate attempts retained (`native-all-attempts.json`). Commands/F6 remains failed with matching baseline; initial daily assessment observation remains unresolved. Title uses forced teardown, other selected successful modes ordinary final quit. No universal native/IME/a11y or C1/F2 admission claim.
- `python3 tests/native/writing-lifecycle/audit_retained.py target/audit-simp-f/native-final-results.json --output target/audit-simp-f/native-retained-audit.json` — independent retained-artifact **pass 21 successful roots/146 frames/52 snapshots/6 safety refs/22 previous sources**, 0.165s (`native-retained.{log,json}`, `native-retained-audit.json`, `native-retained-summary.json`). Failed commands root excluded by the existing auditor; exact literal/hash/version/head oracles, no snapshot-copy/prune or universal durability claim.

Implementation acceptance complete with the explicitly retained native F6 and
initial assessment findings. Local commit only; stopped before further DESIGN
implementation/D-06. Frozen audit, prior assertions, earlier failures/cores intact.
SELinux, C1/F2, M6-02, M6-03 copy/prune and Local v1 admission remain open.
Final canonical release restoration and document checks recorded below.

- Canonical `CARGO_HOME=/tmp/babel-cargo pnpm tauri build --no-bundle` after frozen controls — **pass**, 45.377s (`release-restored.{log,json}`); restored target/release binary hash exactly matches the tested candidate f29e71551d45f47992ca7471a2cb4e79ad09bb59ad6e986cdfc7ca1fc3c2d4ab. Frozen candidate/control binaries remain separate; no shipping/installed claim.

- Final `pnpm format:check`, `cargo fmt --all -- --check`, `python3 tools/check-links.py`, `python3 tools/audit-simp-f.py`, `git diff --check` — **pass**, 142 changed links/661 retained files/21 explicit partial guards/27 native assertions; `format-final.{log,json}`, `links-final.log`, `boundary-final.json`. Handoff 95 lines/7,713 bytes; frozen audit, original test files and prior evidence prefix intact. No push; native F6/initial assessment findings and admission gates remain open.

## AUDIT-D06 — plain status and failure-only close prompts

2026-10-03; base `200e375`, main/local only. [Brief](../tasks/AUDIT-D06.md).
Tier 2: frontend presentation/routing only; native adapters, IPC, save/recovery/
identity/lease/publication algorithms and existing receipt/version policies are
unchanged, so no repeated Rust filesystem matrix. Native lifecycle samples use
both tmpfs and Btrfs; they do not establish SELinux, C1/F2 or Local v1 admission.
Artifacts/logs/elapsed-command metadata: `target/audit-d06/`.

- `pnpm exec vitest run tests/ui/WritingView.test.tsx -t AUDIT-D06` before production edits — expected **red**, five behavior failures plus one test setup failure (incorrect Open Fountain button name); 6.63s (`red.log`). Setup corrected to Run Open; the concurrently started corrected attempt overlapped production edits and is not counted as baseline/red evidence (`red-untitled.log`).
- Frozen `git archive 200e375` plus corrected candidate tests, `pnpm --dir <baseline> exec vitest run tests/ui/WritingView.test.tsx -t AUDIT-D06` — expected **red 8/8**, 10.639s (`baseline-red.{log,json}`). Control checkout moved intact to `/tmp/babel-audit-d06-baseline-200e375`; no production baseline mutation.
- Initial focused/test-stub attempts — **fail**, retained (`focused.log`, `focused2.log`, `d06-focused.log`, `typecheck.{log,json}`): migrated global-alert selectors, JSDOM contenteditable property, ambiguous checkbox, clipboard MIME stub, immutable SDK exports and unlisten mock typing corrected; original protection/byte assertions retained. Candidate 8/8 passed in `d06-focused2`, but default discovery also ran the deliberately red archived control; moved that task-local archive out of discovery (`d06-focused2.{log,json}`).
- Mounted D-06 cases — injected/JSDOM **pass 8/8** (`d06-focused3.{log,json}`, 5.526s): delayed exact source receipt/release, duplicate requests, stale receipt/release failure with editable retention, untitled/Open cancellation, read-only release, plain status/details/separate alerts, native-event routing and cleared window destination. Native events/ports here are mocked, not WebKit verification.
- Focused WritingView/ProtectedClosePanel/protected-close/writing-session/persistence-state/controller/cadence suites — injected/JSDOM **pass 364/364**, 26.771s (`focused-final.{log,json}`). Includes current tests and retained `target/audit-simp-f/baseline-source` tests under default discovery; absolute file filters also discover that retained archive (`focused-current.{log,json}`, 26.457s). No current test removed or disabled.
- `pnpm check` — **pass**, formatting/lint/typecheck/build and 1,738 tests, 101.820s (`frontend.{log,json}`): 875 current +863 retained frozen ef0ff02 tests discovered by default. Existing Vite chunk advisory remains. All 62 tracked test files live under `tests/`; explicit current-root `pnpm exec vitest run --dir tests` **pass 875/875**, 53.489s (`current-only.{log,json}`). Earlier absolute directory filter also included the retained archive (`current-suite.{log,json}`, 95.695s).
- `cargo fmt --all -- --check` and `CARGO_HOME=/tmp/babel-cargo cargo clippy --workspace --all-targets --all-features --locked -- -D warnings` — **pass**, 0.383s/5.798s (`rust-format.{log,json}`, `rust-static.{log,json}`); source/pins unchanged.
- Sandboxed `CARGO_HOME=/tmp/babel-cargo cargo test --workspace --locked` — **fail**, 67.744s, source_save metadata fixture `fsetxattr` EINVAL at line 438 (`workspace.{log,json}`). Same unchanged suite outside sandbox **pass 264/264**, 54.077s (`workspace-unrestricted.{log,json}`); failed attempt retained, no test/source workaround or enforcing-SELinux claim.
- `pnpm test:browser` — sandbox **fail**, Vite exited 1 (`browser.{log,json}`); unrestricted actual Chromium/browser **pass**, 12.689s (`browser-unrestricted.{log,json}`). Native ports disabled; no WebKit claim from browser smoke.
- `CARGO_HOME=/tmp/babel-cargo pnpm tauri build --no-bundle` — default embedded release/pinned helper **pass**, 68.911s (`release-build.{log,json}`). Frozen binary c976f53754d34708d4cab58b43142028847b93ea525576918fd25fe7dd022c08; GTK 3.24.52/WebKitGTK 2.52.6 (`frozen-native.json`, `frozen/babel-desktop`). No installed/package/CI claim.
- `python3 tools/pdf-helper/verify_runtime.py target/pdf-helper/runtime --exact` — **pass 1,475 files**, 2.207s (`helper-exact.{log,json}`), unchanged tree 808d2276543fce73967f8c66166d5e61a676282e094716da3e42b7831454086a.
- `python3 tests/tooling/test_simp_f_dispatch.py` — AST/mock dispatch **pass 4/4**, 0.477s (`dispatch.{log,json}`); all 22 routes and special branch checks remain intact. `sh tools/lint-py.sh` **pass**, 3.343s (`python-final.{log,json}`); final syntax/format/link/diff checks follow after native checks.

- `BABEL_SHUTDOWN_MODE=ordinary python3 tests/native/writing-lifecycle/isolated_ime.py target/audit-simp-f/prerequisites/prefix -- python3 tests/native/writing-lifecycle/integrated_exit.py /tmp $PWD/target --output target/audit-d06/native --modes recovery-shutdown home characters editor-exit capture-review commands persistence-paths` — actual WebKit initial **9/14 successful, 14/14 owned crash audits clean**, 555.780s (`native.{log,json}`, ledgers/journals/roots). Uses the retained signed test-only IME prefix; no personal profile/global changes. Default lifecycle adds real untitled window request/cancel/recovery-only close, exact plain status/closed details, ordinary file window exit and writable reopen with independent BOM/CRLF and draft byte literals (`status_close.py`, per-root `d06-status-close.json`/`d06-window-exit.json`). Existing Save As/Undo/history/divergence/source-failure/emergency-copy checks retained.
- Initial native failures — **retained**: Btrfs new untitled-focus observation arrived before exact focus was confirmed; tmpfs/Btrfs commands fail original **F6 writing actions** assertion; editor-exit remote `fcitx5-remote -n` returns 1 at Mozc selection (and restore can mask it). Failed ordinary final-close attempts plus fallback forced teardown are distinct; no clean single-matrix or full native/IME claim.
- Fresh private tmpfs lifecycle/editor retry — **1/2 successful**, 130.386s (`native-tmpfs-retry.{log,json}`); lifecycle passes, editor reproduces remote query failure; **2/2 owned crash audits clean**. New focus check now waits for the same exact required button; no content/protection assertion relaxed.
- Fresh private Btrfs lifecycle/editor retry — **1/2 successful**, 198.167s (`native-btrfs-retry.{log,json}`), **2/2 owned crash audits clean**. Lifecycle passes exact focus/window-close/source/reopen checks. An experimental editor-focus/cold-query wait retained the 30-second timeout and all trusted composition/byte assertions but still failed Mozc selection; experiment reverted. Retry tooling hashes retained; final editor harness differs only in D-06 close/readiness expectations. Daemon SIGTERM trace is wrapper cleanup, not evidence that the remote error was an owned WebKit crash; cause of the IME prerequisite failure remains open.
- Frozen control `BABEL_NATIVE_BINARY=target/audit-simp-f/baseline/babel-desktop` plus unchanged `target/audit-simp-f/baseline-source` editor harness, fresh private IME — **fail same Mozc remote query/restore**, 94.086s (`baseline-native-ime.{log,json}`, original 93.420s mode/root/ledger; **owned crash audit clean**). Frozen ef0ff02 binary ba32db6ec17624f5f3abf74655fbd6b11a01cd2eb9e20feab1f050ac90680f03; no D-06 source/harness. F6 already matched that frozen control in SIMP-F and remains unchanged here. Both unrelated gates stay blocked; no assertion disabled.
- Selected same-binary manifest — **10/14 successful**, **14/14 owned crash audits clean** (`native-selected-results.json`); lifecycle/Home/characters/capture-refusal/path-loss all pass tmpfs/Btrfs. Editor/Mozc and commands/F6 are failed in the selected manifest. **18/18 candidate owned crash audits clean** across 18 retained attempts (`native-all-attempts.json`); ordinary positive exits versus failed/forced cleanup remain labeled. Full corpus/IME/command acceptance is not asserted.
- `GTK_IM_MODULE=gtk-im-context-simple python3 tests/native/writing-lifecycle/plain_presentation.py /tmp $PWD/target --output target/audit-d06/plain-presentation --repeats 1` — actual AT-SPI/wtype, no WebDriver, **2/2 strict**, 189.015s (`plain-presentation.{log,json}`); typical/stress source/Undo/Save As/automatic close on each filesystem, ordinary final quit and owned-process/journal audits. Original 13 assertions intact; excludes IME/completion/Find/geometry/restart and is not full S13/a11y acceptance.
- `python3 tests/native/writing-lifecycle/audit_retained.py target/audit-d06/native-selected-results.json --output target/audit-d06/native-retained-audit.json` — independent retained-artifact **pass 10 successful roots/84 frames/38 snapshots/2 safety refs/10 previous sources**, 0.124s (`native-retained.{log,json}`). Existing policy excludes four failed selected roots; literal byte/copy/head oracles are separate. No M6-03 copy/prune or universal durability claim.
- Native screenshot review — **pass**, tmpfs `saved.png`/`new-draft.png`: plain Saved locally/recovery-only state, closed Save details and readable controls; native screenshots remain retained. No shell/styling/pagination redesign.
- Frozen protocol/fixture/pin check `git diff --exit-code 200e375 -- src/application src/editor AUDIT.md crates src-tauri tests/fixtures Cargo.lock pnpm-lock.yaml` — **pass** (`protocol-boundary.{log,json}`); all receipt/editor-ahead/freeze/copy/risk derivations unchanged. Independent AST inventory retains **156/157 prior native assert statements**, with one approved untitled-focus label replacement and five new assertions in migrated files (`assertion-audit.json`); the new status-close case adds its own independent assertions; close/readiness wait expectations changed only for the approved behavior. F6, byte/hash/head/Undo/copy/risk assertions preserved.

Bounded D-06 implementation acceptance complete with the explicit native IME/F6
limits above. No new SPEC invariant/ADR/trace contract; owning UX/persistence
wording, brief, TODO and handoff updated. Initial SIMP-F daily-assessment failure
and all older cores/failures remain untouched. Local commit only; stopped after
D-06. SELinux, C1/F2, M6-02, M6-03 copy/prune and Local v1 admission remain open.
Final artifact-retention and document checks follow.

- Artifact retention — **pass 15 tmpfs roots/2,185 regular files independently SHA-256 verified** into `target/audit-d06/retained-tmpfs/` (`retained-tmpfs-manifest.json`), including failed/control/input-service profiles; original roots untouched, symlinks preserved without following them. Btrfs roots already live under target. Evidence mirroring is not application backup/copy/prune acceptance.
- Final `pnpm format:check`, `python3 tools/check-links.py`, `sh tools/lint-py.sh`, `git diff --check` — **pass**, 8.333s/0.150s/3.294s/0.010s (`format-final`, `links-final`, `python-final3`, `diff-final` logs/metadata). Handoff 80 lines/5,039 bytes. Tested canonical/frozen release and frontend source hashes match; frozen AUDIT/protocol/fixtures/pins and the entire prior evidence prefix remain intact. No push or new CI/native admission claim.

## AUDIT-NATIVE-R1 — F6 focus and private Mozc

2026-10-04; base `fcfade8`, main/local only. [Brief](../tasks/AUDIT-NATIVE-R1.md).
Tier 2 application focus fix plus native test prerequisites: no production
save/recovery/IPC/filesystem/packaging/pin changes, so no repeated Rust filesystem
matrix. Named WebKit drills cover tmpfs/Btrfs. Artifacts: `target/audit-native-r1/`.
The read-only Mozc bind preserves the launcher's writable/private namespace
boundary. [Upstream path validation](https://github.com/google/mozc/blob/master/src/ipc/ipc_path_manager.cc)
provided the hypothesis; paired live `/proc/<pid>/exe` and engine controls below
confirm the loaded test package's path mismatch. No global IME/profile changes.

- Frozen D-06 `c976f53754d34708d4cab58b43142028847b93ea525576918fd25fe7dd022c08` plus task-local diagnostic harness, commands/tmpfs — expected native **fail**, 25.507s (`f6-red.{log,json}`, owned audit clean): physical F6 focuses enabled Check external changes instead of original required Save; untouched production/baseline controls retained.
- Pre-edit mounted F6 regression — injected/JSDOM expected **red 1/1**, 2.623s (`focus-red.{log,json}`): opened-file Save loses focus to the earlier enabled source action. Existing untitled F6 test alone did not exercise that ordering.
- First focused candidates — injected/JSDOM **fail** (`focus-green`, 18.461s; `focus-green2`, 3.536s): an extra no-source-check assertion conflicted with normal focus recheck; an additional read-only F6 experiment stayed in the editor even after readiness. Those added probes were removed from the delivered writable regression, original assertions untouched; read-only F6 remains an unverified broader keyboard path, not claimed native success.
- Focused WritingView/CommandPalette/editor-shortcuts suites — injected/JSDOM **pass 95/95**, 18.497s (`focus-final.{log,json}`); Save-first F6/back on an opened file and existing untitled/content/Undo/composition guards preserved.
- Fresh original private launcher with frozen D-06 app — native editor **fail twice**, 93.384s/93.651s (`ime-context-red`, `ime-context-red2`): unchanged Mozc query/restore failure; task-local process snapshots show owned server holding private `.server.lock` and IPC, rather than a missing server. Owned audits clean; ordinary-close refusal and fallback forced cleanup separately retained. The first diagnostic did not emit its intended module probe; the second records module identity and snapshots.
- Standalone remote-only diagnostic — **not engine acceptance**, 0.686s (`ime-red.{log,json}`): no focused GTK client, empty engine queries; kept as an inconclusive control.
- Python GTK control setup — **blocked**, 1.033s (`gtk-ime-red.{log,json}`): system `gi` lacks `require_version`; no global/package changes. Disposable C GTK entry built with `cc -Wall -Wextra -Werror` using installed GTK instead.
- Standalone owned GTK original/bind/original controls — diagnostic **original queries fail; bind selects mozc**, 20.731s/20.711s/20.709s (`gtk-control-red`, `gtk-control-leaf-bind`, `gtk-control-original-repeat`): original `/proc/<pid>/exe` is package-prefix path, bind is `/usr/lib/mozc/mozc_server`. A cold switch can return 1 once but exact subsequent query must report mozc; existing trusted-input requirements are unchanged. Scripts return after bounded capture, so their exit 0 is not a passed engine gate.
- Frozen unchanged D-06 app with task-local read-only Mozc bind control — native trusted pinyin commit/cancel, Mozc literal あい, consumed Enter and Undo **pass**, but full editor mode **fail** at later original F6 Save assertion, 101.604s (`baseline-ime-leaf-bind.{log,json}`); owned audit clean. This separates the launcher correction from the application focus correction; baseline failure/failed ordinary close remain retained.
- Initial `pnpm check` — **fail**, 19.966s (`frontend.{log,json}`): new test used unsupported ByRoleOptions `exact`; removed that redundant option while retaining exact default button-name matching. No production/test policy weakened.
- `pnpm check` — **pass**, format/lint/typecheck/build and 1,739 tests, 106.889s (`frontend-final.{log,json}`): 876 current +863 retained ef0ff02 archive tests under default discovery; existing chunk advisory unchanged. Explicit `pnpm exec vitest run --dir tests` **pass 876/876**, 46.543s (`current-suite.{log,json}`).
- `cargo fmt --all -- --check`, `CARGO_HOME=/tmp/babel-cargo cargo clippy --workspace --all-targets --all-features --locked -- -D warnings`, `CARGO_HOME=/tmp/babel-cargo cargo test --workspace --locked` — **pass**, 0.799s/12.466s/**264/264 in 67.834s** (`rust-format`, `rust-static`, `workspace`); no SELinux or second-filesystem Rust claim.
- `pnpm test:browser` — actual Chromium/browser **pass**, 25.543s (`browser.{log,json}`), ports mocked/disabled; not native WebKit evidence.
- `CARGO_HOME=/tmp/babel-cargo pnpm tauri build --no-bundle` — default embedded release/pinned helper **pass**, 65.708s (`release-build.{log,json}`); frozen `339235f0f2be07eb348f5102b98342cc5eb045c2f46f8152d1941ee6044ba09f`, GTK 3.24.52/WebKitGTK 2.52.6 (`frozen-native.json`). Helper identity unchanged: 1,475 files/tree `808d2276543fce73967f8c66166d5e61a676282e094716da3e42b7831454086a`. No package/installed/CI claim.
- `python3 tests/native/writing-lifecycle/test_isolated_ime.py`, `sh tools/lint-py.sh` — structural/syntax **pass 2/2**, 0.055s/3.576s (`python-focused`, `python-static`); not composition evidence. Retained signed-package bytes independently rehashed: **10/10 identities match**, no prerequisite/pin mutation.
- `BABEL_NATIVE_BINARY=$PWD/target/audit-native-r1/frozen/babel-desktop BABEL_SHUTDOWN_MODE=ordinary python3 tests/native/writing-lifecycle/isolated_ime.py target/audit-simp-f/prerequisites/prefix -- python3 tests/native/writing-lifecycle/integrated_exit.py /tmp $PWD/target --output target/audit-native-r1/native --modes commands editor-exit` — actual WebKit initial **2/4 content successful, 3/4 owned crash audits clean**, 449.407s (`native.{log,json}`, roots/ledgers/journals): editor-exit content passes both filesystems, genuine composition/save/Undo/F6 plus no-op corpus/clipboard/recovery and D-06 protected lifecycle checks; Btrfs owned WebKit SIGSEGV makes that sample strict-failed. Both commands pass F6/back but then fail expected GTK Save As picker at stale helper traversal. Source/native assertions remain intact.
- Owned native menu screenshot/AT-SPI inspection — diagnostic **stale traversal identified** (`commands-native-menu.png`, `commands-atspi-menu.json` in failed roots): Save is followed by enabled Check external changes before Save As; original physical helper selected that action. An intermediate extra-Down guess still missed Save As on both filesystems (enabled native Reload source was another intermediate item); both failed runs retained, 69.569s total (`native-commands-final`), owned audits clean. That helper-source/binary experiment was reverted; no picker/byte assertion relaxed.
- `cc -Wall -Wextra -Werror -I/tmp tests/native/editor-input/keyboard.c /tmp/babel-m3-08-virtual-keyboard.c $(pkg-config --cflags --libs wayland-client) -o /tmp/babel-m3-08-keyboard` — **pass**, 0.974s (`keyboard-build.{log,json}`); before/after helper binaries/hashes retained. Compilation only, not a successful traversal; original C/helper restored from the retained snapshot after that failed experiment. Non-menu input branches were unchanged; only affected command workflow traversal is rerun.
- Independent AST/byte comparison versus `fcfade8` — **pass**, all **819 assertions across 58 native Python files unchanged** (`assertion-audit.json`); editor_exit/drill and frozen AUDIT bytes identical. Additional final source/evidence-prefix checks follow after documentation updates.

- Observed physical GTK traversal control — actual WebKit commands/tmpfs **pass 1/1**, 34.094s (`native-menu-observed.{log,json}`): owned AT-SPI selection shows Save → Check external changes → Reload source → Save As. Physical Enter occurs only after exact Save As selection; real picker/cancel/source/IME/dark-scale/read-only assertions pass. Existing scoped Accessibility helper revalidates PID/start ownership; no AT-SPI menu activation.
- Final commands with owned active-window guard — actual WebKit **pass 2/2**, **2/2 owned audits clean**, 70.240s (`native-commands-observed-final.{log,json}`): tmpfs/Btrfs complete F6/back, remap/native menu/picker cancellation, exact BOM/CRLF/Unicode bytes, real GTK-simple composition, palette containment/scale and read-only source navigation checks. Same frozen candidate; all original checks retained.
- Selected latest candidate inventory — **4/4 content/behavior successful, 3/4 strict**, with original failed matrices intact (`native-selected-results.json`). All 13 baseline/candidate attempts retain raw manifests/roots/ledgers; **12/13 owned audits clean** (`native-all-attempts.json`). This is selected evidence, not a clean single full matrix; no crash-failure filtering or green replacement of the Btrfs editor sample.
- Btrfs editor crash attribution — strict **fail**, owned WebKit SIGSEGV PID **251383/start 3043549**, parent Babel **251352/start 3043535**, **2026-10-04 07:15:29 UTC** (`native/03-btrfs-editor-exit-{processes,journal}.json`). Kernel event and delayed signal-11 coredump describe the same crash, not two. Parent disappearance and crash coincide in the existing forced SIGKILL/restart phase; cause/correction not established. Initial commentary incorrectly called 4/4 audits clean before reading the completed manifest; corrected to 3/4 and retained the failure.
- `coredumpctl --no-pager info 251383` plus independent copy/hash — **owned crash confirmed/retained**, 18,066,929 compressed bytes SHA `582d19cfcc5714553bce33a5f0e99e864ba132b66da7d2928fd50be296a384b2` (`btrfs-editor-core-info.log`, `btrfs-editor-core.json`, task-local `.zst`). Original system core, journal and failed root untouched; null MESSAGE does not remove attribution.
- `python3 tests/native/writing-lifecycle/audit_retained.py target/audit-native-r1/native-selected-results.json --output target/audit-native-r1/retained-audit-results.json` — independent read-only bytes/refs **pass for 3 strict-success roots**, 0.094s: 91 frames, 36 snapshots, 1 safety ref, 13 previous sources. Existing policy excludes the crash-failed Btrfs editor root; its scenario byte oracles and raw data remain retained, not reclassified as safe.

- Task-local tmpfs retention mirror — independent **pass**, 14.341s (`mirror.{log,json}`, `retained-tmpfs-manifest.json`): 21 roots including failed/control/private-IME roots, 2,249 regular files SHA-verified, 191,664 symlink targets verified without following them. Original roots untouched; Btrfs roots remain under target. This is evidence retention, not M6-03 application backup/copy/prune proof.
- `python3 tests/native/writing-lifecycle/test_owned_accessibility.py`, final `sh tools/lint-py.sh` — ownership/syntax **pass 5/5**, 0.507s/3.331s (`ownership-focused`, `python-final`); real menu selection/active-window guards above exercise the reused helper. No repeated frontend/Rust/build after harness-only traversal edits; application binary/source unchanged.
- Private IME cleanup query `org.freedesktop.DBus.NameHasOwner org.fcitx.Fcitx5` — **pass `(false,)`** after final runs; namespace teardown retains synthetic profiles and does not replace any personal service.

- Final `pnpm exec prettier --check src/app/WritingView.tsx tests/ui/WritingView.test.tsx TODO.md docs/current-state.md docs/tasks/AUDIT-NATIVE-R1.md docs/ux.md docs/requirements.md docs/test-evidence/AUDIT.md tests/native/writing-lifecycle/README.md`, `python3 tools/check-links.py`, `git diff --check` — **pass**, 1.623s/0.288s (258 changed-file links)/clean whitespace (`final-format`, `final-links`). Final boundaries **pass** (`final-boundaries.json`): 819 original native assertions, frozen AUDIT/editor/drill/C-helper bytes, prior evidence prefix and tested application source/binary all match; original helper restored. Only three affected requirement rows updated.

Claim limit: this completes the bounded F6/Mozc follow-up, not full native,
read-only F6/screenreader/IME/platform, SELinux, C1/F2, M6-02, M6-03 or Local v1
admission. The new owned Btrfs SIGSEGV, earlier failures/cores and initial daily
assessment observation remain open; clean content or later controls do not
resolve them. Stopped before D-02, local main commit only, no push.
