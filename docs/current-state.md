# Current state — M4-14 complete (bounded Linux)

Date: 2026-09-30 PDT. Application: **babel**.

## Completed task

**M4-14 palette/menus/accessibility** completed by one editing agent on main from
clean `271e2ea`. No push. One 44-entry catalog and current availability/dispatch
connect Home, writing controls/help, keyboard palette and actual native menus to
existing editor/lifecycle services. Future M5/M6/M7 actions remain unavailable.
Read-only, busy/protection, staged input and form/IME guards remain authoritative.

Palette provides enabled actions/current scene-section navigation, explicit
100-result cap/refinement, labelled combobox/listbox/modal, inert background,
Enter/Up/Down/Escape/F6/Tab and predictable focus return. Stale projections and
queued actions after route disposal cannot operate. Native known-ID publication
is strict, serialized and token-qualified; listener/update failure is visible.
Remap hints follow local preferences; WebView routing owns accelerators exclusively
so toolkit keys cannot bypass form/IME ownership or dispatch twice. See
[ADR 0022](decisions/0022-local-shortcut-preferences.md#m4-14-palette-and-native-menus).

The sole editor exposes multiline/read-only semantics. Read-only navigation seeds
DOM selection ownership from its accepted editor position before focus/scroll,
without changing source/Undo. Refreshed spelling-language controls restore focus
only once enabled. Corrupt shortcut preferences remain visible on Home.

## Paths and acceptance

- Catalog/routing: `src/application/commandCatalog.json`, `commandDispatch.ts`, `shortcuts.ts`.
- Palette/surface: `src/app/CommandPalette.tsx`, `CommandSurface.tsx`, CSS; App/Home/WritingView/EditorControls integration.
- Native boundary: `src-tauri/src/command_menu.rs`, host registration, `src/infrastructure/nativeCommands.ts`; no new broad capability/filesystem engine.
- Focus/semantics: `src/editor/view.ts`, `outlineNavigation.ts`, `src/app/SpellcheckPanel.tsx`.
- Contract/UI tests and `tests/native/writing-lifecycle/command_workflows.py`, `command_accessibility.py`, drill `--commands`; owned keyboard helper's single-lifetime menu traversal.

[Exact checks, failures, commands and scope](test-evidence/M4.md#m4-14--palette-menus-and-accessibility):
focused **105/10 files**; `pnpm check` **688/56 files**, format/lint/typecheck/build;
browser smoke; Rust fmt/clippy; workspace **237 each on tmpfs/Btrfs**; default
release/**99.45 MiB AppImage**; final actual native drills passed both filesystems.
Real menu keyboard/remap/picker cancellation, trusted typing/one Undo/GTK simple
IME, palette/panel/form keys, interruption/protection, readonly source navigation,
light/dark/200% writing zoom and synthetic150% whole-view layout preserved exact
192-byte BOM/CRLF/Unicode source. AT-SPI exposes owned native-menu/palette names
and numeric roles; screenshots inspected. No screenreader speech claim.

## Limits and next action

No M4-14 blocker. Installed-package/profile retention, other platforms,
screenreaders/IME, full S13 and long-session performance remain open. Native
menu hints plus WebView accelerators are a documented ownership policy. No new
forced-crash/OS-teardown certification. Existing manuscript durability and
confirmed-save/crash gates remain required; previous failed attempts stay recorded.

Next: **M4-15 integrated exit and separate safety review**; bounded dependencies
M4-01–14 satisfied. Read [its brief](tasks/M4-15.md) and claim the integration
work separately. Retain the inherited crash/confirmed-save review and inspect
the shared picker second-confirmation race in other automation modes. M4-15/full
M4/Local v1 acceptance remains open. Continue on main; no push.
