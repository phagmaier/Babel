# INFRA-WORKFLOW — reduce repeated verification and resume M6

Status: **complete 2026-10-05**, owner-authorized after independent review.
Base `900b234`; main, local commit only. Requirements: SPEC S03/S15/S17/S18.

## Deliverable and acceptance

- Make local checks follow changed boundaries; keep broad CI and final release
  gates. Supersede old routine shared-check lists explicitly, retaining exact
  task acceptance, fault cases, focused regressions and native safety checks.
- Keep both differential corpora, literal oracles, reviewed inventories and
  baseline advancement rules. Run relevant gates locally; repeat mutations only
  for harness changes. New corpus expansion must answer a bounded question.
- Make native residual-risk review possible without an unavailable runtime;
  timebox investigation without expiring safety failures. Correct R4 process
  provenance. Retain every historical failure; close no native/adoption gate.
- Use compact future evidence; keep historical evidence and canonical contracts.
  Shorten current-state and explicitly resume at M6-02-R1 after this commit.
- Pair policy changes with SPEC and ADR 0035. Product, fixture, test, helper,
  dependency, CI and frozen root audit bytes remain unchanged.

## Checks and stop

Tier 1 policy/docs only. Run touched Markdown format checks with pinned tools,
`python3 tools/check-links.py --all`, `python3 tools/check-guidance.py`,
`git diff --check`, and an independent tracked-byte/S03 preservation audit.
Review the full diff for contradictory routine gates and retained blockers.
Record exact commands/results in [evidence](../../test-evidence/INFRA-WORKFLOW.md).

Red-before-fix tests, frontend/Rust/helper/differential/browser/native runs are
skipped: no executable or product path changes. Broad CI remains unchanged;
this change makes no fresh product/runtime verification claim. Keep existing
cores, reports and failed roots; no deletion, crash waiver, release admission,
M6 implementation or push in this task. Stop after the local task commit.
