# Current state — next-agent handoff 2026-10-05

Application: **babel**. Work/commit on `main`; `f2ba0c5` is published and CI
passed. AUDIT-EXPORT-WARNINGS is complete in local commits that are **not
pushed**. Product feature work is paused. **M6-02, C1/F2 and Local v1 admission
stay open.**

## This session

**AUDIT-EXPORT-WARNINGS complete 2026-10-05, local only.**
[Brief](tasks/AUDIT-EXPORT-WARNINGS.md),
[evidence](test-evidence/AUDIT.md#audit-export-warnings--renderer-warnings-compared-at-export).
The owner delegated the design; choices and reasons are in the brief.

- Change: after rendering and before publication, `src/application/exportPdf.ts`
  compares the helper's `unsupported-publication:*` warnings with a new
  `announced` set from `src/domain/exportAssessment.ts`. A warning the author
  was not told about, an unknown code or an unreadable list stops the export:
  artifact cancelled, capture retired, nothing written, category named. There
  is no acceptance path. Assessment issues and counts are unchanged.
- The first design would have refused legitimate exports: a scratch sweep of
  206,282 sources stopped 7,888, most often a commented-out block containing a
  note. The revised rules stop 709: real disagreements and tangled markers.
- **Three real omissions found; export now stops for them, none is fixed**
  (retained PDFs): an indented opening `Key: [[note]]` line, and a slightly
  indented `Key: value` line under a title field, with or without a boneyard.
  Proposed as AUDIT-D04-R5. The stop names a category, not a line.
- New: `fixtures/assessment/export-warnings.json` (33 hand-written cases read by
  both sides), `tools/differential/warning_oracle.py`, a warning gate in
  `tests/differential/renderer.test.ts`, fault mode `announced`, two real-helper
  steps in the native `pdf-export` drill.
- Checks: red 37/230, focused 254/254, differential 4/4 with all four faults
  failing, helper 16/16, tooling 5/5, `pnpm check` 1422/1422, browser smoke,
  fresh build, native `pdf-export script-check publication-exit title-page` 8/8
  with clean crash audits on tmpfs and Btrfs. Rust gates and the workspace
  matrix skipped: no Rust, IPC or filesystem path changed.
- Limits: categories only; tuned on generated and hand-written sources, not a
  real manuscript; the stop is native-verified for one source and category.
- **Gate coverage:** replaying the renderer gate's generator shows 15 of its 30
  tokens never appear (`[[note]]` among them), every line starts with one space
  and sources have 2, 4 or 6 lines. Recorded under AUDIT-SWEEP-COVERAGE; seed
  and baseline untouched.
- Environment: a reboot emptied `/tmp`, so inodes are free again. The crate
  cache `/tmp/babel-cargo` and the drill helpers `/tmp/babel-m3-08-keyboard` and
  `/tmp/wtype` were recreated and vanish on the next reboot. The four file-picker
  aborts of AUDIT-D04-R4's first native attempt stay open in the register.

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

**AUDIT-SWEEP-COVERAGE** — proposed in the [tracker](tasks/AUDIT-TRACKER.md),
no brief yet. Write the brief first: a second, better-mixed generated corpus
beside the frozen one, feeding both the reading gate and the warning gate; never
change the existing seed, baseline or assertions. Then **AUDIT-D04-R5** (also
proposed, no brief): report the three open findings as located limitations and
flip their corpus cases. The owner may prefer R5 first; it is the smaller task.
Before any native run check `df -i /tmp`, set `BABEL_NATIVE_IME_TEMP_ROOT`, and
recreate the `/tmp` helpers if the host has rebooted.
No M6/F4 continuation, group F, DEV-02 or release admission is selected.
Each push needs explicit owner authorization; this task's commits are unpushed.
