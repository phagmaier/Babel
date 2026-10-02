# Current state — M4-15 controls complete; shutdown gate open

Date: 2026-10-01 PDT. Application: **babel**. Base `58bb421` on main;
one editing agent; no push, verified M4 tag or M5 work.

## Task and work

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

**M4-15 remains open.** This turn neither reproduced an ordinary-close crash
without WebDriver nor established that the private patches fix it. No supported
corrected package is available in the checked Arch listing (still 2.52.6-1).
The private prefix remains isolated at `target/m4-15-webkit-candidate-1/`.

Next bounded task: build a minimal GTK/WebKit WebDriver stress reproducer using
the implicated page size, interactions and graceful-close order, to remove Babel
code from the comparison. Retain positive installed-stack failure evidence and
match the trigger before attributing any clean patched-stack results. A supported
corrected runtime still needs full integrated acceptance; a private prefix cannot
close the distribution gate. Preserve all historical crashes and byte oracles.

M4-01–14 bounded Linux dependencies, R1 preedit and M4-08-R1 emphasis remain
accepted. Full S13/long sessions, screenreader/other platforms, installed/offline
packaging, migration/backups and Local v1 adoption remain open. Nothing pushed.
