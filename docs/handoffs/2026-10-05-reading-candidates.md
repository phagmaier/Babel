# Next-agent assignment — AUDIT-READING-CANDIDATES

Begin one bounded investigation in `/home/phagmaier/Code/Babel`:
**AUDIT-READING-CANDIDATES**, classifying existing source-role candidates.
This assignment authorizes investigation, synthetic probes, test-only reporting
and a narrowed follow-up brief. Product fixes and feature work remain paused.
Stop after classification and handoff; commit locally on main, without pushing.

## Why this task comes first

Author-content safety takes priority over new features. The new differential
gate found eleven candidate **occurrences**, already present in frozen F4-05
`8084690`, which need semantic review. Some are deliberate lyric mappings;
some sources look like body text to the codec but like a title block to the
renderer. A verified assessment could therefore require closer investigation.
These are not eleven confirmed defects, and the published product was not
changed by the maintenance work. Classify actual outcomes before proposing fixes.

## Repository and evidence baseline

- Published main is `3333402`; its [GitHub CI passed](https://github.com/phagmaier/Babel/actions/runs/37302717411).
  A local handoff-preparation commit may follow it. Inspect actual HEAD/status;
  preserve existing work and do not reset to the published baseline.
- Divergence was resolved by normal merge `4eafd58`, preserving public
  `beac0fc`, its local documentation correction and F4-05 `8084690`.
  Do not amend published commits or force-push.
- INFRA-INSTRUCTIONS is complete. Task selection comes from
  [current-state Next action](../current-state.md#next-action); trackers report
  status. This owner-provided assignment selects classification only.
- Recorded maintenance checks: 1,319 unit/UI tests in 74 tracked files,
  273 Rust tests, 16 helper tests, five tooling tests, three differential tests,
  Chromium smoke and Linux package build passed. These are baseline evidence,
  not fresh verification of your changes or native writing/IME acceptance.
- The renderer gate compared 117 shared oracle sources plus 70,000 generated
  samples (59,045 distinct sources): zero parser/mirror disagreements and
  zero new assessment regressions. Capture compared 848 editor rewrites and
  16,128 codec edits. Keep the fixed seed, literal oracles and frozen baseline.

## Read only the needed context

1. Root [AGENTS.md](../../AGENTS.md), [current-state](../current-state.md),
   the selected row in [audit tracker](../tasks/AUDIT-TRACKER.md), and
   [task brief](../tasks/AUDIT-READING-CANDIDATES.md).
2. [Differential policy](../testing.md#differential-regression-gates),
   [check tiers](../development.md#check-tiers-use-the-lowest-tier-that-covers-the-change),
   [helper protocol](../../tools/pdf-helper/README.md#protocol-1),
   [omission/reading rules](../screenplay-validation.md#audit-d04-omission-summary-and-inline-hidden-text),
   and relevant lyric/title/omission clauses in [ADR 0037](../decisions/0037-us-letter-draft-profile.md).
   Resolve expectations against SPEC INV-03, S09 and S12 where needed.
3. Targeted source/tests: `src/domain/fountainCodec.ts`,
   `src/domain/exportAssessment.ts`, `src/domain/rendererReading.ts`,
   `tools/pdf-helper/frozen_profile.py`, `tests/differential/renderer.test.ts`,
   `tests/contract/export-assessment.test.ts`,
   `tests/contract/renderer-reading.test.ts`, and
   `fixtures/assessment/oracle.json`. Read implementation only as needed.

Do not read the entire frozen root AUDIT.md or large audit evidence file.
Use linked historical sections only when a candidate needs their contract.

## Work and acceptance

1. Before claiming execution, finish the brief's sample matrix: exact source
   bytes, independently derived literal expectation, render/probe command and
   required checks. Then claim this task in current-state.
2. Regenerate reports into a fresh output root. The existing serializer records
   only the first five examples even though it counts eleven occurrences.
   Retain the complete list through test-only reporting instrumentation;
   deduplicate exact sources and classify every distinct candidate, accounting
   for every occurrence. Do not alter the predicate, seed, assertions or baseline.
3. For each candidate compare codec rows/title fields, assessment status and
   SC005/omissions, actual pinned parser reading, helper receipt/warnings,
   extracted PDF text and paragraph roles. Inspect PDF pages when extraction
   alone cannot establish the outcome. Include ordinary visible-body and lyric
   controls. A correct parser mirror alone does not prove publication safety.
4. Separate supported mappings, adequately reported unsupported cases,
   confirmed silent omissions/role changes, and unresolved contract questions.
   Cite the existing contract for each disposition; ambiguity is not a waiver.
5. For a real discrepancy, record an independent failing assertion and exact
   red command/result, then write one narrowly scoped fix brief with acceptance,
   affected paths and gates. Keep investigation reproducers outside the default
   passing suite; retain executable provenance rather than merely describing
   the symptom. Do not implement the correction in this assignment.
6. Record results in [task evidence](../test-evidence/AUDIT-READING-CANDIDATES.md),
   update the brief/tracker/current-state, run required checks, commit locally
   with the task ID and stop. Classification may finish with defects still open;
   keep those follow-up obligations explicit. Name one next action based on
   the findings, without starting it.

Initial synthetic sources to investigate, as escaped byte strings:

```text
" FADE IN:\n\t\n /* bone */\t\n"
" CUT TO:\t\n\t\n /* bone */\t\n"
" CUT TO: \n\t\n /* bone */\t\n"
"INT. LAB - DAY\n\nA lamp.\n~La la\n"
"A lamp glows.\n\n~La la la\n~DEE DEE DEE\n"
```

The first source's codec has Action, blank and Boneyard; the mirror has a
three-line title block with no supported keys and no paragraphs. Verify the
actual publication/assessment outcome; do not call that a confirmed loss yet.
Hidden boneyard text and supported lyric formatting need different expectations
from visible body text under the existing contract.

## Executable starting commands

Use the repo's pinned Node 26.7.0, pnpm 11.22.0 and Rust 1.97.1; activate mise
or prefix pnpm commands with `mise exec --`. No dependency upgrades.
Keep helper/runtime builds sequential. From the repo root:

```sh
git status --short --branch
mkdir -p target
export BABEL_READING_ROOT="$(mktemp -d "$PWD/target/audit-reading-candidates-XXXXXXXX")"
pnpm pdf-helper
python3 tools/pdf-helper/verify_runtime.py target/pdf-helper/runtime --exact
BABEL_DIFFERENTIAL_REPORT="$BABEL_READING_ROOT/probe" pnpm test:differential > "$BABEL_READING_ROOT/differential.log" 2>&1
pnpm exec vitest run tests/contract/export-assessment.test.ts tests/contract/renderer-reading.test.ts
```

After writing the literal expected outcome, this recipe renders the first
synthetic title candidate. It writes only into the fresh task root and retains
both successful and failed receipts; repeat other samples with new filenames.

```sh
python3 - <<'PY'
import json, os, subprocess
from pathlib import Path
root = Path(os.environ['BABEL_READING_ROOT']).resolve()
source = b' FADE IN:\n\t\n /* bone */\t\n'
with (root / 'title-candidate.fountain').open('xb') as handle:
    handle.write(source)
runtime = Path('target/pdf-helper/runtime').resolve()
request = {'protocol': 1, 'profile': 'us-letter-draft-v1',
           'output': str(root / 'title-candidate.pdf')}
result = subprocess.run(
    [str(runtime / 'python/bin/python3.13'), '-I', '-S', '-B',
     str(runtime / 'app/babel_pdf_helper.py'), json.dumps(request)],
    input=source, capture_output=True, timeout=90)
for name, data in [('title-candidate.receipt.json', result.stdout),
                   ('title-candidate.stderr.log', result.stderr)]:
    with (root / name).open('xb') as handle:
        handle.write(data)
print('helper exit:', result.returncode)
raise SystemExit(result.returncode)
PY
pdftotext -layout "$BABEL_READING_ROOT/title-candidate.pdf" "$BABEL_READING_ROOT/title-candidate.txt"
```

Run the brief's focused/differential/helper checks and applicable shared gates
from development once before the commit. If tracked TS/JS reporting or tests
change, include `pnpm check`; do not replace shared gates with focused tests.
Docs-only completion needs focused formatting, full links/guidance and
`git diff --check`. Record exact command, result, wall time and skip rationale.
No native drill or second-filesystem matrix is needed for this classification;
product/native behavior is unchanged. A proposed correction gets its own tier.

## Boundaries to preserve

- Do not change product behavior, pinned renderer/profile/fonts, manuscript
  fixture bytes, baseline identity or SC005 safeguards to clear candidates.
- Preserve frozen AUDIT.md, historical red results, ignored raw logs/cores and
  all existing F4 fixes. F4-04 phase H natively covers Dialogue only; broader
  intent recovery and CR/mixed-ending reopen evidence is contract-level.
- M6-02 Save As/IME, C1/F2, retained native crashes, SELinux,
  broader keyboard/accessibility/IME, installed/offline adoption and full
  performance/release acceptance remain open. The
  [native register](../native-findings.md) indexes failures without closing them.
- M6 remains paused. Do not begin M6-03, new history/features, group F or
  owner-only DEV-02. If classification finds no correction needed, recommend
  the bounded M6-02-R1 investigation as a later assignment, without starting it.
- Final report: per-class verdicts and evidence, confirmed discrepancies and
  follow-up brief(s), exact checks and limitations, local commit, one next
  action, and the unchanged release blockers. Then stop.
