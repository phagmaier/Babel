# ADR 0017 — Explicit recovery choices and external changes

Status: Accepted direction. Date: 2026-09-28. Task: M2-05B.
Authority: [SPEC S10.4/10.5/10.7](../../SPEC.md#s10), SAVE-03/05, INV-07;
[persistence](../persistence-and-recovery.md), [architecture](../architecture.md),
[UX](../ux.md), [ADRs 0012–0016](0016-read-only-startup-recovery-review.md).
Evidence: [M2 report](../test-evidence/M2-05B.md).

Amended 2026-10-03 by [AUDIT-SLP-A](../archive/tasks/AUDIT-SLP-A.md) to remove unused surfaces; historical acceptance evidence remains retained.

Amended 2026-10-04 by [AUDIT-D02](../archive/tasks/AUDIT-D02.md): safe identical-byte
reopen admission and persisted explicit Keep; historical evidence remains retained.

## Context and decision

M2-05A exposed loose/unsaved recovery read-only without selecting a source or
choosing a winner. M2-05B adds explicit choices over a **natively opened**
source: compare a selected recovery checkpoint against the registered anchor,
then Recover as Current, Keep Current File, Save Recovered Copy, or resolve an
interrupted transaction. M4-01 recent-project location confirmation covers a moved or missing source.
Retention, pruning, Save As and protected close remain M2-05C/D.

Comparison reports facts about both generations — recovery version/generation/
hash/length/encoding, source status/fingerprint/hash, byte identity, external
divergence and transaction observation. No timestamp is exposed, so no caller
can pick a winner by clock. Identical content is still reported per generation.

Recover as Current routes the selected recovery bytes through the standard
M2-03 recovery-first transaction as a new, strictly newer version: recovery
protection, independent previous copy, exclusive candidate, verified atomic
replacement and exact `sourceFile` receipt. The previous source copy and the
recovery journal are both retained; nothing is deleted to resolve.

The older-session journal gate reconciles at native open only with exclusive
ownership, a clean latest published generation, identical source bytes and
NoTransaction or ConfirmedRecordMatchesSource. Pending/quarantined/damaged
journals, interrupted save intents, uncertain saves and lost ownership refuse
the fast path. Source/recovery/leases are revalidated before admission; no file
receipt is inferred. Content hashes, rather than inode/ctime, define divergence.

Recover remains an explicit newer-version transaction. Keep preserves source
and journal bytes and publishes private decision metadata: schema, document UUID,
canonical latest-record hash and source hash. Its unique candidate is exclusively
created, synced, verified and atomically published; directory/source/recovery and
ownership are rechecked before success. Reopen accepts that exact decision only
under fresh clean journal/ownership and transaction inspection. Changed source or latest record
invalidates it. Failures leave this registration unresolved; pending marker bytes
are retained. No journal retirement, descendant auto-adoption or timestamp winner.

AUDIT-D02 distinguishes a prior confirmed record whose source later changed
from an unresolved replacement: only an explicit reviewed Keep may bind that
source when no intent, previous-pending copy or candidate remains. Identical-byte
automatic admission still requires NoTransaction or ConfirmedRecordMatchesSource.
A verified latest checkpoint from the current registration needs no older-session
choice. Exporting a standalone copy does not resolve a pending review; successful
Save As adoption switches to a fresh identity without carrying the old gate.

The writing surface waits for discovery before enabling editing. True divergence
gets one primary latest-generation plain choice; older candidates remain behind
Inspect. Inspect Later permits read-only navigation; emergency copying remains
available for malformed recovery or a missing source. Successful choices unlock
editing; resolving an older save alone cannot choose a newer divergent journal.

Save Recovered Copy writes the exact recovery bytes — including malformed
UTF-8 that adoption correctly refuses — to an exclusively created,
synced and verified sibling file beside the source. Only the new file name,
never a path, crosses IPC. It works even when the source is missing or
unreadable, and it never advances a baseline or consumes a queue slot.

Finalize completes only the two safe post-replacement states
(`InstalledCandidateUnconfirmed`, `ConfirmedRecordMatchesSource`) by verifying
installed bytes/mode/owner/links, the independent previous copy, and
publishing the confirmed record before advancing the baseline and clearing
uncertainty. Every other observation — including `Prepared` — returns
unchanged with no receipt; prepared-intent cleanup is M2-05C pruning, not an
automatic delete here. A second unresolved corruption still blocks, exactly as
in M2-02/M2-03.

The unused native-only in-session relink capability was removed in AUDIT-SLP-A.
Moved-source continuity uses M4-01 explicit locate/confirm on a new registration;
live registrations cannot be re-anchored. Managed/loose identity, ownership,
recovery and stale-token guards remain in that path. Unsaved Save As is separate.

## IPC, UI and alternatives

Five strict path-free commands operate on the writer host with bounded
blocking workers: `compare_recovery`, `recover_checkpoint_as_current`,
`keep_current_source`, `save_recovered_copy`, `resolve_save_transaction`.
Unknown fields — including nested identity/fingerprint fields and any path —
are rejected. The production writer host stays uninitialized until native
picker integration, so these commands honestly report `nativeUnavailable`
there; New/Open remain disabled. No dependency, capability, picker dialog, or
general filesystem endpoint is added: "native-selected" means the source is
the `open_selected` registration anchor, never a frontend string. Production
picker wiring belongs to a later task, not to this safety foundation.

The `RecoveryChoicePanel` renders comparison facts, fixed transaction/source
wording, an explicit new-version input, and the four actions with stale
guards: results must match the requested identity/selection, late responses
are ignored, and failures use fixed wording plus the closed-vocabulary error
code — never transport text. Adoption stays disabled on divergence, stale
comparisons, unreadable transactions, or missing sources; only the emergency
copy remains available then. Timestamps never appear in the UI.

An automatic winner, timestamp ordering, silent retry of a stuck transaction,
or deleting prepared/quarantined material to look healthy would violate the
recovery/conflict contract and are rejected. Requiring a writable
registration before inspection would have prevented review of old sessions;
comparison therefore also works on view-only registrations, while adoption
and finalize require exclusive ownership.

Evidence still needed: M2-05C snapshots/retention/prepared cleanup/external
backup destination and Save As; M2-05D protected close; production picker and
editor integration; non-Linux/filesystem/power-loss/package and owner pilot
evidence. Same-disk sibling copies are not disaster backups, and advisory
leases still cannot exclude arbitrary external writers between check and
rename.
