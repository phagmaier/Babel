# Current state — M2-05B-R1 implemented, pending review acceptance

Date: 2026-09-28 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [M2 review](reviews/2026-09-28-m2-05b-review.md), [R1 evidence](test-evidence/M2.md#m2-05b-r1--correct-finalize-durability-and-relink-ownership).

## Active task and trust boundary

**M2-05B-R1 implemented 2026-09-28 on main; M2-05B acceptance remains open pending review of these corrections.** M0, bounded M1-01–05 and M2-01–04/05A retain their recorded completion. M2-05B is implemented at `de8b86b51f3b2bc3eef2825adfa9a41d9caae328`; local main already contains it. The earlier uncommitted/branch-only handoff was stale. **M2-05B-R independent review is complete; M2-05B acceptance is reopened until the R1 corrections are accepted.** Parent M2-05/full M2 exit remain open.

The owner authorized PROCESS-01, M2-05B review/coordinator registration, and then commit/merge to main, deletion of fully merged stale local branches and push to origin/main. The single-editor workflow now uses main, task IDs in commit messages and tags for verified milestone gates; short-lived worktree branches are reserved for concurrent editing. Review base: `de8b86b`. Git integration results are recorded below; no production implementation change was performed.

The product remains a disabled writing shell with read-only startup recovery inspection. Native choice APIs and the reusable panel exist, but the production picker/writer is uninitialized. Editing, source-save/reopen UI, Save As, retention/protected close, history and remote operations remain unavailable. **Do not use important manuscripts.**

## Completed review and touched paths

- PROCESS-01 tightened read/check/evidence/ADR conventions in AGENTS; all original invariant bullets and both anti-false-claim rules survive. [Process report](reviews/2026-09-28-process-review.md) owns the measured verdicts; no further broad instruction trimming is needed.
- M2-05B-R independently reproduced two gaps on synthetic tmpfs/Btrfs files: finalize issues a source receipt without retrying source-directory sync after a post-rename interruption; a view-only caller can relink and create identity/lease records. [Review](reviews/2026-09-28-m2-05b-review.md) owns severity, reproduction and required corrections. Existing passes do not cover these cases.
- M2-05B-R1 implements both corrections on main: finalize finishes source file/directory durability with revalidation before any receipt (plus test-only gate, sync-failure no-receipt, retry/restart/already-confirmed coverage); relink requires exclusive caller ownership with held-lease verification before mutation (view-only/invalidated-lease refusal leaves disk identical; genuine moves still work). [R1 evidence](test-evidence/M2.md#m2-05b-r1--correct-finalize-durability-and-relink-ownership) owns commands and results. Registered [M1-06 composition proof](editor-composition-proof.md) (blocked on accepted corrections). M2-05C follows the proof's reviewed bounded conclusion. Production M3 still requires full M2 exit/decomposition.
- Touched (R1): `crates/screenwriter-core/src/documents/choices_store.rs`, `choices_store_tests.rs`, `tests/recovery_choices.rs`; TODO; current-state/index/requirements; architecture/persistence/testing review-status notes; M2 evidence R1 section. No lockfile, capability, ADR or existing evidence section changed.

## Verification

Host: Linux 7.2.5-3-omarchy x86_64; Cargo 1.97.1, Node 26.7.0, pnpm 11.22.0; tmpfs `/tmp`, Btrfs workspace. Exact commands/logs are recorded once in [M2 R1 evidence](test-evidence/M2.md#m2-05b-r1--correct-finalize-durability-and-relink-ownership).

- Passed corrected implementation checks: 141 workspace entries (31 core incl. 5 choice, 9 save API, 12 recovery API, 13 choice API, 26 open, 7 startup reader, 17 desktop, 13 replacement proof, 13 history proof) on tmpfs; 5 choice unit + 13 choice API on Btrfs; 17 desktop MockRuntime with native files; 49 frontend checks with build. No-Git PATH runs pass for choice suites. No new WebView E2E claim.
- New regression coverage: pre-directory-sync finalize completes with durability plus already-confirmed retry and restart; injected source-directory sync failure returns no receipt with uncertainty/previous/recovery retained; view-only/invalidated-lease relink refuses with byte-identical disk; genuine loose/managed relinks still pass. `LD_PRELOAD` fsync logger now observes source file and source parent sync during finalize (previously only transaction dir). Injected faults are simulation, not power-loss proof.
- Documentation formatting, `git diff --check` and implementation-preservation checks: see R1 evidence. Historical M2-05B native startup smoke remains historical and does not close these findings. One transient desktop failure (16/17) cleared on the next two consecutive runs and the recorded log run (17/17); no check was weakened.
- Owner-approved Git integration: review/workflow commit `3a13157` fast-forwarded into main; all three fully merged stale local branches deleted, leaving only main. Exact commands/results are in [M2 review evidence](test-evidence/M2.md#m2-05b-r--independent-acceptance-review). The owner explicitly authorized pushing this integrated checkpoint to origin/main.

## Next safe action

Request review acceptance of **M2-05B-R1**; do not push without human review and explicit authorization. After acceptance, claim **M1-06** and work on main. The proof is registered, not implemented, and cannot write through the uncorrected writer. Do not start 05C before the bounded investigation's reviewed conclusion.

Same-disk copies are not disaster backups; arbitrary external writers can still race advisory checks; power-loss, other platforms, package adoption and full IME/editor composition remain unverified.
