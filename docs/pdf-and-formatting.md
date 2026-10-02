# PDF and formatting

Status: M1 proof recorded; renderer baseline is **conditional** (Screenplain + ReportLab, [ADR 0009](decisions/0009-pdf-renderer-baseline.md)). M5-01 bundles it as an offline standalone-CPython helper ([ADR 0036](decisions/0036-bundled-pdf-helper.md), [evidence](test-evidence/M5.md#m5-01--bundled-offline-renderer-helper)); M5-02 native service and M5-03 frozen profile are complete; M5-04 adds production assessment; preview and export remain M5-05–07. [SPEC S12](../SPEC.md#s12); PDF-01–04, INV-03/10/13/14.

Evaluate an existing offline renderer first; Screenplain was the initial candidate and is now the conditional M5 baseline per [ADR 0009](decisions/0009-pdf-renderer-baseline.md), not an unconditional engine. M1 compared supported elements, pagination, licensed font embedding, packaging without end-user Python/Node, determinism, source mapping, performance, and failure behavior. Do not create a custom paginator before evidence warrants it. The selected adapter takes immutable source bytes and source version/hash, project identity, layout-profile version, pinned font identities, and export options. It returns PDF, actual page count, renderer/profile/font identities, warnings, and only a genuinely supported source map.

The first publication profile is US Letter with 12-point licensed Courier-style mono, documented margins/columns/title page/page numbering. Exact geometry, baseline, split/continuation rules, font assets, and profile version are frozen only after proof and visual review. A4 is a distinct future profile. Unicode source must survive even when a profile cannot render a glyph; that limitation is surfaced before misleading export.

Preview and export consume the same captured source, renderer, profile, and fonts. Typing invalidates page-count freshness; cancelled/stale jobs cannot replace newer results. No approximate in-editor page markers unless a tested source map exists. Evidence must inspect page dimensions, count, text order, bounding boxes, clipping, continuation/dual dialogue, rendered images, viewer readability, and offline packaging. PDF byte metadata may vary while layout remains deterministic. [ADR 0004](decisions/0004-continuous-editor-pdf-preview.md).

M1-03 observed on a four-file synthetic corpus (`prototypes/pdf/`, 2/6/3/2 Letter pages): geometry, title template/numbering, scene numbers, dialogue columns, side-by-side dual, centered/right transitions, explicit breaks, emphasis, and hyphen-free long-word splits pass; a heading holds with its dialogue near the foot and a long monologue splits mid-speech with no `(MORE)` marker; lyrics `~` leaks, first-pair dual `^` leaks, sections/synopses/notes/boneyards/unknown title fields drop silently, CJK/emoji/RTL render as blank gaps without warning, a two-page title leaves the first body page numbered `2.`, no source map exists, and Ghostscript notes a ReportLab conformance warning (Poppler clean). The M5 adapter must add SC005/SC008 guards, fix or reject the marker leaks, freeze continuation rules, audit the stray Helvetica resource, and ship a bundled offline package. The pdf-lib fallback probe proves a JS-bundled path at the cost of a from-scratch paginator and stays deferred. See [M1 evidence](test-evidence/M1.md), [coverage](../prototypes/pdf/COVERAGE.md), and [ADR 0009](decisions/0009-pdf-renderer-baseline.md).

M5-03 freezes `us-letter-draft-v1` ([ADR 0037](decisions/0037-us-letter-draft-profile.md))
over the pinned renderer. Native/frontend results require `profileFrozen: true`;
this is a layout identity, not a fidelity assessment. The
[reviewed corpus](../fixtures/publication/REVIEW.md) covers geometry, title/body
numbering, continuation/keep/oversized splits, lyrics and short dual, exact text,
font streams, bounding boxes and 22 images. Tall dual, unavailable glyphs/shaping
and structurally oversized cues/parentheticals are refused; known upstream
omissions carry structured warnings for M5-04. Source maps remain unsupported.
No publication marker or profile transformation writes back to Fountain.

M5-04 connects primary-codec SC005 support mapping and pinned-font SC008 coverage
with actual bundled identity verification and read-only in-memory probes for
layout-dependent limitations. The [Script Check contract](screenplay-validation.md#m5-04-publication-assessment)
owns severities, shaping limits, stale/failure behavior and source targets.
These are support diagnostics, not PDF export/page-count receipts. M5-06 owns
explicit export decisions and M5-07 the integrated gate.
