# ADR 0005 — Layered local protection

Status: Accepted safety direction; native algorithms pending M1/M2 evidence. Date: 2026-09-27.

Context: [SPEC S10/S11](../../SPEC.md#s10), SAVE-01–05, HIST-01/02, INV-04–08/20. Decision: serialized versioned source saves, independent recovery checkpoints, rolling snapshots, and Git-backed revisions serve distinct purposes. Old valid source generations and acknowledged recovery data survive failed replacement. Alternatives: in-place overwrite or treating Git/undo as recovery are rejected. Consequences: M1 proves platform replacement and Git-store primitives; M2 fault-tests durable protocols. Same-disk copies do not protect against disk loss, and no universal zero-loss claim is made.

M1-04 Linux replacement evidence is recorded in [ADR 0010](0010-linux-durable-replacement.md); production safety remains unimplemented.

Evidence still needed: M1-05 history-store proof; M2 fault matrix and platform-specific durability evidence.
