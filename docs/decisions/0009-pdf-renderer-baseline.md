# ADR 0009 — PDF renderer proof baseline

AUDIT-SLP-B (2026-10-03) retired superseded proof programs; linked deleted
sources use the last pushed pre-deletion snapshot. Historical observations and
failures below remain unchanged. [Retirement scope](../tasks/AUDIT-SLP-B.md) and ported production
coverage are recorded separately; no new admission claim.

Status: Accepted direction. Date: 2026-09-28. Task: M1-03.
Sources: [SPEC S12](../../SPEC.md#s12), PDF-01–04, INV-03/10/13/14;
[pdf-and-formatting](../pdf-and-formatting.md); [ADR 0004](0004-continuous-editor-pdf-preview.md).
Evidence: [M1 report](../test-evidence/M1.md) (M1-03 section),
[proof harness](../../prototypes/pdf/README.md),
[coverage matrix](../../prototypes/pdf/COVERAGE.md).

## Decision

Proceed to M5 with **Screenplain 0.12.0 (MIT) + ReportLab 4.4.7 (BSD) +
bundled Courier Prime (OFL)** as the baseline layout engine for the pinned
US Letter profile, subject to the gates below. The M1-03 proof rendered a
four-file synthetic corpus offline (2/6/3/2 Letter pages): title template
and numbering, scene numbers in both margins, action/dialogue/parenthetical
columns, side-by-side dual dialogue, centered/transition alignment,
explicit breaks, emphasis, and mid-token long-word wrapping without
hyphenation all observed. A heading held with its dialogue four lines above
the page foot; a ~2300-character monologue split mid-speech across pages.
Layout is deterministic (identical extracted text across runs; byte hashes
differ in CreationDate/ModDate/ID).

Acceptance is conditional because the proof also records silent gaps that
M5 must close before any faithful-export claim: the mid-speech split
carries no `(MORE)` marker and no repeated cue; lyrics `~` leaks
literally; sections/synopses, notes, boneyards, and unknown title fields
are dropped with no diagnostic; CJK/emoji/RTL render as blank gaps with no
SC008 warning; a two-page title leaves the first body page numbered `2.`;
no source map; an unused `/Helvetica` base-14 resource rides on every page;
Ghostscript 10.07 renders with a CMap/Adobe-spec conformance notice
(Poppler clean). The adapter must add SC005/SC008 blocking warnings, fix
or reject the dual `^` caret leak and lyrics marker, specify
continuation/keep/numbering rules in the frozen profile, and declare the
exact font set. No custom paginator is built now.

Packaging: the proof venv is 49MB (reportlab 8.8MB, pillow 7.2MB,
screenplain 612KB, Courier Prime ~370KB) plus a Python interpreter. The
end-user bundle must not assume system Python/Node (SPEC S01): M5 ships a
bundled helper/sidecar or equivalent offline package verified on each
declared release platform, with transitive licenses (MIT/BSD/OFL +
pillow/charset-normalizer) collected before distribution.

## Consequences and alternative

M5 builds one pinned adapter (immutable source bytes + profile/font
identities in, PDF + page count + identities + warnings out), isolated
worker/helper execution, preview/export from the same snapshot, and
layout/text/image goldens (never checksum equality). No guessed page
count or editor markers without a tested source map. Render timings here
(23–32ms primary for 2–6 pages, 16ms fallback) are background measurements, not input-path
claims; typing invalidates freshness and stale jobs never overwrite newer
results.

The motivated fallback is **pdf-lib 1.17.1 (MIT, pure JS)**: the proof
renders a 2-page US Letter Courier baseline with greedy wrap and
hard-split long tokens, proving the bundled-JS path exists. Its cost —
a from-scratch screenplay paginator (keep-with-next, MORE, dual,
title template, warnings, source map) — is why it stays deferred. It is
revived only if the bundled-Python package fails platform, license, or
conformance gates. No second renderer ships in v1; Typst/custom engines
remain un-evaluated alternatives, not mandates. This ADR changes no SPEC
geometry or rule.

Evidence still needed: M5 frozen profile coordinates, warning/guard
tests, dual/lyrics fixes, continuation spec, content-stream font audit,
Tier 1 viewer + installed-offline export checks, preview/export
agreement and cancellation races, and full S12.6 gate.
