# Current state — M4-15 private corrected WebKit build; gate open

Date: 2026-10-01 PDT. Application: **babel**. Base `14bed14` on main;
one editing agent, no push or M4 verified tag.

## Task and work

**Claimed M4-15 continuation:** supported-release/backport availability refreshed;
signed 2.54.0 source staged with official stable EGL and reviewed upstream DRM
patches. Private build configuration passes; compilation is in progress.
No candidate installed or tested natively yet; acceptance remains open.

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

- Harness: `tests/native/writing-lifecycle/{presentation_workflows,drill,shutdown_isolation,integrated_exit,process_watch,audit_process_watch,audit_shutdown,audit_retained,test_process_watch,stack_probe,test_stack_probe}.py`; commands/limits in native guide and development docs.
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

The official `webkitglib/2.54` branch contains EGL backport `b33979e…`
(September 30), eliminating the need for a local C++ adaptation. Its pinned
head still has the old DRM singleton; checked 2.52 branch retains both old
paths. Published stable release is 2.54.0; Arch offers 2.52.6-1. Neither
published candidate checked here contains both fixes.

Private diagnostic candidate: signed 2.54.0 + `b33979e…` + `bd89b1e…`,
14 source files changed by upstream patches, no local C++ edits. Source signature
and SHA256, 43 signed build-only packages, exact commands and source hashes
retained. System WebKit and Babel binary unchanged. Configuration passes with
GTK3/libsoup3/Wayland/GBM/spellcheck/WebDriver; two-job compilation is running.
This is not a distribution-supported corrected package or a verified fix.

New optional stack observer verifies live library mappings and executable
identities in owned descendants, checkpoints evidence and rejects changed
tooling/files. Btrfs mapping-device identity is observed through a private
read-only mmap, separately from stat device identity. Eight observer checks
pass on tmpfs/Btrfs; six process-watch regressions pass, including current-name
updates after exec while preserving the first name. Corrected system-stack
tooling smoke passes 4/4 Home cases on both filesystems and 28 native tokens;
retained audits and exact-window journal replay pass with zero events. These are not corrected-stack
or performance acceptance results; compilation overlaps the tooling smoke.

Paths: `target/m4-15-webkit-candidate-1/{webkitgtk-2.54.0,build,provenance}`;
`/tmp/babel-m4-15-supported-stack-1/{build-1.log,build_private.py}`.
[Preparation evidence](test-evidence/M4.md#continuation-from-14bed14--official-stable-backport-and-private-build)
owns commands, provenance, failures and status. Prior investigation snapshots
remain at `/tmp/babel-m4-15-upstream-exit/`.

Next: inspect compilation result, install only into the candidate's private
prefix, and prove Babel/owned WebKit processes load the candidate libraries and
executables before running paired/integrated/native/shared gates. The IME wrapper
replaces LD_LIBRARY_PATH; any candidate paths must be set in its child command.
Preserve byte oracles and crashes; never tag M4 on clean repeats. Historical home
PID578310 remains unattributed; cold Home controls do not establish a fix.

M4-15-R1 genuine Linux preedit and M4-08-R1 emphasis correction remain complete;
M4-01–14 bounded Linux dependencies accepted. Stop at M4; no M5 implementation.
SC005/SC008 assessment waits for M5. C1/dependency hardening, full S13/long-session,
screenreader/other platforms, installed/offline packaging, migration/backups and
Local v1 adoption remain open. Nothing pushed.
