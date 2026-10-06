# AUDIT-D01 — portable Enter separators and explicit speech/break authoring

Status: **done 2026-10-03** ([evidence](../../test-evidence/AUDIT.md#audit-d01--portable-enter-separators-and-explicit-speechbreak-authoring))
Dependencies: AUDIT-W0, AUDIT-C01 and AUDIT-C04 (done); owner accepted D-01 small fix in [DESIGN triage](../../../TODO.md#design-triage--decided-2026-10-03-executable-accept--reject--defer--rationale).
Requirements: EDIT-01/02, INV-03/06/11/12/14; [SPEC S05.4](../../../SPEC.md#054-structured-model) and [S07](../../../SPEC.md#s07-smart-writing-shortcuts-and-autocomplete).

Covers [D-01](../AUDIT.md#d-01--the-single-enter-writing-flow-produces-fountain-that-other-parsers-and-babels-own-pdf-pipeline-misread-the-row-per-source-line-model-makes-ordinary-edits-refusable-impact-high) smallest separator-row fix and [S-08](../AUDIT.md#s-08--six-codec-operations-have-no-production-caller-two-of-them-are-the-only-implementation-of-features-the-app-refuses-low-as-slop-medium-for-the-surfaced-gap-m) keep-set wiring only. See the [dropped/refuted list](../AUDIT.md#dropped-or-refuted); the element schema is deferred post-V1.

## Tests first — red before the fix

1. Production-state Enter table: pin separator bytes, new-row kind/caret/IDs, and exact Undo/Redo. Type heading → Action → Character → Dialogue → Action from empty, asserting literal portable bytes and nonblocking export assessment. An opened unforced speech followed by Enter and narrative must likewise end the speech.
2. Enter at the end of a speech row with a following row in the same speech, then typing: capture/reopen must retain every row and its speaker. Remove that exclusion from the AUDIT-C01 property test; keep its unrelated dual-regroup/protected-neighbour exclusions.
3. Symmetric Backspace/Delete removes the separator plus an empty new Action in one undoable transaction; two Action paragraphs can join across their separator, preserving text/marks. Existing intentional blanks remain authorable; unsafe speech/protected joins still refuse.
4. Shift+Enter in Action and attached Dialogue makes physical same-kind rows, retaining marks, speaker, selection and one Undo/Redo. Pin edge/empty Dialogue breaks (two-space Fountain row), and unsupported/protected/parenthetical-looking splits refuse without mutation. Spy on the production codec keep-set calls at deferred capture to prove wiring.
5. A visible, keyboard-remappable Toggle dual dialogue command creates/removes a relationship between two adjacent complete speeches. Test capture/reopen, unchanged neighbour bytes, IDs/marks/selection, Undo/Redo, incomplete/nonadjacent/overlapping/protected refusal, composing/read-only guards, and controls routing.

## Fix — existing rows and deferred codec ownership

- `commands.ts`: when end Enter starts a new Action paragraph, insert a real blank separator and the caret's Action row in one transaction. Character/Parenthetical continuation stays attached without a separator. If another row of the same speech follows, Enter inserts an attached Dialogue continuation rather than ending the speech before its remaining text. Keep Lyrics continuation, start/middle/selection rules and intentional blank rows.
- Extend the boundary join for the symmetric cases above; preserve existing refusal boundaries.
- Wire Shift+Enter for provable Action/Dialogue row splits. Use physical rows, existing marks and IDs; empty speech break rows contain the codec's two-space spelling. Refuse unsupported kinds and splits that would reinterpret speech as a parenthetical.
- Wire explicit dual toggle through live row/group validation and the existing controls/command registry. Change only the right cue's relationship; reject incomplete, nonadjacent or overlapping groups before dispatch.
- Deferred `sourceBridge.ts` uses `replaceLineWithBreaks` for owned single-row Action/Dialogue splits (retain session IDs), and `setDualDialogue` for explicit cue relationship changes. No full capture or serialization runs in key handlers.
- Update [editor behavior](../../editor-behavior.md); clarify SPEC S07.2 separator/continued-speech behavior with its tests together. No transition-table kind change.

## Do NOT do

Edit frozen `AUDIT.md`. Build an element-level schema, total serializer, automatic un-forcing, draft-bundle fallback or recovery-format change. Add select-all/whole-speech deletion, editable inline-note regions, or broaden unrelated selection/refusal rules. Delete S-08 operations (AUDIT-SLP-C), fix renderer/escape behavior (AUDIT-C356), or implement D-07's Screenplain/PDF/native scene oracle. Change native/IPC/persistence/receipt formats, dependencies or packaging. Trial-capture on keys, weaken existing tests, or fix the unrelated matrix/CI/native-click observations. Deliberately changed expectations need a one-line evidence reason.

## Checks and stopping

Tier 2: focused `pnpm exec vitest run tests/contract/editor-d01.test.ts tests/contract/editor-keys.test.ts tests/contract/editor-unforced.test.ts tests/contract/editor-shortcuts.test.ts tests/contract/editor-bridge.test.ts tests/contract/fountain-complex.test.ts tests/ui/EditorControls.test.tsx tests/ui/WritingView.test.tsx`; full `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets --locked -- -D warnings`, `cargo test --workspace --locked` (Rust 1.97.1, `/tmp/babel-cargo`); `pnpm test:browser` (input/controls trigger); touched-file `prettier --check`, `python3 tools/check-links.py`, `sh tools/lint-py.sh`, `git diff --check`. No Tier 3 matrix or native drill: frontend-only, no cross-boundary change; retained native input cases cover Character continuation and middle splits, whose behavior stays unchanged. Record mocked/JSDOM vs browser vs native Rust coverage honestly, failures and reruns included, one line per check in [AUDIT evidence](../../test-evidence/AUDIT.md). Update TODO and trim current-state, commit on main with AUDIT-D01, never push. Stop at this brief; AUDIT-D08A next.
