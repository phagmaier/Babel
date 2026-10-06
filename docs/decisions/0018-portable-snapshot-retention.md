# ADR 0018 — Portable snapshots and conservative retention

Status: Accepted direction. Date: 2026-09-28. Task: M2-05C.
Authority: [SPEC S10.6–10.8](../../SPEC.md#s10), SAVE-04, INV-04/07/10/20;
[persistence](../persistence-and-recovery.md).
Evidence: [M2 report](../test-evidence/M2-05C.md).

## Decision

Use the existing Linux native authority and dependencies, independently of
recovery framing and Git history. Managed snapshots live under
`.screenwriter/snapshots/<document UUID>/`; loose/unsaved snapshots under the
private native app-data `snapshots/<document UUID>/`. Directories are owned
0700; files are owned, single-link 0600 regular files. Anchored no-follow access,
held document ownership and directory revalidation gate mutation. Inspection
also works for registered view-only sources. No native/frontend path endpoint
or additional dependency/capability is introduced.

Each SHA-256-named `.fountain` blob is exact raw source bytes, including BOM,
CRLF, whitespace and malformed UTF-8, and is readable without this application.
Multiple records may share a verified blob; no hard links or normalization.
Immutable `<snapshot UUID>.json` schema-1 envelopes contain a record and the
SHA-256 of its serialized record. Records bind document/session IDs, optional
actual editor version, native creation seconds, kind, optional name, source hash
and length. A disk safety copy has a null version because native code cannot
infer an editor version from disk. Names are literal author text, 1–80 Unicode
scalars without controls. Whole-record hashes bind selections; timestamp changes
cannot switch the selected generation. Hashes detect changes, not authenticity.
Unknown/future/damaged material stays intact, reports attention and blocks writes
and pruning, while independently verified entries remain inspectable.

Publication exclusively writes/syncs/verifies `pending.json` first, then
`pending.fountain` if needed. Publish the blob with `NOREPLACE`, sync its directory
and verify exact bytes before publishing the record with `NOREPLACE`. Final
directory sync, anchors and record/blob verification precede a snapshot receipt.
A failure has no receipt even if an entry is readable after restart. Fixed pending
files and orphan blobs remain visible and block further maintenance; no automatic
promotion, deletion or retry. The current source and recovery never depend on
snapshot publication succeeding. Snapshots have no source-save/recovery credit.

## Retention and cap

The headless caller may request changed rolling snapshots at most once per five
minutes; unchanged latest rolling content adds no record. Retain the newest
snapshot, all named and pre-destructive snapshots, future-clock records, the
newest rolling record per five-minute bucket for one hour, hourly bucket through
48 hours and daily bucket through 30 days. Clock rollback conservatively retains
future records. This refines SPEC's suggested defaults without changing its
requirements. Scheduling after confirmed/coalesced edits belongs to the future
editor/controller; the development shell has no manuscript scheduler.

Admission caps each document at 256 records and 256 MiB of distinct source bytes,
plus at most two fixed pending artifacts; record overhead is at most 4 KiB each.
Deduplicated named records still count toward the record cap. Reaching a cap
returns a visible `snapshotLimit` failure and never removes protected versions.
**Amended 2026-10-06 (M6-03):** when a _rolling_ snapshot hits a cap, the save
cadence runs this retention policy once through the ordinary prune guard and
retries the snapshot once; any refusal leaves the visible attention state.
Named/pre-destructive cap failures, ENOSPC and other errors never prune. There is no global cross-document reclamation or protected-version
delete endpoint. These limits are implementation defaults, not a disk quota.

Explicit retention refuses incomplete/damaged snapshot inventories, unresolved
recovery/transactions, older unreconciled sessions, queued/uncertain saves,
external divergence and invalid ownership/anchors. Before each deletion it checks
native available space (at least 64 MiB) and verifies the unchanged inventory and
survivors. Unlink only an expired rolling record, sync that deletion, verify the
remaining records, then unlink its blob only if unreferenced; sync again. Never
prune recovery/previous source/history/identities/locks. Failure or SIGKILL may
leave an orphan blob requiring inspection, but never a retained record pointing
to an intentionally deleted blob. Free-space observations do not prove quotas or
prevent concurrent disk consumption; an I/O error stops maintenance immediately.

## Restore and explicit copies

Restore accepts an exact snapshot selection, current immutable live bytes and
expected native disk fingerprint. Refuse unsafe encoding for a source replacement,
non-newer versions, divergence, queued/uncertain saves or unresolved recovery.
First checkpoint the current live version; independently snapshot both live and
disk bytes as protected pre-destructive records, then use the existing serialized
recovery-first writer for the selected bytes as a newer version. Live bytes stay
with the caller until the exact source receipt. M2-05B recovery adoption also
protects a disk snapshot before replacement. Git safety revisions remain M2-06;
this API does not claim a curated revision or complete Local-v1 restore UI.

After explicit native folder selection, retain an opaque capability bound to that
registration and session, with a no-follow directory descriptor. Revalidate path,
ownership, write/search permissions and plain metadata on each copy. IPC accepts
only that token plus immutable raw bytes/version/hash, never a path. Write a unique
pending file, sync/verify, exclusively publish a unique `.fountain`, sync the
selected directory and reverify before a copy receipt. Existing files are never
overwritten. Removed/substituted destinations fail; partial/unconfirmed copies
remain available for inspection. Copies work independently of local recovery,
snapshots, source divergence or read-only ownership. Release revokes the tokens.

Same device means the same filesystem; a different device **does not establish a
different physical disk**. Both facts have explicit UI wording. Copy failure never
changes local save/recovery status or destination silently. No configured recurring
backup, production picker, Save As/relink, or remote upload is added.

## Alternatives and limits

A database/packed archive would reduce source readability; duplicate raw files
would waste space; a mutable global manifest would introduce another replacement
engine. Immutable records make pruning local and conservative, at the cost of
bounded scans and explicit attention after interruption. No background job runs
on typing or tries to free the last protection path under pressure.

Native workers use the existing serial service mutex and logical job/byte budget.
Restore reserves all 32 MiB; other snapshot/copy workers reserve 16 MiB. Temporary
buffers/transport parsing add overhead, so this is not a peak-memory guarantee.
Scans stop at 1024 entries and verify one blob at a time. Linux tmpfs/Btrfs native
and real WebKit evidence is separate from injected UI/MockRuntime checks.

Context7 resolved Rustix and supplied its [descriptor-relative API source](https://github.com/bytecodealliance/rustix/blob/main/src/fs/at.rs);
pinned local Rustix 1.1.4 signatures and behavior were checked. Context7 also
supplied React's [effect cleanup](https://react.dev/reference/react/useEffect)
for stale async UI results. No dependency/packaging policy changed.

M2-05D protected close and M2-06 curated safety revisions/headless Linux exit
now have bounded evidence. Evidence still needed: production editor/picker/cadence
and full restore/backup workflows;
explicit interrupted-artifact repair, configured backup/global quota/manual
protected-version deletion if later required; other platforms/filesystems,
power loss, physical-disk identification, installed/offline adoption and owner pilot.
