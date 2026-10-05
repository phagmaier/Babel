# babel

babel is a local-first desktop screenwriting application in development. The default Linux app connects a Fountain editor to native New/Open, versioned recovery and source saving, Save As, snapshots, protected close, and a bundled offline PDF pipeline. M0–M5 and the bounded M6-01 investigation have passed their bounded Linux gates; see [current state](docs/current-state.md) for the evidence and remaining gates. Installed/offline adoption, production history workflows, remote operations, and other platforms remain future work. **Do not use this build for important manuscripts.**

`SPEC.md` is the product contract. [Repo map](map.md), [tasks](TODO.md), and [current state](docs/current-state.md) contain the implementation map and exact verification status. The app name **babel** was chosen by the owner; the starter spec's "Screenwriter" label was a placeholder. The npm package is `babel-screenwriter`; the Rust crate `screenwriter-core` keeps its technical name (see [naming map](docs/architecture.md)).

## Start and check

On the recorded Omarchy Linux host, use Node 26.7.0, pnpm 11.22.0, Rust 1.97.1, and the native prerequisites in [development](docs/development.md). The owner uses mise for toolchains; these versions were already installed. Install project packages with `pnpm install --frozen-lockfile` and run:

| Purpose                         | Command                                                 |
| ------------------------------- | ------------------------------------------------------- |
| Browser preview (no native IPC) | `pnpm dev`                                              |
| Desktop development             | `pnpm tauri dev`                                        |
| Frontend checks                 | `pnpm check`                                            |
| Browser smoke                   | `pnpm test:browser`                                     |
| Rust formatting                 | `cargo fmt --all -- --check`                            |
| Rust lint                       | `cargo clippy --workspace --all-targets -- -D warnings` |
| Rust tests                      | `cargo test --workspace`                                |
| Desktop package                 | `pnpm tauri build`                                      |

The browser preview explicitly reports that native services are unavailable. Its smoke test does not verify Tauri IPC. The recorded host passed real Tauri/WebKit startup and an AppImage build. This sandbox needed temporary writable package caches for installation/build; see [M0 evidence](docs/test-evidence/M0.md) for exact commands and results. The AppImage has not been installed/offline-tested, other platforms are unverified, and CI covers automated frontend/core, helper/browser and Linux build checks; native writing, filesystem-matrix and installed/offline acceptance remain task-scoped local gates.

No application-code license has been chosen. Third-party package metadata and the native packaging implications are tracked in [development](docs/development.md); final notices are a later release task.
