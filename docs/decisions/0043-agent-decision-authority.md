# ADR 0043: Agents decide; the owner is never a blocker

Status: **Accepted direction; owner instruction 2026-10-06**
Date: 2026-10-06. Task: PROC-RESET.

## Context

The owner built babel entirely with agents and is not a TypeScript/Rust
reviewer. Earlier guidance routed every residual-risk, platform, scope and
release choice to "owner decision". Those questions were recorded in evidence
files rather than asked, so `docs/current-state.md` ended at "STOP … no
subsequent task selected" and M6-03+ waited on gates nobody was asked to close.
The owner instructed (2026-10-06): never make the owner a blocker or ask for a
judgment call; the working agent decides what is best.

## Decision

1. **The working agent makes every decision** — scope, residual risk, platform,
   priorities, dependency choices, deferrals and release gates. It records the
   choice and its reason in the commit and, for lasting choices, an ADR, then
   continues. "Owner decision", "owner-only" and "owner review" in older docs
   now mean "agent decision recorded in the repository".
2. **Safe defaults replace questions.** When an action would spend money,
   create cloud resources, upload or publish author content, use personal
   credentials or the owner's manuscripts, or change global settings, the
   decision is **no**: take the free, local, synthetic alternative and record
   any resulting limitation. This is a default, not an escalation.
3. **Product invariants are unchanged.** SPEC S03 still binds the app: it asks
   the _writer_ before any upload (privacy gate), never silently normalizes
   source, and keeps recovery/saving/history independent. Only the
   development-process gates move from owner to agent.

## Dispositions recorded now

| Gate / item                      | Disposition                                                                                                                                                                                                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P — platform/implementation      | Linux x86_64 is the Tier 1 target ([ADR 0040](0040-local-v1-platform-scope.md)). Implementation of every M6 task is authorized.                                                                                                                                                                                                |
| C — native crash register        | The 12 [native rows](../native-findings.md) are WebKitGTK aborts under forced harness teardown (parent SIGKILL, forced WebDriver DELETE) or `/tmp` inode exhaustion; none lost content. **Residual risk accepted** for Local v1 on Linux. Reopen only for a crash during ordinary writing, save or close, or any content loss. |
| M6-02                            | Closed with limitations: retained Save As/IME readiness lag (117/118 ms, content saved) and shared-store lease limit are known limitations, not blockers.                                                                                                                                                                      |
| D-05                             | Snapshots are the Local v1 Versions feature. Git history UI tasks M6-05–09 are **deferred post-V1**; git2 stays frozen as is. M6-16 no longer depends on them; S15.5 step 7 is met by snapshot restore.                                                                                                                        |
| Capture failure                  | One unrepresentable row must not stop recovery journaling. Approved as a class fix ([ADR 0044](0044-recovery-independent-of-capture.md)).                                                                                                                                                                                      |
| S — license/signing/distribution | Personal, unsigned, local Linux package. No paid signing, store or publishing.                                                                                                                                                                                                                                                 |
| H — performance hardware         | Measure on the available development host and record it; missing reference hardware is a limitation, not a blocker.                                                                                                                                                                                                            |
| T/A — targets, migration, pilot  | Agents run the S15.5 sequence with synthetic scripts and disposable copies. DEV-02's second-host run and owner migration exports are deferred limitations: no agent has access to them, and they do not block work.                                                                                                            |

## Alternatives

Keep owner gates and ask the owner yes/no questions. Rejected by the owner:
the owner does not want to be in the decision loop.

## Consequences

`AGENTS.md` keeps an ordered priority list in `docs/current-state.md`; an agent
that finds the top item blocked takes the next one and never ends on "STOP".
Accepted risks remain listed with their original evidence; acceptance is not
repair. A later agent may reverse any disposition here with a recorded reason.

## Evidence still needed

M6-03/M6-14/M6-16 implementation and the agent-run S15.5 pilot on Linux.
Supersedes the owner-gate rows of [M6-00](../tasks/M6-00.md#unresolved-gates-and-evidence-still-needed).
