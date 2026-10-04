# ADR 0023 — Protected Fountain import and undo provenance

Status: Accepted direction. Date: 2026-09-29. Task: M3-08. Authority: [SPEC S07.7](../../SPEC.md#s07), INV-03/12/17/18. Related: [ADR 0021](0021-production-editor-source-captures.md), [ADR 0020](0020-native-curated-history.md).

Amended 2026-10-03 by [AUDIT-SLP-A](../tasks/AUDIT-SLP-A.md) to remove unused surfaces; historical acceptance evidence remains retained.

## Decision

Ordinary clipboard paste retains the target element type. Internal MIME is a bounded, validated list of rows/marks and relative speech references; it never supplies source-origin attributes or executable DOM. External HTML is parsed in an inert template and reduced to literal text; no parsed element or attribute is adopted. Explicit paste validates a proposed source capture before dispatch, refusing grammar that cannot preserve the literal text. This validation does not run on ordinary typing. The clipboard and existing manuscript remain intact on refusal.

Import Fountain is an explicit whole-screenplay replacement with staged content retained. Before dispatch, the required writing-session coordinator freezes input and cadence, captures the exact live draft and requests one narrow native operation, `protect_workflow` with operation `fountainImport`. Under the owned document service mutex, bounded blocking work checkpoints those exact bytes and publishes their curated safety revision using the native profile. Either failure stops import; a completed checkpoint remains available if history fails. No source file is replaced and no filesystem path, profile or history label is accepted from the frontend.

Protection receipts bind operation, byte length, identity, session, version, hash and safety ref. The application rechecks the immutable EditorState, view and composition both before and after native protection. A stale result may protect older work but cannot import over newer work. Imported bytes receive fresh row IDs and one isolated history event. The private codec-origin token travels with the editor document attribute through history; its immutable codec document lives in a private WeakMap. Only a branded whole-source import or history transaction can change it. DOM/clipboard do not carry that provenance. Undo/redo restores exact source origins, including BOM/CRLF, unknown/protected regions, empty or invalid UTF-8 bytes, while session/version and ID high-water rules continue. There is one live EditorState and no mutable Fountain peer.

## Tradeoffs

Inert HTML becomes text rather than guessed screenplay elements or foreign style. Partial mixed-row structure and incomplete speech groups refuse rather than flatten or detach relationships. Ambiguous literal Dialogue markers may be impossible to encode in Fountain; those pastes refuse visibly. Drop remains refused. The text import panel encodes staged text as UTF-8; the boundary also accepts exact byte imports. Future native file selection belongs to M3-09. Default writing activation remains M3-12.

## Evidence still needed

[M3-08 evidence](../test-evidence/M3.md#m3-08--paste-formatting-and-native-input) owns checks and omissions. Full real CJK/RTL IME and Tier 1 platform acceptance remain open. Dead-key composition and synthetic DOM events do not establish full IME support. Actual compositor paint and page-count-calibrated workload measurements remain later performance gates.
