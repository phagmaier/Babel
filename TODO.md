# Dependency-ordered tasks

Authority: [SPEC S02/S03/S16/S18](SPEC.md#s16). `[x]` requires evidence; `[ ]` is open even when files exist. Each task names its gate and planned verification. M1–M6 are decomposed; M7 requires bounded decomposition before implementation. No M1 investigation begins during M0. Evidence lands in `docs/test-evidence/M*.md`, one file per milestone.

Keep completed entries to a short status/outcome plus brief/evidence links; evidence prose belongs in test-evidence. Safety exceptions must be explicit.

Open tasks have detailed briefs in `docs/tasks/`. Completed briefs (`docs/tasks/M0-*`–`M6-01*`, `DEV-01/03`) are frozen history; completed evidence (`docs/test-evidence/`) is append-only. Do not expand this file with per-task detail for finished work.

## Completed — frozen summary (M0–M6-01)

<a id="m4--professional-daily-workflows"></a><a id="m5--publication-pipeline"></a>

- **M0 bootstrap** (M0-01–04, complete) — Evidence: [M0 report](docs/test-evidence/M0.md)
- **M1 bounded proofs** (M1-01–06, complete) — Evidence: [M1 report](docs/test-evidence/M1.md); ADRs [0007](docs/decisions/0007-source-aware-fountain-contract.md)–[0011](docs/decisions/0011-git2-history-store.md); [gate review](docs/m1-gate-review.md). Owner accepted M1-06 2026-09-28.
- **M2 headless foundation** (M2-01–06 incl. M2-05A/B/C/D, M2-05B-R/R1, complete; bounded Linux exit, no Local-v1/editor claim) — Evidence: [M2 index](docs/test-evidence/M2.md), [M2-01](docs/test-evidence/M2-01.md), [M2-02](docs/test-evidence/M2-02.md), [M2-03](docs/test-evidence/M2-03.md), [M2-04](docs/test-evidence/M2-04.md), [M2-05A](docs/test-evidence/M2-05A.md), [M2-05B](docs/test-evidence/M2-05B.md), [M2-05B-R](docs/test-evidence/M2-05B-R.md), [M2-05B-R1](docs/test-evidence/M2-05B-R1.md), [M2-05C](docs/test-evidence/M2-05C.md), [M2-05D](docs/test-evidence/M2-05D.md), [M2-06](docs/test-evidence/M2-06.md); ADRs [0012](docs/decisions/0012-native-document-identity.md)–[0020](docs/decisions/0020-native-curated-history.md)
- **M3 core editor** (M3-00–13 + R1 ×7, complete; bounded Linux exit tagged `m3-core-editor-linux-verified`) — Evidence: [M3 report](docs/test-evidence/M3.md); [re-review](docs/reviews/2026-09-29-m3-13-rereview.md)
- **M4 daily workflows** (M4-00–15 + M4-15-R2, complete; bounded Linux exit tagged `m4-daily-workflows-linux-verified`) — Evidence: [M4 report](docs/test-evidence/M4.md); [post-integration review](docs/reviews/2026-10-02-m4-15-post-integration-review.md)
- **M5 publication + DEV-01/03** (M5-00–07, DEV-01, DEV-03, complete; bounded Linux publication gate) — Evidence: [M5 report](docs/test-evidence/M5.md); [publication review](docs/reviews/2026-10-02-m5-07-publication-review.md)
- **M6-00 planning + M6-01 shutdown investigation** (complete; bounded Linux, no crash resolution/admission) — Evidence: [M6 report](docs/test-evidence/M6.md); [shutdown review](docs/reviews/2026-10-02-m6-01-shutdown-review.md)

## M6 — local history, hardening and adoption

<a id="m6--local-history-hardening-and-adoption-planned"></a>

- [ ] **M6-G Local history, hardening, adoption** — Deps: M2 history and M4/M5 bounded gates; M6-01–16 and all Local v1 evidence. Reqs: HIST-01/02, SAVE-04/05, QA-01–03, SEC-01/02, APP-01. Remains open. [Trace](docs/requirements.md#m6-decomposition-coverage-planned). Owner declared Linux for now 2026-10-02 ([ADR 0040](docs/decisions/0040-local-v1-platform-scope.md)); M6-13/14 still need exact release-target confirmation.
- [ ] **DEV-02 Second-machine smoothness** — Tooling slice landed; second-host bootstrap run still open (owner-only, outside M6). [Brief](docs/tasks/DEV-02.md); [evidence](docs/test-evidence/M5.md#dev-02--second-machine-smoothness-tooling-slice).

- [ ] **M6-02 Persistence interruption and restart hardening** — Bounded Linux hardening and R1–R3 investigation recorded; original Save As/IME failures remain open. [Brief](docs/tasks/M6-02.md), [R1](docs/test-evidence/M6-02-R1.md), [R2](docs/test-evidence/M6-02-R2.md), [R3/next proposed slice](docs/test-evidence/M6-02-R3.md), [historical evidence](docs/test-evidence/M6.md#m6-02--persistence-interruption-and-operation-investigation). C1/F2 retained.
- [ ] **M6-03 Independent snapshot and retention workflow** — Deps: M6-02; platform/authorization gate P. [Brief](docs/tasks/M6-03.md).
- [ ] **M6-04 Configured external backup destination** — Deps: M6-03; platform/authorization gate P. [Brief](docs/tasks/M6-04.md).
- [ ] **M6-05 Bounded native history inspection and selection** — Deps: M6-02/04; platform/authorization gate P. [Brief](docs/tasks/M6-05.md).
- [ ] **M6-06 Automatic and named local revision cadence** — Deps: M6-05; platform/authorization gate P. [Brief](docs/tasks/M6-06.md).
- [ ] **M6-07 History timeline preview and readable comparison** — Deps: M6-05/06; platform/authorization gate P. [Brief](docs/tasks/M6-07.md).
- [ ] **M6-08 Non-destructive historical restore** — Deps: M6-03/06/07; platform/authorization gate P. [Brief](docs/tasks/M6-08.md).
- [ ] **M6-09 Explicit history corruption recovery** — Deps: M6-05/08; platform/authorization gate P. [Brief](docs/tasks/M6-09.md).
- [ ] **M6-10 Release security and locked dependency review** — Deps: M6-01/02/09; platform/authorization gate P. [Brief](docs/tasks/M6-10.md).
- [ ] **M6-11 Full responsiveness and long-session baseline** — Deps: M6-04/06/08/10; platform/authorization gate P. [Brief](docs/tasks/M6-11.md).
- [ ] **M6-12 Measured responsiveness correction** — Deps: M6-11; platform/authorization gate P. [Brief](docs/tasks/M6-12.md).
- [ ] **M6-13 Declared-target native and accessibility matrix** — Deps: M6-02/09/10/12; platform/authorization gate P. [Brief](docs/tasks/M6-13.md).
- [ ] **M6-14 Installed offline package and manual update checks** — Deps: M6-10/13; platform/authorization gate P. [Brief](docs/tasks/M6-14.md).
- [ ] **M6-15 Disposable migration and independent backup restore** — Deps: M6-04/08/14; platform/authorization gate P. [Brief](docs/tasks/M6-15.md).
- [ ] **M6-16 Owner writing pilot and Local v1 release review** — Deps: M6-01/02/03/04/05/06/07/08/09/10/11/12/13/14/15; platform/authorization gate P. [Brief](docs/tasks/M6-16.md).

M6-02 needs the M6-01 review artifact; an unresolved C1/F2 release gate may remain
while independent safety work proceeds. M6-12 requires a measured scope addendum
before correction; M6-13 needs new bounded briefs for missing target adapters.
M6-02-R1's **bounded attempt is complete, operation disposition unresolved**.
Its [R2 diagnostic slice](docs/tasks/M6-02-R2.md) and [R3 injected investigation](docs/tasks/M6-02-R3.md) are complete; further stage tracing is proposed, unselected. Task selection lives only in
[current-state Next action](docs/current-state.md#next-action). Its stop before
M6-03 and Local v1 admission remains binding when selected.

<a id="audit-execution-auditmd-frozen-check-off-here-never-in-auditmd"></a>
<a id="design-triage--decided-2026-10-03-executable-accept--reject--defer--rationale"></a>

## Audit status

- [x] **INFRA-WORKFLOW** — change-based local checks, bounded disposition and M6 resumption. [Brief](docs/tasks/INFRA-WORKFLOW.md), [evidence](docs/test-evidence/INFRA-WORKFLOW.md).

- [x] **INFRA-INSTRUCTIONS** — guidance/tooling maintenance complete; both published CI jobs passed. [Brief](docs/tasks/INFRA-INSTRUCTIONS.md), [evidence](docs/test-evidence/INFRA-INSTRUCTIONS.md).

The [audit tracker](docs/tasks/AUDIT-TRACKER.md) owns audit checkboxes,
wave prerequisites and open owner decisions. [Current-state Next action](docs/current-state.md#next-action)
is the only continuation pointer; an unchecked row is not permission to start.

## M7 — explicit remote extension (gated)

Each `M*-G` group needs an `M*-00` decomposition and refined trace before coding.
M7 remains unchanged in scope and cannot begin before Local v1 adoption and the
owner's privacy/destination decision.

- [ ] **M7-G Explicit remote extension** — Deps: M6 local adoption gate and owner privacy/destination decision. Reqs: SYNC-01–05, INV-07/09/15. Read: SPEC S11; docs/sync-and-versioning.md.

## M8 — optional, separately scoped

FDX exchange if migration needs it; richer comparisons/statistics/shortcut profiles; index cards/source view; encrypted remote adapter; broader platforms; production revision tools. Each needs a new bounded task/requirement and tests. None blocks local v1 by default. [SPEC S16](SPEC.md#s16).
