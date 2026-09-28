# Current state — M2-05B complete on its branch, awaiting review

Date: 2026-09-28 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [M2 evidence](test-evidence/M2.md#m2-05b--explicit-recovery-choices-and-external-changes), [ADR 0017](decisions/0017-explicit-recovery-choices.md).

## Active task and trust boundary

M0/bounded M1 and M2-01–04 are complete. M2-01 (`7e1ea90`) and M2-02 (`6039ccc`) were merged into local main at owner request. **M2-05A Startup recovery review is complete and merged into local `main` (`a968318`) at owner request**, preserving M2-03/04 work, plus local hardening (`bd91b84`, ahead of `origin/main`; no push without owner review). **M2-05B Explicit recovery choices and external changes is implemented and verified on branch `M2-05B-recovery-choices` (base `bd91b84`, clean tree at start); no commit/push without owner review.** M2-05 is decomposed into A (read-only review, done), B (explicit choices/source comparison, done pending review), C (snapshots/retention/backup), D (protected close). Parent M2-05/full M2 exit remain open.

The app can compare a selected recovery checkpoint against a natively opened source and resolve it through explicit Recover as Current, Keep Current File, Save Recovered Copy, or interrupted-transaction finalize, plus native-only safe relinking. It remains unsafe for important manuscripts: production picker/writer registration, editing, Save As, retention/pruning and protected close UI are unavailable, New/Open disabled. No production editor, PDF export, history UI or remote operation exists.

## Completed work and touched paths

- Path-free `compare_recovery` over `open_selected` anchors: recovery facts plus source status/fingerprint/hash, byte identity, external divergence and transaction observation. No timestamps, no winner. Read-only registrations may compare; adoption/finalize/relink require exclusive ownership.
- `recover_checkpoint_as_current` adopts selected UTF-8 bytes as a strictly newer version through the M2-03 recovery-first transaction with exact source receipt; previous copy and journal retained. Malformed recovery is refused for adoption but stays copyable. Stale version/fingerprint, divergence, queued/uncertain state and stuck transactions fail without writing.
- `keep_current_source` verifies both generations unchanged and reconciles the session in memory with zero disk writes; restarts require a fresh choice. `save_recovered_copy` writes exact bytes to a synced exclusive sibling (name only over IPC), even for missing/unreadable sources. `finalize_interrupted_save` completes only the two safe post-replacement states; `Prepared` and all other states return untouched.
- Older-session journal gate stays closed for ordinary checkpoints/saves; only an explicit choice sets the in-memory per-registration reconciled flag. Five strict writer-host IPC commands on bounded blocking workers; uninitialized host honestly reports `nativeUnavailable`. `RecoveryChoicePanel` with stale-result guards and fixed wording; startup review notes the explicit native-comparison path with New/Open disabled.
- Touched this task: core `documents/{choices.rs,choices_store.rs,choices_store_tests.rs,linux.rs,mod.rs,recovery_store.rs,recovery_store_tests.rs,source_store.rs}`, `tests/recovery_choices.rs`, native `{lib.rs,recovery_choices_host.rs,recovery_choices_ipc_tests.rs}`, `src/app/{RecoveryChoicePanel.tsx,RecoveryReview.tsx}`, `src/application/{recoveryChoices.ts}`, `src/infrastructure/nativeRecoveryChoices.ts`, `tests/{contract/recovery-choices.test.ts,ui/RecoveryChoices.test.tsx}`; README/TODO, architecture/persistence/UX/development/testing/requirements/current-state/index, ADR 0017 and M2 evidence. No lockfile or byte-sensitive fixture changes.

## Exact verification

Host: Linux 7.2.5-3-omarchy x86_64, Rust/Cargo 1.97.1, Node 26.7.0, pnpm 11.22.0; tmpfs/Btrfs; GTK 3.24.52/WebKitGTK 4.1 2.52.6. Full commands/logs/corrected failures and native-versus-mocked labels are in [M2-05B evidence](test-evidence/M2.md#m2-05b--explicit-recovery-choices-and-external-changes).

- Passed: `CARGO_HOME=/tmp/babel-cargo cargo test --workspace --locked` — 136 entries (28 core incl. 2 choice, 11 choice API, 12 recovery API, 9 save API, 26 open, 7 startup, 17 desktop incl. 3 choice dispatch, 13 replacement, 13 history).
- Passed: `BABEL_CHOICES_TEST_ROOT=/home/phagmaier/Code/babel ... --test recovery_choices` — 11 Btrfs entries; `BABEL_STARTUP_TEST_ROOT=... cargo test -p babel-desktop` — 17 (new choice dispatch on Btrfs, existing suites tmpfs). MockRuntime is not WebView E2E.
- Passed: `pnpm check` — format/lint/typecheck, 49 tests and Vite build; `pnpm test:browser` — disabled-shell browser smoke.
- Passed: `cargo fmt --all -- --check`; workspace clippy; desktop feature clippy; feature tests — 18; desktop build; no-Git `recovery_choices` (11) and desktop-lib (17) runs.
- Passed real native smoke: `pnpm dev --host 127.0.0.1` and `env XDG_DATA_HOME=/tmp/babel-m2-05b-native-1ixj9x10/data ./target/debug/babel-desktop`; keyboard text preview, Inspect Later/restart with reappearing case. Six app-only screenshots visually inspected; exact input/crop commands in M2 evidence. One capture discarded after an unrelated overlay covered the crop; stale pre-disconnect processes were stopped before the recorded run. Both test processes stopped.
- Passed: `python3 /tmp/babel-m2-05b-native-verify.py /tmp/babel-m2-05b-native-1ixj9x10` — all seeded artifacts retained hash/inode/mode/mtime after preview/deferral/restart/exit. Synthetic data only; owner's app data untouched. Access time is not asserted unchanged.
- Passed: final docs Prettier check, local file-target link audit, and `git diff --check`. Exact formatting command/log in M2 evidence.

## Remaining limits and next safe action

No M2-05B host blocker. Linux-only support, retention/pruning, Save As, external backup destination and protected close remain open. Same-disk sibling copies are not disaster backups; prepared-intent cleanup is M2-05C pruning, not an automatic delete; advisory leases still cannot exclude arbitrary external writers between check and rename; existing ACL-xattr/power-loss/platform limits apply.

Next ready task: **M2-05C Rolling snapshots and backup copies** on its own branch after M2-05B review. M2-05D owns protected close; M2-06 owns history/full safety exit. No editor before full M2 exit, no real remote transfer before M7 privacy/destination approval.
