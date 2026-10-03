# Current state — M5-07 complete, DEV-02 tooling in progress

Date: 2026-10-03. Application: **babel**. Admission `bfdbdbb` on main.
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

**DEV-03 WritingView decomposition — slice 1 claimed.** Pure helpers
(`toSessionSelection`, `writingFailureMessage`, `clampedSelection`) moved
to `src/app/writingHelpers.ts` with new contract tests; component diff is
removal + import only (2,483 → 2,438 lines), no behavior change.
[Brief](tasks/DEV-03.md), [evidence](test-evidence/M5.md#dev-03--writingview-decomposition-slice-1).
Tier 2: new tests 5/5, `WritingView.test.tsx` 28/28 (focus regressions
green), full `pnpm test` 772/772, lint/typecheck/build, `cargo`
fmt/clippy/workspace-test, `prettier`, `git diff --check`. Slice 2 landed:
find/replace session → `useFindSession` (verbatim move, `tsc`-exact
boundary); focused 64/64, full suite green, native `--find` drill PASS
except pinyin IME (no Fcitx5 on this host — blocked, laptop can cover).
Slice 3 landed: script-check session → `useCheckSession` (verbatim move;
`closeCheck`/`showCheck` stay composed since the find hook consumes
`closeCheck`); `WritingView.tsx` 2,226 → 2,158 lines, focused 57/57,
full suite green, native `--script-check` drill PASS with exact bytes
and no blocked sections.
[Brief](tasks/DEV-02.md), [evidence](test-evidence/M5.md#dev-02--second-machine-smoothness-tooling-slice).
Tier 1: `bash -n`/`shellcheck`, doctor/host green, `cargo fmt`/`cargo check
-p babel-desktop`, `tsc`, one vitest file, `prettier`, `git diff --check`.
Full shared gates not rerun (no behavior paths). Owner `mise.toml` /
`docs/development.md` edits preserved and excluded from this task's commit.
`clean.sh --apply` not run: `target/m5-07` is linked evidence.

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
No real manuscript, credentials or upload; no push. Existing owner edits in
`mise.toml` and `docs/development.md` remain untouched and uncommitted by this task.

## Next action

Stop at M5. **M6-00 decomposition** is the next bounded task when authorized;
declare Tier 1 OS/architecture targets before M6 implementation. Review the
retained M4/M5 limits and decompose M6-G before starting production work.
