# ADR 0002 — Fountain as author content

Status: Accepted direction; Accepted product direction; codec design pending M1 proof. Date: 2026-09-27.

Context: [SPEC S05/S06](../../SPEC.md#s05), DOC-01–04, INV-02/03. Decision: ordinary Fountain carries portable authored text; a single loss-aware TypeScript codec will support structured editing while preserving no-op bytes and unknown regions. Alternatives: app-only binary schema or generic Markdown conversion are rejected for author-content authority. Consequences: incomplete UI intent can need recovery metadata, but text must remain in source. M1 must prove adversarial no-op and edited round-trips before M3 integration.

Evidence still needed: M1-01 adversarial no-op and edited round-trip proof.
