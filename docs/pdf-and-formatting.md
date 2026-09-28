# PDF and formatting

Status: planned; renderer choice is **pending M1 proof**. [SPEC S12](../SPEC.md#s12); PDF-01–04, INV-03/10/13/14.

Evaluate an existing offline renderer first; Screenplain is an initial candidate, not an accepted engine. M1 must compare supported elements, pagination, licensed font embedding, packaging without end-user Python/Node, determinism, source mapping, performance, and failure behavior. Do not create a custom paginator before evidence warrants it. The selected adapter takes immutable source bytes and source version/hash, project identity, layout-profile version, pinned font identities, and export options. It returns PDF, actual page count, renderer/profile/font identities, warnings, and only a genuinely supported source map.

The first publication profile is US Letter with 12-point licensed Courier-style mono, documented margins/columns/title page/page numbering. Exact geometry, baseline, split/continuation rules, font assets, and profile version are frozen only after proof and visual review. A4 is a distinct future profile. Unicode source must survive even when a profile cannot render a glyph; that limitation is surfaced before misleading export.

Preview and export consume the same captured source, renderer, profile, and fonts. Typing invalidates page-count freshness; cancelled/stale jobs cannot replace newer results. No approximate in-editor page markers unless a tested source map exists. Evidence must inspect page dimensions, count, text order, bounding boxes, clipping, continuation/dual dialogue, rendered images, viewer readability, and offline packaging. PDF byte metadata may vary while layout remains deterministic. [ADR 0004](decisions/0004-continuous-editor-pdf-preview.md).
