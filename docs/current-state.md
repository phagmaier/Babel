# Current state — 2026-10-06

Application: **babel**, a local-first Linux screenwriting app (Tauri + React +
Rust). Local writing features include Fountain editing, smart Enter/completion,
Script Check, spellcheck, outline, title page, find/replace, scene moves,
snapshots, protected close, crash recovery and offline PDF preview/export.
The AppImage builds and launches through FUSE on the development laptop;
desktop registration and the remaining writing-pilot cases are still open.

Agents make decisions under [ADR 0043](decisions/0043-agent-decision-authority.md).
Work on the assigned branch (default `main`). The user assigned a local health
check before supplying a cloud-session handoff; no Next action task was started.

## This session

**LOCAL-HEALTH-2026-10-06** checked cloud-session base `d22e90d` on the actual
Arch/Hyprland laptop. [Evidence](test-evidence/LOCAL-HEALTH-2026-10-06.md).

- All toolchain pins and required host prerequisites were already installed.
  Frozen dependency installation refreshed local npm packages; lockfiles stayed
  unchanged. No system package installation or desktop setting change.
- Fixed slow Vite startup on this artifact-heavy checkout: dependency discovery
  starts at `index.html`; its file watcher ignores `target/`. Retained the
  original interrupted scan and the follow-up watcher observation. Final browser
  smoke passed in 4.275 seconds.
- `pnpm check`: 78 files / 1504 tests, formatting, lint, types, links, guidance
  and production build passed. Differential 6/6; PDF helper 17/17 (173 renders).
- Rust workspace: 275/275 on tmpfs and 275/275 on Btrfs. The first Btrfs
  invocation supplied a relative root and was rejected as unsafe; preserved that
  failure and reran the matrix with absolute roots. Rust formatting passed.
- Default release and AppImage built. Real WebKit/IPC drills passed 3/3 on Btrfs:
  writing/save/close/reopen/recovery and save/history failures, offline
  spellcheck, and PDF export. Exact bytes, restore/Undo and emergency copies
  checked. All three process/crash audits clean.
- The actual FUSE AppImage showed native-connected Home and closed ordinarily
  with exit 0, no crash events or surviving native processes. Screenshot
  inspected. This is a cold package launch, not desktop installation or a full
  packaged writing-pilot claim. Synthetic files and isolated XDG profiles only.

## Cloud work retained

The merged cloud session implemented recovery independent of refused capture
([ADR 0044](decisions/0044-recovery-independent-of-capture.md)), rolling-snapshot
retention retry at the 256 cap, writing-first layout, one recovery-open action,
Scene Heading on New, and identical-suggestion Enter handling. It also archived
finished documents, updated dependencies/audits, added snapshot times and dated
backup names, and refreshed the README.
[Cloud pilot evidence](test-evidence/PILOT-2026-10-06.md) retains its packaged
PDF, Save As, Reload, Find/Replace All, Recents, snapshot/restore/copy results.

Decision retained: text before a Parenthetical's `(` keeps its named refusal
and recovery protection. Do not silently save it as Dialogue.

## Known limitations

- [Native register](native-findings.md): accepted historical WebKitGTK aborts
  under forced teardown or `/tmp` inode exhaustion remain retained. New local
  passes do not erase those records; ordinary writing/save/close crashes still
  require repair.
- M6-02: Save As/IME readiness lag (~117 ms, content saved); shared-store lease
  limit. Capture refusals naming no row still pause recovery (emergency copy).
- The cloud container's older Chromium could not run the PDF browser smoke;
  this laptop's Chromium 153 passed it. Other native modes were not rerun here.
- Replace-All load flake, enforcing SELinux coverage, broader keyboard/a11y/IME,
  full S13 performance, desktop installation and second-host bootstrap remain
  outside this health check. Rust Clippy and new dependency audits were not
  rerun; no Rust or dependency pin changed.

## Next action

Await the user's cloud-session handoff before continuing development. The
existing ordered product queue is retained:

1. **M6-16 pilot remainder**: scene moves, title page, opening a backup copy,
   and the remaining S15.5 cases. A native permission-denied source-save drill
   now passes on this non-root laptop. When the full list passes, relax the
   README status caution to the real limits.
2. **M6-14 remainder**: desktop install/registration and packaged spellcheck.
   FUSE cold launch/ordinary close now locally verified. [Brief](tasks/M6-14.md).
3. **M6-03 remainder**: native interruption/low-space retention drill.
   Snapshot UI restore/copy already pilot-verified. [Brief](tasks/M6-03.md).
4. **Capture**: recovery copy for refusals naming no row.
5. **D-05 remainder**: protected workflows take a PreDestructive snapshot and
   treat Git history failure as a warning
   ([ADR 0030](decisions/0030-version-bound-workflow-protection.md)).
6. Later, not V1 blockers: M6-04, M6-10–13, M6-15, DEV-02, M6-05–09, AUDIT-PARK-T
   (2) duplicate Home entry after a failed resume, M7, M8.

Native drills: check `df -i /tmp`, use fresh output roots, and follow
[development guidance](development.md). Local raw results are retained under
`target/local-health-2026-10-06/`.
