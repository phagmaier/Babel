# AUDIT-C01 — capture stays possible on standard Fountain edits and edge-space emphasis

Status: **done 2026-10-03; first Wave 1 brief** ([evidence](../../test-evidence/AUDIT.md#audit-c01--capture-stays-possible-on-standard-fountain-edits-and-edge-space-emphasis))
Dependencies: AUDIT-W0 (done)
Requirements: INV-06 (content protection), `SPEC.md:358` (forced markers when needed to prevent misinterpretation). Frontend codec/editor only; no native, IPC, persistence-format or recovery-format change.

Covers [C-01](../AUDIT.md#c-01--on-a-standard-fountain-file-typing-under-a-heading-or-above-a-character-cue-makes-the-draft-uncapturable-nothing-is-journaled-or-saved-until-that-edit-is-reverted-high-m-for-the-seven-cases-l-to-close-the-whole-class), [C-02](../AUDIT.md#c-02--a-space-at-the-edge-of-bolditalicunderline-text-makes-the-draft-uncapturable-one-common-sequence-leaves-it-stuck-high-m) and [T-01](../AUDIT.md#t-01--no-test-deletes-a-blank-row-next-to-unforced-fountain-syntax-and-checks-what-is-saved-high-m). Scope is the M-sized fix (the seven audited cases, their blank-row siblings and the edge-space class), not the L-sized closure of every uncapturable shape.

## T-01 first — tests that are red before the fix

New `tests/contract/editor-unforced.test.ts`, driven through `createEditorState`, `smartKeyTransaction`, plain `tr.insertText` and `captureEditor`:

1. The seven C-01 cases on the audit's unforced source, plus blank-row deletion and typing next to an unforced heading, cue and transition. Each must capture, and the captured bytes must reparse to the rows the editor shows.
2. Byte discipline: rows the edit does not own keep their exact source bytes; a re-spelled row changes only by its forcing marker (indentation and scene-number bytes kept).
3. Property test over `fixtures/fountain/*.fountain` plus the audit source: for every row boundary (Backspace at start, Delete at end, Enter at start, Enter at end then a letter) and every blank row (a letter), the key refuses or capture succeeds and reopens as the editor rows. Shapes left uncapturable are excluded by explicit predicates and listed in evidence.

## C-01 — codec and command fix (audit fix sketch 1–5)

1. `replaceLines` (`src/domain/fountainCodec.ts`): for a row whose kind and text are unchanged, try the retained spelling, then the forcing marker inserted into the retained source text, then the generated spelling. Only owned rows are ever re-spelled.
2. `transactSource` reports the first drifting neighbour's line on `neighbor-drift` (error codes and their order are unchanged), so the caller can widen precisely. `captureEditor` (`src/editor/sourceBridge.ts`) widens to that line in both the structural and the same-row-count branch, never across a protected row. Validation resolves each row's prior by retained ID, not by offset.
3. Enter at offset 0 of a speech row (Dialogue/Parenthetical under a cue) refuses: dialogue has no forced marker.
4. A split inside a Scene Heading makes the right half an Action row.
5. A Backspace/Delete join that would leave text after a closed parenthetical refuses (found by the property test; same class as 3).

## C-02 — edge whitespace in styled runs

`sourceForInline` (`src/domain/fountainInline.ts`) gains a capture-only mode: per style, strip that style from the leading and trailing whitespace of each styled span (whitespace-only spans become unstyled), render, and compare the round-trip against that normalised expectation. Only deferred capture uses it; explicit selection toggles and the codec `replaceInline` API keep their exact refusals. Existing bytes are unaffected (the parser never yields an edge-space styled span; unchanged rows reuse prior text). Known and accepted: an underlined edge space is saved without its underline.

`WritingView`: clear the capture-failure alert on the next successful `noteEdit`, without clearing unrelated alerts.

## Do NOT do

Journal a draft bundle when capture fails, or make `babel-draft-copy-v1` importable (D-01 skeptic's separate recommendation: recovery-format and Tier 3, needs its own ADR and owner call — record as a follow-up). Name the offending row in the alert (rides with that follow-up). Trial-capture inside key handlers ([refuted](../AUDIT.md#dropped-or-refuted); capture stays off the typing path). D-01 separator-row Enter, element schema, or any other audit item. Do not weaken an existing refusal test to get green: a changed expectation needs a one-line reason in evidence.

## Checks and stopping

Tier 2 (frontend codec/editor/UI state; no filesystem, IPC, native or packaging change, so no Tier 3 matrix and no second-filesystem run): focused `vitest` on the new file plus `editor-keys`, `editor-bridge`, `production-fountain`, `fountain-complex` and `WritingView`; then full `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `prettier --check`, `python3 tools/check-links.py`, `git diff --check`. Record the red-before/green-after run and any remaining refusing shapes in `docs/test-evidence/AUDIT.md`. All evidence is mocked/JSDOM; nothing here is native WebView verification. Update `docs/editor-behavior.md` for the changed Enter/split/emphasis behavior. Stop at this brief.
