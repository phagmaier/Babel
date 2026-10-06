# M6-01 shutdown safety review

Date: 2026-10-02 PDT. Base `4c4df9a`, main. One editing agent made a separate
source/contract pass after the bounded delta; no second-reviewer or human
sign-off claim. [Task](../tasks/M6-01.md), [exact commands/artifacts/failures](../../test-evidence/M6.md#m6-01--linux-scope-and-shutdown-hardening),
[ADR 0035](../../decisions/0035-linux-web-process-close.md),
[Linux direction/portability](../../decisions/0040-local-v1-platform-scope.md).

Decision: **bounded M6-01 investigation/review complete; release gate C open**.
Candidate paired matrix is 7/8 functional and 6/8 strict, with one new owned
forced-cleanup crash and its delayed report retained. All four ordinary cases,
two parent-kill/recovery cases and two narrower non-WebDriver controls pass.
This decision accepts the bounded investigation, not the failing strict gate or
Local v1. M6-02 owns narrowed follow-up investigation before broader faults.

## Close boundary and author-content safety

The extracted `handle_close_request` keeps the previous branch ordering.
Native open ownership prevents close before frontend notification; failed
notification retains protection. A poisoned mutex is treated as open. Native
release remains the transition from protected to unprotected. A worker already
holding the service mutex is observed before the guard; a not-yet-admitted open
has no accepted editor content. This adds no new admission fence.

The unprotected branch cancels the same cloned publication authority and calls
the existing Linux web-process termination on the main thread. Callback errors
are logged, as before, without manufacturing source/recovery/close success.
No save code, format, command, capability, dependency version, frontend authority
or acknowledgement binding changes. The test effects are injected; real native
registration/files/lease coverage does not itself prove GTK termination.

The existing accepted-close mitigation remains the only production mitigation.
The pinned Tauri runtime's main-thread message handling was checked; no queued
callback timing change was demonstrated. Forced parent kill and active WebDriver
DELETE do not reach this branch, so extracting it cannot resolve C1/F2.

## Findings and disposition

- **C1 parent SIGKILL:** retained separate release obligation. The current base
  recovery workload intentionally kills only the owned parent after independent
  latest-journal byte checks, then restarts and adopts recovery. Both current
  tmpfs/Btrfs cases pass with zero bounded crash events, but this non-reproduction
  does not resolve C1; exact stages/final generations are recorded in evidence.
- **F2 active WebDriver DELETE:** fresh candidate tmpfs case records an owned
  WebKit SIGSEGV/core after forced cleanup of a pre-shutdown readiness failure.
  No Home shutdown phase was reached; it cannot count as ordinary-close failure
  or completed forced workload. The core's exit-handling frames are consistent
  with retained teardown findings, not a new fully symbolized causal diagnosis.
  Source and acknowledged recovery generations passed a stage-specific audit.
  The same core arrived late in the next case, which keeps that strict failure
  too; this is not a second independent crash. **Release gate C stays open.**
  No filtering, waiver or crash-resolution claim.
- **Save As/refusal:** pre-change reduced Btrfs workload reports adoption failure
  before close; both originals/copies and draft generations survive. The guard
  correctly refuses false-close credit. The wrapper message cannot identify
  adoption versus old-identity release cause. M6-02's first narrowed slice owns
  reproduction/cause, later-edit copy targeting and rollback proof.
- **IME Undo/readiness:** pre-change full Btrfs and candidate tmpfs workloads
  stall at `Ready current screenplay` after stress IME Undo, before shutdown.
  Saved/journaled/source bytes match independently frozen baselines. Whether the
  readiness oracle, stale advisory state or a production freeze is responsible
  remains open; M6-02 must narrow any broader correction before coding.

## Tooling, provenance and supported resolution

The old private IME overlay prerequisite failed before app startup. The bounded
replacement constructs package-intersecting directories and symlinks through a
separate read-only system `/usr` bind, keeping package precedence and the owned
PID namespace. Only the private profile is writable, as before. Symlink/shadow/
source-preservation tests and actual real-IME workloads have separate claims.
No daemon/global profile takeover, new frontend addon, install or wider writable
mount was introduced. Fresh extraction used ten reverified signed archives.

Baseline/candidate binaries are frozen separately; actual current owned-process
maps match runtime file hashes. Installed WebKit/JSC/Gallium lack debug/symbol
table sections; exact build IDs and owned core identity are retained. Primary
upstream fixed status does not establish an available corrected supported
runtime, its installed patch contents or its effectiveness. No private-stack
trial, distribution or open-ended graphics bisection. The gated
[M6-01-R1 follow-up](../tasks/M6-01-R1.md) requires one supported, identified
candidate and matched native/byte/crash proof before any resolution claim.

## Limits and next boundary

Current checks/results and the bounded task disposition are in evidence. Full
S13, long sessions, screenreader, exact release-target confirmation, actual
installed/offline/manual update, migration/independent backup restore and owner
pilot remain open. This review does not admit M6-G/Local v1 or other platforms.
Independent M6-02 safety work can use this review without closing C1/F2;
no M6-02 implementation or history/adoption work occurs in this task.
