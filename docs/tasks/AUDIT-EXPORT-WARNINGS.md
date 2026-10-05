# AUDIT-EXPORT-WARNINGS — stop an export the renderer warns about and the check did not predict

Status: **proposed 2026-10-05; not started.** The owner delegated this scoping
decision to the agent on 2026-10-05; the agent kept it out of AUDIT-D04-R4 as a
separate task. Complete the design and the checks below before claiming it.
Origin: [classification evidence](../test-evidence/AUDIT-READING-CANDIDATES.md#classification--2026-10-05).
Requirements: SPEC S09.2, S12.2, INV-03; ADR 0037 limits and assessment handoff.

## Finding

The helper's receipt lists `unsupported-publication:*` warnings: boneyards,
notes, sections, synopses and unknown title fields. By reading
`src/application/exportPdf.ts` and `requiresExportReview`, export review depends
only on Script Check issues; only the preview panel shows helper warnings. For
the AUDIT-D04-R4 sources the helper warned `unknown-title-fields` while the
assessment was clean, and nothing compared the two. That fix closes the known
shape. A comparison at export would stop the same class of omission whatever
the assessment or its parser mirror misses next. Not verified in the native app.

## Design to settle first

- **What a verified assessment predicts.** Omission counts give boneyards,
  notes, sections and synopses. Unknown title fields are blocking SC005 issues
  with no structured category; decide whether issues gain one or the assessment
  exposes a predicted-warning set.
- **Both directions.** A warning the assessment did not predict means the
  renderer omitted something unannounced. A predicted omission the renderer
  does not warn about means hidden text may print. Decide whether both fail.
- **Outcome on mismatch.** Recommended: no PDF is published, the rendered
  artifact is discarded, the export fails with a message naming the category,
  and source, Save and recovery are untouched. No automatic acceptance.
- **Where.** Recommended: the frontend export use case, comparing the receipt
  with the assessment captured for the same version and hash. The helper,
  profile, pins, codec and assessment rules stay unchanged.
- **Limit.** Categories only: matching categories do not prove matching extent.

## Draft acceptance

Red first: a render result carrying `unknown-title-fields` beside a clean
assessment must not reach a successful export. Cases for each category in each
direction, stale and cancelled renders unchanged, wording reviewed in the
export panel. The executing agent names the tier, exact focused commands and
native drill modes here before coding; this draft names none yet.
