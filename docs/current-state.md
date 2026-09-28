# Current state — M1-01/02/03 complete

Date: 2026-09-28 PDT. Application: **babel**; `screenwriter-core` remains the technical Rust crate name. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [M0 evidence](test-evidence/M0.md), [M1 evidence](test-evidence/M1.md).

## Active milestone and trust boundary

M0, M1-01, M1-02, and **M1-03** are complete on the recorded Linux host. No further task is claimed. The application remains a development skeleton, unsafe for important manuscripts: New/Open are disabled; no production editor, save/recovery, PDF export, history, or remote operation exists. M1 source, native editor, and PDF proofs are isolated under `prototypes/`. The native report command exists only with the explicit `native-editor-proof` Cargo feature; the PDF venv packages are proof-only, not app runtime.

## Completed work and touched paths

M1-01 committed the adversarial Fountain fixture/source model proof and [ADR 0007](decisions/0007-source-aware-fountain-contract.md). M1-02 added the [native ProseMirror proof harness](../prototypes/native-editor/README.md), workload generator and hashes, feature-gated Tauri diagnostic sink, pinned MIT ProseMirror proof dependencies, [ADR 0008](decisions/0008-native-editor-input.md), and native input/performance evidence. M1-03 (branch `M1-03-pdf-renderer-proof`) added the [isolated PDF proof](../prototypes/pdf/README.md): four-file synthetic corpus, pinned `screenplain==0.12.0`/`reportlab==4.4.7` render + `pypdf==6.19.0` inspection scripts, `pdf-lib@1.17.1` fallback probe, [coverage matrix](../prototypes/pdf/COVERAGE.md), and accepted-baseline [ADR 0009](decisions/0009-pdf-renderer-baseline.md). Also updated `.gitignore`, `.prettierignore`, `package.json`, `pnpm-lock.yaml`, `README.md`, `TODO.md`, `docs/pdf-and-formatting.md`, `docs/requirements.md`, `docs/development.md`, `docs/testing.md`, and `docs/test-evidence/M1.md`. No Local v1 product requirement is marked complete.

The repository has local branches `main` + `M1-03-pdf-renderer-proof` and no remote. Generated PDFs/PNGs stay in gitignored `prototypes/pdf/out/` and `/tmp`; corpus hashes and inspection results are in the M1 report. No push or publication was made.

## Exact verification and remaining limits

- Passed on Omarchy/Linux x86_64: `pnpm check` (format, lint, typecheck, 13 tests, Vite build); `cargo fmt --all -- --check`; `cargo test --workspace --locked`; `cargo test -p babel-desktop --features native-editor-proof --locked` (2 tests); both Clippy feature sets; `git diff --check`. M1-02 native/AppImage evidence stands from its report section.
- M1-03 rendered 4 synthetic sources offline (23–32ms primary, 2/6/3/2 Letter pages): geometry, title/numbering, scene numbers, dialogue columns, dual side-by-side, centered/right transitions, breaks, emphasis, hyphen-free splits pass; heading held near the foot, monologue splits mid-speech with no `(MORE)`; layout deterministic (equal text, metadata-varying bytes). Silent gaps with no warning: lyrics `~` leak, first-pair dual `^` leak, dropped sections/synopses/notes/boneyards/unknown title fields, blank CJK/emoji/RTL gaps, body numbered `2.` after two-page title, no source map; Ghostscript notes a ReportLab conformance warning (Poppler clean). Visual PNGs reviewed in `/tmp/babel-pdf-*.png`.
- Full IME/production-editor integration (M3 guard), bundled-Python packaging, SC005/SC008 warnings, continuation rules, Tier 1 viewers/platforms, and preview/export agreement remain open (M5/M6).

## Next safe action

Merge `M1-03-pdf-renderer-proof` after human review, then start **M1-04 durable replacement proof** or **M1-05 history-store proof** on its own branch. Both are dependency-ready; M1-04 needs SPEC S10/S15, `docs/persistence-and-recovery.md`, and disposable-filesystem fault work with no live manuscript saving.
