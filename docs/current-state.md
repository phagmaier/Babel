# Current state — M3-00 decomposition complete

Date: 2026-09-28 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [M3-00 evidence](test-evidence/M3.md#m3-00--decomposition).

## Completed task and trust boundary

**M3-00: docs-only decomposition**, one editing agent on main. Base `2a43954`; clean starting tree and no prior dirty paths. [TODO](../TODO.md) now defines M3-01–13: independent conformance, primary/complex codec, sole editor bridge, keys/undo, picker/remapping, completion, paste/IME, native file selection/drafts, cadence/status, native Save As, production lifecycle and the separate M3 safety review. [Requirement coverage](requirements.md#m3-decomposition-coverage-planned) maps each core requirement and save/security/measurement integration to these tasks. All implementation tasks remain open.

The [M2-06 headless Linux exit](test-evidence/M2.md#m2-06--small-history-primitives-and-safety-gate) remains the latest implemented milestone. M1-06 demonstrates only its declared composition subset. The default desktop still cannot create/open/edit/save a screenplay. Production editor, picker, cadence, Save As and Local v1 adoption remain open; this task adds no runtime behavior or dependency.

## Paths and checks

- Changed: TODO.md, docs/{requirements.md,index.md,current-state.md,test-evidence/M3.md}. No source, fixture bytes, SPEC, ADR or executable configuration changed. Unaffected requirement rows retained byte-for-byte.
- [M3-00 evidence](test-evidence/M3.md#m3-00--decomposition) owns exact documentation check commands, host and outcomes. Formatting, task/requirement/dependency and changed local-link/anchor audit, and diff checks passed. Code/native/renderer checks are not run for this docs-only task.

## Limits and next action

**Next ready task: M3-01 Independent conformance corpus and oracle.** Read its TODO entry, SPEC S05–S06/S15.3, document-model contract, ADR 0007, fixture guide and the linked M1 codec/PDF/composition proof limits. Establish independently reviewed byte/semantic expectations and a renderer-supported comparison before implementing the production codec. M3-09 is independently dependency-ready, but the single-editor sequence begins with M3-01; other tasks wait for their listed predecessors.

M3-08 must verify a real IME, including the composition-to-Enter boundary; dead-key evidence alone cannot close it. M3-11 must resolve lasting Save As identity/publication choices with an ADR when implemented. M3-13 requires actual default-app native writing, recovery and failure evidence. M4 workflows, M5 PDF and M6 history UX/configured backup/installed-offline/migration/owner pilot remain separate gates; Tier 1 targets are required before M6 implementation. Git power-loss durability, actual disk full, physical-disk independence and other OS adapters remain unverified.

Stop after M3-00 decomposition; no M3 implementation started. Continue on main with task IDs in commits; never push without human review and explicit authorization.
