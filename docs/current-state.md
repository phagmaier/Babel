# Current state — 2026-10-06

Application: **babel**, local-first Linux screenwriting (Tauri/React/Rust).
Agents decide under [ADR 0043](decisions/0043-agent-decision-authority.md).
Branch: `main`. The bounded M6-16 laptop pilot is complete; Local v1 admission
and desktop installation remain open. No adjacent implementation was started.

## This session

**M6-16 pilot remainder** ([brief](tasks/M6-16.md),
[evidence](test-evidence/M6-16-2026-10-06.md)) reconciled all twelve SPEC S15.5
steps and completed the packaged writing/restore cases on the development laptop.

- FUSE mounted externally, then packaged AppRun/WebKit/GTK/IPC ran offline
  with normal mapped UID 1000, zero capabilities and private synthetic profiles.
  This differs from direct cold FUSE launch and desktop registration.
- New/all-elements/completion/Enter, three-scene writing, title/dialogue edits,
  scene move, Find/Replace, snapshots and former-current-draft restore passed.
  Exact authored source, BOM/CRLF/unknown-key/note/omission, Save/Undo/Redo and
  ordinary close/restart/preferences/reopen verified.
- Packaged permission-denied save, latest acknowledged checkpoint after owned
  SIGKILL/restart, external divergence and exact emergency copy passed. The
  laptop is non-root; the cloud root-bypass limitation does not apply here.
- Backup copied to separate tmpfs; working Btrfs directory made unavailable;
  restart/open backup/Save As to fresh Btrfs/close/reopen passed exact bytes.
  Independent Screenplain reader verified exported Fountain title/dialogue/order.
- Same-capture packaged PDF preview/export matched two-page layout/raster;
  omission/refusal/failure/source isolation passed. Pages/screenshots inspected.
- Four required package modes have clean passing runs. Final harness rerun:
  `typed-export`/`local-pilot` 2/2, zero crash events/surviving native processes.
  New Python syntax, touched-doc format/links/guidance/diff checks passed.
- Short writing session: 278 authored words, 1,526 trusted typed characters;
  frame proxy p95/max 15/21 ms. Separate 2,400-row preview workload preserved
  all 120 physical inputs, proxy p95/max 25/33 ms. Not full S13/compositor proof.
- No production/dependency/build change. Vite entry/watch fix preserved. Added
  repeatable packaged runner/pilot/artifact auditor; corrected obsolete M6-16
  process gates. README status updated, pre-release/backup caution retained.

## Retained candidate and failures

Unchanged health build at `dc3c3b8`; session base `1841933`.
[Health evidence](test-evidence/LOCAL-HEALTH-2026-10-06.md) retains frontend
78 files/1504 tests, Rust 275 per tmpfs/Btrfs, differential 6/6, helper 17/17,
Chromium PDF/layout, native release 3/3 and direct FUSE cold launch. These are
justified unchanged evidence, not new runs. Cloud results remain separately in
[earlier pilot](test-evidence/PILOT-2026-10-06.md).

New raw artifacts: `target/m6-16-pilot-2026-10-06/`. Initial direct namespace
launch could not mount FUSE. A root-mapped/drop-cap mounted run had two GTK
icon-loader picker SIGABRTs; copied/hash-bound cores, checkpoints, ledgers and
strict failures retained. Normal UID runner corrects that test configuration;
it does not erase the aborts. First second-restore attempt overlapped pending
Save and was safely refused; waiting for readiness passed twice.
[Native register](native-findings.md#m6-16-runner-only-events).

## Known limitations

- Desktop registration/install and packaged spellcheck are M6-14; native
  interruption/low-space retention remains M6-03. Mounted-package writing is
  not installed-app acceptance. M6-16 final requirement/admission review open.
- Backup is a separate filesystem on the same laptop, not an independent
  physical disk/power-loss backup. Real-software migration and second-host
  bootstrap deferred; keep independent backups and the old writing workflow.
- Full S13/long session, broader IME/keyboard/a11y, enforcing SELinux and
  retained Replace-All load flake remain outside this pilot. Optional help and
  Find/export/snapshot panels can consume substantial viewport space.
- Historical [native findings](native-findings.md) remain accepted under ADR
  0043 with original strict failures. Ordinary supported writing/save/close
  crashes, content loss or false saved status require repair.
- M6-02 Save As/IME readiness lag (~117 ms, content saved), shared-store lease
  limit, and capture refusals naming no row remain known limitations. Named
  Parenthetical refusal is preserved; never silently save it as Dialogue.
- No new full matrix, CI, Clippy/dependency audit, native/helper build,
  Local v1 admission or release tag claimed.

## Next action

Stop after this bounded pilot's commit/push. Next session takes item 1;
no M6-14/M6-03/M7 or adjacent task was started here.

1. **M6-14 remainder**: desktop registration/install and packaged spellcheck.
   Direct cold FUSE launch and mounted-package offline writing/PDF/restore are
   verified. [Brief](tasks/M6-14.md).
2. **M6-03 remainder**: native interruption/low-space retention drill.
   Packaged snapshot restore/copy/backup-open is pilot-verified. [Brief](tasks/M6-03.md).
3. **M6-16 admission review**, after M6-14/M6-03: refresh requirement evidence
   and resolve the actual installation/release gaps. [Brief](tasks/M6-16.md).
4. **Capture**: recovery copy for refusals naming no row.
5. **D-05 remainder**: protected workflows take a PreDestructive snapshot and
   treat Git history failure as a warning ([ADR 0030](decisions/0030-version-bound-workflow-protection.md)).
6. Later, not V1 blockers: M6-04, M6-10–13, M6-15, DEV-02, M6-05–09,
   AUDIT-PARK-T (2) failed-resume duplicate Home entry, M7, M8.

Native drills: check `df -i /tmp`, use fresh output paths and absolute filesystem
roots; follow [development](development.md) and the registered native guide.
