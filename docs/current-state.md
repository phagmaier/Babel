# Current state — M4-04 complete

Date: 2026-09-30 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [index](index.md).

## Task and work

**M4-04 complete — bounded Linux exact-version workflow protection primitive.** One editing agent on main from `29fd152`, initially clean; no prior dirty paths or push authorized. Dependencies were satisfied. M4-01–03 and the corrected bounded M3 gate remain complete.

Delivered strict native `protect_workflow`: closed Fountain import/scene move/section move operations and existing checkpoint envelope, fixed native label/profile, owned checkpoint plus checked safety-ref publication, operation/length/session/version/hash-bound receipt. Legacy import delegates to the same storage/worker machinery. No source parsing, replacement, new filesystem authority or dependency.

The writing session freezes input/selection, pauses/settles persistence, captures and validates the receipt, then rechecks active coordinator, immutable editor state (document/selection), version, composition and cancellation immediately before a separately owned synchronous transaction. Cancellation/refusal/uncapturable source cannot apply it; completed native checkpoints/refs remain. Ordinary Save, recovery and emergency copy stay independent. Thaw restores timers and original dirty age; overdue work dispatches immediately. Production import exercises the shared guard with a visible cancel control, retained staged text and one-step exact-source Undo. Large moves are defined at 50 physical rows OR 16,384 source bytes inclusive; no moves enabled yet.

Changed paths: core `history.rs`/`history_store.rs` and tests; desktop worker/registration/strict IPC tests; `workflowProtection.ts`, native adapter, writingSession/cadence/WritingView/App/import panel integration; focused session/UI/cadence tests and native workflow mode. [ADR 0030](decisions/0030-version-bound-workflow-protection.md) and owning contracts/task/trace/evidence updated. SPEC, dependencies/locks, fixtures, capabilities and packaging config remain unchanged.

## Verification

[M4-04 evidence](test-evidence/M4.md#m4-04--version-bound-workflow-protection) owns exact commands/host/logs/artifacts/failures/limits. Focused frontend checks passed 89 tests; shared formatting/lint/typecheck/build and 553 frontend tests/39 files passed. Browser smoke and Rust format/lint passed; 226 workspace tests passed on each tmpfs/Btrfs matrix. Native history tests cover exact operations/labels/bytes/refs, stale/forged/conflicting/session rejection, history failure and independent Save; explicit object/main/safety publication interruption and restart review-barrier tests pass; existing lease coverage remains green. Strict MockRuntime envelopes operate real disposable stores, distinct from WebView verification.

Default embedded WebKit/GTK workflow drill passed both filesystems: trusted cancellation while frozen, checkpoint and independently read safety bytes, retry/import/Undo, corrupt-history refusal with retained staging/source, later ordinary Save and uncapturable accepted split-draft refusal/Undo. Existing default native lifecycle/fault/owned-kill/restart/recovery/divergence/blocked-close/emergency-copy drill passed both. Repeated recovery-comparison waits timed out in shared runs, including idle. The concurrency test now counts the same exact `h2` text through a scoped query; overlap rejection, expected counts and the one-second timeout are unchanged. Final shared checks pass. Earlier fixture/harness/cadence failures remain recorded.

## Remaining concerns and next action

**Next: [M4-05 reversible scene/section moves](tasks/M4-05.md).** Consume the versioned attachment/intact-range projection, define exact plans/previews, apply one Undo transaction with drag/keyboard parity and the M4-04 guard for large moves. M4-06/11 are also ready; proceed sequentially. M4-05–15 remain open; M4-15 still needs every task and separate safety review. No full M4 or Local v1 claim.

Large-source opening/later capture/persistence stalls, full compositor/page/long-session performance, C1 WebKit child heap abort and RustSec GLib/dependency hardening remain tracked for M6. Other platforms/filesystems, disk-full/hardware power loss, installed/offline packaging, backup/migration and owner adoption remain open. M5 owns production renderer/fonts/PDF; M6 owns history timeline/scheduling, M7 remote transfer. Completion uses a local main commit; no push, publication or milestone tag.
