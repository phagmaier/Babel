# Current state — M4-10 complete

Date: 2026-09-30 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md).

## Task and work

**M4-10 complete — bounded Linux functional presentation gate.** One editing agent on main from clean `1aa223d`; M4-02/03 and completed M3 input dependencies satisfied. No push authorized.

Delivered strict versioned UI-only [preferences](../src/application/viewPreferences.ts), shared Home/writing System/Light/Dark themes, 75–200% writing zoom, focus and [deferred typewriter follow](../src/editor/presentation.ts). Presentation preserves the same EditorState, exact authored source, version, selection and Undo. Sticky protection/preference failures stay visible; measured header clearance protects control/caret navigation. Completion observes editor resize and owns first Escape; a subsequent Escape exits focus through the production view. Unchanged outlines reuse rendering with current projection/busy callbacks. No native service/capability, dependency, fixture, export pipeline or content persistence change.

Changed paths: application preferences; presentation controls/App/WritingView/Outline/CompletionPopup; scoped/global styles; editor view/presentation; Focus Mode registry availability; preference/writing/shortcut tests; native `presentation_workflows.py` + drill/README; ADR 0022/UX/editor/development/task/TODO/affected requirements/evidence.

## Verification

[M4-10 evidence](test-evidence/M4.md#m4-10--presentation-modes) owns exact commands, failures/corrections, fixture hashes/host/screenshots/raw timing and limits. Focused **77 tests**, shared format/lint/typecheck/build and **643 frontend tests / 48 files**, browser smoke, Rust fmt/clippy and **226 host Rust tests** passed. Sandbox ACL setup failed `EINVAL`; the unchanged host suite passed. Pure UI behavior needs no second filesystem run.

Final default embedded release passed real WebKit/GTK at **device scale 2**, typical/stress **150/1,500 scenes**: theme/75–200% zoom/focus/typewriter, selection/no remount, manual-scroll pause, exact Find/outline navigation, completion alignment/Escape ownership, real pinyin commit/cancel, one-step Undo, visible source failure/F6 Save, native Save As retaining both versions, safe close/Home/restart. Final artifacts `/tmp/babel-writing-0vfplkbf`; no mocks/native invoke/editor-state hooks in that drill. Native findings fixed header-scroll occlusion and Escape routing; outline reuse removes redundant presentation rendering. Screenshots inspected; final syntax/local-link/format/diff checks linked in evidence.

## Remaining concerns and next action

**Next: [M4-11 offline spellcheck proof](tasks/M4-11.md), dependency-ready.** M4-12 waits for successful proof; M4-11–15 remain open. M4-15 requires all implementation tasks plus a separate safety review. No full M4/Local v1 claim or milestone tag.

Performance remains bounded: theme/zoom handler max **4/20 ms** typical/stress, zoom-to-two-rAF max **95/987 ms**, mixed input-to-rAF max **42/634 ms**, keydown/Undo max **18/121 ms**. Small DOM/rAF observations do not certify transaction/plugin/compositor or full S13 budgets. Stress layout/Undo/long-session performance remains open.

Other carried concerns: broader accessibility/assistive technology, other platforms/scales/filesystems, C1 WebKit/dependency hardening, installed/offline preferences/packaging, real disk-full/hardware power loss, backups/migration and owner adoption. M5 owns SC005/SC008 verification and PDF; M6 history/hardening; M7 explicit remote transfer. Nothing pushed/published.
