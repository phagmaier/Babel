# AUDIT-D03 — screenplay element styling and layout shell

Status: **both slices done 2026-10-04**; slice A `21a6180` on base `ffede1d`, slice B on base `21a6180`.
[Evidence](../test-evidence/AUDIT.md#audit-d03a--on-screen-screenplay-element-styling).
Dependencies: DESIGN triage accepted D-03 (both slices before pilot); AUDIT-D02
complete. Requirements: new EDIT-07; SPEC S07.1/S08.2, UX-01, EDIT-01/06.

Covers [D-03](../../AUDIT.md#d-03--the-editor-does-not-look-like-a-screenplay-and-nothing-in-the-plan-would-change-that-impact-high-s-for-element-styling-m-for-the-shell).
The frozen audit and [refuted proposals](../../AUDIT.md#dropped-or-refuted) remain read-only.
Two slices, separately committed and evidenced; each stops at its own boundary.

## Slice A (AUDIT-D03A) — element styling, S

- Add EDIT-07 to SPEC S06/S07.1 and the requirements register: the writing
  surface indents screenplay elements in the frozen profile's proportions. It is
  presentation only and makes no wrap, line-count or page-fidelity claim; the
  PDF preview stays the printed-page authority.
- `[data-kind]` rules in `src/app/writing.css` only (plus the `.shell.writing`
  width correction found by the red check: the shell was 680px, not 920px). Writing column
  `max-width: 60ch`, centred; indents are percentages of that column so they
  shrink with it at high zoom or narrow windows (never a fixed 60ch width).
  From `us-letter-draft-v1` (7.2 pt per character, 432 pt frame): cue 22ch;
  dialogue 10ch in, 35ch wide; parenthetical 16ch in, 30ch wide; transition
  right-aligned; centered text centred. Other kinds keep the full column.
- No `text-transform`, generated content, or any rule that shows text the source
  does not contain. No schema, `toDOM`, codec, transaction, selection, capture
  or persistence change. No new font asset (Courier Prime stays helper-only).
- Dual dialogue stays single-column; non-printing kinds get no new treatment.

## Slice B (AUDIT-D03B) — layout shell, M

Status: **done 2026-10-04**; base `21a6180`.
[Evidence](../test-evidence/AUDIT.md#audit-d03b--writing-layout-shell).

- Wide windows: `main` becomes a three-column grid under the existing sticky
  header. Left: sticky navigator (`.writing-sidebar`: Characters and counts,
  Outline) with its own scroll. Centre: heading, actions, element picker,
  recovery/export/preview panels, editor, close and snapshot panels. Right:
  sticky tools drawer (`.writing-drawer`: Spellcheck, Script Check, Find, Title
  page), rendered only while one is open. The window still scrolls the script.
- DOM order is unchanged (actions, tools, navigator, editor, close/snapshots);
  wrappers are plain `div`s so landmarks stay the panels. The keyed editor host
  stays a direct child of `main` in every phase and is never remounted.
- Narrow windows (under 1100px) keep today's single-column stack.
- Focus mode hides the navigator and the same heading/controls as before; the
  column collapses. Save, status and the toolbar exit stay.
- Header stability: status, alerts and Save details share one wrapping row, so
  the frequent "only in memory" alert no longer changes header height on a wide
  window. The header height is published as `--writing-header` beside the
  existing `scroll-padding-top` for the sticky columns.
- No change to typewriter centring, recent-position, scroll-to-selection,
  capture, commands, keys or persistence logic.

Checks: red mounted tests first (regions, DOM order, drawer lifecycle, editor
node identity, header variable set/cleared). Chromium shell geometry check in
`pnpm test:browser` on production CSS (three columns, sticky columns under the
header while the window scrolls, alert toggle does not move the script, focus
mode, narrow stack, no horizontal overflow). Tier 2 shared gates; Rust on one
filesystem (no native change). Native WebKit on tmpfs/Btrfs with the unchanged
D03A binary as control for presentation: presentation, outline, scene-moves,
find, replace, script-check, spellcheck, title-page, characters, commands,
editor-exit. Update a drill expectation only where the accepted layout changes
it, and record it. Does not depend on D-05 and must not pre-empt M6-02-R1.

## Do NOT do

Change editor schema/commands/keys, capture/version/receipt policy, native code,
IPC, fixtures or dependency pins. No pagination markers, page-count or wrap
claims. Do not weaken existing native geometry, IME, caret, byte or Undo
assertions; update an expectation only where the accepted layout changes it and
record it. No SELinux, C1/F2, M6-02 or Local v1 closure; no push.

## Checks and stopping (slice A)

Red first: real-layout browser check (`pnpm test:browser`, Chromium, production
`writing.css` and schema `toDOM`) for per-kind offsets/widths at 100% and 200%
zoom and a narrow window, proportional shrink, no horizontal overflow and
`text-transform: none`. Then full `pnpm check`, browser smoke, Rust
fmt/clippy/workspace tests (one filesystem). Tier 2: CSS and docs only; no
filesystem-matrix path, IPC or native adapter changes, so no second-filesystem
Rust run. Native WebKit: default embedded release build, then the presentation
drill (2× zoom, real IME, completion geometry) and one editor/completion mode
with owned shutdown attribution. Label browser vs native; keep failed attempts;
retained crash findings are not disposed by clean runs.

Update `docs/ux.md`, SPEC/requirements for EDIT-07, TODO and current-state; link
evidence in `docs/test-evidence/AUDIT.md`. Commit locally on main and stop
before slice B.
