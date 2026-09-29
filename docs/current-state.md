# Current state — R1 accepted; M1-06 claimed

Date: 2026-09-28 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [M2 review](reviews/2026-09-28-m2-05b-review.md), [R1 evidence](test-evidence/M2.md#m2-05b-r1--correct-finalize-durability-and-relink-ownership).

## Active task and trust boundary

**M1-06 is claimed by the single editing agent on main; implementation has not started.** The owner explicitly answered “Accept R1; claim M1-06” for the corrections at `5e8487971710f3f4774eb491bf0d9707fcfebe00`. [Owner acceptance](test-evidence/M2.md#r1-owner-acceptance-and-m1-06-claim) closes M2-05B acceptance and satisfies the proof's writer dependency. M0, bounded M1-01–05 and M2-01–04/05A retain their recorded completion. Parent M2-05/full M2 exit remain open.

Deliverable: the [M1-06 proof plan](editor-composition-proof.md) bounds one synthetic native open → typed-node edit/selection/undo → safe save → reopen investigation to one working day and one reference host. Owned implementation paths: `prototypes/editor-composition/` and its synthetic fixtures, `tests/contract/editor-composition.test.ts`, proof-only `src-tauri/src/editor_composition_proof.rs`, `src-tauri/tauri.editor-composition-proof.conf.json`, narrowly gated registration in `src-tauri/src/lib.rs`/`src-tauri/Cargo.toml`, and proof script/pinned dev dependencies only if needed. Coordinator owns shared task/trace/state/evidence. Production M3 remains gated by full M2 exit/decomposition.

The product remains a disabled writing shell with read-only startup recovery inspection. Native choice APIs and the reusable panel exist, but the production picker/writer is uninitialized. Editing, source-save/reopen UI, Save As, retention/protected close, history and remote operations remain unavailable. **Do not use important manuscripts.**

## Completed acceptance handoff

- R1 finishes source file/directory durability with revalidation before a finalize receipt and verifies exclusive caller ownership/held leases before relink mutation. The owner accepted the committed corrections with their recorded coverage and limits; this handoff is not a new independent correction review.
- Starting baseline: main at `5e8487971710f3f4774eb491bf0d9707fcfebe00`, clean tree, no prior dirty paths.
- This task changes documentation only: TODO; current-state/index/requirements; architecture/persistence/testing status notes; proof plan; M2 review acceptance addendum; M2 evidence acceptance/check section. No implementation, fixture, capability, dependency or contract change.

## Verification and limitations

[R1 evidence](test-evidence/M2.md#m2-05b-r1--correct-finalize-durability-and-relink-ownership) owns the historical native tmpfs/Btrfs, MockRuntime, frontend, build and regression results. No application checks were rerun for this documentation handoff. Exact documentation checks, host and outcomes are in the [acceptance record](test-evidence/M2.md#r1-owner-acceptance-and-m1-06-claim).

Same-disk copies are not disaster backups; arbitrary external writers can still race advisory checks. Power loss, other platforms, installed-package adoption, full WebView save/reopen and codec/editor/native composition remain unverified. No Local v1 completion is claimed.

## Next safe action

Begin M1-06 in a subsequent implementation session from the accepted writer baseline, using the proof plan's targeted Read list, synthetic destinations and acceptance gates. Keep real native and mocked evidence distinct; stop at the bounded investigation's reviewed conclusion or actionable blocker.

**Do not start M2-05C.** The owner excluded it from this task, and it still depends on M1-06's reviewed bounded conclusion. Work on main with task IDs in commit messages. Do not push without human review and explicit authorization.
