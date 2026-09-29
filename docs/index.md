# Documentation map

`SPEC.md` owns requirements and invariants. These documents are focused working contracts and record the current implementation status.

| Topic                                  | Read                                                                                                                                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current implementation and next action | [current-state](current-state.md), [TODO](../TODO.md)                                                                                                                                                |
| Build and platform checks              | [development](development.md), [testing](testing.md), [M0 evidence](test-evidence/M0.md), [M1 evidence](test-evidence/M1.md), [M2 evidence](test-evidence/M2.md), [M3 evidence](test-evidence/M3.md) |
| Boundaries and decisions               | [architecture](architecture.md), [ADRs](decisions/README.md)                                                                                                                                         |
| Source and writing behavior            | [document model](document-model.md), [editor behavior](editor-behavior.md)                                                                                                                           |
| Daily workflows and diagnostics        | [UX](ux.md), [Script Check](screenplay-validation.md)                                                                                                                                                |
| Content protection                     | [persistence](persistence-and-recovery.md), [history/remote](sync-and-versioning.md)                                                                                                                 |
| Publication                            | [PDF](pdf-and-formatting.md)                                                                                                                                                                         |
| Requirement coverage                   | [requirements](requirements.md)                                                                                                                                                                      |
| Next agent task                        | [TODO](../TODO.md) (M3-02 codec passed; M3-03 complex regions next), [current-state](current-state.md)                                                                                               |

The [fixture guide](../fixtures/README.md) defines synthetic test data. Product authority remains with [SPEC S00-S03](../SPEC.md#s00). If a contract here disagrees with the spec, record and resolve it; do not silently weaken the spec.

[M1 exit and M2 contract review](m1-gate-review.md) records the bounded-proof
exit and the safety contracts carried into the next milestone.

[Independent M2-05B review](reviews/2026-09-28-m2-05b-review.md) required corrections; the owner [accepted M2-05B-R1](test-evidence/M2.md#r1-owner-acceptance-and-m1-06-claim) at `5e84879` on 2026-09-28. [M1-06 composition proof](editor-composition-proof.md) passed its declared subset on the reference host; its reviewed bounded conclusion precedes M2-05C. [Process review](reviews/2026-09-28-process-review.md) records documentation conventions and retained safety rules.

[M2-05C snapshots and copies](test-evidence/M2.md#m2-05c--rolling-snapshots-and-backup-copies) and [M2-05D protected close](test-evidence/M2.md#m2-05d--protected-close-and-failure-escalation) passed bounded native Linux/WebKit acceptance. [ADR 0018](decisions/0018-portable-snapshot-retention.md) records portable snapshots; [ADR 0019](decisions/0019-protected-close-lifecycle.md) records window and risk-close policy.

[M2-06 curated history and the bounded headless Linux M2 exit](test-evidence/M2.md#m2-06--small-history-primitives-and-safety-gate) passed the native tmpfs/Btrfs fault drill. [ADR 0020](decisions/0020-native-curated-history.md) records the local store and safety-ref contract. [M3-00 decomposition](test-evidence/M3.md#m3-00--decomposition) assigns core editor, native picker, cadence, Save As and lifecycle gates to M3-01–13; [M3-01 corpus/proof comparison](test-evidence/M3.md#m3-01--independent-conformance-corpus-and-oracle) passed; [M3-02 production codec foundation](test-evidence/M3.md#m3-02--production-source-aware-codec-foundation) passed; M3-03 complex regions/inline semantics are next. Production workflows and Local v1 adoption remain open.
