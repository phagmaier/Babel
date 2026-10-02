# Current state — M4-15 shutdown abort mitigated; integrated exit open

Date: 2026-10-02 PDT. Application: **babel**. Base `7aa7a08` on main;
one editing agent; no push, verified M4 tag or M5 work.

## Task and work

**Completed continuation from `8e21ee3`: shutdown abort mitigated in product.**
Owner stopped WebKit bisection. On Linux, `CloseRequested` with no open document
now ends the WebKit web process synchronously before the window drops
([ADR 0035](decisions/0035-linux-web-process-close.md); `src-tauri/src/lib.rs`,
`webkit2gtk` feature `v2_28` → `v2_34`, same pinned version). Unchanged binary
on the ordinary-close reproducer: **2/4 crashed** (owned SIGSEGV + SIGABRT cores).
Mitigated: **8/8** same command, **4/4** full default workload tmpfs/Btrfs, final
rebuilt binary **2/2**; zero owned cores, byte/journal/retained audits pass,
preference restart intact, close→exit median unchanged (140ms). Shared gates pass:
Rust 237, Vitest 695, clippy/fmt/lint/typecheck/format/build. Release SHA256 now
`0f4ba9bb83078278e6954162e2fe24166ab3a4a08b79b41eb25a9227a9fe130d`.
[Evidence](test-evidence/M4.md#continuation-from-8e21ee3--terminate-web-process-on-accepted-close).

Earlier standalone controls (default drain 8/8, Tao exit order 8/8, Wry app-owned
view 9/9) were clean and are superseded as the next action; artifacts retained
under `target/m4-15-{minimal-webdriver,tao-exit,app-view}-1/`.

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

**M4-15 remains open** for its own acceptance gate, not the shutdown abort: run
the complete default M4 integrated native matrix on tmpfs/Btrfs with the final
release, then the separate post-integration source review. If ordinary-close
crashes recur there, retain them and revisit ADR 0035; do not resume WebKit
bisection without new evidence. Upstream WebKit/Mesa race is unchanged; other
distributions, GPU drivers and packaged builds are unverified.

M4-01–14 bounded Linux dependencies, R1 preedit and M4-08-R1 emphasis remain
accepted. Full S13/long sessions, screenreader/other platforms, installed/offline
packaging, migration/backups and Local v1 adoption remain open. Nothing pushed.
