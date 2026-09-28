# ADR 0015 — Versioned persistence IPC and protection state

Status: Accepted direction. Date: 2026-09-28. Task: M2-04.
Authority: [SPEC S04/S10](../../SPEC.md#s04), SAVE-02, INV-05/10;
[architecture](../architecture.md), [persistence](../persistence-and-recovery.md),
[ADR 0013](0013-recovery-checkpoint-journal.md), [ADR 0014](0014-serialized-source-replacement.md).
Evidence: [M2 report](../test-evidence/M2.md#m2-04--versioned-acknowledgements-and-ipc).

## Decision and context

Native persistence existed without a frontend transport or acknowledgement
state. Add strict, path-free `checkpoint_document` and `save_document` commands
using owned immutable snapshots and native UUID identity/session. Requests bind
positive JavaScript-safe version, exact raw bytes, declared SHA-256, optional
checkpoint/required source fingerprint and opaque JSON draft metadata. Unknown
request/identity/fingerprint fields are rejected. Native source validation,
recovery and replacement remain authoritative; admission never earns protection.

The typed source deserializer bounds its additional allocation to 16 MiB;
admission allows at most 62 KiB serialized draft metadata, reserving 2 KiB for
native transaction metadata. The shared desktop host admits at most eight
active/waiting jobs and 32 MiB logical source-plus-metadata payload. Identity
read/release consume job slots. These are logical budgets, not a total memory or
transport-parser bound: Tauri already parsed JSON, and JSON/byte arrays have
representation overhead. No universal incoming message-size claim is made.

Use `tauri::async_runtime::spawn_blocking`, owned request/permit and a shared
`Arc<Mutex<DocumentService>>`. No mutex guard crosses await, and no filesystem
work blocks the async caller. Native hash/encoding/ownership checks execute in
the worker. Cheap shape/size admission precedes dispatch. Cancelling the awaiting
response cannot interrupt a started worker. Mutex poisoning or join failure
returns structured uncertainty, never a guessed receipt. No new dependencies,
permission capabilities or general filesystem endpoints are needed.
[Tauri command documentation](https://v2.tauri.app/develop/calling-rust/)
was fetched with Context7; pinned local Tauri 2.12.0 runtime source was inspected.

`save_request` atomically admits and executes its own request under the service
boundary, refusing a preexisting native FIFO. This prevents another controller's
queued operation from being consumed and its receipt misattributed. Workers
cannot overlap native mutations, but independent concurrent callers have no
mutex FIFO guarantee; the frontend controller supplies serial request order.
Native FIFO/fault behavior remains available for headless native controllers.

## Exact receipts and immutable tokens

`persistenceState.ts` stores protection facts, not live author content:
`liveVersion`, `journaledVersion`, `fileSavedVersion`, corresponding hashes and
last confirmed native fingerprint. Positive edited versions advance for source
or metadata changes, including undo; initial open is a version-zero sentinel.

Each operation captures a frozen reference token with protection kind,
version/hash/length. A result needs that exact pending token and matching native
identity/session/version/hash plus valid receipt schema. Numeric IDs alone are
insufficient because a new session may reuse them. Source receipts additionally
require matching fingerprint hash/length and an exact separate recovery receipt.
Late v21 results can record historical protection, never mark v22 saved; old
results/failures cannot regress a newer confirmed fingerprint/completion. Foreign
session tokens/results are ignored. Exact duplicate calls still flush natively.

`persistenceController.ts` owns copies of submitted bytes/JSON metadata, bounds
eight requests/32 MiB, and serializes checkpoint/source transport. Queued source
successors receive the latest validated predecessor fingerprint at dispatch,
without changing captured bytes/version/hash/metadata. No disk observation can
be silently adopted as a new expected baseline. The adapter preserves typed
native errors and does not turn invoke completion into invented success.

A known native source failure can carry an exact verified recovery receipt while
source state remains dirty. `sourceUnchanged`, `replacedButUnconfirmed` and
`outcomeUnknown` are distinct. Unknown/malformed source results freeze further
source operations; external divergence has a distinct sticky state. Raw recovery
remains available. Native checkpoint requests always use the registered native
baseline: their expected fingerprint is a hint, not disk authority. Otherwise a
successful source save whose receipt was lost would prevent newer raw recovery
because the frontend still held the old fingerprint. A cancellation test proves
this case without granting the frontend any file-save credit.

## Alternatives, consequences and limits

A synchronous command would wait on filesystem sync/the writer mutex on the UI
thread. Unbounded blocking jobs would copy/retain arbitrary queued manuscripts.
Numeric operation IDs or version-only matching would permit stale session
callbacks or hash mismatch to clear edits. Updating source protection from a
checkpoint would confuse recovery with the portable Fountain file. Those
alternatives violate the existing safety boundary.

The controller is headless: it does not own the editor, debounce/coalescing,
maximum dirty-age scheduling, retry, close, reload or startup adoption. Production
host initialization/native picker remain unwired; New/Open stay disabled.
Synthetic native worker/filesystem checks and generated MockRuntime dispatch
prove bounded behavior on one Linux host, not native WebView UI integration.
No power-loss, other-platform, installed-package or latency guarantee is added.

Evidence still needed: editor/native-picker and save scheduling/coalescing
integration, maximum dirty-age/typing responsiveness; M2-05 startup choice,
transaction resolution, retention/Save As/protected close; M2-06 history and full
M2 safety exit; native WebView end-to-end flow and platform/package/owner pilot.
Linux-only support and startup recovery UI remain open product gates.
