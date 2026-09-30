# Current state — M4-02 Home workflows complete

Date: 2026-09-29 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [index](index.md).

## Task and work

**M4-02 complete — bounded Linux Home/native workflow gate.** One editing agent on main from `808c13e`, initially clean; no prior dirty paths or push authorized. M4-01 and the bounded corrected M3 gate remain complete.

Delivered visible asynchronous recent metadata, New/Open/Recent/Refresh/Locate/Remove, explicit moved-file comparison/link/different/cancel and truthful registry attention. New immediately attempts an exact initial-version checkpoint; New with destination uses native Save As and retains the unsaved draft on cancellation/failure. Protected Home return shares existing close/release; failed switching retains the editor, recovery and external source. Read-only entry points to separate-copy Save As. Startup recovery remains full-byte native revalidation with original checkpoints retained; Resume buttons name generation/version.

Changed code: `src/app/{App,Home,WritingView,RecoveryReview}.tsx`, `src/application/{recentController,writingSession}.ts`, Home/App/WritingView UI and session contract regressions; visible-control `--home` mode in `tests/native/writing-lifecycle/`. Owning architecture/UX/persistence/development, task/TODO/trace/index/evidence and native guide updated. No native-service, SPEC, ADR, dependency/lockfile, fixture, runtime permission or editor-engine change.

## Verification

[M4-02 evidence](test-evidence/M4.md#m4-02--home-and-recovery-workflows) owns exact commands, host, logs, artifacts, failures and limits. Focused checks passed 59 tests; frontend shared checks passed 513 tests/34 files; Chromium smoke, Rust formatting/lint and 223 native workspace tests per filesystem passed. Default embedded production release, no proof features, passed real WebKit keyboard/pointer/GTK picker/restart/byte drills on both filesystems. Full-byte resume beyond the 64 KiB preview, exact external-source/copy preservation, read-only Save As, metadata-only removal and registry-failure isolation passed.

Warm Home launch measured 917 ms on tmpfs and 879 ms on Btrfs, meeting the approximate 2-second target on the declared reference fixture/host. These include WebDriver polling and protection/release for return; compositor paint, cold installed startup, long-session scaling and worst-case recovery catalogs remain unmeasured. App-only screenshots were reviewed. One unchanged shared recovery-comparison test timed out during concurrent build load; focused and final shared reruns passed. Driver oracle/selection/readiness and a transient unused-message compile failure were corrected; no gate, timeout, filesystem permission or native queue limit was weakened.

## Remaining concerns and next action

**Next: [M4-03 manuscript index and outline navigation](tasks/M4-03.md).** Read versioned hierarchy/attachments/logical-text contracts before implementation. M4-04/06/11 are also ready; proceed sequentially. M4-13 owns hash/identity-safe recent position; M4-15 needs all tasks and a separate safety review. M4-03–15 remain open; no full M4 or Local v1 claim.

RustSec transitive GLib unsound-iterator/unmaintained macro concerns and C1 recurring WebKit child heap abort during deliberate prior Btrfs parent SIGKILL remain tracked. Accepted Home driver logs showed no heap/abort error, which does not close C1 or identify its origin. Specialized dependency/license/packaging and symbolized graphics lifecycle review remain required before adoption.

Full compositor/page calibration, long-session heap/DOM/catalog scaling, actual disk-full/power loss, other platforms/filesystems, installed/offline package, backup/migration and owner pilot remain open. M5 owns PDF/production renderer/font assessment; production history UX and remote transfer remain later work. Completion uses a local main commit; no push, publication or new milestone tag.
