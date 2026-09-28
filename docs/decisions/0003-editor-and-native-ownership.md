# ADR 0003 — One editor authority, thin native services

Status: Accepted boundary; ProseMirror integration pending M1 proof. Date: 2026-09-27.

Context: [SPEC S03/S04/S07](../../SPEC.md#s04), EDIT-01–06, INV-11/14. Decision: one structured live editor owns edits, React owns surrounding UI, and Rust owns privileged disk/history/render/remote operations through typed narrow commands. ProseMirror is preferred, subject to native composition/selection/performance proof. Alternatives: independent mutable raw buffer plus rich editor, or universal filesystem IPC, violate the authority/safety boundary. Consequences: explicit immutable versioned snapshots cross IPC; derived work must reject stale results. M0 exposes only app-info and no file permission.

Evidence still needed: M1-02 ProseMirror native composition/selection/performance proof.
