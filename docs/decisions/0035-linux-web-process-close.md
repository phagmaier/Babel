# ADR 0035: End the Linux web process on accepted window close

Status: **Accepted direction**
Date: 2026-10-02

## Context

After an ordinary window close, the WebKitGTK 2.52 web process intermittently
aborted (`corrupted double-linked list`, SIGSEGV/SIGABRT) during its own
exit-time EGL/GBM/Skia teardown. Symbolized stacks match upstream WebKit
[305909](https://bugs.webkit.org/show_bug.cgi?id=305909) and
[315577](https://bugs.webkit.org/show_bug.cgi?id=315577). The app process never
aborted, and author bytes, recovery frames and checkpoints were intact in every
crashed root. Standalone controls without Babel's page did not reproduce it.

## Decision

When the native window receives a close request and no document registration
remains open (the protected-close flow has already completed), call
`webkit_web_view_terminate_web_process` synchronously on the main thread
before Tauri drops the window. The web process then exits without running the
teardown that crashes. A close with open documents is still cancelled and
handed to protected close, unchanged.

This enables the `v2_34` feature of the already pinned, MIT-licensed
`webkit2gtk = 2.0.2` Linux crate (same version, `Cargo.lock` unchanged). It adds
no engine, command, permission, network access or frontend change.

## Alternatives

- Continue bisecting WebKit/Mesa or ship a private WebKit: unbounded, and
  distribution users would not get the fix.
- Drain the GTK loop, blank-navigate or idle before exit: blank navigation plus
  five seconds still crashed.
- Treat the crash as acceptable: it leaves crash reports and a 13–18s core-dump
  linger after every affected close.

## Consequences

The web process owns no author state at this point. `localStorage` view
preferences, recent positions and shortcuts are written before the close
request and persisted by the network process, which exits normally. Native
restart oracles verified them after the change. No `beforeunload`/`pagehide`
handlers exist; adding one later would not run on this path. A JS `destroy()`
bypasses the close event and keeps the previous exit behavior. So does forced
WebDriver session deletion (inferred: WebKit's `close` signal, which Wry handles
by destroying only the view). The same teardown abort recurred after it in the
M4-15 matrix. That path is test-only, since production never calls `window.close()`,
and is carried with C1 to M6. Remove this
when a supported WebKitGTK release fixes the teardown race and evidence shows
ordinary close is clean without it.

## Evidence

[M4 evidence](../test-evidence/M4.md#continuation-from-8e21ee3--terminate-web-process-on-accepted-close):
unchanged binary 2/4 crashed on the reproducer; mitigated 8/8 on the same
command, 4/4 full workload on tmpfs/Btrfs, final binary 2/2. Zero owned cores
across 84 mitigated PIDs; Tier 2 shared gates pass.
Evidence still needed: other Linux distributions/GPU drivers, packaged/installed
builds and long sessions. The [M4-15 integrated exit](../test-evidence/M4.md#continuation-from-a97a577--full-native-matrix-and-post-integration-review)
passed bounded Linux: 38/38 functional, with no ordinary-close abort.
