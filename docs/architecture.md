# Architecture and ownership

Status: M0 shell plus M2-01 headless native identity/open boundary. [SPEC S03-S04](../SPEC.md#s03), [S17](../SPEC.md#s17); APP-01, DOC-01, SAVE-01, SEC-01, QA-01.

Current paths: `src/app/App.tsx` owns the visible placeholder; `src/application/appInfo.ts` defines the typed boundary; `src/infrastructure/nativeAppInfo.ts` invokes the app-info Tauri command, while `browserAppInfo.ts` declares browser-only unavailability. `src-tauri/src/lib.rs` has thin command wiring. `crates/screenwriter-core/src/lib.rs` owns app-info and the headless document service. There is one frontend package and one Rust workspace; native registrations retain immutable initial source snapshots; no live editor or save authority exists yet.

## Naming map

SPEC S17 uses `screenwriter/` as an illustrative root. Actual names in this
repository are authoritative for paths and artifacts:

| Name                 | Meaning                                                                           |
| -------------------- | --------------------------------------------------------------------------------- |
| `babel`              | Owner-selected application/product name; desktop binary and package identity      |
| `babel-screenwriter` | Frontend npm package name in `package.json`                                       |
| `screenwriter-core`  | Headless Rust crate in `crates/screenwriter-core/` (technical name, retained)     |
| `Screenwriter`       | Placeholder label used by the starter spec; do not use for new paths or artifacts |

Future flow is UI -> application commands -> domain contracts/platform ports, and Tauri commands -> headless native services -> tested adapters. The structured editor alone will own live edits; React will render surrounding UI and derived views. The TypeScript domain codec will own Fountain interpretation and source-aware serialization without filesystem access. Rust will accept immutable, versioned source snapshots and own disk durability, history, PDF orchestration, and eventually remote credentials. No arbitrary path or shell IPC is allowed. Current capability permissions remain empty. Custom document commands are identity-only; no filesystem plugin or universal path endpoint is enabled.

M2 save/checkpoint envelopes must extend the implemented open identity: opaque document handle, project/session identity, monotonically increasing version, source hash, bounded payload, typed error/recovery action. Planned operations include open, checkpoint/save, close, history, render/cancel, and explicit remote transfer. Only immutable initial-source read and registration relinquishment are wired in M2-01. Derived results carry a version/hash; stale work cannot mutate the editor. Expensive filesystem, PDF, and remote work stays off key handlers.

See [ADR 0001](decisions/0001-local-first-stack.md), [0003](decisions/0003-editor-and-native-ownership.md), and [SPEC S04](../SPEC.md#s04) for authority and unresolved proofs.

## M2-01 native open boundary

`crates/screenwriter-core/src/documents/` owns the headless Linux service.
Only a native controller may construct it with the OS app-data directory,
call `open_selected(absolute_path)`, or allocate `register_unsaved()`. Paths
are not IPC arguments. Production `DocumentHost` remains uninitialized until
native picker integration; the shell still disables New/Open.

| IPC command             | Request                                      | Response                                                   |
| ----------------------- | -------------------------------------------- | ---------------------------------------------------------- |
| `read_open_document`    | `request: { handle, documentId, sessionId }` | Exact initial `OpenDocument` or structured `DocumentError` |
| `release_open_document` | Same strict identity envelope                | Unit or structured error; revokes registration             |

`OpenDocument` includes the random identity, managed/loose/unsaved kind,
persistent-identity flag, exclusive/view-only ownership with reasons,
UTF-8/unsupported encoding, raw byte array and optional native fingerprint.
Device/inode use strings to avoid JavaScript integer rounding. The initial
snapshot is immutable; this API is not reload, save, recovery or a protected
editor close. No frontend function creates handles or selects arbitrary paths.
The TypeScript contract is `src/application/documents.ts`; the adapter in
`src/infrastructure/nativeDocuments.ts` forwards only identity and preserves
native failure. Rust rejects extra request fields and stale/cross-document
sessions. Errors contain only code and recovery action, never OS path/text.

Bounds, schema and platform limits live in [ADR 0012](decisions/0012-native-document-identity.md).
[Tauri MockRuntime dispatch tests](../src-tauri/src/document_ipc_tests.rs)
exercise the real generated command handler against native synthetic files;
the runtime is mocked and is not WebView E2E evidence. Blocking open/identity
I/O stays native-only; future picker wiring must dispatch it to a native worker.
