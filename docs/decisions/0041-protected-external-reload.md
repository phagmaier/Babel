# ADR 0041 — Protected external Reload

Status: Accepted direction; Accepted. Date: 2026-10-03. Task: AUDIT-D08A.
Authority: [SPEC S10.7/S10.8](../../SPEC.md#s10), SAVE-05, INV-05/07/10/20.
Extends [ADR 0017](0017-explicit-recovery-choices.md); [brief](../archive/tasks/AUDIT-D08A.md).

## Decision

Handle-only native checks use the retained no-follow source anchor, private-store
and document/inode leases, safe metadata and managed identity checks. Native
window focus and five-second frontend polling request advisory checks; hashes
and complete fingerprints identify self-writes, rather than a timing window.
Only one comparison buffer is outstanding. Reads and metadata re-anchors share
the frontend save FIFO and the native service mutex. The existing pre-write
fingerprint guard remains authoritative; no OS watcher dependency is added.

Identical content with changed metadata may re-anchor the native baseline and
transfer the inode lease without a prompt. Its observation carries no saved
version or protection receipt. Frontend protection versions stay unchanged. Exact-version recovery retries retain
the immutable frame's original baseline; newer versions use the rechecked baseline.
A later explicit same-version Save must still sync/revalidate before issuing
a fresh receipt for the current disk fingerprint.
A changed source is offered for explicit comparison/Reload, including when the
editor is dirty. Keep editing retains source-write blocking; Save As and export
provide independent copy routes. New or read-only registrations gain no write
or Reload authority. Missing/unsafe/unreadable sources show attention and keep
independent recovery/copy routes available.

Reload binds both editor captures, the old native baseline and the exact reviewed
disk fingerprint. Before editor adoption, native code checkpoints the old live
draft, writes its pre-destructive snapshot and safety revision, checkpoints the
prepared new editor version, syncs the source/directory and rechecks the disk.
It acquires any new inode lease before protection and only publishes the baseline
and exact source receipt after validation. Source bytes are never replaced by
Reload. Ordinary history calls retain full baseline validation; the private
Reload history helper validates document/store leases and only records the exact
journaled draft, after the Reload caller has checked the reviewed disk generation.

The frontend prepares and freezes a single Undo-able source import before the
native call and validates the receipt before applying it. Undo creates a newer
edit, needing its own checkpoint/save. Protection failures or stale review stop
adoption and retain artifacts. Failed/uncertain Reload skips the reserved native
version without changing content/selection/Undo and independently checkpoints
the retained draft, so a later native recovery frame cannot block new protection. If native adoption
succeeds but frontend adoption fails, the old live editor and pre-Reload protections
remain available; later writes fail safely against the stale frontend baseline.

## Limits and evidence still needed

[Audit evidence](../test-evidence/AUDIT.md#audit-d08a--protected-external-reload)
records bounded Linux tmpfs/Btrfs verification and any failures. Polling is
advisory detection, not a lossless event stream; hidden windows wait until focus
or visibility resumes. Advisory leases cannot exclude arbitrary external writers
after the final check. This neither promises third-party sync compatibility nor
closes C1/F2, actual storage power-loss, other target adapters or Local v1 admission.
