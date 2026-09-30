# Current state — M4-06 complete

Date: 2026-09-30 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md).

## Task and work

**M4-06 complete — bounded Linux source-preserving title-page form.** One editing agent on main from `7bfce54`, initially clean; the handoff's concurrent documentation edits had already been committed as `7bfce54 docs`. Dependencies M4-00 and completed M3 source/Undo/lifecycle gates satisfied. No push authorized.

Delivered ordered title-field inspection and explicit Edit/Add/Remove/Move up/down, retaining duplicates/unknown keys, key prefixes, multiline indentation, emphasis, BOM/mixed endings/EOF and body bytes. Unrepresentable continuations, EOF joins and neighboring meaning changes visibly refuse. Actions use checked source provenance and isolated EditorState transactions; Undo/Redo retain exact spelling/marks/identities/selection while versions and row counters advance. Changed-title offsets clamp at Unicode scalar boundaries. Opening/closing is a byte no-op.

One temporary field draft is clearly uncommitted and not saved/recovery-protected. Synchronous draft/composition guards block Save/Save As/export, Home/Open/session/window close, import and native restore/recovery adoption until Apply/Discard. Stale/read-only/composing/busy submissions retain input. Editor mutations stay disabled during dirty input; application shortcuts leave form typing/IME local. Keyboard focus/clean Escape/return focus and post-composition Enter behavior passed native checks. No second committed title store, native service, dependency, format, capability or packaging change.

Changed paths: `src/domain/titlePage.ts`; editor state/title command/view integration; `src/app/TitlePagePanel.tsx`, WritingView/CSS; independent contract/UI tests; native `title_page.py`/drill/README; owning source/editor/UX/development docs, task/TODO/trace/evidence. Existing native Rust engines, SPEC, ADRs, fixtures and dependency locks remain unchanged.

## Verification

[M4-06 evidence](test-evidence/M4.md#m4-06--source-preserving-title-page-form) owns exact commands/results, failed attempts and native artifact roots. Focused tests passed 99; shared formatting/lint/typecheck/build and 592 frontend tests/42 files passed; browser smoke, Rust format/lint and 226 workspace tests on each tmpfs/Btrfs passed. Default embedded release built; full real WebKit/GTK title/IME/Undo/Save/named restore/reopen/divergence/recovery/Save As/read-only inspection drills passed on both filesystems. Independent literal source/hash and journal-byte audits retained. Early typed-array/label/focus/oracle/harness failures and the corrected real IME Enter guard are recorded honestly. Final docs/link/syntax/diff checks are linked there.

## Remaining concerns and next action

**Next: [M4-07 find and hidden navigation](tasks/M4-07.md).** M4-07/11 are ready; proceed sequentially. M4-07–15 remain open; M4-15 requires all implementation tasks and separate safety review. No full M4 or Local v1 claim.

Unapplied form input remains memory-only and must be applied/discarded before leaving; arbitrary process/hardware failure recovery of staged form input is not claimed. Invalid UTF-8 native form coverage is inspection-only, with exact original bytes and disabled actions; it is not native successful saving/close of an uncapturable draft. Large-source/capture/persistence stalls, compositor/page/long-session performance, C1 WebKit/dependency hardening, assistive technology/other platforms/filesystems, actual disk-full/hardware power loss, installed/offline packaging, backup/migration and owner adoption remain open. M5 owns title renderer/fonts/PDF; M6 history/scheduling; M7 remote transfer. Commit completion stays local on main; no push/publication/milestone tag.
