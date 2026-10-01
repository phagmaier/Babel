# Current state — M4-15 ordinary window-close abort reproduced

Date: 2026-10-01 PDT. Application: **babel**. Main, continuation from clean
`2e3ea2a`; one editing agent, no push or M4 verified tag.

## Task and work

**M4-15 shutdown isolation** is implemented and exercised. **M4-15 remains
blocked**: ordinary graceful native window close under WebView automation
reproduces the WebKit heap abort before any session DELETE. A forced-only
teardown disposition is invalid. No product/native dependency changes.

The paired runner uses the same default release SHA256 `6fbb10a5…`, fresh
profiles, typical/stress presentation workflows, genuine pinyin/Undo/divergence/
Save As/protected document-close oracles and preference restart. Ordinary and
forced arms alternate order. Logs retain owned PID/start-time tokens and exact
request/process-exit/stale-session-cleanup boundaries. Crash detection is intact.
A separate direct-launch control removes WebView automation and WebKitWebDriver.
It exercises only cold Home/window close, with no drafting/content claim.

M4-15-R1 genuine Linux preedit and M4-08-R1 replaced-emphasis correction remain
complete. M4-01–14 bounded Linux dependencies remain accepted. Stop at M4;
no M5 implementation or accepted M4 gate.

## Paths and checks

- Native harness: `tests/native/writing-lifecycle/{shutdown_isolation,shutdown_lifecycle,plain_quit,audit_shutdown,drill,presentation_workflows}.py` and guide; command additions in development docs.
- [Shutdown evidence](test-evidence/M4.md#continuation-from-2e3ea2a--ordinary-and-forced-shutdown-isolation) owns exact commands, host drift, manifests, hashes, core timing/stacks and verification results.
- Paired native probe: **5/8 strict cases passed**; all four tmpfs pass, Btrfs has two ordinary-close and one forced-delete heap aborts. **Three owned SIGABRT cores**; ordinary PID495675 aborts between native close request and observed process exit, over one second before stale session DELETE. Another ordinary case times out after its close request/abort; incomplete phase record remains failed.
- Independent fixed-byte/checkpoint/phase-prefix audit: **8/8 roots, 15 attempted exits**, including all three crash-failed roots. One root has an incomplete exit sequence; no success relabelling. Broader retained audit: **5 successful roots / 60 frames / 20 snapshots / 20 previous sources**.
- Non-automation cold Home control: **8/8 passed**, four per filesystem; no stderr heap error or core for its eight owned WebKit PIDs. Different workload/profile lifecycle, so this does not establish automation as the cause or a fix.
- Shared **694/56** frontend tests plus formatting/lint/typecheck/build and browser smoke passed; Rust fmt/clippy and **237 tests each on tmpfs/Btrfs** passed. Python syntax/CLI entry points and changed local links passed; final whitespace check recorded in evidence.
- Separate same-agent diagnostic source/core review recorded; no second-reviewer/human sign-off claim.

## Blocker and next action

C2 now includes ordinary graceful window-close failures under automation, not
only forced teardown. Main-thread core inspection shows libc allocator abort,
Gallium and `exit`; corruption origin is unproved. Current host is kernel
7.2.7-arch1-1 and Mesa 26.2.3 (historical host notes were older); no stack upgrade
was performed by this task. Non-automation control did not reproduce the abort.

Next **M4-15** action: obtain a minimal repeated cold-Home/restart reproducer
that compares automation and ordinary production lifecycles with matching
profile/startup timing, then investigate supported WebKit/Mesa exit behavior
and a justified fix. Preserve crash/core evidence and exact byte/checkpoint
oracles; rerun affected integrated/native gates after a real correction.
Do not filter crashes, ship a guessed workaround or tag M4 on clean repeats.

SC005/SC008 assessment remains unavailable until M5. C1/native dependency
hardening, screenreader/other platforms, installed/offline packaging, full
S13/long-session, migration/backups and Local v1 adoption remain open. Nothing
pushed.
