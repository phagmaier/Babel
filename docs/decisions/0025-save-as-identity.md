# ADR 0025 — Save As publication with fresh loose identity

Status: Accepted direction. Date: 2026-09-29. Task: M3-11. Authority: [SPEC S05.1–S05.3/S08.6/S10](../../SPEC.md#s05); SAVE-01–03/05, DOC-01/02, SEC-02. Related: [ADR 0012](0012-native-document-identity.md), [ADR 0014](0014-serialized-source-replacement.md), [ADR 0018](0018-portable-snapshot-retention.md), [ADR 0024](0024-native-document-entry.md).

## Decision

Save As publishes caller-supplied bytes to a natively selected file and mints a fresh loose registration beside the untouched source. Export Fountain copy (existing token flow) leaves identity alone; Save As always creates identity. The order is fixed: validate the source registration, verify the declared hash, revalidate the held destination directory, check capacity, exclusive temporary write with sync and byte verification, exclusive rename (an existing destination fails closed — never overwrite), directory sync, final byte verification, fresh identity record, then open the new registration. Any failure before the rename leaves the destination absent; the source registration is never mutated, so prior bytes stay recoverable until the caller explicitly adopts the new identity (M3-12).

Destination authority is a single-use opaque token from a native file-save picker, bound to one source registration; folder-copy tokens cannot spend it and vice versa. Cancellation returns null with no state change. Read-only, contended, relocated and unsafe destinations fail closed; unknown/foreign/stale tokens and post-release use are refused. The new file resolves to a loose registration only: managed-project adoption is refused (with the just-opened registration released) rather than hijacking a project. New duplicate identities carry no remote linkage because loose records contain only a schema version and a random document ID.

Identity records for Save As targets are replaced, not reused: an exclusively published path is provably new, so any existing record belongs to a previous occupant. Replacement is an exclusive temporary record plus atomic rename, directory sync and read-back verification. Crash orphans (`.babel-save-as-*.pending`, `*.identity.json.tmp.*`) keep distinct names, are never promoted or silently deleted, and never block a retry, matching the project's leftover-as-candidate policy.

## Tradeoffs

Save As always yields loose files; organizing a managed project stays a later workflow, and the picked name is validated but not forced to end in `.fountain`. At capacity the file may publish without a registration; the file remains valid and openable, and no receipt is issued. The OS save dialog can suggest an existing name, but the exclusive rename is authoritative, so in-dialog confirmation can still end in a native refusal — the safe direction. `rfd` file-save selection is reused from M3-09 with no new dependency.

## Evidence still needed

[M3-11 evidence](../test-evidence/M3.md#m3-11--native-save-as-identity-and-publication) owns checks and omissions. Identity switching in the writing lifecycle (M3-12), managed-project authoring, other platforms and installed/offline adoption remain open.
