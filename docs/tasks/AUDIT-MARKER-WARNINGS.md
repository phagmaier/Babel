# AUDIT-MARKER-WARNINGS — located review for three marker warning gaps

Status: **done 2026-10-05**, main from clean `50cd9cb`, local only.
[Evidence](../test-evidence/AUDIT-MARKER-WARNINGS.md).
Selected explicitly by the owner; dependencies AUDIT-MARKER-READING,
AUDIT-D04-R5 and AUDIT-SWEEP-COVERAGE are complete.
Requirements: SPEC S09.2 / INV-03, existing pinned warning/assessment contract.
[Prior disposition](../test-evidence/AUDIT-MARKER-READING.md#disposition-and-next-action),
[tracker](AUDIT-TRACKER.md), [inventory](../../tests/differential/mixed-findings.json).

## Deliverable and acceptance

Close exactly the retained two note-warning gaps and one boneyard-warning gap.
Use their original sources from the prior `.mixed-warnings.json` report; the
six corrected readings are a separate, unchanged set. The helper detects hidden
markers over raw source, while assessment announcements currently examine
individual reported regions/lines. Matches spanning those boundaries can escape
announcement even though the source already requires review.

- Before behavior edits, add independent literals for those exact three
  sources, pinned warning categories, parser/PDF text and original line spans
  to the shared `fixtures/assessment/marker-reading.json`. Preserve its six
  reading cases and two controls. Run focused contracts red first.
- Add blocking SC005 that explains the unverified hidden span and targets its
  original opening-through-closing source lines/bytes. A warning category is
  announced only through that visible review, subject to the existing issue
  limit. No blanket announcement, non-blocking count or export-guard exception.
- Preserve exact original bytes and no-op serialization, including BOM/CRLF
  variants. Existing issues, omissions and reading facts stay unchanged; only
  the missing category's located limitation is added for each retained source.
- Export still waits for explicit review, cancellation retires the capture,
  and matching known warnings permit publication only after acknowledgement.
  An additional unrelated/unknown warning still refuses publication.
- Both fixed 70,000-source corpora pass with zero unannounced warnings or new
  reading/clean/admission regression. Preserve baseline `8084690`, generators,
  six-outcome historical hash `02e96646909c0d0720b6efbedaf1cdfa17e4bbda0e507f8d66e515f067cff6d1`,
  398 title corrections and 634 preparation refusals. Retain the three former
  warning-set hashes as resolved history and assert their exact corrected sets.
- Preserve native register, inventoried artifacts, cores and strict failures.
  Complete compact evidence, tracker/handoff and a task-ID local commit.

## Do NOT do

Change codec/editor, renderer reading/removal rules, helper/profile/fonts/pins,
export warning acceptance, Rust/IPC/save/recovery/snapshot or native
guard/predicate/timer behavior. No new corpus, frozen audit/evidence overwrite,
baseline advance, native trial, runtime installation, native-register change,
crash closure or risk acceptance. No M6-02/M6-03/C1/F2/Local-v1 admission,
owner S15.5 disposition, F4/group F, M7, pruning, push, tag or amend.

## Exact checks and stop

Lowest tier: **Tier 2 domain logic**. All pnpm commands use
`mise exec node@26.7.0 pnpm@11.22.0 --`; fresh logs/PDFs go to
`target/audit-marker-warnings-20261005/` (`R` below).

1. Red then green:
   `pnpm exec vitest run tests/contract/marker-warnings.test.ts tests/contract/export-pdf.test.ts -t AUDIT-MARKER-WARNINGS`.
2. Final focused contracts:
   `pnpm exec vitest run tests/contract/marker-warnings.test.ts tests/contract/marker-reading.test.ts tests/contract/renderer-reading.test.ts tests/contract/export-assessment.test.ts tests/contract/export-pdf.test.ts`.
3. `python3 tools/pdf-helper/verify_runtime.py target/pdf-helper/runtime --exact`;
   `pnpm test:pdf-helper`; independent original-source/helper/PDF review.
4. `BABEL_DIFFERENTIAL_REPORT=$PWD/$R/final pnpm exec vitest run --config tests/differential/vitest.config.ts tests/differential/renderer.test.ts tests/differential/mixed-renderer.test.ts`.
   Repeat with `BABEL_DIFFERENTIAL_FAULT=announced` and fresh report prefix:
   warning gates must reject assertion differences, not setup/timeouts.
   Reading assertions/injections are unchanged; cite MARKER-READING's rejection
   evidence rather than rerunning renderer/assessment/capture modes.
5. `pnpm lint`; `pnpm typecheck`; touched-file Prettier;
   `python3 tools/check-links.py`; `pnpm check:guidance`; `git diff --check`;
   independent source/inventory/native-artifact preservation audit.

Skip native trials (explicit prohibition; no changed native boundary), browser
smoke (existing review panel, no DOM/input change), Rust/filesystem matrices,
package/build and unrelated full frontend suites. Helper evidence is synthetic
parser/PDF text, not layout, native workflow, CI or release acceptance.

Stop after this task and its local commit. No adjacent task is selected by these
findings; the M6 owner S15.5 disposition remains blocked and owner-only.
