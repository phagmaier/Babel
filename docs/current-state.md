# Current state — M4-15 shutdown investigation; gate open

Date: 2026-10-01 PDT. Application: **babel**. Base `677a6dc` on main;
one editing agent, no push or M4 verified tag.

## Task and work

**M4-15 continuation:** completed controls on the installed WebKitGTK 2.52.6
stack before any private candidate trial. Inherited six dirty paths preserved
in `target/m4-15-own-code-controls-1/inherited.patch`; executable-phase stack
observer correction reviewed and rechecked. Reboot removed previous `/tmp`
artifacts/prerequisites; synthetic IME prerequisites restored privately from
verified packages. No system libraries changed.

**M4-15-R2 complete:** fixed a separate Save As rollback defect in
`src/app/WritingView.tsx`. Restoring the retained editor now schedules capture,
so outline/counts/navigation recover while source, selection and Undo remain
intact. Injected late native-release failure reproduced the defect before the
fix. This does not explain native adoption refusal or fix the heap crash.

## Findings and evidence

[Investigation and exact commands](test-evidence/M4.md#continuation-from-677a6dc--own-code-shutdown-controls)
and [R2 checks](test-evidence/M4.md#m4-15-r2--derived-state-after-save-as-rollback)
own results, omissions and host details. All new artifacts use
`target/m4-15-own-code-controls-1/`; eight synthetic tmpfs roots archived in
`tmpfs-evidence.tar.gz` before reboot can remove them.

- Preedit disabled: **1/4 strict, 4/4 functional**; three owned crashes before
  restart/DELETE. The R1 override is not necessary; production preedit retained.
- No IME: two completed tmpfs cases both crashed at ordinary close; two Btrfs
  cases failed Save As before shutdown and crashed in fallback cleanup. Do not
  count the latter as ordinary-close controls or complete byte proofs.
- Probe cleanup: **1/2 strict**; blank navigation + five-second wait: **0/2**;
  no zoom: **1/2**. All six workloads completed functional/byte checks.
- Typical only: **2/2 strict**, insufficient to establish stress necessity.
  Five-second Home idle: one clean Btrfs case; tmpfs failed caret centering
  before shutdown, so this paired control is incomplete.
- Owned process observations show CoreDumping by ~110ms after close; exits
  finish 13–18 seconds later. The long delay follows the crash/core dump;
  it is not evidence of a pre-abort 20-second deadlock.
- Matched debuginfo resolves Gallium finalization, concurrent WebKit Skia/EGL
  TLS destruction, and DRM/GBM destruction. This strengthens the upstream
  teardown-race lead; the original corrupting write remains unobserved.
- Eight simplified standalone GTK/WebKit large-page closes were clean.
  They are not a matched Babel workload and do not prove automation necessary.
  WebDriver DELETE closes its windows; it is not a detach operation.

## Checks and paths

- R2 regression fails before fix; focused UI/session checks **56 passed**.
- Full pinned `pnpm check` quiet rerun **695 passed**, formatting/lint/typecheck/
  build passed. Initial run had one existing readiness timeout under concurrent
  workloads; both logs retained, no assertions/timeouts weakened.
- Pinned Rust format/clippy/workspace tests **passed, 237 tests**; browser smoke
  passed; default production release rebuilt. No native persistence code changed.
- Python observer/process/stack tests **3/6/10 passed**; frozen byte/phase and
  independent journal audits retain every native failure.
- Rebuilt product native presentation/restart: **2/2 functional, 0/2 strict**
  (~3m28s); owned WebKit aborts on both filesystems. Independent frozen-byte/
  phase audits passed both roots/four exits; journal replay retains both failures.
  Injected rollback failure is UI-tested; it did not recur in these native runs.
  Full 19-mode acceptance is not claimed.
- New tools: `tests/native/writing-lifecycle/shutdown_observer.py` and tests;
  optional workload/exit controls described in that directory's README.
- R2 contract/trace: [brief](tasks/M4-15-R2.md), persistence/recovery and
  requirements docs. Source plus UI regression are the only product changes.

## Blocker and next action

**M4-15 remains open.** No supported corrected WebKit package was found; Arch
still supplies 2.52.6-1. The existing private 2.54.0 + upstream EGL/DRM patch
prefix is left unused at `target/m4-15-webkit-candidate-1/`; it is neither a
verified fix nor distribution-supported acceptance evidence.

Next: reduce the large-document trigger and
exercise a matched non-automation workload. Use that reproducer for supported
WebKit/Mesa correction or a controlled upstream comparison; a private build
can inform diagnosis but cannot close the distribution gate. Preserve bytes,
crashes and strict journal attribution; clean repeats alone do not establish a
fix. The separate native Save As adoption refusal also remains unexplained.

M4-01–14 bounded Linux dependencies, R1 real preedit and M4-08-R1 emphasis fix
remain accepted. Stop at M4; no M5. Full S13/long sessions, screenreader/other
platforms, installed/offline packaging, migration/backups and Local v1 adoption
remain open. Nothing pushed.
