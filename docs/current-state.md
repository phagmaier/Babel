# Current state — M3-11 Save As passed, M3-12 ready pending M3-08

Date: 2026-09-29 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [M3-11 evidence](test-evidence/M3.md#m3-11--native-save-as-identity-and-publication).

## Task and work

**M3-11** was claimed on main from clean `4ad91dc`, one editing agent, no prior dirty paths. Native Save As identity and publication are implemented; TODO is checked with bounded evidence.

Save As publishes caller bytes to a natively selected file and mints a fresh loose registration beside the untouched source; adopting the new identity stays an explicit M3-12 step. Exclusive temp write, exclusive rename (existing destinations fail closed), fresh identity records, single-use session-bound tokens, managed-adoption refusal, no remote linkage, distinct crash orphans. [ADR 0025](decisions/0025-save-as-identity.md) owns the choice. No new dependency, capability or SPEC change.

## Paths and checks

- `crates/screenwriter-core/src/documents/save_as.rs`, `save_as_store.rs`, `save_as_store_tests.rs`, `linux.rs`, `mod.rs`; `src-tauri/src/save_as_host.rs`, `save_as_ipc_tests.rs`, `lib.rs`; `src/application/saveAs.ts`, `src/infrastructure/nativeSaveAs.ts`, `tests/contract/save-as.test.ts`; docs: ADR 0025, development, requirements, index, M3 evidence.
- [Evidence](test-evidence/M3.md#m3-11--native-save-as-identity-and-publication) owns exact commands/host/logs. Focused (9), `pnpm check` (446 tests), browser smoke, Rust fmt/clippy, workspace 188, core-Btrfs 10, ipc-Btrfs 3, proof-feature 32, release build passed. SIGKILL barrier drill passed on tmpfs/Btrfs. `git diff --check` clean.
- Codec/oracles, fixture bytes, default route, manifests/locks, capabilities stay unchanged. Trace touched only M3-11 rows (`git diff -w` clean otherwise). No upload, source publication, global settings or privileged packages. Owned diagnostics are stopped.

## Blockers and next action

M3-08 full real IME/cancellation/S13 remains blocked as recorded; **M3-12 still depends on accepted M3-08.** Identity switching, close wiring, managed-project authoring, other platforms, installed/offline, remote transfer and power-loss hardware claims remain later gates.

**Next task: M3-12 production writing lifecycle and failure UI** (ready except the M3-08 dependency). Read [brief](tasks/M3-12.md), TODO dependency/read/acceptance and lifecycle contracts. M3-12 depends on M3-08, M3-10, M3-11, M2-05D.

M3-06 Space-opened picker automation remains unverified. M3-13 integrated safety remains open. Default desktop cannot create/open/edit/save a screenplay through UI yet. Tier 1, screenreader, touch, long-session and true disk-full/physical-disk independence remain later gates. No Local v1 completion is claimed.

Stop this bounded task with honest open gates. Continue on main with task IDs in commits; never push without human review and explicit authorization.
