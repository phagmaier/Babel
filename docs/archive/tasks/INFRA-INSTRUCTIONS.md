# INFRA-INSTRUCTIONS — reconcile history and maintain agent guidance

Owner-authorized 2026-10-05 after the read-only instruction-layer review.
Base: `8084690`; remote `beac0fc`. Merge `4eafd58` retains both histories
and exactly the local tree. Work on main; owner authorizes the reviewed
housekeeping result to be pushed. Product development stays paused.

## Deliverable and acceptance

- One continuation pointer in current-state; static map/index routing;
  concise TODO and linked audit tracker. Preserve every open obligation,
  frozen audit, historical evidence, fixture byte and existing product fix.
- Correct established name/platform facts and main/approved-isolation
  policy without changing product requirements or admitting Local v1.
- Fix five M4 relative links; exclude archived tests; automate full links,
  guidance checks, browser smoke and helper tests in CI with honest scope.
  Browser harness startup/cleanup may be repaired if the new CI gate fails;
  existing browser assertions remain intact.
- Track deterministic capture and renderer differential gates. Compare
  capture against the frozen F4-05 Git source, not generated expectations;
  compare the mirror to the pinned renderer and retain shared literal oracles.
- Group retained native failures in a linked register with workload,
  observed date, reproduction limits and disposition. No crash closure.
- Standardize ADR status prefixes while retaining all original qualifiers.
  Guidance budgets allow reviewed safety exceptions; fixtures remain binary.

## Checks

Tier 2 tooling/configuration with CI packaging validation. Focused:
`pnpm check:guidance`, `pnpm check:links`, `pnpm test:differential`,
`python3 -m unittest discover -s tests/tools -p 'test_*.py'`,
`pnpm exec vitest list --filesOnly` (no target archives).
Shared: `pnpm check`, `pnpm test:pdf-helper`, `pnpm test:browser`,
`cargo fmt --all -- --check`,
`cargo clippy --workspace --all-targets --locked -- -D warnings`,
`cargo test --workspace --locked`, `pnpm tauri build`,
`sh tools/lint-py.sh`, full links and `git diff --check`.

Detect representative bad guidance and differential changes before accepting
the gates. Logs use fresh `target/infra-instructions/` paths. Helper/runtime
builds run sequentially. CI must pass at the published commit.

Native drills and second-filesystem matrix skipped: no product, native IPC,
store, dependency, helper/profile or packaging behavior changes. A package
build verifies the CI-command path; it does not prove installed/native input.
Record actual omissions and failures in
[evidence](../../test-evidence/INFRA-INSTRUCTIONS.md).

## Exclusions and stopping

No adjacent F4/M6 implementation, new manuscript-format policy, runtime
upgrade, crash suppression, artifact pruning or release admission. Do not
rewrite a pushed commit. Stop after this maintenance result and CI review;
next product task requires a separately selected bounded brief.
