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

`AUDIT.md` (2026-10-03, base `1ef9515`, 48 findings + skeptic verdicts) is the frozen audit record — read-only. Each cluster below gets one brief in `docs/tasks/AUDIT-*.md`; evidence lands in `docs/test-evidence/AUDIT.md`. Briefs link to audit sections instead of copying them, and cite the [dropped/refuted list](AUDIT.md#dropped-or-refuted) for what must NOT be built. DESIGN implementations need owner triage first (table below); nothing there is agent-executable until decided. Triage decided 2026-10-03 — all DESIGN rows below are now executable in wave order.

How to pick work: the next unchecked `[ ]` box below is the task. Read its brief, implement, record evidence in `docs/test-evidence/AUDIT.md`, check the box. Wave order is binding; table order within a wave is priority order; per-row prerequisites (D-06 after C-04, S-02 before S-01) are hard.

### Wave 0 — unblockers

- [x] **Tier 1 debloat** (S-14 stale refs, `docs/index.md` stub, TODO collapse, tracked link/matrix tools, `target/` prune) — Evidence: Tier 1 commit `433c150`.
- [x] **T-08** — canonical matrix runner + link checker tracked (`tools/run-workspace-matrix.py`, `tools/check-links.py`); first full-selector Tier 3 matrix completed in AUDIT-C356, closure recorded in [AUDIT-TEST evidence](docs/test-evidence/AUDIT.md#audit-test--wave-2-regression-gaps).
- [x] **AUDIT-W0** (T-02 CI red, S-15 crate types, S-13 dead symbols) — [Brief](docs/tasks/AUDIT-W0.md). [Evidence](docs/test-evidence/AUDIT.md#audit-w0--ci-gate-desktop-crate-types-dead-symbols): original Tier 2 local pass; first pushed native CI exposed the Enchant 2.3.3 ABI prerequisite, tracked in W0-R1 below.
- [x] **AUDIT-W0-R1** — [Brief](docs/tasks/AUDIT-W0-R1.md). [Evidence](docs/test-evidence/AUDIT.md#audit-w0-r1--enchant-ci-abi-prerequisite): Enchant >=2.4 build guard, pinned 2.8.21/Hunspell CI prefix and groff prerequisite; [actual CI green](https://github.com/phagmaier/Babel/actions/runs/37157598075) at `49129df`, native workspace 275/275 and package build. Local frontend 844/844, matrix 275/275 each and offline spellcheck 2/2 strict; failures retained, C1/F2 unchanged.

### Wave 1 — safety (approved 2026-10-03; working agent drafts one brief at a time, in table order, same shape as AUDIT-W0)

| Cluster    | Findings                                                                                                                      | Effort | Depends on            |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------- |
| AUDIT-C01  | C-01 + C-02 (capture failure stops journaling) + T-01 (tests stay red until C-01 fixed — same brief)                          | M–L    | —                     |
| AUDIT-C04  | C-04 (caret move rewrites file; native no-replace receipt, ~20 lines Rust + Tier 3)                                           | M      | —                     |
| AUDIT-D01  | D-01 smallest fix (Enter inserts separator row, 1–3 days) + S-08 keep-set wiring (`setDualDialogue`, `replaceLineWithBreaks`) | M      | D-01 accepted (below) |
| AUDIT-D08A | D-08(A) Reload on external change (SPEC S10.7 already requires it)                                                            | M      | accepted (below)      |
| AUDIT-C356 | C-03 (escape encoder + renderer), C-05 (SELinux xattr names), C-06 (find/check decoration sets)                               | S–M    | —                     |

- [x] **AUDIT-C01** — [Brief](docs/tasks/AUDIT-C01.md). [Evidence](docs/test-evidence/AUDIT.md#audit-c01--capture-stays-possible-on-standard-fountain-edits-and-edge-space-emphasis): Tier 2, mocked/JSDOM only; remaining uncapturable shapes listed there.
- [x] **AUDIT-C04** — [Brief](docs/tasks/AUDIT-C04.md). [Evidence](docs/test-evidence/AUDIT.md#audit-c04--a-caret-move-no-longer-rewrites-the-manuscript): Tier 3, tmpfs/Btrfs matrix 268/268 and native lifecycle drill on both; one unreproduced Btrfs publication-cache failure retained there.
- [x] **AUDIT-D01** — [Brief](docs/tasks/AUDIT-D01.md). [Evidence](docs/test-evidence/AUDIT.md#audit-d01--portable-enter-separators-and-explicit-speechbreak-authoring): Tier 2, separator Enter and inherited speech continuation, Shift+Enter/dual codec wiring; mocked/JSDOM + browser smoke, no native scene/PDF oracle.
- [x] **AUDIT-D08A** — [Brief](docs/tasks/AUDIT-D08A.md). [Evidence](docs/test-evidence/AUDIT.md#audit-d08a--protected-external-reload): protected explicit Reload, focus/periodic checks, metadata re-anchor; workspace 275/275 each and actual WebKit 2/2 strict on tmpfs/Btrfs; retained failures, C1/F2 unchanged.
- [x] **AUDIT-C356** — [Brief](docs/tasks/AUDIT-C356.md). [Evidence](docs/test-evidence/AUDIT.md#audit-c356--literal-escapes-selinux-metadata-and-advisory-highlights): literal escape encoder/frozen renderer, exact SELinux xattr-name exemption and independent Find/check highlights; frontend 848/848, workspace 277/277 each tmpfs/Btrfs, helper 13/13 and offline packaged escapes 2/2, unchanged 22 golden pages, default package/browser/static pass. Enforcing SELinux/Fedora unverified; C1/F2 unchanged. Wave 1 completion boundary satisfied.

### Wave 2 — test gaps (approved as AUDIT-TEST)

- [x] **AUDIT-TEST** — [Brief](docs/tasks/AUDIT-TEST.md). [Evidence](docs/test-evidence/AUDIT.md#audit-test--wave-2-regression-gaps): 66 added regressions, disposed-resume cancellation and preserved protection/cleanup errors; frontend 914/914, focused 188/188, mutation faults 25/25 detected, workspace 277/277, shared static/build/browser pass. Injected-port/JSDOM; native safety gates unchanged. Wave 2 stopping point respected before the authorized SLP-A continuation.

T-03 (resume path, ~20-line composition), T-04 (8 `WritingSession` guard tests), T-05 (persistence-controller receipt validation), T-09 (structured-paste prefix/suffix), T-06 (replace/check sessions), T-07 (restore/resolve via WritingView), T-10 (SC002/SC004 mappings). All S; batch in dependency order. T-08 remainder (link checker is tracked; matrix-runner selector fix is in the tool) closes with first Tier 3 run.

### Wave 3 — deletions (approved 2026-10-03)

- [x] **AUDIT-SLP-A** — [Brief](docs/tasks/AUDIT-SLP-A.md). [Evidence](docs/test-evidence/AUDIT.md#audit-slp-a--unused-import-read-relink-and-status-paths): removed unused legacy import/read/relink/status surfaces; ported live contracts; frontend 919/919, workspace 273/273 each tmpfs/Btrfs, 7/7 selected faults detected, default native workflow 2/2 and migrated input fixture pass. Stopped before SLP-B; C1/F2 and other native admission gates unchanged.

- [x] **AUDIT-SLP-B** — [Brief](docs/tasks/AUDIT-SLP-B.md). [Evidence](docs/test-evidence/AUDIT.md#audit-slp-b--retired-prototype-proofs-with-production-coverage): retired superseded composition/native/PDF/snapshot/codec/replacement proofs after porting independent corpus/fixture and candidate-tamper coverage. Frontend 862/862, workspace 261/261 each tmpfs/Btrfs, five injected faults detected; retained fixtures/backend/renderer/history-store intact. Native initial content 2/2/strict 1/2 (owned WebKit SIGSEGV retained), fresh strict control/replay 2/2; feature input/protection pass. Stopped before SLP-C; M6-03 copy/prune audit, SELinux, C1/F2, M6-02 and Local v1 remain open.

- [x] **AUDIT-SLP-C** — [Brief](docs/tasks/AUDIT-SLP-C.md). [Evidence](docs/test-evidence/AUDIT.md#audit-slp-c--unused-complex-codec-edit-apis): removed unused inline/hidden/conversion APIs and bypass flags; ported live editor/title/known-context tests, retained parser/protection expectations and all independent fixture bytes. Frontend 863/863, Rust workspace 261/261 (Tier 2, one filesystem), focused 275/275, baseline-live 49/49; browser/renderer/static checks pass. D01 keep-set unchanged; stopped before SIMP-N. SELinux, C1/F2, M6-02 and Local v1 remain open.

- [x] **AUDIT-SIMP-N** — [Brief](docs/tasks/AUDIT-SIMP-N.md). [Evidence](docs/test-evidence/AUDIT.md#audit-simp-n--shared-native-workers-and-storagetest-primitives): accepted X-01/05/02/03 shared workers, single handler list, test roots/IPC and bounded storage primitives; costs/error mappings/cleanup/write order preserved. Frontend 863/863, workspace 264/264 and retained feature 65/65 each tmpfs/Btrfs, native 4/4 strict plus independent artifact audit; builds/browser/static pass. Frozen files and prior assertions intact; refuted proposals excluded. Stopped before SIMP-F. SELinux, C1/F2, M6-02 and Local v1 remain open.

- [x] **AUDIT-SIMP-F** — [Brief](docs/tasks/AUDIT-SIMP-F.md). [Evidence](docs/test-evidence/AUDIT.md#audit-simp-f--frontend-guard-and-native-dispatch-simplification): cleanup/three locks, stamp guards/constructions, single 31-code list and ordered native dispatch. Frontend 867/867, Rust 264/264, focused 64/64; build/browser/static/AST/artifact audits pass. All 22 migrated native modes rerun: selected 21/22 successful; commands/F6 fails identically on frozen baseline, initial assessment failure retained. Original assertions/partial guards/frozen bytes intact; stopped before further DESIGN/D-06. Native findings, SELinux, C1/F2, M6-02 and Local v1 remain open.

| Cluster      | Findings                                                                                                                                                           | Order constraint                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| AUDIT-SLP-A  | S-06 (legacy import path), S-07 (`readInitial`), S-09 (`relink_selected`: DELETE decided), S-10 (SaveStatus mount)                                                 | S-09 deletes with this cluster                       |
| AUDIT-SLP-B  | S-02 → S-01 (codec-independent ports first), S-03 + S-04 (with S-02), S-11 (`durable-replacement` only after porting candidate-tamper test; `history-store` stays) | strict order                                         |
| AUDIT-SLP-C  | S-08 deletes (`replaceInline`, `replaceHiddenContent`, conversion pair)                                                                                            | keep-set rides with AUDIT-D01                        |
| AUDIT-SIMP-N | X-01 (worker helper), X-05 (one handler list), X-02 (test fixtures), X-03 (store primitives)                                                                       | Tier 3 matrix; X- portions refuted in audit stay out |
| AUDIT-SIMP-F | X-04 (WritingView cleanup hoist + lock helper), X-06 (stamp helpers), X-08 (error-code const), X-07 (drill MODES table)                                            | Tier 1/2; no DEV-03 fold-back without owner call     |

- [x] **AUDIT-NATIVE-R1** — [Brief](docs/tasks/AUDIT-NATIVE-R1.md). [Evidence](docs/test-evidence/AUDIT.md#audit-native-r1--f6-focus-and-private-mozc): Save-first F6; read-only canonical Mozc bind; observed owned GTK selection during physical menu traversal. Frontend 876/876, Rust 264/264, browser/release/static pass. Commands 2/2 strict; editor 2/2 content, 1/2 strict (owned Btrfs WebKit SIGSEGV retained with core/PID/start evidence). Original F6/Mozc blockers corrected; broader native/keyboard, C1/F2 and admission gates remain open. Stopped before D-02; no push.

- [x] **AUDIT-D02** — [Brief](docs/tasks/AUDIT-D02.md). [Evidence](docs/test-evidence/AUDIT.md#audit-d02--safe-reopen-reconciliation-and-recovery-choice): strict identical-latest reopen, hash-bound explicit Keep, plain review before editing, owned caret and auxiliary mutation gates. Frontend 885/885; Rust 273/273 each tmpfs/Btrfs; shared/browser/default release pass. Final native 20/20 content, 19/20 strict; owned Btrfs WebKit SIGABRT plus earlier crashes/failures retained without cause/disposition. No automatic adoption/retirement or source receipt. Stop before D-03; no push. SELinux, C1/F2, M6-02 and Local v1 remain open.

- [x] **AUDIT-D03A** — [Brief](docs/tasks/AUDIT-D03.md). [Evidence](docs/test-evidence/AUDIT.md#audit-d03a--on-screen-screenplay-element-styling): EDIT-07 per-element indentation in a proportional 60-character column, CSS only; effective 920px writing shell (was 680px by rule order). Chromium geometry check red/green; frontend 885/885; Rust 273/273 one filesystem (Tier 2); release pass. Native 9/10 content, 10/10 crash audits clean; Btrfs presentation Find-viewport assertion fails identically on the unchanged D02 control and is retained without cause. Stop before D03B; no push.

- [x] **AUDIT-D03B** — [Brief](docs/tasks/AUDIT-D03.md#slice-b-audit-d03b--layout-shell-m). [Evidence](docs/test-evidence/AUDIT.md#audit-d03b--writing-layout-shell): three-column shell on wide windows (sticky navigator, script, tools drawer), unchanged DOM/keyboard order, editor never remounted, stable one-row status header, narrow stack kept. Frontend 886/886; Chromium shell geometry red/green; Rust 273/273 one filesystem (Tier 2); release pass. Native 20/22 content, 19/22 strict over 11 modes on tmpfs/Btrfs with no drill change; Btrfs presentation now passes. Script Check failure was a harness artifact (frozen copies cannot find `pdf-helper`; corrected in the D03B evidence, in-place run 2/2); two owned WebKit SIGABRTs retained without cause. Stop after D-03; no push.

- [x] **AUDIT-D04** — [Brief](docs/tasks/AUDIT-D04.md). [Evidence](docs/test-evidence/AUDIT.md#audit-d04--non-blocking-omissions-and-inline-note-assessment): omitted notes, boneyards, sections and synopses are one non-blocking summary; closed inline hidden spans no longer make a line raw for assessment; captures with nothing to review go straight to the destination picker; summary guarded where the pinned renderer disagrees with the codec. Shared 27-case corpus checked by the renderer (PDF text) and by the assessment; six injected faults detected. Frontend 927/927; helper 14/14; Rust 273/273 one filesystem (Tier 2); release pass. Native 6/6 strict pdf-export/script-check/publication-exit plus 4/4 daily-session/commands on tmpfs/Btrfs. SIMP-F daily-assessment finding explained (helper resolution). Stop after D-04; no push.

- [x] **AUDIT-D04-R1** — [Brief](docs/tasks/AUDIT-D04-R1.md). [Evidence](docs/test-evidence/AUDIT.md#audit-d04-r1--all-empty-leading-key-block): owner-approved rule — a leading `Key:` block is a title page only if a field has a value (key line or indented continuation); `FADE IN:` and other all-empty blocks are body text on both sides. Title form cannot leave an all-empty block (refusals plus an action sweep). Assessment mirrors the renderer's title-page reading (indented line after a valued key, indented first key). 6/6 faults detected; frontend 999/999, helper 15/15, browser pass. Native title-page drill BLOCKED (no display).

- [x] **AUDIT-D07** — [Brief](docs/tasks/AUDIT-D07.md). [Evidence](docs/test-evidence/AUDIT.md#audit-d07--typed-scene-oracle): the S07.2 sequence typed from zero bytes through the mounted editor with live completion pins bytes, rows, Undo/Redo, Script Check `[]` and the omission summary; the same hand-written fixture is checked by the pinned renderer's paragraph classification and `pdftotext`. 6/6 injected faults detected; frontend 932/932, helper 15/15. JSDOM only; native typed-export case BLOCKED (no display, no drill mode yet). Owner session remains non-blocking.
- [ ] **AUDIT-D07-F** — four findings from the oracle, pinned as found, owner decisions before any fix: F1 empty Dialogue/Parenthetical Enter → Action has no separator (S07.2 vs S07.3 and a pinned key test; gated by SC005); F2 no keyboard exit from a note at document end; F3 Page Break choice leaves the caret before `===` (pinned by a shortcut test; gated); F4 empty-cue suggestions capture the second Tab of the element cycle (S07.4 vs S07.6). Reproductions in the D-07 evidence.

- [x] **AUDIT-D04-R2** — [Brief](docs/tasks/AUDIT-D04-R2.md). [Evidence](docs/test-evidence/AUDIT.md#audit-d04-r2--renderercodec-disagreement-sweep): shared corpus 27 → 68 hand-written cases checked by the pinned renderer (PDF text) and the assessment; 18 clean-but-different cases are now blocking SC005 with the renderer's reason (markers after indentation, indented headings, padded page breaks, two-space and bare `@` cues, capitals in headings and forced transitions). Codec unchanged; 7/7 guard faults detected; frontend 973/973, helper 15/15. Native drills BLOCKED (no display).

### DESIGN triage — decided 2026-10-03, executable (accept / reject / defer + rationale)

- [x] **AUDIT-D06** — [Brief](docs/tasks/AUDIT-D06.md). [Evidence](docs/test-evidence/AUDIT.md#audit-d06--plain-status-and-failure-only-close-prompts): plain status/details/alerts; automatic exact-protection/release close for files and read-only sessions; untitled/failure choices and Keep writing retained. Current frontend 875/875, Rust 264/264; browser/release/static/artifact checks pass. WebKit selected 10/14 successful, 14/14 owned crash audits clean; separate plain presentation 2/2 strict. F6/Mozc fail on frozen controls; all failed attempts retained. Stopped after D-06; native/IME, SELinux, C1/F2, M6-02 and Local v1 gates remain open.

| ID      | Proposal                                                                                      | Decision                                                                                                                                                                                                                               |
| ------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-01    | Enter separator fix now; element-level schema post-V1                                         | **Accept small fix; defer schema post-V1.** Skeptic-verified 1–3d fix; full rewrite unneeded for V1.                                                                                                                                   |
| D-02    | Auto-reconcile byte-identical journals; plain-language prompt on divergence (amends ADR 0017) | **Accept rules 1+3; reject auto-adopt + retirement.** Skeptics showed loss paths (Save-As redirect; retirement can delete the sole copy).                                                                                              |
| D-03    | Screenplay element styling (S) + layout shell (M) before pilot                                | **Accept both slices before pilot.** No spec conflict; piloting on identical-lines surface wastes M6-16.                                                                                                                               |
| D-04    | Non-printing elements → non-blocking summary; inline-note `raw` fix                           | **Accept.** Current ack decides nothing (profile cannot print them); inline-note `raw` fix required or the change is hollow.                                                                                                           |
| D-05    | Snapshots as single Versions; cut Git history UI (or freeze git2 + snapshot safety ref)       | **Cheap variant now; defer full cut post-V1.** Freeze git2, add verified PreDestructive snapshot, downgrade Git failure to warning. Keeps M2-06/M4 evidence valid; harden the 256-record cap in the same brief (latent blocker today). |
| D-06    | Plain status + failure-only close prompts (after C-04)                                        | **Accept after AUDIT-C04 (hard order).** One-word status flickers on every caret move until C-04 lands.                                                                                                                                |
| D-07    | Type-a-scene oracle (vitest + Screenplain + native) + early owner session                     | **Accept oracle; owner session requested non-blocking.** Oracle is cheap regression value; session needs owner time, do not stall on it.                                                                                               |
| D-08(A) | Reload on external change                                                                     | **Accept.** SPEC S10.7 already requires it — no spec fight.                                                                                                                                                                            |
| D-08(B) | Synced folder instead of M7                                                                   | **Reject.** Refuted in audit (check-to-rename race, candidate/sidecar sync, path-hash identity); M7 out of V1 scope regardless.                                                                                                        |
| D-09    | Page count without open preview (quiet-period job)                                            | **Accept.** Measured cost (130 ms + 4.6 ms/page) kills the objection; brief decides receipt-trust vs headless parse.                                                                                                                   |
| S-09    | Delete `relink_selected` vs keep as native-only API                                           | **Delete with AUDIT-SLP-A.** Unexposed, superseded by M4-01 locate, carries a lease-order bug if ever exposed; reimplement later only if in-session re-anchoring becomes a requirement.                                                |

### Confirm-first parking — verdicts recorded (AUDIT-PARK, 2026-10-04)

- [x] **AUDIT-PARK** — [Brief](docs/tasks/AUDIT-PARK.md). [Evidence](docs/test-evidence/AUDIT.md#audit-park--confirm-first-parking-verdicts): each parked observation has a test and a verdict. D-04 `FADE IN:` confirmed on both sides (→ AUDIT-D04-R1), section drop confirmed and gated in D-04. D-05 replace-all takes no protection and relies on one Undo step (confirmed; SPEC asks for no more). D-05 256-record cap confirmed (Rust test) and pruning is manual only (cadence test). T-03 null cadence and misleading release error confirmed and fixed in AUDIT-TEST; duplicate draft after a failed resume confirmed by a scratch core-crate probe. T-05 flake not reproduced (refuted for now). T-07 adoption failure after restore is safe: frontend covered by AUDIT-TEST, and the next native save is refused `SourceChanged` with nothing lost (scratch core-crate probe). S-09 refuted: `relink_selected` was removed in SLP-A and stays guarded.
- [ ] **AUDIT-PARK-T** — confirmed items left for an owner decision or brief (save/recovery/snapshot/native code, not fixed here): (1) replace-all pre-destructive protection and the snapshot cap without automatic retention belong to the D-05 cheap-variant brief; (2) a failed resume leaves a second draft entry on Home: native `resume_local_recovery` registers and checkpoints a fresh draft before the frontend adopts it, and release keeps it. Nothing is lost either way.

## M7 — explicit remote extension (gated)

Each `M*-G` group needs an `M*-00` decomposition and refined trace before coding.
M7 remains unchanged in scope and cannot begin before Local v1 adoption and the
owner's privacy/destination decision.

- [ ] **M7-G Explicit remote extension** — Deps: M6 local adoption gate and owner privacy/destination decision. Reqs: SYNC-01–05, INV-07/09/15. Read: SPEC S11; docs/sync-and-versioning.md.

## M8 — optional, separately scoped

FDX exchange if migration needs it; richer comparisons/statistics/shortcut profiles; index cards/source view; encrypted remote adapter; broader platforms; production revision tools. Each needs a new bounded task/requirement and tests. None blocks local v1 by default. [SPEC S16](SPEC.md#s16).
