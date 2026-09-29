# Current state — M3-02 codec foundation passed

Date: 2026-09-28 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [M3-02 evidence](test-evidence/M3.md#m3-02--production-source-aware-codec-foundation).

## Completed task and trust boundary

**M3-02 Production source-aware codec foundation** passed its bounded domain acceptance on main. Single editing agent, base `628c50b`, clean starting tree/no prior dirty paths. [Model/codec contract](document-model.md#m3-02-production-codec-foundation) owns the immutable API, primary element fields, grammar-context edits, ID/newline policies and recovery/refusal limits.

The domain parser/serializer is independent of React/filesystem/proofs. Private exact bytes, frozen line spans/fields and owned byte copies protect snapshot authority. Atomic declared-context replacements/insertion/deletion reparse requested types/fields and refuse unintended neighboring grammar or speech/dual relationship changes. Shot and empty/incomplete drafting intent remain recovery metadata; exact-matching recovery restores them. Newly authored partial parentheses can continue/complete; imported malformed regions remain protected. IDs survive ordinary edits/range shifts and deleted IDs are not reused; no Fountain IDs are injected.

The unchanged [M3-01 independent oracles](../fixtures/expected/README.md) verify every byte/span and complete before/after line semantics. Invalid UTF-8 stays read-only. Raw/title/hidden conversion, dual-group transformations, editable inline marks/hard breaks and complete title structure remain M3-03. Empty unterminated EOF placeholders have a documented refusal/exact-copy route; selection, moves and production undo are later editor gates.

The latest implemented native milestone remains the [M2 headless Linux exit](test-evidence/M2.md#m2-06--small-history-primitives-and-safety-gate). The default desktop still cannot create/open/edit/save a screenplay. Production editor, picker, cadence, Save As and Local v1 adoption remain open.

## Paths and checks

- New: src/domain/{fountainModel.ts,fountainCodec.ts}, tests/contract/production-fountain.test.ts. Updated document-model/development/testing contracts, TODO/affected DOC trace/index/state and M3 evidence. No SPEC/native/capability/dependency/lockfile/proof/oracle/fixture change; unrelated trace rows preserved.
- [M3-02 evidence](test-evidence/M3.md#m3-02--production-source-aware-codec-foundation) owns exact commands, host, counts/logs and limitations. Focused codec and shared frontend tests, format/lint/typecheck, browser shell smoke, Rust workspace regressions and release desktop no-bundle build passed. Pure codec changes need no second filesystem run. Native editor/picker/writing/IME/Save As and installed-package acceptance were not run.
- All 35 tracked Fountain files and original literal/hash oracles remain byte-identical. Task documentation links acceptance evidence instead of repeating command tables. Final formatting/local-link/trace/diff verification is recorded in M3 evidence.

## Limits and next action

**Next ready task: M3-03 Complex Fountain regions and inline semantics.** Read its TODO entry, SPEC S05.4–S06/S07.7, document-model/ADR 0007 and the M3-01 coverage matrix. Extend the production codec with title-page structure, explicit dual groups, hidden regions, inline marks/literals and hard-break behavior. Preserve/refuse uncertain conversions with original copies; do not regenerate or relax the independent oracles. M3-09 is also dependency-ready; other tasks wait for predecessors.

M3-08 still requires real IME/composition-to-Enter evidence; M3-11 owns Save As identity/publication choices; M3-13 requires default-app native writing/recovery/failure review. M4 daily workflows/title-page form, M5 PDF and M6 history UX/configured backup/installed-offline/migration/owner pilot remain separate gates. Declare Tier 1 targets before M6. Git power-loss durability, actual disk full, physical-disk independence and other OS adapters remain unverified.

Stop after M3-02. Continue on main with task IDs in commits; never push without human review and explicit authorization.
