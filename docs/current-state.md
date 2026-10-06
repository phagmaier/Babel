# Current state — 2026-10-06

Application: **babel**, a local-first Linux screenwriting app (Tauri + React +
Rust). Feature-complete for local writing: Fountain editor with screenplay
elements, smart Enter/autocomplete, Script Check, spellcheck, outline, title
page, find/replace, scene moves, snapshots, protected close, crash recovery and
offline PDF preview/export. Not yet packaged as an installable app (M6-14).

Agents make every decision; the owner is never a blocker
([ADR 0043](decisions/0043-agent-decision-authority.md)). Work on the assigned
branch (default `main`).

## This session

**PROC-RESET.** [ADR 0043](decisions/0043-agent-decision-authority.md) moves all
gates to agents and records dispositions: gate P granted (Linux x86_64), native
crash register accepted as residual risk, M6-02 closed with limitations, D-05
applied (M6-05–09 deferred; snapshots are V1 Versions). AGENTS.md rewritten;
SPEC 1.3 trims S17–S20 to pointers; TODO dependencies updated.

**CAPTURE-RECOVERY.** [ADR 0044](decisions/0044-recovery-independent-of-capture.md):
a row Fountain cannot write no longer stops recovery. The capture boundary
attaches a recovery-only snapshot (refused rows retyped on a never-dispatched
copy) to the unchanged refusal; the session journals it, the cadence and
controller never write it to the source file, and status reads "Recovery
protected; file save pending". Files: `src/editor/{state,sourceBridge}.ts`,
`src/application/{editorCapture,writingSession,saveCadence,persistenceController}.ts`,
`src/app/writingHelpers.ts`; tests `tests/contract/capture-recovery.test.ts`,
cadence and WritingView F3 cases.

| Check                                                            | Result                                                                              |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm typecheck`, `pnpm lint`                                    | pass                                                                                |
| `pnpm test`                                                      | 78 files / 1497 tests pass                                                          |
| `pnpm test:differential` (after `pnpm pdf-helper`)               | 3 files / 6 tests pass                                                              |
| `tests/investigation/f4-prefix.test.ts`                          | 7 pass                                                                              |
| Native `tests/native/writing-lifecycle/empty_heading.py` phase E | updated to new behavior; **not run** (no desktop/WebDriver host in agent container) |

**M6-03-A snapshot cap.** A rolling snapshot that hits the 256-record/256 MiB
cap now runs native retention once and retries (ADR 0018 amendment), instead of
silently stopping rolling snapshots after ~21 hours of writing. Files:
`src/application/saveCadence.ts`, `snapshot_store.rs` comment, tests in
`save-cadence.test.ts` and `snapshot_store_tests.rs`.

| Check                                                                  | Result                                                                                               |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `pnpm test` cadence suite                                              | 22 pass                                                                                              |
| `cargo test -p screenwriter-core --lib snapshot_store::tests`          | 22 pass on ext4 and tmpfs (`BABEL_SNAPSHOT_TEST_ROOT=/dev/shm/...`); Btrfs **not run** (unavailable) |
| `cargo clippy -p screenwriter-core --all-targets`, `cargo fmt --check` | clean                                                                                                |

**DOCS-ARCHIVE.** 109 finished briefs, reviews, handoffs, `AUDIT.md` and
one-off proof/history docs moved to [archive](archive) with every link
rewritten; `docs/tasks` keeps only open briefs. Historical evidence keeps its
recorded paths; only links changed. `docs/index.md` stub deleted.
`check:links` (1941 links) and `check:guidance` pass.

**HOME-RECOVERY.** Finding 2 fixed: each recovered draft offers one "Open
latest version" action with checkpoint details de-emphasized.
[Evidence](test-evidence/PILOT-2026-10-06.md#home-recovery-finding-2-addressed).

**WRITING-LAYOUT.** Finding 1 fixed with CSS only: at 900×680 the script is
visible under compact chrome; narrow windows show it before the navigator.
[Evidence](test-evidence/PILOT-2026-10-06.md#writing-first-layout-finding-1-addressed).

**PILOT-2026-10-06.** [Evidence](test-evidence/PILOT-2026-10-06.md). The
AppImage builds (`pnpm tauri build`, 99 MiB) and runs offline. Driven natively
with new [tools/xdrive.py](../tools/xdrive.py): crash recovery restores an
unsaved draft, and the ADR 0044 path works end to end (refused row → other-row
edit journaled on disk → SIGKILL → restore returns every word). Findings:
editor sits below ~10 rows of controls; Home recovery list is engineer-facing;
new scripts start in Action.

Decision: text before a Parenthetical's `(` keeps its named refusal (now
recovery-protected). Saving it silently as Dialogue was tried and rejected:
the alert is the clearer writer experience. Do not reopen without new evidence.

## Known limitations (accepted, not blockers)

- [Native register](native-findings.md): 12 WebKitGTK aborts under forced
  harness teardown or `/tmp` inode exhaustion; no content loss. Reopen only for
  a crash in ordinary writing/save/close.
- M6-02: Save As/IME readiness lag (~117 ms, content saved); shared-store lease limit.
- Capture refusals that name no row still pause recovery (emergency copy route).
  F4 prefix rows (`x (beat)`) are protected by recovery but not file-saved
  until changed.
- Replace-All load flake, SELinux coverage, broader keyboard/a11y/IME, full S13
  performance and second-host bootstrap (DEV-02) are untested here.

## Next action

Take the first unblocked item; if blocked, note why and take the next.

1. **New screenplay starts with a Scene Heading row** (finding 3).
2. **M6-14 remainder**: FUSE/desktop install, packaged PDF export and
   spellcheck, locked-dependency audit. [Brief](tasks/M6-14.md).
3. **M6-16 pilot remainder**: the S15.5 steps not yet exercised (PDF export,
   find/replace, scene moves, title page, external change, backup restore),
   driven with `tools/xdrive.py`; then replace the README "do not use" warning.
4. **M6-03 remainder**: snapshot panel/restore/copy drill. [Brief](tasks/M6-03.md).
5. **Capture**: a recovery copy for refusals that name no row.
6. **D-05 remainder**: protected workflows take a PreDestructive snapshot and
   treat a Git history failure as a warning
   ([ADR 0030](decisions/0030-version-bound-workflow-protection.md)).
7. Later, not V1 blockers: M6-04, M6-10–13, M6-15, DEV-02, M6-05–09, AUDIT-PARK-T
   (2) duplicate Home entry after a failed resume, M7, M8.

Native drills: check `df -i /tmp`, set `BABEL_NATIVE_IME_TEMP_ROOT` to a fresh
Btrfs directory, and follow `docs/development.md`.
