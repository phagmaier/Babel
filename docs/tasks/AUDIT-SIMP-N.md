# AUDIT-SIMP-N — Share bounded native workers and storage/test primitives

Status: **complete**. Base `653f037`, clean main, 2026-10-03.
Dependencies: AUDIT-SLP-A/B/C complete; Wave 3 approved in TODO.
Requirements: QA-01, INV-03/05/07; existing native/storage contracts unchanged.

## Scope and acceptance

- X-01: move the snapshot worker to a cost-parameterized DocumentHost worker,
  retain its non-Linux stub and reserve/lock/permit/None/join behavior. Route the
  nine simple DocumentError workers and recent operations through it. Keep exact
  costs and payload validation before reserve. Pickers, release/cancel locking,
  checkpoint, SaveFailure and PublicationError workers stay unchanged.
- X-05: one generate_handler list, retaining all 45 default and two Linux-only
  composition-feature commands with their original per-command cfg predicates.
- X-02: share private disposable TestRoot creation/write/cleanup across desktop,
  core unit and integration test support, and desktop invoke_raw/JSON invoke.
  Preserve every selector, per-suite source literal/mode/setup, assertions,
  service/open wrappers, publication cancellation/wait and cleanup error policy.
  Keep different request-envelope/response shapes explicit at callers. Bind the
  previously hard-coded desktop temp root to its IPC selector and include the
  retained composition-feature selector in the canonical matrix runner.
- X-03: share create_private (Errno, WRONLY or RDWR), private_dir with original
  error codes, writable_private_destination and storage_relation in linux.rs.
  Preserve parent-check differences at callers, Errno::EXIST recovery mapping,
  gates before create, lease-open exclusion and all write/gate/fsync/read-back
  sequences. Keep the unrelated startup-reader private_directory separate.

## Tests first and checks

Record a red structural removal/retention check before production edits; preserve
baseline assertions and worker/protection failures. Add focused worker boundary
coverage for cost/reservation release, absent/poisoned service and join panic.
Tier 3: focused desktop/core tests, full pnpm check, fmt/Clippy, workspace matrix
tmpfs/Btrfs, retained feature tests/build, default embedded release build, browser
smoke. Native default workflow-protection and audit-fixes modes on both
filesystems with owned-process/crash attribution and exact artifact audit; no
new trusted IME/package/platform/admission claim. Run native modes sequentially
with builds/shared tests idle. Check frozen fixture bytes, command cfg parity,
local links, Python lint and git diff --check. Record commands/results/failures
in [audit evidence](../test-evidence/AUDIT.md), one labeled line per check.

## Do NOT do / stopping point

Keep AUDIT.md frozen, independent fixtures/assertions and prior failure roots/cores
intact. No shared save_worker/write_verified, new dependencies, persistence
protocol/error/receipt changes, release/picker/checkpoint/publication redesign,
SIMP-F, D-06, owner decisions or gate closure. No non-Linux support claim without
actual target evidence. Commit on main and stop after AUDIT-SIMP-N, before
AUDIT-SIMP-F's separate brief. No push. SELinux, C1/F2, M6-02 and Local v1 stay open.

## Result

Accepted X-01/05/02/03 delivered with costs, error mapping, command cfg parity,
local cleanup/parent policies and write/gate/fsync/read-back order preserved.
[Evidence](../test-evidence/AUDIT.md#audit-simp-n--shared-native-workers-and-storagetest-primitives):
frontend 863/863; Rust workspace 264/264 and retained feature 65/65 on each
filesystem; actual WebKit 4/4 strict and independent retained-artifact audit pass.
All 289 frozen files and 1,468 original assertions retained; compile/cleanup
failures and corrected runs recorded. Non-Linux source parity only. Stopped
before AUDIT-SIMP-F; no push or admission/gate closure.
