# Current state — M4-15 standalone control validated; shutdown gate open

Date: 2026-10-02 PDT. Application: **babel**. Base `473858b` on main;
one editing agent; no push, verified M4 tag or M5 work.

## Task and work

**Claimed continuation:** standalone GTK/WebKit WebDriver stress/ordinary-close
probe, removing Babel application code. Installed stack first; retain failures,
process identities and close timing. No product change or gate advancement.

**Standalone GTK/WebKit control completed and validated.**
`minimal_webkit.c` / `minimal_webdriver.py` now drive complete 2,703/27,003-row
pages with trusted typing, exact WebCore native Undo, twelve zoom/scroll steps
per page, screenshots, live installed-library hashes and PID/start-owned close.
Six refusal/ownership/provenance tests in `test_minimal_webdriver.py`; invocation
and control differences in the [native guide](../tests/native/writing-lifecycle/README.md#m4-15-standalone-webkit-shutdown-control).

Installed runtime **8/8 strict**: Home close 4/4 (181.73s recorded case time),
editor-present close 4/4 (182.10s). Both use ordinary GTK destroy, two-second
main-loop drain, complete descendant exit before session DELETE, then expected
driver SIGTERM. Independent raw text/event/hash/library/phase/drain/journal
audits pass; zero crash lines/core observations/events/fallbacks/survivors.
Source/host/driver hashes stayed unchanged during final runs. This validates the
control, **does not reproduce Babel's abort or establish a fix**.

Artifacts: `target/m4-15-minimal-webdriver-1/`; all failed setup/control roots
1–11 retained. Ctrl+Z delivered trusted keys without native Undo; default now
uses WebCore Undo and records trusted `historyUndo`. Active-caret rendering
controls timed out before close even at 120s without the forced layer. Default
blurs before zoom, matching dropdown focus; `--keep-editor-focus` / `--composited`
retain both earlier variants. No product workaround or causal conclusion.

Six new + inherited 6/3/10 synthetic checks, Python syntax/CLI, separate same-agent
source review and mutated cloned-evidence refusal checks pass. Full product
suites omitted for standalone tooling only. No second-reviewer, lossless tracing,
S13, manuscript safety or milestone acceptance claim. No tool security rejection
received; no global settings changed after the denied ptrace attempt.
[Exact commands, failures and final evidence](test-evidence/M4.md#continuation-from-473858b--standalone-webkit-control).
No native probe remains.

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

Next bounded task: compare the standalone and implicated integrated controls'
renderer/automation/close lifetimes, then add one explicit matching interaction
or lifetime control at a time. Retain a positive installed-stack failure before
attributing clean candidate results. The active-caret rendering stall is a
separate observed setup issue; do not infer it causes heap corruption. Supported
corrected-runtime validation and full integrated acceptance remain necessary;
a private prefix or these clean controls cannot close the gate.

M4-01–14 bounded Linux dependencies, R1 preedit and M4-08-R1 emphasis remain
accepted. Full S13/long sessions, screenreader/other platforms, installed/offline
packaging, migration/backups and Local v1 adoption remain open. Nothing pushed.
