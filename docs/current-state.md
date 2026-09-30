# Current state — bounded audit corrections verified; M3 exit open

Date: 2026-09-29 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [index](index.md).

## Task and work

Owner authorized fixes for the repository audit. One editing agent on main from `0a68130`, initially clean; no push authorized. Completed bounded corrections: **M3-12-R1, M3-09-R1, M3-11-R1, M3-04-R1, M3-10-R1, M3-12-R2, M3-03-R1**.

Implemented immediate live-version protection facts and native-verified labeled draft bundles for uncapturable work; coalesced cadence drain; selected managed/loose recovery and restart version allocation; explicit full-byte resume as a fresh draft; verified sparse intent/caret restoration; replacement metadata prepared before restore/recovery; read-only Save As and adoption rollback; failed-open release and per-registration destination retirement; bounded parser/capture performance corrections; release CSP without development localhost; current contract documentation. Recovery comparisons now serialize their full-buffer reads instead of exhausting the native queue on mount.

## Checks and remaining verification

[Audit correction evidence](test-evidence/M3.md#repository-audit-corrections) owns exact commands, host, outcomes, logs, failed attempts and limits. Latest shared frontend check passes 494 tests plus formatting/lint/typecheck/build; browser smoke, Rust fmt/clippy and default embedded release build pass. Native workspace matrix passes 200 tests per filesystem, including real filesystem tests and explicitly labeled MockRuntime IPC. Final default-app lifecycle and draft-bundle preservation pass on both tmpfs/Btrfs. Isolated 2,400-row typing verifies all 120 trusted keys and exact saved bytes; rAF proxy p95 is 49/43 ms, max 74/47 ms, with zero samples above 100 ms. The owner can use the desktop normally; native drills are finished.

The owner interrupted an earlier native run while working in another window, then explicitly requested resumption. Only synthetic owned test documents/processes are involved. A tool-build tmpfs quota failure was corrected by moving only this task's generated Cargo cache/security tooling to ignored Btrfs target directories; failed attempts remain evidence, never passes. A folder-picker harness error and a real concurrent recovery-comparison budget failure were investigated separately and corrected.

The RustSec scan has zero vulnerability entries but flags `glib 0.18.5` unsound `VariantStrIter` and unmaintained `proc-macro-error 1.0.4`, both transitive through the current GTK/Tauri stack. No affected iterator call was found in application or downloaded dependency runtime source outside GLib itself; this is a reachability assessment, not proof of immunity. Frontend production audit has zero advisories. No dependency/lockfile changes or blanket overrides were made.

## Next action and boundaries

Next ready task: **M3-13 independent integrated exit re-review**, using the correction evidence and final implementation. Local correction commit contains the seven task IDs; no milestone tag or push. Do not claim full M3-13 acceptance: independent exit re-review remains required. Full compositor paint/page calibration, long-session heap, native dependency/license/reachability and intermittent graphics-exit review, other platforms, installed/offline adoption, M4 workflows/PDF and Local v1 remain open. Investigate lower-confidence concerns before making speculative changes.
