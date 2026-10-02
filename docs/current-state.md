# Current state — M4-15 Tao exit-order control null; shutdown gate open

Date: 2026-10-02 PDT. Application: **babel**. Base `7aa7a08` on main;
one editing agent; no push, verified M4 tag or M5 work.

## Task and work

**Completed continuation from `7aa7a08` (Tao/Tauri exit-order control):**
source-compared the standalone control with pinned Tauri 2.12.0/Wry 0.57.0/
Tao 0.37.1. All historical cores are WebKitWebProcess. The control drained GTK
2s, unreffed its context and returned from `main`; Tauri exits via
`process::exit(0)` about two non-blocking iterations after the last window's
destroy, with the WebContext retained. Added opt-in `--exit-order tao`
(`minimal_webkit.c`/`minimal_webdriver.py`); default unchanged.

Installed stack, `target/m4-15-tao-exit-1/`: Home **4/4 strict** (171.86s),
editor-present **4/4 strict** (173.50s); host exit ~1ms after destroy, web
process sampled alive after the host was gone in 5/8 cases. Independent audit,
journal replay, 36 owned-PID core queries and two negative checks pass. The first
series failed setup (SSH shell without display variables, retained).
**Null result**: does not reproduce, exonerate or fix. Remaining mismatches:
ephemeral versus data-directory context, WebDriver-created versus app-owned view
(Wry `create-web-view`), plain `GtkWindow` versus Tao `GApplication`.
[Evidence](test-evidence/M4.md#continuation-from-7aa7a08--taotauri-exit-order-standalone-control);
invocation in the [native guide](../tests/native/writing-lifecycle/README.md#m4-15-standalone-webkit-shutdown-control).

Prior standalone control (`7aa7a08`): drain-order installed runs 8/8 strict
(Home/editor 4/4 each), `target/m4-15-minimal-webdriver-1/`, failed roots 1–11
retained. [Evidence](test-evidence/M4.md#continuation-from-473858b--standalone-webkit-control).

**M4-15 continuation completed:** added a bounded presentation control without
WebDriver, independent source/final-checkpoint/crash auditing, and an isolated
upstream-patched stack comparison. Product source and the default release remain
unchanged: SHA256 `17072c518333fdd4975625b8dfb28388325a1b7ddda2323187633f153f83602c`.

**M4-15-R2 remains complete:** Save As rollback recaptures the restored editor so
outline/counts/navigation recover without losing source, selection or Undo.
It does not resolve the underlying native adoption refusal or shutdown abort.

## Findings

- Final no-WebDriver control **2/2 strict** on tmpfs/Btrfs (~3m19s). Same frozen
  typical/stress manuscripts, real typing/Undo, zoom/theme/focus/typewriter,
  scrolling, Save As, copy-only edit/Undo and protected close; all expected source
  bytes and final recovery/confirmed heads intact. Earlier revision: 3/4 strict,
  one transient accessibility selection failure excluded from complete coverage.
- This uses AT-SPI/physical keyboard automation, with no WebDriver session or
  automation flag. IME, completion/Find, external divergence, geometry assertions
  and preference restart are omitted. Clean runs do not prove WebDriver necessary.
- Full original workload comparison: **installed before 1/1; candidate 4/4;
  installed after 1/1 strict**. Real IME/restart and every existing byte/crash gate
  retained. Independent byte/phase, retained-generation and journal audits pass
  six roots/twelve exits, zero crash events. **Comparison is inconclusive:** both
  stacks closed cleanly, so it does not demonstrate a correction.
- Candidate loader proof passes all 28 observed native tokens with expected
  executables/libraries, unchanged files and no failed token. Existing private
  2.54.0 + upstream EGL/DRM patches only; no system package replacement. All six
  candidate binary/library hashes and 14 patched-source hashes were rechecked.
- Prior evidence remains valid: preedit-off crashed 3/4; completed no-IME cases
  crashed; zoom, probe cleanup and blank navigation did not prevent crashes.
  CoreDumping starts ~110ms after close; the 13–18s delay follows the crash.
  Symbolized EGL/TLS and DRM/GBM teardown paths strengthen an upstream race lead
  but do not identify the original corrupting write.

## Paths and checks

- [Current evidence and exact commands](test-evidence/M4.md#continuation-from-58bb421--presentation-without-webdriver)
  owns coverage, failed setup attempts, timings, host/provenance and omissions.
  Artifacts: `target/m4-15-no-webdriver-1/`; five synthetic tmpfs roots retained
  in `tmpfs-evidence.tar.gz`, with explicit root inventory.
- Tools: `tests/native/writing-lifecycle/{plain_presentation,owned_accessibility,
audit_plain_presentation,test_owned_accessibility,test_plain_audit}.py`;
  invocation and prerequisites in that directory's README.
- New focused synthetic checks **5 ownership/readiness + 2 audit checks pass**;
  existing process/exit/stack observer checks **6/3/10 pass**. Live cloned-evidence
  checks reject changed bytes, a stale edited final recovery head hidden behind
  an earlier matching frame, and a false strict pass containing a crash.
- Python syntax/CLI and doc formatting/link/whitespace checks recorded in evidence.
  No product/dependency change: full frontend/Rust/build/browser suites omitted;
  prior R2 695 frontend/237 Rust gates remain snapshot-specific historical results.
- Separate same-agent source review checks ownership, mutation retry refusal,
  byte/adoption oracles, final generation heads and crash retention. No second
  reviewer or screenreader acceptance claimed. All failed probes retained.

## Blocker and next action

**M4-15 remains open.** Installed standalone controls closed cleanly; the
original integrated ordinary-close heap abort and all historical evidence remain
unresolved. Last checked Arch listing was 2.52.6-1; this continuation used that
installed version. Private patches remain isolated at
`target/m4-15-webkit-candidate-1/`, with no new comparison or system replacement.

Next bounded task: add ONE further standalone mismatch at a time on the
installed stack, combined with `--exit-order tao`. Suggested order: app-created
view handed to automation via `create-web-view` (Wry), then data-directory
context. Retain a positive installed failure before any stack comparison. The
active-caret stall is a separate setup issue. Supported corrected-runtime and
full integrated acceptance remain necessary; clean controls cannot close the gate.

M4-01–14 bounded Linux dependencies, R1 preedit and M4-08-R1 emphasis remain
accepted. Full S13/long sessions, screenreader/other platforms, installed/offline
packaging, migration/backups and Local v1 adoption remain open. Nothing pushed.
