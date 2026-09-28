# Architecture and ownership

Status: M0 shell plus M2-01–04 headless native document/persistence boundary, receipt-driven frontend state, and M2-05A read-only startup recovery boundary. [SPEC S03-S04](../SPEC.md#s03), [S17](../SPEC.md#s17); APP-01, DOC-01, SAVE-01, SEC-01, QA-01.

Current paths: `src/app/App.tsx` owns the visible placeholder; `src/application/appInfo.ts` defines the typed boundary; `src/infrastructure/nativeAppInfo.ts` invokes the app-info Tauri command, while `browserAppInfo.ts` declares browser-only unavailability. `src-tauri/src/lib.rs` has thin command wiring. `crates/screenwriter-core/src/lib.rs` owns app-info and the headless document service. There is one frontend package and one Rust workspace; native registrations retain immutable initial source snapshots; no live editor exists; native recovery/source queues own persistence; typed IPC and a headless frontend controller connect captured snapshots to exact receipts.

## Naming map

SPEC S17 uses `screenwriter/` as an illustrative root. Actual names in this
repository are authoritative for paths and artifacts:

| Name                 | Meaning                                                                           |
| -------------------- | --------------------------------------------------------------------------------- |
| `babel`              | Owner-selected application/product name; desktop binary and package identity      |
| `babel-screenwriter` | Frontend npm package name in `package.json`                                       |
| `screenwriter-core`  | Headless Rust crate in `crates/screenwriter-core/` (technical name, retained)     |
| `Screenwriter`       | Placeholder label used by the starter spec; do not use for new paths or artifacts |

Future flow is UI -> application commands -> domain contracts/platform ports, and Tauri commands -> headless native services -> tested adapters. The structured editor alone will own live edits; React will render surrounding UI and derived views. The TypeScript domain codec will own Fountain interpretation and source-aware serialization without filesystem access. Rust will accept immutable, versioned source snapshots and own disk durability, history, PDF orchestration, and eventually remote credentials. No arbitrary path or shell IPC is allowed. Current capability permissions remain empty. Custom document commands are path-free; no filesystem plugin or universal path endpoint is enabled.

M2-04 save/checkpoint envelopes extend the implemented open identity: opaque document handle, project/session identity, monotonically increasing version, source hash, bounded payload, typed error/recovery action. Planned operations include open, checkpoint/save, close, history, render/cancel, and explicit remote transfer. M2-01 wired immutable initial-source read and registration relinquishment; M2-04 adds checkpoint and source commands, with all four dispatched on blocking workers. Native picker and visible editor integration remain open. Derived results carry a version/hash; stale work cannot mutate the editor. Expensive filesystem, PDF, and remote work stays off key handlers.

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
`src/infrastructure/nativeDocuments.ts` forwards strict identity/snapshot envelopes and preserves
native failure. Rust rejects extra request fields and stale/cross-document
sessions. Errors contain only code and recovery action, never OS path/text.

Bounds, schema and platform limits live in [ADR 0012](decisions/0012-native-document-identity.md).
[Tauri MockRuntime dispatch tests](../src-tauri/src/document_ipc_tests.rs)
exercise the real generated command handler against native synthetic files;
the runtime is mocked and is not WebView E2E evidence. Blocking open/identity
I/O stays native-only; future picker wiring must dispatch it to a native worker.

M2-02 adds native-only `checkpoint`, `inspect_recovery` and
`inspect_local_recovery` methods. M2-04 exposes checkpoint IPC; inspection/adoption remain native-only. Pure framing lives in
`documents/recovery.rs`; Linux publication in `documents/recovery_store.rs`.
Receipts are explicitly tagged `recoveryCheckpoint` and carry the exact
identity/version/hash/generation. The service does not maintain mutable live
editor content. Managed recovery stays in the project auxiliary directory;
loose/unsaved recovery stays in private app data. [ADR 0013](decisions/0013-recovery-checkpoint-journal.md)
records schema, publication, bounds and restart limits.

M2-03 adds `documents/saving.rs` native queue/receipt/failure types and Linux
`documents/source_store.rs` transactions/restart inspection. Each registration
owns a bounded FIFO and a disk baseline distinct from its immutable initial
snapshot. `enqueue_save` is admission; `save_next` executes recovery-first
replacement and returns an exact source receipt or typed uncertainty. The
service's mutable boundary serializes operations; M2-04 adds worker dispatch
and typed IPC/stale-result states. M2-03 added no command/capability/editor or
runtime network dependency. [ADR 0014](decisions/0014-serialized-source-replacement.md)
records anchors, artifacts, lease transition and limits.

## M2-04 persistence IPC and state

| IPC command           | Request                                                                                    | Response                                         |
| --------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `checkpoint_document` | `request: { identity, version, source, sourceSha256, expectedFingerprint, draftMetadata }` | Exact `CheckpointReceipt` or `CheckpointFailure` |
| `save_document`       | Same envelope; native expected fingerprint required                                        | Exact `SaveReceipt` or `SaveFailure`             |

Both envelopes reject unknown fields, including nested identity/fingerprint
fields; identities are canonical native UUIDs. Metadata remains opaque JSON;
raw checkpoint bytes need not be valid UTF-8. Source saves keep the native
encoding/hash/ownership/fingerprint checks. No caller supplies a path or
transaction name. `documents/persistence.rs` owns strict serde/admission types.

`src-tauri/src/persistence_host.rs` reserves at most eight active/waiting jobs
and 32 MiB of logical source-plus-metadata payload across registrations.
Blocking jobs own snapshots and take the shared native service mutex; no guard
crosses await. This prevents overlapping writers, but mutex acquisition is not
a FIFO guarantee for independent concurrent callers. The frontend controller
serializes checkpoint/save calls; `save_request` atomically admits and executes
its exact request, refusing a preexisting native queue rather than returning
another request's receipt. Cancellation of a response does not interrupt a
started worker. Lost/unknown source results never earn saved credit.

`src/application/persistenceState.ts` binds immutable operation tokens to exact
identity/version/hash/length and tracks live, journaled and file-saved versions
separately. `persistenceController.ts` captures owned bytes/metadata, bounds and
serializes IPC, and dispatches queued successors with only the latest validated
source receipt's fingerprint. It owns neither live editor content nor timers.
Each explicit save, including a duplicate, sends a fresh native flush.
Unknown results freeze further source saves while allowing raw recovery.
Native checkpoint frames use the trusted native baseline even when a lost
source response leaves the frontend fingerprint stale. See [ADR 0015](decisions/0015-versioned-persistence-ipc.md).
Production registration remains unavailable until native picker integration;
no WebView save UI or cadence/latency guarantee is asserted.

## M2-05A read-only startup review

`RecoveryHost` receives only the native OS app-data path during setup. It never
initializes the writer store. `list_local_recovery(request: {})` returns bounded
summaries/notices; `read_local_recovery(request: {documentId, origin, recordSha256})`
revalidates one exact checkpoint and returns raw bytes/metadata. Both strict
commands run in bounded blocking jobs. The Linux `LocalRecoveryReader` reuses
anchored/no-follow recovery reads without source writes, leases, lock creation
or adoption. Missing directories are not created. Unsafe stores fail visibly.
The frontend `RecoveryReview` uses `RecoveryPort` and the native adapter; browser
preview reports unavailable. Managed source comparison and resolution remain
M2-05B. See [ADR 0016](decisions/0016-read-only-startup-recovery-review.md).
