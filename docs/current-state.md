# Current state — M4-07 complete

Date: 2026-09-30 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md).

## Task and work

**M4-07 complete — bounded Linux logical-text find and hidden navigation.** One editing agent on main from clean `80871c6`; dependencies M4-03/06 satisfied. No push authorized.

Delivered pure scalar-safe literal matching over the existing versioned manuscript projection, cancellable bounded jobs/cache, FindPanel and registry Find/Next/Previous, exact count/wrap, case/Unicode whole-word and full/current-scene scope, title/note/omitted/raw filters and labeled reveals. Matches stay within logical rows/regions; unknown/unclosed/incomplete interpretation stays literal and disclosed. Query/result/list/highlight limits are explicit; stale/uncapturable/frozen/composing results cannot navigate.

Selection/highlights/focus preserve source spelling, marks and Undo; closing does not restore an earlier caret. View-only decorations preserve EditorState identity. Selection-only find rebinds branded identical immutable captures with current frozen bounded metadata and one source root, without hashing/parsing/source copies or native writes. Old anchors and deferred post-render scroll check exact session/version/document/selection/focus. No editor recreation, second committed content store, dependency, native service/capability, filesystem engine or SPEC/ADR change.

Changed paths: `src/domain/find.ts`, `src/application/find.ts`, `src/editor/find.ts`, `src/app/FindPanel.tsx`; existing capture/offset/view/registry/WritingView/CSS integration; focused contract/UI tests and native `find_workflows.py`/drill/README; owning model/editor/UX/development docs, task/TODO/affected trace/evidence.

## Verification

[M4-07 evidence](test-evidence/M4.md#m4-07--logical-text-find-and-hidden-navigation) owns exact commands/results, failed attempts, synthetic fixtures/host/artifacts and limits. Expanded focused checks passed **129 / 6 files**; shared formatting/lint/typecheck/build and **605 frontend tests / 44 files**, browser smoke, Rust format/clippy and **226 workspace tests** on tmpfs passed. Default embedded release built; real WebKit/GTK find shortcuts/focus/hidden/title/Unicode selection, full/scene/case/whole-word/filters/wrap/no-match, pinyin query commit/cancel, authored Undo/Save, no-op source/journal/editor identity and typical/stress last-heading checks passed. Pure matcher/capture/view/selection work requires no duplicate filesystem run. Supplementary default-release title-form/IME/staged-input/Undo/Save/restore/recovery regression passed on tmpfs after an interrupted exit-143 attempt; evidence labels both. Final documentation/link/syntax/diff checks are linked there.

Final native typical fixture: 150 scenes / 2,703 lines / 46,468 bytes, **95 ms find / 141 ms navigation**, within the 200 ms target. Stress: 1,500 scenes / 27,003 lines / 467,318 bytes, **2,569 / 354 ms**; correct bounded results/source, but stress latency remains open. Measurements are trusted input/click through current count/visible selection plus two rAFs, not compositor paint, p95 or PDF page equivalents. Metadata-highlight/state-identity, callback/oracle/JSDOM, panel/viewport and initial >200 ms navigation failures were corrected and retained honestly in evidence.

## Remaining concerns and next action

**Next: [M4-08 replace one/all](tasks/M4-08.md).** M4-08/09/10/11 are dependency-ready; proceed sequentially. M4-08–15 remain open; M4-15 requires all implementation tasks and a separate safety review. No full M4 or Local v1 claim.

Stress and full long-session/compositor/source-capture performance, broader accessibility/assistive technology, other platforms/filesystems, C1 WebKit/dependency hardening, installed/offline packaging, actual disk-full/hardware power loss, backups/migration and owner adoption remain open. Existing staged title input remains memory-only and must be applied/discarded before leaving. M5 owns renderer/fonts/PDF; M6 history/scheduling/hardening; M7 explicit remote transfer. Completion stays local on main; no push/publication/milestone tag.
