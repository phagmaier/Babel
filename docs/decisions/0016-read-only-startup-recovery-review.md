# ADR 0016 — Read-only startup recovery review

Status: Accepted direction. Date: 2026-09-28. Task: M2-05A.
Authority: [SPEC S10.5–10.8](../../SPEC.md#s10), SAVE-03, INV-07/10/20;
[persistence](../persistence-and-recovery.md), [ADR 0013](0013-recovery-checkpoint-journal.md),
[ADR 0015](0015-versioned-persistence-ipc.md).
Evidence: [M2 report](../test-evidence/M2-05A.md).

## Context and decision

M2-05 combined startup adoption, snapshots, backup copies, conflicts and protected
close. Decompose it into A (read-only review), B (explicit choices/source
comparison), C (snapshots/retention/backup) and D (protected close). Parent M2-05
and full M2 exit remain open. A exposes existing recovery without permitting a
writer, choosing a winner or deleting anything.

A native setup hook resolves the OS application data directory. It does not
create the directory or initialize DocumentService. `list_local_recovery` accepts
an empty strict envelope; `read_local_recovery` accepts only a native document
UUID, artifact origin and full canonical checkpoint SHA-256. No frontend path,
registration, source save, export or adoption endpoint is added. Native directory
and file access is anchored and no-follow, requiring owned 0700 directories and
owned single-link 0600 files. A missing store/recovery directory is an empty scan;
unsafe/inaccessible/unavailable state is a visible error, not false empty success.

Scan at most 4096 directory entries and review at most 64 document UUIDs; report
an incomplete list when either cap is reached. Unknown filenames are counted and
left untouched; their text/path is not exposed. The bounded subset is determined
by filesystem enumeration, displayed by UUID, not timestamp. No global discovery
or exhaustive pagination claim is made. Scan only the native private local store
for loose/unsaved drafts. Managed recovery waits for a native-selected source in B.

Read current, previous, pending and previous-pending artifacts independently.
Expose every valid prefix checkpoint, including distinct conflicting generations,
and notices for interrupted/damaged/unsupported/oversized/unreadable/quarantined
material. A pending record is explicitly unconfirmed. Do not infer persistence
receipt delivery or source-file success from any artifact. A malformed artifact
must not hide valid generations in another safely readable artifact. Inventory
is not a global atomic snapshot across concurrent writers.

The selection hash covers canonical checkpoint metadata plus exact source bytes,
so metadata-only changes invalidate a preview request. Re-read and verify the
selected artifact and directory anchors before returning bytes. A missing/changed
selection fails; it never silently substitutes a newer or older generation.
Checksums detect changes, not malicious authenticity. Existing arbitrary-writer
race limits still apply; this read-only flow has no destructive operation.

Both commands use bounded blocking workers and the shared M2-04 job/payload
budget. Reserve 16 MiB per review worker, allowing at most two concurrent review
jobs within 32 MiB, and at most eight jobs across host operations. Existing journal
limits bound individual reads. These logical limits are not a total memory or
latency guarantee: framing/JSON/byte arrays and checksum work add overhead.
A catalog verifies artifacts one at a time; returned summaries contain no author
bytes. No writer leases/lockfiles are created or files rewritten on inspection.

## UI and alternatives

The startup shell presents read-only checkpoint summaries, notices, preview,
Refresh and Inspect Later. Inspect Later only defers this session's UI; a fresh
launch lists the case again. Recover as Current, Save Recovered Copy and Keep
Current File are described as upcoming source-comparison choices, not simulated
working buttons. No restored/saved claim is made, and source opening remains
unavailable. Source files have not been selected or compared in this task.

Render author content only as text. Preserve the native raw payload; display at
most 64 KiB of valid UTF-8 or 4096 raw bytes as hexadecimal for unsupported
encoding. State display truncation explicitly. An incomplete final UTF-8 code
point at the display boundary is withheld rather than replaced. Preview result
identity/schema facts must match the selected candidate; request sequence guards
ignore old results after refresh/deferral/unmount. UI failures use fixed wording,
never arbitrary native/transport strings. Explain that local checkpoints may be
on the same disk and are not an independent backup.

Automatic adoption/cleanup or using timestamps as a winner would violate the
recovery/conflict contract. Requiring a writable registration before inspection
would prevent review of old sessions/unsaved drafts and might create files during
startup. A separate read-only reader reuses the existing checksum/anchor adapter
without widening frontend filesystem privileges. No dependency or capability was
added. Tauri Manager/path and Rustix Dir APIs were checked with Context7 and pinned
local Tauri 2.12.0/Rustix 1.1.4 source.

Evidence still needed: M2-05B named/managed source comparison, explicit adoption,
copy/keep choices and transaction resolution; M2-05C snapshots/retention/external
backup; M2-05D protected close; editor/picker/cadence and full M2 safety exit;
non-Linux/filesystem/power-loss/package and owner pilot evidence. Startup review
is a partial recovery UI, not the complete Local-v1 recovery flow.
