# AUDIT-PARK-H-F4-REVIEW — group closure review

Selected 2026-10-05 from clean `ceca040`; user delegated one bounded task
selection after AUDIT-MARKER-WARNINGS. Status: **complete**; F4 remains open.

## Question and deliverable

Determine whether the completed F4-01–05 slices justify closing the whole
[F4 group](../../tasks/AUDIT-PARK-H-F4.md), or leave an explicit residual obligation.
Produce a compact evidence report mapping each completed slice to its retained
acceptance evidence and each remaining group to existing executable cases.
Correct stale tracker examples and closure wording without retiring findings
or treating emergency copying as automatic save/recovery protection.

Dependencies: the five scheduled slices have completion evidence; review them
against the group brief and current contracts. Authority: SPEC S03/S05.5/S07.1,
[ADR 0027](../../decisions/0027-uncapturable-draft-preservation.md),
[finding disposition](../../testing.md#finding-disposition).

## Acceptance and scope

1. Distinguish completed slice acceptance from whole-group closure. State a
   reasoned closure/open disposition; retain all original probe counts, failed
   runs, byte hashes, native findings and unverified recovery/platform limits.
2. Identify exact residual triggers, current visible behavior and protection
   reach from existing tests/contracts. Label fresh contract/injected-UI results
   separately from historical native evidence and untested residuals.
3. Leave one concrete narrowed investigation outline if the group remains
   open. The outline selects no subsequent implementation or native trial.
4. Reconcile current-state, TODO and owning tracker with the disposition. Keep
   F4-01–05 checked; change the group checkbox only if its full scope is met.
5. Preserve every tracked byte outside the six named documentation paths and
   inventoried retained F4 artifacts. One task-ID local commit on `main`; stop.

Editable paths: this brief, `docs/test-evidence/AUDIT-PARK-H-F4-REVIEW.md`,
`docs/tasks/AUDIT-PARK-H-F4.md`, `docs/tasks/AUDIT-TRACKER.md`, `TODO.md`,
`docs/current-state.md`. No product/test/fixture changes, new corpus, native
execution, guard/predicate/timer/snapshot change, register edit, risk acceptance,
retirement, pruning, push, tag or amend.

## Checks and stop

Tier 1 documentation/artifact review. Exact commands, using the repository's
pinned toolchain through `mise exec node@26.7.0 pnpm@11.22.0 --` for pnpm:

- `pnpm exec prettier --check` on the six editable Markdown paths.
- `python3 tools/check-links.py` on those same explicit paths.
- `pnpm check:guidance`; `git diff --check`.

Existing-case confirmation only, with task-local `TMPDIR`:

```sh
env TMPDIR="$PWD/target/audit-park-h-f4-review/tmp" \
  mise exec node@26.7.0 pnpm@11.22.0 -- pnpm exec vitest run \
  tests/contract/command-refusal.test.ts tests/contract/capture-refusal.test.ts \
  tests/contract/emptied-speech-row.test.ts \
  tests/contract/speech-parenthesis.test.ts \
  tests/contract/other-syntax-fallback.test.ts \
  tests/contract/empty-eof-row.test.ts tests/contract/editor-keys.test.ts \
  tests/ui/WritingView.test.tsx \
  -t 'AUDIT-PARK-H|middle Character and Parenthetical splits'
```

`python3 target/audit-park-h-f4-review/verify_preservation.py` verifies the
task-local SHA-256 manifest of protected tracked files and retained artifacts;
all logs under `target/audit-park-h-f4-review/`.

Skip lint/typecheck/build, renderer/helper/corpus gates, browser, Rust/filesystem
matrix and native drills: no executable or rendering boundary changes. The
historical slice commands are evidence to review, not commands to repeat here.
Record missing artifacts honestly. Stop after the report, handoff and local
commit; M6/C1/F2/Local v1 and owner S15.5 gates stay blocked.
