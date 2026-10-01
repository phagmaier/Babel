# Fountain source and document model

Status: M3-02/03 implement the immutable production codec and bounded complex-region editing; M3-04 adds sole editor state/source captures. Default-app activation and persistence integration passed the bounded Linux M3-13 exit. M1 proofs and M2 native byte-preserving open/checkpoint/save contracts remain bounded. See [ADR 0007](decisions/0007-source-aware-fountain-contract.md), [ADR 0021](decisions/0021-production-editor-source-captures.md) and [M3 evidence](test-evidence/M3.md#m3-13--corrected-integrated-exit-re-review). [SPEC S05-S06](../SPEC.md#s05); DOC-01–DOC-04, INV-02/03/11/12.

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

M1-06 composes the existing codec with typed editor nodes while retaining the original source as immutable plugin data inside the sole EditorState. Captures derive current source ranges and UTF-16/UTF-8 selection anchors from those nodes. The bounded heading/action/cue/dialogue subset preserves blank/raw regions and passes literal LF/BOM-CRLF/no-final-newline oracles, native saves and reopen. The subsequent bounded M3 gate verifies production grammar/context and editor integration; this remains a historical subset proof. See the [proof](../prototypes/editor-composition/README.md) and [M1 evidence](test-evidence/M1.md#m1-06--bounded-codeceditornative-composition-proof).

## M3-01 independent conformance boundary

The [corpus/oracle guide](../fixtures/expected/README.md) and [harness](../prototypes/fountain-conformance/README.md) exercise the unchanged M1 codec against independently authored exact-byte, full nonseparator-line and edited-context expectations. A pinned Screenplain AST/bare HTML comparison checks supported order/types, scene numbers, dual relationships, title values and rich emphasis/rendered marks. Explicit renderer/proof exclusions retain literal source oracles; gaps cannot redefine authored content. M3-02–08 add production codec/marks, draft metadata and protected source/editor integration; the title form and broader daily workflows remain M4. This is pure codec/interoperability proof evidence, not native saving, full PDF or Local v1 acceptance.

## M3-02 production codec foundation

[Codec](../src/domain/fountainCodec.ts), [model](../src/domain/fountainModel.ts) and [contract tests](../tests/contract/production-fountain.test.ts) implement the primary source boundary independently of React, native services and the proof codec. [M3-02 evidence](test-evidence/M3.md#m3-02--production-source-aware-codec-foundation) owns acceptance/check results. The default app still has no production authoring flow.

`parseFountain(bytes, recovery?)` captures an owned immutable snapshot. Every physical line retains literal source text, UTF-8 start/content-end/end offsets, its exact ending, a session ID, interpreted content/type and relevant marker/scene-number/section-level/character-name/extension/speech-cue fields. BOM is separate; interior U+FEFF remains content. Blank source rows and two-space dialogue are retained. An imported blank's ultimate author intent cannot always be inferred: `blankRole: source` never permits removing it. Line terminators, retained blank rows and recovery-only draft intent are separate facts. Shot is `actionSubtype: shot`, serialized as ordinary action. IDs are never Fountain content.

The document, line arrays/fields, diagnostics and recovery inventory are frozen. Bytes are private; both the `bytes` accessor and `serializeFountain(document)` return owned copies. A no-op returns exact bytes; serialization accepts only codec-owned documents. There is no mutable raw peer, network/filesystem work, native persistence ABI change, dependency addition or whole-source cleanup.

`replaceLine` and `replaceLines(document, from, count, edits)` form atomic transactions over declared physical-line context, including bounded insertion/deletion. Draft text cannot contain CR/LF or unpaired UTF-16 surrogates; each replacement owns one physical line. Existing per-line endings are retained; extra lines inherit the edited context's ending, falling back to a nearby/file ending and then LF. A replaced EOF retains its final-ending convention. Appending after an unterminated line must own that line explicitly. New sources default to BOM-free UTF-8/LF.

Generated standard forcing markers preserve an explicit primary type; unchanged line content/fields retain original spelling and indentation even in a wider transaction. Scene numbers/section levels can be changed explicitly; `sceneNumber: null` removes a number. Omitted fields retain compatible prior fields. `actionSubtype: null` clears Shot without rewriting source. Reparse must reproduce requested content, type and fields. Every undeclared neighbor retains its full interpreted content/fields, editable status, draft intent, Shot subtype and speech/dual target ID. Drift refuses the entire edit with a typed `FountainEditError`, leaving the prior snapshot and its exact copy route intact. A caller must explicitly include affected cue/speech context rather than silently retype it.

IDs survive ordinary replacements and untouched range shifts. Additional lines get fresh IDs; deleted IDs are not reused within the snapshot lineage. Previous immutable snapshots retain their IDs/content for later editor transactions; this does not certify production selection, moves or undo/redo. A complete external reparse can rebuild IDs. `semanticView` compares ordered portable kinds/text, title keys, scene numbers, section levels, character names/extensions, speech-cue indices and dual references/markers. It excludes forcing origin, offsets, session ID spelling, Shot label and recovery intent; byte and metadata assertions cover those separately.

Recovery inventory schema 1 includes BOM, an allocation high-water mark and every line's ID, offsets, literal text/ending, optional Shot subtype and incomplete intent. It applies only to an exact matching source inventory with unique valid IDs and compatible intent. Invalid/stale metadata yields `recovery-mismatch` and is ignored without changing source. The inventory is derived immutable draft metadata for the later editor/persistence bridge; it is not a second live manuscript or a new native file format. M3-04/08/10 implement selection/composition anchoring and capture bounds; M3-13 verifies their bounded default-app integration.

Empty character text is authored as `@`, diagnosed as an incomplete cue. An empty dialogue/parenthetical intention can annotate an existing empty source row without changing its bytes; another Fountain reader sees the portable blank. Newly authored incomplete `(` parenthetical/speech text remains exact source with recovery intent and an external-ambiguity diagnostic, can continue typing, and can complete into ordinary grammar. Matching recovery restores that ability. Imported malformed parentheses without matching intent remain protected; conversion is not implicitly accepted. A draft that would reinterpret later speech must explicitly own that speech. An empty replacement at unterminated EOF that would erase its physical row is refused with an exact-copy route; virtual editor placeholders remain the later bridge's responsibility.

Invalid UTF-8 opens read-only with all bytes retained. The primary edit API protects unknown extensions, mixed hidden/visible content, title fields/continuations and notes/boneyards, including blank rows and unclosed tails. Standard standalone regions retain their line projection; uncertain mixed regions stay raw. Primary parsing honors indentation, Unicode cue names/extensions, scene-number syntax and trailing-space transition ambiguity; explicit forcing syntax outranks inferred speech/title syntax. M3-03 adds the complete-context APIs below; no proof/renderer omission authorizes source loss.

## M3-03 complex source structures and editing

[Complex contract tests](../tests/contract/fountain-complex.test.ts), [separately authored literals](../fixtures/expected/m3-complex.json) and [production/renderer comparison](../tests/tooling/fountain-complex-compare.ts) extend the same immutable codec. [M3-03 evidence](test-evidence/M3.md#m3-03--complex-fountain-regions-and-inline-semantics) records acceptance and exclusions. No editor state, native format or runtime dependency is added.

Snapshots expose ordered `titleFields`, `hiddenRegions`, `dialogueGroups` and `sourceBreaks`. Title fields retain original keys, duplicate/unknown fields, ordered values, continuation lines and exact whole-field byte ranges. A value can be empty. Hidden regions retain exact opener/body/closer byte ranges, content, physical-line ownership and closed/ambiguous status. Escaped delimiters are literal. Notes retain two-space empty rows; ordinary empty interior note rows and nested same delimiters are diagnosed as ambiguous. Boneyards retain ordinary blank rows. Unclosed tails remain exact protected source. Mixed visible/hidden rows remain raw with region spans; their visible text is not falsely projected as editable rich content.

Dialogue groups use cue IDs, ordered speech-line IDs and explicit partner IDs. Incomplete cues/bodies and overlapping/chained pairs cannot be silently repaired. `sourceBreaks` records existing physical action/action or same-cue dialogue/dialogue relationships and exact newline byte ranges. These are portable source facts; they do not define editor node, caret or visual wrapping behavior.

Visible known lines and title values expose frozen `inline` text, styled runs and delimiter spans. Run/delimiter offsets are UTF-16 offsets in extracted line text; source/region offsets remain UTF-8 bytes. Bold, italic, underline, combined/nested styles and escaped literal markers preserve original source spelling on no-op. Unpaired/crossing markers stay literal with `inline-incomplete`; markup is never silently removed. `semanticView` now includes rich runs and title/hidden ownership indices; rich comparison merges only adjacent identical styles and orders style names consistently. Original bytes remain the source authority.

`replaceKnownSourceContext` accepts explicitly requested physical source lines and portable types/fields over complete known context. Whole title fields and hidden regions must be owned. Reparse validates requested semantics, complete region boundaries and every undeclared neighbor. Primary or concrete changes to a dual relationship must own both complete groups. Delimiter/type transformations therefore have a concrete success or typed refusal, rather than incidental neighbor retyping.

`replaceTitleField` preserves an unchanged key prefix and existing continuation indentation/endings while replacing the complete field; unknown fields and other fields retain order/bytes. `replaceHiddenContent` edits one closed unambiguous body, retaining wrappers, visible prefix/suffix and sibling regions. Leading/trailing empty entries describe body newlines when wrappers occupy separate rows. Injecting an opener/closer, ambiguous blank note rows or an unclosed region refuses. Targeted known-body editing can preserve mixed raw surroundings; it does not authorize general raw conversion.

M3-05 editor commands retain requested session line IDs through structural codec edits and advance the allocation high-water mark. Capture edits disjoint intervals around protected rows, so a later text edit cannot make an earlier insertion consume a raw region. A complete standalone Note may be split as one whole-region concrete source edit when both delimiter halves remain valid; mixed, unclosed and ambiguous note regions stay protected. These are deferred capture operations, not synchronous typing-path parses.

`setDualDialogue` pairs or unpairs adjacent complete speech groups across source blank separators, preserving noncue bytes. Nonadjacent, incomplete, overlapping or chained relationships refuse. `replaceInline` accepts text/style runs, preserves original syntax on semantic no-op and validates generated syntax against both the requested rich projection and Fountain grammar. Newline-containing runs, styled whitespace boundaries and ambiguous style/grammar encodings refuse with `unrepresentable` or another typed codec error. Literal escape syntax outside the renderer's supported subset still needs later interoperability/PDF proof; a successful self-reparse is not a claim that every renderer supports it.

`replaceLineWithBreaks` authors physical action/dialogue rows using the existing ending policy. Empty dialogue rows use Fountain's two spaces; empty action uses explicit `!`, including at unterminated EOF. Cross-line unpaired emphasis and parenthetical breaks refuse. Other element types and virtual empty editor nodes are outside this API. Failure leaves `serializeFountain(original)` as an exact copy route.

Unknown/raw, imported malformed or ambiguous content requires `proposeSourceConversion`, with complete declared context and a concrete safe candidate. Its frozen proposal retains owned copies of the full original and candidate source bytes, with `sourceStart`/`sourceEnd` identifying the original selected range, without changing the original snapshot. `acceptSourceConversion` publishes only a codec-owned proposal against the exact snapshot that produced it; stale or fabricated proposals refuse. Conversion cannot publish an unclosed/ambiguous region or unsupported raw candidate. A future editor must present the retained original and request explicit acceptance; the codec's acceptance call is not itself a user approval UI. Recovery schema remains unchanged; concrete draft completion clears obsolete intent while matching source metadata still restores unfinished drafting.

## M3-04 editor source projection

The [editor contract](editor-behavior.md#m3-04-sole-state-and-capture-boundary) and [ADR 0021](decisions/0021-production-editor-source-captures.md) define the single live authority and deferred derivative. Frozen source origin stays inside EditorState; current node text/styles always own live edits. Captures derive immutable views. No serializer result is applied back to the editor. Stable IDs remain editor/origin data; current byte ranges and decoded caret maps are derived after each capture. Empty source has a virtual Action with no portable row; first typing and undo round-trip it without printing a placeholder. Domain recovery schema 1 remains unchanged. Native recovery restoration of the new sparse capture metadata and raw conversion UI acceptance remain later integration gates.

M3-08's whole-source import retains an immutable branded codec origin with the editor document through undo/redo; it never rewrites original bytes for a no-op capture. New import rows allocate fresh IDs, including empty/invalid source placeholders. Origin provenance is private, absent from DOM/clipboard, and can change only through the protected import command or history; [ADR 0023](decisions/0023-protected-fountain-import.md) owns this extension.

## M4-03 manuscript index

[ADR 0029](decisions/0029-versioned-manuscript-index.md) owns half-open scene/section ranges, literal synopsis/note/blank ownership and explicit boundary ambiguity. `manuscriptIndex.ts` derives a frozen advisory hierarchy and logical body/title/note/omitted/raw locations from a captured codec document. It retains intact title/hidden/raw/dual spans, newline facts and exact Unicode/source-byte runs; it never rewrites source or grants permission to move ambiguous material. Scene ordinals and authored numbers are separate. Bounds fail the entire projection; view limits are explicitly disclosed. M4-05 moves use the complete indexed locations and intact ranges together; [M4-07 find](editor-behavior.md#logical-find-m4-07) consumes the same logical locations/runs without crossing row/region boundaries; future counts retain the same contract.

## M4-05 exact-source outline moves

[Move planner](../src/domain/sceneMoves.ts) consumes only an index branded to the exact captured codec document. Scenes move the half-open heading/body span, ending before every scene or section heading; sections move their complete nested subtree. Synopsis/notes/blanks retain ADR 0029's literal preceding ownership. Boundary candidates are displayed with explicit moves/stays rows and complete moved/original/candidate review copies. Leading unowned content stays. Intact title/hidden/raw/dual spans cannot be split by removal or insertion; title fields cannot be moved. Scenes can transfer into another section beside a scene. Section destinations require the same parent and authored nesting level, preserving every other outline relationship.

The planner permutes existing physical row bytes, keeps the BOM at the file prefix, and reparses with reordered exact recovery identities. Every row retains its portable meaning, rich text, production number, speech/dual/title/hidden owner, draft intent and Shot metadata. No marker, whitespace, separator, ending or EOF normalization is permitted. A boundary that changes interpretation or moves an unterminated EOF into another row refuses and retains independently owned full original/candidate copies. Plans are immutable and branded; fabricated, stale or foreign indexes cannot authorize moves. [M4-05 evidence](test-evidence/M4.md#m4-05--reversible-scene-and-section-moves) records byte/selection/refusal coverage.

## M4-06 title-page authorship

[Title commands](../src/domain/titlePage.ts) retain ordered field IDs, duplicate and unknown keys and literal Fountain emphasis. Replacement uses the checked complete-field codec, preserving unchanged key prefixes and existing continuation indentation/endings. Explicit Add appends a field, or prepends a new page with a separator before existing body content. Remove owns only the selected complete field. Move up/down permutes complete physical fields with their original endings. BOM, untouched rows and body bytes remain exact; EOF joins, empty continuations and neighboring interpretation changes refuse without normalization. New rows use the editor's monotonic ID counter, including after Undo.

The editor rebases immutable source provenance only through the checked title action. Committed content remains solely in EditorState; captures use the same source bridge and native persistence path. Each action isolates history and retains surviving row identities/marks and selection direction, clamping changed title offsets at Unicode scalar boundaries. Undo/Redo restore source spelling and selection while versions advance. [Evidence](test-evidence/M4.md#m4-06--source-preserving-title-page-form) owns acceptance and limitations.

## Character and count projection (M4-13)

The complete versioned manuscript index supplies logical text for
[character/count facts](../src/domain/characterCounts.ts). Script words include
recognized body headings/cues/dialogue/parentheticals/action/transitions/lyrics/
centered text. Title, notes, omitted text, uncertain literal raw text and outline
sections/synopses have separate disclosed word totals. Count Unicode word-like
segments (`Intl.Segmenter`, locale `und`) within each logical location; punctuation
and emoji alone, Fountain markers/emphasis, source blanks and page breaks do not
count. Scene totals include recognized headings, independently of authored scene
numbers. This is no printed-page estimate; locale/runtime segmentation can vary
for scripts that need dictionary word segmentation.

Character identity follows local vocabulary's exact trimmed visible cue spelling
with parenthesized extensions removed. Case variants and canonically equivalent
Unicode spellings remain distinct; no fuzzy or normalization merge. Hidden/raw/
protected cues are excluded. Associated dialogue and parenthetical rows follow
codec `speechOf` ownership, including separate speakers of dual dialogue. Neither
counts nor highlighting edits authored cue spelling. Facts share index bounds,
coalescing, immutable-content reuse and stale/unavailable status. Character view
shows at most 500 spellings and highlights at most 1,000 associated speech rows,
with visible cap notices; cue navigation retains every bounded cue occurrence.
