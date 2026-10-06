# Current state — next-agent handoff 2026-10-05

Application: **babel**. Work/commit on `main`; `f2ba0c5` is published and CI
passed. AUDIT-D04-R5, AUDIT-EXPORT-WARNINGS and AUDIT-SWEEP-COVERAGE are
complete in local commits that are **not pushed**. Product feature work is paused. **M6-02, C1/F2 and Local v1 admission
stay open.**

## This session

**AUDIT-D04-R5 complete 2026-10-05, local only.**
[Brief](tasks/AUDIT-D04-R5.md),
[evidence](test-evidence/AUDIT.md#audit-d04-r5--located-title-omission-limitations).

- Three title omissions now have located blocking SC005 review before the
  destination picker; acknowledgement exports the captured version. The two
  section/synopsis messages describe actual omission. Source/Save and `announced`
  rules are unchanged. Paths: `src/domain/exportAssessment.ts`, assessment
  corpora, contract/differential tests, native `pdf_export.py`, owning docs.
- Seven literal parser/PDF cases and 301 retained original-source PDFs support
  the exact 398 title-reading corrections and 330 closed title-warning gaps.
  All previous source/oracle hashes remain recorded. Frozen baseline, seed,
  mirror/helper and unrelated inventories are unchanged. Six marker reading
  differences, three marker-warning gaps and 634 preparation refusals remain.
- Focused/shared, helper/differential, injected-fault, tooling, Rust and
  Chromium checks passed; native modes and owned crash audits passed on
  tmpfs/Btrfs. Evidence retains red runs and browser timeout/retry. No installed,
  release or universal fidelity claim. Historical native crashes, M6-02 and
  C1/F2 stay open.

**AUDIT-SWEEP-COVERAGE complete 2026-10-05, local only.**
[Brief](tasks/AUDIT-SWEEP-COVERAGE.md),
[evidence](test-evidence/AUDIT.md#audit-sweep-coverage--second-mixed-generated-corpus).
Second mixed 70,000-source corpus; all 60 tokens/3,600 pairs occur, 60,837
sources are distinct. Frozen generation/assertions unchanged. R5 closes the
retained title gaps above; marker gaps and preparation refusals remain open.

**AUDIT-EXPORT-WARNINGS complete 2026-10-05, local only.**
[Brief](tasks/AUDIT-EXPORT-WARNINGS.md),
[evidence](test-evidence/AUDIT.md#audit-export-warnings--renderer-warnings-compared-at-export).
Export stops on unknown/unreadable or unannounced helper warnings, names the
category, cancels the artifact and retires the capture. No acceptance path.
R5 now reports the three retained title omissions before export. The warning
comparison still checks categories only; matching categories do not prove
extent. Prior check/native results and scratch sweeps remain in evidence.
A reboot emptied `/tmp`; recreated Cargo/drill caches vanish on reboot.
AUDIT-D04-R4's four first-attempt file-picker aborts remain open.

**AUDIT-D04-R4 complete and published 2026-10-05** at `f2ba0c5`.
[Brief](tasks/AUDIT-D04-R4.md),
[evidence](test-evidence/AUDIT.md#audit-d04-r4--boneyard-inside-the-renderers-opening-title-block).
An opening block the renderer reads as a title page and the codec does not is
blocking SC005 with or without a boneyard line in it.

**AUDIT-READING-CANDIDATES complete 2026-10-05.**
[Brief](tasks/AUDIT-READING-CANDIDATES.md),
[evidence](test-evidence/AUDIT-READING-CANDIDATES.md#classification--2026-10-05).
Eleven occurrences were seven sources: two supported lyric mappings and five
silent omissions, which AUDIT-D04-R4 fixes.

**INFRA-INSTRUCTIONS complete, published and CI verified.**
[Brief](tasks/INFRA-INSTRUCTIONS.md), [evidence](test-evidence/INFRA-INSTRUCTIONS.md).

- Merge `4eafd58` retains public `beac0fc` and local F4-05 `8084690`, with
  the exact local tree. F4-04 was amended after push for docs-only native
  limitations; no code lost, reset, force-push or further amend.
- Current-state Next action is the only continuation pointer. TODO links the
  [audit tracker](tasks/AUDIT-TRACKER.md); M6 is paused. Map/index are static.
  SPEC reflects the existing name/Linux declaration and main/approved-isolation
  workflow. Published corrections must be new commits.
- Full link/guidance checks, byte/line budgets and ADR prefixes are enforced.
  Five historical M4 links corrected without changing findings. Completed
  tracker entries link evidence rather than repeat it; open obligations retained.
- Unit discovery retains all 74 tracked contract/UI files, including `.test.ts`
  UI cases, and excludes archives. A real discovery-inventory test guards both.
  CI adds helper, differential, tooling and pinned Chromium smoke checks;
  package build remains a build gate, not native writing/installed acceptance.
- Differential: full 848 F4 editor rewrites and 16,128 codec edits retain all
  previously successful bytes/facts and introduce no refusals. 117 shared
  oracle cases plus 70,000 generated sources agree with the verified pinned
  parser (roles/brackets/numbers/title decision); no new false assessment gate
  or clean role candidate. Three in-memory faults are detected.
- Eleven frozen-control source-role candidate occurrences stay in the report;
  they are classified above. The report now lists every occurrence.
- Shared local checks and both CI jobs passed at `6225a41`. The first CI run's
  browser-harness failure and its repair are retained in evidence.

## Retained findings and limits

[Native finding register](native-findings.md) indexes eleven rows of recorded
event identities with dates, workload, controls and disposition; no shared cause
inferred. C1/F2 and historical SLP-B/NATIVE-R1/D02/D03/PARK-H-F2 crashes stay
open. Passing controls do not close them. Active-writing/data-loss failures
block affected feature work; scoped safety investigations may proceed.

F4-01–05 content repairs remain complete within recorded scope; group F stays
unscheduled. [F4 brief](tasks/AUDIT-PARK-H-F4.md),
[F4-05 evidence](test-evidence/AUDIT.md#audit-park-h-f4-05--emptied-unterminated-last-rows).
Recovered reopen of new intents and CR/mixed-ending cases are contract-level;
F4-04 phase H natively covers Dialogue only. Other fallback intents/Transition
follow-up remain separately scoped. No native drills rerun in maintenance.

[M6-02](tasks/M6-02.md), [matrix](test-evidence/M6-02-matrix.md),
[review](reviews/2026-10-03-m6-02-persistence-review.md) retain Save As/IME,
shared-store lease scope and parent-kill abort. Replace-All load flake,
SELinux, broader keyboard/a11y/IME, installed/offline adoption and full S13
remain open. DEV-02 is owner-only. No retained artifacts pruned.

## Next action

**No next implementation selected.** R5 is complete; this run stops at its
local task commit. The six overlapping-marker reading differences and three
marker-warning gaps need an owner-selected bounded investigation/brief before
implementation. The [supplemental inventory](../tests/differential/mixed-findings.json)
and R5 evidence retain their exact sources/outcomes and reproducible reports.
Before any later native run check `df -i /tmp`, set
`BABEL_NATIVE_IME_TEMP_ROOT` to a fresh Btrfs directory, and recreate missing
`/tmp` helpers/Cargo cache after reboot. No artifact pruning was performed.
No M6/F4 continuation, group F, DEV-02 or release admission is selected.
Each push needs explicit owner authorization; local task commits are unpushed.
