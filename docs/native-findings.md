# Retained native findings

This register indexes owned and unresolved events; it neither establishes a
shared cause nor replaces raw cores, PID/start-token ledgers and failed manifests. Dates below
are the last **recorded failure**, not the date of a later passing control.
Rows concern the Linux app/WebKit writing/recovery lifecycle. Evidence remains
snapshot-specific. No historical event is closed by this maintenance task.

## Disposition and escalation

- Content loss, unprotected ordinary drafting or reproducible crashes in writing,
  save or accepted close block affected work/adoption pending protection/repair.
- Forced teardown, resource exhaustion and unknown phase are separate workloads.
  Record reachability; independent feature work may proceed within that scope.
  Release needs resolution or explicit reviewed residual-risk acceptance, not
  an unbounded requirement to prove that an intermittent event can never recur.
- One selected review covers one artifact/reachability assessment or supported
  candidate/control. End with resolved, accepted residual risk, or a concrete
  narrowed follow-up with owner and next decision. Missing corrected-runtime
  availability blocks a runtime trial, not artifact/risk review. Do not repeat
  the same clean sweep automatically; no deadline grants acceptance.
- A disposition names finding, build/runtime, exact trigger/phase or unknown,
  reachable workload, preserved-content evidence, protections, residual risk,
  acceptance scope and reviewer/owner decision. Accepted risk is not repair:
  retain original strict failures, cores and identities. Passing controls never
  erase them or establish cause. No cause follows from a stack/upstream fix alone.
- Release acceptance remains owner-reviewed under SPEC S15.5; see
  [M6-01-R1](archive/tasks/M6-01-R1.md) and [M6-02-R1](archive/tasks/M6-02-R1.md).
  Update this register for new events/dispositions. Keep unknown attribution
  unknown; delayed kernel/core deliveries do not create additional crashes.

## Open events

<!-- prettier-ignore -->
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
| D04-R4, PID 1545216/start 13646967    | 2026-10-05 05:40:09 PDT                        | Btrfs, four app SIGABRTs at file picker with `/tmp` inode exhaustion. [Ledger review](test-evidence/INFRA-WORKFLOW.md#r4-process-provenance).                                            | Ledger: `babel-desktop`; one owned, three unattributed. Cause open; clean Btrfs-IME replay does not close.                |
| M6-02-R4, PID 188105/start 1928729 | 2026-10-05 20:33:51 PDT | Frozen control, Btrfs presentation functional pass; first forced WebDriver DELETE window records WebKit SIGABRT / corrupted double-linked list. [Evidence](test-evidence/M6-02-R4.md#new-frozen-control-crash). | Owned core copied/hash-bound; cause open. Current clean forced result and intact bytes do not close it. |

These are event identities, not established independent defects; the D04-R4
row covers four aborts in one run with `/tmp` out of inodes. M6 C1/F2,
M6-02, installed/native platform coverage and Local v1 admission remain open.
Other non-crash failures (IME/Save As, Replace-All flake, SELinux and publication
cache) remain in their owning briefs/evidence; this register does not retire them.

## M6-16 runner-only events

The twelve historical rows above retain their original status text; current
[ADR 0043](decisions/0043-agent-decision-authority.md) supplies their accepted
residual-risk disposition. The following new events have a separate scope.

| Identity                               | Failure                                                                                    | Disposition                                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| babel-desktop PID 272524/start 4875340 | 2026-10-06 04:43:26 PDT, SIGABRT opening Save As in root-mapped/drop-cap offline namespace | GTK `ensure_surface_for_gicon` assertion after glycin/bwrap SVG-loader status 1. Unsupported runner configuration; strict failure/core retained. |
| babel-desktop PID 272778/start 4878656 | 2026-10-06 04:43:53 PDT, SIGABRT opening Fountain picker in the same runner configuration  | Same observed GTK assertion; distinct owned core, not WebKit teardown. Strict failure retained.                                                  |

[M6-16 evidence](test-evidence/M6-16-2026-10-06.md#retained-failures-and-disposition)
names the unchanged AppImage/native/runtime identity, hashes both copied cores,
audits acknowledged checkpoints and records the normal-UID control. Later
unacknowledged typing in the aborted run is not claimed preserved.

Agent disposition: exclude root-mapped/drop-cap execution from supported writer
workflows; the corrected runner preserves UID 1000, drops capabilities and
passes all four packaged modes with clean audits. This is a harness correction,
not a general GTK repair or erasure of either event. Escalate a recurrence with
normal UID during ordinary writing/save/close to protection/repair.
