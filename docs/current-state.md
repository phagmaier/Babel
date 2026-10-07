# Current state — 2026-10-07

Application: **babel**, local-first Linux screenwriting (Tauri/React/Rust).
Agents decide under [ADR 0043](decisions/0043-agent-decision-authority.md).
Branch: `main`. Local v1 admission remains open.

## This session

**M6-03 native retention remainder complete** ([brief](tasks/M6-03.md),
[new evidence](test-evidence/M6-03-2026-10-07.md)). No production code,
dependency, capability or package changed.

- Runnable `tools/run-snapshot-retention.py`: owned record unlink/directory
  sync/blob unlink SIGKILL barriers and fresh-process exact-byte reopen on
  tmpfs/Btrfs. Named, pre-destructive, newest/future and shared blobs retained;
  source, acknowledged recovery and distinct previous source untouched.
- Record-side interruption leaves an orphan, reports attention and refuses
  maintenance without repair. Blob-side interruption leaves no dangling
  retained record and permits the remaining safe shared-blob prune.
- Private **48 MiB tmpfs** tests the actual **64 MiB** free-space guard,
  without filling host `/tmp`. Typed prune refusal deletes nothing;
  ordinary edited source/recovery Save still succeeds with exact receipts.
- `snapshot-retention` production panel mode passes from final FUSE package
  with UID 1000 and every capability zero, named publication, protected/shared
  retention, visible same-disk warning/orphan attention/refusal, independent
  Save and ordinary close. Actual SIGKILL is core-only; UI orphan is labelled
  simulation. All failed and passing roots/manifests retained.
- Shipping AppImage remains SHA-256
  `38710fb1cba4622bc0b744ed8891a2d23f3e6045322279cac3feaa30759a805e`.

## Checks

| Command                                | Result                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| Focused `snapshot_store` matrix        | 26/26 each on tmpfs/Btrfs, including 3 child helpers                           |
| Focused snapshots/cadence/panel Vitest | 30/30                                                                          |
| Named native retention drill           | 6/6 SIGKILL/reopen cases; actual low-space core arm pass                       |
| Final packaged production panel        | 2/2 strict; zero crash events/survivors; warning/refusal screenshots inspected |
| Core Clippy, workspace Rust format     | Pass                                                                           |
| Changed Python compile and runner CLI  | Pass                                                                           |

Raw evidence: `target/m6-03-2026-10-07/`, final `retention-release/`.
Exact commands/times/skips and final documentation checks are recorded in the
new evidence and task commit. Initial rolling-interval, immutable-invoke and
WebDriver-property-order fixture/observer failures remain failed and retained.
Full app/workspace/renderer/differential/CI/IME matrix not repeated: shipping
app unchanged; this session adds test/drill tooling only.

## Known limitations

- Low-space **guard refusal**, not ENOSPC/quota, host-disk exhaustion,
  physical-disk backup, unmount or hardware power loss. SIGKILL leaves OS alive.
- Low-space UI retains the generic protection refusal; orphan repair remains
  explicit/unimplemented. Wider snapshot keyboard/focus/IME/full acceptance
  is still an M6-16 reconciliation item, so M6-03 stays unchecked in TODO.
- One host/distribution, same-laptop backups, no second-host/real-migration
  evidence; wider IME/a11y/S13 and enforcing SELinux remain unverified.
- [Native findings](native-findings.md) retain historical failures and ADR 0043
  disposition. No new crash event. Save As/IME readiness lag, shared-store
  lease scope and capture refusals naming no row remain known limitations.
- M6-14 notices complete; prior L1/L2/L3 provenance limitations and transitive
  Rust/npm notice work remain in M6-10. No package-notice regeneration needed.

## Next action

1. **M6-16 admission review**: refresh final-package requirement evidence,
   reconcile M6-03 wider input/acceptance and resolve release gaps.
   [Brief](tasks/M6-16.md). Native retention and M6-14 notices are no longer gaps.
2. **Capture**: recovery copy for refusals naming no row.
3. **D-05 remainder**: protected workflows take a PreDestructive snapshot and
   treat Git history failure as a warning ([ADR 0030](decisions/0030-version-bound-workflow-protection.md)).
4. Later, not V1 blockers: current-script picker folder; M6-04, M6-10–13
   beyond release notices, M6-15, DEV-02, M6-05–09, AUDIT-PARK-T (2), M7, M8.

Native drills: check `df -i /tmp`, use fresh outputs and absolute disposable
roots. Follow [development](development.md) and the
[native retention guide](../tests/native/writing-lifecycle/README.md#m6-03-snapshot-retention).
Mount FUSE externally; AppRun stays non-root/zero-caps. Do not delete retained
`target/` cores/manifests. Packaging/spelling/picker changes need packaged modes.
