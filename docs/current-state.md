# Current state — M2-05A complete, merged to main

Date: 2026-09-28 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [M2 evidence](test-evidence/M2.md#m2-05a--read-only-startup-recovery-review), [ADR 0016](decisions/0016-read-only-startup-recovery-review.md).

## Active task and trust boundary

M0/bounded M1 and M2-01–04 are complete. M2-01 (`7e1ea90`) and M2-02 (`6039ccc`) were merged into local main at owner request. **M2-05A Startup recovery review is complete and merged into local `main` (`a968318`, in sync with `origin/main`) at owner request**, preserving M2-03/04 work. M2-05 is decomposed into A (read-only review, done), B (explicit choices/source comparison), C (snapshots/retention/backup), D (protected close). Parent M2-05/full M2 exit remain open.

The app can inspect private loose/unsaved recovery and defer review. It remains unsafe for important manuscripts: source picker/writer registration, editing, adoption/copy/save and protected close UI are unavailable, New/Open disabled. No production editor, PDF export, history UI or remote operation exists.

## Completed work and touched paths

- Read-only `LocalRecoveryReader`: existing anchored/no-follow private directories and files; no directory/file/lease creation, source or recovery rewriting. Bounded 4096-entry/64-document scan with incomplete/unknown-artifact notices. Safe valid prefixes remain inspectable despite damaged/future/pending/conflicting material; no winner is chosen.
- Full canonical checkpoint hash binds artifact origin and metadata plus exact raw bytes. Native preview re-reads and revalidates; stale/missing/metadata-only changes fail rather than substituting a generation. No persistence receipt/adoption authority returned.
- Native OS app-data root resolved during setup; separate bounded blocking list/preview commands and strict path-free envelopes. Writer host stays uninitialized. No frontend filesystem capability/dependency added.
- Startup UI: summaries, warnings, bounded literal text/hex previews, Refresh, Inspect Later/review. Deferred case reappears after restart; stale responses cannot replace the selected preview. Fixed errors and same-disk backup distinction. Full recovery choices require M2-05B source comparison.
- Touched this task: core `documents/{mod.rs,linux.rs,recovery_store.rs,startup.rs,startup_reader.rs}`, native `{lib.rs,persistence_host.rs,startup_host.rs,startup_ipc_tests.rs}`, `src/app/{App.tsx,RecoveryReview.tsx}`, `src/application/startupRecovery.ts`, native adapter/styles, native/UI/adapter tests; README/TODO, architecture/persistence/UX/development/testing/requirements/current-state, ADR 0016 and M2 evidence. Prior M2-03/04 paths remain carried forward. No lockfile or byte-sensitive fixture changes.

## Exact verification

Host: Linux 7.2.5-3-omarchy x86_64, Rust/Cargo 1.97.1, Node 26.7.0, pnpm 11.22.0; tmpfs/Btrfs; GTK 3.24.52/WebKitGTK 4.1 2.52.6. Full commands/logs/corrected failures and native-versus-mocked labels are in [M2-05A evidence](test-evidence/M2.md#m2-05a--read-only-startup-recovery-review).

- Passed: `CARGO_HOME=/tmp/babel-cargo cargo test --workspace --locked -- --nocapture` — 120 entries (26 core, 9 save, 12 recovery, 26 open, 7 startup, 14 desktop, 13 replacement, 13 history); existing fault/SIGKILL suites intact.
- Passed: `BABEL_STARTUP_TEST_ROOT=/home/phagmaier/Code/babel CARGO_HOME=/tmp/babel-cargo cargo test -p screenwriter-core --test startup_recovery -p babel-desktop --locked -- --nocapture` — 7 Btrfs reader entries (target selector excludes desktop units); `BABEL_STARTUP_TEST_ROOT=/home/phagmaier/Code/babel CARGO_HOME=/tmp/babel-cargo cargo test -p babel-desktop --locked -- --nocapture` — 14, new startup fixtures on Btrfs, existing fixtures tmpfs. MockRuntime is not WebView E2E.
- Passed: `pnpm check` — format/lint/typecheck, 43 tests and Vite build; `pnpm test:browser` — unavailable-native browser shell smoke.
- Passed: `cargo fmt --all -- --check`; `CARGO_HOME=/tmp/babel-cargo cargo clippy --workspace --all-targets --locked -- -D warnings`; `CARGO_HOME=/tmp/babel-cargo cargo clippy -p babel-desktop --all-targets --features native-editor-proof --locked -- -D warnings`.
- Passed: `CARGO_HOME=/tmp/babel-cargo cargo test -p babel-desktop --features native-editor-proof --locked` — 15; `CARGO_HOME=/tmp/babel-cargo cargo build -p babel-desktop --locked`; `env PATH=/nonexistent ./target/debug/deps/startup_recovery-cca6d7f6149e7820` — 7.
- Passed real native smoke: `pnpm dev --host 127.0.0.1` and `env XDG_DATA_HOME=/tmp/babel-m2-05a-native-du9skzsl/data ./target/debug/babel-desktop`; keyboard text/hex review, Inspect Later/restart. Six app-only screenshots visually inspected; exact input/crop commands in M2 evidence. First attempt lacked Vite; corrected by starting it/restarting the owned app. Both test processes stopped.
- Passed: `python3 /tmp/babel-m2-05a-native-verify.py` — five independent Python-seeded recovery artifacts retained hash/inode/mode/mtime after review/deferral/restart/exit. Synthetic data only; owner's app data untouched. Access time is not asserted unchanged.
- Passed: final docs Prettier check, `python3 /tmp/babel-m2-05a-doc-links.py` (231 local file targets, 36 documents; fragments excluded), and `git diff --check`. Exact formatting command/log in M2 evidence.

## Remaining limits and next safe action

No M2-05A host blocker. Linux-only support and full startup recovery resolution remain open. The scan covers private loose/unsaved recovery only; managed sources have not been selected or compared. No adoption/export/restore, confirmed-source status, global atomic/exhaustive discovery, retention/backup/protected close, cadence/latency, hardware power-loss, other-platform or installed-package claim. Unknown/unsafe/pending material remains preserved. Same-disk copies are not disaster backups; existing arbitrary-writer race/ACL-xattr limits apply.

Next ready task: **M2-05B Explicit recovery choices and external changes** on its own branch while preserving this work. Read SPEC S10, persistence/UX and ADRs 0012–0016; native-select/compare sources and protect both generations before explicit Recover as Current/Keep Current/Save Recovered Copy or transaction resolution. M2-05C/D own retention/backup/close; M2-06 owns history/full safety exit. No editor before full M2 exit, no real remote transfer before M7 privacy/destination approval.
