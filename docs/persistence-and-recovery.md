# Persistence and recovery

Status: M1-04 Linux replacement proof and M2-01 native identity/open boundary exist; M2-02 native recovery framing/publication exists; production source saving and startup UI remain planned. [SPEC S10](../SPEC.md#s10); SAVE-01–05, INV-04–08/10/20.

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
Locks are never unlinked. M2-02 adds native recovery checkpoints; no source-file acknowledgement, automatic
reload, Save As or protected close is implemented. `release_open_document`
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
choice/adoption/retention flows remain M2-05, save queues M2-03 and IPC/UI
acknowledgement state M2-04. Checkpoint work must run outside the typing path
when native/UI integration is added. [M2 evidence](test-evidence/M2.md#m2-02--recovery-checkpoint-format)
records failure/property/restart/SIGKILL tests and measured growth/latency.
