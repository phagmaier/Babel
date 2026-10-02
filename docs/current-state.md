# Current state — M5-02 complete; M5-03 next

Date: 2026-10-02 PDT. Application: **babel**. Base `c29b736` on main
(`origin/main` equal at start), tree clean at admission; one editing agent.

## Task and work

**M5-02 native render service and adapter contract — complete.** Native captured
jobs bind document/session, request/version/hash, profile/font set and options.
One helper plus replaceable pending capture, cancellation, stale rejection,
70 s wall timeout, bounded stdout and typed helper/process failures. Artifacts
stay in a private leased native cache; supersede/cancel/registration close clean
them. Source, save and recovery bytes stay untouched; no capability change.
Frontend copies existing captures and refuses stale/mismatched results.
[Evidence](test-evidence/M5.md#m5-02--native-render-service-and-adapter-contract).

Paths: `src-tauri/src/publication_host.rs`, publication tests/IPC tests,
`src/application/publication.ts`, `src/infrastructure/nativePublication.ts`,
`tests/contract/publication.test.ts`, native `publication_smoke.py`.
Integrity/cache/process policy extends [ADR 0036](decisions/0036-bundled-pdf-helper.md#m5-02-caller-integrity-and-lifecycle-policy).

## Checks and limits

Focused native/helper tests: 8 passed on tmpfs and Btrfs; frontend contracts:
19 passed. Shared Rust: 245 passed on each filesystem; frontend: 714 passed,
format/lint/typecheck/build pass. Rust fmt/clippy pass. Default release real
WebKit IPC smoke passes on tmpfs/Btrfs: exact BOM/CRLF capture, actual two-page
count, pinned identities, artifact lifecycle and no source save. Retained logs
and reports: `target/m5-02/`; commands/timings/failures are linked in evidence.
Browser smoke omitted because no frontend DOM changes.

Release SHA256 `274719f43664031c2f17a48c680165ff3c707bfa2b20ee58db3f46c6ff22e740`.
Helper exact tree unchanged: `7f1fdf6828596d43097816a61cbabc7a638eb4680da3a98b636020a095ad29a0`.
Only `screenplain-baseline` exists, `profileFrozen: false`, source map unsupported;
no fidelity, Script Check, preview UI or export claim. No M5-03 implementation.

M5-01 bundled helper is complete. M4-15 remains accepted for its bounded Linux
gate; forced WebDriver teardown crashes/C1 and dependency/performance/platform
hardening remain M6. No new native product crash was observed in this smoke.
Full license texts, installed/offline and other-platform verification, long
sessions, screenreader coverage and Local v1 adoption remain open.

## Next action

**M5-03 frozen US Letter profile and regression corpus** is dependency-ready.
Owner requested stopping after the M5-02 commit. No push is authorized.
Use `RUSTUP_TOOLCHAIN=1.97.1`; explicit Node 26.7.0/pnpm 11.22.0 mise wrapper.
For Tauri builds, prepend the actual Rust 1.97.1 bin directory after mise
selection so its global `rust@stable` shim cannot trigger an installation.
Use `pnpm tauri build --no-bundle`, never plain Cargo release build.
