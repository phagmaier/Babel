# AUDIT-SIMP-F — Share frontend guards and native drill dispatch

Status: **complete**. Base `ef0ff02`, clean main, 2026-10-03.
Dependencies: AUDIT-SIMP-N complete; Wave 3 approved in TODO.
Requirements: QA-01, INV-03/05/07; original editor/native safety contracts.

## Scope and acceptance

- [X-04](../../AUDIT.md#x-04--writingview-duplicated-cleanup-operation-lock-scroll-after-commit-toolbar-buttons-low-sm): hoist the duplicated effect cleanup, preserving listener stop order and late subscription cleanup. Share the identical throwing operation lock/finally in snapshot restore, recovery and interrupted-save resolution. Keep run/open guards, busy/error handling and refresh timing local. Optional scroll/toolbar/refs changes excluded.
- [X-06](../../AUDIT.md#x-06--the-stale-result-stamp-check-is-hand-written-at-22-sites-low-s): sameStamp in application/manuscriptProjection and stampOf/isCurrent in editor/state. isCurrent checks doc before touching production origin. Replace full triple guards and six hand-built stamps; deliberately partial checks and all extra guards stay local. Preserve dependency direction, identity comparison, selection-only version refusal and async result disposal.
- [X-08](../../AUDIT.md#x-08--document-error-codes-kept-in-three-hand-written-lists-low-s): DOCUMENT_ERROR_CODES const, derived union, persistence runtime allow-list import, exportNeedsAttention. Add independent Rust/TS parity and known/unknown structured-error coverage. Unknown transport text still fails closed; no message/protocol changes.
- [X-07](../../AUDIT.md#x-07--native-drill-dispatch-is-21-identical-branches-low-s): migrate the current uniform branches into ordered MODES groups with one dispatcher; preserve exact first-match priority across the four special branches (two-instance flags/shared_data, presentation arguments, audit-fixes fall-through, editor-exit fall-through). Each migrated mode receives a native rerun. Existing assertions, driver startup/owned input/cleanup/crash attribution stay unchanged.

## Tests first and checks

Record red focused helper/parity tests before production edits and a structural/
frozen-byte boundary check. Cover all stamp components, foreign doc short-circuit,
selection-only versions and raw-state refusal; preserve every existing test oracle.
Use AST-extracted dispatch tests without importing/spawning drill: all uniform
entries, lazy imports, no-match/default, competing flags and special ordering.

Tier 2: focused contracts/UI, pnpm check, Rust fmt/Clippy/workspace (one filesystem),
browser, Python lint/dispatch tests. Native default embedded release build and
sequential migrated-mode reruns with owned-process/crash audit; native IME modes
need the existing verified isolated prefix, never personal configuration. Record
missing prerequisites/failures and continue independent checks. Native modes idle
with builds/shared tests; no filesystem algorithm or IPC change, so no second
filesystem matrix. Check frozen audit/fixtures/pins/native runner assertions and
unchanged Rust bytes, local links and git diff --check. Evidence:
[Audit](../test-evidence/AUDIT.md), one labeled line per check.

## Do NOT do / stopping point

[Frozen exclusions](../../AUDIT.md#dropped-or-refuted): no DEV-03 fold-back, refs
redesign, publication declaration move, native helper sharing, save_worker or
write_verified. No D-06/design/owner decisions, dependencies, persistence/native
command changes, weakened assertions, modified prior evidence/failure roots/cores,
IME installation/global settings or crash/admission closure. Stop after this
bounded task and local commit on main; no push. SELinux, C1/F2, M6-02 and Local v1
remain open. D-06 is a later separate brief.

## Result

Accepted cleanup/three locks, 22 full stamp guards/six constructions, 31-code
constant/parity and 22 current uniform modes delivered; special/partial guards
and original oracles intact. [Evidence](../test-evidence/AUDIT.md#audit-simp-f--frontend-guard-and-native-dispatch-simplification):
frontend 867/867, focused 64/64, Rust 264/264; build/browser/static/AST/artifact
audits pass. Native all 22 rerun: selected 21/22 successful, commands/F6 failure
reproduces on frozen ef0ff02 control. Initial daily assessment failure retained;
baseline/fresh candidate passes do not establish its cause. Title inspection uses
forced teardown, separate from ordinary-close checks. No weakened assertions,
no full native/admission claim; stopped before further DESIGN/D-06, no push.
