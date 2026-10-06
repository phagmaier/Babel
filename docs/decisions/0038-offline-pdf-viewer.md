# ADR 0038 — Bundled offline PDF viewer

Status: Accepted direction; Accepted for bounded Linux M5-05. Date: 2026-10-02.

Context: [M5-05](../archive/tasks/M5-05.md), PDF-02 and INV-10/11/13/14 require
read-only printed pages and exact-count freshness without a second paginator.

Decision: pin `pdfjs-dist` 6.3.289 (Apache-2.0), lazy-load its display module
and bundle its module worker locally. Parse only bytes obtained from the native
M5-02 artifact registry; no URLs, upload, browser plugin or print CSS. Explicit
worker construction prevents a silent main-thread parsing fallback. The native
read command accepts identity, request ID and opaque artifact ID, validates the
current registered artifact under the publication lock, and bounds reads to
32 MiB. It offers no arbitrary path or filesystem endpoint.

Display one page at a time with keyboard navigation, independent 50–150% zoom,
white paper in either app theme, and a read-only extracted-text disclosure.
Cancel rendering and destroy workers/documents on replacement/close. The
viewer verifies its parsed count against the same render receipt; count mismatch
or display failure cannot earn a fresh preview. Renderer warnings remain visible.
Preview is an explicit panel; while open, existing deferred source captures feed
a 750 ms quiet-period render. Content changes invalidate immediately. Closing
cancels preview work and clears its count; no background pagination while closed.
Selection version changes also invalidate the exact captured receipt. This is separate from Save/recovery.

Alternatives: native rasterization would add another bundled PDF interpreter and
platform packaging boundary; embedded WebView PDF support varies by platform.
PDF.js displays the renderer's bytes without making screenplay layout choices.

Consequences: worker/script/font CSP allows only local worker assets and generated
font blobs. No PDF scripting, annotations, remote resources, system font fallback
or imported arbitrary PDF surface. The renderer/profile/font pipeline is unchanged.
PDF.js adds bundle weight; full transitive notices, other-platform WebKit support
and installed-package adoption remain M6. M5-07 verifies extracted AppRun offline.

Evidence: [M5-05](../test-evidence/M5.md#m5-05--authoritative-preview-and-page-count-freshness)
passes bounded Linux races/shared/browser and actual WebKit/tmpfs/Btrfs display,
count, failure/Save and measured rAF typing gates; direct license retained.
[M5-07](../test-evidence/M5.md#m5-07--integrated-publication-exit-and-separate-review)
passes packaged-offline preview/export agreement on tmpfs/Btrfs.
Evidence still needed: M6 full transitive notices, other platforms, installed
adoption, compositor paint and long-session scaling.
