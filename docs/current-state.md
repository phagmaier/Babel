# Current state — M6-00 planning complete, implementation gated

Date: 2026-10-02. Application: **babel**. Work directly on main; no push.
Planning base `48ac7fa`, clean main 17 ahead of origin/main. M0–M5 remain
complete only under their recorded bounded Linux acceptance; M5 admission
`bfdbdbb` is unchanged. DEV-03 slices 8/9 are `4e18c58`/`48ac7fa`.

## Task and work

**M6-00 — planning/decomposition only.**
Created [proposal](tasks/M6-00.md) and bounded M6-01–16 briefs, refined the
[affected requirement trace](requirements.md#m6-decomposition-coverage-planned)
and [TODO](../TODO.md#m6--local-history-hardening-and-adoption-planned).
[Planning evidence](test-evidence/M6.md#m6-00--decomposition) records checks,
base/host, exclusions and review. No implementation, source/config/dependency,
fixture, SPEC or ADR change; no development-doc split/harness repackaging.

Numeric execution order:

1. M6-01 shutdown/C1/F2 disposition; M6-02 persistence fault/kill/restart.
2. M6-03 independent snapshots/retention; M6-04 configured external backup.
3. M6-05 history read IPC; M6-06 cadence/named revisions; M6-07 timeline/diff;
   M6-08 protected new-child restore; M6-09 explicit corruption recovery.
4. M6-10 release security/advisory/license/runtime-trust review.
5. M6-11 full performance/long-session measurement; M6-12 one measured fix
   after a scope addendum (or reviewed no-change result if all budgets pass).
6. M6-13 declared-target native/accessibility matrix; M6-14 actual installed
   offline/manual-update checks; M6-15 disposable migration/backup restore.
7. M6-16 owner writing pilot, final evidence and separate release review.

Actual dependencies, focused/shared tests, planned named native drills,
filesystem/platform coverage and exclusions live in each brief. Missing target
adapters or further measured fixes need bounded follow-up briefs before coding.
No concurrency, M6 admission/tagging or M7 work is authorized by this plan.

## Checks and retained limits

M6-00 Tier 1: formatting, changed local links/anchors, task/trace/dependency
and boundary audit, review of every diff, final `git diff --check`.
Results/commands: [M6 evidence](test-evidence/M6.md#m6-00--decomposition).
No executable checks required or newly claimed for docs-only planning.

Last verified DEV-03 state remains historical: 772/772 frontend tests,
lint/typecheck/build, Rust fmt/clippy/workspace, formatting/link/diff checks,
and native commands/publication-preview/pdf-export. This planning commit
changes no executable behavior and does not refresh runtime acceptance.

Owner Tier 1 OS/arch targets are **undeclared**. SPEC S01.2 and TODO require
that decision, recorded in `docs/development.md`, before M6 implementation;
subsequent implementation authorization is also required. The plan does not
invent targets or change development.md. M1-02 is the performance hardware
reference; later i5-host/rAF/row observations do not establish full S13.

C1 deliberate parent-kill and F2 forced-WebDriver teardown heap aborts remain
retained. Ordinary-close mitigation (ADR 0035) and later clean publication
exits do not resolve them. M6-01/02 own current phase/core/byte audits and
supported correction/disposition; unresolved release gates remain explicit.
No failure evidence is removed and no crash line is filtered.

Full S13 compositor/page-calibrated/long-session evidence, current fault/
restore/repair matrix, transitive notices/advisories/runtime trust, declared
native/screenreader/platform adapters, FUSE/desktop/installed/offline/update
checks, owner-authorized migration exports/independent backup restore and owner
pilot remain open.
A4/editor page markers remain outside this plan. Same filesystem/different
device does not prove independent physical storage. No universal power-loss
claim. No real manuscript, credentials, uploads or system/global changes.
DEV-02 tooling is complete; second-host acceptance is owner-only and excluded.

## Next action

STOP after the M6-00 planning commit. All M6 implementation tasks and M6-G
remain unchecked; Local v1 admission stays open. First future agent-executable
task is [M6-01](tasks/M6-01.md), once owner platform declaration, subsequent
implementation assignment and native prerequisites are satisfied. Begin with
current production shutdown/recovery audit; do not start history UI first.
