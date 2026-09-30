# Current state — M4-01 native recents complete

Date: 2026-09-29 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [index](index.md).

## Task and work

**M4-01 complete — bounded Linux native service gate.** One editing agent on main from `3017af9`, initially clean; no prior dirty paths, no push authorized. M4-00 decomposition and the bounded M3 gate remain complete.

Delivered bounded private native recent metadata, strict path-free list/remove/open/locate/confirm commands, typed adapter, successful open/save/Save As/relink registration and separate unsaved recovery. Staged native locate requires explicit link/different choice, rejects stale source/project generations and competing ownership, preserves moved identity/recovery, and retains unknown managed JSON plus prior mapping for confirmed renames. Corrupt/unsafe/interrupted metadata reports attention while ordinary source/recovery protection stays usable. [ADR 0028](decisions/0028-native-recent-projects.md) owns format, limits, deduplication and policy.

Changed code: `crates/screenwriter-core/src/documents/{recents,recent_store,recent_store_tests}.rs` and existing open/Save As/save/relink integration; `src-tauri/src/recent_projects_host.rs`, IPC tests/entry picker visibility/command wiring; typed `src/application/recentProjects.ts`, document errors and native adapter; focused contract tests; task mode in `tests/native/writing-lifecycle/`. Changed docs: task/TODO/trace/index, owning persistence/architecture/UX, ADR 0028/0012 follow-up, corrected production-build instruction, development/native guide and evidence. No SPEC, dependency/lockfile, runtime capability, fixture or editor change.

## Verification

[M4-01 evidence](test-evidence/M4.md#m4-01--native-recents-and-missing-file-selection) owns exact commands/host/logs and failed attempts. Focused contracts, native registry and generated MockRuntime dispatch passed. Shared frontend checks pass **498 tests / 33 files**, Chromium smoke, Rust formatting/lint and **223 workspace tests per filesystem**. Real child-process registry/managed-mapping interruptions preserve previous exact metadata/source/identity on tmpfs/Btrfs.

Default production release built through Tauri CLI, without proof features. Real WebKit IPC/GTK picker/restart drills passed on tmpfs/Btrfs: cancellation, exact source reopen, missing/moved identity, explicit different/read-only selection, Save As rollback/publication, metadata-only remove and corrupt-registry checkpoint/source-save isolation. These verify native services/pickers; Home presentation is still M4-02. Documentation links/status/unchanged trace/formatting, harness syntax and final whitespace checks passed. No new milestone tag or push.

Failed first attempts are recorded honestly: test-only compile mistakes, old tests selecting arbitrary JSON/expecting locks only, and the M4 brief's plain-Cargo release loading a development URL. Corrected tests and production-build instructions; final gates passed without disabling checks or widening permissions.

## Remaining concerns and next action

**Next: [M4-02 Home, recents and recovery workflows](tasks/M4-02.md).** Integrate the typed service into visible Home controls and retain protected switching, full-byte recovery and truthful attention/mismatch choices. M4-03/04/06/11 are also ready; proceed sequentially. M4-13 owns hash/identity-safe recent position; M4-15 requires every task plus separate safety review. M4-02–15 remain open; no full M4 or Local v1 claim.

RustSec transitive GLib unsound-iterator/unmaintained macro concerns and **C1 recurring WebKit child heap abort** during deliberate prior Btrfs parent SIGKILL remain tracked. Exact corruption origin and ordinary editing/close impact are unresolved; prior source/checkpoint recovery passed. Native dependency/license/packaging and symbolized graphics lifecycle review remain specialized hardening before adoption. M4-01 does not resolve those concerns.

Full compositor/page calibration, long-session heap/DOM/catalog scaling, actual disk-full/power loss, other platforms/filesystems, installed/offline package, backup/migration and owner pilot remain open. M5 owns PDF/production renderer/font assessment; production history UX and remote transfer remain later work. Completion uses a local main commit; no push or publication.
