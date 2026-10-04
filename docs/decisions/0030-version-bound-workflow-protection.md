# ADR 0030 — Version-bound workflow protection

Status: Accepted direction. Date: 2026-09-30. Task: M4-04.
Authority: [SPEC S08.3/S10.2/S11.1/S14.1](../../SPEC.md#s08), NAV-01, HIST-01, SAVE-01–03, SEC-02, QA-01; [ADR 0020](0020-native-curated-history.md), [ADR 0023](0023-protected-fountain-import.md).

Amended 2026-10-03 by [AUDIT-SLP-A](../tasks/AUDIT-SLP-A.md) to remove unused surfaces; historical acceptance evidence remains retained.

## Decision

Extend the existing owned checkpoint and curated history machinery with `protect_workflow`. Its strict request contains only a closed operation (`fountainImport`, `sceneMove`, `sectionMove`) and the existing path-free checkpoint envelope. Rust chooses the history label and native profile. It checkpoints the exact bytes and publishes/readbacks their safety ref under the document service mutex in one admitted blocking worker. The receipt binds operation, byte length, checkpoint identity/session/version/hash/generation and the verified revision/ref. This is the sole import protection command; the unused compatibility command and receipt were removed in AUDIT-SLP-A. Neither receipt saves or replaces the source; Rust does not parse source or apply editor operations.

A scene or section move is large at **50 or more physical source rows OR 16,384 or more source bytes** in the complete moved span, including attachments, hidden regions and newline bytes. Section subtrees count their entire moved span. Below both thresholds the move still needs exact live-frame validation and coherent Undo; uncertainty about dimensions requires protection rather than a size guess. This task defines and tests the policy; M4-05 owns planning, dimensions, preview and dispatch.

`WritingSession.runProtectedWorkflow` pauses cadence, freezes input/selection, settles admitted persistence and captures the exact live version. An immutable EditorState token binds document and selection in addition to native identity and version. It validates the receipt and rechecks active coordinator, token, version, selection, composition and cancellation immediately before a separately owned synchronous editor callback. No await separates final admission and dispatch. The view temporarily permits only that owned callback, then resumes input and cadence. Missing editor support/port, read-only, uncapturable source, stale state, composition, cancellation, concurrent workflow or bad receipts refuse visibly. History failure preserves any completed recovery checkpoint and does not gate ordinary Save or emergency copy.

Production Fountain import exercises the same guard. Its staged text remains present on cancellation or refusal; one isolated import transaction preserves existing Undo provenance. A visible Cancel import protection control aborts editor application, not a started native write. Input remains frozen until the worker settles; completing an older checkpoint is harmless and never authorizes newer edits. Destroying the panel aborts its request. Thaw restores recovery/source timers with their original dirty age, dispatching overdue dirty work immediately. No timeline, history scheduling, source replacement, remote operation, new native filesystem privilege or runtime dependency is introduced.

## Alternatives and remaining evidence

A frontend-only checkpoint or an arbitrary action label would not prove a safety ref or restrict privileged ownership. Replacing native history storage would duplicate proven durability machinery. A reusable receipt detached from the final live-state check would permit stale application. The selected guard instead keeps native protection independent and applies only while its exact editor frame remains current.

[M4 evidence](../test-evidence/M4.md) owns native versus mocked verification, tmpfs/Btrfs publication, strict IPC, stale/cancel/failure cases and retained failed attempts. This is a bounded pre-operation primitive; M4-05 scene/section transaction and drag/keyboard acceptance, M6 timeline/periodic revisions, other platforms and hardware power-loss durability remain open. No pruning or destructive history repair.
