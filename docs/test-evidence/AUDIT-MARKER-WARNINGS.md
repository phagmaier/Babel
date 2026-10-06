# AUDIT-MARKER-WARNINGS — located review for original marker warning spans

2026-10-05, main from clean `50cd9cb`, local only.
[Brief](../archive/tasks/AUDIT-MARKER-WARNINGS.md). **Complete:** exactly two retained
note-warning gaps and one boneyard-warning gap now have located blocking SC005.
The helper detects marker patterns over original source, including matches
crossing regions or paragraphs that assessment previously reported separately.
Only an otherwise unannounced match gets the new review; it targets the full
original opening-through-closing lines/bytes and adds no non-printing count.
The existing issue limit applies before an announcement can be added.

The export guard is unchanged. The three sources require explicit review before
destination selection; cancellation retires the capture without publication,
recapture/acknowledgement succeeds with the actual known warning categories,
and an added unknown category still refuses publication. Existing contracts
also retain rejection of unrelated known and unreadable warnings. Matching
categories do not prove matching extent or general publication fidelity.

## Independent scope and preservation

[Shared literals](../../fixtures/assessment/marker-reading.json) add three
separate `warningCases`, transcribed from the retained MARKER-READING warning
report. Its six reading sources, literal expectations and two controls are
unchanged. Original raw-source review pins spans **1–6** (boneyard), **5–9**
(note inside a globally removed boneyard) and **1–9** (note pattern across
paragraphs), using zero-based lines. In the third case the parser/PDF actually
prints the note brackets: a global warning is not proof that one whole note is
omitted. The new wording asks to review what prints instead of claiming that.

Pinned parser classes/text, helper warnings and extracted PDF text independently
verify all three originals and BOM/CRLF variants. Exact helper receipts/source
hashes and six PDFs/texts are retained. A separate comparison loads assessment
and codec from **Git `50cd9cb`**: each variant gains exactly one new located
issue and only its missing category; all previous issues, omission counts,
layout/truncation state and reading facts match. The eight prior reading/control
assessments are also identical. Contracts verify exact unchanged source bytes
and no-op serialization; editor/Undo/save/recovery code is unchanged.

The supplemental gate now requires zero unannounced warnings and the exact
three corrected original source/category outcomes. Their historical hashes
remain under `resolved`: notes **2**, `bac97937…66dbe9`; boneyards **1**,
`cfd54f03…cbf594`. The six reading outcome hash
`02e96646909c0d0720b6efbedaf1cdfa17e4bbda0e507f8d66e515f067cff6d1`,
398 title corrections, 634 preparation refusals, corpus bytes/seeds, baseline
`8084690` and literal R4 admission changes are unchanged. Both corpora have
zero new reading/clean/admission regression, warning refusal or unknown category.
Counted-but-unwarned occurrences stay reported (frozen 1, supplemental 17).

The first pre-fix test run also exposed test assumptions: an assessment may
announce categories the helper does not warn about, and `proceed(false)` keeps
review open rather than cancelling. Correcting those assertions before behavior
edits produced exactly six defect failures and one passing issue-limit control.
Both raw red logs are retained; no product code changed before the corrected red.

Fresh ignored root: `target/audit-marker-warnings-20261005/`. Each check has
exact command array, exit code, elapsed seconds and full `<label>.json/.log`.
Four uninjected reports and four fault reports preserve every generated outcome.
`literal-review.json`, `prior-comparison.json` and `preservation.json` retain
independent parser/PDF, Git-control and artifact audits. Initial inspection PDFs
remain beside the final six literal PDFs; no historical output was overwritten.

## Checks

All pnpm commands use `mise exec node@26.7.0 pnpm@11.22.0 --`.
`R=target/audit-marker-warnings-20261005`; `D` is
`pnpm exec vitest run --config tests/differential/vitest.config.ts tests/differential/renderer.test.ts tests/differential/mixed-renderer.test.ts`.
Checks use `python3 $R/run-check.py <label> <command>` to preserve raw output.

| Command                                                                                                                                                                                                                | Kind                                                      | Result                                                                                                                                                          | Elapsed         | Skips / limits                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------- |
| `pnpm exec vitest run tests/contract/marker-warnings.test.ts tests/contract/export-pdf.test.ts -t AUDIT-MARKER-WARNINGS`                                                                                               | Red JSDOM/injected contracts                              | Expected FAIL: six defect assertions, one PASS                                                                                                                  | 1.820 s         | Initial test-assumption failure retained, 1.801 s                      |
| `pnpm exec vitest run tests/contract/marker-warnings.test.ts tests/contract/marker-reading.test.ts tests/contract/renderer-reading.test.ts tests/contract/export-assessment.test.ts tests/contract/export-pdf.test.ts` | JSDOM/injected contracts                                  | PASS, 338 tests                                                                                                                                                 | 3.388 s         | Exact bytes, issue cap, review/cancel/export guard; no native workflow |
| `python3 tools/pdf-helper/verify_runtime.py target/pdf-helper/runtime --exact`                                                                                                                                         | Pinned helper identity                                    | PASS, 1,475 files; unchanged tree `808d2276…4086a`                                                                                                              | 0.208 s         | No rebuild needed                                                      |
| `pnpm test:pdf-helper`                                                                                                                                                                                                 | Actual parser/helper/PDF text                             | PASS, 17 tests / 173 helper runs                                                                                                                                | 34.250 s        | Synthetic fixtures; no WebView/pixel/layout claim                      |
| `python3 $R/literal-review.py`                                                                                                                                                                                         | Independent original-source/parser/PDF review             | PASS, exact three old sources/category hashes, six PDFs/receipts/texts and raw spans                                                                            | 1.931 s         | BOM/CRLF included; historical six-reading hash retained                |
| `pnpm exec vitest run --config $R/comparison.config.ts`                                                                                                                                                                | Git `50cd9cb`/current domain comparison                   | PASS, six warning variants and eight unchanged reading/control assessments                                                                                      | 2.223 s         | Exactly one new issue/category per warning variant                     |
| `BABEL_DIFFERENTIAL_REPORT=$PWD/$R/final D`                                                                                                                                                                            | Actual pinned parser/warnings, frozen/current comparisons | PASS, four gates over both 70,000-source corpora plus shared oracles                                                                                            | 58.737 s        | Capture gate skipped: codec/bridge unchanged                           |
| `BABEL_DIFFERENTIAL_FAULT=announced BABEL_DIFFERENTIAL_REPORT=$PWD/$R/fault-announced D`                                                                                                                               | In-memory rejection check                                 | Expected FAIL: both warning gates reject assertion differences; both reading gates PASS                                                                         | 56.657 s        | No setup/timeout failure; other injections unchanged                   |
| `pnpm lint`; `pnpm typecheck`                                                                                                                                                                                          | Tier 2 static                                             | PASS                                                                                                                                                            | 6.064 / 9.630 s | Unrelated full frontend/Rust/build checks skipped                      |
| `python3 $R/preservation.py`                                                                                                                                                                                           | Independent read-only scope/artifact review               | PASS: 501 inventoried files, 307 historical files, 483 additional inputs, whole native register, core/binaries/strict failure and unrelated inventory unchanged | 0.985 s         | No native execution; final docs audit recorded separately              |
| touched-file Prettier; `python3 tools/check-links.py`; `pnpm check:guidance`; `git diff --check`                                                                                                                       | Tier 1 final docs/static                                  | PASS after content-preserving handoff line folding; initial budget failure retained                                                                             | unknown         | Exact commands/results retained in closeout logs                       |

Native trials, browser smoke, Rust/filesystem matrices, desktop/package builds,
installed/offline admission, full frontend suites and CI are unrun: no native,
filesystem or DOM/input boundary changed; the owner prohibits native trials.
Renderer/assessment rejection modes use unchanged assertions/injections and
[prior evidence](AUDIT-MARKER-READING.md#checks); capture mode is unaffected.
No corpus expansion, artifacts pruned, runtime/pin change, push, tag or amend.

## Disposition and next action

**Repaired with independent evidence:** exactly the three warning gaps.
Both fixed corpora now have no marker reading/warning gaps; no further marker
task is selected. Preparation refusals remain retained unsupported outcomes,
not an automatic follow-up. Stop after this evidence/handoff and a task-ID local
commit on main; select any new work separately with its own bounded brief.

M6-02/M6-03/C1/F2/Local v1 admission remain blocked/open as recorded; the
separate SPEC S15.5 owner-only R4/C1/F2 disposition remains blocked. No native
finding, raw failure, register row or release-risk acceptance changed. No
automatic native repeat, snapshot/guard/predicate/timer, F4/group F or M7 work.
