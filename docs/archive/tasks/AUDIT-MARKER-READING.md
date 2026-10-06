# AUDIT-MARKER-READING — preserve marker removal order in assessment

Status: **done 2026-10-05**, main from clean `73e79ee`, local only.
[Evidence](../../test-evidence/AUDIT-MARKER-READING.md).
Selected under the owner's independent-task continuation instruction; M6's
owner S15.5 review remains blocked. Dependencies: AUDIT-SWEEP-COVERAGE and
AUDIT-D04-R5 complete. Requirements: SPEC S09.2 / INV-03; existing pinned
renderer assessment contract. [Tracker](../../tasks/AUDIT-TRACKER.md),
[retained inventory](../../../tests/differential/mixed-findings.json).

## Deliverable and acceptance

Correct only the assessment reading for the six retained marker-paragraph
sources. Read the original source in the pinned renderer's order: global
boneyards, title/paragraph boundaries, then notes within body paragraphs.
Pre-stripping codec-recognized inline spans must not change which earlier
unclosed marker consumes a later closing marker.

- Write independent literal paragraph/text expectations for all six sources
  and a minimal order-sensitive control; verify against the actual pinned
  parser and extracted helper PDF text. Run the new contracts red before edits.
- All six corrected readings agree; all existing oracle cases still agree.
  Assessment preserves exact source bytes, including BOM/CRLF variants, and
  retains blocking SC005 review for these ambiguous sources. No Save, recovery,
  editor or Undo path changes.
- Both fixed generated corpora retain their original bytes/seeds/control
  `8084690`. Pin precisely the six corrected source/oracle outcomes using the
  historical hash, require zero remaining marker reading disagreements, and
  preserve all title corrections, three warning gaps and 634 preparation
  refusals. No unrelated regression/admission change is allowed.
- Preserve all native-register rows, 501 inventoried files, 307 historical
  files and retained cores/strict failures; update evidence and handoff.

## Do NOT do

Change codec/editor, renderer mirror rules, helper/profile/fonts/pins,
warning-announcement/export acceptance, Rust/IPC/save/recovery/snapshot or
native guard/predicate/timer behavior; fix the three warning gaps or expand a
corpus. No frozen audit/evidence overwrite, baseline advance, native trial,
runtime installation/upgrade, register change, crash closure/risk acceptance,
M6/M7/F4/group F implementation, pruning, push, tag or amend.

## Exact checks and stop

Lowest tier: **Tier 2 domain logic**. Use
`mise exec node@26.7.0 pnpm@11.22.0 --` for pnpm commands; fresh logs and
PDFs in `target/audit-marker-reading-20261005/`.

1. Red then green:
   `pnpm exec vitest run tests/contract/marker-reading.test.ts`.
2. Focused contracts:
   `pnpm exec vitest run tests/contract/marker-reading.test.ts tests/contract/renderer-reading.test.ts tests/contract/export-assessment.test.ts tests/contract/export-pdf.test.ts`.
3. Verify the unchanged runtime:
   `python3 tools/pdf-helper/verify_runtime.py target/pdf-helper/runtime --exact`;
   `pnpm test:pdf-helper`. Rebuild only if missing/changed.
4. `BABEL_DIFFERENTIAL_REPORT=$PWD/target/audit-marker-reading-20261005/final pnpm exec vitest run --config tests/differential/vitest.config.ts tests/differential/renderer.test.ts tests/differential/mixed-renderer.test.ts`.
   Repeat renderer/assessment rejection modes after changing their inventory
   assertions; each must fail by assertion, not setup/timeout.
5. `pnpm lint`; `pnpm typecheck`; format touched text/code;
   `python3 tools/check-links.py`; `pnpm check:guidance`; `git diff --check`.
   Independent source/inventory/native-artifact preservation review.

Skip native trials (owner prohibition and no changed native boundary), browser
smoke (no DOM/input/rendered UI change), Rust/filesystem matrices, package/build
and broad frontend tests (unrelated boundaries). Capture gate and capture/
announced fault modes are unchanged; no codec/bridge or warning acceptance
change. PDF text/parse checks confer no layout, native or release acceptance.

Stop after acceptance, one compact evidence table, tracker/current-state and a
task-ID local commit on main. The next independent marker-warning task needs its
own bounded brief; do not start it in this run.
