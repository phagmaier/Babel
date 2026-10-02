# Script Check contract

Status: M4-09 implements the initial catalog over immutable snapshots with a versioned controller, panel, and explicit issue navigation; M5-04 adds production SC005/SC008 assessment for the frozen profile. [SPEC S09](../SPEC.md#s09); CHECK-01/02, INV-03/06/10.

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

## M5-04 publication assessment

SC005/SC008 are blocking **export** limitations, never Save/recovery gates.
They are always visible, cannot be dismissed or hidden by structural/style
filters, and offer no fixes. [Assessment](../src/domain/exportAssessment.ts)
uses Babel's primary codec: sections, synopses, hidden notes/boneyards, unknown
or extra title keys and raw/unverified regions are explicit limitations.
Supported title fields, lyrics and short dual dialogue remain supported.
The renderer requires physical paragraphs: title/body separation, speech
paragraphs, isolated headings/transitions/breaks and centered paragraphs are
checked against the primary model. Incompatible adjacent forced elements are
reported instead of silently accepting changed roles; unsupported scene-number
syntax is also reported. Source bytes are never rewritten to fit the renderer.

[Coverage inventory](../src/domain/publicationCoverage.json) is generated from
all four pinned TrueType cmap tables by the pinned ReportLab reader during
helper builds, bound to font byte hashes and the frozen profile hash, and
independently compared with Fontconfig/FreeType. Glyph zero earns no coverage.
Fontconfig omits the fonts' NUL/CR control slots; the inventory retains those
cmap facts, layout consumes CR and assessment explicitly refuses NUL. ASCII
layout separators are consumed; other rendered scalars need actual coverage in
the selected plain/bold/italic/bold-italic face. Precomposed accents pass. The
profile has no bidi/complex shaper: combining placement, Hebrew/Arabic, Indic,
Southeast Asian and declared historic/RTL ranges are reported as shaping
limitations independently of glyph coverage. CJK and emoji fail actual cmap
coverage, never a Unicode-category heuristic. No fallback or substitution.

The read-only native `assess_publication` command accepts only bounded source
fragments selected by codec dialogue groups and numbered headings. It verifies
actual bundled profile, font, helper, pins and patched upstream bytes before
returning provenance. The same frozen pipeline probes each selected construct
in memory (`BytesIO`) for dual overflow, impossible cue/parenthetical geometry,
unpaired dual and scene-number width; failures cannot hide later constructs.
The probe has no caller-chosen paths, disk output, network or child-process
capability, uses `-I -S -B`, shared native admission and bounded resources/time.
It returns features, never PDF artifacts or guessed page counts.

Run/Refresh is on demand, off the typing path. Missing/mismatched resources or
native failures report unavailable. Results carry profile/font/renderer
provenance, captured version/hash and exact source row/byte targets. Late,
superseded or disposed replies cannot replace current results; changed content
shows stale until Refresh. Selection-only drift rebases identical-content
results. Pending refresh says Updating. Findings cap at 1,000 with explicit
truncation; no assessment is a successful PDF export receipt. M5-06 owns export
review/decisions; M5-07 owns integrated publication acceptance.
[Evidence](test-evidence/M5.md#m5-04--production-sc005sc008-assessment).
