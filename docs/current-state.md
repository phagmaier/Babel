# Current state — M4-15 auditor fixed; block stands (5/8 paired, 8/8 control)

Date: 2026-10-01 PDT. Application: **babel**. Main at `6be6dc1`; one editing
agent, no push or M4 verified tag.

## Task and work

**M4-15 matched reproducer rerun is complete; M4-15 remains blocked.** Same
default binary `6fbb10a5…` (no rebuild; post-`7cade34` delta is docs-only),
same verified Fcitx prefix, fresh profiles, arm order alternated. Paired
presentation probe under automation: **5/8 strict** (~12 min wall) — one
functional drill failure (no crash), two heap aborts (ordinary tmpfs
`corrupted double-linked list`, forced Btrfs `free(): corrupted unsorted
chunks`). Non-automation cold-Home control: **8/8** (<1 min), no crash lines.
Two new owned WebKitWebProcess SIGABRT cores (PIDs 520856, 526885). No
product/native dependency changes.

Follow-up done: `audit_shutdown.py` now reports drill-failed roots (zero
exits, no byte claim, failed verdict asserted) instead of crashing; verified
on repro (8/14/2/1), prior (8/15/3/0, unchanged), and a doctored manifest
(rejected). Test-tooling only.

The paired runner uses the same default release SHA256 `6fbb10a5…`, fresh
profiles, typical/stress presentation workflows, genuine pinyin/Undo/divergence/
Save As/protected document-close oracles and preference restart. Ordinary and
forced arms alternate order. Logs retain owned PID/start-time tokens and exact
request/process-exit/stale-session-cleanup boundaries. Crash detection is intact.
A separate direct-launch control removes WebView automation and WebKitWebDriver.
It exercises only cold Home/window close, with no drafting/content claim.
Rerun outputs: `/tmp/babel-m4-15-repro-paired-1/` (+ `results.json`,
`/tmp/babel-m4-15-repro-retained.json`) and `/tmp/babel-m4-15-repro-plain-1/`.

M4-15-R1 genuine Linux preedit and M4-08-R1 replaced-emphasis correction remain
complete. M4-01–14 bounded Linux dependencies remain accepted. Stop at M4;
no M5 implementation or accepted M4 gate.

Process update (this session): added Tier 1/2/3 check policy to
`docs/development.md`, tier pointer in `docs/testing.md`, and Tier wording in
`AGENTS.md`. No product code, SPEC, or milestone gate changed; M4-15 blocker
unchanged.

## Paths and checks

- Native harness: `tests/native/writing-lifecycle/{shutdown_isolation,shutdown_lifecycle,plain_quit,audit_shutdown,drill,presentation_workflows}.py` and guide; command additions in development docs.
- [Shutdown evidence](test-evidence/M4.md#continuation-from-2e3ea2a--ordinary-and-forced-shutdown-isolation) owns exact commands, host drift, manifests, hashes, core timing/stacks and verification results.
- Paired native probe: **5/8 strict cases passed**; all four tmpfs pass, Btrfs has two ordinary-close and one forced-delete heap aborts. **Three owned SIGABRT cores**; ordinary PID495675 aborts between native close request and observed process exit, over one second before stale session DELETE. Another ordinary case times out after its close request/abort; incomplete phase record remains failed.
- Independent fixed-byte/checkpoint/phase-prefix audit: **8/8 roots, 15 attempted exits**, including all three crash-failed roots. One root has an incomplete exit sequence; no success relabelling. Broader retained audit: **5 successful roots / 60 frames / 20 snapshots / 20 previous sources**.
- Non-automation cold Home control: **8/8 passed**, four per filesystem; no stderr heap error or core for its eight owned WebKit PIDs. Different workload/profile lifecycle, so this does not establish automation as the cause or a fix.
- Shared **694/56** frontend tests plus formatting/lint/typecheck/build and browser smoke passed; Rust fmt/clippy and **237 tests each on tmpfs/Btrfs** passed. Python syntax/CLI entry points and changed local links passed; final whitespace check recorded in evidence.
- Separate same-agent diagnostic source/core review recorded; no second-reviewer/human sign-off claim.
- Check-tier docs change: `prettier --check` passed on touched files; changed-file link target check passed; `git diff --check` passed. No executable suite (docs-only, no commands/config changed).
- Reproducer rerun: harness syntax passed; paired `5/8` strict with 2 heap-abort crash lines (ordinary + forced) + 1 functional drill failure; `audit_retained` 5/60/20/0/20 passed; plain control `8/8` passed; 2 new owned SIGABRT cores. Shared gates not repeated (same binary, no source change). Auditor fix: syntax + repro/prior/doctored manifests verified. Full detail in [M4 evidence](test-evidence/M4.md#continuation-from-5f3021f--matched-reproducer-rerun-same-binary).

## Blocker and next action

C2 now includes ordinary graceful window-close failures under automation, not
only forced teardown. Main-thread core inspection shows libc allocator abort,
Gallium and `exit`; corruption origin is unproved. Current host is kernel
7.2.7-arch1-1 and Mesa 26.2.3 (historical host notes were older); no stack upgrade
was performed by this task. Non-automation control did not reproduce the abort.

Next **M4-15** action: narrow the corrupting workload under automation and
investigate a supported WebKit/Mesa exit fix. Preserve crash/core evidence and
exact byte/checkpoint oracles; rerun affected integrated/native gates after a
real correction. Do not filter crashes, ship a guessed workaround or tag M4 on
clean repeats.

SC005/SC008 assessment remains unavailable until M5. C1/native dependency
hardening, screenreader/other platforms, installed/offline packaging, full
S13/long-session, migration/backups and Local v1 adoption remain open. Nothing
pushed.
