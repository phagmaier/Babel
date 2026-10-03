# DEV-03 — WritingView decomposition

Status: in progress (slice 1 landed).
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

Checks: focused new tests (5/5) and `WritingView.test.tsx` (28/28, incl.
focus regressions), full `pnpm test` 772/772, `lint`, `typecheck`, `build`
(pre-existing large-chunk warning retained), `cargo fmt`, workspace
`clippy`/`test` (Rust untouched, all green), `prettier`, `git diff --check`.
Browser smoke skipped with rationale: no rendered output changed, DOM
covered by the JSDOM suite.

Evidence: [M5](../test-evidence/M5.md#dev-03--writingview-decomposition-slice-1).

## Later slices (proposed, not started)

- Feature-hook sections (find/replace/check/spelling/palette) as custom
  hooks with the component keeping composition only. Each needs the same
  pure-move proof; hook-order sensitivity makes these riskier than slice 1.
- Panel JSX wiring last — entangled with the most closures; prop-drilling
  surface must be designed, not improvised.

## Excludes

No rendered-output, handler, timing or focus-behavior change. No push.
