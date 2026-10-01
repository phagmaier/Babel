# Current state — M4-15 tracked ordinary exit abort; gate open

Date: 2026-10-01 PDT. Application: **babel**. Base `98f17a1` on main;
one editing agent, no push or M4 verified tag.

## Task and work

**M4-15 diagnostic continuation:** presentation without preference restart,
continuous descendant attribution and bounded crash journal scans; reviewed
upstream exit-fix investigation. No product source/dependency/stack upgrade.
Default release SHA256 remains `6fbb10a5…`.

No-restart paired probe: **8/8 strict** on tmpfs/Btrfs, one exit per root,
all typical/stress/zoom/real IME/Undo/divergence/Save As/document-close byte
oracles retained. Independent byte/checkpoint and retained-generation audits
passed. Preference restart coverage is explicitly omitted.

Tracked default restart probe: **7/8 strict**, one owned ordinary tmpfs heap
abort (PID596906). It fires at the first presentation exit **before restart**,
pre-stale-session DELETE. Restart reuse is therefore not a necessary trigger;
clean no-restart repeats suggest timing/exposure, not a correction.
Functional bytes and all 16 exit sequences complete; crash still blocks M4.

Tooling now retains PID/start tokens and first-observed parent links across
sibling processes, restarts and orphaning, with continuous polling and measured
gaps. Bounded per-case kernel/coredump events, unproved attribution, failed
journal reads and surviving native processes fail the strict matrix. Polling
can miss very short-lived processes; late journal delivery remains an omission.
Initial journal reader skipped oversized `MESSAGE: null`; fixed and covered by
regression. Exact retained-window replay independently detects the owned abort.
Original manifests/scans are preserved; corrected results are separate.

## Paths and checks

- Harness: `tests/native/writing-lifecycle/{presentation_workflows,drill,shutdown_isolation,integrated_exit,process_watch,audit_process_watch,audit_shutdown,audit_retained,test_process_watch}.py`; commands/limits in native guide and development docs.
- [Diagnostic evidence](test-evidence/M4.md#continuation-from-98f17a1--no-restart-probe-and-continuous-attribution) owns exact commands, time, manifests, audits, host metadata, failures and upstream snapshots.
- No-restart: 8/8 strict (~11m13s); independent 8 roots/8 exits and retained 8/96/32/0/32 roots/frames/snapshots/refs/previous sources. Bounded post-run journal scan zero events.
- Tracked restart: 7/8 (~11m56s); byte/phase audit 8 roots/16 exits including failed root; successful-only retained audit 7/84/28/0/28. Journal replay 7/8 with one owned event. All 16 observed web-process tokens retained; max sampling gaps 84–88ms.
- Owned SIGABRT core inspection: allocator/Gallium/GBM/WebKit/exit plus concurrent EGL/WebKit TLS destruction; no symbols downloaded or proven corruption origin.
- Five synthetic tracking/journal regressions, disposable real helper-process smoke, doctored-audit rejection/exclusion and prior-manifest compatibility passed. Final Python syntax/CLI, selected Prettier, changed local-link and whitespace
  checks passed. Shared/build/full matrix omitted: tooling-only, unchanged binary,
  no gate closure. Separate same-agent source pass recorded; no second reviewer.
- Corrected tracked Home control **8/8 strict** (~5m34s), zero crash lines/events;
  retained audit 8/168/24/0/24, exact-window replay 8/8. Max sampling gap 115ms.
  Output: `/tmp/babel-m4-15-tracked-home-1/`. Presentation frozen-byte auditor does not cover Home; retained checksum audit applies.

## Blocker and next action

Two reviewed upstream WebKit fixes landed September 24: EGL/Skia exit ordering
and synchronization (`e0b1fdd…`, bug305909), DRM singleton exit destruction
(`bd89b1e…`, bug315577). Their mechanisms fit the observed paths; this is an
inference. Both 2.52.6 and released 2.54.0 retain the old paths; upgrading to
2.54.0 alone would not test these fixes. No corrected supported build tested. EGL patch needs backport adaptation on
2.52.6 (five files) and 2.54.0 (one file); DRM patch dry-run applies to 2.52.6.
No patch applied or library built.
Snapshots/patches/host metadata: `/tmp/babel-m4-15-upstream-exit/`.

Next: validate a supported stack containing the reviewed fixes with exact
provenance, then rerun affected paired/integrated/native/shared gates. Preserve
byte oracles and crashes; never tag M4 on clean repeats. Historical home
PID578310 remains unattributed. Cold Home controls do not prove automation is
necessary for arbitrary presentation content. No guessed product workaround.

M4-15-R1 genuine Linux preedit and M4-08-R1 emphasis correction remain complete;
M4-01–14 bounded Linux dependencies accepted. Stop at M4; no M5 implementation.
SC005/SC008 assessment waits for M5. C1/dependency hardening, full S13/long-session,
screenreader/other platforms, installed/offline packaging, migration/backups and
Local v1 adoption remain open. Nothing pushed.
