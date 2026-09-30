# Current state — M4-09 complete

Date: 2026-09-30 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md).

## Task and work

**M4-09 complete — non-destructive Script Check.** One editing agent on main from clean `082e994`; dependencies M4-03/06/07 satisfied. No push authorized.

Delivered the pure rule evaluator ([scriptCheck](../src/domain/scriptCheck.ts): SC001–004 warnings, SC006/007 dismissible advisories, typed SC005/SC008 unavailable assessment), versioned on-demand [controller](../src/application/scriptCheck.ts) with stale/rebase currency, grouped [panel](../src/app/ScriptCheckPanel.tsx) with counts/filters/dismissal/restore and export notice, and view-only [decorations/navigation](../src/editor/scriptCheck.ts) selecting affected blocks through stable ids with deferred post-paint scroll. Toolbar button is the surface; registry Script Check stays disabled for M4-14; find/check panels are mutually exclusive. No fixes offered.

Changed paths: `src/domain/scriptCheck.ts`, `src/application/scriptCheck.ts`, `src/editor/scriptCheck.ts`, `src/app/ScriptCheckPanel.tsx`, `src/app/WritingView.tsx`, `src/app/writing.css`; `tests/contract/script-check.test.ts`, `tests/ui/ScriptCheckPanel.test.tsx`, native `scriptcheck_workflows.py` + `--script-check` drill flag/README; owning validation/editor/UX/requirements docs, task/TODO/trace/evidence.

## Verification

[M4-09 evidence](test-evidence/M4.md#m4-09--non-destructive-script-check-and-issue-navigation) owns exact commands/results, failed attempts, synthetic fixtures/host/artifacts and limits. Focused checks passed **11 script-check tests**; shared formatting/lint/typecheck/build and **629 frontend tests / 47 files**, browser smoke, Rust format/clippy and **226 workspace tests** on tmpfs passed. Default embedded release built; real WebKit/GTK panel/filters/dismiss/navigation/Refresh/restore/Escape/save-with-warning/close with exact per-stage byte audits passed (`/tmp/babel-writing-i09selxu`, open-to-count 37 ms). Native debugging fixed three real product bugs (row-index navigation, stale-flash on transient captures, sync-scroll misplacement) and added the missing dismiss-restore path. Final documentation/link/syntax/diff checks are linked there.

## Remaining concerns and next action

**Next: [M4-10 presentation modes](tasks/M4-10.md).** M4-10/11 are dependency-ready; proceed sequentially. M4-10–15 remain open; M4-15 requires all implementation tasks and a separate safety review. No full M4 or Local v1 claim.

Open concerns carry over: stress/long-session/compositor performance, broader accessibility/assistive technology, other platforms/filesystems, C1 WebKit/dependency hardening, installed/offline packaging, actual disk-full/hardware power loss, backups/migration, owner adoption. M5 owns SC005/SC008 verification and PDF; M6 history/scheduling/hardening; M7 explicit remote transfer. No push/publication/milestone tag.
