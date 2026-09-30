# Current state — M4-05 complete

Date: 2026-09-30 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [index](index.md).

## Task and work

**M4-05 complete — bounded Linux reversible scene/section moves.** One editing agent on main from `1efd74c`, initially clean. Dependencies M4-03/04 satisfied. Concurrent owner/other-process edits appeared in `AGENTS.md`, `TODO.md` (M3 summary) and `docs/index.md` (milestone history); preserved, excluded from this task's commit, with a snapshot in `/tmp/babel-m4-05-concurrent-docs.patch`. No push authorized.

Delivered codec-document-branded exact-byte move plans, intact-range/attachment previews, complete original/candidate review copies and explicit boundary refusal. Scenes stop before every heading; synopsis/notes/blanks keep literal preceding ownership and ambiguity shows moves/stays. Sections carry whole nested subtrees beside same-parent/same-level sections; scenes can transfer beside another section's scene. BOM/endings/EOF/whitespace/unknown content are never normalized. Boundary meaning changes or unterminated-EOF row joins refuse.

Editor plans bind the immutable state/session/version, verify capture before Apply and rebase origin through a specifically authorized one-step Undo transaction. IDs, marks, complete protected regions, source-dependent metadata and earlier history remain correct; a wholly contained selection follows the moved rows, otherwise the caret follows the heading. Native large-move protection freezes dispatch with cancellation, exact operation receipts and failure isolation. Save stays independent. Changed observers invalidate outline/completion and future diagnostics.

Outline pointer handles and keyboard up/down/destination controls share the plan/preview. Native HTML drags failed to deliver drop on this host, so handles use owned pointer capture with threshold/cancel/same-panel hit tests; stale/read-only/composing/foreign actions remain inert. Native test helper gains an optional compositor drag while preserving old click mode. No new native service, dependency, source format, capability or packaging change. [ADR 0031](decisions/0031-exact-source-outline-moves.md) owns choices; subsystem contracts/task/trace/evidence updated.

Changed paths: `src/domain/sceneMoves.ts`, index branding; editor scene-move/state/view integration; Outline/MovePreview/WritingView/CSS; contract/UI tests; native scene drill/pointer helper; task/status/contracts/ADR/trace/evidence. SPEC, fixtures, dependency locks and native Rust storage engines remain unchanged.

## Verification

[M4-05 evidence](test-evidence/M4.md#m4-05--reversible-scene-and-section-moves) owns exact commands/host/logs/artifacts/failures/limits. Focused tests passed 40; shared formatting/lint/typecheck/build and 570 frontend tests/40 files passed; browser smoke, Rust format/lint and 226 workspace tests per tmpfs/Btrfs passed. Default embedded release built. Both-filesystem native trusted keyboard/compositor drag, backward selection, exact Save/Undo/reopen, inclusive large-scene/section safety bytes, history-failure refusal/independent Save and EOF review copies passed. Independent Git label/byte audits and app-only screenshots retained. Earlier oracle/mock/geometry/build/HTML-drag/recovery/settlement harness failures are recorded honestly. Final docs/link/diff checks are linked there.

## Remaining concerns and next action

**Next: [M4-06 source-preserving title-page form](tasks/M4-06.md).** M4-06/11 are ready; proceed sequentially. M4-06–15 remain open; M4-15 still requires every task and separate safety review. No full M4 or Local v1 claim.

Large-source/capture/persistence stalls, full compositor/page/long-session performance, C1 WebKit/dependency hardening, other platforms/filesystems, actual disk-full/hardware power loss, installed/offline packaging, backup/migration and owner adoption remain open. M5 owns renderer/fonts/PDF; M6 history/scheduling; M7 remote transfer. Completion uses a local main commit, preserving concurrent doc edits; no push/publication/milestone tag.
