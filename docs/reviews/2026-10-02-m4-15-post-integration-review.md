# M4-15 post-integration separate source review

Date: 2026-10-02 PDT. Base: `a97a577`, main (`origin/main` equal), release
SHA256 `0f4ba9bb83078278e6954162e2fe24166ab3a4a08b79b41eb25a9227a9fe130d`.
One editing agent ran the full native matrix, then made this separate source
pass. This is **not a second-reviewer or human sign-off claim**.
Authority: [M4-15](../tasks/M4-15.md), [ADR 0035](../decisions/0035-linux-web-process-close.md)
and the [earlier M4-15 review](2026-10-01-m4-15-review.md).
[Exact commands, artifacts, failures and limits](../test-evidence/M4.md#continuation-from-a97a577--full-native-matrix-and-post-integration-review).

Decision: **M4-15 remains open pending an owner decision on F2.** No product
defect, content loss or ordinary-close crash was found. Every functional mode
passed on tmpfs/Btrfs with the prerequisites present. Owned WebKit aborts
recurred only after **forced WebDriver session deletion**, an automation-only
path that bypasses ADR 0035. The earlier review forbids exempting these lines,
so this pass does not reclassify them.

## Findings and disposition

| ID  | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Disposition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| H2  | The default matrix recorded owned-process ledgers and journal crash scans only under `BABEL_SHUTDOWN_MODE`, which also changes teardown. A journal-only SIGSEGV (no stderr line) and two surviving app processes after forced teardown passed silently in run 1.                                                                                                                                                                                                                                                                                                 | Corrected: `integrated_exit.py` always keeps the ledger and bounded journal scan; survivors and journal events fail `crashAuditPassed`. `audit_process_watch.py` can now replay every default mode. Run 2 used it.                                                                                                                                                                                                                                                                                                 |
| P2  | `/tmp` lacked the pointer helper and absolute `/tmp/wtype`; tmpfs scene-moves failed before any product step.                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Prerequisite, not product. Rebuilt the pinned pointer helper (protocol SHA-256 verified) and copied the signature-verified wtype 0.4-2 from the isolated prefix. No global install.                                                                                                                                                                                                                                                                                                                                |
| F2  | Forced WebDriver deletion makes WebKit emit the web view `close` signal. Wry 0.57.0 handles it with `webview.destroy()` (`webkitgtk/mod.rs:466`), leaving the GTK window and app alive. The web process then runs its normal exit teardown, the same upstream EGL/GBM race ADR 0035 avoids, and `CloseRequested` never fires. Owned aborts after this phase: run 1 Btrfs title-page (SIGABRT) and script-check (SIGSEGV, journal-only); run 2 Btrfs presentation restart (SIGABRT). In two run 1 cases, the driver also left the app alive with a mapped window. | **Owner decision.** Production cannot reach this path: the frontend never calls JS `window.close()`, capabilities allow only `core:window:allow-close`, and there is no quit menu or native destroy/exit. Author bytes, checkpoints and retained generations were intact in every affected root. Options: accept it as the automation analogue of C1 and carry it to M6; authorize a harness teardown through the product close path; or extend ADR 0035 to WebKit's `close` signal. No WebKit/Mesa investigation. |
| C1  | Run 1 tmpfs editor-exit: owned WebKit SIGABRT in libc `exit`/Gallium, after the drill's deliberate parent `SIGKILL` (`editor_exit.py:317`).                                                                                                                                                                                                                                                                                                                                                                                                                      | Expected retained C1; recorded, not blocking. M6 hardening obligation unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## Separate source pass

Product delta since the last reviewed base (`e8c2304`): ADR 0035
(`src-tauri/src/lib.rs`, `webkit2gtk` `v2_34`), the R1 preedit enable and the
R2 rollback recapture (`src/app/WritingView.tsx`).

- **Data loss / version races:** `end_web_content_before_close` runs only when
  `DocumentHost::has_open_documents()` is false. A poisoned lock reports
  open, so close stays protected. With documents open, close is still
  prevented and handed to protected close. The frontend reaches
  `getCurrentWindow().close()` only after the close coordinator reaches
  `closed` and `finishClose()` retires the session. An open still in flight
  natively at close time was already unprotected before this change and holds
  no unsaved author content. R2 rollback calls `changed()`, which records
  through `noteEdit()` only when `snapshot.version > liveVersion`, so the
  restored state cannot create a spurious edit or credit a save.
- **Lossy preference writes:** every `localStorage` writer
  (`viewPreferences`, `recentPosition`, `shortcuts`) calls `setItem`
  synchronously. The 250ms scroll-position timer is flushed by
  `disposePosition`, and protected close writes the position before
  `close()`. There are no `beforeunload`/`pagehide`/`unload` handlers. A
  future handler would not run on the ADR 0035 path. Native restart oracles
  (daily-session, presentation) re-verified preferences and positions.
- **Bypass paths:** JS `destroy()` is not permitted by capability and not used.
  No native `exit`/`RunEvent`/quit menu exists. Forced WebDriver deletion
  bypasses the close event (F2) and is test-only.
- **Privileges/egress:** no new command, capability, permission, network
  client or dependency version. `webkit2gtk = 2.0.2` was already pinned;
  `Cargo.lock` only gains the direct edge.
- **Input/Undo:** R1 enables WebKit client preedit at setup and fails startup
  only if the main WebView is missing. Native pinyin/Mozc/dead-key commit,
  cancel and Undo oracles passed on both filesystems in both runs.
- **Missing failure tests:** H2 above. Terminate failure only logs and lets
  close continue (the pre-ADR behaviour). There is no automated test for that
  branch. Native ordinary-close evidence covers the success path.
- **Contract drift:** ADR 0035 matches the code. Its "Evidence still needed"
  should name F2 (automation close signal) next to JS `destroy()`.

## Retained limits

SC005/SC008 export assessment stays unavailable until M5. C1 and dependency
hardening, screenreader, installed/offline packaging, other platforms, full
S13 and long sessions, migration/backups and Local v1 adoption remain open. No
M4 tag, push or M5 work.
