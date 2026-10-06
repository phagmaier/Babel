# LOCAL-HEALTH-2026-10-06 — cloud checkout on the laptop

The checkout builds and runs on this computer. Fixed Vite traversing accumulated
native/build artifacts during dev startup; bounded dependency discovery to
`index.html` and excluded `target/` from its watcher. No application behavior,
lockfile, native code, global setting or manuscript changed. No system packages
needed installation. Local npm dependencies were synchronized with the frozen
lockfile.

Base: `d22e90d225e12a1f19b148bd40a36888a31e08c1`, clean `main` at start.
Host: Arch Linux 7.2.8-arch1-2, x86_64, Hyprland/Wayland; Node 26.7.0,
pnpm 11.22.0, Rust 1.97.1, Python 3.14.7, Chromium 153.0.8010.52.
GTK 3.24.52, WebKitGTK 2.52.6, Enchant 2.8.21, Hunspell 1.7.5.
`/tmp` verified tmpfs, checkout verified Btrfs. Fresh synthetic files and
private XDG data/config/cache directories; no owner manuscripts or credentials.

## Checks

Commands ran from the repository root. Elapsed is unknown unless measured;
concurrent durations are not a total session time. All raw logs, JSON manifests,
process/crash ledgers, screenshots and failed invocations remain under ignored
`target/local-health-2026-10-06/` on this laptop.

| Command                                                                                                                                                                                               | Kind                                      | Result                                                                                   | Elapsed / skips                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------ |
| `sh tools/doctor.sh`; `sh tools/check-host.sh`                                                                                                                                                        | Host prerequisites                        | All pins agree; required libraries/tools available                                       | No OS installs                             |
| `pnpm install --frozen-lockfile`                                                                                                                                                                      | Locked local dependencies                 | Pass; local packages refreshed, lockfile unchanged                                       | 7.9 s                                      |
| `pnpm check` (final configuration)                                                                                                                                                                    | Static/JSDOM/frontend build               | Pass; 78 files, 1504 tests; links/guidance/format/lint/types/build green                 | JSDOM is not native IPC                    |
| `cargo fmt --all -- --check`                                                                                                                                                                          | Rust static                               | Pass                                                                                     | No Rust change                             |
| `python3 -m unittest discover -s tests/tools -p 'test_*.py'`                                                                                                                                          | Guidance tooling                          | 5/5                                                                                      | 0.836 s                                    |
| `pnpm pdf-helper`; `pnpm test:pdf-helper`                                                                                                                                                             | Bundled offline renderer                  | Build verified; 17/17 tests, 173 helper runs, network-namespace test passed              | 120.426 s tests                            |
| `pnpm test:differential`                                                                                                                                                                              | Independent capture/renderer comparisons  | 6/6                                                                                      | 150.04 s                                   |
| `pnpm test:browser` (final configuration)                                                                                                                                                             | Real Chromium, PDF worker, layout         | Pass; PDF display and 11 geometry checks                                                 | 4.275 s                                    |
| `python3 tools/run-workspace-matrix.py /tmp/babel-local-health-2026-10-06 /home/phagmaier/Code/Babel/target/local-health-2026-10-06/btrfs --output target/local-health-2026-10-06/workspace-absolute` | Real filesystem + Rust/MockRuntime wiring | 275/275 tmpfs, 275/275 Btrfs                                                             | 77.173 s / 148.342 s; not WebView evidence |
| `CARGO_BUILD_JOBS=4 pnpm tauri build`                                                                                                                                                                 | Default native release/package            | Release and 119.73 MiB AppImage built                                                    | Native compile 2m42s; total unknown        |
| `python3 tests/native/editor-input/build-keyboard.py`; `python3 tests/native/editor-completion/build-pointer.py`                                                                                      | Disposable physical input helpers         | Both built                                                                               | No persistent input configuration          |
| Native `integrated_exit.py`, modes below                                                                                                                                                              | Actual WebKit/GTK/IPC on Btrfs            | 3/3; all process/crash audits clean                                                      | 57.18 / 31.42 / 97.70 s                    |
| `python3 target/local-health-2026-10-06/appimage_probe.py`                                                                                                                                            | Actual FUSE package, no automation        | Native-connected Home visibly rendered; ordinary close exit 0; no crash events/survivors | Cold launch only, no desktop registration  |

Native command:

```sh
BABEL_SHUTDOWN_MODE=ordinary GTK_IM_MODULE=gtk-im-context-simple \
python3 tests/native/writing-lifecycle/integrated_exit.py \
  /home/phagmaier/Code/Babel/target/local-health-2026-10-06/btrfs \
  --modes recovery-shutdown spellcheck pdf-export \
  --output target/local-health-2026-10-06/native
```

The writing drill checked New, exact untitled recovery, Save As/cancellation,
autosave, protected close, ordinary native window close and writable reopen,
BOM/CRLF bytes, named snapshot/restore/Undo, permission-denied source saving,
audited checkpoint then intentional owned SIGKILL/restart/recovery adoption,
history failure isolation, external divergence and exact emergency copy.
The deliberate kill is separate from ordinary close; no unexpected crash event
or surviving native process appeared in any of the three scenarios.

Spellcheck used a loopback-only network namespace and actual Enchant/Hunspell:
correction/Undo, Ignore, durable Unicode Add/restart, language/resource failure,
GTK simple-IME commit/cancel and dictionary failure independent of source Save.
PDF export used the actual helper and GTK destination dialog: direct capture,
cancellation/replacement, protected-path and write failures, hidden-text/omission
review, unsupported-glyph refusal and independent source-byte isolation.
The packaged FUSE probe was separate: it launched from
`/tmp/.mount_babel_*/usr/bin/babel-desktop`, captured the owned Home window and
observed ordinary app/WebKit exit. Its screenshot was visually inspected; the
package was not registered or installed into desktop directories.

## Retained failures and scope

The original default Vite browser run was interrupted after more than 150 s
in dependency discovery (`browser.log`). Bounded entry discovery then passed
(`browser-fixed.log`), but the running server still had **121,566 inotify
watches**. Ignoring generated `target/` in the watcher brought the final browser
check to 4.275 s. The installed Vite 8.3.1 implementation and current
[Vite optimizer](https://vite.dev/config/dep-optimization-options.html#optimizedeps-entries)
and [watcher](https://vite.dev/config/server-options.html#server-watch)
documentation support this configuration; no artifacts were deleted to make it
pass.

The first matrix Btrfs argument was relative. Native path safety correctly
rejected it (`UnsafePath`, 46 desktop-test failures); this was an invocation
error. Original `workspace/` logs/manifests were retained. Corrected absolute
roots passed both filesystems in `workspace-absolute/`.

No full native/IME matrix, long-session performance, enforcing SELinux,
desktop registration, packaged spellcheck workflow, full S15.5 pilot, new
security audit or Clippy run is claimed. Historical cloud/native findings remain
retained. Optional Python GI/pyatspi imports were unavailable, but the active
native picker harness uses `busctl` and passed without them. No Rust or locked
dependency version changed in this health check.

Build identities (`host.json` retains full host/pin metadata):

- PDF helper tree: `808d2276543fce73967f8c66166d5e61a676282e094716da3e42b7831454086a`.
- Release executable: `093d3c085d302e039897242540630ef28b8d91a9733af798e223f39b81081ab1`.
- AppImage: `6eabb82a9da70f12f91b0b6194a2628c9b838bbb321bfa43c9afe0df90854b90`.

Stop: local health check complete; await the user's cloud-session handoff.
