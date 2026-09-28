# M1 exit and M2 contract review

> Historical: M1-exit record. M2-01–04 and M2-05A are complete; current next task lives in [TODO](../TODO.md) and [current-state](current-state.md).

Date: 2026-09-27. Task: M1-05. Authority: SPEC S03/S10/S11/S16/S19;
[TODO](../TODO.md), [M1 evidence](test-evidence/M1.md).

M1 exit is satisfied for the bounded proofs on the recorded Linux host:
each has observed evidence, an accepted direction and explicit unsupported
cases. This does not complete any Local v1 requirement or authorize real
manuscripts, production export or remote upload. No product contract or
Enter-table change is made by this review.

| Proof               | Accepted direction/evidence                                                                                   | Limits carried forward                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| M1-01 source/model  | [ADR 0007](decisions/0007-source-aware-fountain-contract.md), selected no-op/edited fixture proof             | Full codec, unsupported/raw preservation and editor conformance: M3                                              |
| M1-02 native editor | [ADR 0008](decisions/0008-native-editor-input.md), native selection/composition/undo and one-host latency     | Full IME/production integration and Tier 1 matrix: M3/M6                                                         |
| M1-03 publication   | [ADR 0009](decisions/0009-pdf-renderer-baseline.md), Screenplain baseline, coverage and package experiment    | Frozen profile, SC005/SC008, marker/continuation defects, bundled helper, preview/export and viewer gates: M5/M6 |
| M1-04 replacement   | [ADR 0010](decisions/0010-linux-durable-replacement.md), Btrfs/tmpfs faults and SIGKILL                       | Secure native handles, recovery framing, queues/acks, power-loss/platform limits: M2/M6                          |
| M1-05 history       | [ADR 0011](decisions/0011-git2-history-store.md), vendored native snapshots/restore/conflicts/local transport | Native integration/durability/retention, installed package and authenticated transport: M2/M6/M7                 |

M2 remains a headless safety milestone; reviewed contracts and dependencies:

| Task               | Gate and contract                                                                                                                                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2-01 — ready next | M1-01/04 satisfied. Native opaque handles, project/session identity, exact bytes/fingerprint, safe path/ownership validation and conservative open. No frontend filesystem endpoint.                                                                      |
| M2-02              | After M2-01. Independent framed/checksummed versioned recovery; protect new and prior checkpoints before compaction, bound growth and measure the stress fixture. Unknown schemas/torn tails do not destroy earlier valid data.                           |
| M2-03              | After M2-01/02. Serialized immutable writes, divergence checks, independent previous generation, exclusive candidate, byte/hash verification, platform replacement/directory sync. Replaced-but-unconfirmed is a failure state with both copies retained. |
| M2-04              | After M2-02/03. Separate live/journaled/file-saved versions and exact session/hash acknowledgements. Old receipts cannot clear newer edits; queued or journal-only writes cannot claim a saved file.                                                      |
| M2-05              | After M2-03/04. Safe restart/recovery/close/snapshot/external/second-instance behavior. Preserve both choices; interrupted replacement/restore needs an operation record and no timestamp winner.                                                         |
| M2-06              | After M2-03/05 and M1-05. Promote only small native history primitives; protect pre-operation history/snapshots, isolate Git failure from source/recovery, test interrupted object/ref publication and full safety drill.                                 |

Restore/adoption integration must prepare protected old/new identities,
recovery and independent snapshots before the tested source replacement;
history-ref/editor-state publication follows confirmed replacement and must
be recoverable if interrupted. The history proof never writes active source.
History failure after a successful file save reports history attention;
emergency raw protection remains possible without Git or Script Check.

M2 exit still requires real native synthetic open/save/reopen, acknowledged
recovery/restart, failure/race matrix and safe IPC. M3 cannot start before
that exit and its decomposition task. M5 production PDF/export remains
behind M3/M4 plus the publication gates above. Tier 1 release targets remain
an owner decision before M6; M7 real transfer also needs destination/privacy
approval. The only next implementation selected here is M2-01.
