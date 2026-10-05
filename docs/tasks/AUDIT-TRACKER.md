# Audit status tracker

`AUDIT.md` (2026-10-03, base `1ef9515`, 48 findings + skeptic verdicts) is the frozen audit record — read-only. Each cluster below gets one brief in `docs/tasks/AUDIT-*.md`; evidence lands in `docs/test-evidence/AUDIT.md`. Briefs link to audit sections instead of copying them, and cite the [dropped/refuted list](../../AUDIT.md#dropped-or-refuted) for what must NOT be built. DESIGN implementations need owner triage first (table below); nothing there is agent-executable until decided. Historical DESIGN triage was recorded 2026-10-03; current-state alone selects any continuation.

Task selection comes only from [current-state Next action](../current-state.md#next-action), subject to user assignment and dependencies. Unchecked findings may need owner decisions or a brief; they are not automatic authorization. Historical wave prerequisites remain binding when that track is selected.

### Wave 0 — unblockers

- [x] **Tier 1 debloat** (S-14 stale refs, `docs/index.md` stub, TODO collapse, tracked link/matrix tools, `target/` prune) — Evidence: Tier 1 commit `433c150`.
- [x] **T-08** — [AUDIT-TEST evidence](../test-evidence/AUDIT.md#audit-test--wave-2-regression-gaps).
- [x] **AUDIT-W0** — [Brief](AUDIT-W0.md), [Evidence](../test-evidence/AUDIT.md#audit-w0--ci-gate-desktop-crate-types-dead-symbols).
- [x] **AUDIT-W0-R1** — [Brief](AUDIT-W0-R1.md), [Evidence](../test-evidence/AUDIT.md#audit-w0-r1--enchant-ci-abi-prerequisite), [actual CI green](https://github.com/phagmaier/Babel/actions/runs/37157598075).

### Wave 1 — safety (approved 2026-10-03; working agent drafts one brief at a time, in table order, same shape as AUDIT-W0)

| Cluster    | Findings                                                                                                                      | Effort | Depends on            |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------- |
| AUDIT-C01  | C-01 + C-02 (capture failure stops journaling) + T-01 (tests stay red until C-01 fixed — same brief)                          | M–L    | —                     |
| AUDIT-C04  | C-04 (caret move rewrites file; native no-replace receipt, ~20 lines Rust + Tier 3)                                           | M      | —                     |
| AUDIT-D01  | D-01 smallest fix (Enter inserts separator row, 1–3 days) + S-08 keep-set wiring (`setDualDialogue`, `replaceLineWithBreaks`) | M      | D-01 accepted (below) |
| AUDIT-D08A | D-08(A) Reload on external change (SPEC S10.7 already requires it)                                                            | M      | accepted (below)      |
| AUDIT-C356 | C-03 (escape encoder + renderer), C-05 (SELinux xattr names), C-06 (find/check decoration sets)                               | S–M    | —                     |

- [x] **AUDIT-C01** — [Brief](AUDIT-C01.md), [Evidence](../test-evidence/AUDIT.md#audit-c01--capture-stays-possible-on-standard-fountain-edits-and-edge-space-emphasis).
- [x] **AUDIT-C04** — [Brief](AUDIT-C04.md), [Evidence](../test-evidence/AUDIT.md#audit-c04--a-caret-move-no-longer-rewrites-the-manuscript).
- [x] **AUDIT-D01** — [Brief](AUDIT-D01.md), [Evidence](../test-evidence/AUDIT.md#audit-d01--portable-enter-separators-and-explicit-speechbreak-authoring).
- [x] **AUDIT-D08A** — [Brief](AUDIT-D08A.md), [Evidence](../test-evidence/AUDIT.md#audit-d08a--protected-external-reload).
- [x] **AUDIT-C356** — [Brief](AUDIT-C356.md), [Evidence](../test-evidence/AUDIT.md#audit-c356--literal-escapes-selinux-metadata-and-advisory-highlights).

### Wave 2 — test gaps (approved as AUDIT-TEST)

- [x] **AUDIT-TEST** — [Brief](AUDIT-TEST.md), [Evidence](../test-evidence/AUDIT.md#audit-test--wave-2-regression-gaps).

T-03 (resume path, ~20-line composition), T-04 (8 `WritingSession` guard tests), T-05 (persistence-controller receipt validation), T-09 (structured-paste prefix/suffix), T-06 (replace/check sessions), T-07 (restore/resolve via WritingView), T-10 (SC002/SC004 mappings). Historical test-gap batch is complete; its evidence owns the outcomes.

### Wave 3 — deletions (approved 2026-10-03)

- [x] **AUDIT-SLP-A** — [Brief](AUDIT-SLP-A.md), [Evidence](../test-evidence/AUDIT.md#audit-slp-a--unused-import-read-relink-and-status-paths).

- [x] **AUDIT-SLP-B** — [Brief](AUDIT-SLP-B.md), [Evidence](../test-evidence/AUDIT.md#audit-slp-b--retired-prototype-proofs-with-production-coverage).

- [x] **AUDIT-SLP-C** — [Brief](AUDIT-SLP-C.md), [Evidence](../test-evidence/AUDIT.md#audit-slp-c--unused-complex-codec-edit-apis).

- [x] **AUDIT-SIMP-N** — [Brief](AUDIT-SIMP-N.md), [Evidence](../test-evidence/AUDIT.md#audit-simp-n--shared-native-workers-and-storagetest-primitives).

- [x] **AUDIT-SIMP-F** — [Brief](AUDIT-SIMP-F.md), [Evidence](../test-evidence/AUDIT.md#audit-simp-f--frontend-guard-and-native-dispatch-simplification).

| Cluster      | Findings                                                                                                                                                           | Order constraint                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| AUDIT-SLP-A  | S-06 (legacy import path), S-07 (`readInitial`), S-09 (`relink_selected`: DELETE decided), S-10 (SaveStatus mount)                                                 | S-09 deletes with this cluster                       |
| AUDIT-SLP-B  | S-02 → S-01 (codec-independent ports first), S-03 + S-04 (with S-02), S-11 (`durable-replacement` only after porting candidate-tamper test; `history-store` stays) | strict order                                         |
| AUDIT-SLP-C  | S-08 deletes (`replaceInline`, `replaceHiddenContent`, conversion pair)                                                                                            | keep-set rides with AUDIT-D01                        |
| AUDIT-SIMP-N | X-01 (worker helper), X-05 (one handler list), X-02 (test fixtures), X-03 (store primitives)                                                                       | Tier 3 matrix; X- portions refuted in audit stay out |
| AUDIT-SIMP-F | X-04 (WritingView cleanup hoist + lock helper), X-06 (stamp helpers), X-08 (error-code const), X-07 (drill MODES table)                                            | Tier 1/2; no DEV-03 fold-back without owner call     |

- [x] **AUDIT-NATIVE-R1** — [Brief](AUDIT-NATIVE-R1.md), [Evidence](../test-evidence/AUDIT.md#audit-native-r1--f6-focus-and-private-mozc).

- [x] **AUDIT-D02** — [Brief](AUDIT-D02.md), [Evidence](../test-evidence/AUDIT.md#audit-d02--safe-reopen-reconciliation-and-recovery-choice).

- [x] **AUDIT-D03A** — [Brief](AUDIT-D03.md), [Evidence](../test-evidence/AUDIT.md#audit-d03a--on-screen-screenplay-element-styling).

- [x] **AUDIT-D03B** — [Brief](AUDIT-D03.md#slice-b-audit-d03b--layout-shell-m), [Evidence](../test-evidence/AUDIT.md#audit-d03b--writing-layout-shell).

- [x] **AUDIT-D04** — [Brief](AUDIT-D04.md), [Evidence](../test-evidence/AUDIT.md#audit-d04--non-blocking-omissions-and-inline-note-assessment).

- [x] **AUDIT-D04-R1** — [Brief](AUDIT-D04-R1.md), [Evidence](../test-evidence/AUDIT.md#audit-d04-r1--all-empty-leading-key-block).

- [x] **AUDIT-D07** — [Brief](AUDIT-D07.md), [Evidence](../test-evidence/AUDIT.md#audit-d07--typed-scene-oracle).
- [ ] **AUDIT-D07-F** — four findings from the oracle, pinned as found, owner decisions before any fix: F1 empty Dialogue/Parenthetical Enter → Action has no separator (S07.2 vs S07.3 and a pinned key test; gated by SC005); F2 no keyboard exit from a note at document end; F3 Page Break choice leaves the caret before `===` (pinned by a shortcut test; gated); F4 empty-cue suggestions capture the second Tab of the element cycle (S07.4 vs S07.6). Reproductions in the D-07 evidence.
- [x] **AUDIT-D07-N** — [Brief](AUDIT-D07-N.md), [Evidence](../test-evidence/AUDIT.md#audit-d07-n--native-typed-export-drill).

- [x] **AUDIT-D04-R2** — [Brief](AUDIT-D04-R2.md), [Evidence](../test-evidence/AUDIT.md#audit-d04-r2--renderercodec-disagreement-sweep).

- [x] **AUDIT-DEV-REVIEW** — [Evidence](../test-evidence/AUDIT.md#audit-dev-review--dev-branch-review-before-merge).
- [x] **AUDIT-D04-R3** — [Brief](AUDIT-D04-R3.md), [Evidence](../test-evidence/AUDIT.md#audit-d04-r3--remaining-renderercodec-reading-differences).

### DESIGN triage — decided 2026-10-03, executable (accept / reject / defer + rationale)

- [x] **AUDIT-D06** — [Brief](AUDIT-D06.md), [Evidence](../test-evidence/AUDIT.md#audit-d06--plain-status-and-failure-only-close-prompts).

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

- [x] **AUDIT-PARK** — [Brief](AUDIT-PARK.md), [Evidence](../test-evidence/AUDIT.md#audit-park--confirm-first-parking-verdicts).
- [ ] **AUDIT-PARK-T** — confirmed items left for an owner decision or brief (save/recovery/snapshot/native code, not fixed here): (1) replace-all pre-destructive protection and the snapshot cap without automatic retention belong to the D-05 cheap-variant brief; (2) a failed resume leaves a second draft entry on Home: native `resume_local_recovery` registers and checkpoints a fresh draft before the frontend adopts it, and release keeps it. Nothing is lost either way.
- [x] **AUDIT-PARK-H** — [Brief](AUDIT-PARK-H.md), [Evidence](../test-evidence/AUDIT.md#audit-park-h--empty-scene-heading-capture).
- [x] **AUDIT-PARK-H-F** — [investigation](../reviews/2026-10-04-empty-heading-intent.md), [PARK-H evidence](../test-evidence/AUDIT.md#audit-park-h--empty-scene-heading-capture).
- [x] **AUDIT-PARK-H-F1** — [brief](AUDIT-PARK-H-F1.md), [evidence](../test-evidence/AUDIT.md#audit-park-h-f1--new-hidden-row-capture).
- [x] **AUDIT-PARK-H-F2** — [brief](AUDIT-PARK-H-F2.md), [evidence](../test-evidence/AUDIT.md#audit-park-h-f2--empty-scene-heading-recovery-intent).
- [x] **AUDIT-PARK-H-F3** — [brief](AUDIT-PARK-H-F3.md), [evidence](../test-evidence/AUDIT.md#audit-park-h-f3--actionable-capture-refusal-wording).
- [ ] **AUDIT-PARK-H-F4** — group, [brief and decomposition](AUDIT-PARK-H-F4.md). A wider probe refused 229 of 848 single-row cases: ordinary typing such as a Dialogue row `(laughs) Oh no.` or bold on a Scene Heading leaves the whole draft unsaved and unjournaled until that row changes. F3 names the row. Open until every sub-task below is done or the owner retires it.
  - [x] **AUDIT-PARK-H-F4-01** — [evidence](../test-evidence/AUDIT.md#audit-park-h-f4-01--commands-refuse-instead-of-creating-a-refused-draft).
  - [x] **AUDIT-PARK-H-F4-02** — [evidence](../test-evidence/AUDIT.md#audit-park-h-f4-02--emptied-speech-rows-keep-their-speech).
  - [x] **AUDIT-PARK-H-F4-03** — [evidence](../test-evidence/AUDIT.md#audit-park-h-f4-03--speech-that-opens-with-a-parenthesis).
  - [x] **AUDIT-PARK-H-F4-04** — [evidence](../test-evidence/AUDIT.md#audit-park-h-f4-04--typed-text-fountain-reads-as-other-syntax).
  - [x] **AUDIT-PARK-H-F4-05** — [evidence](../test-evidence/AUDIT.md#audit-park-h-f4-05--emptied-unterminated-last-rows).

- [x] **AUDIT-READING-CANDIDATES** — eleven occurrences are seven sources: two supported lyric mappings, five confirmed silent omissions. [Brief](AUDIT-READING-CANDIDATES.md), [evidence](../test-evidence/AUDIT-READING-CANDIDATES.md#classification--2026-10-05).
- [x] **AUDIT-D04-R4** — [Brief](AUDIT-D04-R4.md), [Evidence](../test-evidence/AUDIT.md#audit-d04-r4--boneyard-inside-the-renderers-opening-title-block).
- [ ] **AUDIT-EXPORT-WARNINGS** — proposed, not started: export review ignores the helper's `unsupported-publication:*` warnings, so an omission the assessment does not predict still exports. Design and checks to complete first. [Brief](AUDIT-EXPORT-WARNINGS.md).
