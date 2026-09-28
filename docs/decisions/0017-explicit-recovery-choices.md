# ADR 0017 — Explicit recovery choices and external changes

Status: Accepted direction. Date: 2026-09-28. Task: M2-05B.
Authority: [SPEC S10.4/10.5/10.7](../../SPEC.md#s10), SAVE-03/05, INV-07;
[persistence](../persistence-and-recovery.md), [architecture](../architecture.md),
[UX](../ux.md), [ADRs 0012–0016](0016-read-only-startup-recovery-review.md).
Evidence: [M2 report](../test-evidence/M2.md#m2-05b--explicit-recovery-choices-and-external-changes).

## Context and decision

M2-05A exposed loose/unsaved recovery read-only without selecting a source or
choosing a winner. M2-05B adds explicit choices over a **natively opened**
source: compare a selected recovery checkpoint against the registered anchor,
then Recover as Current, Keep Current File, Save Recovered Copy, or resolve an
interrupted transaction. Safe relinking covers a moved or missing source.
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

The M2-02 older-session journal gate stays closed for ordinary checkpoints and
saves. Only an explicit choice reconciles it, and only in memory for the
current registration: Recover adopts with a newer version, Keep verifies both
generations unchanged and records the choice without writing. A restart
requires a fresh choice; reconciliation is never persisted. Keep writes
nothing, so its disk state is byte-identical before and after.

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

Relinking is native-only, like `open_selected`: the caller supplies the new
location inside Rust and no IPC path exists. Managed continuity requires the
same project identity, loose moves link the same document ID (conflicting
records fail with `SaveConflict`), and the target must support exclusive
ownership. A rename preserves the inode, so the held source lease is verified
rather than re-acquired against itself. The old file is never deleted.
Unsaved Save As belongs to M2-05C, not relinking.

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
comparison therefore also works on view-only registrations, while adoption,
finalize and relink require exclusive ownership.

Evidence still needed: M2-05C snapshots/retention/prepared cleanup/external
backup destination and Save As; M2-05D protected close; production picker and
editor integration; non-Linux/filesystem/power-loss/package and owner pilot
evidence. Same-disk sibling copies are not disaster backups, and advisory
leases still cannot exclude arbitrary external writers between check and
rename.
