# Dependency-ordered tasks

Authority: [SPEC S02/S03/S16/S18](SPEC.md#s16). `[x]` requires evidence; `[ ]` is open even when files exist. Each task names its gate and planned verification. M1–M6 are decomposed; M7 requires bounded decomposition before implementation. No M1 investigation begins during M0. Evidence lands in `docs/test-evidence/M*.md`, one file per milestone.

Keep completed entries to a short status/outcome plus brief/evidence links; evidence prose belongs in test-evidence. Safety exceptions must be explicit.

Agents decide scope, priority, risk and gates themselves ([ADR 0043](docs/decisions/0043-agent-decision-authority.md)); "gate P" and owner gates are satisfied. Open tasks have detailed briefs in `docs/tasks/`. Completed briefs (`docs/tasks/M0-*`–`M6-01*`, `DEV-01/03`) are frozen history; completed evidence (`docs/test-evidence/`) is append-only. Do not expand this file with per-task detail for finished work.

## Completed — frozen summary (M0–M6-01)

<a id="m4--professional-daily-workflows"></a><a id="m5--publication-pipeline"></a>

- **M0 bootstrap** (M0-01–04, complete) — Evidence: [M0 report](docs/test-evidence/M0.md)
- **M1 bounded proofs** (M1-01–06, complete) — Evidence: [M1 report](docs/test-evidence/M1.md); ADRs [0007](docs/decisions/0007-source-aware-fountain-contract.md)–[0011](docs/decisions/0011-git2-history-store.md); [gate review](docs/archive/m1-gate-review.md). Owner accepted M1-06 2026-09-28.
- **M2 headless foundation** (M2-01–06 incl. M2-05A/B/C/D, M2-05B-R/R1, complete; bounded Linux exit, no Local-v1/editor claim) — Evidence: [M2 index](docs/test-evidence/M2.md), [M2-01](docs/test-evidence/M2-01.md), [M2-02](docs/test-evidence/M2-02.md), [M2-03](docs/test-evidence/M2-03.md), [M2-04](docs/test-evidence/M2-04.md), [M2-05A](docs/test-evidence/M2-05A.md), [M2-05B](docs/test-evidence/M2-05B.md), [M2-05B-R](docs/test-evidence/M2-05B-R.md), [M2-05B-R1](docs/test-evidence/M2-05B-R1.md), [M2-05C](docs/test-evidence/M2-05C.md), [M2-05D](docs/test-evidence/M2-05D.md), [M2-06](docs/test-evidence/M2-06.md); ADRs [0012](docs/decisions/0012-native-document-identity.md)–[0020](docs/decisions/0020-native-curated-history.md)
- **M3 core editor** (M3-00–13 + R1 ×7, complete; bounded Linux exit tagged `m3-core-editor-linux-verified`) — Evidence: [M3 report](docs/test-evidence/M3.md); [re-review](docs/archive/reviews/2026-09-29-m3-13-rereview.md)
- **M4 daily workflows** (M4-00–15 + M4-15-R2, complete; bounded Linux exit tagged `m4-daily-workflows-linux-verified`) — Evidence: [M4 report](docs/test-evidence/M4.md); [post-integration review](docs/archive/reviews/2026-10-02-m4-15-post-integration-review.md)
- **M5 publication + DEV-01/03** (M5-00–07, DEV-01, DEV-03, complete; bounded Linux publication gate) — Evidence: [M5 report](docs/test-evidence/M5.md); [publication review](docs/archive/reviews/2026-10-02-m5-07-publication-review.md)
- **M6-00 planning + M6-01 shutdown investigation** (complete; bounded Linux, no crash resolution/admission) — Evidence: [M6 report](docs/test-evidence/M6.md); [shutdown review](docs/archive/reviews/2026-10-02-m6-01-shutdown-review.md)

## M6 — local history, hardening and adoption

<a id="m6--local-history-hardening-and-adoption-planned"></a>

- [ ] **M6-G Local history, hardening, adoption** — Deps: M6-03, M6-14, M6-16 (M6-05–09 deferred post-V1 by D-05). Reqs: SAVE-04/05, QA-01–03, SEC-01/02, APP-01; HIST-01/02 met for V1 by snapshots. [Trace](docs/requirements.md#m6-decomposition-coverage-planned). Linux x86_64 ([ADR 0040](docs/decisions/0040-local-v1-platform-scope.md)).
- [ ] **DEV-02 Second-machine smoothness** — Tooling slice landed; second-host run deferred (no agent has a second host; not a blocker). [Brief](docs/tasks/DEV-02.md).

- [x] **M6-02 Persistence interruption and restart hardening** — Closed with known limitations ([ADR 0043](docs/decisions/0043-agent-decision-authority.md)): Save As/IME readiness lag (content saved), shared-store lease limit, and the forced-teardown [native register](docs/native-findings.md) accepted as residual risk. [Brief](docs/archive/tasks/M6-02.md), [evidence](docs/test-evidence/M6.md#m6-02--persistence-interruption-and-operation-investigation).
- [ ] **M6-03 Independent snapshot and retention workflow** — M6-03-A done: automatic retention at the cap. Remaining UI/restore drills in the [brief](docs/tasks/M6-03.md).
- [ ] **M6-04 Configured external backup destination** — Deps: M6-03. [Brief](docs/tasks/M6-04.md).
- [ ] **M6-05 Bounded native history inspection and selection** — **Deferred post-V1 (D-05; snapshots are V1 Versions).** Deps: M6-02/04. [Brief](docs/tasks/M6-05.md).
- [ ] **M6-06 Automatic and named local revision cadence** — **Deferred post-V1 (D-05; snapshots are V1 Versions).** Deps: M6-05. [Brief](docs/tasks/M6-06.md).
- [ ] **M6-07 History timeline preview and readable comparison** — **Deferred post-V1 (D-05; snapshots are V1 Versions).** Deps: M6-05/06. [Brief](docs/tasks/M6-07.md).
- [ ] **M6-08 Non-destructive historical restore** — **Deferred post-V1 (D-05; snapshots are V1 Versions).** Deps: M6-03/06/07. [Brief](docs/tasks/M6-08.md).
- [ ] **M6-09 Explicit history corruption recovery** — **Deferred post-V1 (D-05; snapshots are V1 Versions).** Deps: M6-05/08. [Brief](docs/tasks/M6-09.md).
- [ ] **M6-10 Release security and locked dependency review** — Deps: M6-01/02/09. [Brief](docs/tasks/M6-10.md).
- [ ] **M6-11 Full responsiveness and long-session baseline** — Deps: M6-04/06/08/10. [Brief](docs/tasks/M6-11.md).
- [ ] **M6-12 Measured responsiveness correction** — Deps: M6-11. [Brief](docs/tasks/M6-12.md).
- [ ] **M6-13 Declared-target native and accessibility matrix** — Deps: M6-02/09/10/12. [Brief](docs/tasks/M6-13.md).
- [ ] **M6-14 Installed offline package and manual update checks** — Deps: M6-03; folds in a basic locked-dependency audit (M6-10 scope) for the Linux package. [Brief](docs/tasks/M6-14.md).
- [ ] **M6-15 Disposable migration and independent backup restore** — Deps: M6-04/08/14. [Brief](docs/tasks/M6-15.md).
- [ ] **M6-16 Agent-run writing pilot and Local v1 release review** — Deps: M6-03, M6-14; S15.5 sequence on synthetic scripts (step 7 via snapshot restore). Deferred tasks do not block it. [Brief](docs/tasks/M6-16.md).

Work order lives only in [current-state Next action](docs/current-state.md#next-action).
M6-04, M6-10–13 and M6-15 are not V1 blockers; agents take them when the list reaches them.

<a id="audit-execution-auditmd-frozen-check-off-here-never-in-auditmd"></a>
<a id="design-triage--decided-2026-10-03-executable-accept--reject--defer--rationale"></a>

## Audit status

- [x] **INFRA-WORKFLOW** — change-based local checks, bounded disposition and M6 resumption. [Brief](docs/archive/tasks/INFRA-WORKFLOW.md), [evidence](docs/test-evidence/INFRA-WORKFLOW.md).

- [x] **INFRA-INSTRUCTIONS** — guidance/tooling maintenance complete; both published CI jobs passed. [Brief](docs/archive/tasks/INFRA-INSTRUCTIONS.md), [evidence](docs/test-evidence/INFRA-INSTRUCTIONS.md).

- [x] **AUDIT-PARK-H-F4-REVIEW** — closure review complete; five slices done, residual group remains open without retirement. [Brief](docs/archive/tasks/AUDIT-PARK-H-F4-REVIEW.md), [evidence](docs/test-evidence/AUDIT-PARK-H-F4-REVIEW.md).
- [x] **AUDIT-PARK-H-F4-PREFIX** — mechanism investigation complete; existing intent gates block exact prefix bytes. F4 rows now reach recovery via [ADR 0044](docs/decisions/0044-recovery-independent-of-capture.md); faithful file save of those rows remains a follow-up. [Brief](docs/archive/tasks/AUDIT-PARK-H-F4-PREFIX.md), [evidence](docs/test-evidence/AUDIT-PARK-H-F4-PREFIX.md).

The [audit tracker](docs/tasks/AUDIT-TRACKER.md) owns audit checkboxes. [Current-state Next action](docs/current-state.md#next-action)
is the only continuation pointer.

## M7 — explicit remote extension (gated)

Each `M*-G` group needs an `M*-00` decomposition and refined trace before coding.
M7 remains unchanged in scope and cannot begin before Local v1. Real uploads stay
disabled by default (no paid or third-party destination is chosen by agents).

- [ ] **M7-G Explicit remote extension** — Deps: Local v1; a free, local or self-hosted destination chosen by the working agent. Reqs: SYNC-01–05, INV-07/09/15. Read: SPEC S11; docs/sync-and-versioning.md.

## M8 — optional, separately scoped

FDX exchange if migration needs it; richer comparisons/statistics/shortcut profiles; index cards/source view; encrypted remote adapter; broader platforms; production revision tools. Each needs a new bounded task/requirement and tests. None blocks local v1 by default. [SPEC S16](SPEC.md#s16).
