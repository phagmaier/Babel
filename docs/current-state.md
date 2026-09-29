# Current state — M3-03 complex codec passed

Date: 2026-09-28 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [M3 evidence](test-evidence/M3.md#m3-03--complex-fountain-regions-and-inline-semantics).

## Completed task and trust boundary

**M3-03 Complex Fountain regions and inline semantics** passed bounded production-domain acceptance on main. Single editing agent; base `7ee05a5`, clean starting tree/no prior dirty paths. [Model contract](document-model.md#m3-03-complex-source-structures-and-editing) owns the immutable structures, context APIs, rich semantics, retained-original proposal lifecycle and refusal/copy routes.

Ordered unknown/duplicate title fields and continuations, hidden body/wrapper spans, complete dual groups, inline styles/literals and physical action/dialogue breaks extend the same codec. Edits own complete context, reparse requested semantics and protect undeclared neighbors. Proposals retain full original/candidate byte copies and require explicit acceptance against the original snapshot; stale/fabricated candidates refuse. Invalid UTF-8 remains read-only; ambiguous/unclosed/raw content remains protected until a safe explicit conversion. Mixed visible/hidden rows stay raw with targeted hidden-body editing. Recovery schema and native byte contracts are unchanged.

The latest implemented native milestone remains the [M2 headless Linux exit](test-evidence/M2.md#m2-06--small-history-primitives-and-safety-gate). The default desktop still cannot create/open/edit/save a screenplay. Production editor, picker, cadence, Save As and Local v1 adoption remain open.

## Paths and checks

- Extended src/domain/{fountainModel.ts,fountainCodec.ts}; new fountainInline.ts, fountainStructure.ts and fountainSyntax.ts. Added tests/contract/fountain-complex.test.ts, tests/tooling/fountain-complex-compare.ts and fixtures/expected/m3-complex.json. Updated owning contracts, ADR 0007 evidence, TODO/affected DOC trace/index/state and M3 evidence.
- [M3-03 evidence](test-evidence/M3.md#m3-03--complex-fountain-regions-and-inline-semantics) owns exact commands, host, counts/logs and limitations. Focused complex/primary tests, actual pinned renderer comparison, shared frontend checks, browser shell smoke, Rust regressions and release desktop no-bundle build passed. Final fixture/link/trace/format/diff checks are recorded there.
- Eight independently authored complex cases retain complete original/edited literals. All 35 tracked Fountain files, original oracles/proofs/primary tests and native/config/SPEC paths remain unchanged. No dependency, runtime network/capability or native format change. Pure codec changes need no second filesystem run; new native/UI authoring was not verified.

## Limits and next action

**Next ready task: M3-04 Sole editor authority and source bridge.** Read its TODO entry and source/editor/persistence contracts, ADRs 0003/0007/0008/0015 and the bounded M1-06 proof. Build one live EditorState with versioned immutable captures, source/caret anchors, raw-region preservation, undo/version rules and stale-capture protection. Production imports must not use proof code. M3-09 is also dependency-ready; other tasks wait for predecessors.

Renderer sharing is a declared subset: trimming, hidden presentation omission, special literal escapes, two-space speech shape and raw content retain source oracles/explicit gaps. Physical breaks do not certify editor Shift+Enter/caret behavior; unrepresentable style/break/grammar states retain exact-copy refusal. No production undo, native input or full PDF acceptance follows from codec tests.

M3-08 requires real IME/composition-to-Enter evidence; M3-11 owns Save As identity/publication choices; M3-13 requires default-app native writing/recovery/failure review. M4 daily workflows/title-page form, M5 PDF and M6 history UX/configured backup/installed-offline/migration/owner pilot remain separate gates. Declare Tier 1 targets before M6. Git power-loss durability, actual disk full, physical-disk independence and other OS adapters remain unverified.

Stop after M3-03. Continue on main with task IDs in commits; never push without human review and explicit authorization.
