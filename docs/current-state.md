# Current state — M3-09 native entry passed, M3-10 ready

Date: 2026-09-29 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [M3-09 evidence](test-evidence/M3.md#m3-09--native-sourcedestination-picker-and-recoverable-drafts).

## Task and work

**M3-09** was claimed on main from clean `4b555e1`, one editing agent, no prior dirty paths. Native-selected managed/loose open, immediate recoverable unsaved identity and session-bound destination tokens are implemented; TODO is checked with bounded evidence.

Three path-free commands (`create_unsaved_draft`, `open_source_via_picker`, `select_destination`) run picker/open/register/destination work on bounded blocking workers via `rfd` 0.17.2 (MIT, GTK3 backend). Strict envelopes reject injected paths. Cancellation returns null and preserves registrations/journals/tokens. Picked sources use unchanged M2-01 conservative open; destination tokens bind registration/session, fail closed on stale/foreign/revoked use, and die with release. Production setup initializes the writer store from OS app data only; failure leaves `nativeUnavailable`. No frontend fs/shell/dialog capability was added. [ADR 0024](decisions/0024-native-document-entry.md) owns the picker/dependency choice.

## Paths and checks

- `src-tauri/src/document_entry_host.rs`, `src-tauri/src/document_entry_ipc_tests.rs`, `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`, `Cargo.lock`; `src/application/documentEntry.ts`, `src/infrastructure/nativeDocumentEntry.ts`, `tests/contract/document-entry.test.ts`; docs: ADR 0024, architecture, development, requirements, index, M3 evidence.
- [Evidence](test-evidence/M3.md#m3-09--native-sourcedestination-picker-and-recoverable-drafts) owns exact commands/host/logs. Focused frontend (11), `pnpm check` (430 tests), browser smoke, Rust fmt/clippy, workspace 174, Btrfs entry 4, proof-feature 28, release build and capability audit passed. `git diff --check` clean.
- Default route, codec/oracles, Fountain fixture bytes stay unchanged. `Cargo.lock` regenerated for the two pinned adds. Trace touched only four M3-09 rows (`git diff -w` clean otherwise). No upload, source publication, global settings or privileged packages. Owned diagnostics are stopped.

## Blockers and next action

M3-08 full real IME/cancellation/S13 remains blocked as recorded; M3-12 still depends on accepted M3-08. M3-09 dialog display itself is headless-stubbed to cancel; the real-display picker drill belongs to M3-12, Save As to M3-11, other platforms and installed/offline/adoption to later gates.

**Next independently ready task: M3-10 recovery/source cadence and visible protection state.** Read [brief](tasks/M3-10.md), TODO dependency/read/acceptance and persistence contracts. M3-10 depends on M3-04, M3-09, M2-04, M2-05C.

M3-06 Space-opened picker automation remains unverified. M3-11 Save As, M3-12 production writing and M3-13 integrated safety remain open. Default desktop cannot create/open/edit/save a screenplay through UI yet. Tier 1, screenreader, touch, installed/offline, long-session/adoption and true power-loss/disk-full/physical-disk independence remain later gates. No Local v1 completion is claimed.

Stop this bounded task with honest open gates. Continue on main with task IDs in commits; never push without human review and explicit authorization.
