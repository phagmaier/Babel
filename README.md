# babel

babel is a planned local-first desktop screenwriting application. This repository is at **M2-05A: read-only startup recovery review, headless native persistence and versioned IPC, plus the M0 shell and isolated M1 proofs** (Fountain contract, native editor input, PDF renderer, durable replacement, history store). The native core can safely register synthetic sources, with opaque identities and conservative ownership, protect independent native recovery checkpoints, and serialize source replacement on synthetic files through a native queue. Typed checkpoint/source commands dispatch bounded blocking workers; a headless frontend controller tracks recovery and source receipts separately and rejects stale or cross-session results. The current app displays a home placeholder and reads its name/version through a harmless Tauri command. The startup shell can inspect existing private local recovery checkpoints and defer review. Source comparison, recovery adoption/copy, New, Open, saving, editing, PDF, history and remote transfer remain unavailable. **Do not use this build for important manuscripts.**

`SPEC.md` is the product contract. [Documentation](docs/index.md), [tasks](TODO.md), and [current state](docs/current-state.md) contain the implementation map and exact verification status. The app name **babel** was chosen by the owner; the starter spec's "Screenwriter" label was a placeholder. The npm package is `babel-screenwriter`; the Rust crate `screenwriter-core` keeps its technical name (see [naming map](docs/architecture.md)).

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

The browser preview explicitly reports that native services are unavailable. Its smoke test does not verify Tauri IPC. The recorded host passed real Tauri/WebKit startup and an AppImage build. This sandbox needed temporary writable package caches for installation/build; see [M0 evidence](docs/test-evidence/M0.md) for exact commands and results. The AppImage has not been installed/offline-tested, other platforms are unverified, and CI has not run remotely.

No application-code license has been chosen. Third-party package metadata and the native packaging implications are tracked in [development](docs/development.md); final notices are a later release task.
