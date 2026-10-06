# Persistence and recovery

Status: M1-04 Linux replacement proof and M2-01–06 bounded native safety foundation passed on Linux; M2-05D also has a native WebKit diagnostic. M3-09–12 connect production native entry, cadence, Save As and the active editor; the corrected bounded Linux M3-13 integrated exit passed. [SPEC S10](../SPEC.md#s10); SAVE-01–05, INV-04–08/10/20.

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
Locks are never unlinked. M2-02 adds native recovery checkpoints; M2-03 adds native-only source receipts; later M3 tasks connect Save As and
protected close, and AUDIT-D08A connects explicit protected Reload (never automatic). `release_open_document`
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
and unknown xattrs are conservatively rejected rather than discarded. Only
`security.selinux` is exempt from the descriptor name-list gate: the kernel
labels replacement inodes; Babel does not copy labels. [ADR 0014](decisions/0014-serialized-source-replacement.md)
records the policy and enforcing-SELinux evidence limit. Confirmed metadata
is synced/reverified before the exact `sourceFile` receipt and disk baseline
advance. Exact duplicates perform fresh sync/verification without replacement.
A later version whose bytes equal the current source (a caret- or
metadata-only version) is acknowledged the same way after its recovery
checkpoint: fresh sync, ownership recheck and a `sourceFile` receipt carrying
the unchanged fingerprint. Nothing else is written — no intent, candidate,
`previous`, `confirmed`, lease or recents change — so the retained previous
generation keeps its distinct earlier content ([AUDIT-C04](archive/tasks/AUDIT-C04.md)).

Errors distinguish source unchanged by this operation from replaced but
unconfirmed. The latter blocks further replacement and bare release while
retaining both inode leases, baseline, recovery and previous source; independent
raw checkpoints remain possible. `inspect_source_save` only reports artifacts
and source observations after restart, never a delivered receipt or automatic
adoption. Partial, corrupt, newer-schema, unsafe or unresolved artifacts block
source replacement and remain protected. See [ADR 0014](decisions/0014-serialized-source-replacement.md)
for layout/bounds, FIFO semantics and success/failure boundaries. M2-04 adds
worker/IPC and headless state; M3-10 supplies editor save scheduling/coalescing.
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
protected recovery/copy/keep/finalize choices are M2-05B;
snapshots/retention/copies are owned by M2-05C; protected close by M2-05D.
Those subsequent bounded gates and the M2-06 headless exit passed. [ADR 0016](decisions/0016-read-only-startup-recovery-review.md)
and [M2 evidence](test-evidence/M2-05A.md)
record the contract and native/mocked verification boundary.

## M2-05B explicit choices and external changes

M2-05B-R1 corrects the two [independent review](archive/reviews/2026-09-28-m2-05b-review.md) gaps: finalization now finishes source file/directory durability and revalidates before any receipt, and relink requires exclusive caller ownership with held-lease verification. The owner [accepted R1](test-evidence/M2-05B-R1.md) at `5e84879` on 2026-09-28, closing M2-05B acceptance within its recorded Linux/native and mocked coverage.

Comparison, adoption, keep, sibling copy and transaction finalize operate on a natively opened (`open_selected`) registration anchor;
no IPC path exists and no choice deletes material. The older-session journal
gate admits an exclusive reopen only when the latest clean published journal
matches source bytes and no save transaction is unresolved. Explicit Keep
publishes verified private decision metadata bound to the document, latest
canonical recovery record and source content hash; changed source/record,
unsafe artifacts or interrupted transactions require a fresh choice. Source
and journal bytes remain intact. Recover as Current adopts selected bytes as
a strictly newer version through the M2-03 recovery-first transaction with
an exact source receipt; Save Recovered Copy
writes exact bytes (including malformed UTF-8) to a synced sibling and
reports only the file name; finalize completes only the two safe
post-replacement states. The unused native-only in-session relink API was removed
in AUDIT-SLP-A; M4-01 explicit locate/confirm retains managed/loose identity,
recovery and ownership checks. Timestamps never select a winner; a second unresolved
corruption still blocks. Retention/pruning, Save As, external backup
destinations and protected close remain M2-05C/D. [ADR 0017](decisions/0017-explicit-recovery-choices.md)
and [M2 evidence](test-evidence/M2-05B.md)
record the contract and native/mocked verification boundary.

AUDIT-D02 distinguishes a prior confirmed record whose source later changed
from an unresolved replacement: only an explicit reviewed Keep may bind that
source when no intent, previous-pending copy or candidate remains. Identical-byte
automatic admission still requires NoTransaction or ConfirmedRecordMatchesSource.
A verified latest checkpoint from the current registration needs no older-session
choice. Exporting a standalone copy does not resolve a pending review; successful
Save As adoption switches to a fresh identity without carrying the old gate.

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
silently freeing protected material to make room. A rolling snapshot that
hits a cap runs conservative retention once and retries (M6-03, ADR 0018). Publication commits the blob
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
named/restore/copy actions and these storage distinctions. M3-09–12 now connect production source/destination pickers, editor, cadence,
Save As and the same snapshot services. Configured recurring backup remains M6. AUDIT-SLP-B retired the synthetic
snapshot/composition pages and the fixed snapshot destination command, retaining
fixtures/seed/backend for production native drills. [M2 evidence](test-evidence/M2-05C.md)
preserves historical native copy/prune audits; M6-03 must add independent
production-native copy/prune evidence. Removal grants no retention acceptance.
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

AUDIT-D06 routes file-backed/read-only session, Home/Open and native window
requests directly into this coordinator, with duplicate requests suppressed.
Untitled drafts still require an explicit recovery-only close choice. A pending
automatic close waits for exact protection and release; failure exposes the
persistent choices below. Keep writing cancels only the UI close request and its
pending Home/Open/window destination, allowing edits/Save As without granting
protection or discarding any native artifact. The ordinary save status remains
receipt-derived, including the editor-ahead override; Save details retains exact
version facts, and memory-only/snapshot attention are separate visible alerts.

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
close coordinator. M3-12 wires the production editor/pickers/cadence through
this policy; Local v1 adoption remains open. [ADR 0019](decisions/0019-protected-close-lifecycle.md)
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
flag and never touch save state. The mounted `WritingView` Protection status renders live/recovery/file-saved
versions, snapshot attention/rolling version and the only-in-memory warning as
literal text; AUDIT-SLP-A ports the unused SaveStatus assertions to this surface. M3-11/12 connect editor wiring, Save As identity switching and protected
close integration. [M3 evidence](test-evidence/M3.md#m3-10--recoverysource-cadence-and-visible-protection-state)
owns checks and measured native latency.

## M3-12 production session integration

The default native writing view binds the production editor to the passed
persistence/cadence/close services. Open allocates its editor version above
known recovery versions from the selected native registration, including managed project journals, without automatic saving. AUDIT-D02 adds
only safe native reopen reconciliation; unresolved recovery blocks editing,
while Inspect Later permits read-only review. Save As
protects a frozen latest capture before exact publication and identity switching;
cancellation/failure retains the active editor. Old registrations, captures and
selected copy tokens are retired at the boundary. Read-only sessions reject editor transactions and ordinary Save; Save As can publish exact bytes without checkpointing or writing the original registration. Fresh adoption precedes release of the old registration; failure restores its immutable editor state, selection and undo history while preserving any published copy. The restored view is re-captured to rebind its outline, counts and navigation; rollback does not leave derived facts permanently pending or add an editor transaction.

Recovery and snapshot restore protect the current live editor in a verified
pre-destructive snapshot before replacing disk. Native bytes/receipts are checked
before one explicit source transaction. A frozen replacement projection supplies the new version’s source-bound sparse intent and selection metadata before native publication; the same transaction lands in the editor. An immediate same-version Save therefore uses the metadata that was published with that source. Restored bytes can advance to a later
native version, and Undo produces a still-newer version against the adopted
fingerprint. Normal saves cannot clear blocked/diverged state; only an exact,
explicitly completed native adoption re-anchors that baseline after pending work
has drained. Unknown/mismatched results retain existing material and show an error.

Close freezes transaction dispatch, drains pending cadence and synchronizes the
latest capture before retry. Every accepted editor/selection version updates protection facts before capture completes; earlier receipts cannot protect newer uncaptured work. Emergency copy can preserve an unrepresentable draft as an explicitly labeled, version/hash-bound `.draft.json` bundle with original bytes, live rows/styles/attributes and selection ([ADR 0027](decisions/0027-uncapturable-draft-preservation.md)); this grants neither source-save nor journal credit. Risk acceptance is tied to the displayed
version and reset by new edits/protection changes. A newer frozen capture refuses
a stale risk choice. Window close happens only after exact native release.
Deferred capture coalescing avoids overlapping hash queues, and background
receipts refresh status. A failed history store does not block normal source or
emergency-copy saving; destructive import/recovery still require their safety
protection. [ADR 0026](decisions/0026-writing-lifecycle.md) owns coordination.
[M3-12 evidence](test-evidence/M3.md#m3-12--production-writing-lifecycle-and-failure-ui)
records the default-app filesystem/failure drill and remaining limits.

## M3-13 review corrections

The [separate review](archive/reviews/2026-09-29-m3-13-review.md) records the original failures. [M3-12-R1](archive/tasks/M3-12-R1.md) corrects live-version status and emergency preservation. [M3-09-R1](archive/tasks/M3-09-R1.md) adds explicit “Resume as new draft”: native code revalidates and checkpoints the full selected bytes under a fresh identity before returning them; the original checkpoint stays intact. The frontend restores verified producer metadata, allocates above the new journal and confirms fresh protection. Invalid encoding stays view-only and copyable. A display preview never reconstructs author content.

If the opening view is disposed while resume, inspection or initial capture is pending, the returned registration is released without flushing a retired session. If fresh protection fails, abandonment retains the original protection error; a failed release is reported alongside it, without claiming native cleanup succeeded. [AUDIT-TEST evidence](test-evidence/AUDIT.md#audit-test--wave-2-regression-gaps).

[M3-11-R1](archive/tasks/M3-11-R1.md) enables read-only Save As. [M3-10-R1](archive/tasks/M3-10-R1.md) drains newer edits after an older in-flight operation even when their timers expired, without retrying the same failed version. [M3-12-R2](archive/tasks/M3-12-R2.md) covers selected recovery, replacement metadata, failed-open release and destination retirement. Only one selected destination per registration remains valid for each copy/Save As operation; invalid selection retains the last valid capability. Acceptance requires linked shared/native tmpfs/Btrfs evidence; historical gates remain bounded.

Recovery panels serialize their advisory comparisons. Each native read reserves
a bounded full-source buffer; concurrent mounting of several candidates must not
exhaust that budget and leave valid choices unavailable. This changes frontend
read scheduling, not native queue limits or write authority. Exact selections
and fingerprints are still revalidated before any content choice.

## M4-01 recent metadata and locate

[ADR 0028](decisions/0028-native-recent-projects.md) owns the native schema,
bounds, deduplication and explicit missing-file policy. `recents.rs` defines
strict opaque-entry/selection requests; `recent_store.rs` implements the Linux
store in the same serialized DocumentService. Opens and confirmed publications
update recents best-effort; unsaved recovery remains separate. Save As calls an
unlisted internal open and registers only its final validated success.

Two checksummed generations and an exclusive pending file retain prior valid
metadata under a stable lease. Corrupt/oversized/newer/unsafe metadata or an
interrupted write reports attention and prevents mutation; it never invalidates
ordinary source/recovery receipts. Warm listing stats only known native paths.
No title/content scan, page count, credentials or full path crosses the recent
IPC response. Remove deletes only the selected auxiliary entry.

Locate stages a native picker selection, exposing safe filename and identity/
last-known-content comparison facts. Explicit Link Moved revalidates missing
old source, identity, leases and the selected fingerprint; an active owner,
conflicting target identity or managed UUID mismatch refuses. Open Different
preserves the old entry/recovery and opens the chosen source conservatively.
Managed rename confirmation preserves unknown JSON and a synced previous
mapping before updating `sourceFilename`; ordinary open still never guesses a
rename. Fresh sessions reuse the document identity while recovery/history stay
independent. [M4-01 evidence](test-evidence/M4.md#m4-01--native-recents-and-missing-file-selection)
separates native filesystem/default WebKit drills from mocked dispatch/contracts.
M4-02 presents these controls through the protected writing lifecycle.

## M4-02 Home entry protection

The Home controller only lists/removes recent metadata and stages native Locate
selections. Confirm/open run through WritingSession adoption, retaining its
full-byte source, ownership, recovery inspection and abandoned-open release
checks. No frontend path or alternate persistence authority is introduced.
Home entry is unmounted during opening/writing; returning Home requires the
existing protected close and exact native release. A failed switch preserves
the active editor and every disk generation.

Both New routes attempt an initial checkpoint before the writing actions become
available. Destination-backed New publishes through existing Save As; its
cancel/failure leaves an unsaved draft, never a guessed source-save receipt.
Resume and selected-source Recover/Keep/Copy retain the existing explicit native
revalidation contract, including bytes beyond truncated previews. Original
checkpoints remain discoverable after resume and recent removal. Local recovery
is not independent backup. [M4-02 evidence](test-evidence/M4.md#m4-02--home-and-recovery-workflows)
owns native exact-byte and failed-switch validation.

## M4-04 exact workflow protection

The strict path-free `protect_workflow` request selects a fixed native operation and includes the current checkpoint envelope. An admitted blocking job holds existing native document ownership, checkpoints exact bytes, then publishes/readbacks a curated safety revision. The operation/length/checkpoint/revision receipt is independent of source-save credit. History failure refuses editor application while retaining completed checkpoints, existing refs and ordinary Save/copy functionality. No source interpretation or editor transaction runs in Rust.

The writing session freezes user input/selection and pauses cadence, settles earlier jobs, captures, validates all receipt bindings and rechecks its immutable editor frame, active session, version, selection, composition and cancellation before synchronous owned dispatch. Pending cancellation stops application, allowing a started worker to finish; thaw restores timers without resetting dirty age. Production import reuses this path with a visible cancel control. Missing guards or uncapturable source fail closed. [ADR 0030](decisions/0030-version-bound-workflow-protection.md) owns thresholds and policy; [M4 evidence](test-evidence/M4.md) owns checks. M4-05 scene/section moves consume this same guard; automatic/named history remains M6.

## Recent UI positions (M4-13)

Recent caret/scroll hints use the separate WebView UI preference boundary in
[ADR 0022](decisions/0022-local-shortcut-preferences.md#m4-13-recent-position-hints).
They contain no manuscript copy and cannot advance a source/recovery/history
receipt, dirty version or protected-close assessment. Native recents and recovery
schemas/publication remain unchanged. Durable native UUID plus exact source hash
must match before a bounded selection/viewport hint is applied; checkpoints win.
Failure/corruption retains the old UI bytes, reports auxiliary attention and leaves
native saving/close available. Source replacement, Locate and Save As never reuse
an old hint by session ID or equal-content comparison alone.

## M6-01 native close guard

The window close routes through the native document registration guard. An open
registration or poisoned guard prevents close before the protected-close event
is emitted; notification failure cannot authorize web-process termination.
Closing remains protected until native release. A registration already holding
the service mutex is observed before close can inspect it; an operation not yet
admitted has no accepted editor content. This is the existing registration
contract, not a new admission fence or source-save receipt.

When no registration remains, the existing publication cancellation and Linux
[ADR 0035](decisions/0035-linux-web-process-close.md) termination run. Termination
failure is logged and earns no source/recovery success credit; ordinary teardown
may still encounter the retained upstream crash. Focused tests use real native
registrations/files and injected effects. Actual GTK/forced-kill/restart evidence
and unresolved C1/F2 disposition stay in [M6 evidence](test-evidence/M6.md).

## M6-02 interruption and operation diagnostics

Save As refusal now identifies fresh-session adoption versus original-registration
release and preserves the underlying bounded error message/code. The rollback
contract and receipts are unchanged. A published standalone copy is insufficient
to claim adoption: the native oracle saves a later edit to the copy, then Undoes
it, while independently preserving the divergent original. Initial checkpoint
failures remain visible in the active session's version-bound protection status.

The existing production source-stage gate is threaded through private
save-request/restore helpers with no-op production closures. Actual restore
child-kill tests verify all three literal disk/live/selected generations after
protection, before replacement and immediately after replacement. No IPC or
runtime environment variable exposes these fault hooks.

[Current S15.2 matrix](test-evidence/M6-02-matrix.md) separates injected errors,
real adapter SIGKILL, native path-loss/restart and shared-store two-app controls.
[ADR 0012](decisions/0012-native-document-identity.md) still requires a shared
app-data store for advisory cooperating leases; unrelated app-data roots do not
share them. Parent rename is an unavailable-path simulation, not real unmount
or controller/power-loss proof. [M6 evidence](test-evidence/M6.md#m6-02--persistence-interruption-and-operation-investigation)
retains all failures; clean samples cannot resolve retained M6-01 Save As/IME
operation findings or C1/F2.

## AUDIT-D08A external source Reload

Native window focus and five-second advisory polling recheck the selected source
through its native handle. Source inspection shares the save FIFO, verifies
metadata/ownership/identity, and distinguishes self-writes by fingerprint/hash.
Identical-byte metadata changes re-anchor the baseline without granting a new
file-saved version. Source checks are not durability receipts.

A divergent source offers comparison of the literal draft and disk generations,
Keep editing, Save As a separate copy, and explicit Reload. Keep editing preserves
both and blocks source saves; the same generation does not reopen the prompt.
The source itself remains untouched by Reload. An explicit Reload first protects
the current draft in recovery, a pre-destructive snapshot and a safety revision,
then protects the prepared adopted version and syncs/revalidates the reviewed disk.
An exact native receipt re-anchors persistence only after the editor imports those
bytes as one Undo-able transaction. Undo needs its own later save receipt.
Stale reviews and protection/ownership/encoding failures retain both generations.
Missing or unreadable files leave recovery and separate-copy routes available.
[ADR 0041](decisions/0041-protected-external-reload.md),
[brief](archive/tasks/AUDIT-D08A.md),
[evidence](test-evidence/AUDIT.md#audit-d08a--protected-external-reload).

## Recovery independent of capture refusals

[ADR 0044](decisions/0044-recovery-independent-of-capture.md), CAPTURE-RECOVERY.
When deferred capture refuses a draft Fountain cannot hold, the capture
boundary still derives a **recovery-only snapshot**: on a never-dispatched copy
of the editor state each refused row is retyped (Dialogue inside a speech,
otherwise Action; an empty row is omitted) until the codec serializes it. The
snapshot keeps the live version, every row's text, BOM/line endings and
protected regions, and is hash-bound like any capture. The original refusal is
rethrown unchanged, so Save, Save As, export, PDF and close still refuse.

The writing session notes that snapshot to the cadence, which journals it on
its normal timers and on explicit Save. The cadence never dispatches a source
save for it and the controller rejects one; status reads "Recovery protected;
file save pending". The next faithful capture resumes source saving. Limits: a
refusal that names no row, or a row whose retype the codec still refuses,
produces no recovery-only snapshot and keeps the earlier paused behavior with
the emergency-copy route.
