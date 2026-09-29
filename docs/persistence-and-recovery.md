# Persistence and recovery

Status: M1-04 Linux replacement proof and M2-01–06 bounded native safety foundation passed on Linux; M2-05D also has a native WebKit diagnostic. M3-09–12 connect production native entry, cadence, Save As and the active editor; the integrated M3-13 exit remains open. [SPEC S10](../SPEC.md#s10); SAVE-01–05, INV-04–08/10/20.

One native writer queue per document serializes immutable save requests. Requests bind opaque handle, project/session ID, monotonically increasing document version, source hash, and expected disk fingerprint. Track `liveVersion`, `journaledVersion`, and `fileSavedVersion` separately. An acknowledgement for v21 cannot make v22 "Saved locally"; a recovery checkpoint is not a file-save acknowledgement. Native code computes/verifies the saved hash and sends the exact result. Emergency raw protection does not depend on Script Check passing.

Source replacement procedure: validate identity/ownership and source; protect a recovery snapshot; compare current disk fingerprint; retain a verified prior generation; exclusively create a unique same-directory temporary file; write/flush/sync and verify bytes; recheck ownership/change; use a platform-tested atomic replacement; sync metadata/directory where supported; acknowledge only after the tested success point. Failed or interrupted writes retain old source and recoverable data. Filesystem and power-loss limits vary by platform; M1 proves available primitives and M2 fault-tests them.

Recovery records are framed/versioned/checksummed. A torn tail must leave earlier valid checkpoints readable. New drafts receive recovery identity before first named save. Startup compares newer/different recovery against source without automatic overwrite; choices are Recover as Current, Save Recovered Copy, Keep Current File, or Inspect Later. Recovery, current source, rolling snapshots, Git revisions, and external backups serve different purposes. Same-disk snapshots do not protect against loss of that disk.

External changes and multiple instances require explicit ownership/conflict handling. Watcher events are hints; hashes/identity and pre-write checks matter. Dirty/external divergence preserves both. Close after a failed save must expose retry/emergency-copy/risk rather than silently discarding. [Testing](testing.md) lists the fault matrix; [ADR 0005](decisions/0005-layered-safety.md) records the accepted direction.

Auxiliary JSON files (`project.json`, `preferences.json`, the recent-project registry) carry schema versions. Readers stay backward-compatible or offer a safe export path; unknown newer schemas open conservatively and are never deleted to make startup succeed.

M1-04 [ADR 0010](decisions/0010-linux-durable-replacement.md) records the tested
Linux adapter plan: independent verified recovery/previous copies and their
directory sync precede candidate sync/verify, rename, directory sync and exact
receipt. Btrfs/tmpfs fault and SIGKILL evidence is in [M1](test-evidence/M1.md).
A post-rename failure is replaced-but-unconfirmed, never success; artifacts
remain available. Final-check external races, power-loss guarantees, secure
handle-relative paths, production checkpoint framing, ownership/ACL/xattr
policy and other platforms remain explicit M2/M6 work.

M2-01 implements the Linux native open/ownership prerequisite in
`crates/screenwriter-core/src/documents/`: anchored no-follow directory/file
access, bounded byte-exact initial snapshot, strong disk fingerprint, random
opaque session/handle, conservative identity registration and stable
source-inode/document-ID advisory leases. Read-only/unsafe/contended inputs
are view-only; missing/inaccessible/nonregular/oversized sources return typed
errors. Initial bytes survive external edit/delete/move independently of the
source; `validate_owner` rejects changed source, path, store/lock or managed
identity. It is only a pre-operation check and retains the external-writer
race limitation. No source or managed metadata is written during open.

Private schema-1 loose identity records use exclusive creation and sync;
corrupt/future entries remain intact and cause ephemeral view-only open.
Locks are never unlinked. M2-02 adds native recovery checkpoints; M2-03 adds native-only source receipts; automatic
reload, Save As and protected close remain unimplemented. `release_open_document`
is registration relinquishment only and must not become an editor close
without the M2-05 protection protocol. See [ADR 0012](decisions/0012-native-document-identity.md)
and [M2 evidence](test-evidence/M2.md). Full source replacement must use the
retained native anchors and revalidate at the M2-03 success boundaries.

## M2-02 recovery checkpoints

Native `DocumentService::checkpoint` accepts an owned handle/session, a
positive JavaScript-safe version, immutable source bytes, declared SHA-256 and
opaque JSON draft metadata. Native code verifies the declared hash and computes
the persisted hash. Raw invalid UTF-8 and incomplete writing are accepted;
Script Check and the source disk fingerprint do not gate independent recovery.
Registration/store/lease validation still applies. An unsaved identity now
holds a document lease; its first checkpoint makes it discoverable on disk.

Schema-1 framing covers header, metadata and exact source bytes with SHA-256.
Each record includes document/session ID, version, monotonic journal generation,
source hash, native base disk fingerprint (null for unsaved drafts) and draft metadata. Readers stop at an invalid/torn/unknown tail
and return all earlier valid records; they do not guess a new boundary.
[ADR 0013](decisions/0013-recovery-checkpoint-journal.md) specifies byte layout
and bounds. Managed journals live in `.screenwriter/recovery/`; loose and
unsaved journals live in the native private app-data `recovery/` directory.

A new verified/synced candidate contains the latest valid predecessor plus
new checkpoint. A separately verified/synced predecessor and directory sync
precede replacing the active journal; final directory sync, ownership and
byte verification precede the exact **recovery-only** receipt. Normal growth
is fixed at two active records plus one predecessor. Pending artifacts are
retained after failure; retries do not discard them. A duplicate request must
freshly sync/verify before it may return the same receipt.

Corrupt/torn bytes are quarantined exactly before a new healthy journal is
published. A second unresolved corruption, future schema, oversized journal,
conflicting generation, pending artifact or older session requires attention;
none is overwritten to make startup or a save succeed. Read-only inspection
exposes published and pending candidates separately. It never claims that a
receipt reached an editor or that the Fountain source was saved. Startup
choice/adoption/retention flows remain M2-05. M2-03 adds save queues; M2-04
adds typed checkpoint IPC and receipt-driven state, dispatching filesystem work
on blocking native workers. [M2 evidence](test-evidence/M2-02.md)
records failure/property/restart/SIGKILL tests and measured growth/latency.

## M2-03 serialized source replacement

Native-only `enqueue_save(SaveRequest)` takes ownership of immutable UTF-8
source/version/hash/draft metadata and an expected native fingerprint;
`save_next(identity)` executes one registration's FIFO request. Admission is
not persistence evidence. There are eight pending slots and a 32 MiB global
source-plus-metadata budget; versions remain ordered even after failure.
Requests admitted together may share a disk baseline. Only a confirmed native
predecessor advances the execution baseline; external disk bytes never do.
The initial open snapshot stays immutable.

Recovery protection precedes divergence checks and source writes. An anchored
transaction frame records the local source and random same-directory candidate
name before any candidate exists. An independently synced/verified previous
source and its directory entry precede candidate write/sync/verification, inode
lease acquisition, final source/ownership recheck, atomic rename, directory sync
and exact installed-byte verification. Ordinary owner/group/mode survive; ACLs
and xattrs are conservatively rejected rather than discarded. Confirmed metadata
is synced/reverified before the exact `sourceFile` receipt and disk baseline
advance. Exact duplicates perform fresh sync/verification without replacement.

Errors distinguish source unchanged by this operation from replaced but
unconfirmed. The latter blocks further replacement and bare release while
retaining both inode leases, baseline, recovery and previous source; independent
raw checkpoints remain possible. `inspect_source_save` only reports artifacts
and source observations after restart, never a delivered receipt or automatic
adoption. Partial, corrupt, newer-schema, unsafe or unresolved artifacts block
source replacement and remain protected. See [ADR 0014](decisions/0014-serialized-source-replacement.md)
for layout/bounds, FIFO semantics and success/failure boundaries. M2-04 adds
worker/IPC and headless state; editor save scheduling/coalescing remains open.
M2-05 owns startup choices, missing-source relinking,
transaction resolution/cleanup, retention, Save As and protected close. Linux
support remains bounded to this tested adapter; no power-loss/platform exit claim.

## M2-04 receipt-driven protection

Source receipts contain an exact, separately tagged recovery receipt. A native
source failure may include that verified recovery receipt without granting
file-save credit. `sourceUnchanged` describes this operation only;
`replacedButUnconfirmed` describes the known post-replacement failure boundary;
`outcomeUnknown` covers worker/transport loss without an exact completion result.
Unknown or malformed results freeze source operations, retain prior confirmed
state and permit independent raw checkpoints. External source divergence has
a distinct state and preserves both versions. No automatic retry/adoption occurs.

State changes require the original immutable operation token plus the exact
session/version/hash and valid receipt schema. An acknowledgement for v21 may
advance historical protection but cannot clear v22. Late results cannot regress
fingerprints or newer completion states; tokens from another session do nothing
even when numeric operation IDs repeat. Errors shown by state use typed codes,
never arbitrary transport text. Native errors are propagated by the adapter.

The controller owns submitted byte/JSON copies, not the live manuscript.
Checkpoint and source calls are serial and bounded; successor source calls use
only validated predecessor fingerprints. Native recovery uses its own trusted
baseline, so a lost source receipt and stale frontend fingerprint cannot block
newer raw protection. No debounce interval, maximum dirty age, coalescing,
protected close or editor integration is delivered here. Those product gates
remain open. [ADR 0015](decisions/0015-versioned-persistence-ipc.md) and
[M2 evidence](test-evidence/M2-04.md)
record contract/failure coverage and native-versus-mocked limits.

## M2-05A startup review

On startup, inspect existing native private recovery without creating the store,
writing recovery/source bytes or acquiring a writer lease. Bound discovery to
4096 directory entries/64 draft UUIDs and expose incomplete scans. Read artifact
origins independently; valid prefixes remain inspectable despite corrupt tails,
future schemas, pending writes or generation conflicts elsewhere. Never infer a
winner/receipt/source-save from these observations. Unknown/unsafe material stays
on disk and is reported, not deleted to make the list look healthy.

A selected preview binds its artifact origin and full canonical checkpoint hash,
including draft metadata. Re-read and verify before returning exact raw bytes;
a changed selection fails rather than switching versions. UI text/hex previews
are bounded and explicitly read-only. Inspect Later only hides review for the
current session and does not resolve or prune it. Local checkpoints may share a
disk with the source and are not a separate backup.

This task covers loose/unsaved private-store recovery only; the source has not
been selected or compared. Headless managed/loose/unsaved comparison and
protected recovery/copy/keep/finalize/relink choices are M2-05B;
snapshots/retention/backup remain M2-05C; protected close remains M2-05D.
Parent M2-05 stays open. [ADR 0016](decisions/0016-read-only-startup-recovery-review.md)
and [M2 evidence](test-evidence/M2-05A.md)
record the contract and native/mocked verification boundary.

## M2-05B explicit choices and external changes

M2-05B-R1 corrects the two [independent review](reviews/2026-09-28-m2-05b-review.md) gaps: finalization now finishes source file/directory durability and revalidates before any receipt, and relink requires exclusive caller ownership with held-lease verification. The owner [accepted R1](test-evidence/M2-05B-R1.md) at `5e84879` on 2026-09-28, closing M2-05B acceptance within its recorded Linux/native and mocked coverage.

Comparison, adoption, keep, sibling copy, transaction finalize and safe
relinking operate on a natively opened (`open_selected`) registration anchor;
no IPC path exists and no choice deletes material. The older-session journal
gate stays closed for ordinary checkpoints/saves; only an explicit choice
reconciles it in memory for the current registration, and a restart requires
a fresh choice. Recover as Current adopts selected bytes as a strictly newer
version through the M2-03 recovery-first transaction with an exact source
receipt; Keep verifies both unchanged and writes nothing; Save Recovered Copy
writes exact bytes (including malformed UTF-8) to a synced sibling and
reports only the file name; finalize completes only the two safe
post-replacement states; relinking is native-only with managed/loose
continuity checks. Timestamps never select a winner; a second unresolved
corruption still blocks. Retention/pruning, Save As, external backup
destinations and protected close remain M2-05C/D. [ADR 0017](decisions/0017-explicit-recovery-choices.md)
and [M2 evidence](test-evidence/M2-05B.md)
record the contract and native/mocked verification boundary.

## M2-05C snapshots, retention and external copies

[ADR 0018](decisions/0018-portable-snapshot-retention.md) owns the schema,
publication/deletion ordering, verified retention defaults and limits. Snapshots
are independent source-readable SHA-256-named `.fountain` blobs and immutable
checksummed records under private per-document `snapshots/` directories. They
preserve exact raw bytes, including unsupported encoding; verified content is
shared across records. Selected records bind their entire metadata hash. Named
and pre-destructive records are protected from automatic pruning. Native disk
safety copies carry no guessed editor version.

Changed rolling requests are admitted at five-minute intervals; explicit
maintenance keeps five-minute representatives for one hour, hourly for 48 hours,
daily for 30 days, the newest and every protected/future-clock record. Admission
caps each document at 256 records/256 MiB of distinct source bytes, without
silently freeing protected material to make room. Publication commits the blob
before its referring record; pruning commits expired-record deletion before
removing an unreferenced blob. Pending, orphan, damaged or unknown material
remains inspectable and blocks further maintenance. Retention refuses unresolved
recovery/source operations, external divergence and low available space. It
never deletes journals, previous source, history, identities or locks.

Restore first independently checkpoints current live bytes, protects live and
disk snapshots, then writes the selected supported source bytes through the
existing serialized writer as a newer version. An exact source receipt is the
only source-save credit. M2-05B adoption now protects a disk snapshot before its
replacement too. A blocked snapshot prevents destructive adoption/restore;
ordinary source saving and emergency copies do not depend on snapshots. Git
safety revisions are now created by the M2-06 native history store before
recovery adoption and snapshot restore. Git failure blocks those destructive
choices while ordinary source saving and raw recovery remain independent.

Explicit external copies accept immutable bytes and an opaque destination token
from native selection, bound to the registration/session. Native directory
revalidation, exclusive pending/final publication, file/directory sync and exact
byte verification precede a copy receipt. No destination path crosses IPC, no
existing file is overwritten and no copy receipt changes source/recovery status.
Missing/removed/substituted/read-only destinations fail without silently choosing
another location. Same-filesystem copies do not protect against losing their
backing disk; a different filesystem does not prove a different physical disk.

The injected `SnapshotPanel` displays retention/cap/attention facts, explicit
named/restore/copy actions and these storage distinctions. The default shell
still has no production source/destination picker, editor, cadence, Save As or
configured recurring backup. The [synthetic diagnostic](../prototypes/snapshot-review/README.md)
exercises real WebKit/native commands; [M2 evidence](test-evidence/M2-05C.md)
separates native files/interruptions, mocked dispatch, UI injection and limits.
The bounded M2 headless Linux exit passed; Local v1 remains open. See
[M2-06 evidence](test-evidence/M2-06.md).

## M2-05D protected close and failure escalation

The editor owner freezes input synchronously, then derives the latest immutable
version/hash/bytes. `ProtectedClose` rejects a stale capture. Named sources get
a fresh explicit save; only its exact source receipt permits ordinary native
release. Unsaved drafts get a fresh checkpoint and may close with recovery-only
wording. A source failure can still yield an independent recovery receipt, but
does not close. Diverged/uncertain source state is not retried against a guessed
fingerprint; raw recovery remains available.

After failure the editor stays editable with Retry, native-selected Emergency
Copy and explicit risk choices. A copy receipt must match the latest
identity/session/version/hash/length, and never grants source/recovery credit.
Copy failure does not close. If both source and recovery fail, the UI says newer
changes exist only in memory. Risk close requires a fresh explicit checkbox and
claims no persistence. The separate native risk release rejects queued writes,
preserves journal/transaction artifacts and revokes only the exact registration.

The desktop prevents OS window close while a native registration exists and
emits a close request to the editor. The marked synthetic WebKit editor routes
this through the same policy, including a held-open source-divergence drill,
emergency copy and memory-only explicit risk drill. `release_open_document`
remains a low-level registration operation; a production editor must use the
close coordinator. The default shell has no editor/picker/cadence and no Local
v1 adoption claim. [ADR 0019](decisions/0019-protected-close-lifecycle.md)
records the lifecycle choice; [M2 evidence](test-evidence/M2-05D.md)
owns exact checks and limits.

## M3-10 editor save cadence

`src/application/saveCadence.ts` schedules coalesced recovery checkpoints and
debounced source saves over the serial persistence controller without owning
live editor content or timers itself (the clock is injectable). Targets follow
[SPEC S10.3](../SPEC.md#s10): ~500 ms recovery coalescing, acknowledged
recovery within 1 s, ~750 ms source debounce and a 2 s maximum dirty delay so
continuous typing cannot postpone protection indefinitely. Explicit save/close
flushes bypass timers and verify a fresh native flush even when the source is
unchanged; timer saves skip already-saved versions. A failed dispatch never
re-arms itself — the failure stays visible in persistence state and only a
newer edit or an explicit flush retries. After each confirmed save, a rolling
snapshot is requested when the existing five-minute retention interval has
elapsed and content changed; snapshot/copy errors set a separate attention
flag and never touch save state. `src/app/SaveStatus.tsx` renders the
resulting live/recovery/file-saved versions and snapshot attention as literal
text. Editor wiring, Save As identity switching and protected close
integration remain M3-11/12. [M3 evidence](test-evidence/M3.md#m3-10--recoverysource-cadence-and-visible-protection-state)
owns checks and measured native latency.

## M3-12 production session integration

The default native writing view binds the production editor to the passed
persistence/cadence/close services. Open allocates its editor version above
known recovery versions without automatic saving or reconciliation. Save As
protects a frozen latest capture before exact publication and identity switching;
cancellation/failure retains the active editor. Old registrations, captures and
selected copy tokens are retired at the boundary. Read-only sessions reject
editor transactions and close without a write request.

Recovery and snapshot restore protect the current live editor in a verified
pre-destructive snapshot before replacing disk. Native bytes/receipts are checked
before one explicit source transaction. Restored bytes can advance to a later
native version, and Undo produces a still-newer version against the adopted
fingerprint. Normal saves cannot clear blocked/diverged state; only an exact,
explicitly completed native adoption re-anchors that baseline after pending work
has drained. Unknown/mismatched results retain existing material and show an error.

Close freezes transaction dispatch, drains pending cadence and synchronizes the
latest capture before retry/copy/risk. Risk acceptance is tied to the displayed
version and reset by new edits/protection changes. A newer frozen capture refuses
a stale risk choice. Window close happens only after exact native release.
Deferred capture coalescing avoids overlapping hash queues, and background
receipts refresh status. A failed history store does not block normal source or
emergency-copy saving; destructive import/recovery still require their safety
protection. [ADR 0026](decisions/0026-writing-lifecycle.md) owns coordination.
[M3-12 evidence](test-evidence/M3.md#m3-12--production-writing-lifecycle-and-failure-ui)
records the default-app filesystem/failure drill and remaining limits.

## M3-13 review corrections

The [separate review](reviews/2026-09-29-m3-13-review.md) identifies a live/controller version gap after capture refusal: the newer Parenthetical split stays only in EditorState, old source/checkpoints remain intact, status still says saved, and emergency copying cannot capture the draft. [M3-12-R1](tasks/M3-12-R1.md) owns truthful immediate status and a preservation route for the latest uncapturable draft.

Unsaved checkpoints survive acknowledged restart and can be inspected, but the default home has no resume/export action ([M3-09-R1](tasks/M3-09-R1.md)). Read-only sources currently disable Save As, contrary to S05.2 ([M3-11-R1](tasks/M3-11-R1.md)). M3-13 cannot certify these cases until corrections pass; prior named-source recovery/publication evidence stays bounded.
