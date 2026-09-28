# Current state — M1-01/02 complete

Date: 2026-09-27 PDT. Application: **babel**; `screenwriter-core` remains the technical Rust crate name. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [M0 evidence](test-evidence/M0.md), [M1 evidence](test-evidence/M1.md).

## Active milestone and trust boundary

M0, M1-01, and **M1-02** are complete on the recorded Linux host. No further task is claimed. The application remains a development skeleton, unsafe for important manuscripts: New/Open are disabled; no production editor, save/recovery, PDF, history, or remote operation exists. M1 source and native editor proofs are isolated under `prototypes/`. The native report command exists only with the explicit `native-editor-proof` Cargo feature.

## Completed work and touched paths

M1-01 committed the adversarial Fountain fixture/source model proof and [ADR 0007](decisions/0007-source-aware-fountain-contract.md). M1-02 added the [native ProseMirror proof harness](../prototypes/native-editor/README.md), deterministic 120/300/600 workload generator and hashes, feature-gated Tauri diagnostic sink, pinned MIT ProseMirror proof dependencies, [ADR 0008](decisions/0008-native-editor-input.md), and native input/performance evidence. Updated `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/tauri.native-proof.conf.json`, `TODO.md`, `docs/development.md`, `docs/testing.md`, `docs/editor-behavior.md`, `docs/requirements.md`, `docs/decisions/0003-editor-and-native-ownership.md`, and `docs/test-evidence/M1.md`. No Local v1 product requirement is marked complete.

The repository has a local `main` branch and no remote. M0 shell and earlier decisions remain described in [M0 evidence](test-evidence/M0.md) and [architecture](architecture.md). No push or publication was made.

## Exact verification and remaining limits

- Passed on Omarchy/Linux x86_64, AMD Ryzen 7 7840U, WebKitGTK 2.52.6: `node prototypes/native-editor/hash-fixtures.mjs`; `CARGO_HOME=/tmp/babel-cargo pnpm tauri dev --features native-editor-proof --config src-tauri/tauri.native-proof.conf.json` (real native selection, typing, undo/redo, paste/undo, dead-key composition, 139 paced key samples at each workload); `pnpm check`; `cargo fmt --all -- --check`; `CARGO_HOME=/tmp/babel-cargo cargo test --workspace --locked`; `CARGO_HOME=/tmp/babel-cargo cargo test -p babel-desktop --features native-editor-proof --locked`; both default and feature-enabled Clippy checks; `XDG_CACHE_HOME=/tmp/babel-cache CARGO_HOME=/tmp/babel-cargo pnpm tauri build` (default-feature AppImage). Exact outcomes, fixture hashes, performance numbers, corrected setup failures, and local screenshot path: [M1 evidence](test-evidence/M1.md).
- The keydown-to-frame result is a WebView timing proxy, not compositor paint. Full CJK/RTL IME, other OS/WebView builds, screenplay-specific schema/Enter behavior, codec integration, long-session memory, and production save remain unverified. A dead-key Return ended composition before a non-composing Enter keydown; M3 needs an event-sequence guard. This did not change the SPEC Enter table.

## Next safe action

Start **M1-03 PDF renderer proof** on its own branch. Read SPEC S12, `docs/pdf-and-formatting.md`, and the M1-03 TODO entry. Test only synthetic samples and record rendered/packaging/font evidence; no production export UI yet. M1-04 and M1-05 are also dependency-ready separate tasks.
