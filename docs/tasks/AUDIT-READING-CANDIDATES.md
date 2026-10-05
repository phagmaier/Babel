# AUDIT-READING-CANDIDATES — classify baseline source-role candidates

Selected next for bounded classification 2026-10-05; no product fix authorized.
[Owner handoff](../handoffs/2026-10-05-reading-candidates.md) supplies context,
commands, completion and stopping boundaries. Origin:
[INFRA-INSTRUCTIONS](INFRA-INSTRUCTIONS.md) standing generated-source gate.
The frozen `8084690` control and unchanged product each have eleven clean
source-role **heuristic candidate occurrences** in the 70,117-source sweep. The mirror
agrees with the actual pinned parser on all sources; these candidates concern
codec/profile interpretation, not a new parser-mirror regression.

## Bounded question

Separate deliberate supported mappings (for example lyric rows read as Action)
from an unreported omission or role change. One suspicious synthetic source is
` FADE IN:\n\t\n /* bone */\t\n`: codec body text versus a renderer title block.
This is a candidate, not a confirmed author-content loss or an accepted waiver.
Artifacts: `target/infra-instructions/review-probe.renderer.json`.
A fresh `BABEL_DIFFERENTIAL_REPORT=<new-prefix> pnpm test:differential` regenerates
counts/examples without depending on that ignored artifact. Sources/seed are
tracked; fixtures and product source are unchanged.
The report retains only the first five examples. Collect the complete list with
test-only reporting, deduplicate exact sources, and account for all occurrences;
eleven occurrences are not necessarily eleven distinct sources or defects.

## Acceptance and checks

Tier 2 investigation: review source, assessment issue/omission result and the
actual pinned parser; render only synthetic samples through the helper and
independently inspect `pdftotext`, plus paragraph roles where text is identical.
Focused: `pnpm exec vitest run tests/contract/export-assessment.test.ts tests/contract/renderer-reading.test.ts`;
shared [differential policy](../testing.md#differential-regression-gates).
Write exact sample-render commands and literal expectations before claiming
this investigation; these depend on its selected candidates. No native or
second-filesystem check for a read-only parse/render investigation.
Use the handoff's fresh-root/helper-render recipe; record the selected literal
expectations first. Evidence belongs in
[task evidence](../test-evidence/AUDIT-READING-CANDIDATES.md). Shared gates follow
[development tiers](../development.md#check-tiers-use-the-lowest-tier-that-covers-the-change);
tracked test/reporting changes include `pnpm check`, with omissions justified.

Record accepted profile mappings with existing contract/evidence references;
any real discrepancy gets a red independent regression and a narrowed fix
brief before changing behavior. Do not suppress SC005, change the pinned
profile, alter fixture bytes or advance the baseline to erase a candidate.
Stop after classification; native export or implementation needs its own scope.
