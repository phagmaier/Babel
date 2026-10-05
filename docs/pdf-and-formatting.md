# PDF and formatting

Status: M1 proof recorded; renderer baseline is **conditional** (Screenplain + ReportLab, [ADR 0009](decisions/0009-pdf-renderer-baseline.md)). M5-01 bundles it as an offline standalone-CPython helper ([ADR 0036](decisions/0036-bundled-pdf-helper.md), [evidence](test-evidence/M5.md#m5-01--bundled-offline-renderer-helper)); M5-02 native service and M5-03 frozen profile are complete; M5-04 adds production assessment; M5-05 adds the offline authoritative viewer; M5-06/07 record the bounded Linux export/integration gate; installed/platform admission remains open. [SPEC S12](../SPEC.md#s12); PDF-01–04, INV-03/10/13/14.

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

## Authoritative preview (M5-05)

[ADR 0038](decisions/0038-offline-pdf-viewer.md) selects pinned PDF.js 6.3.289
with a bundled worker. The native read boundary resolves only the current
identity/request/artifact registry entry, returns binary PDF bytes and bounds
reads to 32 MiB. No caller path, URL, arbitrary PDF import or upload endpoint.
The preview parses those exact bytes and verifies page count against that render
receipt before announcing a fresh count. One page canvas at a time, independent
50–150% zoom and read-only extracted page text avoid a second editing/layout
engine. Dark/light themes affect chrome; printed paper stays white.

Opening the PDF preview enables a 750 ms quiet-period job fed by existing deferred
captures. Editor version changes (including selection metadata versions), source
replacement, Undo and identity changes invalidate immediately. Superseded render,
read and display callbacks cannot announce current pages. During updates the
previous captured PDF may remain visible with its version and a stale label;
page count is not advertised as current. Closing clears count, cancels work and
destroys viewer workers. Save/recovery/Undo remain independently owned.
Closing returns focus to the preview toolbar button after its enabled DOM commit;
if Save temporarily disables it, focus return waits for Save. A newer explicit
focus choice by the writer takes precedence ([M5-07](tasks/M5-07.md)).
Renderer warnings stay visible; support limitations, helper/resource/viewer
failure and count disagreement earn no fresh-preview/export success. No page
markers or Script Check page targets exist without a supported source map.
M5-07 owns the integrated preview/export and offline-package gate.

## Captured PDF export (M5-06)

[ADR 0039](decisions/0039-pdf-export-publication.md) defines Linux publication.
Export PDF is available through the shared command palette, native menu and
shortcut registry. A short freeze protects the exact source in recovery and
receives an opaque native capture token; typing resumes for review and rendering.
Review names that captured version, shows all structural warnings and SC005/SC008
source targets, and requires explicit acknowledgment of warnings/limitations.
Unavailable, mismatched, truncated or incomplete assessments refuse export.
The frozen helper still refuses unsupported glyphs, shaping and layout. Source
Save is independently available. Since AUDIT-D04, omitted notes, boneyards,
section headings and synopses are one non-blocking summary line, and a capture
with no blocking limitation and no warning skips review and opens the
destination picker directly; see
[validation](screenplay-validation.md#audit-d04-omission-summary-and-inline-hidden-text).
The profile prints scene headings and forced transitions in capitals and reads
forcing markers and page breaks only at the start of a line; since
AUDIT-D04-R2 assessment reports each such difference as a limitation.

Since AUDIT-EXPORT-WARNINGS the export use case compares the rendered result's
`unsupported-publication:*` warnings with what the captured assessment
[announced](screenplay-validation.md#announced-omissions-and-the-helpers-warnings-audit-export-warnings).
A warning the author was not told about, an unknown warning code or an
unreadable warning list stops the export after rendering and before
publication: the artifact is cancelled, the capture retired, no destination is
written and the status names each category. There is no acceptance step,
because the helper reports no location. Source, Save and recovery are untouched.

Preview and export share one render controller, sequence and native queue.
Preview admission pauses during export. Typing marks preview stale while export
continues over immutable protected bytes; completion resumes the latest preview.
Only the current artifact bound to the native capture token and PDF hash can be
published. A verified receipt reports captured version/source hash, actual pages,
PDF hash and destination filename. Export grants no source-file Save credit.

The GTK picker returns a single-use destination token, never a frontend path.
Only eligible `.pdf` names and existing regular, owned, writable PDFs qualify.
App data, `.screenwriter`, reserved `.babel-` names, every registered source
path/inode, symlinks, hardlinks, changed directory/destination generations and
unpreservable metadata are refused. New files use atomic NOREPLACE; replacements
use EXCHANGE after a verified, synced 0600 previous-PDF copy. Candidate and final
bytes are independently read back. Failed confirmation attempts guarded rollback;
uncertain rollback retains generations and reports attention, never success.
Previous copies and crash candidates are not automatically removed or promoted.

Cancel is available before publication, including review/rendering/picker wait;
late callbacks cannot write a destination. Once atomic publication starts,
Cancel is disabled with an explicit status. This derivative workflow does not
rewrite source, editor Undo or history. No upload, network or shell endpoint is
added. Verification is recorded in [M5 evidence](test-evidence/M5.md#m5-06--captured-pdf-export).

## Reading conformance gate

Changes to codec spelling, export assessment, the parser mirror or renderer
require the [standing differential gate](testing.md#differential-regression-gates)
and shared independent oracle on both sides. Add a hand-written regression for
each discovered divergence. A generated-source sweep supplements those cases;
it does not establish layout/native fidelity or permit baseline retuning.
