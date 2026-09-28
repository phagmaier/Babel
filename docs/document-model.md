# Fountain source and document model

Status: planned; no parser or document model is implemented. [SPEC S05-S06](../SPEC.md#s05); DOC-01–DOC-04, INV-02/03/11.

Ordinary UTF-8 Fountain is the portable author-content source. A no-op open/save must preserve bytes, BOM, CRLF, spacing, and unknown fields; ideally it performs no source write. New sources default to UTF-8/LF. An edited document should preserve untouched source regions and reserialize only affected grammar context. Unsupported input stays verbatim in a raw region or opens source-preserving read-only. No save, export, validation, or recovery path may silently normalize text.

The planned single TypeScript domain codec is independent of React and the filesystem. It maps source-aware ranges to structured blocks: headings, action/Shot subtype, character, dialogue, parenthetical, transition, lyrics, centered text, section/synopsis, note, boneyard, page break, raw content, title fields, and inline emphasis. Dual dialogue is an explicit relationship. Stable IDs are editor-session aids, not injected into Fountain. All authored text must survive as source; transient empty-block intent and selection may additionally live in recovery metadata. Incomplete states are normal, and ambiguity must be reported rather than thrown away.

M1 must prove no-op byte identity, semantic equivalence after edits, forced marker boundaries, unknown regions, Unicode, title variants, CRLF/BOM, and incomplete speech using synthetic fixtures. M3 integrates the proven codec with the editor. [Fixture conventions](../fixtures/README.md) and [ADR 0002](decisions/0002-fountain-content.md) define evidence boundaries.
