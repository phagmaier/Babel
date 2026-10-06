# Current state — 2026-10-06

Application: **babel**, a local-first Linux screenwriting app (Tauri + React +
Rust). Feature-complete for local writing: Fountain editor with screenplay
elements, smart Enter/autocomplete, Script Check, spellcheck, outline, title
page, find/replace, scene moves, snapshots, protected close, crash recovery and
offline PDF preview/export. Builds as an AppImage that runs offline; not yet
verified as a FUSE/desktop install.

Agents make every decision; the owner is never a blocker
([ADR 0043](decisions/0043-agent-decision-authority.md)). Work on the assigned
branch (default `main`). Session work below is on `claude/youthful-bell-qemsy4`.

## This session

| Task             | Outcome                                                                                                                                                           | Evidence                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| PROC-RESET       | Agents own all gates; P granted, native register accepted, M6-02 closed, D-05 applied; AGENTS.md rewritten; SPEC 1.3                                              | [ADR 0043](decisions/0043-agent-decision-authority.md)                                                                       |
| CAPTURE-RECOVERY | A row Fountain cannot write no longer stops recovery; recovery-only snapshot journaled, never source-saved                                                        | [ADR 0044](decisions/0044-recovery-independent-of-capture.md), [pilot](test-evidence/PILOT-2026-10-06.md)                    |
| M6-03-A          | Rolling snapshot at the 256 cap runs retention once and retries                                                                                                   | [ADR 0018](decisions/0018-portable-snapshot-retention.md); cargo tests ext4+tmpfs                                            |
| DOCS-ARCHIVE     | 109 finished docs moved to [archive](archive), links rewritten                                                                                                    | `check:links`                                                                                                                |
| PILOT-2026-10-06 | AppImage builds/runs offline; native crash recovery and ADR 0044 path verified end to end; [tools/xdrive.py](../tools/xdrive.py) drives the app without WebDriver | [pilot](test-evidence/PILOT-2026-10-06.md)                                                                                   |
| WRITING-LAYOUT   | Script visible at 900×680; navigator after script in one column                                                                                                   | [pilot §layout](test-evidence/PILOT-2026-10-06.md#writing-first-layout-finding-1-addressed)                                  |
| HOME-RECOVERY    | One "Open latest version" action per recovered draft                                                                                                              | [pilot §recovery](test-evidence/PILOT-2026-10-06.md#home-recovery-finding-2-addressed)                                       |
| NEW-SCRIPT-FLOW  | New scripts start on a Scene Heading; identical suggestions no longer swallow Enter (S07.6)                                                                       | [pilot §new script](test-evidence/PILOT-2026-10-06.md#new-screenplay-and-identical-suggestions-finding-3-plus-a-new-finding) |
| M6-14 slice B    | Packaged PDF export verified; npm and cargo audits clean (dev `source-map-js`, yanked `yoke-derive` bumped)                                                       | [pilot §PDF](test-evidence/PILOT-2026-10-06.md#packaged-pdf-export-and-dependency-audit-m6-14-slice-b)                       |
| M6-16 slice      | Save As, external change + Reload, Find/Replace All, Recents reopen, named snapshot and restore verified in the package; versions list shows times newest first   | [pilot §workflows](test-evidence/PILOT-2026-10-06.md#writer-workflows-in-the-package-m6-16-slice)                            |

Last full gates: `pnpm check` 78 files / 1503 tests; `pnpm test:differential`
6; `pnpm test:layout` 11 checks; snapshot cargo tests 22. Native Python drills
were updated where behavior changed but **not run** (no WebKitWebDriver here).

Decision: text before a Parenthetical's `(` keeps its named refusal (now
recovery-protected). Saving it silently as Dialogue was tried and rejected; do
not reopen without new evidence.

## Known limitations (accepted, not blockers)

- [Native register](native-findings.md): 12 WebKitGTK aborts under forced
  harness teardown or `/tmp` inode exhaustion; no content loss. Reopen only for
  a crash in ordinary writing/save/close.
- M6-02: Save As/IME readiness lag (~117 ms, content saved); shared-store lease limit.
- Capture refusals that name no row still pause recovery (emergency copy route).
- `pnpm test:browser` needs a newer Chromium than the agent container's 1194
  (pdf.js 6.3); use `pnpm test:layout` there.
- Replace-All load flake, SELinux coverage, broader keyboard/a11y/IME, full S13
  performance and second-host bootstrap (DEV-02) are untested here.

## Next action

Take the first unblocked item; if blocked, note why and take the next.

1. **M6-16 pilot remainder** with `tools/xdrive.py`: scene moves, title page,
   backup copy to another folder and restore from it, an injected save error. When the S15.5 list passes, replace the README "do not
   use" warning with the real limits.
2. **M6-14 remainder**: FUSE/desktop install and launch, packaged spellcheck. [Brief](tasks/M6-14.md).
3. **M6-03 remainder**: snapshot panel/restore/copy drill. [Brief](tasks/M6-03.md).
4. **Capture**: a recovery copy for refusals that name no row.
5. **D-05 remainder**: protected workflows take a PreDestructive snapshot and
   treat a Git history failure as a warning
   ([ADR 0030](decisions/0030-version-bound-workflow-protection.md)).
6. Later, not V1 blockers: M6-04, M6-10–13, M6-15, DEV-02, M6-05–09, AUDIT-PARK-T
   (2) duplicate Home entry after a failed resume, M7, M8.

Native drills: check `df -i /tmp`, set `BABEL_NATIVE_IME_TEMP_ROOT` to a fresh
Btrfs directory, and follow `docs/development.md`.
