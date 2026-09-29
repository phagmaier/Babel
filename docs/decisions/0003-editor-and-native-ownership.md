# ADR 0003 — One editor authority, thin native services

Status: Accepted direction; M1-02 native input proof passed on the reference host, with M3 integration pending. Date: 2026-09-27.

Context: [SPEC S03/S04/S07](../../SPEC.md#s04), EDIT-01–06, INV-11/14. Decision: one structured live editor owns edits, React owns surrounding UI, and Rust owns privileged disk/history/render/remote operations through typed narrow commands. ProseMirror is preferred, subject to native composition/selection/performance proof. Alternatives: independent mutable raw buffer plus rich editor, or universal filesystem IPC, violate the authority/safety boundary. Consequences: explicit immutable versioned snapshots cross IPC; derived work must reject stale results. M0 exposes only app-info and no file permission.

M3-04 implements the production source-aware schema/state/capture boundary and passes its bounded native typing/selection/history subset. [ADR 0021](0021-production-editor-source-captures.md) and [M3 evidence](../test-evidence/M3.md#m3-04--sole-editor-authority-and-source-bridge) record ownership/capture choices; default-app activation remains open.

Evidence still needed: M3 structural commands/undo, native IME and full input/lifecycle integration, and Tier 1 platform matrix; see [ADR 0008](0008-native-editor-input.md).
