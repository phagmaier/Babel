# AUDIT-READING-CANDIDATES evidence

## Handoff preparation — 2026-10-05

[Brief](../archive/tasks/AUDIT-READING-CANDIDATES.md),
[next-agent assignment](../archive/handoffs/2026-10-05-reading-candidates.md).
Published baseline `3333402`; preparation is docs-only.
Classification, sample rendering and discrepancy confirmation have not started.

- Focused Prettier **pass** on the five handoff/status/brief/evidence files; no source/config/fixture changes.
- `python3 tools/check-guidance.py` **pass**, 0 problems; `python3 tools/check-links.py --all` **pass**, 1755 links resolve; `git diff --cached --check` **pass**.
- Embedded command preflight **pass**: `bash -n` for both shell blocks, `ast.parse` for the Python block, five literal sources parsed, package scripts and referenced probe paths exist. Commands were syntax-checked, not presented as executed classification evidence.
- Live published `3333402` CI **pass** ([run](https://github.com/phagmaier/Babel/actions/runs/37302717411)). Historical baseline only; this preparation creates no new product verification claim.
- Skipped unit/native/build/matrix reruns: docs-only assignment preparation, existing verified tool invocations documented; actual investigation/probes and any test-only changes require their own focused/shared checks. No defect confirmed or release gate closed here.
- Final evidence addition initially **failed** focused Prettier; formatting corrected and final checks rerun before commit.

## Classification — 2026-10-05

Host `archlinux`, Linux 7.2.8, Node 26.7.0 / pnpm 11.22.0 through mise, helper
Python 3.13.16, Screenplain 0.12.0, ReportLab 4.4.7, Poppler 26.08.0. Helper
tree `808d2276543fce73967f8c66166d5e61a676282e094716da3e42b7831454086a`,
verified exact. Everything below is source-level and helper-level on this host:
no native app, IPC, export UI or installed-package run. Artifacts (ignored):
`target/audit-reading-candidates-fhlDhkm9/`.

**Order.** Literal expectations were committed in `88ffed9` before the first
render ([matrix](../../tests/investigation/reading-candidates.json), SHA-256
`906a5699…cb383` at 05:05 -07:00). Scope probe P4 was added after the first
run, before it was rendered. No expectation was changed after a result.

**Accounting.** Eleven occurrences, seven distinct sources, every one also a
candidate on the current product. Two come from the shared oracle (cases 36
and 111); nine are five generated sources.

| ID  | Occ. | Codec rows (title fields: none) | Assessment                  | Pinned parser                       | PDF (text; ink at 36 dpi)       | Verdict             |
| --- | ---- | ------------------------------- | --------------------------- | ----------------------------------- | ------------------------------- | ------------------- |
| S1  | 1    | heading, blank, action, lyrics  | verified, clean             | Slug; Action, 2 lines, lyric 1      | all three lines; `La la` italic | supported mapping   |
| S2  | 1    | action, blank, lyrics, lyrics   | verified, clean             | Action; Action, 2 lines, both lyric | all three; both lyrics italic   | supported mapping   |
| S3  | 3    | action, blank (tab), boneyard   | verified, clean, 1 boneyard | title `" fade in"`, no paragraphs   | blank page, 0 ink pixels        | **silent omission** |
| S4  | 1    | action, blank (tab), boneyard   | verified, clean, 1 boneyard | title `" cut to"`, no paragraphs    | blank page, 0 ink pixels        | **silent omission** |
| S5  | 2    | action, blank (tab), boneyard   | verified, clean, 1 boneyard | title `" cut to"`, no paragraphs    | blank page, 0 ink pixels        | **silent omission** |
| S6  | 1    | action, blank (tab), boneyard   | verified, clean, 1 boneyard | title `" cut to"`, no paragraphs    | blank page, 0 ink pixels        | **silent omission** |
| S7  | 2    | action, blank (tab), boneyard   | verified, clean, 1 boneyard | title `" fade in"`, no paragraphs   | blank page, 0 ink pixels        | **silent omission** |

- **Supported mapping (S1, S2; 2 occurrences).** The sweep's heuristic compares
  codec kind `lyrics` with renderer role `action`. ADR 0037 states the mapping
  ("Semantic lyrics strip leading `~` and use italic"), oracle cases 36 and 111
  state the printed text, and [testing](../testing.md#differential-regression-gates)
  names lyrics as an accepted difference. Rendered: no `~`, lyric lines in
  Courier Prime Italic, other lines upright. Controls K4 (lone lyric, italic)
  and K5 (same words unmarked, upright) show the face check discriminates.
  No correction.
- **Confirmed silent omission (S3–S7; 9 occurrences, 5 sources).** The script
  shows visible Action text and one boneyard. The assessment is verified with
  no issue, layout verified, and its summary names only the boneyard. The
  pinned parser reads a title page with one unknown key and no paragraphs; the
  PDF is one blank page (`pdftotext` empty, no embedded font, 0 non-white
  pixels; all five and K3 are the same bytes, `8d3f24c1…fa65`). Contrary to
  SPEC S09.2 (an explicit decision for an unknown title field and for any text
  the renderer would drop), INV-03, and the
  [validation contract](../screenplay-validation.md#audit-d04-omission-summary-and-inline-hidden-text)
  ("an indented first key makes it a title page that prints nothing; both are
  blocking SC005"). Control K3, the same source without the boneyard line, is
  blocked with that SC005; control K2, with an empty separator, is clean and
  prints `FADE IN:`. Fix brief: [AUDIT-D04-R4](../archive/tasks/AUDIT-D04-R4.md).
- **Adequately reported unsupported cases.** None among the seven. Controls K3
  and scope probe P3 are reported by existing SC005 limitations.
- **Unresolved contract questions.** None for the seven sources. One adjacent
  question for the owner: the helper's receipt carries
  `unsupported-publication:unknown-title-fields` for S3–S7, but by reading
  `src/application/exportPdf.ts` export review depends only on assessment
  issues; the preview panel alone shows helper warnings. Whether export should
  stop on a helper warning the assessment did not predict is not decided by
  SPEC S12.2 or ADR 0037 and is outside AUDIT-D04-R4.

**Scope probes (hand-written, not sweep candidates).** P1 (body text after
S3), P2 (unindented first line, tab before the boneyard) and P4 (a second,
indented visible line under the boneyard) are all verified and clean; their
PDFs print only `A lamp glows.` P4 drops two visible lines. P3 (boneyard
between two title fields) prints `Author: Sam` as script text and is blocked.

**Checks.**

- `pnpm pdf-helper` **pass**, 1475 files; wall time not captured. `python3 tools/pdf-helper/verify_runtime.py target/pdf-helper/runtime --exact` **pass**, 0 problems, 0.2 s.
- `BABEL_DIFFERENTIAL_REPORT=<root>/probe pnpm test:differential`, gate unmodified: **pass** 3/3, 20.5 s; 70,117 sources, 59,045 distinct, 0 refused, 0 disagreements, 11 candidates, five examples.
- Same with report-only `baselineRoleOccurrences` (`<root>/final`): **pass** 3/3, 21.2 s; identical counts, 11 occurrences listed, 7 distinct sources.
- `BABEL_DIFFERENTIAL_FAULT=capture`, `renderer`, `assessment` with `pnpm test:differential`: each **fails** one test as required, 20.6 s, 21.4 s, 21.2 s.
- `pnpm exec vitest run tests/contract/export-assessment.test.ts tests/contract/renderer-reading.test.ts` **pass**, 171/171 in 2 files, 2.3 s.
- `pnpm test:pdf-helper` **pass**, 16/16, 32.0 s. `python3 -m unittest discover -s tests/tools -p 'test_*.py'` **pass**, 5/5, 0.9 s; the investigation folder is not discovered by `pnpm test`.
- **Red, retained:** `BABEL_READING_ROOT=<root>/classification-2 pnpm exec vitest run --config tests/investigation/vitest.config.ts` exit 1, **8 failed**, 26 passed: S3–S7, P1, P2, P4 each `missing: ["FADE IN:"]` or `["CUT TO:"]` (P4 also `"Maya waits."`) under a clean assessment. First run without P4 (`classification-1`): 7 failed, 25 passed. Logs beside each directory.
- `pnpm check` **pass**, 87.7 s: guidance 0 problems, links resolve, format, lint, typecheck, unit/UI 1319/1319 in the same 74 files, build. With the new brief tracked, `python3 tools/check-links.py --all` **pass**, 1776 links; `git diff --cached --check` **pass**.
- Skipped: Rust format/Clippy/tests, browser smoke, native drills and the tmpfs/Btrfs matrix. No product source, Rust, DOM or filesystem path changed; the change is test reporting, an investigation probe and docs.

**Limits and corrections.**

- The dry run read italics from Poppler's font family, which omits the style, and reported every line upright. Corrected to Poppler's `<i>` runs, cross-checked with `pdffonts`, before the recorded runs; `dry-run-1` is retained.
- Text roles are read from extracted text, face and left edge; no layout, emphasis beyond italic, Unicode or native check. The export-flow statement is a source reading, not a run.
- The sweep found five sources of this shape; the hand-written probes show the shape is wider, so five is a floor. S3 alone occurs three times where uniform sampling of this generator's choices would give about 0.013 (my estimate from its token counts), so the fixed-seed sweep covers a narrower set than 70,000 suggests. Seed and generator are unchanged.
- The assessment's layout was verified with an empty probe list; none of these samples has a dialogue group or numbered heading.
