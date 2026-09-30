# Current state — bounded Linux M3 core-editor exit passed

Date: 2026-09-29 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [index](index.md).

## Task and work

**M3-13 complete.** The owner authorized audit corrections and continued native verification. One editing agent on main from `3194795`, initially clean; no push authorized. Fresh full default-app integration and a separate source re-review close the bounded Linux M3 gate. This is a separate pass by the same agent, not a second-reviewer claim. This task changes documentation only; the seven bounded correction tasks remain in `3194795`.

[Corrected re-review](reviews/2026-09-29-m3-13-rereview.md) verifies sole editor authority, immediate version-bound protection facts, source preservation, cadence drain, full/selected recovery, replacement metadata, Save As rollback, destination retirement and native privilege/egress/resource boundaries. No additional confirmed M3 blocking issue was found. Historical defects and failed attempts remain recorded.

## Verification

[Fresh M3-13 evidence](test-evidence/M3.md#m3-13--corrected-integrated-exit-re-review) owns exact commands, host, artifacts and limits. Shared checks pass 494 frontend tests, formatting/lint/typecheck/build, browser smoke, Rust fmt/clippy and default release rebuild. Native workspace safety matrix passes 200 tests per filesystem, with MockRuntime distinguished from actual native UI. The rebuilt default binary is byte-identical to the one used for the full native runs.

Actual default WebKit/GTK tmpfs and Btrfs runs pass 21 source cases, eight edit/Undo audits, 85 trusted clipboard/key/composition events each, real pinyin/mozc, completion/caret, read-only Save As, unsaved acknowledged-checkpoint restart/resume, managed recovery/Keep/Save, snapshot restore/immediate Save/Undo, source/history failures and external divergence with exact emergency copy. Both runners exited 0; native drills are finished and the desktop is available normally. Independent retained-file/bundle inspection also passes.

[Correction evidence](test-evidence/M3.md#repository-audit-corrections) retains the unchanged-implementation bundle and complete 120-key timing gates: exact saved bytes, rAF proxy p95 49/43 ms and max 74/47 ms. These are earlier correction runs, not fresh timing claims or full S13 paint/page acceptance.

## Remaining concerns and next action

RustSec flags transitive GLib unsound-iterator and unmaintained macro warnings; source search found no affected runtime call outside GLib itself, without proving immunity. Host review confirms **C1: recurring WebKit child heap abort** during the deliberate Btrfs parent SIGKILL, with allocator, Mesa exit and WebKit/EGL destructor frames. Exact corruption origin and ordinary editing/close impact are unresolved; source/checkpoint recovery passed. Native dependency/license/packaging and symbolized graphics lifecycle review remain specialized hardening work before adoption.

Full compositor paint/page calibration, long-session heap/DOM/catalog scaling, actual disk-full/power loss, other platforms/filesystems, installed/offline package, backup/migration and owner pilot remain open. M4 workflows, M5 PDF, production history and remote transfer remain future work; Local v1 is unverified.

**Stop at the M3 boundary. Next: create a bounded M4-00 decomposition and refine the trace before implementing M4.** Completion uses a local main commit and a tag for the verified bounded Linux M3 gate; no push or publication. No implementation/dependency/lockfile/fixture change was needed in this re-review.
