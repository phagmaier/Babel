# ADR 0020 — Native curated history publication

Status: Accepted direction. Date: 2026-09-28. Task: M2-06.
Authority: [SPEC S10.2/S10.8/S11.1–11.2/S15.2](../../SPEC.md#s11), HIST-01, SAVE-04, INV-08; [history contract](../sync-and-versioning.md), [ADR 0011](0011-git2-history-store.md).
Evidence: [M2-06 report](../test-evidence/M2.md#m2-06--small-history-primitives-and-safety-gate).

## Decision

Promote the M1-pinned `git2 0.21.0` vendored-libgit2 adapter into the Linux headless core. Repositories are bare and private under the native app-data `history/<document UUID>.git/`, separate from source, recovery and snapshots. The native service owns the document lease and serializes calls. It creates a project-bound marker before publishing revisions, refuses a foreign/incomplete/corrupt repository, uses a blank in-memory Git configuration and a fixed app-local author identity. No system Git, user Git config, checkout, hook, frontend path, credential or transport is used. Git objects/refs are never a source or recovery receipt.

Each commit tree has exactly `screenplay.fountain` and `manifest.json`. The manifest binds schema, project UUID, exact source SHA-256, profile string and profile SHA-256. Source is copied byte for byte; no Fountain parse or normalization occurs. An explicit native revision requires either the exact currently owned disk bytes or the latest exact current-session recovery checkpoint. Changed source/profile content creates an immutable commit with the previous main as first parent; unchanged content is deduplicated. The label and app-local timestamp are commit metadata only, never conflict ordering. A checked local main ref update and readback precede a receipt. A pre-replacement safety operation additionally publishes `refs/safety/<commit id>`; retry after interruption fills a missing safety ref without replacing the commit or discarding ancestry. A missing ref on the current safety commit reports history attention after restart.

Recovery adoption protects the current disk source with a history safety ref after its independent disk snapshot and before replacement. Snapshot restore protects the exact current live checkpoint similarly. If that history step fails, the destructive operation stops while the disk and recovery/snapshot protections remain. Ordinary source saves and recovery checkpoints never depend on Git success. Native `HistoryHealth` reports an observed failure, including corrupt history after restart; it has no source-save credit. The production UI has no history scheduler or status wiring yet.

## Alternatives, limits and evidence still needed

Using the selected Fountain file as a Git checkout would permit uncontrolled reset/overwrite. Committing the entire project tree would capture recovery internals and private paths. A shell Git helper would add an unneeded executable and configuration surface. The private native store keeps history independent, at the cost of a future project export/move policy.

M2 tests cover curated bytes, profile changes, dedup, parent/ref identity, interrupted object and main/safety publication, corrupt history, destructive-adoption refusal, ordinary save and recovery isolation, and no-Git-PATH execution on tmpfs/Btrfs. Ref/object publication does not claim hardware power-loss durability or multi-ref atomicity; independent source/recovery/snapshot generations remain the safety boundary. No Git pruning or automatic repair is implemented. The M1 local bare-remote proof remains a proof, not an M7 transport adapter. M6 still needs production cadence, named timeline/diff/restore UI, installed/offline packaging, notices and a full adoption drill. M7 needs transport/privacy/authentication gates. Other OS adapters remain unimplemented.
