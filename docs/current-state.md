# Current state — DEV-01 laptop setup complete

Date: 2026-10-02. Application: **babel**. Base `076f952` on clean main at
admission; owner requested readiness after switching from desktop to laptop.

## Task and work

**DEV-01 laptop development setup — complete.**
Node 26.7.0/pnpm 11.22.0 are selected by project-local `mise.toml`; Rust 1.97.1
and format/lint components by `rust-toolchain.toml`. Locked dependencies,
persistent Cargo cache, generated PDF runtime, inspection venv
(`target/dev-python`) and disposable native input helpers are ready. Owner
installed missing appmenu/xdotool/patchelf packages; native libraries, browser,
spellcheck, GTK/AT-SPI and Wayland tools were already present.

Setup exposed path-dependent helper bytecode identity and missing native event
unlisten permission. Canonical bytecode compilation now gives one tree across
checkout paths. All 33 approved PDF layout/raster files remain byte-identical;
native/review tree pins advance together. Narrow event cleanup permission fixes
development StrictMode cleanup. Two isolated Vitest workers provide laptop
headroom without changing tests/timeouts.

Paths: `mise.toml`, `rust-toolchain.toml`, `vite.config.ts`, `tools/pdf-helper/`,
`src-tauri/src/publication_host.rs`, `src-tauri/capabilities/main.json`, native
publication smoke, publication review identity and setup/task/evidence docs.
[Setup](development.md#laptop-setup-dev-01), [brief](tasks/DEV-01.md),
[evidence](test-evidence/M5.md#dev-01--laptop-development-setup).
Logs, command timing wrappers and final extracted AppImage: `target/dev-01/`.

## Checks and limits

Full frontend check passes: 714 tests, formatting/lint/typecheck/build.
Rust workspace passes 245 tests; fmt/clippy pass. Browser smoke passes.
Two-path offline build identity, helper 11/11 self-tests and exact runtime
verifier pass. Frozen corpus passes 13 cases/22 golden pages/13 boundary checks;
final packaged copy passes the same corpus in a network-disabled namespace.
Publication Rust tests pass 8/8 on tmpfs/Btrfs. Final release real WebKit IPC,
including native listener cleanup, passes on both filesystems. Full AppImage
build and actual Vite/debug desktop startup with ordinary window close pass.

Helper tree: `c805d61692438d7ce7a8e5cd4fb0918b492296e41343be4a2847da7ad88748a8`.
Release/AppImage hashes, exact commands, initial failures and limitations are
recorded once in evidence. No full writing/IME matrix rerun: packaging and
listener cleanup only; existing M4 shutdown/platform/performance limits remain.
Isolated IME matrices still require preparing their signed private package
prefix. `/tmp` input helper binaries must be rebuilt after reboot.

M5-03 frozen US Letter acceptance remains complete; no renderer layout or source
fixture changes. M5-04 assessment, M5-05 preview, M5-06 export, M5-07 integration
and M6 hardening remain open. No new milestone or adoption claim.

## Next action

Run `pnpm tauri dev` from this checkout (or `mise exec -- pnpm tauri dev`).
**M5-04 production SC005/SC008 assessment** is dependency-ready, not started.
Stop after DEV-01; no push is authorized. Use `pnpm tauri build` for production
builds. No desktop settings, manuscripts or credentials were copied.
