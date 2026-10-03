# Current state — M5 complete, DEV-03 complete

Date: 2026-10-02. Application: **babel**. Admission `bfdbdbb` on main.
Work directly on main; no push. M5-07 remains complete at `bfdbdbb`.

## Task and work

**DEV-02 Second-machine smoothness — tooling slice claimed.** One-command
`tools/bootstrap.sh`, `tools/doctor.sh` (pin agreement), `tools/check-host.sh`
(native prerequisites, Arch/Ubuntu hints), `tools/clean.sh` (dry-run prune of
regenerable `target/` roots, cache never touched), plus `VITEST_WORKERS`,
`CARGO_TARGET_DIR`-aware `build.rs` placeholder and `.env.example`.
Follow-up sweep replaced 41 hardcoded `/home/phagmaier/Code/...` paths in
live docs with `$PWD`; evidence logs keep their originals. Retention policy
decided and executed: 162 unreferenced run roots pruned (`target/` 31 →
30 GiB), docs-named evidence kept; two `clean.sh` robustness bugs found and
fixed by the first real `--apply`. Workspace exclusion rejected by
measurement (proofs cost 5.3 s; exclusion breaks more than it saves);
`src/` duplicates audited as clean per-layer splits, no code changed.
Python lint gate added (`tools/lint-py.sh`, 75 files green); harness
repackaging deferred until after M6-00.

**DEV-03 WritingView decomposition — complete, slices 1–9 landed.**
Helpers and find/check/spelling/title/move/outline/palette/publication sessions
are extracted; `WritingView.tsx` 2,483 → 1,939 lines. Slice 8 (`4e18c58`)
moved palette navigation; slice 9 moves preview/export state/refs and
focus/open/close/dismiss bodies to `src/app/publicationSession.ts`
(`usePublicationSession`). Original no-deps focus-effect registration stays
in place and calls the moved body synchronously; effect order, M5-07 toolbar
wait/newer-focus refusal and stable lifecycle handles remain exact.
Controllers/lifecycle/dispatch/protection/JSX stay composed. No behavior change.
Slice 9 strict TypeScript, focused 82/82 (both M5-07 focus regressions), full
772/772, shared frontend/Rust and final formatting/link/diff checks pass.
Fresh-release native `--publication-preview` and `--pdf-export` pass on tmpfs,
including the held-real-Save-receipt focus race, exact bytes and refusal/
cancellation paths. Ordinary close completed before stale-session deletion
in both; no matching driver crash/error lines and no blocked sections.
Helper tree unchanged (`c805d6…`); existing M6 performance limits remain.
Commands/timings, paths and omissions: [brief](tasks/DEV-03.md),
[evidence](test-evidence/M5.md#dev-03--writingview-decomposition-slice-9).
DEV-02 tooling is landed; second-host acceptance is owner-only.
[DEV-02 brief](tasks/DEV-02.md),
[evidence](test-evidence/M5.md#dev-02--second-machine-smoothness-tooling-slice).

**M5-07 Integrated publication exit and separate review — complete, bounded
Linux gate.** The integrated native scenario compares preview/export from the
same protected version: source/profile/font identities, actual pages, Poppler
word boxes and full page rasters. It then runs real GTK cancellation, protected
atomic replacement, source/app-data refusal, permission/glyph failures, typing/
Save, latest preview resumption and delayed actual native replies. Exact
BOM/CRLF source bytes remain preserved. No renderer/font/profile change.

Review found and corrected a preview-close focus race during Save: focus now
waits for the toolbar's enabled DOM commit and respects a newer writer choice.
Two UI regressions and a native held-real-Save-receipt oracle verify it.
The full frozen corpus retains all 22 accepted goldens. Poppler/Ghostscript
layout/text/font/raster and visual reviews pass; no golden adopted or rewritten.

The rebuilt AppImage's extracted AppRun passes the full scenario offline on
both tmpfs/Btrfs with home/temp toolchains hidden and system Python masked.
App/driver share only loopback; namespace/route and runtime witnesses pass.
Continuous descendant ledgers and bounded crash-journal scans pass ordinary
window close before stale-session teardown, with no observed crashes/survivors.
Initial invalid-isolation JSC/GTK crashes and focus/cancellation failures remain
retained; no crash filtering, sandbox bypass or system policy change.

Paths: `src/app/WritingView.tsx`, UI focus regressions; native
`publication_exit.py`, `offline_publication.py` and existing lifecycle/preview/
export runners; `tools/pdf-helper/audit_viewers.py`; publication contract,
trace, task/evidence and separate review docs.
[Brief](tasks/M5-07.md), [contract](pdf-and-formatting.md#authoritative-preview-m5-05),
[review](reviews/2026-10-02-m5-07-publication-review.md),
[evidence](test-evidence/M5.md#m5-07--integrated-publication-exit-and-separate-review).

## Checks and limits

`pnpm check` passes 767 frontend tests plus formatting/lint/typecheck/build.
Rust fmt/clippy and all 257 unchanged Rust tests pass on tmpfs/Btrfs; browser
smoke passes. Final default release/AppImage build passes. Native offline
package gates pass in 105.681/115.413 s; full corpus/two-viewer checks and
package runtime identity verifier pass. Syntax, final formatting/local links
and `git diff --check` are recorded in the linked evidence. Detailed logs,
commands, roots and final binary/package hashes live in `target/m5-07/`.

Actual test host: Linux 7.2.7-arch1-1, Intel i5-9400, about 11.5 GiB RAM,
GTK 3.24.52/WebKitGTK 2.52.6. This differs from the prior laptop; no cross-host
performance claim. The unchanged 2,400-row/120-trusted-key workload preserves
exact source and produces 89 actual preview pages at version 122. rAF proxy
p95 60/59 ms exceeds the 50 ms target; full compositor/S13/long-session/scaling
work remains M6. No full performance acceptance.

M5 is accepted only for this bounded Linux publication gate. Other platforms,
Tier 1 declaration, FUSE/desktop registration and installed adoption, A4,
editor page markers, full transitive notices/runtime trust, retention UX,
broader interruption/power loss, backup/migration and Local v1 remain open.
Existing M4 C1/F2 forced-kill/automation-shutdown hardening remains M6.
No real manuscript, credentials or upload; no push. This slice began with a
clean tree at `4e18c58`; `mise.toml` and `docs/development.md` are untouched.

## Next action

STOP: DEV-03 is complete. The authorized slices 8–9 are finished; no other
track started. DEV-02 second-host acceptance remains owner-only. Production
work stops at M5; M6-00, development-doc splitting and harness repackaging
remain outside this task and need their separate decisions/authorization.
