# Current state — M5-03 complete

Date: 2026-10-02 PDT. Application: **babel**. Base `4a4824a` on main, tree clean
at admission (one local commit ahead); one editing agent. Owner said Continue.

## Task and work

**M5-03 frozen US Letter profile and regression corpus — complete.**
`us-letter-draft-v1` freezes geometry, line metrics, title/body numbering,
continuation/keep/oversized splitting and short dual alignment over the pinned
Screenplain/ReportLab pipeline. Semantic lyrics/dual markers no longer leak.
Only Courier Prime appears in font resources/content streams; bounded CMap
chunking removes the Ghostscript warning. Native/frontend require frozen profile
identity. Generated markers never write back to source.

[ADR 0037](decisions/0037-us-letter-draft-profile.md) records the patch boundary,
coordinates, grouping and limits. [Corpus review](../fixtures/publication/REVIEW.md)
binds source/profile/layout/image identities and independent literal/tool/visual
review. [Evidence](test-evidence/M5.md#m5-03--frozen-us-letter-profile-and-regression-corpus)
records exact commands, timings and failures. Logs: `target/m5-03/`.

Paths: `tools/pdf-helper/frozen_profile.py`, `profiles/us-letter-draft-v1.json`,
helper/build/test scripts; `fixtures/publication/`; native/frontend publication
profile checks/tests and default-release IPC smoke. No capability/DOM change.

## Checks and limits

13 corpus cases, 22 reviewed golden pages, 13 extra boundary cases pass with
exact repeated layout/text/raster identity. Poppler/pypdf font/geometry/text
inspection passes; Ghostscript renders every corpus page without warning.
Legacy baseline helper 11/11 passes. Native focused tests 8/8 on tmpfs/Btrfs;
frontend contracts 19/19. Shared Rust 245 and frontend 714 tests pass;
fmt/clippy/format/lint/typecheck/build pass. Browser smoke omitted (no DOM change).

Default Tauri release real WebKit IPC smoke passes on tmpfs/Btrfs, exact synthetic
BOM/CRLF capture, frozen identity and actual count, cache lifecycle and no source
save. Full AppImage build and extracted-helper offline network-namespace corpus
pass. Pure layout needs no second full filesystem matrix.

Release SHA256 `20d671f4672abda13d52cc19c61dcd3723abb967aa37bffbaf07b59f98bf1f94`.
Helper tree `a0c6e39d2b316912f6b96b98fdacb4c2ac667556fb4115482bb7c0b790242d6d`.
AppImage SHA256 `f26f4fce2294ab3572048d8b6391010a1453eb8273bb93fc67f2a83de87304f2`.

Tall dual, unavailable glyphs/shaping and impossible cue/parenthetical/scene
number geometry are declared refusals. Known upstream omissions carry bounded
warnings. Frozen layout does not imply full codec fidelity or Script Check:
M5-04 still owns complete SC005/SC008 assessment; preview/export are M5-05/06,
integration M5-07. Source maps remain unsupported. Other platforms, installed
app verification, full licenses and long sessions remain open.

M4 bounded Linux acceptance is unchanged; forced WebDriver teardown/C1 and
WebKit/performance/platform hardening remain M6. No new product crash observed.

## Next action

**M5-04 production SC005/SC008 assessment** is dependency-ready, not started.
Stop after the M5-03 commit. No push is authorized.
Use `RUSTUP_TOOLCHAIN=1.97.1`, explicit Node 26.7.0/pnpm 11.22.0 mise array, and
prepend the actual pinned Rust bin directory after mise selection for Tauri.
Use `pnpm tauri build`, never plain Cargo release build.
