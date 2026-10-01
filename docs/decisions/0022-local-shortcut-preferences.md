# ADR 0022 — Shared shortcut registry and local UI preferences

Status: Accepted direction. Date: 2026-09-29.
Authority: [SPEC S07.4/S14.3](../../SPEC.md#s07), EDIT-03, INV-12.

## Context and decision

[Registry](../../src/application/shortcuts.ts) owns element/workflow command names, provisional bindings, availability and displayed help labels. Editor routing and the semantic command list use that registry. No separate native menu accelerators are installed by M3-06. M3-12 must wire the registry to production activation and any native menus rather than maintaining another binding table.

Persist only remapping overrides in version-1 JSON at the WebView localStorage key `babel.shortcuts.v1`. This is local UI configuration, outside the manuscript, recovery and curated-history stores. It contains command IDs and bindings only; no source, document identity, paths or credentials. A successful storage write is required before new bindings become active. Read/parse/collision failures show a fixed notice and use defaults; write failures leave existing bindings active. No durability claim about author content follows from a UI preference write.

Use logical `KeyboardEvent.key`, platform-specific Mod, and optional Shift with ASCII letters/digits. Alt/AltGraph, physical scan codes, dead/composing keys, F6 and conservative native/OS chords are excluded. Bindings may be unassigned. This avoids making a physical numeric key mandatory on layouts with another character there. Known hide/minimize, screenshot, Unicode-entry, quit/close and reload chords remain unassigned. Native conflict evidence and limits live in [M3-06 evidence](../test-evidence/M3.md#m3-06--element-picker-and-configurable-shortcut-registry).

Contextual Tab is enabled only with a focus-escape callback. F6 leaves the editor for Element; outside-editor Tab remains native focus traversal. A completion hook precedes explicit commands and smart behavior; M3-07 supplies the real local completion implementation. Selection conversion remains a single authorized EditorState transaction. React receives immutable state facts and never owns live screenplay content.

## Alternatives and consequences

Embedding preferences in Fountain would pollute portable author content. A native filesystem settings endpoint would add capabilities for noncritical UI configuration. A hardcoded shortcut table in each menu/help/editor would drift. Those alternatives are rejected. Versioned storage allows a later native settings migration without silently claiming manuscript protection. Cross-window live preference synchronization, richer profiles and non-ASCII remap keys are deferred; reload reads the latest local profile. Corrupt stored profiles remain available until an explicit successful remap/reset replaces them.

Evidence still needed: M3-12 production/native-menu integration; actual macOS/Windows, alternate full layouts, assistive-technology shortcuts and screenreader tests when Tier 1 targets are declared; M6 installed/offline preference retention.

## M4-10 presentation preferences

Extend the same UI-only storage boundary with `babel.view.v1`: a strict version-1 envelope with exactly `theme` (system/light/dark), `zoom` (75/90/100/110/125/150/175/200), `focus` and `typewriter`. No manuscript, identity, paths or native endpoint. Schema/size/read errors retain stored bytes and use disclosed defaults; writes must succeed before new settings activate, and failure retains working settings with a visible retry notice. Preferences survive writing/Home transitions through one application-owned controller; installed/offline retention and cross-window synchronization remain deferred. CSS writing zoom never changes export typography or EditorState. The local UI preference policy remains distinct from author-content durability.

[M4-10 evidence](../test-evidence/M4.md#m4-10--presentation-modes) records default-release/native retention, caret/IME/scroll and failure checks; full platform/accessibility/performance claims remain open.

## M4-13 recent position hints

Extend the WebView UI-only boundary with `babel.positions.v1`, a strict
version-1 envelope of at most 64 hints / 48,000 ASCII bytes. Each hint stores only
the durable native document UUID, exact captured source SHA-256, two physical
row/UTF-16 anchors, and an optional viewport row/intra-row fraction. It excludes
source text, paths, live native handles/session IDs, timestamps and logs. Unlike
presentation settings, the hint necessarily identifies its local document.
It receives no recovery/history/save receipt or protection credit.

Use the native service's already-published persistent identity and current initial
fingerprint; do not derive identity from content or transfer a hint during Save As.
Restore only at initial ordinary Open/Recent entry when both UUID and source hash
match and every selection offset is scalar-safe/in bounds. Explicit recovery
selection/metadata wins; Locate, Save As adoption and source replacement use their
owned selection or the source-derived default. Unknown/missing identity, changed
source, corrupt/oversize/unknown schemas and invalid anchors fall back safely.
Corrupt hints remain stored until the owner explicitly repairs the UI profile;
ordinary hint writes refuse to overwrite them. Quota/read/write failure is a
visible auxiliary notice and cannot block manuscript save, recovery or close.

Viewport restoration is deferred until the current outline/panel layout commits,
checks the same immutable document/selection, and yields to pointer/key/wheel/touch
input. Two bounded geometry passes account for the toolbar entering its sticky
position; there is no continuing scroll-follow loop. The viewport anchor is independent of the caret, preserving manual scroll
across theme/zoom/typewriter. Position writes are coalesced at 250 ms with a maximum
wait; source hashes come from existing branded captures, not a second source
engine. Close captures the viewport before the protection panel can scroll it and
refreshes the final caret/hash before retiring the identity. If content changed
after that viewport capture, omit its viewport rather than apply an old anchor.
No native registry schema, endpoint, lease or publication policy changes.

Evidence still needed: [M4-13 evidence](../test-evidence/M4.md#m4-13--characters-counts-and-recent-position)
records bounded Linux production restart/failure/selection scope. Installed/offline
WebView-profile retention, other platforms, cross-window hints and long-session
performance remain M6; this auxiliary store makes no durability guarantee.

## M4-14 palette and native menus

The shared `commandCatalog.json` owns IDs, names, groups, defaults and future
unavailability for both TypeScript and Rust. Live route/editor/form/protection
facts drive availability; dispatch rechecks them before invoking existing services.
Home, palette, command help and writing controls share these actions. Native
menus display registry-derived shortcut hints; WebView logical-key routing owns
keyboard accelerators exclusively. Registering a second toolkit accelerator would
bypass form/composition ownership and could dispatch twice. Native menu selection
remains a real toolkit action, emitting only a catalog ID and opaque publication
token to the main WebView. No new menu/plugin capability or disk endpoint is added.

Each publication builds menu items with token-qualified native IDs. Queued events
from replaced items are refused by the host; retired UI listeners and token
mismatches are also refused. Publications serialize across route changes and
failure retires native dispatch with a fixed visible fallback notice. The strict
host envelope accepts the full ordered catalog, enabled flags, canonical bounded
bindings and a bounded token only; labels/source/paths/shell payloads are rejected.
Future PDF/timeline/remote actions cannot be enabled. Read-only, staged title,
composition and protected/busy states retain their existing mutation boundaries.

The palette contains focus, makes background controls inert, filters enabled
actions and current scene/section targets, caps visible results at 100 with an
explicit refine notice, and returns focus on Escape/F6/cancel. Navigation rechecks
the original immutable projection at activation; it never earns an authored Undo
step. Native menu behavior on other platforms, reserved assistive shortcuts,
actual screenreaders and installed-profile retention remain open; bounded Linux
observations are linked in [M4-14 evidence](../test-evidence/M4.md#m4-14--palette-menus-and-accessibility).
