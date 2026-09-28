# Current state — M0 bootstrap

Date: 2026-09-28. Application name: **babel** (owner-selected); `screenwriter-core` retains its technical crate name. Authority: [SPEC](../SPEC.md); [tasks](../TODO.md); [M0 evidence](test-evidence/M0.md).

## Active milestone and trust boundary

M0 is complete on the recorded host: `M0-01` through `M0-04` have evidence in the [M0 report](test-evidence/M0.md). M1 has **not** started. The app is a development skeleton, unsafe for important manuscripts. New/Open are disabled; editor, save/recovery, PDF, local history, and remote operations do not exist.

## What exists

Local Git repository without commit/remote; preserved starter `SPEC.md`, `AGENTS.md`, `BOOTSTRAP_PROMPT.md`; pinned pnpm/Node/Rust manifests with real lockfiles. One React/Vite package, Tauri host, headless core, typed app-info port/command, explicit browser-unavailable adapter, empty native capability permissions, two UI tests, one browser smoke, two Rust tests, minimal CI. Focused docs, six status-labeled ADRs, 41-ID requirement trace, M1/M2 task decomposition, later milestone gates, fixture conventions. Paths: `src/`, `src-tauri/`, `crates/screenwriter-core/`, `tests/`, `docs/`, `TODO.md`, `.github/workflows/check.yml`.

## Exact verification

- Passed (M0, recorded host — see [M0 report](test-evidence/M0.md) for full detail): `pnpm check` (format/lint/typecheck/2 UI tests/Vite build); `pnpm test:browser` (Chromium screenshot `/tmp/babel-m0-browser.png`); `cargo fmt --all -- --check`; `CARGO_HOME=/tmp/babel-cargo cargo test -p screenwriter-core --locked` (1); `CARGO_HOME=/tmp/babel-cargo cargo clippy --workspace --all-targets --locked -- -D warnings`; `CARGO_HOME=/tmp/babel-cargo cargo test --workspace --locked` (2 total); `XDG_CACHE_HOME=/tmp/babel-cache CARGO_HOME=/tmp/babel-cargo pnpm tauri build` (98.48 MiB AppImage); `CARGO_HOME=/tmp/babel-cargo pnpm tauri dev` startup; release-binary native IPC visual smoke; 41-ID trace and relative-link audits.
- Open later gates: remote CI has not run; AppImage installation/offline execution and other OS targets are not proven by M0. The dev GUI run was intentionally stopped after observation.
- Environment note: default pnpm/Cargo/Tauri caches were read-only in this sandbox, so writable `/tmp` stores were used; this is not a product runtime dependency. `appindicator3-0.1` and `xvfb-run` are absent, but the host package and real WebKit window succeeded. The owner uses mise; no toolchain installation was needed.
- Passed (doc/workflow pass 2026-09-28, docs only, no product code): `pnpm prettier --check` on all 17 touched/created Markdown files; relative-link audit over touched docs; 41-ID requirement-trace audit; `AGENTS.md` measures 7905 bytes (under ~8 KiB). Local Git still has no commits or remote; first commit awaits human review.

## Doc/workflow pass 2026-09-28

Owner-approved review findings applied. `AGENTS.md` now mandates `docs/index.md` reading, blocks `M*-G` groups until decomposed into `M*-NN` tasks with an updated trace, and defines task claiming, one-branch-per-task (`M1-01-<slug>`), ADR naming/status, and `docs/test-evidence/M*.md` evidence paths. `TODO.md` dependencies normalized to task IDs; added `M3-00` decomposition gate, M1-05 local-transport proof, M2-02 journal-growth bound, M1-02 hardware-baseline/Enter-table amendment rule, and a pre-M6 Tier 1 OS/arch owner decision. Also: naming map in [architecture](architecture.md), ADR template plus `Evidence still needed` lines in [decisions](decisions/README.md), evidence convention in [testing](testing.md), aux-JSON versioning in [persistence](persistence-and-recovery.md), completed banner on `BOOTSTRAP_PROMPT.md`. Touched: `BOOTSTRAP_PROMPT.md`, `README.md`, `AGENTS.md`, `TODO.md`, `docs/architecture.md`, `docs/index.md`, `docs/testing.md`, `docs/persistence-and-recovery.md`, `docs/decisions/README.md` (new), `docs/decisions/0001`–`0006`.

## Next safe action

Stop at M0. The first eligible M1 task is `M1-01` Fountain/editor contract proof; read SPEC S05–S07, `docs/document-model.md`, `docs/editor-behavior.md`, and TODO before working. It requires synthetic fixtures and a bounded source/model proof, not application features in this handoff.
