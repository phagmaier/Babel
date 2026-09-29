# Current state — M3-05 structural keys complete

Date: 2026-09-29 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [M3 evidence](test-evidence/M3.md#m3-05--smart-keys-joins-and-structural-undo).

## Completed task and trust boundary

**M3-05 Smart keys, joins and structural undo** passed its bounded contract and native WebKit acceptance on main, starting from clean `00b7573`. Production EditorState still owns all live text/type/selection; structural commands alone authorize row changes and history can undo/redo them. New IDs advance across undo. Deferred source capture retains unchanged syntax and protected rows, and owns complete standalone Note regions when their literal split is unambiguous. Exact source/caret/version assertions cover Enter table, starts/middles/ends/empty/selection, Backspace/Delete joins, type conversion, hard-break refusal and the composition event sequence.

The default desktop still cannot create/open/edit/save a screenplay. Picker/remapping, completion, full IME/paste/formatting input, native source/destination selection, cadence, Save As, production activation and Local v1 adoption remain open. The latest native persistence milestone remains the [M2 headless Linux exit](test-evidence/M2-06.md).

## Paths and checks

- `src/editor/commands.ts` adds smart/explicit structural transactions; `state.ts`, `view.ts`, `sourceBridge.ts` and `src/domain/fountainCodec.ts` retain ID/source ownership and composition guards. `tests/contract/editor-keys.test.ts`, the existing bridge contract and `tests/native/editor-bridge/` cover these changes. Owning contracts, task/trace/index/state and M3 evidence were updated. Ten preexisting M2 evidence files had one extra final blank line each; the required shared Prettier gate needed those formatting-only deletions.
- [M3-05 evidence](test-evidence/M3.md#m3-05--smart-keys-joins-and-structural-undo) owns exact commands, host/results/logs and omissions. Real Wayland/WebKit Enter, Backspace, Note split, undo/redo, hash/source/caret and a synthetic composition sequence passed. Frontend shared, browser, Rust format/lint/workspace/feature and default release no-bundle build gates passed. The sandboxed Rust ACL fixture returned `EINVAL`; the exact Btrfs fixture passed outside the sandbox, followed by a full unsandboxed workspace pass.
- Tracked Fountain fixtures, source/import oracles and default app activation remain unchanged. No filesystem publication contract changed; no second filesystem matrix was needed. The unrelated `BOOTSTRAP_PROMPT.md` path was untouched by this task.

## Limits and next action

**Next ready task: M3-06 Element picker and configurable shortcut registry.** Read [brief](tasks/M3-06.md), TODO entry, SPEC S07.4, docs/editor-behavior.md and docs/ux.md. M3-09 is also dependency-ready; other tasks wait for predecessors.

M3-08 owns full real IME, paste and formatting input. M3-10 integrates native recovery/source cadence and sparse metadata restoration. M3-11 owns Save As identity/publication; M3-12 activates default writing workflows; M3-13 requires their integrated native failure/safety gate. The synthetic composition event sequence is not a real IME acceptance claim. Hard breaks still refuse visibly until a proven per-context source representation exists; ambiguous Note endpoints and unsafe dialogue joins refuse rather than changing author content.

M4 workflows/title-page form, M5 PDF and M6 history UX/configured backup/installed-offline/migration/owner pilot remain separate gates. Declare Tier 1 targets before M6. Git power-loss durability, actual disk full, physical-disk independence and other OS adapters remain unverified.

Stop after M3-05. Continue on main with task IDs in commits; never push without human review and explicit authorization.
