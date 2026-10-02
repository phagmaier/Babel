# Current state — M4-15 accepted; M4 exit awaiting tag/push authorization

Date: 2026-10-02 PDT. Application: **babel**. Base `a97a577` on main
(`origin/main` equal to it at start); one editing agent. Not pushed or tagged; no M5 work.

## Task and work

**M4-15 integrated exit — accepted for its bounded Linux gate.** Release
unchanged: SHA256 `0f4ba9bb83078278e6954162e2fe24166ab3a4a08b79b41eb25a9227a9fe130d`
(ADR 0035 mitigation). Host webkit2gtk-4.1 2.52.6-1, mesa 26.2.3-2, glibc 2.44.

- Run 1 (`/tmp/babel-m4-15-native-final-1`): 35/38. Exposed missing `/tmp`
  helpers and a harness gap: journal-only cores and surviving automation apps
  went undetected. Helpers were provisioned, and `integrated_exit.py` now always
  records the process ledger and journal scan.
- Run 2 (`/tmp/babel-m4-15-native-final-2`), the acceptance matrix: **38/38
  functional, 36/38 strict**. Retained audit 36 roots, journal replay 36/38.
  The one abort (Btrfs presentation restart) followed forced WebDriver delete;
  its late core also landed in spellcheck's window, unattributed.
- Shared gates pass: Rust 237, Vitest 695, clippy/fmt/lint/typecheck/format/build.
- [Separate review](reviews/2026-10-02-m4-15-post-integration-review.md): no
  blocking product defect, content loss or ordinary-close crash. The owner
  delegated F2 ("Do whatever you think is best and continue"). Aborts after
  forced WebDriver teardown, a test-only path that bypasses ADR 0035, are
  classified with C1 and carried to M6. A new ordinary-close abort or any
  content loss reopens this.
- TODO M4-15 `[x]`; trace rows, brief and ADR 0035 note updated.

## Next action

Owner: authorize tagging the verified M4 exit (proposed
`m4-daily-workflows-linux-verified`) and pushing main. Then M5-00 decomposition
(not started). Do not resume WebKit/Mesa work without new ordinary-close evidence.

## Paths and checks

- [Evidence](test-evidence/M4.md#continuation-from-a97a577--full-native-matrix-and-post-integration-review):
  commands, timings, cores, audits and failures. Artifacts `target/m4-15-native-final-{1,2}/`.
- `/tmp` helpers (pointer, `wtype`, keyboard) do not survive a reboot; rebuild per
  `tests/native/writing-lifecycle/README.md` before native runs.

## Retained limits

C1 and forced-teardown aborts, dependency hardening, full S13/long sessions,
screenreader/other platforms, installed/offline packaging, migration/backups
and Local v1 adoption remain open (M6). The SC005/SC008 export assessment is
deferred to M5. The upstream WebKit/Mesa race is unchanged.
