# Architecture and ownership

Status: M3-12 activates the production writing lifecycle over the existing sole editor and native persistence/recovery boundaries; the bounded Linux M3-13 integrated exit and corrected separate re-review passed. [SPEC S03-S04](../SPEC.md#s03), [S17](../SPEC.md#s17); APP-01, DOC-01, SAVE-01, SEC-01, QA-01.

Current paths: `src/app/App.tsx` owns startup and explicit recovery navigation; `WritingView.tsx` mounts the sole ProseMirror editor and surrounding controls. `src/application/writingSession.ts` coordinates capture, cadence, identity changes and protected close through typed ports. `src/infrastructure/` supplies path-free native adapters and truthful browser unavailability. `src-tauri/src/lib.rs` wires native commands; `crates/screenwriter-core/src/documents/` owns registrations, leases, publication, recovery and snapshots. There is one frontend package and one Rust workspace. Native registrations retain immutable initial source snapshots; live author content belongs to EditorState and only immutable derivatives cross IPC.

## Naming map

SPEC S17 uses `screenwriter/` as an illustrative root. Actual names in this
repository are authoritative for paths and artifacts:

| Name                 | Meaning                                                                           |
| -------------------- | --------------------------------------------------------------------------------- |
| `babel`              | Owner-selected application/product name; desktop binary and package identity      |
| `babel-screenwriter` | Frontend npm package name in `package.json`                                       |
| `screenwriter-core`  | Headless Rust crate in `crates/screenwriter-core/` (technical name, retained)     |
| `Screenwriter`       | Placeholder label used by the starter spec; do not use for new paths or artifacts |

The current flow is UI -> application commands -> domain contracts/platform ports, and Tauri commands -> headless native services -> tested adapters. The structured editor owns live edits; React renders surrounding UI and derived views. The TypeScript domain codec owns Fountain interpretation and source-aware serialization without filesystem access. Rust accepts immutable versioned source snapshots and owns disk durability and headless history primitives; PDF orchestration and remote credentials remain future work. No arbitrary path or shell IPC is allowed. The capability file grants only the narrow event/window permissions needed by the protected-close flow. Custom document commands are path-free; no filesystem plugin or universal path endpoint is enabled.

M2-04 save/checkpoint envelopes extend the implemented open identity: opaque document handle, project/session identity, monotonically increasing version, source hash, bounded payload, typed error/recovery action. Planned operations include open, checkpoint/save, close, history, render/cancel, and explicit remote transfer. M2-01 wired immutable initial-source read and registration relinquishment; M2-04 adds checkpoint and source commands, with all four dispatched on blocking workers. M3-09 supplies native pickers; M3-12 connects the visible editor and lifecycle. Derived results carry a version/hash; stale work cannot mutate the editor. Expensive filesystem, PDF, and remote work stays off key handlers.

See [ADR 0001](decisions/0001-local-first-stack.md), [0003](decisions/0003-editor-and-native-ownership.md), and [SPEC S04](../SPEC.md#s04) for authority and unresolved proofs.

M3-04's [editor contract](editor-behavior.md#m3-04-sole-state-and-capture-boundary) and [ADR 0021](decisions/0021-production-editor-source-captures.md) add typed nodes and immutable source origin inside one EditorState, a view adapter and bounded deferred version/session-checked captures. No mutable source cache, proof import, native command or permission is added. React/native consumers receive derivatives. M3-09–12 connect native entry, cadence, Save As and the production writing lifecycle; M3-13 owns the integrated exit review.

## M2-01 native open boundary

`crates/screenwriter-core/src/documents/` owns the headless Linux service.
Only a native controller may construct it with the OS app-data directory,
call `open_selected(absolute_path)`, or allocate `register_unsaved()`. Paths
are not IPC arguments. Production `DocumentHost` initializes from the OS app-data directory during
setup (M3-09); entry stays path-free through picker/unsaved/destination
commands. M3-12 enables native New/Open and coordinates the active writing session.

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
Production registration is available through the M3-09 native entry commands;
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
preview reports unavailable. See [ADR 0016](decisions/0016-read-only-startup-recovery-review.md).

## M2-05B recovery choices

M2-05B-R1 corrects the two [independent review](reviews/2026-09-28-m2-05b-review.md) gaps: finalization finishes source file/directory durability before any receipt, and relink requires exclusive caller ownership with held-lease verification. The owner [accepted R1](test-evidence/M2-05B-R1.md) at `5e84879` on 2026-09-28, closing M2-05B acceptance within its recorded Linux/native and mocked coverage.

`documents/choices.rs` owns strict path-free choice envelopes;
Linux `documents/choices_store.rs` owns comparison, protected adoption through
the M2-03 transaction, explicit keep, sibling emergency copy, post-replacement
finalize and native-only relinking on `open_selected` anchors. The
older-session journal gate gains an in-memory, per-registration reconciliation
set only by an explicit choice. Five writer-host commands
(`compare_recovery`, `recover_checkpoint_as_current`, `keep_current_source`,
`save_recovered_copy`, `resolve_save_transaction`) dispatch on bounded
blocking workers within the shared M2-04 job/payload budget; each reserves one
source bound of logical payload. The frontend `RecoveryChoicePanel` uses the
`RecoveryChoicesPort` with stale-result guards; production host and picker
wiring remain uninitialized. See [ADR 0017](decisions/0017-explicit-recovery-choices.md).

## M1-06 diagnostic composition boundary

A feature-only Linux native module initializes the writer during setup only after validating an explicitly supplied private marked synthetic root. Its opening command maps fixed fixture IDs to native filenames; checkpoint/save use the existing DocumentHost worker/controller. The diagnostic page has one typed EditorState authority with immutable original source data and derived captures. The default production handler/route/capabilities and uninitialized writer boundary remain unchanged. See the [proof](../prototypes/editor-composition/README.md) and [bounded evidence](test-evidence/M1.md#m1-06--bounded-codeceditornative-composition-proof).

## M2-05C snapshot and copy boundary

The native `documents::snapshots` contracts and Linux snapshot store reuse the
same serialized `DocumentService`/host mutex as saves and choices. Snapshot,
preview, maintenance, restore and external-copy commands run on bounded blocking
workers; they do not run on typing or mutate a live editor. The native controller
alone selects an external destination and obtains a document/session-bound token;
IPC contains no path. Production folder selection is available through the
M3-09 `select_destination` command; the existing
composition-proof feature additionally exposes only a fixed marked synthetic
copy folder for the [M2-05C diagnostic](../prototypes/snapshot-review/README.md).

Snapshot/copy results are independent of file/recovery acknowledgements. Restore
uses the existing recovery-first writer after protecting current live/disk bytes;
only its exact tagged source receipt may update the editor owner. No new history,
filesystem engine, library, runtime network or frontend capability is added.
[ADR 0018](decisions/0018-portable-snapshot-retention.md) owns durable format,
retention/pruning and destination tradeoffs. Production picker/cadence/restore UI,
M2-06 curated safety revisions remained a separate integration gate from this
earlier snapshot task.

## M2-05D close and window lifecycle

`src/application/protectedClose.ts` coordinates a synchronously frozen editor
capture with the existing exact receipt controller. Source, recovery and external
copy acknowledgements remain separate. `ProtectedClosePanel` exposes Retry,
Emergency Copy and explicit risk; the production shell has no editor to mount
it. Native `release_open_document_at_risk` is a distinct bounded worker command
that can relinquish an uncertain registration after an explicit risk or verified
copy choice, but refuses queued writes. Ordinary release stays conservative.
The native window event cancels close while registrations exist and emits
`protected-close-requested`. Only event-listen/unlisten and window-close core permissions
were added; no filesystem, shell or remote permission was added. The marked
synthetic editor consumes this event and tests real WebKit close. See
[ADR 0019](decisions/0019-protected-close-lifecycle.md). Once no registration
remains, Linux ends the WebKit web process before the window drops, avoiding
its crashing exit-time teardown ([ADR 0035](decisions/0035-linux-web-process-close.md)).

## M2-06 native history boundary

The same serialized Linux `DocumentService` owns curated Git history under
private app data, keyed by native document identity. Its `record_revision`
method accepts only the owned disk generation or the latest exact current-session
checkpoint. Source/profile commits, CAS main refs and safety refs carry no
source/recovery receipt. Recovery adoption and snapshot restore call this native
safety operation before source replacement. A history failure blocks those
destructive choices while ordinary saves/checkpoints remain independent;
`history_health` reports attention after restart. The default desktop has no
history IPC command or frontend path/permission. [ADR 0020](decisions/0020-native-curated-history.md)
records the native format and failure tradeoffs. M6 owns editor scheduling,
timeline/restore UI and installed/offline adoption.

## M3-12 production lifecycle

[WritingSession](../src/application/writingSession.ts) binds the active editor to serial persistence, cadence and protected close. [ADR 0026](decisions/0026-writing-lifecycle.md) owns frozen lifecycle transitions, fresh Save As identity, exact native adoption and private app-data initialization. The view publishes derivatives and rejects editing while frozen/read-only; native services retain path/publication authority. [M3-12 evidence](test-evidence/M3.md#m3-12--production-writing-lifecycle-and-failure-ui) separates injected contracts from production UI/IPC filesystem drills.

## M4-01 native recent boundary

`documents/recents.rs` and `recent_store.rs` own bounded auxiliary metadata and
explicit native locate. `recent_projects_host.rs` wires five strict path-free
commands: `list_recent_projects`, `remove_recent_project`,
`open_recent_project`, `locate_recent_project`, `confirm_recent_location`.
`src/application/recentProjects.ts` and the native adapter expose typed UUID
selection, safe summaries, attention and explicit comparison/confirmation.
The existing job/payload budget and service mutex serialize blocking work;
no frontend path/capability, network or live-editor owner is added.
[ADR 0028](decisions/0028-native-recent-projects.md) owns the disk format and
identity policy. [M4-01 evidence](test-evidence/M4.md#m4-01--native-recents-and-missing-file-selection)
records bounded native verification. The adapter is available for M4-02 Home
integration; M4-01 does not add Home controls.

M4-02's `Home` and `RecentController` present the native registry without reading
manuscript contents. Locate is advisory until explicit native confirmation.
Entry loaders are adopted by the existing `WritingSession`; abandoned responses
release registrations. Protected close/release gates Home return. New with a
destination uses the existing recovery-first Save As identity/publication path,
while cancellation retains the unsaved draft. No new native endpoint, dependency
or content authority is introduced.

## M4-03 advisory manuscript projection

`ManuscriptProjectionController` consumes the existing WritingView capture boundary after origin revalidation. Its single pending deferred build produces the pure `manuscriptIndex.ts` derivative; no parallel parser/editor or native privilege is introduced. Session reference, monotonic version, immutable document and exact source hash bind each result. Navigation rechecks that frame in the sole live EditorView. One previous branded content capture per boundary reuses only an identical immutable document; current anchors/version/hash are still derived. Selection-only capture yields a rendered navigation turn with a bounded hidden-window fallback. Whole-index failure is advisory and cannot mark source/recovery saved. [ADR 0029](decisions/0029-versioned-manuscript-index.md) owns hierarchy/attachments, mapping/bounds and view-only navigation; later moves/find/counts are separate consumers.

## M4-04 destructive workflow boundary

`WorkflowProtectionPort` invokes the strict native `protect_workflow` envelope: closed operation enum plus owned checkpoint, without labels, paths or source parsing. One bounded blocking worker serializes checkpoint/safety publication under existing native document ownership. The compatibility import operation reuses the same core implementation. `WritingSession.runProtectedWorkflow` owns freeze/pause/settle/capture and receipt/frame/cancel validation; a separately owned synchronous callback performs the editor transaction after the final check. The view permits only that callback while frozen. Production import uses the coordinator, retaining staged text and Undo; it exposes cancellation and restores cadence on thaw. Neither history nor recovery receipt has source-save credit. The writing status identifies the unavailable timeline without claiming safety revisions are absent. [ADR 0030](decisions/0030-version-bound-workflow-protection.md).

## M5-02 publication workers

`src-tauri/src/publication_host.rs` admits owned captured-source envelopes under
the document-registration mutex and the existing eight-job/32 MiB native
payload budget. A separate drain worker owns one helper process and one
replaceable pending capture. Request IDs and version/hash high-water marks
reject stale admission; cancellation/generation checks and artifact publication
share a mutex. Document release cancels publication under the same document
lock, preventing admission after close. No live editor or source/recovery write
operation enters this service.

`src/application/publication.ts` copies existing `CapturedSnapshot` derivatives
and checks exact result identity/version/hash/length, renderer/fonts/profile,
actual count and handle before returning current results. The native adapter
translates typed IPC failures; browser publication reports unavailable. Private
native artifacts and their budget/integrity policy are in
[ADR 0036](decisions/0036-bundled-pdf-helper.md#m5-02-caller-integrity-and-lifecycle-policy).
Preview UI, frozen profile, assessments and export remain later tasks.
