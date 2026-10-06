# INFRA-WORKFLOW — policy and handoff verification

2026-10-05; base `900b234`, main, owner-authorized, local only.
Policy/docs only; no product behavior or release-risk acceptance.
Artifacts: `target/infra-workflow-20261005-eO0SQB/`.
Host: owner laptop, Linux 7.2.8-arch1-2 x86_64, Btrfs checkout.
Node 26.7.0 / pnpm 11.22.0 through mise. No product/runtime change.

## Checks

| Command                                                                                                                                      | Kind                            | Result / elapsed                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `mise exec node@26.7.0 pnpm@11.22.0 -- pnpm exec prettier --check` with 13 touched Markdown paths (exact argv in `format-final.result.json`) | Static                          | Pass, 0.975 s; SPEC/AGENTS retain existing `.prettierignore` exclusion.                                                                |
| `python3 tools/check-links.py --all`                                                                                                         | Static                          | Pass, 1,831 links, 1.379 s.                                                                                                            |
| `python3 tools/check-guidance.py`                                                                                                            | Static                          | Pass, zero problems, 0.027 s.                                                                                                          |
| `python3 target/infra-workflow-20261005-eO0SQB/preservation.py`                                                                              | Independent byte/contract audit | Pass, 0.062 s: 747 prior tracked files unchanged; S03, mandatory faults, all adoption steps and eleven native row identities retained. |
| `git diff --cached --check`                                                                                                                  | Static                          | Pass, 0.004 s.                                                                                                                         |

Final status/evidence checks passed (`*-final.{log,result.json}`); final
result-copy edits receive a closing static/preservation check before commit. Exact argv/results in `<root>/*.result.json`; historical evidence,
source/tests/fixtures, corpora, baseline, helper/pins, CI and lockfiles are
byte-identical to base. Full diff reviewed against acceptance; no new runtime
claim or residual-risk acceptance. Current-state replaces duplicate completion
narratives with links and selects M6-02-R1; broad CI/release gates remain.

## Limits

No frontend/Rust/helper/differential/browser/native rerun: executable paths,
fixtures, pinned expectations and CI are unchanged. No historical finding is
closed. Prior evidence remains snapshot-specific; no fresh product/adoption
claim. Raw artifacts and historical Markdown retained without pruning.

## R4 process provenance

Read original `target/audit-d04-r4-e4ir8I4A/native/*-{processes,journal}.json`
and matched each core PID to its process ledger (review only, no native rerun):
`1544509`, `1545216`, `1546260`, `1546637` all identify `babel-desktop`, signal 6.
Saved journal audits classify `1545216/start 13646967` owned and the other three
unattributed. Preserve that distinction; do not infer a WebKit crash or cause.
Original run reports file-picker/session failures with `/tmp` at zero free
inodes; the later clean run establishes neither attribution nor repair.
[Original evidence](AUDIT.md#audit-d04-r4--boneyard-inside-the-renderers-opening-title-block).
