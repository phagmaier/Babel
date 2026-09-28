# Fountain source and document model

Status: M1-01 isolated codec proof and M2-01 native byte-preserving open exist; no production parser/editor model is implemented. See [ADR 0007](decisions/0007-source-aware-fountain-contract.md) and [M1 evidence](test-evidence/M1.md). [SPEC S05-S06](../SPEC.md#s05); DOC-01–DOC-04, INV-02/03/11.

Ordinary UTF-8 Fountain is the portable author-content source. A no-op open/save must preserve bytes, BOM, CRLF, spacing, and unknown fields; ideally it performs no source write. New sources default to UTF-8/LF. An edited document should preserve untouched source regions and reserialize only affected grammar context. Unsupported input stays verbatim in a raw region or opens source-preserving read-only. No save, export, validation, or recovery path may silently normalize text.

The planned single TypeScript domain codec is independent of React and the filesystem. It maps source-aware ranges to structured blocks: headings, action/Shot subtype, character, dialogue, parenthetical, transition, lyrics, centered text, section/synopsis, note, boneyard, page break, raw content, title fields, and inline emphasis. Dual dialogue is an explicit relationship. Stable IDs are editor-session aids, not injected into Fountain. All authored text must survive as source; transient empty-block intent and selection may additionally live in recovery metadata. Incomplete states are normal, and ambiguity must be reported rather than thrown away.

M1 must prove no-op byte identity, semantic equivalence after edits, forced marker boundaries, unknown regions, Unicode, title variants, CRLF/BOM, and incomplete speech using synthetic fixtures. M3 integrates the proven codec with the editor. [Fixture conventions](../fixtures/README.md) and [ADR 0002](decisions/0002-fountain-content.md) define evidence boundaries.

M2-01 registers exact native source bytes independently of the codec. Native
fingerprints include SHA-256, length, device/inode, change/modify times,
mode/owner/link count. Managed identity comes from validated schema-1 metadata;
loose identity is random and persisted in private app data keyed to normalized
native path, not content. Invalid UTF-8 remains verbatim and view-only; valid
UTF-8 unknown syntax is returned raw without claiming parser support. Native
initial snapshots are immutable. [ADR 0012](decisions/0012-native-document-identity.md)
and [M2 evidence](test-evidence/M2.md) describe conservative metadata/rename
behavior, bounds and ownership. Unsaved identities are allocated before naming; M2-02 adds native checkpoint receipts. Recovery protection applies only to the acknowledged snapshot, not later live edits or the source file.
