# Current state — M4-03 complete

Date: 2026-09-30 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [index](index.md).

## Task and work

**M4-03 complete — bounded Linux manuscript projection/outline gate.** One editing agent on main from `9947322`, initially clean; no prior dirty paths or push authorized. M4-01/02 and the corrected bounded M3 gate remain complete.

Delivered immutable session/version/document/hash-bound hierarchy, scene boundaries at any section, nested section subtrees, separate ordinal/authored numbers, synopsis and explicit note/blank ambiguity. Complete logical body/title/note/omitted/raw locations retain exact Unicode/newline/source runs and intact title/hidden/raw/dual ranges. Bounds fail the whole projection; display limits/excerpts/remainders are disclosed and filtering reaches later headings. Pending/uncapturable results stay visibly stale and inert.

Outline supports collapse/filter and trusted keyboard/pointer navigation. Accepted scalar-safe selection is focused before a scroll-only transaction, preserving source/Undo and actually revealing the caret. Ready read-only selection is allowed; mutation/frozen/composition guards remain. One previous branded capture per boundary reuses only identical immutable content; current anchors/version/hash are derived anew. Selection-only capture yields the visible navigation turn with a bounded hidden-window fallback. No second authority or native endpoint.

Changed code: `manuscriptIndex.ts`, `manuscriptProjection.ts`, `Outline.tsx`/CSS and `outlineNavigation.ts`; WritingView, EditorView, sourceBridge and editorCapture integration. Independent contract/UI/performance tests, `--outline` native mode and an explicit-generation correction to the inherited editor regression harness. [ADR 0029](decisions/0029-versioned-manuscript-index.md), ADR 0021 extension and owning model/editor/architecture/UX/development/testing/task/trace/index/evidence updated. SPEC, dependencies/locks, fixtures, native services/permissions are unchanged.

## Verification

[M4-03 evidence](test-evidence/M4.md#m4-03--versioned-manuscript-index-and-outline-navigation) owns exact commands/host/logs/artifacts/failures/limits. Focused source/index/controller/UI checks passed 95 tests; frontend shared checks passed 539 tests/38 files; Chromium smoke, Rust formatting/lint and 223 native workspace tests passed on tmpfs. Default embedded release passed real WebKit/GTK outline, viewport/Tab/Enter/pointer, Undo, uncapturable retention, pinyin commit/cancel, app scaling and last-scene stress checks. The full inherited native editor/corpus/input/IME/lifecycle/fault regression also passed. Pure projection/selection/capture changes need no duplicate filesystem run.

Isolated index medians were about 15/89 ms; final typical/stress navigation to two animation frames was 32/155 ms, with caret visibility checked. These are fixed synthetic host proxies, not compositor paint or PDF page calibration. Native review caught the outside-editor scroll ordering and a stress frame miss; focus-first scrolling plus bounded immutable reuse/render scheduling correct the declared gate. Earlier under-load recovery-comparison test timeouts passed unchanged when rerun idle. No assertion, timeout, permission or queue bound was weakened.

## Remaining concerns and next action

**Next: [M4-04 version-bound protection before destructive workflows](tasks/M4-04.md).** Deliver the narrow recovery/safety-revision receipt and exact live-version guard before M4-05 moves. M4-06/11 are also ready; proceed sequentially. M4-04–15 remain open; M4-15 requires all tasks and separate safety review. No full M4 or Local v1 claim.

Large-source opening and later main-thread capture/persistence work remain performance concerns despite the bounded visible-navigation pass. Full compositor/page calibration, long-session heap/DOM/catalog scaling, actual disk-full/power loss, other platforms/filesystems, installed/offline packages, backup/migration and owner pilot remain M6. Existing RustSec GLib concerns and C1 recurring WebKit child heap abort remain tracked; successful driver observations do not close them. M5 owns production PDF/renderer/fonts; history UX and remote transfer are later. Completion uses a local main commit; no push, publication or milestone tag.
