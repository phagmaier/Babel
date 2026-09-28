# Current state — M2-05B review requires corrections

Date: 2026-09-28 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [M2 review](reviews/2026-09-28-m2-05b-review.md), [review evidence](test-evidence/M2.md#m2-05b-r--independent-acceptance-review).

## Active task and trust boundary

M0, bounded M1-01–05 and M2-01–04/05A retain their recorded completion. M2-05B is implemented at `de8b86b51f3b2bc3eef2825adfa9a41d9caae328`; local main already contains it. The earlier uncommitted/branch-only handoff was stale. **M2-05B-R independent review is complete; M2-05B acceptance is reopened until M2-05B-R1 corrections pass.** Parent M2-05/full M2 exit remain open.

The owner authorized PROCESS-01, M2-05B review/coordinator registration, and then commit/merge to main, deletion of fully merged stale local branches and push to origin/main. The single-editor workflow now uses main, task IDs in commit messages and tags for verified milestone gates; short-lived worktree branches are reserved for concurrent editing. Review base: `de8b86b`. Git integration results are recorded below; no production implementation change was performed.

The product remains a disabled writing shell with read-only startup recovery inspection. Native choice APIs and the reusable panel exist, but the production picker/writer is uninitialized. Editing, source-save/reopen UI, Save As, retention/protected close, history and remote operations remain unavailable. **Do not use important manuscripts.**

## Completed review and touched paths

- PROCESS-01 tightened read/check/evidence/ADR conventions in AGENTS; all original invariant bullets and both anti-false-claim rules survive. [Process report](reviews/2026-09-28-process-review.md) owns the measured verdicts; no further broad instruction trimming is needed.
- M2-05B-R independently reproduced two gaps on synthetic tmpfs/Btrfs files: finalize issues a source receipt without retrying source-directory sync after a post-rename interruption; a view-only caller can relink and create identity/lease records. [Review](reviews/2026-09-28-m2-05b-review.md) owns severity, reproduction and required corrections. Existing passes do not cover these cases.
- Registered M2-05B-R1 (ready native corrections) and [M1-06 composition proof](editor-composition-proof.md) (blocked on accepted corrections). M2-05C follows the proof's reviewed bounded conclusion. Production M3 still requires full M2 exit/decomposition.
- Touched: AGENTS; README/TODO; current-state/index/requirements; architecture/persistence/testing review-status notes; M2 evidence append; two review reports and the composition plan. No source code, lockfile, capability, ADR or existing evidence section changed.

## Verification

Host: Linux 7.2.5-3-omarchy x86_64; Cargo 1.97.1, Node 26.7.0, pnpm 11.22.0; tmpfs `/tmp`, Btrfs workspace. Exact commands/logs are recorded once in [M2 review evidence](test-evidence/M2.md#m2-05b-r--independent-acceptance-review).

- Passed unchanged implementation checks: 28 core unit + 11 choice API, 17 desktop and six injected frontend tests. Desktop generated dispatch uses MockRuntime with native files; no new WebView E2E claim.
- Reproduced counterexamples: two diagnostic probes in an isolated `/tmp` archive, on tmpfs and Btrfs. fsync forwarding logger observed only transaction-directory sync during finalize. Diagnostic passes reproduce incorrect behavior; they are not corrected acceptance or power-loss proof.
- Documentation formatting, changed-link audit and final diff/implementation-preservation checks: see evidence. Historical M2-05B native startup smoke remains historical and does not close these findings.
- Owner-approved Git integration: review/workflow commit `3a13157` fast-forwarded into main; all three fully merged stale local branches deleted, leaving only main. Exact commands/results are in [M2 review evidence](test-evidence/M2.md#m2-05b-r--independent-acceptance-review). The owner explicitly authorized pushing this integrated checkpoint to origin/main.

## Next safe action

Claim **M2-05B-R1** here and implement on main, starting from the integrated review commit. Own only the native correction/test paths named in TODO; preserve prior dirty work. Commit completed work with the task ID; push only after human review and explicit authorization. After regression/shared/failure checks and review acceptance, claim **M1-06** and work on main. The proof is registered, not implemented, and cannot write through the uncorrected writer. Do not start 05C before the bounded investigation's reviewed conclusion.

Same-disk copies are not disaster backups; arbitrary external writers can still race advisory checks; power-loss, other platforms, package adoption and full IME/editor composition remain unverified.
