# Current state — M2-05D protected close passed

Date: 2026-09-28 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [ADR 0019](decisions/0019-protected-close-lifecycle.md), [M2-05D evidence](test-evidence/M2.md#m2-05d--protected-close-and-failure-escalation).

## Completed task and trust boundary

**M2-05D completed its bounded headless/Linux native/WebKit acceptance on main.** Base `e099840`, clean starting tree and no dirty paths. M2-05A–D now pass their recorded bounded gates, so parent M2-05 is complete. M2-06 and the full M2 exit remain open; Local v1 remains unverified. No production picker, editor, cadence or Save As was added.

`ProtectedClose` synchronously freezes the sole editor owner, captures the latest version and waits for an exact source receipt (named file) or recovery receipt (unsaved draft). Failure thaws and keeps the editor open. Retry, native-selected Emergency Copy and explicit risk remain available. A copy receipt grants no source/recovery credit; both source and recovery failure visibly means newer edits exist only in memory. Native risk release is a separate exact-registration operation that refuses queued work and retains uncertainty artifacts. The desktop blocks OS window close while a registration exists and routes the event to the synthetic editor's close policy.

## Paths and checks

- Core/desktop: `documents/linux.rs`, `source_store_tests.rs`, `src-tauri/src/{lib.rs,persistence_host.rs}`, narrowly scoped event-listen/window-close capabilities. Existing source/recovery/copy engines and production picker initialization remain as before.
- Frontend/diagnostic: `protectedClose.ts`, `ProtectedClosePanel.tsx`, native adapter/types and injected tests; synthetic composition editor F3/F9/F10/F11 close routes; snapshot diagnostic handles native release. ADR 0019 and owning docs/trace/TODO updated.
- [M2-05D evidence](test-evidence/M2.md#m2-05d--protected-close-and-failure-escalation) records exact commands, host, logs/screenshots and native versus mocked results. Real WebKit: latest v8 native close saved exact bytes; external divergence held the window and exact v7 emergency copy preserved both; simultaneous source/recovery failure held the window with memory-only warning until explicit checkbox risk close. Native tmpfs/Btrfs risk/fault paths and strict frontend/UI cases passed. Full workspace outside sandbox passed 160 entries. Initial sandbox ACL/xattr `EINVAL` was reproduced, then the same focused and workspace tests passed outside the sandbox on Btrfs without disabling the test.

## Limits and next action

The close panel is an integration contract; production editor/picker/cadence wiring and installed/offline close testing remain. Synthetic ENOSPC and existing SIGKILL matrices do not prove hardware power loss. The event guard fails closed if delivery fails. Other platforms, actual disk-full, physical-disk independence, configured backups and Save As are open. M2-06 owns curated history primitives and a full M2 safety gate; M6 owns production integration/adoption. Do not use important manuscripts in this build.

Next: select **M2-06 small history primitives and safety gate** after reviewing this checkpoint. Work on main, put task ID in commit messages, and never push without human review and explicit authorization.
