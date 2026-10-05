# Current state — next-agent handoff 2026-10-05

Application: **babel**. Work/commit on `main`; `f2ba0c5` is published and CI
passed. AUDIT-EXPORT-WARNINGS and AUDIT-SWEEP-COVERAGE are complete in local
commits that are **not pushed**. Product feature work is paused. **M6-02, C1/F2 and Local v1 admission
stay open.**

## This session

**AUDIT-SWEEP-COVERAGE complete 2026-10-05, local only.**
[Brief](tasks/AUDIT-SWEEP-COVERAGE.md),
[evidence](test-evidence/AUDIT.md#audit-sweep-coverage--second-mixed-generated-corpus).

- Added a second 70,000-source corpus (Mulberry32 `0x5eed04`) to both pinned
  reading and warning oracles. All 60 tokens and 3,600 pairs occur; 60,837
  distinct sources. The frozen generator, seed, baseline and assertions are
  byte-identical. Paths: `tests/differential/generated-corpus.ts`,
  `mixed-renderer.test.ts`, `mixed-findings.json`, contract coverage guards;
  `docs/testing.md` describes the supplemental gates.
- Coverage limits retained explicitly: 634 unpaired-dual preparation refusals,
  398 note-only-title + six overlapping-marker reading disagreements already
  present on frozen/current, and 333 unannounced warnings (330 title fields,
  two notes, one boneyard). Exact source/outcome sets pinned, full reports
  reproducible. No new reading/clean regression among accepted sources;
  refused sources do not enter reading/assessment comparisons. No product fix.
- Checks: recorded red 3/3, focused 228/228, differential 6/6, all four faults
  rejected, helper 16/16, tooling 5/5, `pnpm check` 1425/1425. Native/browser,
  Rust and filesystem gates skipped for test-only scope; no new PDF/native
  fidelity claim. Marker gaps need a separate future brief; R5 is next.

**AUDIT-EXPORT-WARNINGS complete 2026-10-05, local only.**
[Brief](tasks/AUDIT-EXPORT-WARNINGS.md),
[evidence](test-evidence/AUDIT.md#audit-export-warnings--renderer-warnings-compared-at-export).
Export stops on unknown/unreadable or unannounced helper warnings, names the
category, cancels the artifact and retires the capture. No acceptance path.
Three retained PDF omissions remain for R5: an indented note-only opening key,
a slightly indented key beneath a title field, and the same beside a boneyard.
The stop is natively verified for one source/category; categories do not prove
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

**AUDIT-D04-R5** — proposed in the [tracker](tasks/AUDIT-TRACKER.md), no brief
yet. Write its bounded brief first: report the three existing omissions as
located blocking limitations and flip their hand-authored corpus cases. Never
widen `announced` to clear them. Account for supplemental title-source inventory
changes with independent literal/PDF evidence; retained marker gaps need a
separate future brief. AUDIT-SWEEP-COVERAGE is complete; this run stops at its
local commit and does not start R5.
Before any native run check `df -i /tmp`, set `BABEL_NATIVE_IME_TEMP_ROOT`, and
recreate the `/tmp` helpers if the host has rebooted.
No M6/F4 continuation, group F, DEV-02 or release admission is selected.
Each push needs explicit owner authorization; local task commits are unpushed.
