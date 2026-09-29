# M3 independent Fountain oracles

## M3-03 complex literals

[m3-complex.json](m3-complex.json) adds eight synthetic cases with complete original/edited source literals and 16 SHA-256 expectations. Sources, edits, title/hidden/group/rich/break projections and renderer expectations were written as literal data before comparison, with hashes calculated only from those literals. There is no golden updater. A separate single-agent source/spec review checked BOM/CRLF/EOF, unknown title continuations, note two-space rows, boneyard blank rows, dual adjacency, combined/nested emphasis, escaped literal stars, action/dialogue physical breaks and explicit raw conversion. This is not a claim of a second reviewer.

The [complex contract suite](../../tests/contract/fountain-complex.test.ts) and [production comparison](../../tests/tooling/fountain-complex-compare.ts) consume this data without changing the original M3-01 corpus below. Five complex cases declare renderer sharing for both versions; hidden presentation, two-space speech paragraph shape and raw conversion retain source/structure oracles with named gaps. Other literal escapes receive codec literal/refusal checks; this does not establish every renderer's escape behavior. [M3-03 evidence](../../docs/test-evidence/M3.md#m3-03--complex-fountain-regions-and-inline-semantics) records the actual comparison.

## M3-01 original corpus

[M3-01](../../TODO.md) establishes data and a runnable comparison, not a production codec. [m3-conformance.json](m3-conformance.json) contains 12 original synthetic sources, nine complete edited-source literals and semantic expectations. The matching `.fountain` files live in [fountain](../fountain/README.md). Invalid UTF-8 is covered by the existing M1 literal hex/hash oracle. All text was authored for this repository and may be reused for project testing; no private or third-party screenplay is included.

## Authority and review

The [official syntax](https://fountain.io/syntax/) and [SPEC S05–S06](../../SPEC.md#s05) define the meaning. The literal sources, line atoms, title values, dual references, rich runs, HTML text order and structural counts were authored without invoking either implementation. SHA-256 values are calculated from those literals, never from codec output. There is no golden-update command. A future change needs a reason and separate source/spec review before changing the expected data.

The single editing agent reviewed the literals against the syntax reference before acceptance, including the title/body boundary, two-space dialogue separator, forced action versus cue, scene numbers, dual pairing, multiline hidden content, inline styles and escaped punctuation. This is independent oracle authorship and a separate source/spec check, not a claim of review by a second person or agent. During development, the unknown-body fixture gained a leading blank: an initial arbitrary `key: value` can legally be title metadata, so the raw-body fixture must establish that it is body text. The implementation was not changed to force the original assumption.

## Comparison definitions

- `sourceLiteral` plus `sha256` requires all bytes, including BOM, mixed endings, meaningful spaces, raw regions and missing final newline. Every source line/span is checked independently against the literal; blank separator lines cannot disappear from the byte assertions.
- `proofAtoms` lists every nonseparator line's M1 semantics in order: kind, literal text, title key, section level, scene number and dual reference when present. `dualWith` is a physical source-line index. A two-space speech separator remains an explicit dialogue atom. Markup remains literal in this proof; this is not a complete domain AST.
- `edit` supplies the intended line/type/text, independently authored complete output bytes and complete post-edit line atoms. Title fields, other speech groups and hidden/raw material are checked through unchanged context as well as literal output.
- `renderer` specifies ordered Screenplain atoms, parser title fields, rendered HTML text, rich runs and selected HTML structure/mark checks. For direct agreement, dual references are converted to ordered atom indices on both sides. The renderer projector throws on an unknown paragraph type instead of silently ignoring it.
- `shared` permits direct codec/renderer semantic equality only for declared common cases. Every excluded case has named gaps. Screenplain's BOM removal is decoding of a derived comparison only; it cannot rewrite the original source. The HTML projector ignores only whitespace outside generated elements and retains text/spacing inside them, including nonbreaking spaces. Structural counts test scene-number spans, page-break indication and actual left/right dual containers; inline styles are checked in both rich data and rendered HTML.
- `gaps` records limitations of the M1 proof or the independent renderer. `required` records future production obligations; neither field is permission to lose content. No tests are skipped or declared expected failures to hide incomplete production behavior.

## Corpus coverage

| Case | Literal/semantic obligation | Comparison boundary |
| --- | --- | --- |
| `primary` | Normal/forced headings, scene numbers, uppercase action, transition-like prose, centered text and page break; edited action preserves all other elements. Shot remains standard portable action. | Direct ordered atoms and rendered scene/page-break structure. |
| `dialogue` | Forced mixed-case cue/extension, parenthetical before/within speech and line order; one dialogue edit. | Direct ordered atoms and rendered text. |
| `dual` | Two explicit dialogue groups and second-cue relationship survive an edit. | Direct relationship equality and rendered left/right containers. |
| `spacing` | Two-space dialogue separator, multiple dialogue paragraphs, repeated blank lines and leading/trailing action spaces. | Screenplain trims some whitespace; its presentation is never a source-byte oracle. |
| `title` | Multiline title, Authors, unknown field and tab/space continuations; body edit leaves all title bytes/values intact. | Parser values checked; bare HTML omits title content. PDF unknown-field omission remains SC005/M5. Title editing is a later M3-03 gate. |
| `hidden-outline` | Nested sections/synopsis, multiline note/boneyard, lyrics and raw extension remain authored source. | HTML renders the outline but omits notes/boneyard and guesses raw/lyrics action. M1 PDF outline omission is separate; SC005/SC008 remain M5 gates. |
| `emphasis` | Italic, bold, underline, bold-italic, escaped literal stars and an edited italic word preserve ordering/text. | Rich runs and actual HTML marks checked; M1 codec retains markup, not editable marks. M3-03/08 implement that model. |
| `unfinished` | Raw body, incomplete cue, malformed parenthetical and unclosed-note tail with no final newline. | Literal bytes, conservative refusals and drafting diagnostics; no renderer authority for malformed author intent. |
| `unicode-lf`, `bom-crlf`, `no-final-newline`, `mixed-newlines` | Identical Unicode semantics, distinct exact encodings/endings, edited line plus untouched byte ranges. | Direct supported semantics after derived BOM decoding; no source normalization. |
| existing `invalid-utf8` | Exact literal hex/hash survives read-only open and refused edit. | No renderer decoding or lossy conversion. |

Full context-spanning edits, title/note/raw conversions, editable inline marks, incomplete intended types/recovery metadata and source/editor caret/undo are M3-02–08 gates. Renderer agreement is semantic interoperability evidence for a declared subset; no PDF pagination, native save or Local v1 claim follows from it. Commands and observed counts are in [M3 evidence](../../docs/test-evidence/M3.md#m3-01--independent-conformance-corpus-and-oracle).
