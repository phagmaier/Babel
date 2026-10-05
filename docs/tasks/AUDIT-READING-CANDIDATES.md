# AUDIT-READING-CANDIDATES — classify baseline source-role candidates

Status: **classified 2026-10-05**; no product change.
[Evidence](../test-evidence/AUDIT-READING-CANDIDATES.md#classification--2026-10-05).
Eleven occurrences are seven sources: two supported lyric mappings and five
confirmed silent omissions of visible text behind a clean assessment, with
retained red evidence and fix brief [AUDIT-D04-R4](AUDIT-D04-R4.md).
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

## Sample matrix and literal expectations

Written 2026-10-05 before any sample was rendered. Report-only instrumentation
in the renderer gate (`baselineRoleOccurrences`; predicate, seed, assertions and
baseline untouched) lists all eleven occurrences: **seven distinct sources**.
Executable copy with exact bytes: [matrix](../../tests/investigation/reading-candidates.json).

| ID  | Occurrences (corpus index) | Source (JSON-escaped)                        | Script shows as printed                           | Must not print |
| --- | -------------------------- | -------------------------------------------- | ------------------------------------------------- | -------------- |
| S1  | 1 (oracle 36)              | `INT. LAB - DAY\n\nA lamp.\n~La la\n`        | heading, `A lamp.`, italic `La la`                | `~`            |
| S2  | 1 (oracle 111)             | `A lamp glows.\n\n~La la la\n~DEE DEE DEE\n` | `A lamp glows.`, italic `La la la`, `DEE DEE DEE` | `~`            |
| S3  | 3 (6019, 56100, 57114)     | ` FADE IN:\n\t\n /* bone */\t\n`             | `FADE IN:`                                        | `bone`         |
| S4  | 1 (7963)                   | ` CUT TO:\t\n\t\n /* bone */\t\n`            | `CUT TO:`                                         | `bone`         |
| S5  | 2 (18055, 66441)           | ` CUT TO: \n\t\n /* bone */\t\n`             | `CUT TO:`                                         | `bone`         |
| S6  | 1 (34346)                  | ` CUT TO:  \n\t\n /* bone */\t\n`            | `CUT TO:`                                         | `bone`         |
| S7  | 2 (37680, 49188)           | ` FADE IN: \n\t\n /* bone */\t\n`            | `FADE IN:`                                        | `bone`         |

Controls K1–K6 (ordinary body, empty-line separator, no boneyard, lone lyric,
unmarked action, supported title field) and hand-written scope probes P1–P3
(body text after S3, unindented first line, boneyard between title fields) are
in the matrix. Scope probes bound a possible fix; they are not sweep candidates.
P4 (a second visible line under the boneyard) was added after the first run.
P5 and P6 (sibling arms, a literal `/*` in a title field) were added for
AUDIT-D04-R4. Corpus indexes above are for the 117-case oracle; AUDIT-D04-R4
appended ten cases, so generated indexes are ten higher since.

**Invariant under test** (SPEC S09.2, INV-03; ADR 0037 lyrics): when the
assessment is verified with no blocking issue, the helper's PDF prints every
listed visible string and no hidden string, lyric text is italic and other
text is not. A blocking SC005 satisfies it by reporting. Expectations come
from Fountain semantics and those clauses, not from the codec, mirror or renderer.

Probe (needs `pnpm pdf-helper` and Poppler; green since AUDIT-D04-R4):

```sh
BABEL_READING_ROOT="$(mktemp -d "$PWD/target/audit-reading-candidates-XXXXXXXX")" \
  pnpm exec vitest run --config tests/investigation/vitest.config.ts
```

It renders each sample through helper protocol 1 into the fresh root, keeps
source, PDF, receipt, stderr and `pdftotext -layout` text, and records codec
rows/title fields, assessment status/issues/omissions, mirror and actual pinned
parser readings and per-line font and indent. It runs by name only: outside
`pnpm test`, the differential gate and CI. Required before commit: the focused
command above, `pnpm test:differential`, `pnpm test:pdf-helper`, tooling
discovery (`python3 -m unittest discover -s tests/tools -p 'test_*.py'`) and
`pnpm check`. Skipped: Rust, browser, native and matrix gates (no product,
Rust, DOM or filesystem path changes).

Record accepted profile mappings with existing contract/evidence references;
any real discrepancy gets a red independent regression and a narrowed fix
brief before changing behavior. Do not suppress SC005, change the pinned
profile, alter fixture bytes or advance the baseline to erase a candidate.
Stop after classification; native export or implementation needs its own scope.
