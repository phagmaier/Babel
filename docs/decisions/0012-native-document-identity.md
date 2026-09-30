# ADR 0012 — Native document identity and conservative open

Status: Accepted direction. Date: 2026-09-28. Task: M2-01.
Authority: SPEC S03/S04.4/S05/S10/S14; DOC-01/03, SAVE-05, SEC-02.
Evidence: [M2 report](../test-evidence/M2.md).

## Decision

The headless native `DocumentService` owns opaque random UUID handles, document
IDs and per-open session IDs. Native selection calls `open_selected`; it takes
an absolute path only inside Rust. Frontend IPC exposes `read_open_document`
and `release_open_document`, with a strict identity envelope and no path or
write endpoint. The production host stays uninitialized until native selection
is integrated; New/Open remain disabled. Release is relinquishment of a
headless registration, not the future editor's protected close flow.

Linux opens each directory component without following symlinks and retains
the source parent descriptor. It bounds reads, rejects nonregular files,
compares native inode/generation metadata around reads and retains exact raw
bytes plus SHA-256. Neither Fountain interpretation nor UTF-8 replacement is
performed. The initial snapshot is immutable, not a second editor authority.
Malformed UTF-8, unsafe permissions, hard links, foreign owners, read-only
sources, invalid/newer project metadata and ownership contention cannot obtain
an exclusive lease. Inaccessible/missing/nonregular/oversized sources return
structured errors without manuscript/path details.

Schema 1 managed metadata uses `schemaVersion`, `projectId` (canonical non-nil
UUID), `sourceFilename` (one relative filename), and `pdfProfile` (string).
Unknown fields survive because open never writes metadata. An unrelated file
beside an existing managed source gets a loose identity. If the declared source
is missing, the selected file retains the managed identity as a **view-only
mapping candidate**; an explicit later workflow must resolve a rename versus
an unrelated source. No guessed rename is written back.

Loose identity records in a private native app-data directory have schema 1
and `documentId`. The record filename hashes the normalized absolute native
path; the ID itself is random and survives changes/replacement at that path.
Copies at another path get new IDs. Entries contain no manuscript text,
credentials, remote linkage or absolute paths. Exclusive creation, file sync
and directory sync precede returning a persistent loose identity. Corrupt,
truncated, newer or unsafe registry entries are left intact and the source
opens under an ephemeral view-only identity. Open creates no source/project
auxiliary files. The registry is not recovery storage.

Stable app-data lock inodes provide nonblocking cooperating leases for both
source device/inode and document UUID. Duplicate managed IDs at different
paths cannot both be owned within the same store. Release explicitly unlocks
and never deletes a lock file. Native `validate_owner` rechecks store/lock
identity, source path/fingerprint/permissions and managed identity before a
future operation; it performs no write and provides no save receipt.

## Alternatives, costs and limits

A frontend path API would widen native authority; content-derived IDs would
change with edits; locking only the source inode would lose meaning when it
is replaced. The chosen separation supports M2 recovery/save integration.
Limits are 16 MiB per source, 16 KiB per metadata record and 32 registrations
(at most 512 MiB of retained source payload, excluding transient copies).
Stable registry/lock entries are not pruned during open; future cleanup must
never remove an active lock or unresolved identity/recovery association.

This adapter is Linux-only; other hosts return native unavailable. Symlinked
paths are conservatively rejected rather than resolved. Ordinary owner/mode
checks do not establish ACL/xattr, network-filesystem or power-loss semantics.
Advisory leases require a shared app-data store and cooperating writers;
arbitrary external writers can still race a check. An unsaved registration
allocates identity immediately but has no recovery checkpoint yet. Save As,
loose-file moves/relinking, persistent duplicate-project resolution, managed
metadata creation/upgrades and native picker UI remain later tasks.

Direct runtime pins reuse serde/JSON/SHA-256/UUID; rustix 1.1.4 is a small
memory-safe syscall adapter, not another persistence engine. Context7's
[rustix source](https://github.com/bytecodealliance/rustix/blob/main/src/fs/at.rs)
and [Tauri state documentation](https://v2.tauri.app/develop/state-management/)
informed the APIs; behavior is tested against pinned local libraries.
Exact locked license metadata and packaging limits are in
[development](../development.md#dependencies-and-licensing).

Evidence still needed: M2-02 recovery framing/restart and unsaved protection;
M2-03 serialized replacement and lease transition; M2-04 versioned receipts;
M2-05 startup/close/Save As/ownership resolution; native picker/WebView open
integration and Tier 1 filesystem/platform/package evidence. No Local v1
requirement or full M2 safety exit is complete.

M4-01 follow-up: [ADR 0028](0028-native-recent-projects.md) implements explicit
closed-document native locate/identity linking and managed rename confirmation.
Ordinary open retains this ADR's conservative no-guessed-rename policy.
[M4 evidence](../test-evidence/M4.md#m4-01--native-recents-and-missing-file-selection)
records the bounded Linux gate; other platform/adoption limits remain open.
