# M1-01 synthetic Fountain fixtures

All content here was written for this repository. No private manuscript or third-party screenplay is included. These are small contract probes, not full renderer goldens. The [official Fountain syntax](https://fountain.io/syntax/) is the reference for markers.

| Fixture | Purpose and expected behavior | Requirements | Encoding/newlines |
| --- | --- | --- | --- |
| `elements.fountain` | Title continuation and unknown field, sections/synopsis, numbered and forced headings, forced uppercase action, mixed-case cue and extension, dialogue/parenthetical, dual relationship, lyrics, centered text, transition, page break, emphasis/escaped literal, multiline note and boneyard. No-op bytes must match; selected single-line edits preserve other bytes. | DOC-01–04, INV-02/03/11 | UTF-8, LF |
| `ambiguity.fountain` | Transition-like prose, uppercase action, forced mixed-case cue, unsupported raw extension, and an incomplete cue. Raw line stays verbatim and cannot enter structured edit; incomplete cue emits a diagnostic. | DOC-02/03, EDIT-01, INV-03 | UTF-8, LF |
| `windows-bom.fountain` | Unicode, BOM, CRLF, intentional blank lines and no final newline. No-op is byte-identical; an action edit keeps BOM/CRLF and untouched lines. | DOC-01/02, INV-03 | UTF-8 BOM, CRLF, no final newline |
| `invalid-utf8.fountain` | Invalid byte sequence remains available as exact source copy and opens read-only. | DOC-03, INV-03 | Invalid UTF-8 |

The M1 proof assertions are historical; `tests/contract/production-fountain.test.ts` now retains all original no-op bytes and the independent M3 corpus semantics/edits. The implementation does not generate expected files.

## M3-01 corpus

The new `m3-*.fountain` and `m3-*.edited.fountain` files are listed with source literals, hashes, semantics, encoding obligations and renderer boundaries in the [independent oracle guide](../expected/README.md) and [manifest](../expected/m3-conformance.json). The original four M1 fixtures above are unchanged. The conformance harness never regenerates these expected files from either implementation.
