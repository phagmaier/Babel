# Dependency-ordered tasks

Authority: [SPEC S02/S03/S16/S18](SPEC.md#s16). `[x]` requires evidence; `[ ]` is open even when files exist. Each task names its gate and planned verification. M1–M6 are decomposed; M7 requires bounded decomposition before implementation. No M1 investigation begins during M0. Evidence lands in `docs/test-evidence/M*.md`, one file per milestone.

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

## M6 — local history, hardening and adoption (in progress)

<a id="m6--local-history-hardening-and-adoption-planned"></a>

- [ ] **M6-G Local history, hardening, adoption** — Deps: M2 history and M4/M5 bounded gates; M6-01–16 and all Local v1 evidence. Reqs: HIST-01/02, SAVE-04/05, QA-01–03, SEC-01/02, APP-01. Remains open. [Trace](docs/requirements.md#m6-decomposition-coverage-planned). Owner declared Linux for now 2026-10-02 ([ADR 0040](docs/decisions/0040-local-v1-platform-scope.md)); M6-13/14 still need exact release-target confirmation.
- [ ] **DEV-02 Second-machine smoothness** — Tooling slice landed; second-host bootstrap run still open (owner-only, outside M6). [Brief](docs/tasks/DEV-02.md); [evidence](docs/test-evidence/M5.md#dev-02--second-machine-smoothness-tooling-slice).

- [ ] **M6-02 Persistence interruption and restart hardening** — Bounded Linux fault/kill/restore and native path/ownership hardening recorded; retained Save As/IME operation disposition remains open. [Brief](docs/tasks/M6-02.md), [follow-up](docs/tasks/M6-02-R1.md), [evidence](docs/test-evidence/M6.md#m6-02--persistence-interruption-and-operation-investigation). C1/F2 retained.
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
Next agent-executable task: **M6-02-R1**, retained Save As/refusal and stress
IME readiness disposition. M6-02 remains unchecked; M6-03 has not started.
The supported-runtime M6-01-R1 follow-up remains gated by actual availability;
C stays open before M6-14/16. Stop at M6-02; no M6-03 or Local v1 admission.
DEV-02 second-host acceptance remains owner-only and outside M6 work.

## Audit execution (AUDIT.md frozen; check off here, never in AUDIT.md)

`AUDIT.md` (2026-10-03, base `1ef9515`, 48 findings + skeptic verdicts) is the frozen audit record — read-only. Each cluster below gets one brief in `docs/tasks/AUDIT-*.md`; evidence lands in `docs/test-evidence/AUDIT.md`. Briefs link to audit sections instead of copying them, and cite the [dropped/refuted list](AUDIT.md#dropped-or-refuted) for what must NOT be built. DESIGN implementations need owner triage first (table below); nothing there is agent-executable until decided.

### Wave 0 — unblockers

- [x] **Tier 1 debloat** (S-14 stale refs, `docs/index.md` stub, TODO collapse, tracked link/matrix tools, `target/` prune) — Evidence: Tier 1 commit `433c150`.
- [x] **T-08 (half)** — canonical matrix runner + link checker now tracked (`tools/run-workspace-matrix.py`, `tools/check-links.py`).
- [ ] **AUDIT-W0** (T-02 CI red, S-15 crate types, S-13 dead symbols) — [Brief](docs/tasks/AUDIT-W0.md). First; unblocks CI-dependent gates.

### Wave 1 — safety (briefs proposed, need approval)

| Cluster    | Findings                                                                                                                      | Effort | Depends on                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------- |
| AUDIT-C01  | C-01 + C-02 (capture failure stops journaling) + T-01 (tests stay red until C-01 fixed — same brief)                          | M–L    | —                            |
| AUDIT-C04  | C-04 (caret move rewrites file; native no-replace receipt, ~20 lines Rust + Tier 3)                                           | M      | —                            |
| AUDIT-D01  | D-01 smallest fix (Enter inserts separator row, 1–3 days) + S-08 keep-set wiring (`setDualDialogue`, `replaceLineWithBreaks`) | M      | owner accepts D-01 small fix |
| AUDIT-D08A | D-08(A) Reload on external change (SPEC S10.7 already requires it)                                                            | M      | owner accepts                |
| AUDIT-C356 | C-03 (escape encoder + renderer), C-05 (SELinux xattr names), C-06 (find/check decoration sets)                               | S–M    | —                            |

### Wave 2 — test gaps (proposed AUDIT-TEST)

T-03 (resume path, ~20-line composition), T-04 (8 `WritingSession` guard tests), T-05 (persistence-controller receipt validation), T-09 (structured-paste prefix/suffix), T-06 (replace/check sessions), T-07 (restore/resolve via WritingView), T-10 (SC002/SC004 mappings). All S; batch in dependency order. T-08 remainder (link checker is tracked; matrix-runner selector fix is in the tool) closes with first Tier 3 run.

### Wave 3 — deletions (proposed)

| Cluster      | Findings                                                                                                                                                           | Order constraint                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| AUDIT-SLP-A  | S-06 (legacy import path), S-07 (`readInitial`), S-09 (`relink_selected`: owner delete-vs-keep decision), S-10 (SaveStatus mount)                                  | S-09 needs owner call                                |
| AUDIT-SLP-B  | S-02 → S-01 (codec-independent ports first), S-03 + S-04 (with S-02), S-11 (`durable-replacement` only after porting candidate-tamper test; `history-store` stays) | strict order                                         |
| AUDIT-SLP-C  | S-08 deletes (`replaceInline`, `replaceHiddenContent`, conversion pair)                                                                                            | keep-set rides with AUDIT-D01                        |
| AUDIT-SIMP-N | X-01 (worker helper), X-05 (one handler list), X-02 (test fixtures), X-03 (store primitives)                                                                       | Tier 3 matrix; X- portions refuted in audit stay out |
| AUDIT-SIMP-F | X-04 (WritingView cleanup hoist + lock helper), X-06 (stamp helpers), X-08 (error-code const), X-07 (drill MODES table)                                            | Tier 1/2; no DEV-03 fold-back without owner call     |

### DESIGN triage — owner decision, no code (accept / reject / defer + rationale)

| ID      | Proposal                                                                                      | Recommendation                                            | Decision |
| ------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------- |
| D-01    | Enter separator fix now; element-level schema post-V1                                         | accept small fix, defer schema                            | _blank_  |
| D-02    | Auto-reconcile byte-identical journals; plain-language prompt on divergence (amends ADR 0017) | accept 1+3, reject auto-adopt + retirement (per skeptics) | _blank_  |
| D-03    | Screenplay element styling (S) + layout shell (M) before pilot                                | accept                                                    | _blank_  |
| D-04    | Non-printing elements → non-blocking summary; inline-note `raw` fix                           | accept                                                    | _blank_  |
| D-05    | Snapshots as single Versions; cut Git history UI (or freeze git2 + snapshot safety ref)       | decide: full cut vs cheap variant                         | _blank_  |
| D-06    | Plain status + failure-only close prompts (after C-04)                                        | accept after AUDIT-C04                                    | _blank_  |
| D-07    | Type-a-scene oracle (vitest + Screenplain + native) + early owner session                     | accept                                                    | _blank_  |
| D-08(A) | Reload on external change                                                                     | accept (SPEC-required)                                    | _blank_  |
| D-08(B) | Synced folder instead of M7                                                                   | reject (refuted in audit)                                 | _blank_  |
| D-09    | Page count without open preview (quiet-period job)                                            | accept                                                    | _blank_  |
| S-09    | Delete `relink_selected` vs keep as native-only API                                           | decide                                                    | _blank_  |

### Confirm-first parking (unverified observations, NOT findings — reproduce before tracking)

D-04 `FADE IN:`/section-drop renderer gaps; D-05 replace-all missing pre-destructive protection + 256-record snapshot cap; T-03 resume failure branches (null cadence, misleading abandon error, duplicate draft); T-05 WritingView timing flake; T-07 post-restore adoption failure; S-09 lease-order bug (unreachable today).

## M7 — explicit remote extension (gated)

Each `M*-G` group needs an `M*-00` decomposition and refined trace before coding.
M7 remains unchanged in scope and cannot begin before Local v1 adoption and the
owner's privacy/destination decision.

- [ ] **M7-G Explicit remote extension** — Deps: M6 local adoption gate and owner privacy/destination decision. Reqs: SYNC-01–05, INV-07/09/15. Read: SPEC S11; docs/sync-and-versioning.md.

## M8 — optional, separately scoped

FDX exchange if migration needs it; richer comparisons/statistics/shortcut profiles; index cards/source view; encrypted remote adapter; broader platforms; production revision tools. Each needs a new bounded task/requirement and tests. None blocks local v1 by default. [SPEC S16](SPEC.md#s16).
