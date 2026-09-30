# ADR 0026 — Production writing lifecycle session coordination

Status: Accepted direction. Date: 2026-09-29. Task: M3-12. Authority: [SPEC S07/S08.6/S10](../../SPEC.md#s07); SAVE-01–05, DOC-01/02, SEC-02. Related: [ADR 0015](0015-versioned-persistence-ipc.md), [ADR 0017](0017-explicit-recovery-choices.md), [ADR 0018](0018-portable-snapshot-retention.md), [ADR 0019](0019-protected-close-lifecycle.md), [ADR 0024](0024-native-document-entry.md), [ADR 0025](0025-save-as-identity.md).

## Decision

One `WritingSession` binds the sole editor owner to persistence, cadence and
protected close. The native services select paths and own publication. The
frontend sends only the strict checkpoint fields, never editor-internal capture
objects. Coalesced deferred captures drain before frozen lifecycle operations;
completed cadence operations refresh the visible version facts.

Open does not auto-save. Its initial editor version is above all discovered
recovery versions for the selected native registration, including managed
project journals outside the private startup catalog; this is sequence allocation, not a content
winner. Older-session recovery still requires explicit Keep Current File or
Recover as Current. Explicit Save performs a fresh native flush.

Save As selects a destination before freezing input, then captures/protects the
latest draft, publishes exact bytes, drains native work, prepares fresh adoption
and then releases the old registration. Selection uses actual editor
positions and the rebuilt editor establishes a new undo boundary. Cancellation
or publication failure retains the active editor. An unused new registration is
released if retiring the old one fails; its standalone file remains preserved.
Old copy tokens and recovery selections are cleared on successful switching.

Recovery and snapshot restore freeze the editor and protect its latest bytes in
a verified pre-destructive snapshot before changing disk. Previewed bytes and
exact native receipts return through the coordinator. Identity, hash, length,
version and receipt shape are checked before editor mutation. The imported
transaction may advance to a later native version and remains one Undo step.
The frozen editor prepares the exact replacement capture before native
publication. Replacement metadata belongs to those new bytes, never the former
source. Source-hash-verified sparse drafting intent and caret metadata are
restored conservatively; stale or malformed metadata is ignored.
Only validated adopted receipts can re-anchor a blocked native baseline; normal
saving retains all existing availability guards. An older confirmed native resolution updates only the fingerprint baseline;
newer live edits receive no saved/recovery credit. Same-version mismatches fail
visibly. Failed protection prevents replacement.

The view rejects document/selection transactions while frozen or without native
write ownership, including commands and paste; `editable=false` alone is
insufficient. Active composition refuses a lifecycle switch until finished.
Close drains cadence, captures the frozen latest version and uses the existing
retry/copy/risk coordinator. A risk choice is bound to its displayed version and
is invalidated by changing live/protection state. Window-close intent returns to
the native window only after release. F6 reaches enabled screenplay actions;
the close panel focuses its retry button. The same shortcut registry serves
editor, controls and shell so remapping reaches application actions.

The app-data directory created by Tauri is narrowed through a no-follow,
uid-owned directory descriptor before initializing the strict native store.
The restriction adds no permission bits. Unsafe/foreign roots leave entry
unavailable. Native filesystem tests cover restriction/refusal on tmpfs/Btrfs.

## Tradeoffs

Save As rebuilds editor history at an explicit identity boundary. Restore and
recovery retain an undoable replacement transaction. Staged import text survives
source autosaves; its protection boundary reads the current native fingerprint
without recreating the panel. The default desktop has no revision timeline;
normal source and emergency-copy saving do not depend on history. Import and
recovery may require an existing native safety revision and refuse replacement
if that protection fails. No history failure grants permission to discard text.

External divergence remains visible and preserves the disk source plus the live
journal. Retry never chooses a winner or guesses a baseline. A verified emergency
copy can permit close without granting source-save credit. Same-filesystem copies
remain accurately labeled. Full home/recents and revision navigation remain later
milestones.

## Evidence still needed

[M3-12 evidence](../test-evidence/M3.md#m3-12--production-writing-lifecycle-and-failure-ui)
records original bounded Linux task gates and omissions; the
[audit correction evidence](../test-evidence/M3.md#repository-audit-corrections)
records the later lifecycle corrections. Independent M3-13 exit re-review, full home/recents workflows (M4), production
revision timeline (M6) and remote transfer (M7) remain open.
