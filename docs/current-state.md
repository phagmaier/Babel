# Current state — M3-12 complete; M3-13 ready

Date: 2026-09-29 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [index](index.md).

## Task and work

**M3-12** bounded Linux acceptance passed. One editing agent on main from `bceaa9d`, preserving and completing the previous model’s uncommitted work. Inherited dirty paths: documents linux/mod + app_dir_tests, Tauri lib, App/WritingView/recovery/snapshot panels, application persistenceController/saveCadence/shortcuts/writingSession, editor shortcuts, editor-shortcuts/EditorControls/Snapshots/WritingView/writing-session tests and ADR 0026. Original `/tmp/babel-lifecycle-01` and `-02` synthetic drill artifacts remain intact.

Default native New/Open now connects one editor to serial persistence, cadence, Save As/export, recovery/restore/snapshots and protected close. Fixed F6 escape, frozen/read-only transaction rejection, deferred capture races, strict Save As IPC, caret/fresh identity adoption, receipt validation before replacement, old-resolution baseline handling, staged import loss and stale close-risk acceptance. The app-data root is safely narrowed before strict native initialization. [ADR 0026](decisions/0026-writing-lifecycle.md) records ownership/ordering; owning architecture/editor/UX/persistence docs are updated.

Changed code is in `src/app`, `src/application`, `src/editor`, `src-tauri` and core documents; focused contracts/UI tests plus `tests/native/writing-lifecycle` own regression coverage. No fixture bytes, dependency/lock, capability or SPEC invariant changed.

## Checks and evidence

[M3-12 evidence](test-evidence/M3.md#m3-12--production-writing-lifecycle-and-failure-ui) owns exact commands, host, logs and limits: focused 75, shared 477 frontend tests; formatting/lint/typecheck/build/browser smoke; Rust fmt/clippy, 192 native workspace tests on each filesystem, 32 feature tests and default embedded release build. Initial sandbox ACL failure and corrected harness attempts are recorded honestly.

Production UI/IPC drills passed on tmpfs and Btrfs with real GTK pickers, independent bytes/hash/caret/frame audits, native restore/Undo, acknowledged-checkpoint restart, history failure, external divergence and protected emergency-copy close. Artifacts: `/tmp/babel-writing-hucrvgtn` and `target/babel-writing-l5sle2t4`. No personal manuscript was used. No push authorized.

## Next action and limits

Select **M3-13** [brief](tasks/M3-13.md): full core/complex/unsupported source, keyboard/completion/paste/IME/undo in the default app, independent audits and separate data-loss/stale-result/privilege/egress review. Required unresolved cases keep the M3 exit open. Full compositor paint/page-equivalent performance, other platforms, installed/offline adoption and Local v1 remain open; full home/recents and revision navigation belong to later milestones.
