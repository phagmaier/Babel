# DEV-03 — WritingView decomposition

Status: complete (slices 1–9 landed; bounded Linux verification).
Dependencies: M5-07 (focus-race correction must keep passing). No behavior,
IPC, persistence, PDF, history or remote change — pure code moves only.

`src/app/WritingView.tsx` (2,483 lines) is the one god component: one giant
function holding ~60 hooks plus all panel wiring. Decompose it slice by
slice, each slice a pure move verified by the existing suite (including the
M5-07 preview-focus regressions) plus new contract tests for extracted
behavior. A slice that changes any rendered output or handler behavior is
rejected — split the diff, don't sneak features.

## Slice 1 (landed)

Pure helpers `toSessionSelection`, `writingFailureMessage`,
`clampedSelection` → `src/app/writingHelpers.ts`, with new
`tests/contract/writing-helpers.test.ts` (8 failure-code paths incl.
nested-code precedence, Error passthrough, unknown/missing fallback, live
selection mapping). `WritingView.tsx` 2,483 → 2,438, removal + import only.
Slice-1 evidence: [M5](../test-evidence/M5.md#dev-03--writingview-decomposition-slice-1).

Checks: focused new tests (5/5) and `WritingView.test.tsx` (28/28, incl.
focus regressions), full `pnpm test` 772/772, `lint`, `typecheck`, `build`
(pre-existing large-chunk warning retained), `cargo fmt`, workspace
`clippy`/`test` (Rust untouched, all green), `prettier`, `git diff --check`.
Browser smoke skipped with rationale: no rendered output changed, DOM
covered by the JSDOM suite.

## Slice 2 (landed)

Find/replace session → `src/app/findSession.ts` (`useFindSession`): the
controller/scroll/advance refs, panel state, the two `findState` scroll
effects and all seven session callbacks (`openFind`, `navigateSearch`,
`closeFind`, `replacePlanCurrent`, `dispatchReplacement`, `replaceOne`,
`replaceAll`), moved verbatim. The component keeps controller
creation/disposal, teardown nulls and all other reads through the hook's
returned handles (same identities). `closeCheck` moved above the hook call
(definition reorder only; it runs solely on user action). Net component
effect: session block gone, one hook call + import in its place.

Checks: `tsc` clean (proves the dependency boundary is exact — a missed
handle is a compile error), focused suites 64/64 (helpers, find/replace
contracts, FindPanel, WritingView incl. focus regressions), full `pnpm
test` 772/772, `lint`, `typecheck`, `build`, `cargo` fmt/clippy/workspace
(Rust untouched), `prettier`, `git diff --check`. Native `--find` drill on
a fresh release: CSP/shortcuts/hidden/wrap/filters/focus/no-writes and
Undo/counts/Save PASS in real WebKit/GTK; pinyin section BLOCKED —
`fcitx5-remote` is not installed on this host (next safe step: Fcitx5 per
DEV-01 IME notes, or run on the laptop). Runner note: agent shells lack
`WAYLAND_DISPLAY`/`HYPRLAND_INSTANCE_SIGNATURE`; export `wayland-1` and
the signature from `/run/user/1000/hypr/` or session creation times out.

Evidence: [M5](../test-evidence/M5.md#dev-03--writingview-decomposition-slice-2).

## Slice 3 (landed)

Script-check session → `src/app/checkSession.ts` (`useCheckSession`):
the scroll ref, controller ref, panel state, the issue-scroll effect and
both session callbacks (`openCheck`, `navigateIssue`), moved verbatim.
The component keeps controller creation/disposal, teardown nulls, panel
visibility (`showCheck`/`closeCheck`) and all other reads through the
hook's returned handles (same identities). `closeCheck` stays composed
because the find session consumes it — moving it would reopen slice 2's
landed hook — and `showCheck` pairs with it, so all its read sites are
untouched and `findSession.ts` is unchanged. Net component effect:
session block gone, one hook call + import in its place (`WritingView.tsx`
2,226 → 2,158 lines).

Checks: `tsc` clean (proves the dependency boundary is exact), focused
suites 57/57 (helpers, script-check/export-assessment contracts,
ScriptCheckPanel, WritingView incl. focus regressions), full `pnpm test`
772/772, `lint`, `typecheck`, `build`, `cargo` fmt/clippy/workspace
(Rust untouched), `prettier`, `git diff --check`. Native
`--script-check` drill on a fresh release: CSP, panel/filter/dismiss/
navigation/refresh/Escape/Save-with-warning PASS in real WebKit/GTK with
exact source bytes; no blocked sections.

Evidence: [M5](../test-evidence/M5.md#dev-03--writingview-decomposition-slice-3).

## Slice 4 (landed)

Spellcheck session → `src/app/spellingSession.ts`
(`useSpellingSession`): the controller ref, panel visibility and the
open/close pair, moved from the inline dispatch/panel sites (bodies
byte-identical). The component keeps controller creation (panel
`onController`), lifecycle invalidation, the `blocked`/`readOnly`
composition closures and all reads through the hook's returned handles
(same identities). The palette section stays out: its navigation
callback depends on the component's `commandContext` closure and the
`CommandSurface` prop surface, so it moves with the designed panel-JSX
phase rather than as an improvised hook. Net component effect: session
block gone, one hook call + import in its place (`WritingView.tsx`
2,158 → 2,157 lines).

Checks: `tsc` clean (proves the dependency boundary is exact), focused
suites 41/41 (spellcheck contract, SpellcheckPanel, WritingView incl.
focus regressions), full `pnpm test` 772/772, `lint`, `typecheck`,
`build`, `cargo` fmt/clippy/workspace (Rust untouched), `prettier`,
`git diff --check`. Native `--spellcheck` drill on a fresh release:
language/suggestions/keyboard correction/marks/Undo/names/Ignore/Add,
GTK simple IME commit/cancel, restart and dictionary-fault isolation
PASS in real WebKit/GTK with exact source bytes; no blocked sections.
First drill attempt failed honestly on the reboot-lost `/tmp` pointer
helper; rebuilt per the drill README (plus the pinned `/tmp/wtype`)
and reran green.

Evidence: [M5](../test-evidence/M5.md#dev-03--writingview-decomposition-slice-4).

## Slice 5 (landed)

Title-page session → `src/app/titleSession.ts` (`useTitleSession`):
panel visibility, the toolbar button/return-focus refs, the
return-focus effect and the open/close pair, moved from the inline
dispatch/panel sites and one component effect (bodies byte-identical).
The draft/composing/applying refs stay component-owned per the panel
design: the panel mutates them and the find/check/spelling hooks read
them. All other reads go through the hook's returned handles (same
identities). Net component effect: session block gone, one hook call +
import in its place (`WritingView.tsx` 2,157 → 2,148 lines).

Checks: `tsc` clean (proves the dependency boundary is exact), focused
suites 49/49 (title-page contract, TitlePagePanel, WritingView incl.
focus regressions), full `pnpm test` 772/772, `lint`, `typecheck`,
`build`, `cargo` fmt/clippy/workspace (Rust untouched), `prettier`,
`git diff --check`. Native `--title-page` drill on a fresh release:
CSP plus all 28 pre-IME actions (open/edit/add/remove/reorder,
invalid-input refusal, Undo/Save with exact bytes, panel close with
return focus, reopen) completed in real WebKit/GTK with no assertion
failure; the mode PASS line sits past the pinyin IME section, which is
BLOCKED — `fcitx5-remote` is not installed on this host (next safe
step: Fcitx5 per DEV-01 IME notes, or run on the laptop).

Evidence: [M5](../test-evidence/M5.md#dev-03--writingview-decomposition-slice-5).

## Slice 6 (landed)

Move session → `src/app/moveSession.ts` (`useMoveSession`): the
prepared-move state, abort ref, memoized `previewMove`, async
`applyMove` and the cancel callback, moved verbatim (cancel named from
the inline panel callback; bodies byte-identical). The component keeps
teardown aborts, `onOutlineNavigate` (slice 7 owns outline navigation)
and all reads through the hook's returned handles (same identities).
The hook call sits after `refresh` and before the session lifecycle
effect because `applyMove` closes over `refresh` — same
runs-only-on-action reasoning as slice 2's `closeCheck` reorder, and
the call order is unconditional so it stays stable. Net component
effect: session block gone, one hook call + import in its place
(`WritingView.tsx` 2,148 → 2,055 lines).

Checks: `tsc` clean (proves the dependency boundary is exact), focused
suites 49/49 (scene-moves contract, Outline, WritingView incl. focus
regressions), full `pnpm test` 772/772, `lint`, `typecheck`, `build`,
`cargo` fmt/clippy/workspace (Rust untouched), `prettier`, `git diff
--check`. Native `--scene-moves` drill on a fresh release:
scene/section moves, trusted keyboard+drag, backward selection, exact
Save+Undo+reopen, protected large move+failure and EOF review copies
PASS in real WebKit/GTK; no blocked sections.

Evidence: [M5](../test-evidence/M5.md#dev-03--writingview-decomposition-slice-6).

## Slice 7 (landed)

Outline/character/position session → `src/app/outlineSession.ts`
(`useOutlineSession`): projection and character state, the
recent-position store and its refs, the highlight/restore effects and
both navigation callbacks (outline navigate moved from its memoized
slot, character navigate named from the inline panel callback; bodies
byte-identical). The component keeps the mount-once lifecycle's
position machinery and all reads go through the hook's returned
handles (same identities) — verified safe because the lifecycle never
reads hook-owned values, only stable handles. Net component effect:
session block gone, one hook call + import in its place
(`WritingView.tsx` 2,055 → 1,977 lines).

Checks: `tsc` clean (proves the dependency boundary is exact),
focused suites 65/65 (manuscript-index/projection, character-counts,
recent-position contracts, Outline, CharacterPanel, WritingView incl.
focus regressions), full `pnpm test` 772/772, `lint`, `typecheck`,
`build`, `cargo` fmt/clippy/workspace (Rust untouched), `prettier`,
`git diff --check`. Native drills on a fresh release: `--outline`
completed all pre-IME workflows in real WebKit/GTK (collapse/expand,
pointer and keyboard navigation with sub-200 ms timing asserts,
filter, trusted-key clear, edit invalidation, Undo rebuild, exact
Save) with no assertion failure; abort exactly at
`outline_workflows.py:112`, pinyin IME section BLOCKED
(`fcitx5-remote` not installed — same landmine as slice 5).
`--characters` fully PASS with no blocked sections: character
controls/navigation/focus/highlights plus the moved position
machinery (restart hints, Save As caret, corrupt hints, checkpoint
precedence) with exact bytes.

Evidence: [M5](../test-evidence/M5.md#dev-03--writingview-decomposition-slice-7).

## Slice 8 (landed)

Palette navigation → `src/app/paletteSession.ts` (`usePaletteSession`):
the callback moves verbatim except `commandContext()` becomes the typed
`getFacts()` dependency. Render values (`outline`), editor ref and
error setter pass from the component; captured projection, labels and
activation guards retain their semantics. No React primitives,
memoization or effects added; the call appends unconditionally after
the existing hooks and before all phase returns. Dispatch switch and
`CommandSurface` props stay composed. `WritingView.tsx` 1,977 → 1,956 lines.

Checks: focused 42/42 (command dispatch, CommandPalette, WritingView
including stale navigation/source/Undo and M5-07 focus regressions),
full 772/772, lint/typecheck/build, Rust fmt/clippy/workspace tests,
formatting/local links/diff all pass. Fresh-release native `--commands`
passes completely on tmpfs, including GTK simple IME; no blocked sections.
Native menu/light/dark-scaled screenshots reviewed. Browser smoke and
second-filesystem run skipped with the pure-move rationale in evidence.

Evidence: [M5](../test-evidence/M5.md#dev-03--writingview-decomposition-slice-8).

## Slice 9 (landed; DEV-03 complete)

Preview/export session → `src/app/publicationSession.ts`
(`usePublicationSession`): preview/export refs and state, toolbar button
and pending-focus ref, focus body and open/close/dismiss callbacks move
verbatim. Its only render dependency is `outline`. Controller construction,
accept/invalidate/dispose, capture/dispatch, protection and JSX stay composed;
lifecycle reads the same stable returned refs/setters. The hook appends
unconditionally after palette and before hosts/phase returns.

The no-deps focus-effect registration stays at its original position and
calls `restorePreviewFocus` synchronously. This keeps effect order exact
while the body reads the hook-owned state/refs; neither the M5-07 wait for
the enabled toolbar nor newer-focus refusal changes. No memoization,
new timing, prop shape or rendered output. `WritingView.tsx` 1,956 → 1,939 lines
(2,483 → 1,939 across DEV-03); session hooks plus permanent composition core.

Checks: strict TypeScript, focused 82/82 (publication/freshness/export
contracts, preview/export panels, WritingView including both M5-07
focus regressions), full 772/772, lint/typecheck/build, Rust
fmt/clippy/workspace tests and formatting/local links/diff all pass.
Fresh-release native `--publication-preview` and `--pdf-export` pass on
tmpfs, including the held-real-Save-receipt focus race and delayed-real-reply
freshness. Both ordinary closes complete before stale-session deletion;
no blocked sections. Helper tree remains `c805d6…`. No behavior change;
no new tests needed for these verbatim bodies, which have existing
failure/focus/source-isolation regressions.

Evidence: [M5](../test-evidence/M5.md#dev-03--writingview-decomposition-slice-9).

## Panel phase — approved design (completed; recorded after slice 4)

Slices 1–4 proved the pattern: session hooks own state machines plus
their effects; the component keeps controller creation/disposal,
cross-panel coordination and render. At design time, `WritingView.tsx`
(2,157 lines) contained extractable sessions plus a permanent
composition core. Panel JSX itself does not move: every panel's props
mix hook handles with composition flags (`busy`, `showClose`,
`operationRef`, `active`), so relocating JSX without its prop surface
is the improvised step this design exists to prevent.

Shared-ref rule (from slice 3): refs consumed by two or more hooks
(`viewRef`, `popupRef`, `operationRef`, `frozenRef`, `readyRef`,
title draft/composing, `showClose`) stay component-owned and pass down
as hook deps. No hook-to-hook imports — that cycle is what forced
`closeCheck` to stay composed.

Approved extraction order, now completed, one slice each with the same proof as
slices 1–4 (`tsc`-exact boundary, focused plus full suite with the
M5-07 focus regressions green, named native drill):

- Slice 5, title session: `showTitle`, button/return-focus refs, the
  `[showTitle]` return-focus effect, dispatch open, panel open/close.
  The draft/composing/applying refs stay component-owned: panel
  `onDraft`/`onApply` mutate them and the find/check/spelling hooks
  read them. Drill: `--title-page`.
- Slice 6, move session: `move`/`moveMessage`/`moveBusy`/abort ref,
  `previewMove`, async `applyMove`, `MovePreview` wiring. Drill:
  `--scene-moves`.
- Slice 7, outline/character/position session: `outline`,
  `character`/`characterHighlight`, `positions` plus the
  remember/closing/hint/restore refs and their effects,
  `onOutlineNavigate`. Boundary with the lifecycle's
  schedule/dispose-position calls is set at implementation time.
  Drill: `--outline` (plus `--characters` if selection moves).
- Slice 8, palette navigation: `paletteNavigation` with `outline`,
  `viewRef`, a `getFacts` closure dep and `setError`; dispatch switch
  and `CommandSurface` props stay composed. Drill: `--commands`.
- Slice 9, preview/export session, explicitly last: the M5-07
  preview-close focus race lives here, so its regressions gate the
  move. Drill: `--publication-preview` (plus `--pdf-export` if export
  state moves).

Permanent composition core (never moves): the session lifecycle
effect and teardown (one session per mounted view), protection
wiring (`run`, `requestClose`, `reportOutcome`, snapshot/choice
ports, close/recovery/snapshot panels), the Escape handler, the
Fountain import boundary, the three phase branches, toolbar and
`presentationBlocked`/`modeDisabled`/`checkpoint` memos. New hook
calls append after the existing session hooks, never conditionally. Slice 9
keeps the original focus-effect registration in composition to preserve
effect order, with its body owned by the publication session hook.

## Excludes

No rendered-output, handler, timing or focus-behavior change. No push.
