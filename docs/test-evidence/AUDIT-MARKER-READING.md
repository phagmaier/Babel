# AUDIT-MARKER-READING — original-source marker removal order

2026-10-05, main from clean `73e79ee`, local only.
[Brief](../tasks/AUDIT-MARKER-READING.md). **Complete:** exactly six retained
supplemental paragraph readings now agree with the actual pinned parser.
Assessment previously stripped codec-recognized inline spans before the mirror
removed boneyards and body notes. That changed which closing marker an earlier
open marker consumed. Reading the original source throughout removes this
ordering error and the opening-title splice; the codec view still classifies
shown content. Existing title/inline-note contracts remain green.

The owner-only R4/C1/F2 SPEC S15.5 review remains **blocked**, as does M6-02 /
M6-03 / Local v1 admission. This task was the explicitly authorized independent
pivot; no native trial, installation, register change or risk acceptance occurred.

## Independent evidence and exact scope

[Shared literals](../../fixtures/assessment/marker-reading.json) preserve all
six original mixed-corpus sources, plus two hand-authored controls. Expectations
were transcribed after reviewing the pinned parser's global boneyard removal,
title/paragraph formation and paragraph-local note removal, then verified by
the actual parser and helper PDF text. They were not generated from Babel's
assessment. All six still require blocking SC005 review; every issue retains
original line/byte targets. Source bytes are identical before/after assessment
and serialization, including BOM/CRLF variants. Editor/Undo/save code is unchanged.

The initial test run also exposed a cross-VM typed-array assertion mismatch
(identical bytes, different realms). Comparing byte arrays corrected the test;
the next pre-fix run had exactly six reading assertion failures and eight passes.
Both raw red logs are retained. No product code changed before that red run.

The supplemental gate requires zero remaining marker disagreements and exactly
six corrected source/pinned outcomes with historical SHA256
`02e96646909c0d0720b6efbedaf1cdfa17e4bbda0e507f8d66e515f067cff6d1`.
Independent replay verifies this hash and literal source identity against the
retained R5 report. Both generated corpora, baseline `8084690`, original
assertions, 398 title corrections, three warning gaps and 634 preparation
refusals are unchanged. No new regression, clean disagreement, admission change,
unknown warning or warning refusal appeared.

Fresh ignored output: `target/audit-marker-reading-20261005/` contains exact
command arrays, exit codes, elapsed seconds and full logs (`<label>.json/.log`),
all four uninjected differential reports, fault reports/logs, eight PDFs and
extracted text, renderer readings and exact helper receipts in
`literal-review.json`, and the independent preservation audit. No layout,
native-writing, CI or release acceptance is claimed.

## Checks

All pnpm commands use `mise exec node@26.7.0 pnpm@11.22.0 --`.
`R=target/audit-marker-reading-20261005`; `D` is the exact command
`pnpm exec vitest run --config tests/differential/vitest.config.ts tests/differential/renderer.test.ts tests/differential/mixed-renderer.test.ts`.
Task-local checks run through `python3 $R/run-check.py <label> <command>`;
the wrapper preserves output and reports the child exit code.

| Command                                                                                                                                                                         | Kind                                                        | Result                                                                                                                                                           | Elapsed                         | Skips / limits                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------- |
| `pnpm exec vitest run tests/contract/marker-reading.test.ts`                                                                                                                    | Red JSDOM domain                                            | Expected FAIL: six reading assertions, eight PASS after byte assertion correction                                                                                | 1.629 s                         | Initial mixed failure retained separately, 1.851 s       |
| `pnpm exec vitest run tests/contract/marker-reading.test.ts tests/contract/renderer-reading.test.ts tests/contract/export-assessment.test.ts tests/contract/export-pdf.test.ts` | Final JSDOM/injected contracts                              | PASS, 331 tests                                                                                                                                                  | 3.398 s                         | Includes exact bytes/SC005; no editor transaction change |
| `python3 tools/pdf-helper/verify_runtime.py target/pdf-helper/runtime --exact`                                                                                                  | Pinned helper identity                                      | PASS, 1,475 files; tree `808d2276543fce73967f8c66166d5e61a676282e094716da3e42b7831454086a`                                                                       | 0.234 s                         | Build skipped: verified runtime unchanged                |
| `pnpm test:pdf-helper`                                                                                                                                                          | Actual helper/parser/PDF text                               | PASS, 17 tests / 170 helper runs                                                                                                                                 | 31.656 s                        | No WebView/native workflow or pixel/layout claim         |
| `python3 $R/literal-review.py`                                                                                                                                                  | Independent retained-source/parser/PDF review               | PASS, exact historical hash and eight retained PDFs/receipts/texts                                                                                               | 2.706 s                         | Synthetic sources only                                   |
| `BABEL_DIFFERENTIAL_REPORT=$PWD/$R/final D`                                                                                                                                     | Actual pinned renderer/warnings, frozen/current comparisons | PASS, four gates over both 70,000-source corpora and existing shared oracles                                                                                     | 57.172 s                        | Capture gate skipped: codec/bridge unchanged             |
| `BABEL_DIFFERENTIAL_FAULT=renderer BABEL_DIFFERENTIAL_REPORT=$PWD/$R/fault-renderer D`                                                                                          | In-memory rejection check                                   | Expected FAIL: both reading gates reject actual assertion differences                                                                                            | 60.264 s                        | Two warning gates PASS; no setup/timeout failure         |
| `BABEL_DIFFERENTIAL_FAULT=assessment BABEL_DIFFERENTIAL_REPORT=$PWD/$R/fault-assessment D`                                                                                      | In-memory rejection check                                   | Expected FAIL: both reading gates reject new clean disagreements                                                                                                 | 60.269 s                        | Capture/announced modes unchanged and skipped            |
| `pnpm lint`; `pnpm typecheck`                                                                                                                                                   | Tier 2 static                                               | PASS                                                                                                                                                             | 6.295 / 9.898 s                 | Unrelated broad frontend/Rust/build checks skipped       |
| `python3 $R/preservation.py`                                                                                                                                                    | Independent read-only artifact/scope review                 | PASS: 501 inventoried files, 307 historical files, 483 additional inputs, entire native register, core/binaries/strict failure and unrelated inventory unchanged | 1.026 s                         | Final docs rerun recorded separately                     |
| `pnpm exec prettier --check <touched text/code>`; `python3 tools/check-links.py`; `pnpm check:guidance`; `git diff --check`                                                     | Tier 1 final docs/static                                    | PASS after formatting the new evidence table; initial style failure retained                                                                                     | 1.153 / 0.262 / 0.641 / 0.005 s | Exact paths/commands retained; no budget exception       |

Native trials, browser smoke, Rust/filesystem matrices, desktop/package build,
installed/offline acceptance and full frontend suites are skipped: no native,
filesystem, DOM/input or rendered UI boundary changed, and native trials are
explicitly prohibited. PDF text checks exercise only the unchanged helper.
No target/history pruning, push, tag, amend or runtime network change.

## Disposition and next action

**Repaired with independent evidence:** six marker reading differences only.
The separate two note-warning gaps and one boneyard-warning gap remain pinned
open; the existing export warning guard still refuses unannounced warnings.
All native/M6 owner gates and original failure records remain unchanged.

Stop after this task's evidence/handoff and local task-ID commit. Next independent
task is **AUDIT-MARKER-WARNINGS**: draft a bounded brief for those exact three
gaps before correction, using original sources and located blocking review.
No automatic corpus expansion, native trial, M6/F4/group F or M7 work follows.
