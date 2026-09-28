# ADR 0004 — Continuous writing and authoritative PDF preview

Status: Accepted UX direction; renderer selection pending M1 proof. Date: 2026-09-27.

Context: [SPEC S08/S12](../../SPEC.md#s08), PDF-01–04, INV-13. Decision: continuous structured editing remains responsive; a separate read-only PDF view is authoritative for printed pages. Preview and export share one pinned offline adapter/profile/font set. Alternatives: an editable WYSIWYG page engine or browser-print pagination as a second authority are deferred. Consequences: no guessed page count or page markers without tested source mapping. M1 tests an existing renderer first, including Screenplain as candidate, before an adapter is selected.

Evidence still needed: M1-03 renderer coverage matrix, rendered samples, and offline packaging experiment.
