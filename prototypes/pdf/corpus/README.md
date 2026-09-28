# M1-03 synthetic PDF corpus (proof only)

All four files are original synthetic probes written for this repository.
No private manuscript, published screenplay, or third-party text is included.
UTF-8, LF, final newline present. Not production conformance goldens.

| File                      | Purpose                                                                                                                                                                                                 | Requirements probed          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `coverage.fountain`       | Title page with known + unknown fields, section/synopsis, numbered slug, action, cue/extension, dialogue, parenthetical, dual pair, lyrics, centered, transition, explicit break, emphasis.             | PDF-01/03/04, DOC-04, INV-03 |
| `pagination.fountain` | Heading pushed toward the page foot by a ~1200-character single-paragraph action that flows across a page boundary on its own; long wrapping dialogue plus a page-spanning monologue, repeated cue, explicit break, dual pair and lyric/centered lines near the break. | PDF-02/03, INV-10/13 |
| `title-overflow.fountain` | Overflowing title page (50-line contact block forces two title pages; first body page then prints `2.`), title-break behavior and body page numbering after overflow, inline note, boneyard, section + synopsis in the body. Notes/boneyard/sections test the no-silent-loss rule. | PDF-01/04, INV-03/10 |
| `unicode.fountain`        | Accented Latin, CJK, emoji, RTL line, long unbreakable name, emphasis and escaped literal. Tests glyph fallback warnings and Unicode source survival.                                                   | PDF-01/04, INV-03            |

Provenance: authored in-task, September 2026. Requirement IDs are probes, not completion claims.
