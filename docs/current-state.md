# Current state — M3-01 corpus/proof comparison passed

Date: 2026-09-28 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [M3-01 evidence](test-evidence/M3.md#m3-01--independent-conformance-corpus-and-oracle).

## Completed task and trust boundary

**M3-01 Independent conformance corpus and oracle** passed its bounded test-tool acceptance on main. One editing agent, base `2700f25`, clean starting tree/no prior dirty paths. The [oracle guide](../fixtures/expected/README.md) defines 12 original synthetic cases, nine complete edited-byte oracles and explicit semantic/renderer expectations. Existing invalid UTF-8 remains a literal hex/hash oracle. All 14 previously tracked Fountain files are unchanged.

The [harness](../prototypes/fountain-conformance/README.md) checks the unchanged M1 codec against literal bytes/ordered line semantics, then compares pinned Screenplain AST/actual bare HTML with independent expectations. Shared semantics are directly compared only for the declared supported subset. Named whitespace/title/hidden/lyric/raw/mark/drafting gaps remain visible and never authorize source loss. The single agent separately checked oracle content against official syntax; no second-reviewer claim is made.

The latest implemented native milestone remains the [M2 headless Linux exit](test-evidence/M2.md#m2-06--small-history-primitives-and-safety-gate). No production parser/editor, native writer, capability, dependency/lockfile or SPEC changed. The default desktop still cannot create/open/edit/save a screenplay. Production editor, picker, cadence, Save As and Local v1 adoption remain open.

## Paths and checks

- New: fixtures/fountain/m3-*.fountain, fixtures/expected/{m3-conformance.json,README.md}, prototypes/fountain-conformance/, tests/contract/fountain-conformance.test.ts. Updated fixture guides, model/development/testing contracts, TODO/trace/index/state and M3 evidence. Unrelated trace rows retained byte-for-byte.
- [M3-01 evidence](test-evidence/M3.md#m3-01--independent-conformance-corpus-and-oracle) owns exact commands, host, logs/counts and closing diff results. Focused and shared frontend, independent renderer, browser shell and Rust workspace regressions passed. Native editor/picker/save/installed-package acceptance was not run. Pure codec/oracle changes need no second filesystem run.
- Full staged Git whitespace review reported only intentional Fountain spaces/CRLF; preserve the declared bytes and review against the literal/hash oracles. Executable/docs/JSON whitespace checks passed; the full fixture diagnostics were checked against literal/hash oracles. Exact results belong in M3 evidence. No check or global setting is disabled.

## Limits and next action

**Next ready task: M3-02 Production source-aware codec foundation.** Read its TODO entry, SPEC S05–S06, document-model/ADR 0007 and the new corpus/oracle guide. Implement the immutable domain/codec independently of React/filesystem and connect production assertions to the existing expectations; do not regenerate or relax them from implementation output. Incomplete/raw and complex-region limitations remain explicit until their owning M3-02/03 tasks pass. M3-09 is also dependency-ready; other tasks wait for predecessors.

M3-08 still requires real IME/composition-to-Enter evidence; M3-11 owns Save As identity/publication choices; M3-13 requires default-app native writing/recovery/failure review. M4 daily workflows/title-page form, M5 PDF and M6 history UX/configured backup/installed-offline/migration/owner pilot remain separate gates. Declare Tier 1 targets before M6. Git power-loss durability, actual disk full, physical-disk independence and other OS adapters remain unverified.

Stop after M3-01; production codec implementation has not begun. Continue on main with task IDs in commits; never push without human review and explicit authorization.
