# ADR 0024 — Native document entry: picker, unsaved drafts, destination tokens

Status: Accepted direction. Date: 2026-09-29. Task: M3-09. Authority: [SPEC S04.4/S05/S08.1/S08.6/S10](../../SPEC.md#s04); APP-02, DOC-01/03, SAVE-03/05, SEC-02. Related: [ADR 0012](0012-native-document-identity.md), [ADR 0015](0015-versioned-persistence-ipc.md), [ADR 0018](0018-portable-snapshot-retention.md), [ADR 0019](0019-protected-close-lifecycle.md).

## Decision

Document entry is native-selected and path-free. Three typed commands own it: `create_unsaved_draft`, `open_source_via_picker` and `select_destination`. No IPC request carries a filesystem path; unknown fields (including any injected path) are rejected by strict envelopes. The OS file/folder picker runs natively on a bounded blocking worker through `rfd` 0.17.2 (MIT, pinned, GTK3 backend matching the WebKitGTK stack); the frontend learns only the resulting registration or an opaque destination token. Cancelling a picker returns null and preserves every registration, journal and token.

`create_unsaved_draft` allocates an exclusive unsaved identity with empty source immediately; the first checkpoint makes it recoverable, per the existing M2-02 journal. `open_source_via_picker` funnels the picked file through the unchanged M2-01 `open_selected`, so missing, read-only, contended, unknown-schema and invalid-encoding sources keep their conservative managed/loose/unsaved outcomes. `select_destination` validates the exact registration/session before showing a folder picker, then issues the existing M2-05C session-bound token usable by `save_external_copy` and the future Save As. Release revokes tokens with the registration; stale or foreign sessions and reused tokens fail closed. Production setup initializes the writer store from the OS app-data directory only; failure leaves the host uninitialized and entry commands report `nativeUnavailable` instead of inventing a manuscript. Blocking picker/open/register/destination work never runs on the UI thread. No frontend filesystem, shell or dialog capability is added.

## Tradeoffs

`rfd` is used directly instead of the Tauri dialog plugin: entry commands stay `State`-only like every other native command, no plugin registration or frontend dialog permission exists to audit, and headless tests link the same crate. The GTK3 backend is chosen over the portal backend for parity with the application's GTK/WebKit stack. Under headless test runtimes the picker stubs to cancellation, so the OS dialog display itself is not covered here; registration, cancel preservation, token binding and the conservative open matrix are. Production writing activation stays M3-12.

## Evidence still needed

[M3-09 evidence](../test-evidence/M3.md#m3-09--native-sourcedestination-picker-and-recoverable-drafts) owns checks and omissions. Real-display picker drill (picker to edit to save to close to reopen), Save As publication (M3-11), production lifecycle wiring (M3-12) and other-platform dialogs remain open.
