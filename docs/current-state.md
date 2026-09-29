# Current state — M3-13 reviewed; integrated exit open

Date: 2026-09-29 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [index](index.md).

## Task and work

**M3-13** integration and separate safety review performed by one editing agent on main from `7a2642a`, clean initial tree. No application implementation, dependencies, capabilities, SPEC or fixture bytes changed. Previous M3-12 work and synthetic recovery artifacts remain intact. No push authorized.

Added `tests/native/writing-lifecycle/editor_exit.py` and three optional runner modes: independent default-app corpus/input audits, a separate uncapturable-draft safety reproduction, and integrated row-workload timing. Updated runner instructions, [review](reviews/2026-09-29-m3-13-review.md), evidence, affected contracts/trace/task/index/state docs, and four bounded correction briefs.

## Checks and evidence

[M3-13 evidence](test-evidence/M3.md#m3-13--integrated-editor-gate-and-separate-safety-review) owns exact commands, host, roots, logs and failed attempts. Shared checks passed: 477 frontend tests, formatting/lint/typecheck/build/browser smoke, Rust fmt/clippy, 192 native workspace tests on each of tmpfs/Btrfs, default embedded release build, Python compilation and hostile-HTML browser request interception.

Both filesystems completed the default native editor/lifecycle drill: 21 no-op sources, eight edited-source/Undo oracles, semantic/group/scene fields, trusted clipboard/Unicode/IME, completion/caret/keys, Save As/cancel, real save/close/reopen, restore/Undo, acknowledged-checkpoint SIGKILL/restart, ordinary permission failure, history isolation, external divergence and exact emergency copy. Positive roots: `/tmp/babel-writing-kyq8e7ai`, `target/babel-writing-1w2c4ij0`. Browser/mocked checks are labeled separately from native evidence.

## Required corrections and next action

M3-13 remains **unchecked**. The [separate review](reviews/2026-09-29-m3-13-review.md) requires:

- **R03 / [M3-12-R1](tasks/M3-12-R1.md), next ready task:** accepted middle-Parenthetical split cannot capture; newer text is only in memory, but source/close status claims the earlier version saved. Emergency copy repeats capture failure. Native reproduction on tmpfs/Btrfs retains live rows, exact original source/journals and screenshots.
- **R02 / [M3-09-R1](tasks/M3-09-R1.md):** acknowledged unsaved checkpoint survives restart and is inspectable, but no default-app resume/export action exists.
- **R01 / [M3-11-R1](tasks/M3-11-R1.md):** actual permission-read-only source disables Save As, contrary to SPEC S05.2; an existing test mandates this refusal.
- **R04 / [M3-04-R1](tasks/M3-04-R1.md):** integrated 2,400-row typing has sustained event-loop stalls. Earlier probes stopped before input drained; the complete tmpfs run verifies all 120 trusted inputs/exact source but records rAF proxy p95 436 ms, max 592 ms, 119/120 above 100 ms; complete Btrfs also verifies 120 exact inputs, with p95 451 ms/max 612 ms and 116/120 above 100 ms. Detailed filesystem results are in evidence; this is not compositor paint or page calibration.

Complete the corrections and rerun affected/shared/native gates before accepting M3 or decomposing M4. Do not normalize away unrepresentable drafts or weaken native ownership to obtain a pass. Full compositor paint/page-equivalent performance, other platforms, installed/offline adoption, PDF, M4 workflows and Local v1 remain open.
