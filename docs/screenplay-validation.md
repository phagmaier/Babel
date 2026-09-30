# Script Check contract

Status: M4-09 implements the initial catalog over immutable snapshots with a versioned controller, panel, and explicit issue navigation; production SC005/SC008 assessment remains M5. [SPEC S09](../SPEC.md#s09); CHECK-01/02, INV-03/06/10.

Script Check reads an immutable versioned snapshot and reports issues; it never rewrites source on inspection. Results must carry source/version, code, severity, location, explanation, navigation target, and optional explicit fix. A stale result is discarded or marked stale. Saving raw authored text remains possible even when structure is incomplete.

| Kind                       | Examples                                                         | Response                                     |
| -------------------------- | ---------------------------------------------------------------- | -------------------------------------------- |
| Blocking export limitation | Unsupported feature or glyph/layout loss                         | Preserve source; stop misleading PDF success |
| Structural warning         | Cue with no speech, dangling parenthetical, broken dual dialogue | Navigate/review; keep writing and saving     |
| Style advisory             | Unusual heading or spacing                                       | Optional/dismissible                         |
| System error               | Corrupt recovery frame or failed save                            | Surface as system failure, not writing fault |

Blank lines, unfinished dialogue, and incomplete drafting are not inherently invalid. Any offered fix must preview its exact effect, be one undoable transaction, and leave raw/source-safe escape routes. M4 implements the initial rule catalog after the codec/editor contracts are proven; tests cover false positives, source preservation, stale results, and fix undo.

## M4-09 rule catalog and boundaries

[Evaluator](../src/domain/scriptCheck.ts) reports SC001 (nonempty cue without dialogue), SC002 (parenthetical outside speech or in a dialogue-less group), SC003 (incomplete/broken/ambiguous dual, including codec unpaired/ambiguous-dual and dangling partner references), and SC004 (raw runs plus unclosed/unsupported/ambiguous/inline-incomplete constructs, including unreadable bytes preserved verbatim) as warnings, and SC006 (duplicated scene numbers) and SC007 (runs of three or more blank lines) as dismissible advisories. Empty cues, one or two blank lines, and drafting metadata (`draft-intent`, `recovery-mismatch`, `incomplete-cue`) are never issues. The M4 baseline offers no automatic fixes: every result declares `hasFix: false`, and there is no Fix All. SC005/SC008 return a typed unavailable assessment with ADR 0009 provenance instead of inferring glyph or renderer support from Unicode; the panel states export assessment unavailable and never implies export success. Results carry stable code/severity/identity, explanation, exact line ranges and navigation rows; evaluation is capped at 1,000 issues in document order. Selection-only drift on the identical document rebases results without stale-ing; any content/session change marks them stale until Refresh recomputes. [Evidence](test-evidence/M4.md#m4-09--non-destructive-script-check-and-issue-navigation) owns bounded Linux verification.
