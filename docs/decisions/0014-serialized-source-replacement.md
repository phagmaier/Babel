# ADR 0014 — Serialized native source replacement

Status: Accepted direction. Date: 2026-09-28. Task: M2-03.
Authority: [SPEC S10/S15](../../SPEC.md#s10), SAVE-01, INV-04/05/07;
[persistence](../persistence-and-recovery.md), [ADR 0010](0010-linux-durable-replacement.md),
[ADR 0012](0012-native-document-identity.md), [ADR 0013](0013-recovery-checkpoint-journal.md).
Evidence: [M2 report](../test-evidence/M2-03.md).

## Decision

Each native registration owns an immutable FIFO. Admission validates opaque
identity/session, positive JavaScript-safe version, UTF-8, 16 MiB source bound,
native SHA-256, bounded draft metadata and the current native disk fingerprint.
The service globally bounds pending requests to eight and source-plus-serialized
metadata to 32 MiB. Reserve 2 KiB of the recovery metadata bound for native
transaction envelopes. Versions remain ordered after a failed attempt; only
identical version/content/metadata may be retried when no queued successor exists.
Admission is not a persistence receipt. No timer, coalescer or IPC worker is
added here; M2-04 must dispatch this blocking native work off the typing path.

Admitted successors can share a baseline when submitted before the first save
completes. Execution uses the baseline advanced only by a confirmed native
predecessor. An expected fingerprint supplied after admission cannot adopt an
external generation. The immutable initial open snapshot stays unchanged.
`&mut DocumentService` serializes checkpoint, queue, source and release methods;
there are no overlapping native writers within a service.

Execution first obtains the exact recovery-only receipt. Native fingerprint,
permissions, directory anchors, project identity and stable leases gate source
replacement. External divergence leaves the external source and initial snapshot
intact, with local content in independent recovery. An already newer checkpoint
can reject an older pending save; it is never overwritten to make that save run.
A later queued request may still protect/save the newer version. IPC/cadence and
stale-result handling belong to M2-04.

## Transaction and success boundary

Managed transactions live in `.screenwriter/source-save/<document UUID>/`;
loose transactions live in private app data under the same relative layout.
Directories are 0700; auxiliary files are owned single-link 0600 regular files.
Access is descriptor-relative and no-follow. Files are:

- `intent`: one schema-1 recovery frame containing exact requested source,
  identity/session/version/hash, recovery generation, actual native base disk
  fingerprint and draft metadata `{schemaVersion: 1, candidateName, draftMetadata}`.
  The frame checksum covers the native transaction metadata too. `candidateName`
  is strictly `.babel-save-<canonical UUID>`, never a path from a caller.
- `previous-pending` then `previous`: independently written, synced and
  byte-verified old source. It is not a hard link or a Git dependency.
- `confirmed`: the intent frame renamed only after source replacement,
  source-directory sync and exact verification. Its presence does not prove
  receipt delivery; final auxiliary-directory sync/reverification can still fail.

Commit intent before creating any source temporary file, so a partial intent
cannot leave an untracked application-created candidate. Commit the independent
previous copy before exclusive same-source-directory candidate creation. Handle
partial writes, sync/verify candidate and its directory entry; preserve ordinary
owner/group/mode or fail before replacement. Acquire the candidate inode lease
before rename. Recheck source, transaction directory, identity and leases; rename
over source without unlinking it. Sync the source directory, verify installed
inode/bytes/hash/mode/owner/group and independent previous/intent bytes; publish
and sync confirmed metadata and reverify. Only then advance baseline/lease and
return the exact `sourceFile` receipt with a separate recovery receipt. An exact
duplicate performs fresh recovery/file/directory sync and validation without
replacing the source again.

Any error before rename is `sourceUnchanged` by this operation (external writers
may still change disk). Any error after rename is `replacedButUnconfirmed`;
retain both inode leases, the old baseline and all artifacts, issue no save
receipt, and block further replacements/relinquishment. Independent raw
checkpoint protection remains available. Queued requests also prevent bare
registration release; this guard is not the full M2-05 protected-close protocol.

## Restart, alternatives and limits

Read-only inspection reports intent/confirmed frames, raw previous/pending and
candidate bytes, and source observations: prepared, installed but unconfirmed,
confirmed record matches source, divergence or attention. Partial candidates
are exposed as bytes, never promoted. Corrupt/future/oversized/unsafe/unresolved
artifacts are retained and block replacement. Inspection does not choose a
winner, restore, acknowledge an editor or automatically retry. Missing-source
relinking and explicit resolution/cleanup remain M2-05. Older-session recovery
continues to block writes until that adoption protocol exists.

Normal transaction storage is one confirmed frame plus one previous raw source.
At most two frames, two raw predecessor files and one same-directory candidate
are application-created per unresolved transaction: `2 * MAX_FRAME_BYTES +
3 * MAX_SOURCE_BYTES`, excluding source, recovery and identity/lock entries.
Backpressure blocks accumulation rather than deleting unresolved writing.

No new engine/dependency/permission capability is introduced. Existing recovery
framing avoids a second transaction codec; a raw previous source keeps the safety
copy portable. Ordinary owner/group/mode preservation is supported; any listed
source/candidate ACL or xattr is rejected to avoid silent metadata loss. Current
rustix `openat`, `renameat`, `fchown`, `fchmod` and `flistxattr` APIs were checked
using Context7's [primary source](https://github.com/bytecodealliance/rustix/blob/main/src/fs/at.rs)
and pinned local 1.1.4 source. No in-place overwrite/delete-and-rename fallback.

This remains Linux-only on tested tmpfs/Btrfs. Advisory leases and final checks
cannot exclude arbitrary external writers between check and rename. SIGKILL
leaves kernel caches alive; it is not hardware power-loss proof. No ACL/xattr
preservation, sync-folder/network filesystem, other-platform or installed-package
support claim is made. Git history failure isolation is independently tested in
M1; production history integration is M2-06.

M2-04 typed worker IPC and stale-receipt state are recorded in [ADR 0015](0015-versioned-persistence-ipc.md).

Evidence still needed: editor save scheduling/coalescing and native UI integration;
M2-05 startup choice/adoption, transaction cleanup, retention, Save As and
protected close; M2-06 history integration/full safety exit; Tier 1 filesystem,
platform/package and owner pilot evidence. Linux-only support and startup UI
remain open product gates.
