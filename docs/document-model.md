# Fountain source and document model

Status: M3-02 implements the production immutable source codec foundation; the production editor/bridge and complex-region editing remain open. M1 proofs and M2 native byte-preserving open/checkpoint/save contracts remain bounded. See [ADR 0007](decisions/0007-source-aware-fountain-contract.md) and [M1 evidence](test-evidence/M1.md). [SPEC S05-S06](../SPEC.md#s05); DOC-01–DOC-04, INV-02/03/11.

Ordinary UTF-8 Fountain is the portable author-content source. A no-op open/save must preserve bytes, BOM, CRLF, spacing, and unknown fields; ideally it performs no source write. New sources default to UTF-8/LF. An edited document should preserve untouched source regions and reserialize only affected grammar context. Unsupported input stays verbatim in a raw region or opens source-preserving read-only. No save, export, validation, or recovery path may silently normalize text.

The single TypeScript domain codec foundation is independent of React and the filesystem. The full target model maps source-aware ranges to structured blocks: headings, action/Shot subtype, character, dialogue, parenthetical, transition, lyrics, centered text, section/synopsis, note, boneyard, page break, raw content, title fields, and inline emphasis. Dual dialogue is an explicit relationship. Stable IDs are editor-session aids, not injected into Fountain. All authored text must survive as source; transient empty-block intent and selection may additionally live in recovery metadata. Incomplete states are normal, and ambiguity must be reported rather than thrown away.

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

M2-03 keeps that initial snapshot immutable and advances a separate native disk
baseline only after exact source-save confirmation. Admitted save payloads are
immutable FIFO requests, never a second live authoring buffer. No Fountain
parser or normalization participates in source replacement. See
[ADR 0014](decisions/0014-serialized-source-replacement.md).

M2-04's headless persistence controller accepts immutable captured source bytes,
version, SHA-256 and opaque JSON draft metadata. Its owned submission copy does
not interpret Fountain or normalize bytes. A producer must advance the version
for source or draft-metadata changes, including undo; restoring old content is
a new version. The receipt state stores only protection facts and fingerprints,
not a second live manuscript. Editor/hash production and save cadence remain
future integration. [ADR 0015](decisions/0015-versioned-persistence-ipc.md).

M1-06 composes the existing codec with typed editor nodes while retaining the original source as immutable plugin data inside the sole EditorState. Captures derive current source ranges and UTF-16/UTF-8 selection anchors from those nodes. The bounded heading/action/cue/dialogue subset preserves blank/raw regions and passes literal LF/BOM-CRLF/no-final-newline oracles, native saves and reopen. Full grammar and context-spanning transformations remain M3 gates. See the [proof](../prototypes/editor-composition/README.md) and [M1 evidence](test-evidence/M1.md#m1-06--bounded-codeceditornative-composition-proof).

## M3-01 independent conformance boundary

The [corpus/oracle guide](../fixtures/expected/README.md) and [harness](../prototypes/fountain-conformance/README.md) exercise the unchanged M1 codec against independently authored exact-byte, full nonseparator-line and edited-context expectations. A pinned Screenplain AST/bare HTML comparison checks supported order/types, scene numbers, dual relationships, title values and rich emphasis/rendered marks. Explicit renderer/proof exclusions retain literal source oracles; gaps cannot redefine authored content. Full structured/title/note/raw edits, inline mark nodes, draft metadata and production source/editor integration remain M3-02–08. This is pure codec/interoperability proof evidence, not native saving, full PDF or Local v1 acceptance.

## M3-02 production codec foundation

[Codec](../src/domain/fountainCodec.ts), [model](../src/domain/fountainModel.ts) and [contract tests](../tests/contract/production-fountain.test.ts) implement the primary source boundary independently of React, native services and the proof codec. [M3-02 evidence](test-evidence/M3.md#m3-02--production-source-aware-codec-foundation) owns acceptance/check results. The default app still has no production authoring flow.

`parseFountain(bytes, recovery?)` captures an owned immutable snapshot. Every physical line retains literal source text, UTF-8 start/content-end/end offsets, its exact ending, a session ID, interpreted content/type and relevant marker/scene-number/section-level/character-name/extension/speech-cue fields. BOM is separate; interior U+FEFF remains content. Blank source rows and two-space dialogue are retained. An imported blank's ultimate author intent cannot always be inferred: `blankRole: source` never permits removing it. Line terminators, retained blank rows and recovery-only draft intent are separate facts. Shot is `actionSubtype: shot`, serialized as ordinary action. IDs are never Fountain content.

The document, line arrays/fields, diagnostics and recovery inventory are frozen. Bytes are private; both the `bytes` accessor and `serializeFountain(document)` return owned copies. A no-op returns exact bytes; serialization accepts only codec-owned documents. There is no mutable raw peer, network/filesystem work, native persistence ABI change, dependency addition or whole-source cleanup.

`replaceLine` and `replaceLines(document, from, count, edits)` form atomic transactions over declared physical-line context, including bounded insertion/deletion. Draft text cannot contain CR/LF or unpaired UTF-16 surrogates; each replacement owns one physical line. Existing per-line endings are retained; extra lines inherit the edited context's ending, falling back to a nearby/file ending and then LF. A replaced EOF retains its final-ending convention. Appending after an unterminated line must own that line explicitly. New sources default to BOM-free UTF-8/LF.

Generated standard forcing markers preserve an explicit primary type; unchanged line content/fields retain original spelling and indentation even in a wider transaction. Scene numbers/section levels can be changed explicitly; `sceneNumber: null` removes a number. Omitted fields retain compatible prior fields. `actionSubtype: null` clears Shot without rewriting source. Reparse must reproduce requested content, type and fields. Every undeclared neighbor retains its full interpreted content/fields, editable status, draft intent, Shot subtype and speech/dual target ID. Drift refuses the entire edit with a typed `FountainEditError`, leaving the prior snapshot and its exact copy route intact. A caller must explicitly include affected cue/speech context rather than silently retype it.

IDs survive ordinary replacements and untouched range shifts. Additional lines get fresh IDs; deleted IDs are not reused within the snapshot lineage. Previous immutable snapshots retain their IDs/content for later editor transactions; this does not certify production selection, moves or undo/redo. A complete external reparse can rebuild IDs. `semanticView` compares ordered portable kinds/text, title keys, scene numbers, section levels, character names/extensions, speech-cue indices and dual references/markers. It excludes forcing origin, offsets, session ID spelling, Shot label and recovery intent; byte and metadata assertions cover those separately.

Recovery inventory schema 1 includes BOM, an allocation high-water mark and every line's ID, offsets, literal text/ending, optional Shot subtype and incomplete intent. It applies only to an exact matching source inventory with unique valid IDs and compatible intent. Invalid/stale metadata yields `recovery-mismatch` and is ignored without changing source. The inventory is derived immutable draft metadata for the later editor/persistence bridge; it is not a second live manuscript or a new native file format. Selection/composition anchoring and capture bounds remain M3-04/08/10.

Empty character text is authored as `@`, diagnosed as an incomplete cue. An empty dialogue/parenthetical intention can annotate an existing empty source row without changing its bytes; another Fountain reader sees the portable blank. Newly authored incomplete `(` parenthetical/speech text remains exact source with recovery intent and an external-ambiguity diagnostic, can continue typing, and can complete into ordinary grammar. Matching recovery restores that ability. Imported malformed parentheses without matching intent remain protected; conversion is not implicitly accepted. A draft that would reinterpret later speech must explicitly own that speech. An empty replacement at unterminated EOF that would erase its physical row is refused with an exact-copy route; virtual editor placeholders remain the later bridge's responsibility.

Invalid UTF-8 opens read-only with all bytes retained. Unknown extensions, mixed hidden/visible content, title fields/continuations, notes/boneyards (including their blank rows and unclosed tails) remain protected source. Inline markup stays literal. Standard standalone regions retain their current line projection; uncertain mixed regions stay raw. Primary parsing honors indentation, Unicode cue names/extensions, scene-number syntax and trailing-space transition ambiguity; explicit forcing syntax outranks inferred speech/title syntax. Complex title structures, group transformations, hidden-region conversion, inline marks and hard-break editing remain M3-03; no proof/renderer omission authorizes source loss.
