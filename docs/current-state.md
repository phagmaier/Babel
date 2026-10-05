# Current state — next-agent handoff 2026-10-05

Application: **babel**. Work/commit on `main`; maintenance was published.
Product feature work is paused. AUDIT-D04-R4 is fixed and published at
`f2ba0c5`; CI passed. **M6-02, C1/F2 and Local v1 admission stay open.**

## This session

**AUDIT-D04-R4 complete and published 2026-10-05.** The owner authorized the
push; `f2ba0c5` passed both CI jobs ([run](https://github.com/phagmaier/Babel/actions/runs/37313877004)).
[Brief](tasks/AUDIT-D04-R4.md),
[evidence](test-evidence/AUDIT.md#audit-d04-r4--boneyard-inside-the-renderers-opening-title-block).
The owner delegated the open decisions; the agent chose gate option A and kept
the helper-warning check separate.

- Change: `src/domain/exportAssessment.ts` only. An opening block the renderer
  reads as a title page and the codec does not is blocking SC005 with or
  without a boneyard line in it. The field comparisons are skipped only where
  a boneyard removed from a title field is already reported. Two sibling cases
  found by probe (a literal `/*` in a title field) are covered too.
- Oracle 117 → 127 hand-written cases, red first (8 failed). The renderer gate
  lists ten reviewed sources exactly; baseline and seed unchanged. The by-name
  reproducer in `tests/investigation/` is green (38/38).
- Checks: focused 191/191, differential 3/3 with all faults failing, fixture
  scan 0 added and 0 removed over 48 fixtures, helper 16/16, tooling 5/5,
  `pnpm check` 1339/1339, browser smoke, fresh build, and native
  `pdf-export script-check publication-exit title-page` 8/8 with clean crash
  audits on tmpfs and Btrfs. Rust gates and the workspace matrix skipped: no
  Rust or filesystem path changed. The new SC005 is not exercised natively.
- **Environment, owner action:** `/tmp` has about 15,000 of 1,048,576 inodes
  free; 61 retained `babel-native-ime-*` roots hold nearly all the rest. The
  first native attempt hit zero: drills failed 0/8 and `babel-desktop` aborted
  at the file picker four times (indexed in the register; the clean rerun does
  not close them). Native runs must set `BABEL_NATIVE_IME_TEMP_ROOT`. Clearing
  those roots, or rebooting, is the owner's call.

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
- Shared local checks: frontend 1319/1319 in 74 files, Rust 273/273,
  helper 16/16, tooling 5/5, differential 3/3, browser and package pass.
  Initial formatting/discovery mistakes and BOM-oracle correction are retained
  in evidence. First published CI passed frontend/core/helper/differential/tooling,
  then failed the browser harness's 15-second console-message startup wait.
  Vite awaited startup/close replaces that wait. Both CI jobs passed at
  `6225a41`, including browser, workspace tests and Linux package build;
  failed run and repair results are retained in evidence.

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

**AUDIT-EXPORT-WARNINGS** — [brief](tasks/AUDIT-EXPORT-WARNINGS.md), **claimed
and in progress 2026-10-05**, base `675685b`. Design, tier, focused commands
and native drills are settled in the brief; no code has changed yet. It compares
the helper's warnings with the assessment at export, so an omission the
assessment does not predict cannot export silently. Before any native run check
`df -i /tmp` and set `BABEL_NATIVE_IME_TEMP_ROOT`. Proposed after it:
AUDIT-SWEEP-COVERAGE in the [tracker](tasks/AUDIT-TRACKER.md).
No M6/F4 continuation, group F, DEV-02 or release admission is selected.
Each further push needs explicit owner authorization.
