# Script Check contract

Status: planned. [SPEC S09](../SPEC.md#s09); CHECK-01/02, INV-03/06/10.

Script Check reads an immutable versioned snapshot and reports issues; it never rewrites source on inspection. Results must carry source/version, code, severity, location, explanation, navigation target, and optional explicit fix. A stale result is discarded or marked stale. Saving raw authored text remains possible even when structure is incomplete.

| Kind                       | Examples                                                         | Response                                     |
| -------------------------- | ---------------------------------------------------------------- | -------------------------------------------- |
| Blocking export limitation | Unsupported feature or glyph/layout loss                         | Preserve source; stop misleading PDF success |
| Structural warning         | Cue with no speech, dangling parenthetical, broken dual dialogue | Navigate/review; keep writing and saving     |
| Style advisory             | Unusual heading or spacing                                       | Optional/dismissible                         |
| System error               | Corrupt recovery frame or failed save                            | Surface as system failure, not writing fault |

Blank lines, unfinished dialogue, and incomplete drafting are not inherently invalid. Any offered fix must preview its exact effect, be one undoable transaction, and leave raw/source-safe escape routes. M4 implements the initial rule catalog after the codec/editor contracts are proven; tests cover false positives, source preservation, stale results, and fix undo.
