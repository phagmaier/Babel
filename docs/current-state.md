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

1. **M6-03 snapshot retention at the cap**: automatic conservative retention
   when the 256-record cap is reached (never named/pre-destructive/newest),
   plus the D-05 cheap variant (verified PreDestructive snapshot before Replace
   All; Git failure downgraded to a warning). [Brief](tasks/M6-03.md).
2. **M6-14 Linux package**: unsigned offline AppImage/deb build and launch
   check, with a basic locked-dependency audit. [Brief](tasks/M6-14.md).
3. **M6-16 agent-run pilot**: SPEC S15.5 sequence on synthetic scripts; when it
   passes, replace the README "do not use" warning with the real limits.
4. **Capture follow-ups**: faithful file save for F4 prefix rows (cue-contained
   prefix repair, see [F4-PREFIX](test-evidence/AUDIT-PARK-H-F4-PREFIX.md));
   a recovery copy for refusals that name no row.
5. **AUDIT-PARK-T (2)**: a failed resume leaves a second draft entry on Home.
6. **Docs pruning**: archive completed briefs, reviews, handoffs and `AUDIT.md`
   under one archive folder with links fixed; delete the `docs/index.md` stub.
7. Later, not V1 blockers: M6-04, M6-10–13, M6-15, DEV-02, M6-05–09, M7, M8.

Native drills: check `df -i /tmp`, set `BABEL_NATIVE_IME_TEMP_ROOT` to a fresh
Btrfs directory, and follow `docs/development.md`.
