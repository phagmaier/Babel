# Development history — completed-milestone focused checks

Status: archive. Per-task focused commands for completed milestones (M2-01–M5-05),
moved out of [development](../development.md) to keep the hot file on the lowest-tier path.
Exact results live in the linked evidence files. M6-01/M6-02 stay in `development.md`
because M6-02 is open. Do not load this file routinely; open the section your brief names, if any.

## Task-specific focused checks

Per-task focused commands and their exact results are recorded in the linked evidence files:

| Task   | Evidence                                                                                 | Focused command(s)                                                                                                                                                                                                                                         |
| ------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2-01  | [M2-01.md](../test-evidence/M2-01.md)                                                    | `cargo test -p screenwriter-core --test safe_open --locked`                                                                                                                                                                                                |
| M2-02  | [M2-02.md](../test-evidence/M2-02.md)                                                    | `cargo test -p screenwriter-core --lib --test recovery --locked`                                                                                                                                                                                           |
| M2-03  | [M2-03.md](../test-evidence/M2-03.md)                                                    | `cargo test -p screenwriter-core --lib --test source_save --locked`                                                                                                                                                                                        |
| M2-04  | [M2-04.md](../test-evidence/M2-04.md)                                                    | `cargo test -p babel-desktop -p screenwriter-core --lib --locked`                                                                                                                                                                                          |
| M2-05A | [M2-05A.md](../test-evidence/M2-05A.md)                                                  | `cargo test -p screenwriter-core --test startup_recovery --locked`                                                                                                                                                                                         |
| M2-05B | [M2-05B.md](../test-evidence/M2-05B.md)                                                  | `cargo test -p screenwriter-core --lib choices_store --locked`                                                                                                                                                                                             |
| M2-05C | [M2-05C.md](../test-evidence/M2-05C.md)                                                  | `cargo test -p screenwriter-core --lib snapshot_store --locked`                                                                                                                                                                                            |
| M2-05D | [M2-05D.md](../test-evidence/M2-05D.md)                                                  | `cargo test -p screenwriter-core --lib post_replace_external_edit_reports_uncertainty_and_blocks_relinquishment --locked`                                                                                                                                  |
| M2-06  | [M2-06.md](../test-evidence/M2-06.md)                                                    | `cargo test -p screenwriter-core --lib history_store --locked`                                                                                                                                                                                             |
| M3-01  | [M3.md](../test-evidence/M3.md#m3-01--independent-conformance-corpus-and-oracle)         | `pnpm exec vitest run tests/contract/production-fountain.test.ts`                                                                                                                                                                                          |
| M3-02  | [M3.md](../test-evidence/M3.md#m3-02--production-source-aware-codec-foundation)          | `pnpm exec vitest run tests/contract/production-fountain.test.ts`                                                                                                                                                                                          |
| M3-03  | [M3.md](../test-evidence/M3.md#m3-03--complex-fountain-regions-and-inline-semantics)     | `pnpm exec vitest run tests/contract/fountain-complex.test.ts tests/contract/production-fountain.test.ts`                                                                                                                                                  |
| M3-04  | [M3.md](../test-evidence/M3.md#m3-04--sole-editor-authority-and-source-bridge)           | `pnpm exec vitest run tests/contract/editor-bridge.test.ts`                                                                                                                                                                                                |
| M3-05  | [M3.md](../test-evidence/M3.md#m3-05--smart-keys-joins-and-structural-undo)              | `pnpm exec vitest run tests/contract/editor-keys.test.ts tests/contract/editor-bridge.test.ts tests/contract/fountain-complex.test.ts tests/contract/production-fountain.test.ts`                                                                          |
| M3-06  | [M3.md](../test-evidence/M3.md#m3-06--element-picker-and-configurable-shortcut-registry) | `pnpm exec vitest run tests/contract/editor-shortcuts.test.ts tests/ui/EditorControls.test.tsx tests/contract/editor-keys.test.ts tests/contract/editor-bridge.test.ts tests/contract/fountain-complex.test.ts tests/contract/production-fountain.test.ts` |

All focused commands use `CARGO_HOME=/tmp/babel-cargo` and `--locked` where applicable. Btrfs fixture roots are set via `BABEL_*_TEST_ROOT` environment variables as documented in each evidence file. Shared gates (`pnpm check`, `pnpm test:browser`, `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`) remain mandatory for all tasks.

M3-06 native picker/shortcut diagnostic: [instructions](../../tests/native/editor-shortcuts/README.md). It uses production controls and the existing feature-only report transport on synthetic text; local remapping is exercised in a fresh private WebKit profile. No manuscript is opened/saved and default writing activation remains M3-12.

M3-07 focused check: `pnpm exec vitest run tests/contract/editor-completion.test.ts tests/ui/CompletionPopup.test.ts tests/contract/editor-shortcuts.test.ts tests/ui/EditorControls.test.tsx tests/contract/editor-keys.test.ts tests/contract/editor-bridge.test.ts tests/contract/fountain-complex.test.ts tests/contract/production-fountain.test.ts`. The [native completion diagnostic](../../tests/native/editor-completion/README.md) uses real WebKit keys and an optional actual Wayland pointer helper on synthetic text. Its pinned MIT wlr development protocol and host Wayland tools are test-only; they add no application dependency or bundled runtime. [M3-07 evidence](../test-evidence/M3.md#m3-07--local-character-and-heading-completion) distinguishes real input from synthetic mouse/composition events.

M3-08 focused checks: `pnpm exec vitest run tests/contract/editor-input.test.ts tests/ui/EditorInput.test.ts tests/contract/editor-bridge.test.ts tests/contract/editor-keys.test.ts tests/contract/editor-completion.test.ts tests/contract/editor-shortcuts.test.ts tests/ui/CompletionPopup.test.ts tests/contract/fountain-complex.test.ts tests/contract/production-fountain.test.ts`. Native protection: `CARGO_HOME=/tmp/babel-cargo cargo test -p screenwriter-core editor_import --locked`, repeated with `BABEL_HISTORY_TEST_ROOT=$PWD` on the reference Btrfs root.

M3-09 focused checks: `pnpm exec vitest run tests/contract/document-entry.test.ts tests/contract/document-ipc.test.ts tests/contract/snapshots.test.ts`. Native entry: `CARGO_HOME=/tmp/babel-cargo cargo test -p babel-desktop --locked document_entry`, repeated with `BABEL_IPC_TEST_ROOT=$PWD` on the reference Btrfs root.

M3-10 focused checks: `pnpm exec vitest run tests/contract/save-cadence.test.ts tests/ui/WritingView.test.tsx tests/contract/persistence-controller.test.ts tests/contract/persistence-state.test.ts tests/contract/snapshots.test.ts`. Native cadence: `CARGO_HOME=/tmp/babel-cargo cargo test -p babel-desktop --locked persistence_cadence`, repeated with `BABEL_IPC_TEST_ROOT=$PWD` on the reference Btrfs root and `BABEL_CADENCE_REPORT=/tmp/babel-m3-10-cadence-<fs>.json` for the latency report.

M3-11 focused checks: `pnpm exec vitest run tests/contract/save-as.test.ts tests/contract/document-entry.test.ts tests/contract/snapshots.test.ts`, `CARGO_HOME=/tmp/babel-cargo cargo test -p screenwriter-core --locked save_as` and `CARGO_HOME=/tmp/babel-cargo cargo test -p babel-desktop --locked save_as`, each native file repeated with `BABEL_SAVE_TEST_ROOT=$PWD` / `BABEL_IPC_TEST_ROOT=$PWD` on the reference Btrfs root. The [native input diagnostic](../../tests/native/editor-input/README.md) owns synthetic clipboard/physical-key prerequisites, browser request interception and row/latency proxy methods. Its driver exercises real pinyin commit/cancel and mozc commit with trusted composition, exact bytes and undo, and exits 0; row/latency figures stay proxy methods, not paint/page-equivalent proof. Do not label that a complete S13 gate.

M3-12 focused checks: `pnpm exec vitest run tests/contract/writing-session.test.ts tests/ui/WritingView.test.tsx tests/contract/save-cadence.test.ts tests/contract/protected-close.test.ts tests/ui/ProtectedClosePanel.test.tsx tests/ui/Snapshots.test.tsx tests/contract/editor-input.test.ts`. Native app-directory restriction: `CARGO_HOME=/tmp/babel-cargo cargo test -p screenwriter-core --locked app_dir_tests`, repeated with `BABEL_APP_DIR_TEST_ROOT=$PWD` for Btrfs. The [production lifecycle drill](../../tests/native/writing-lifecycle/README.md) runs the release app with WebKitWebDriver and real GTK pickers on disposable tmpfs/Btrfs files, with independent bytes/checksums/caret audits and owned-process restart. It requires no proof feature or app plugin. Shared gates still apply; [M3-12 evidence](../test-evidence/M3.md#m3-12--production-writing-lifecycle-and-failure-ui) owns exact commands, outcomes and logs.

M3-13 integrated native editor and separate capture/performance review: [runner instructions](../../tests/native/writing-lifecycle/README.md#m3-13-integrated-editor-and-separate-review). Build the default release without proof features; run each mode sequentially on tmpfs and Btrfs. The [M3-13 evidence](../test-evidence/M3.md#m3-13--integrated-editor-gate-and-separate-safety-review) records commands/outcomes, including failed attempts and required review findings. A runner that successfully reproduces a known defect is not a passed milestone.

The [corrected M3-13 exit](../test-evidence/M3.md#m3-13--corrected-integrated-exit-re-review) passed fresh full default-app corpus/input/IME/lifecycle runs, shared checks and native safety matrix on both filesystems. Its [separate re-review](reviews/2026-09-29-m3-13-rereview.md) closes the bounded Linux M3 gate and retains specialized/release limits.

Repository audit correction checks: `pnpm exec vitest run tests/contract/editor-metadata.test.ts tests/contract/editor-bridge.test.ts tests/contract/fountain-complex.test.ts tests/contract/save-cadence.test.ts tests/contract/writing-session.test.ts tests/ui/WritingView.test.tsx tests/ui/RecoveryChoices.test.tsx`. Run the default release `--audit-fixes`, `--capture-review` and `--latency-review` modes sequentially on both filesystems; use `BABEL_NATIVE_BINARY` only to select the explicitly built default binary. Keep other builds/tests idle during timing. The [correction evidence](../test-evidence/M3.md#repository-audit-corrections) owns exact results, dependency warnings, failure attempts and limits. Shared gates remain required.

M4-01 focused checks: `pnpm exec vitest run tests/contract/recent-projects.test.ts`,
`CARGO_HOME=/tmp/babel-cargo cargo test -p screenwriter-core recent_store --locked`
and `CARGO_HOME=/tmp/babel-cargo cargo test -p babel-desktop recent_projects --locked`.
Repeat filesystem tests with `BABEL_RECENT_TEST_ROOT` / `BABEL_IPC_TEST_ROOT`
on the actual Btrfs synthetic root. Include `BABEL_RECENT_TEST_ROOT` in the shared
workspace matrix. [Recent native drill](../../tests/native/writing-lifecycle/README.md#m4-01-native-recents)
uses `python3 tests/native/writing-lifecycle/drill.py /tmp --recents` and the
Btrfs target root. Build the default production binary with
`CARGO_HOME=/tmp/babel-cargo pnpm tauri build --no-bundle`; a plain Cargo release
build on this host loaded the development URL and is not native production
verification. [M4 evidence](../test-evidence/M4.md#m4-01--native-recents-and-missing-file-selection)
owns exact commands/results and failure attempts. Shared checks remain mandatory.

M4-02 focused checks: `pnpm exec vitest run tests/ui/Home.test.tsx tests/ui/App.test.tsx tests/ui/WritingView.test.tsx tests/contract/document-entry.test.ts tests/contract/writing-session.test.ts`.
Build the default release with `CARGO_HOME=/tmp/babel-cargo pnpm tauri build --no-bundle`;
run `python3 tests/native/writing-lifecycle/drill.py /tmp --home` and
`python3 tests/native/writing-lifecycle/drill.py $PWD/target --home`
sequentially, without concurrent builds/tests when measuring Home. This
[Home drill](../../tests/native/writing-lifecycle/README.md#m4-02-native-home-workflows)
uses visible production controls and actual GTK pickers, with independent literal
source/checkpoint/copy byte oracles. Shared checks and the existing filesystem
workspace matrix remain required. [M4 evidence](../test-evidence/M4.md#m4-02--home-and-recovery-workflows)
records outcomes and warm-measurement limits.

M4-03 focused checks: `pnpm exec vitest run tests/contract/editor-bridge.test.ts tests/contract/manuscript-index.test.ts tests/contract/manuscript-projection.test.ts tests/ui/Outline.test.tsx tests/ui/WritingView.test.tsx`. Isolated index measurement: `BABEL_INDEX_MEASUREMENTS=/tmp/babel-m4-03-index-results.json pnpm exec vitest run tests/contract/manuscript-index-performance.test.ts`. The test records seven warm V8 builds, excluding parse/capture/paint, with exact source dimensions/hash. Normal shared runs do not write this report.

After a default release build, `python3 tests/native/writing-lifecycle/drill.py /tmp --outline` drives real WebKit/GTK, pointer/Tab/Enter, collapse/filter, Unicode caret, Undo, uncapturable stale results, actual pinyin commit/cancel, 150% app DOM zoom and typical/stress last-heading navigation with independent exact-byte oracles. `python3 -m py_compile tests/native/writing-lifecycle/drill.py tests/native/writing-lifecycle/outline_workflows.py` validates harness syntax. No second filesystem run is required for this pure projection/selection increment; shared native tests still run. [M4 evidence](../test-evidence/M4.md) distinguishes index construction, native opening/capture and event-to-two-rAF observations from compositor paint/full S13.

M4-04 focused checks: `pnpm exec vitest run tests/contract/workflow-protection.test.ts tests/contract/writing-session.test.ts tests/contract/editor-input.test.ts tests/contract/save-cadence.test.ts tests/ui/WritingView.test.tsx`, `CARGO_HOME=/tmp/babel-cargo cargo test -p screenwriter-core history_store --locked` and `CARGO_HOME=/tmp/babel-cargo cargo test -p babel-desktop workflow_protection --locked`. Repeat native focused checks with `BABEL_HISTORY_TEST_ROOT` / `BABEL_IPC_TEST_ROOT` under the reference Btrfs target root. After the default release build, run `python3 tests/native/writing-lifecycle/drill.py /tmp --workflow-protection` and the Btrfs target root sequentially. Shared checks and both-filesystem workspace matrix remain required; [M4 evidence](../test-evidence/M4.md) records results and limits.

M4-05 focused checks: `pnpm exec vitest run tests/contract/scene-moves.test.ts tests/ui/Outline.test.tsx tests/ui/WritingView.test.tsx`. After the default release build run `python3 tests/native/writing-lifecycle/drill.py /tmp --scene-moves` and `python3 tests/native/writing-lifecycle/drill.py $PWD/target --scene-moves` sequentially. Shared checks and the inherited tmpfs/Btrfs workspace matrix remain required because large moves publish native recovery/history. Pure planner/state checks need no repeated filesystem claim. [Evidence](../test-evidence/M4.md#m4-05--reversible-scene-and-section-moves).

M4-06 focused checks: `pnpm exec vitest run tests/contract/title-page.test.ts tests/ui/TitlePagePanel.test.tsx tests/contract/editor-bridge.test.ts tests/ui/WritingView.test.tsx`. Build the default embedded release, then run `python3 tests/native/writing-lifecycle/drill.py /tmp --title-page` and repeat on `$PWD/target`. Validate the harness with `python3 -m py_compile tests/native/writing-lifecycle/drill.py tests/native/writing-lifecycle/title_page.py`. The title codec/state transforms add no filesystem adapter; the native Save/recovery/restore drill reuses the inherited source-safety matrix. Shared checks remain required; [evidence](../test-evidence/M4.md#m4-06--source-preserving-title-page-form).

M4-07 focused checks: `pnpm exec vitest run tests/contract/find.test.ts tests/ui/FindPanel.test.tsx tests/contract/editor-shortcuts.test.ts tests/ui/WritingView.test.tsx tests/contract/editor-bridge.test.ts tests/contract/manuscript-projection.test.ts`. Build the default embedded release with `CARGO_HOME=/tmp/babel-cargo pnpm tauri build --no-bundle`, then run `python3 tests/native/writing-lifecycle/drill.py /tmp --find`. Validate the harness with `python3 -m py_compile tests/native/writing-lifecycle/drill.py tests/native/writing-lifecycle/find_workflows.py`. Pure matching/view-only highlights/selection change no native filesystem engine; no duplicate filesystem run required. Shared checks remain required. [M4 evidence](../test-evidence/M4.md#m4-07--logical-text-find-and-hidden-navigation) records exact byte/journal audits, real focus/shortcuts/IME and trusted-input-to-count/two-rAF measurements; these are WebKit observations, not compositor paint or full S13.

M4-10 focused checks: `pnpm exec vitest run tests/contract/view-preferences.test.ts tests/ui/WritingView.test.tsx tests/contract/editor-shortcuts.test.ts`. Build the default embedded release with `CARGO_HOME=/tmp/babel-cargo pnpm tauri build --no-bundle`, then run `python3 tests/native/writing-lifecycle/drill.py /tmp --presentation` with GUI access. Harness syntax: `python3 -m py_compile tests/native/writing-lifecycle/drill.py tests/native/writing-lifecycle/presentation_workflows.py`. Pure UI preferences/view-only behavior needs no second-filesystem run; shared gates remain required. [M4 evidence](../test-evidence/M4.md#m4-10--presentation-modes) records synthetic workload hashes, caret/IME/scroll/failure/restart, native event-handler spans and rAF proxies with their performance limits.

M4-11 focused contracts: `pnpm exec vitest run tests/contract/spellcheck-probe.test.ts` (JSDOM source/DOM/Undo/protection contracts only). The [isolated native spellcheck probe](../../tests/native/spellcheck/README.md) documents helper prerequisites, compiled local assets, exact C compile and `python3 tests/native/spellcheck/run.py` invocation. It uses real GTK3/WebKitGTK/Enchant/Hunspell, physical native popup actions, disposable Enchant/XDG profiles and an observed network namespace with only loopback. It changes no production activation or dictionary publication adapter; no second filesystem run is required. Shared checks and default embedded release/regression remain mandatory; [M4-11 evidence](../test-evidence/M4.md#m4-11--offline-spellcheck-proof) owns scope, language/resource/license coverage and failed attempts.

M4-12 focused checks: `pnpm exec vitest run tests/contract/spellcheck.test.ts tests/ui/Spellcheck.test.tsx`, `CARGO_HOME=/tmp/babel-cargo cargo test -p screenwriter-core spellcheck --locked` and `CARGO_HOME=/tmp/babel-cargo cargo test -p babel-desktop spellcheck --locked`; repeat native checks with `BABEL_SPELLCHECK_TEST_ROOT=$PWD/target`. Full workspace filesystem matrix remains required. The direct Enchant 2 ABI uses existing system library/linker files; resource/license ownership is [ADR 0033](../decisions/0033-production-spellcheck-boundary.md).

Build default production resources/packages with `CARGO_HOME=/tmp/babel-cargo XDG_CACHE_HOME=/tmp/babel-cache pnpm tauri build`. With the existing native helper prerequisites, run `PATH=/tmp:$PATH unshare --user --map-root-user --net /bin/sh -c 'ip link set lo up && exec python3 tests/native/writing-lifecycle/drill.py /tmp --spellcheck'` and repeat on `$PWD/target`. The test uses a disposable pinned `wtype` helper if not installed, no global installation; [native guide](../../tests/native/writing-lifecycle/README.md#m4-12-production-spellcheck) records exact build/coverage. `python3 -m py_compile tests/native/writing-lifecycle/drill.py tests/native/writing-lifecycle/spellcheck_workflows.py` checks harness syntax. [Evidence](../test-evidence/M4.md#m4-12--production-offline-spellcheck) retains failures and coverage. Use the checked-in Node 26.7.0/Rust 1.97.1 toolchains; prepend their actual binary directories if inherited PATH bypasses toolchain selectors.

M4-13 focused checks: `pnpm exec vitest run tests/contract/character-counts.test.ts tests/contract/recent-position.test.ts tests/ui/CharacterPanel.test.tsx tests/ui/WritingView.test.tsx tests/contract/manuscript-projection.test.ts`.
After the default embedded release/package build, run
`PATH=/tmp:$PATH python3 tests/native/writing-lifecycle/drill.py /tmp --characters`;
repeat on `$PWD/target` for the inherited native Save As/
recovery inspection. Harness syntax:
`python3 -m py_compile tests/native/writing-lifecycle/drill.py tests/native/writing-lifecycle/character_workflows.py`.
The drill uses the existing `/tmp/wtype` picker and owned keyboard helper
(`/tmp/babel-m3-08-keyboard`) with GTK simple IME; no new dependency or native
filesystem publication. Shared frontend/Rust/browser gates remain required;
[M4-13 evidence](../test-evidence/M4.md#m4-13--characters-counts-and-recent-position)
labels synthetic DOM selection/close activation separately from native controls,
trusted typing/IME, real filesystem IPC and process restart.

M4-14 focused checks: `pnpm exec vitest run tests/contract/command-dispatch.test.ts tests/ui/CommandPalette.test.tsx tests/ui/EditorControls.test.tsx tests/ui/WritingView.test.tsx tests/ui/Home.test.tsx tests/ui/App.test.tsx tests/contract/editor-shortcuts.test.ts tests/ui/TitlePagePanel.test.tsx tests/ui/Outline.test.tsx tests/ui/Spellcheck.test.tsx` and `CARGO_HOME=/tmp/babel-cargo cargo test -p babel-desktop command_menu --locked`.
Build the default embedded release/package with `CARGO_HOME=/tmp/babel-cargo XDG_CACHE_HOME=/tmp/babel-cache pnpm tauri build`, then run `PATH=/tmp:$PATH python3 tests/native/writing-lifecycle/drill.py /tmp --commands` and repeat on `$PWD/target` for the inherited native Open/Save/protected-close path. Harness syntax: `python3 -m py_compile tests/native/writing-lifecycle/drill.py tests/native/writing-lifecycle/command_workflows.py tests/native/writing-lifecycle/command_accessibility.py`.
The menu bridge itself publishes no files. Shared frontend/browser/Rust checks and inherited full filesystem matrix remain required. Native GTK menu and compositor keyboard evidence must be distinguished from mocked IPC and DOM semantic checks; absent screenreader coverage stays open. [M4 evidence](../test-evidence/M4.md#m4-14--palette-menus-and-accessibility) owns results and limits.

M4-14 native menu traversal requires rebuilding the existing owned keyboard helper after its new `command-menu-save-as` action: `cc -Wall -Wextra -Werror -I/tmp tests/native/editor-input/keyboard.c /tmp/babel-m3-08-virtual-keyboard.c $(pkg-config --cflags --libs wayland-client) -o /tmp/babel-m3-08-keyboard`. Use the already generated pinned protocol/keymap from [the native input guide](../../tests/native/editor-input/README.md); no global installation. AT-SPI inspection requires the existing accessibility bus, `gdbus` and `/usr/include/at-spi-2.0/atspi/atspi-constants.h`. Missing prerequisites block that gate; they do not justify inspecting unrelated applications.

M4-15 integrated exit: build the default embedded release with
`CARGO_HOME=/tmp/babel-cargo pnpm tauri build --no-bundle`, then run
`PATH=/tmp:$PATH python3 tests/native/writing-lifecycle/integrated_exit.py /tmp $PWD/target --output /tmp/babel-m4-15-native-final`.
The output directory must be new. The sequential 19-mode matrix owns fresh
profiles and preserves per-mode commands, logs, roots, elapsed time, return codes
and runtime crash lines in `results.json`. Spelling uses the existing loopback-only
network namespace; all other scenarios use existing owned input/picker helpers.
Keep builds/shared tests idle during the native matrix's timing modes.
`--modes <mode ...>` supports explicit failed-mode reruns; retain earlier failures.
A zero harness exit does not excuse an unresolved runtime crash or content defect.
[Guide](../../tests/native/writing-lifecycle/README.md#m4-15-integrated-exit) defines coverage/limits.
Focused M4-08 correction: `pnpm exec vitest run tests/contract/replace.test.ts tests/ui/FindPanel.test.tsx tests/contract/editor-bridge.test.ts`.
Harness syntax: `python3 -m py_compile tests/native/writing-lifecycle/drill.py tests/native/writing-lifecycle/integrated_workflows.py tests/native/writing-lifecycle/integrated_exit.py tests/native/writing-lifecycle/picker_accessibility.py`.
Full M4-00 shared gates and native workspace tmpfs/Btrfs matrix remain required.

M4-15 retained artifacts: `python3 tests/native/writing-lifecycle/audit_retained.py /tmp/babel-m4-15-native-final/results.json --output /tmp/babel-m4-15-retained.json`. Only successful roots are audited; independent scenario byte/selection/mark oracles remain required. Include `audit_retained.py` in the harness syntax check.

M4-15 standalone current Find/navigation timing: `PATH=/tmp:$PATH python3 tests/native/writing-lifecycle/integrated_exit.py /tmp $PWD/target --output /tmp/babel-m4-15-timing --modes find-timing`. It runs the original bounded typical/stress timing assertions independently; full `--find` still requires its actual pinyin query checks.

M4-15 isolated native IME prerequisite: after verifying and unpacking signed host
packages into a disposable prefix, run
`python3 tests/native/writing-lifecycle/isolated_ime.py /tmp/babel-m4-15-fcitx/prefix -- python3 tests/native/writing-lifecycle/integrated_exit.py /tmp $PWD/target --modes outline title-page find presentation editor-exit --output /tmp/babel-m4-15-preedit-native-1`.
The wrapper refuses an existing Fcitx service or legacy personal Mozc profile,
uses a read-only system/package overlay and private writable profile, and stops
only its owned daemon namespace after the drill. No privileged installation,
global setting, compositor keyboard frontend or cloud engine. The
[native guide](../../tests/native/writing-lifecycle/README.md#m4-15-integrated-exit)
and [evidence](../test-evidence/M4.md#m4-15--integrated-exit-and-separate-safety-review)
record package verification, required helpers and exact versions. Retain the
wrapper's `IME ARTIFACTS` profile/logs. Include `isolated_ime.py` in Python syntax
checks. Real start/end and literal source/form/query audits remain mandatory. Native spelling/characters/commands select GTK's exact built-in `gtk-im-context-simple` ID so the private Fcitx wildcard module cache cannot override those separate drills.

M4-15 shutdown diagnostic subset: with the same default embedded release and
verified private IME prefix, run
`python3 tests/native/writing-lifecycle/isolated_ime.py /tmp/babel-m4-15-fcitx/prefix -- python3 tests/native/writing-lifecycle/shutdown_isolation.py /tmp $PWD/target --repeats 2 --output /tmp/babel-m4-15-shutdown-paired-1`.
The [native guide](../../tests/native/writing-lifecycle/README.md#m4-15-paired-shutdown-isolation)
owns the two entry points, process/phase recording and scope limits. Audit its
`results.json` with the existing `audit_retained.py`; include both
`shutdown_isolation.py`, `shutdown_lifecycle.py` and `audit_shutdown.py` in Python
syntax checks. `audit_shutdown.py <results.json> --output <new-audit.json>` checks
frozen exact bytes/checkpoints and phase order even in crash-failed roots.
Add `--presentation-no-restart` with a new output directory to omit only the
preference restart (one final exit); the guide records coverage limits. Paired
cases continuously poll descendant PID/start tokens and perform bounded kernel/
coredump journal scans; include `process_watch.py` and `test_process_watch.py`
and `audit_process_watch.py` in syntax checks and run `python3 tests/native/writing-lifecycle/test_process_watch.py`
for synthetic attribution/null-message/failure regressions. No product
behavior/dependency changes or full-matrix acceptance are implied.

Cold-Home non-automation control: replace the diagnostic command with
`python3 tests/native/writing-lifecycle/plain_quit.py /tmp $PWD/target --repeats 4 --output /tmp/babel-m4-15-plain-quit-1`
inside the same private IME wrapper; include `plain_quit.py` in syntax checks.
This covers graceful native Home quit only, with no manuscript/drafting claim.

M5-04 focused checks: `pnpm exec vitest run tests/contract/script-check.test.ts tests/contract/export-assessment.test.ts tests/ui/ScriptCheckPanel.test.tsx`,
`cargo test -p babel-desktop publication --locked` and repeat with
`BABEL_PUBLICATION_TEST_ROOT=$PWD/target/m5-04`.
`python3 tools/pdf-helper/test_coverage.py` compares pinned coverage with installed
Fontconfig/FreeType. `python3 tools/pdf-helper/build.py --offline` regenerates and
checks that coverage at build time; exact runtime identity remains unchanged.
Build the default embedded release with `pnpm tauri build --no-bundle`, then run
`GTK_IM_MODULE=gtk-im-context-simple python3 tests/native/writing-lifecycle/drill.py /tmp --script-check`
and repeat with `$PWD/target/m5-04`. The existing owned keyboard helper and
installed `wtype` are required; no personal manuscript or profile is inspected.
Harness syntax: `python3 -m py_compile tests/native/writing-lifecycle/scriptcheck_workflows.py src-tauri/src/assessment_probe.py tools/pdf-helper/coverage.py tools/pdf-helper/test_coverage.py`.
Shared frontend/browser/Rust gates and native tmpfs/Btrfs workspace matrix remain
required for the new read-only IPC boundary. Pure assessment logic needs no
second filesystem. [Evidence](../test-evidence/M5.md#m5-04--production-sc005sc008-assessment)
owns commands/results and omissions.

M5-05 focused checks: `pnpm exec vitest run tests/ui/PublicationPreview.test.tsx tests/contract/publication-freshness.test.ts`,
`cargo test -p babel-desktop publication --locked` (includes bounded binary reads
and malformed/foreign/stale/symlink/hardlink artifacts). `pnpm test:browser` now
also displays a real frozen-helper fixture in Chromium; run `pnpm pdf-helper`
first on a fresh checkout. Build the default embedded release with
`pnpm tauri build --no-bundle`, then run
`GTK_IM_MODULE=gtk-im-context-simple python3 tests/native/writing-lifecycle/drill.py /tmp --publication-preview`
and repeat with `$PWD/target/m5-05`. The drill verifies actual bundled worker,
canvas/text/count, theme/zoom/focus, delayed real IPC stale response, renderer
refusal and exact Save, then runs the unchanged M4 2,400-row/120-key workload
with preview enabled. Typing samples are rAF proxies, not compositor paint.
Syntax-check `publication_preview.py`, `editor_exit.py` and `drill.py`; full
frontend/browser/Rust checks and tmpfs/Btrfs workspace/native matrix apply.
[Evidence](../test-evidence/M5.md#m5-05--authoritative-preview-and-page-count-freshness),
[direct license/packaging](../third-party/pdf-viewer.md).
