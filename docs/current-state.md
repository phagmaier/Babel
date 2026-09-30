# Current state — M4-08 complete

Date: 2026-09-30 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md).

## Task and work

**M4-08 complete — transactional replace one/all.** One editing agent on main from clean `6ce5bb7`; dependencies M4-07 and completed M3 protection gates satisfied. No push authorized.

Delivered a pure bounded replacement planner with EditorState-only transactions ([replace](../src/editor/replace.ts)), FindPanel preview/count/confirmation controls, replace-one advancement and atomic replace-all dispatch in the writing view; registry Replace stays disabled for the M4-14 palette. Plain single-row replacements (1,024-unit cap; no breaks/surrogates/hidden delimiters); title/protected/unmappable/stale matches refuse with explicit retained-content reasons. Plans brand session/version/document plus query/options; trial-apply plus deferred capture precede every dispatch. Replace-all is one history event with caret at the first replacement; confirmation at or above 100 editable matches.

Changed paths: `src/editor/replace.ts` (new), `src/app/FindPanel.tsx`, `src/app/WritingView.tsx`; `tests/contract/replace.test.ts` (new), `tests/ui/FindPanel.test.tsx`, native `replace_workflows.py` (new, `--replace`/`--replace-smoke`) + drill/README; owning editor/UX/requirements docs, task/TODO/trace/evidence.

## Verification

[M4-08 evidence](test-evidence/M4.md#m4-08--transactional-replace-one-and-replace-all) owns exact commands/results, failed attempts, synthetic fixtures/host/artifacts and limits. Focused checks passed **142 / 7 files**; shared formatting/lint/typecheck/build and **618 frontend tests / 45 files**, browser smoke, Rust format/clippy and **226 workspace tests** on tmpfs passed. Default embedded release built; real WebKit/GTK preview/title-refusal/button+Enter replace-one with focus/advance, atomic replace-all with one-step Undo, explicit Save/close/reopen/recovery resolution and exact per-stage byte audits passed (`/tmp/babel-writing-kjotvi5p`). Minimal smoke isolation and full `--find` regression (typical 93/142 ms within target) passed. Native debugging found and fixed one real product bug (advancement used the edits index instead of the match-slot index); drill-side settle/close/reopen discipline recorded honestly. Final documentation/link/syntax/diff checks are linked there.

## Remaining concerns and next action

**Next: [M4-09 Script Check](tasks/M4-09.md).** M4-09/10/11 are dependency-ready; proceed sequentially. M4-09–15 remain open; M4-15 requires all implementation tasks and a separate safety review. No full M4 or Local v1 claim.

Stress/long-session/compositor performance, broader accessibility/assistive technology, other platforms/filesystems, C1 WebKit/dependency hardening, installed/offline packaging, actual disk-full/hardware power loss, backups/migration and owner adoption remain open. Registry Replace awaits the M4-14 palette. M5 owns renderer/fonts/PDF; M6 history/scheduling/hardening; M7 explicit remote transfer. Completion stays local on main; no push/publication/milestone tag.
