# Current state — next-agent handoff 2026-10-05

Application: **babel**. Work/commit on `main`; maintenance was published.
Product feature work is paused; next assignment is classification only.
**M6-02, C1/F2 and Local v1 admission stay open.**

## This session

**Next-agent handoff prepared; classification not started.**
[Assignment](handoffs/2026-10-05-reading-candidates.md),
[brief](tasks/AUDIT-READING-CANDIDATES.md),
[preparation evidence](test-evidence/AUDIT-READING-CANDIDATES.md).
Owner asked for the recommended next task and fresh-agent context. Selected
bounded semantic classification before any product correction or new feature.

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
- Eleven frozen-control source-role heuristic candidate occurrences remain: these include
  supported lyric mappings and a possible title-block omission. They are
  candidates, not confirmed losses or accepted waivers. [Classification brief](tasks/AUDIT-READING-CANDIDATES.md)
  is selected for the next agent. The report shows only five examples; collect
  the full occurrence list and deduplicate before classification. Recipes are tracked.
- Shared local checks: frontend 1319/1319 in 74 files, Rust 273/273,
  helper 16/16, tooling 5/5, differential 3/3, browser and package pass.
  Initial formatting/discovery mistakes and BOM-oracle correction are retained
  in evidence. First published CI passed frontend/core/helper/differential/tooling,
  then failed the browser harness's 15-second console-message startup wait.
  Vite awaited startup/close replaces that wait. Both CI jobs passed at
  `6225a41`, including browser, workspace tests and Linux package build;
  failed run and repair results are retained in evidence.

## Retained findings and limits

[Native finding register](native-findings.md) indexes ten recorded event
identities with dates, workload, controls and disposition; no shared cause
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

**AUDIT-READING-CANDIDATES** — execute the [owner-provided handoff](handoffs/2026-10-05-reading-candidates.md).
Finish literal expectations/readiness, claim, classify every distinct candidate,
retain independent red evidence for any real discrepancy and write its bounded
fix brief. Update evidence/tracker/handoff; commit locally and stop without push.
No product fix, M6/F4 continuation or release admission is selected.
