# Current state — M3-04 editor bridge complete

Date: 2026-09-29 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [M3 evidence](test-evidence/M3.md#m3-04--sole-editor-authority-and-source-bridge).

## Completed task and trust boundary

**M3-04 Sole editor authority and source bridge** passed its bounded acceptance on main, base `20ddf91`, clean starting tree. One production EditorState owns typed rows/text/marks, immutable original source and monotonically newer edit/selection/undo versions. Deferred captures preserve no-op bytes and expose source spans plus UTF-16/UTF-8/grapheme selection anchors. Version/session-bound hash results cannot mutate newer state or grant saved credit.

Protected/unknown regions and invalid UTF-8 remain preserved; unsupported structural or serialization changes refuse without losing the current draft. Full source parsing/serialization/encoding/hashing is outside synchronous typing dispatch. Two-request/source/metadata bounds protect capture admission; sparse metadata restoration is M3-10. [ADR 0021](decisions/0021-production-editor-source-captures.md) records the ownership/capture contract.

The default desktop still cannot create/open/edit/save a screenplay. Production activation, picker, cadence, Save As and Local v1 adoption remain open. The latest native persistence milestone remains the [M2 headless Linux exit](test-evidence/M2-06.md).

## Paths and checks

- New src/editor/{schema,state,sourceBridge,view}.ts and src/application/editorCapture.ts; tests/contract/editor-bridge.test.ts and tests/native/editor-bridge/. Four existing pinned ProseMirror packages promoted to runtime with exact direct/transitive MIT notices in docs/third-party/. Owning contracts, ADR evidence, task/trace/index/state and M3 evidence updated.
- [M3-04 evidence](test-evidence/M3.md#m3-04--sole-editor-authority-and-source-bridge) owns exact commands, host/results/logs and omissions: 174 focused and 291 shared frontend tests, Rust checks, browser smoke and default release no-bundle build. Real native WebKit LF/BOM-CRLF/no-final-newline typing, selection replacement, undo/redo, protected raw refusal and stale-capture cases passed independent byte/hash assertions.
- All 35 tracked Fountain files and existing oracles/proofs/domain/native/default UI/config/SPEC remain unchanged. Lock resolutions are unchanged. No filesystem publication contract changed; no second filesystem matrix is required.
- An unrelated deletion of BOOTSTRAP_PROMPT.md appeared during this session. It is preserved outside this task's commit; no requested M3 file depends on it.

## Limits and next action

**Next ready task: M3-05 Smart keys, joins and structural undo.** Read [brief](../docs/tasks/M3-05.md), TODO entry, SPEC S07.2–S07.5/S07.7, docs/editor-behavior.md and ADR 0008. Implement structural transactions and composition sequence guards with independent source/caret/undo expectations and real native interaction. M3-09 is also dependency-ready; other tasks wait for predecessors.

M3-08 owns full IME/composition-to-Enter, paste and formatting input. M3-10 integrates native recovery/source cadence and sparse metadata restoration. M3-11 owns Save As identity/publication; M3-12 activates default writing workflows; M3-13 requires their integrated native failure/safety gate. No paint/large-capture performance or durable latest-Fountain claim follows from the synthetic capture harness.

M4 workflows/title-page form, M5 PDF and M6 history UX/configured backup/installed-offline/migration/owner pilot remain separate gates. Declare Tier 1 targets before M6. Git power-loss durability, actual disk full, physical-disk independence and other OS adapters remain unverified.

Stop after M3-04. Continue on main with task IDs in commits; never push without human review and explicit authorization.
