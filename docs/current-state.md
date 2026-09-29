# Current state — M2-05C snapshots and copies passed

Date: 2026-09-28 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [ADR 0018](decisions/0018-portable-snapshot-retention.md), [M2-05C evidence](test-evidence/M2.md#m2-05c--rolling-snapshots-and-backup-copies).

## Completed task and trust boundary

**M2-05C completed its headless snapshot/retention/external-copy acceptance on main.** The owner accepted the preceding M1-06 bounded checkpoint and requested continuation to M2-05C. Base `172260c`; clean starting tree, no prior dirty paths. M0, bounded M1 proofs and M2-01–04/05A/B retain their recorded completion. Parent M2-05/full M2 exit and Local v1 remain open.

Native snapshots are exact source-readable `.fountain` blobs plus immutable checksummed records, independently of journals and Git. Changed rolling requests obey five-minute admission; retention keeps five-minute/hourly/daily representatives, newest/future-clock entries and all named/pre-destructive versions. Admission is bounded to 256 records/256 MiB of source bytes per identity; caps fail without deleting protected writing. Publication and pruning order keep retained records' blobs intact. Pending/orphan/damaged/unknown material stays visible and blocks snapshot maintenance.

Protected restore checkpoints current live bytes, snapshots both live and disk bytes, then uses the existing serialized writer for a new version. Recovery adoption also protects a disk snapshot first. Explicit external copies bind immutable bytes to an opaque native-selected document/session destination; exclusive publication and sync/verify precede receipts. Copy/snapshot receipts never grant source/recovery credit. Same-filesystem wording explains disk-loss limits; a different filesystem does not prove a different physical disk.

The default product remains a disabled writing shell with read-only startup recovery review and uninitialized source/destination selection. The injected snapshot panel and feature-only marked synthetic diagnostic exercise these contracts; they are not a production editor, native picker, cadence, Save As, recurring backup or protected-close implementation. **Do not use important manuscripts.**

## Paths and ownership

- Core: new `documents/{snapshots.rs,snapshot_store.rs,snapshot_store_tests.rs}`; Linux module/error/token lifecycle registration and pre-destructive choice protection.
- Desktop: `snapshot_host.rs`, `snapshot_ipc_tests.rs`, command registration; fixed synthetic destination selection gated by the existing proof feature and `tauri.snapshot-proof.conf.json`.
- Frontend: snapshot contracts/native adapter, `SnapshotPanel`/scoped CSS and contract/UI checks. `prototypes/snapshot-review/` owns the synthetic native page, real-keyboard smoke and independent byte/checksum audit.
- Coordinator: owning persistence/UX/architecture/testing/development docs, ADR 0018, TODO/trace/index and this handoff; exact results in the single M2 evidence section.
- Existing codec, editor composition model/fixtures, writer transaction pipeline, production capabilities/config and dependency lockfiles preserved. The only existing proof module extension selects the fixed marked synthetic copy folder. Owned native processes stopped; Btrfs synthetic root archived outside the repository and removed with marker checks.

## Checks and limits

[M2-05C evidence](test-evidence/M2.md#m2-05c--rolling-snapshots-and-backup-copies) owns exact commands, host, logs, screenshots, independent oracles, failures/corrections and final gates. Passing native coverage: 16 snapshot entries on tmpfs/Btrfs, seven actual SIGKILL boundaries each, snapshot/prune/copy I/O/ENOSPC fault stages, two generated MockRuntime dispatch entries on both filesystems, changed choice integration/finalize checks on Btrfs and real WebKit snapshot/copy/restore/reopen audits on both filesystems. Injected frontend tests remain labeled separately. Shared Rust workspace/Clippy, proof-feature checks and default release build passed; frontend aggregate and final hygiene results are linked in evidence.

ENOSPC is simulated; SIGKILL keeps kernel caches and is not power loss. The byte-cap boundary is tested without filling the owner's disk; full-size snapshot timing is unmeasured. Interrupted pending/orphan artifacts require inspection; automatic repair and protected-version deletion are not implemented. No other-platform, network/sync-folder filesystem, installed/offline packaging, physical-disk independence, complete accessibility or Local v1 adoption claim. Advisory leases cannot exclude arbitrary external writers. M2-06 still owns curated safety revisions/history integration.

## Next safe action

Review this M2-05C checkpoint, then select **M2-05D protected close and failure escalation**. It depends on accepted M2-05B and completed M2-05C. M2-06 follows full M2-05; production M3 remains gated by M2 exit/decomposition. This task stops at M2-05C. Work on main with task IDs in commit messages; never push without human review and explicit authorization.
