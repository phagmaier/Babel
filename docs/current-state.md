# Current state — M4-15 full matrix done; owner decision pending

Date: 2026-10-02 PDT. Application: **babel**. Base `a97a577` on main
(`origin/main` equal to it at start); one editing agent; no push, verified M4 tag or M5 work.

## Task and work

**M4-15 integrated exit — full matrix and separate review complete; not closed.**
Release unchanged: SHA256 `0f4ba9bb83078278e6954162e2fe24166ab3a4a08b79b41eb25a9227a9fe130d`
(ADR 0035 mitigation). Host webkit2gtk-4.1 2.52.6-1, mesa 26.2.3-2, glibc 2.44.

- Run 1 (`/tmp/babel-m4-15-native-final-1`): 35/38. tmpfs scene-moves failed on a
  missing `/tmp/babel-m3-07-pointer`. The run also exposed a harness gap: without
  `BABEL_SHUTDOWN_MODE`, journal-only cores and surviving automation apps went undetected.
- Corrections: pinned pointer helper rebuilt; `/tmp/wtype` copied from the
  signature-verified prefix package; `integrated_exit.py` now always records the
  process ledger and journal scan (README updated).
- Run 2 (`/tmp/babel-m4-15-native-final-2`): **38/38 functional, 36/38 strict**.
  Retained audit 36 roots, journal replay 36/38. Both non-strict cases are one
  Btrfs presentation-restart abort after forced WebDriver delete. Its late core
  landed in spellcheck's window, unattributed.
- Shared gates pass: Rust 237, Vitest 695, clippy/fmt/lint/typecheck/format/build.
- [Separate review](reviews/2026-10-02-m4-15-post-integration-review.md): no
  blocking product defect, content loss or ordinary-close crash.

## Blocker and next action

**Owner decision (review F2).** Owned WebKit aborts recur only after forced
WebDriver session deletion (3/76 mode runs): WebKit's `close` signal makes Wry
destroy just the view, so the web process runs the teardown ADR 0035 avoids and
`CloseRequested` never fires. Production cannot reach this path. Options:
accept it as the automation analogue of C1 (carry to M6), authorize a harness
teardown through the product close path, or extend ADR 0035 to the `close`
signal. A further abort followed the deliberate SIGKILL (C1, expected).
Do not rerun for a lucky clean pass; do not resume WebKit/Mesa work.

## Paths and checks

- [Evidence](test-evidence/M4.md#continuation-from-a97a577--full-native-matrix-and-post-integration-review):
  commands, timings, cores, audits and failures. Artifacts `target/m4-15-native-final-{1,2}/`.
- Changed: `tests/native/writing-lifecycle/{integrated_exit.py,README.md}`, ADR 0035
  consequence note, M4-15 brief, TODO, new review, M4 evidence.

## Retained limits

M4-01–14, R1/R2 and M4-08-R1 remain accepted. C1/dependency hardening, full
S13/long sessions, screenreader/other platforms, installed/offline packaging,
migration/backups and Local v1 adoption remain open. Upstream WebKit/Mesa race
unchanged. Nothing pushed.
