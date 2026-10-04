# AUDIT-D03 — screenplay element styling and layout shell

Status: **slice A done 2026-10-04**; base `ffede1d`. Slice B not started.
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

## Slice B (AUDIT-D03B) — layout shell, M (next task; not started)

Sticky outline sidebar and one side drawer for Find/Script Check/Spelling/Title,
keeping window scroll. Before editing, re-read the audit's listed touch points:
focus-mode selectors (`writing.css`), window-scroll assumptions
(`src/editor/presentation.ts`, `recentPosition.ts`, `WritingView.tsx`) and drills
reading scroll geometry (`presentation_workflows.py`). Needs its own red mounted
tests, focus/F6/Escape order checks and affected native modes on tmpfs/Btrfs.
Does not depend on D-05 and must not pre-empt M6-02-R1.

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
