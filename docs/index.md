# Documentation map

`SPEC.md` owns requirements and invariants. These documents are focused working contracts and record the current implementation status.

| Topic                                  | Read                                                                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Current implementation and next action | [current-state](current-state.md), [TODO](../TODO.md)                                                                        |
| Build and platform checks              | [development](development.md), [testing](testing.md), [M0 evidence](test-evidence/M0.md), [M1 evidence](test-evidence/M1.md) |
| Boundaries and decisions               | [architecture](architecture.md), [ADRs](decisions/README.md)                                                                 |
| Source and writing behavior            | [document model](document-model.md), [editor behavior](editor-behavior.md)                                                   |
| Daily workflows and diagnostics        | [UX](ux.md), [Script Check](screenplay-validation.md)                                                                        |
| Content protection                     | [persistence](persistence-and-recovery.md), [history/remote](sync-and-versioning.md)                                         |
| Publication                            | [PDF](pdf-and-formatting.md)                                                                                                 |
| Requirement coverage                   | [requirements](requirements.md)                                                                                              |

The [fixture guide](../fixtures/README.md) defines synthetic test data. Product authority remains with [SPEC S00-S03](../SPEC.md#s00). If a contract here disagrees with the spec, record and resolve it; do not silently weaken the spec.
