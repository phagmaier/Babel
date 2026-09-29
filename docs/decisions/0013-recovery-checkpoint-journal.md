# ADR 0013 — Framed recovery with bounded journal rotation

Status: Accepted direction. Date: 2026-09-28. Task: M2-02.
Authority: SPEC S03/S10/S15; SAVE-03, INV-04/06.
Evidence: [M2 report](../test-evidence/M2-02.md).

## Decision and format

Use coalesced complete-source snapshots at the native checkpoint boundary;
do not introduce patch replay. Debounce/queue/IPC integration is later work.
Every record contains exact raw source bytes and JSON draft metadata, so
incomplete elements, meaningful whitespace and malformed UTF-8 remain
protectable independently of parser/Script Check or source-file divergence.

Schema 1 frame, all numeric header fields little-endian:

| Bytes                | Field                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 0–7                  | `BBLREC01` magic                                                                                                   |
| 8–11                 | u32 schema version, currently 1                                                                                    |
| 12–15                | u32 JSON metadata byte length                                                                                      |
| 16–23                | u64 source byte length                                                                                             |
| Next metadata length | UTF-8 JSON: `documentId`, `sessionId`, `version`, `generation`, `sourceSha256`, `baseFingerprint`, `draftMetadata` |
| Next source length   | Exact uninterpreted source bytes                                                                                   |
| Final 32             | SHA-256 of header + metadata + source                                                                              |

Document/session UUIDs are canonical and non-nil. Version/generation must be
positive and at most 2^53−1. Source is limited to 16 MiB, complete metadata
JSON to 64 KiB. Native code verifies source SHA-256 even after verifying the
whole-frame checksum; neither is an authenticity signature. A reader validates
lengths before allocating source, retains the valid prefix and stops at a
torn/corrupt/unknown/oversized tail. It never resynchronizes through unknown
bytes or skips a record to guess a later winner. Unknown draft keys survive;
unknown newer frame schemas block writing and remain available unchanged.

## Publication, failures and restart

Managed recovery lives in `.screenwriter/recovery/`; loose/unsaved recovery in
the private native app-data `recovery/` directory. Names are validated document
UUID plus `journal`, `previous`, `pending`, `previous-pending` or `quarantine`.
Directories are 0700; owned single-link regular files are 0600; access is
descriptor-relative and no-follow. Existing unsafe files are never replaced.
Unsaved registration acquires a stable document lease before the first write.

Checkpoint publication is serialized and protected by a recovery lease.
Prepare the two-record candidate (last valid + requested snapshot), exclusively
write, sync and verify it. Before replacing the current journal, independently
write/sync/verify the previous valid checkpoint, publish it and sync the
directory. Then atomically publish the candidate, sync the directory, recheck
identity/leases/directory and verify exact bytes. Only then return the exact
session/version/native hash/generation receipt, tagged `recoveryCheckpoint`.
No source save or receipt is issued. Older same-session versions and same-version
different content/metadata are rejected; exact duplicates require fresh sync
and verification. Named records carry the registered native base disk fingerprint; unsaved records use null. The base remains the open generation while source saving is absent; M2-03 must advance the native disk baseline after confirmed saves. Native immutable snapshots are not a second live editor.

A corrupt/torn journal's full bytes are exclusively copied, synced and
verified to quarantine before repairing the active file. Unknown schema or
oversized bytes are never replaced with a bounded/truncated copy. One
quarantine is retained; a second unresolved corruption blocks further rotation.
Partial/verified pending files are retained and cause attention rather than
automatic deletion/retry. Failures after publication remain errors, even if
restart can read the newer record. Inspection distinguishes published records
from candidates and never proves that an acknowledgement reached the caller.
Overlapping generations with different content are a conflict, not a timestamp
choice. Older-session recovery blocks new-session writes until the M2-05
reconciliation workflow explicitly protects/adopts both versions.

Normal storage is two active frames plus one predecessor (at most 3 frame
bounds). Including both pending files and quarantine, application-created
artifacts are bounded by 8 frame bounds per identity; backpressure preserves
unresolved failures rather than deleting writing. Global orphan-draft retention
and cleanup are M2-05. Same-disk copies are not independent disaster backups.

## Alternatives and evidence limits

An append-only journal would grow with a long drafting session; in-place
truncation/patch replay would complicate torn-write safety and source offsets.
The selected rotation uses tested Linux same-directory replacement and native
directory sync, without a database or new dependency. Current rustix APIs were
checked through Context7's [source documentation](https://github.com/bytecodealliance/rustix/blob/main/src/fs/at.rs);
behavior is tested against the pinned crate. Tests use owned synthetic tmpfs
and Btrfs files, injected errors and actual SIGKILL; these do not establish
hardware power-loss guarantees, ACL/xattr/network filesystem semantics or
non-Linux support. Advisory ownership cannot exclude arbitrary external writers.

Evidence still needed: M2-03 source replacement/queue integration; M2-04
checkpoint IPC/UI stale-receipt handling and cadence; M2-05 startup choices,
pending/quarantine resolution, recovery adoption/retention and protected close;
M2 safety exit, native WebView and Tier 1 platform/package evidence.
