# AUDIT-PARK — confirm-first parking verdicts

Status: **done 2026-10-04**; base `0a80fa7`.
[Evidence](../../test-evidence/AUDIT.md#audit-park--confirm-first-parking-verdicts).
Covers the TODO "Confirm-first parking" list, drawn from the frozen audit's
[unverified observations](../AUDIT.md#unverified-observations-not-findings).
Those are not findings until a test reproduces them.

## Deliverable and acceptance

For each parked item, a test that confirms or refutes it and a recorded
verdict. Where an earlier task already reproduced an item, cite and rerun that
test instead of duplicating it.

| Item                                | Test                                                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| D-04 `FADE IN:` / section drop      | shared corpus case on both sides; section drop already in the corpus                                  |
| D-05 replace-all without protection | mounted WritingView replace-all with snapshot/workflow spies                                          |
| D-05 256-record cap, manual pruning | cadence at `snapshotLimit` with a prune spy; existing Rust cap test                                   |
| T-03 resume branches                | AUDIT-TEST tests for null cadence and release error; scratch core-crate probe for the duplicate draft |
| T-05 WritingView timing             | repeated isolated and loaded runs of the named test                                                   |
| T-07 post-restore adoption failure  | AUDIT-TEST WritingView test; scratch core-crate probe of the next save                                |
| S-09 lease order                    | tracked removal guard in `tools/audit-test-mutations.py`                                              |

## Do NOT do

Fix confirmed items that touch save, recovery, snapshots or native code: track
them in TODO. Change Rust (core-crate probes stay in session scratch and are
reported as such), IPC, the helper, profile, fonts or pins. Weaken an existing
assertion. No native WebKit claim (no display).

## Checks and stopping

Focused runs of each new test, full `pnpm check`, `pnpm test:pdf-helper`,
`git diff --check`. Record verdicts in `docs/test-evidence/AUDIT.md`; replace
the parking paragraph in TODO with verdicts and tracked items; one commit.
