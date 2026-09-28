# Current state — M1-01 complete

Date: 2026-09-27 PDT. Application: **babel**; `screenwriter-core` remains the technical Rust crate name. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [M0 evidence](test-evidence/M0.md), [M1 evidence](test-evidence/M1.md).

## Active milestone and trust boundary

M0 is complete on the recorded host. **M1-01 is complete** on branch `M1-01-fountain-contract`; M1-02–05 remain open. No task is currently claimed after M1-01. The app remains a development skeleton, unsafe for important manuscripts: New/Open are disabled, and no production editor, save/recovery, PDF, history, or remote operation exists. The M1-01 codec is isolated under `prototypes/` and is not wired to the app.

## Completed work and touched paths

M1-01 added four original adversarial byte fixtures and their manifest (`fixtures/fountain/`), a disposable source-span codec (`prototypes/fountain/codec.ts`), focused tests (`tests/contract/fountain.test.ts`), ownership/exception [ADR 0007](decisions/0007-source-aware-fountain-contract.md), and [M1 evidence](test-evidence/M1.md). Updated `TODO.md`, `docs/index.md`, `docs/document-model.md`, `docs/requirements.md`, and `fixtures/README.md`. The source prototype proves exact no-op bytes and selected edits with semantic reparse; it rejects ambiguous neighboring changes and protects raw/invalid UTF-8 input. No production requirement is marked complete.

The repository has a prior initial commit and no remote. M0 shell, manifests, commands, ADRs, and the 41-ID trace remain described in [M0 evidence](test-evidence/M0.md) and [architecture](architecture.md). No commit/push was made for M1-01.

## Exact verification and blockers

- Passed on Omarchy 4.0.4/Linux x86_64, 2026-09-27 PDT: `pnpm test -- tests/contract/fountain.test.ts` (2 files, 13 tests); `pnpm typecheck`; `pnpm check` (format, lint, typecheck, 13 tests, Vite build); `sha256sum fixtures/fountain/*.fountain`; `file fixtures/fountain/*.fountain`; `git diff --check`. Exact outcomes, fixture hashes, and the corrected initial lint failure are in [M1 evidence](test-evidence/M1.md).
- Native editor, installed app, and other OS checks were not part of M1-01. No task blocker remains. Full grammar conformance, structured note/title edits, hard breaks, caret/IME/undo, and production saving remain follow-on gates, not claimed by this proof.

## Next safe action

Start **M1-02 Native editor input proof** on its own branch after reading SPEC S07/S13–S15 and the editor/testing contracts. Record native WebView selection, composition, undo, paste, caret, and latency evidence on synthetic text. M1-03 and M1-04 are also dependency-ready bounded tasks if priority changes.
