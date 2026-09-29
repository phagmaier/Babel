# Current state — M2-06 and bounded M2 headless exit passed

Date: 2026-09-28 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [ADR 0020](decisions/0020-native-curated-history.md), [M2-06 evidence](test-evidence/M2.md#m2-06--small-history-primitives-and-safety-gate).

## Completed task and trust boundary

**M2-06 passed its bounded Linux headless acceptance on main.** Base `7ea1355`, clean starting tree and no dirty paths. Native `DocumentService` now owns private bare per-document history repositories, curated exact-byte source/profile commits, checked main/safety refs, explicit revision and health methods. Recovery adoption and snapshot restore create a history safety revision before source replacement; corrupt history stops those destructive choices. Ordinary source saves and recovery checkpoints stay independent. No system Git executable, user Git config, transport, frontend filesystem path or runtime network operation was added.

The combined native drill opened/saved/reopened synthetic Fountain bytes, recovered a newer acknowledged checkpoint and retained the previous source/history generation. Existing M2 fault/race/SIGKILL suites, plus new history interruption/failure tests, passed on tmpfs and Btrfs. This closes the **M2 headless Linux exit** described in [SPEC S16](../SPEC.md#s16), not Local v1 or a production writing workflow.

## Paths and checks

- Core: `crates/screenwriter-core/src/documents/{history.rs,history_store.rs,history_store_tests.rs,choices_store.rs,snapshot_store.rs}` and `tests/{recovery_choices.rs,m2_exit.rs}`; pinned `git2` core dependency. TypeScript error-code contract extended. [ADR 0020](decisions/0020-native-curated-history.md), history/architecture/testing/development docs and trace/TODO updated.
- [M2-06 evidence](test-evidence/M2.md#m2-06--small-history-primitives-and-safety-gate) owns exact host/commands/log paths and native versus browser limits. Full Rust workspace: 167 entries each on tmpfs and Btrfs after the final managed-profile test; 79 frontend tests, format/lint/typecheck, native release build and no-Git-PATH focused run passed. See evidence for final recorded counts and any reruns.

## Limits and next action

The default desktop has no history command/UI, production editor, picker, save cadence or Save As. M6 owns timeline/diff/named restore, installed/offline package/adoption, license notices and full product verification; M3 owns production editor integration. Git ref/object power-loss durability, actual disk full, physical-disk independence and other OS adapters remain unverified. Existing source/recovery/snapshot layers remain the primary data safety mechanisms. Do not use important manuscripts in this build.

Next: **M3-00 Decompose M3-G**, then select one ready M3 task. Stop at this requested M2 boundary. Work on main with task IDs in commits; never push without human review and explicit authorization.
