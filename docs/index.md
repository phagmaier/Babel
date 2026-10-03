# Documentation map (stub)

`SPEC.md` owns requirements and invariants. For agent navigation, read [`map.md`](../map.md) instead of this file — it is the canonical repo guide (layout, modules, tests, commands, traps).

| Topic                               | Read                                                                                |
| ----------------------------------- | ----------------------------------------------------------------------------------- |
| Current implementation, next action | [current-state](current-state.md), [TODO](../TODO.md)                               |
| Build, checks, evidence conventions | [development](development.md), [testing](testing.md)                                |
| Boundaries and decisions            | [architecture](architecture.md), [ADRs](decisions/README.md)                        |
| Requirement coverage                | [requirements](requirements.md)                                                     |
| Task scope, acceptance, checks      | `docs/tasks/M*-NN.md` (next: [M6-02-R1](tasks/M6-02-R1.md))                         |
| What passed / exact commands        | [test-evidence](test-evidence/M6.md), [M6-02 matrix](test-evidence/M6-02-matrix.md) |

The [fixture guide](../fixtures/README.md) defines synthetic test data. Product authority remains with [SPEC S00-S03](../SPEC.md#s00). If a contract here disagrees with the spec, record and resolve it; do not silently weaken the spec.

Completed-milestone history lives in [TODO](../TODO.md) (frozen summary + evidence links) and `docs/test-evidence/M*.md`. This stub intentionally keeps no per-task history so it cannot go stale again.
