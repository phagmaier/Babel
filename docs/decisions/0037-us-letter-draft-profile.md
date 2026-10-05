# ADR 0037: Freeze the US Letter draft publication profile

Status: **Accepted direction**
Date: 2026-10-02. Task: [M5-03](../tasks/M5-03.md).
Sources: SPEC S12.3–12.6; [ADR 0036](0036-bundled-pdf-helper.md).

## Decision and patch boundary

`us-letter-draft-v1` is the native/frontend publication profile, with
`profileFrozen: true` and `sourceMap: unsupported`. It uses the existing pinned
Screenplain 0.12.0 / ReportLab 4.4.7 / Courier Prime helper. The old
`screenplain-baseline` remains available only to helper regression tests.
Freezing a layout is not a fidelity or Script Check assessment.

The machine-readable [profile](../../tools/pdf-helper/profiles/us-letter-draft-v1.json)
and [patch](../../tools/pdf-helper/frozen_profile.py) are bundled and included in
the runtime tree identity. The patch checks SHA-256 of the two Screenplain
modules and ReportLab's `ttfonts.py` before rendering. It retains Screenplain's
AST and `to_pdf` dispatch and ReportLab's Paragraph wrapping/splitting and
BaseDocTemplate frame/page breaker. It replaces the dialogue and dual flowables,
numbered-heading wrapper, page-template numbering and initial canvas font;
it adds narrow forced-title/lyric parser guards. AUDIT-C356 adds literal-escape
protection before emphasis parsing and restoration of segment text/styles,
including lazily parsed title values. This bug correction advances the helper
tree/native integrity pin; profile geometry, fonts, renderer dependency versions
and accepted layout/raster goldens remain unchanged. [Audit evidence](../test-evidence/AUDIT.md#audit-c356--literal-escapes-selinux-metadata-and-advisory-highlights)
records independent PDF text/style checks and unchanged-golden comparison. There is no second paginator.

ReportLab's ToUnicode mappings are retained in order but partitioned into
`beginbfchar` blocks of at most 100 entries. This resolves the Ghostscript
CMap conformance warning without changing characters or layout. The default
canvas and dual-table font are explicitly Courier Prime, removing Helvetica.
The helper still checks all four original font byte hashes each invocation;
unsupported visible glyphs or RTL shaping are refused rather than substituted.

## Geometry and line policy

Coordinates are PDF points from the lower left. US Letter is 612 × 792.
All body text uses pinned Courier Prime at 12 points, leading 12, without
hyphenation, justification or font shrinking. A long word splits at characters.

| Element             | Geometry                                                                       |
| ------------------- | ------------------------------------------------------------------------------ |
| Body frame          | x 108, y 72, width 432, height 648; zero padding, 54 line slots                |
| First body baseline | y 708; baseline advances by 12                                                 |
| Action/heading      | x 108, width 432; scene number at x 54 and right anchor 540                    |
| Cue                 | x 266.4, remaining width 273.6                                                 |
| Dialogue            | x 180, width 252                                                               |
| Parenthetical       | x 223.2, width 216                                                             |
| Dual                | two 216-point columns; proportional upstream indents; spoken baselines aligned |
| Centered/transition | center of body frame / right anchor 540                                        |
| Page number         | plain Courier Prime 12, right anchor (540, 750), `N.`                          |
| Title frame         | x 108, y 72, width 396, height 648                                             |
| Title heading       | centered 24 points, leading 36; remaining fields 12/12                         |

Action hard lines retain their order. Upstream element spacing is retained:
one line before cue/action/heading/transition, one line after heading/transition;
frame-top spacing is suppressed by Platypus. Title, Credit, Author/Authors and
Source are centered in upstream order; Draft date and Contact use the lower
left. Normal title placement reserves a third-frame upper spacer; when title
content overflows, that spacer is omitted. Title pages never earn body numbers.
First body page is unnumbered; subsequent body pages are `2.`, `3.`, etc.
Explicit leading breaks create intentional blank body pages; a trailing break
creates no unused page. Empty input produces one actual blank PDF page.

## Grouping and continuation

Headings keep with following content where feasible. An oversized action,
speech paragraph or numbered heading delegates text splitting to Paragraph;
text stays ordered, at 12 points, without clipping or omission. Scene numbers
appear only on the first heading fragment, beside its first baseline.

A speech split reserves a repeated cue and a final `(MORE)`. At least two spoken
line slots are preferred when feasible; parentheticals/blank chains travel with
following speech, and a terminal parenthetical travels with preceding speech.
The next page repeats the cue with `(CONT'D)` unless that suffix is already
authored (including a curly apostrophe). An authored `(MORE)` consumes the
reserved footer once. Distinct authored repeated cues are not treated as
continuation. All generated markers exist only in the PDF derivative.

Semantic lyrics strip leading `~` and use italic, retaining other emphasis.
Forced literal markers remain literal. The first paired `^` is removed by the
pinned parser. Short dual dialogue stays together; asymmetric cue/leading-parenthetical heights are
padded to align the first spoken baselines. Tall dual dialogue is refused as
`render-failed` with `unsupported-publication:dual-dialogue-overflow` rather
than split into misaligned columns. Unpaired dual, cues/parentheticals too large
to retain speech, and scene numbers wider than their 54-point margin are also
explicit unsupported failures. No failed render leaves a PDF.

## Limits and assessment handoff

Sections, synopses, notes, boneyards and unknown title fields are still omitted
by upstream publication, with bounded structured `unsupported-publication:*`
warnings. They are preserved in captured Fountain, never written back. Missing
font glyphs and scripts requiring RTL shaping are refused. The profile's
unsupported catalog feeds the completed M5-04 primary-codec SC005/SC008 support
assessment and verified resource/in-memory layout boundary. M5-06 owns export decisions. These helper guards do not make a
primary-codec fidelity claim. Preview/export UI remains M5-05/06.
Since [AUDIT-EXPORT-WARNINGS](../tasks/AUDIT-EXPORT-WARNINGS.md) export compares
these warnings with the assessment and stops on one the author was not told
about; the helper and its warnings are unchanged.

## Alternatives and consequences

Keeping the unpatched baseline would retain missing continuation, wrong title
numbering and marker/font/viewer defects. A new paginator or renderer would
expand scope and lose the existing proof boundary. Splitting arbitrary dual
columns without tested alignment is refused. The bounded patch keeps the pinned
engine and font licenses, adds no runtime dependency, and changes the helper
tree identity. It depends on private upstream seams, so their source hashes and
reviewed regression corpus must accompany any future version change.

## Evidence and future changes

[Corpus review](../../fixtures/publication/REVIEW.md) and
[M5 evidence](../test-evidence/M5.md#m5-03--frozen-us-letter-profile-and-regression-corpus)
record literal oracles, layout/bounding boxes, font content streams, 22 reviewed
Poppler images, warning-free Ghostscript rendering and offline package tests.
A change to coordinates, line/keep/continuation rules, fonts or renderer versions
requires a new profile version and reviewed evidence. Other platforms/viewer
versions, complex-script shaping, tall dual and full export fidelity remain
open. Native job/cache ownership and integrity policy stay in ADR 0036.

M5-04 assessment evidence: [production assessment](../test-evidence/M5.md#m5-04--production-sc005sc008-assessment), including actual font tables and native resource/layout checks.

Evidence still needed: M5-05/06 preview/export
agreement, M5-07 integration, installed/other-platform and broader viewer checks.
