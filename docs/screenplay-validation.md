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
uses Babel's primary codec: unknown or extra title keys and raw/unverified
regions are explicit limitations. Sections, synopses and hidden notes/boneyards
are reported as described under [AUDIT-D04](#audit-d04-omission-summary-and-inline-hidden-text).
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

## AUDIT-D04 omission summary and inline hidden text

Closed, unambiguous notes and boneyards, section headings and synopses are
non-printing in Fountain and omitted by the frozen renderer. A verified
assessment reports them once as `omissions`: counts, physical line totals and
ranges per kind. They are not issues, need no acknowledgement, cannot truncate
the 1,000-issue budget and appear as one sentence in Script Check and in every
phase of the export panel.

The codec still protects a line that mixes hidden and visible text as raw.
For assessment only, such a line is read as the renderer prints it when every
hidden span on it is a closed, unambiguous single-line note or boneyard that
follows visible text: the spans are dropped and the line keeps its role. Its
speech stays one group, so it produces no raw SC005, no SC004 and no false
SC001/SC002. Source bytes, editor protection and issue byte targets are those
of the author's document. A line that begins with a hidden span, a region that
spans lines beside visible text, `{{…}}`, stray markers and a line left blank
by removal stay raw and gated.

Still blocking: unknown or extra title fields; unclosed or ambiguous regions;
paragraph limitations; glyph, shaping and layout refusals. Structural warnings
SC001–SC004 still require review at export.

The summary is only truthful where the renderer agrees, so these stay or
become blocking SC005, each confirmed against the pinned renderer:

- a section that the renderer would print as text (not at the line start, not
  1–6 `#`, or sharing a paragraph with other text), and a synopsis not directly
  after a scene heading or section;
- a `#`-led or single `=`-led line the codec treats as printed text but the
  renderer treats as a section or synopsis and drops;
- a backslash before a two-character hidden marker (`\[[`, `\/*` and their
  closers), which the renderer ignores, and a boneyard opener inside a title
  field, which it removes. Escaping each bracket separately (`\[\[`) is honoured
  by both and is not reported.

AUDIT-D04-R2 adds line-level guards where the codec's reading and the pinned
renderer's differ (assessment only; codec classification is unchanged):

- a forcing marker (`.` `!` `@` `>` `~`) after leading spaces or tabs, which
  the renderer prints as text, and an indented scene heading, which it prints
  as action;
- a page break with spaces or tabs around its `=` signs, printed as text (or
  taken as a synopsis directly after a scene heading or section);
- an empty `@` cue that is bare, alone in its paragraph or not its first line,
  and a cue paragraph whose cue ends with two spaces or a tab that expands to
  them (the renderer expands tabs to four-column stops first), which the
  renderer prints with its speech as action;
- a lone `>`, which the renderer prints as text;
- a lowercase letter in a scene heading (including its number) or a forced
  transition: the renderer prints both in capitals.

[Shared corpus](../fixtures/assessment/oracle.json): the helper's Python tests
check what the rendered PDF prints and omits; vitest checks the assessment for
the same cases. [Evidence](test-evidence/AUDIT.md#audit-d04--non-blocking-omissions-and-inline-note-assessment).
Since AUDIT-D04-R1 a first line `FADE IN:` (any leading block of empty `Key:`
fields) is body text on both sides. The assessment also mirrors the renderer's
title-page reading: an indented line after a valued key makes the renderer
print the whole block, keys included, as script text, and an indented first
key makes it a title page that prints nothing; both are blocking SC005. So is
an indented `Key: value` line after a valued key where both sides still read a
title page: the codec shows it as part of that field, the renderer reads a
separate field and never prints it.

AUDIT-D04-R5 reads the opening title decision before stripping inline notes:
` FADE IN: [[cold open]]` is a title block that omits the visible key, while a
note-only key followed by a non-key continuation can remain body text. Separate
renderer keys are checked even outside codec title-field ranges or beside a
reported boneyard. Each limitation targets that key and its values, ending
before the next key; the three retained warning stops now require a located
SC005 acknowledgement before export. The helper warning comparison is unchanged.
Section/synopsis limitations use the mirrored role to say when hidden-text
removal causes an omission rather than printing as text.
[Evidence](test-evidence/AUDIT.md#audit-d04-r5--located-title-omission-limitations).

AUDIT-D04-R3 replaces case-by-case guessing with a
[mirror of the pinned parser](../src/domain/rendererReading.ts): boneyards
removed from the whole text before lines are split, tabs expanded, paragraphs
ended only by an empty line or a single space, notes removed inside a
paragraph, then each paragraph read in the renderer's own order. The assessment
compares that reading with the codec's line kinds and reports any line whose
printed role or scene number differs as blocking SC005, unless an earlier
limitation already reports that paragraph. This covers:

- a boneyard on its own line, which the renderer deletes and replaces with an
  empty line, so the line beside it becomes a heading, transition, speech or a
  dropped section, and the opening `Key:` block ends early;
- a line of a tab, two or more spaces or another whitespace character, which
  does not end a paragraph (two spaces inside a speech agree on both sides);
- a speech line starting with `(`, even inside emphasis markers, which stays a
  parenthetical with every line after it until one ends with `)`;
- `#12#` with no space before it or spaces after it, still a scene number;
- a heading prefix followed only by whitespace or by a non-space separator,
  printed as action, and a synopsis below it, which is then printed too;
- a line starting with a single period (`. hello`), printed as a heading
  without the period; an all-capitals first lyric line, read as a cue; a cue
  whose capitals do not come before its first bracket (`(MAYA)`), or a line
  whose capitals do (`MAYA (to Jon) quietly`); `TO:` with no capitals before it.

[AUDIT-D04-R4](tasks/AUDIT-D04-R4.md) closes a gap in that comparison: it was
skipped whenever a line of the opening block contained `/*`. A boneyard on its
own line can leave whitespace the renderer reads as a title value, so the lines
around it join a title block the codec does not see and are not printed; that
is now blocking SC005 over the whole block. The field comparisons are skipped
only where the renderer removes a boneyard from a codec title field, which is
reported on its own. A literal `/*` with no closer no longer hides an indented
`Key: value` line or a block the renderer prints as script text.
[Evidence](test-evidence/AUDIT.md#audit-d04-r4--boneyard-inside-the-renderers-opening-title-block).

Existing limitations beside a boneyard still over-report with their old
wording; none was removed. New corpus cases state the renderer's own paragraph
classes (`paragraphs`), which the helper test checks against the real parser
and a vitest test checks against the mirror.
[Evidence](test-evidence/AUDIT.md#audit-d04-r3--remaining-renderercodec-reading-differences).

### Announced omissions and the helper's warnings (AUDIT-EXPORT-WARNINGS)

A verified assessment also states `announced`: the omission categories the
author is told about, in the helper's `unsupported-publication:*` names
(`boneyards`, `notes`, `sections`, `synopses`, `unknown-title-fields`). Export
[stops](pdf-and-formatting.md#captured-pdf-export-m5-06) on a helper warning
outside that set. Issues and counts are unchanged; a category is announced by:

- a counted omission in the summary line;
- a blocking limitation that says the profile omits or may omit that kind;
- a limitation on a line the codec reads as a section or synopsis, even where
  its wording says the line prints: the renderer omits it beside a boneyard it
  deletes or past a note it skips, and such a line is non-printing either way;
- hidden-text syntax inside lines already told about. The helper finds notes
  and boneyards by pattern over the raw source, so it also reports a note
  inside a counted boneyard, hidden text in an omitted title field, and note
  brackets in a title value, which the renderer prints as written. An unclosed
  or ambiguous region and a raw line are unverified and also announce a section
  or synopsis line inside them.

Categories only: an announcement does not prove extent and covers any warning
in its category. A counted omission the helper does not warn about is not a
mismatch (it does not warn about an empty synopsis line). Three omissions the
assessment does not yet report are [open](tasks/AUDIT-EXPORT-WARNINGS.md#open-findings-this-comparison-now-stops);
export stops for them.
[Brief](tasks/AUDIT-EXPORT-WARNINGS.md),
[evidence](test-evidence/AUDIT.md#audit-export-warnings--renderer-warnings-compared-at-export).

## Reading conformance gate

Changes to codec spelling, export assessment, the parser mirror or renderer
require the [standing differential gate](testing.md#differential-regression-gates)
and shared independent oracle on both sides. Add a hand-written regression for
each discovered divergence. A generated-source sweep supplements those cases;
it does not establish layout/native fidelity or permit baseline retuning.
