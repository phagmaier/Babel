# Current state — M3-10 cadence passed, M3-11 ready

Date: 2026-09-29 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [M3-10 evidence](test-evidence/M3.md#m3-10--recoverysource-cadence-and-visible-protection-state).

## Task and work

**M3-10** was claimed on main from clean `14a0aaf`, one editing agent, no prior dirty paths. Bounded recovery/source cadence, explicit Save flush, rolling snapshot triggers and visible protection state are implemented; TODO is checked with bounded evidence.

`SaveCadence` wraps the serial persistence controller with an injectable clock: ~500 ms recovery coalescing, ~750 ms source debounce, 2 s maximum dirty delay, timer-bypassing explicit flush with fresh native verification even when unchanged. Failed dispatches never re-arm; snapshot/copy errors set a separate attention flag. `SaveStatus` renders live/recovery/file-saved versions literally. No editor wiring, Save As, dependency, capability or SPEC change.

## Paths and checks

- `src/application/saveCadence.ts`, `src/app/SaveStatus.tsx`, `tests/contract/save-cadence.test.ts`, `tests/ui/SaveStatus.test.tsx`, `src-tauri/src/persistence_cadence_tests.rs`, `src-tauri/src/lib.rs`; docs: persistence, development, requirements, index, M3 evidence.
- [Evidence](test-evidence/M3.md#m3-10--recoverysource-cadence-and-visible-protection-state) owns exact commands/host/logs. Focused (33), `pnpm check` (443 tests), browser smoke, Rust fmt/clippy, workspace 175, proof-feature 29, release build passed. Native tmpfs/Btrfs latency: checkpoint p95 3.0/9.5 ms, save p95 8.2/220.8 ms — inside S10.3 targets. `git diff --check` clean.
- Codec/oracles, fixture bytes, default route, manifests/locks, capabilities stay unchanged. Trace touched only five M3-10 rows (`git diff -w` clean otherwise). No upload, source publication, global settings or privileged packages. Owned diagnostics are stopped.

## Blockers and next action

M3-08 full real IME/cancellation/S13 remains blocked as recorded; M3-12 still depends on accepted M3-08. Scheduler/editor integration, Save As switching and close wiring remain M3-11/12; other platforms, installed/offline, long sessions and full S13 paint remain open.

**Next ready task: M3-11 native Save As identity and publication.** Read [brief](tasks/M3-11.md), TODO dependency/read/acceptance and identity/publication contracts. M3-11 depends on M3-09, M3-10.

M3-06 Space-opened picker automation remains unverified. M3-12 production writing and M3-13 integrated safety remain open. Default desktop cannot create/open/edit/save a screenplay through UI yet. Tier 1, screenreader, touch, true power-loss/disk-full/physical-disk independence remain later gates. No Local v1 completion is claimed.

Stop this bounded task with honest open gates. Continue on main with task IDs in commits; never push without human review and explicit authorization.
