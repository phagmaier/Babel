# Retained native findings

This register indexes attributed events; it neither establishes a shared cause
nor replaces raw cores, PID/start-token ledgers and failed manifests. Dates below
are the last **recorded failure**, not the date of a later passing control.
All rows concern the Linux WebKit writing/recovery lifecycle. Evidence remains
snapshot-specific. No historical event is closed by this maintenance task.

## Disposition and escalation

- Observed author-content loss or a reproducible crash during ordinary writing,
  save or accepted close blocks affected feature work and release admission.
  Narrow reproduction/protection/repair tasks may proceed with explicit scope.
- Forced-kill, forced automation teardown and unresolved phase events retain
  strict native/release failures. Review their reachability before expanding
  affected feature work; controls do not establish safety or a cause.
- A disposition names the finding, affected workload/build, cause or explicit
  residual risk, evidence, and reviewer/owner decision. No cause is inferred
  from a stack signature or an upstream fix alone. Release acceptance remains
  owner-reviewed; check [M6-01-R1](tasks/M6-01-R1.md) and [M6-02-R1](tasks/M6-02-R1.md).
- Update this register when a new owned event or disposition is recorded.
  Unknown phase/reproduction stays unknown; do not apply an arbitrary count
  threshold or count delayed kernel/coredump deliveries as separate crashes.

## Open events

| Finding / process identity            | Last recorded failure                          | Workload and observation                                                                                                                                                                 | Reproduction / disposition                                                                                                |
| ------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| M6 F2, PID 192218/start 2119485       | 2026-10-02 (M6-01 task; exact event in ledger) | Stress IME Undo readiness fails, then forced WebDriver DELETE records SIGSEGV; ordinary close was not reached. [Evidence](test-evidence/M6.md#candidate-interim-crash-identity-retained) | Forced path freshly reproduced in M6-01; cause unresolved. Gate C open; supported-runtime follow-up prerequisite blocked. |
| M6 C1, PID 274428/start 2737907       | 2026-10-02 23:46:32 PDT                        | Btrfs parent-SIGKILL/restart, SIGABRT before stale-session DELETE. [Evidence](test-evidence/M6.md#frozen-controls-failures-and-operation-truthfulness)                                   | Later clean parent-kill samples do not resolve it. Gate C and M6-02 disposition open.                                     |
| SLP-B, PID 69485/start 1517917        | 2026-10-03 (epoch 1791082737)                  | Btrfs parent-SIGKILL/restart SIGSEGV before final ordinary quit. [Evidence](test-evidence/AUDIT.md#audit-slp-b--retired-prototype-proofs-with-production-coverage)                       | Fresh control/replay clean; original remains strict-fail, cause unresolved.                                               |
| NATIVE-R1, PID 251383/start 3043549   | 2026-10-04 07:15:29 UTC                        | Btrfs editor-exit, forced parent disappearance coincides with SIGSEGV. [Evidence](test-evidence/AUDIT.md#audit-native-r1--f6-focus-and-private-mozc)                                     | One attributed event; delayed coredump counted once. Cause/disposition open.                                              |
| D02, PID 335923/start 3571811         | 2026-10-04 08:41:17 UTC                        | Btrfs editor-exit parent-kill/restart SIGSEGV. [Evidence](test-evidence/AUDIT.md#audit-d02--safe-reopen-reconciliation-and-recovery-choice)                                              | Original candidate strict-fail retained; cause/disposition open.                                                          |
| D02, PID 353321/start 3701248         | 2026-10-04 09:02:47 UTC                        | tmpfs recovery-shutdown forced restart SIGSEGV. [Evidence](test-evidence/AUDIT.md#audit-d02--safe-reopen-reconciliation-and-recovery-choice)                                             | Content pass does not close strict failure; cause/disposition open.                                                       |
| D02, PID 413296/start 3989180         | 2026-10-04 09:53:07 UTC                        | Btrfs editor-exit SIGABRT at forced-parent disappearance. [Evidence](test-evidence/AUDIT.md#audit-d02--safe-reopen-reconciliation-and-recovery-choice)                                   | Final content pass, strict-fail retained; cause/disposition open.                                                         |
| D03B, PID 477772/start 4562349        | 2026-10-04 04:26:23 PDT                        | Failed presentation candidate, Btrfs forced teardown SIGABRT; corrupted-unsorted-chunks signature. [Evidence](test-evidence/AUDIT.md#audit-d03b--writing-layout-shell)                   | Product CSS failure corrected; that does not dispose the crash.                                                           |
| D03B, PID 501063/start 4636728        | 2026-10-04 04:40:16 PDT                        | tmpfs editor-exit content pass, SIGABRT; corrupted-unsorted-chunks signature. [Evidence](test-evidence/AUDIT.md#audit-d03b--writing-layout-shell)                                        | Exact crash phase requires ledger review; cause/disposition open. Do not classify as ordinary close from the mode name.   |
| PARK-H-F2, PID 1134510/start 10372570 | 2026-10-04 20:34:35 PDT                        | Btrfs empty-heading owned-kill first session SIGABRT, before later ordinary-close markers. [Evidence](test-evidence/AUDIT.md#audit-park-h-f2--empty-scene-heading-recovery-intent)       | Frozen F1 control and F2 replay each clean; primary strict failure remains. Stack evidence is not attribution.            |
| D04-R4, PID 1545216/start 13646967    | 2026-10-05 05:40:09 PDT                        | Btrfs, 4 modes: SIGABRT at first file picker, `/tmp` at 0 free inodes; 3 more PIDs in [evidence](test-evidence/AUDIT.md#audit-d04-r4--boneyard-inside-the-renderers-opening-title-block) | Rerun with the IME view on Btrfs clean 8/8; cause not established. Owner review; clear `/tmp` inodes.                     |

These are event identities, not established independent defects; the newest
row covers four aborts in one run with `/tmp` out of inodes. M6 C1/F2,
M6-02, installed/native platform coverage and Local v1 admission remain open.
Other non-crash failures (IME/Save As, Replace-All flake, SELinux and publication
cache) remain in their owning briefs/evidence; this register does not retire them.
