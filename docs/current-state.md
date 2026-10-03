# Current state — M6-01 bounded shutdown review complete

Date: 2026-10-02. Application: **babel**. Main; no push/tag/branch.
Base `4c4df9a`, 18 ahead before this task's commit. M0–M5 remain complete
under recorded bounded Linux acceptance; M6-00 planning and the bounded M6-01
investigation/review are complete. **C1/F2 and Local v1 admission remain open.**

## Task and work

Owner declares Linux for now and requests future portability; the observed
x86_64 host scopes this authorized implementation/test run. It is not a separate
owner architecture/distribution support promise. M6-13/14 still need exact
release-target confirmation. [ADR 0040](decisions/0040-local-v1-platform-scope.md),
[development](development.md#declared-local-v1-targets-m6).

M6-01 extracted the existing close guard/effects for real native registration/
lease and injected-effect regressions. No save/acknowledgement/format/capability/
frontend/dependency-version change. Added opt-in existing base recovery-shutdown
workload to strict process/journal accounting. Corrected private IME readiness
with read-only package/system bind view after kernel overlay refusal; signed
packages reverified/freshly extracted, no system install/global settings.
[Brief](tasks/M6-01.md), [separate review](reviews/2026-10-02-m6-01-shutdown-review.md),
[exact commands/artifacts/failures](test-evidence/M6.md#m6-01--linux-scope-and-shutdown-hardening).

## Checks and retained failures

Shared frontend 772/772, lint/typecheck/build; browser smoke; Rust fmt/clippy and
workspace 263/263 each tmpfs/Btrfs; six close regressions on both; default release
build pass. Focused protected-close/session, tooling, final format/link/diff
results are in M6 evidence. Injected effects are not GTK termination proof.

Full real-IME baseline 3/4 strict; candidate 7/8 functional, 6/8 strict. All four
candidate ordinary cases pass. One candidate pre-shutdown readiness failure
followed by forced fallback DELETE records owned WebKit SIGSEGV/core; its delayed
report fails the next strict case too, not a second independent crash. Completed
workload and stage-specific failed-root byte audits pass; no false exit credit.
C1 parent-kill/recovery 2/2 and narrower non-WebDriver control 2/2 pass; neither
resolves retained forced-shutdown findings. Frozen binaries/maps/cores/logs and
all failed roots remain retained under `target/m6-01/` and linked private roots.

Pre-change Save As adoption refusal and stress IME Undo/readiness stalls remain
unresolved operation findings. Independent literal source/copy/acknowledged
recovery bytes survive; causes are not inferred from wrapper messages.

## Next action and blockers

Stop at M6-01. Next agent-executable task: [M6-02](tasks/M6-02.md), beginning with
its narrowed Save As/refusal and readiness investigation before wider S15.2
fault/restart hardening. No M6-02 implementation began in this task.
[Supported-runtime follow-up M6-01-R1](tasks/M6-01-R1.md) waits for an actually
available, identified supported corrected runtime and explicit bounded change
scope. C1/F2 release gate C stays open before M6-14/16.

Full S13, security/notices, target-native/screenreader/installed/manual update,
independent backup/migration/owner pilot and Local v1 admission remain later
gates. DEV-02 second-host acceptance remains owner-only. No M7/history/adoption,
private-engine shipping, personal manuscript/credential/upload work.
