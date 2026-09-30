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
