# Current state — M4-13 complete

Date: 2026-09-30 PDT. Application: **babel**.

## Completed task

**M4-13 characters/counts/recent position** completed by one editing agent on
main from clean `db48bb0`. No push. Counts reuse the complete versioned index,
state inclusion rules and separate body/title/note/omission/raw/outline totals.
Exact cue spelling identifies characters; optional dialogue/parenthetical
highlights and wrapping cue navigation leave authored content/Undo untouched.
Current/stale/unavailable facts and visible rendering caps remain explicit.

UI-only recent hints store bounded durable UUID/hash/row/scalar caret anchors and
an independent manual viewport. Ordinary matching Open/Recent can restore them;
Locate/external changes/Save As/replacement use safe owned/default selection and
exact checkpoint selection wins. Corrupt/unknown/oversize hints are retained;
auxiliary failures cannot block Save/close or earn protection credit. Native
schemas/publication are unchanged; [ADR 0022](decisions/0022-local-shortcut-preferences.md#m4-13-recent-position-hints)
owns this best-effort boundary. Opening/fresh-view thaw synchronizes the WebKit
DOM caret; two bounded layout probes account for the toolbar becoming sticky.

## Paths and acceptance

- Facts/projection: `src/domain/characterCounts.ts`, `src/application/manuscriptProjection.ts`.
- UI/decorations: `src/app/CharacterPanel.tsx`, `src/editor/characterFocus.ts`, `WritingView.tsx`, editor state and writing styles.
- Hints: `src/application/recentPosition.ts`, `src/editor/recentPosition.ts`, `writingSession.ts` exposes existing persistent identity.
- Contract/UI tests plus `tests/native/writing-lifecycle/character_workflows.py`; mode-specific picker confirmation avoids real Return input after dialog teardown.

[Exact checks, failures and scope](test-evidence/M4.md#m4-13--characters-counts-and-recent-position):
focused five-file suite passed **42**; `pnpm check` passed **674 tests/54 files**,
format/lint/typecheck/build; browser smoke passed. Rust fmt/clippy passed;
workspace **234** passed on tmpfs and Btrfs. Default release/AppImage (**99.41 MiB**)
completed before final native drills. Real controls/typing/one Undo/GTK simple IME,
manual caret/scroll restart at dark/150%/typewriter, Save As identity isolation,
changed-source fallback, corrupt hints with native Save/close, and retained
checkpoint selection precedence passed both filesystems. App screenshots inspected.

## Limits and next action

No M4-13 blocker. Best-effort WebView hints are distinct from content durability.
Installed-profile retention, other platforms/screenreaders/IME, full S13 and
long-session performance remain open. Protected close/fresh-process restart is
verified; forced-crash/OS-teardown is not. M4-15 must retain inherited confirmed-save
review/crash gates and inspect the shared picker's second-confirmation race in
other automation modes. Failed native attempts/artifacts remain in evidence.

Next: **M4-14 palette/menus/accessibility**; dependencies M4-02/05/06/08/09/10/12/13
satisfied. Read [its brief](tasks/M4-14.md), claim one bounded task and preserve
shared editor/lifecycle ownership. M4-14/15 remain open; no full M4/Local v1 claim.
Continue on main; no push.
