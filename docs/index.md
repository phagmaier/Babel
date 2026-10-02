# Documentation map

`SPEC.md` owns requirements and invariants. These documents are focused working contracts and record the current implementation status.

| Topic                                  | Read                                                                                                                                                                                                                  |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current implementation and next action | [current-state](current-state.md), [TODO](../TODO.md)                                                                                                                                                                 |
| Build and platform checks              | [development](development.md), [testing](testing.md), [M0 evidence](test-evidence/M0.md), [M1 evidence](test-evidence/M1.md), [M2 evidence](test-evidence/M2.md) (split per-task), [M3 evidence](test-evidence/M3.md) |
| Boundaries and decisions               | [architecture](architecture.md), [ADRs](decisions/README.md)                                                                                                                                                          |
| Source and writing behavior            | [document model](document-model.md), [editor behavior](editor-behavior.md)                                                                                                                                            |
| Daily workflows and diagnostics        | [UX](ux.md), [Script Check](screenplay-validation.md)                                                                                                                                                                 |
| Content protection                     | [persistence](persistence-and-recovery.md), [history/remote](sync-and-versioning.md)                                                                                                                                  |
| Publication                            | [PDF](pdf-and-formatting.md)                                                                                                                                                                                          |
| Requirement coverage                   | [requirements](requirements.md)                                                                                                                                                                                       |
| Next agent task                        | [current-state](current-state.md) → [TODO](../TODO.md#m5--publication-pipeline) → [M5-03 frozen US Letter profile](tasks/M5-03.md)                                                                                    |

The [fixture guide](../fixtures/README.md) defines synthetic test data. Product authority remains with [SPEC S00-S03](../SPEC.md#s00). If a contract here disagrees with the spec, record and resolve it; do not silently weaken the spec.

## Milestone history

- **M1:** [Gate review](m1-gate-review.md) — bounded proof exit, safety contracts carried forward
- **M2-05B:** [Review](reviews/2026-09-28-m2-05b-review.md) required corrections; owner [accepted R1](test-evidence/M2-05B-R1.md) at `5e84879`
- **M2-05C/05D:** [Snapshots](test-evidence/M2-05C.md) and [protected close](test-evidence/M2-05D.md) passed — [ADR 0018](decisions/0018-portable-snapshot-retention.md), [ADR 0019](decisions/0019-protected-close-lifecycle.md)
- **M2-06:** [Curated history](test-evidence/M2-06.md) passed tmpfs/Btrfs — [ADR 0020](decisions/0020-native-curated-history.md)
- **M3-00:** [Decomposition](test-evidence/M3.md#m3-00--decomposition) — M3-01–13 assigned
- **M3-01–05:** [Corpus](test-evidence/M3.md#m3-01--independent-conformance-corpus-and-oracle), [codec](test-evidence/M3.md#m3-02--production-source-aware-codec-foundation), [complex regions](test-evidence/M3.md#m3-03--complex-fountain-regions-and-inline-semantics), [editor bridge](test-evidence/M3.md#m3-04--sole-editor-authority-and-source-bridge), [smart keys](test-evidence/M3.md#m3-05--smart-keys-joins-and-structural-undo) — all passed
- **M3-06–08:** [Picker/shortcuts](test-evidence/M3.md#m3-06--element-picker-and-configurable-shortcut-registry), [completion](test-evidence/M3.md#m3-07--local-character-and-heading-completion), [clipboard/IME](test-evidence/M3.md#m3-08--paste-formatting-and-native-input) — all passed; full S13 paint acceptance still open
- **M3-09–12:** [Native entry](test-evidence/M3.md#m3-09--native-sourcedestination-picker-and-recoverable-drafts), [cadence](test-evidence/M3.md#m3-10--recoverysource-cadence-and-visible-protection-state), [Save As](test-evidence/M3.md#m3-11--native-save-as-identity-and-publication), [lifecycle](test-evidence/M3.md#m3-12--production-writing-lifecycle-and-failure-ui) — all passed; [ADR 0026](decisions/0026-writing-lifecycle.md)
- **M3-13:** [Corrected exit](test-evidence/M3.md#m3-13--corrected-integrated-exit-re-review) + [re-review](reviews/2026-09-29-m3-13-rereview.md) — bounded Linux gate tagged `m3-core-editor-linux-verified`
- **M4-00:** [Decomposition](test-evidence/M4.md#m4-00--decomposition) — M4-01–15 assigned
- **M4-01:** [Recents](test-evidence/M4.md#m4-01--native-recents-and-missing-file-selection) — [ADR 0028](decisions/0028-native-recent-projects.md)
- **M4-02:** [Home/recovery](test-evidence/M4.md#m4-02--home-and-recovery-workflows)
- **M4-03:** [Outline](test-evidence/M4.md#m4-03--versioned-manuscript-index-and-outline-navigation) — [ADR 0029](decisions/0029-versioned-manuscript-index.md)
- **M4-04:** [Workflow protection](test-evidence/M4.md#m4-04--version-bound-workflow-protection) — [ADR 0030](decisions/0030-version-bound-workflow-protection.md)
- **M4-05:** [Scene/section moves](test-evidence/M4.md#m4-05--reversible-scene-and-section-moves) — [ADR 0031](decisions/0031-exact-source-outline-moves.md)
- **M4-06–14:** see [TODO](../TODO.md#m4--professional-daily-workflows) and [M4 evidence](test-evidence/M4.md), [M5 evidence](test-evidence/M5.md)
- **M4-15:** [Integrated exit](test-evidence/M4.md#continuation-from-a97a577--full-native-matrix-and-post-integration-review) + [review](reviews/2026-10-02-m4-15-post-integration-review.md) — bounded Linux gate tagged `m4-daily-workflows-linux-verified`; [ADR 0035](decisions/0035-linux-web-process-close.md)
- **M5-00:** [Decomposition](test-evidence/M5.md#m5-00--decomposition) — M5-01–07 assigned
- **M5-01:** [Bundled renderer helper](test-evidence/M5.md#m5-01--bundled-offline-renderer-helper) — [ADR 0036](decisions/0036-bundled-pdf-helper.md)

**Next:** [M5-03 frozen US Letter profile](tasks/M5-03.md)

**Remaining:** M5-03–07 (publication), M6 (hardening/adoption), M7 (remote). WebKit/performance/platform hardening = M6.
