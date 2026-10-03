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
