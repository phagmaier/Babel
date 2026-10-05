# Test strategy and coverage

Status: M0–M5 and the bounded M6-01 investigation recorded complete (bounded Linux gates); M6-02 hardening recorded with disposition open. The corrected M3-13 gate includes full default-app input/IME and a separate source re-review; M4 adds daily-workflow native gates, M5 the publication pipeline, M6-01 shutdown hardening. Local v1 and full performance/platform/adoption gates remain open. [SPEC S15/S20](../SPEC.md#s15); QA-01–03, INV-18.

## Test layers

| Layer          | Command                           | What it proves                                              |
| -------------- | --------------------------------- | ----------------------------------------------------------- |
| Unit/UI        | `pnpm test`                       | Vitest/JSDOM with injected ports; visible shell status      |
| Browser smoke  | `pnpm test:browser`               | System Chromium + Playwright; same in real browser          |
| Rust core      | `cargo test -p screenwriter-core` | Headless value, no WebView                                  |
| Rust workspace | `cargo test --workspace`          | Includes host command wiring                                |
| Native smoke   | `pnpm tauri dev`                  | Real Tauri/WebKit; mocked/browser results cannot substitute |

Browser preview deliberately reports native IPC unavailable. A native smoke must actually start Tauri and observe the app-info response in WebKit.

## Check tiers (efficiency without weakening gates)

Use the lowest tier in [development](development.md#check-tiers-use-the-lowest-tier-that-covers-the-change) that covers the change. Tier 1 is docs/text-only; Tier 2 is frontend/Rust logic with full shared gates; Tier 3 adds browser smoke, native drills, and the tmpfs/Btrfs matrix. Focused tests never replace required shared/milestone gates for behavior changes. Skipped Tier 3 items need a one-line rationale in evidence (for example, "no filesystem paths touched, single-filesystem shared run only"). Record elapsed time beside `pnpm check`, `cargo test --workspace`, and any native/matrix run.

## Differential regression gates

Any capture/codec/bridge spelling or renderer/assessment change runs
`pnpm test:differential` after `pnpm pdf-helper`, plus its named focused tests
and the shared [assessment oracle](../fixtures/assessment/oracle.json) on both
sides (`pnpm test` and `pnpm test:pdf-helper`). The dedicated suite is separate
from unit/UI discovery and runs in CI. A missing baseline/helper is a failure.

- [Capture gate](../tests/differential/capture.test.ts): the full 16-context ×
  53-text F4 single-row corpus, including natural headings/cues/transitions,
  plus generated codec edits over BOM, LF/CRLF/CR/mixed endings and EOF.
  Successes are compared to frozen F4-05 Git source: no new refusal and no
  changed successful source bytes/line facts. New successes still require
  independent semantic, exact-byte, reopen and Undo/Redo tests in their brief.
- [Renderer gate](../tests/differential/renderer.test.ts): the shared oracle
  plus 70,000 fixed-seed generated ASCII sources, comparing paragraph roles,
  speech bracket flags, scene numbers and title-page decision with the actual
  verified pinned parser. Also compare assessment admission to the frozen
  control: no new unreported reading disagreement or false gate on an agreeing
  clean source. Source-role heuristic candidates on the frozen control are reported for
  independent review; accepted profile mappings (such as lyrics) may differ.
  No new clean candidate is permitted. AUDIT-D04-R4 names ten sources the
  frozen control passes clean and the correction gates; the gate asserts that
  list exactly, so no other source may become gated and none may revert. Extend
  it only with retained PDF evidence and an oracle case, never to clear a
  failure. Parser/mirror comparisons must agree
  for every admitted corpus source. This is parse-level, not layout/emphasis,
  Unicode shaping, pixel or native verification.
- Baseline `8084690` is loaded from Git by the dedicated test configuration;
  no archived test suite is discovered. Advance it only in a reviewed task
  that names changed outcomes and independent literal/semantic evidence.
  Never regenerate expectations or move a baseline merely to clear a failure.
- Every editor/capture gate includes synthetic externally authored/unforced
  sources. Force-marked app-authored fixtures alone are insufficient.
  A new unexplained refusal or disagreement blocks the relevant change until
  reproduced, scoped in a brief and fixed or explicitly dispositioned.

Optional retained reports: set `BABEL_DIFFERENTIAL_REPORT` to a fresh path
prefix outside fixtures; the suite writes exclusive-create JSON summaries.
The renderer report lists every candidate occurrence (`baselineRoleOccurrences`).
Reproducers under `tests/investigation/` run by name only, outside `pnpm test`,
this gate and CI; one may stay red while its tracked finding is open. The
reading-candidates reproducer is green since AUDIT-D04-R4.
`BABEL_DIFFERENTIAL_FAULT=capture`, `renderer` or `assessment` injects an in-memory fault
in the dedicated suite only; all must fail. No product source is modified.

## Mandatory save faults (SPEC S15.2)

Crash before/after temporary write and replacement, partial write, sync failure, disk full, corrupt journal tail, out-of-order acknowledgements, external edit, second instance, history failure, and interrupted restore/remote adoption. Every failure must preserve known good generations and report truthful status. Real filesystem process-termination tests complement, but do not universally prove, mock fault tests.

## Evidence conventions

One compact report per milestone at `docs/test-evidence/M*.md`. Keep large logs outside routinely loaded docs and reference them by path. For each task, record exact command, host, outcome, skipped checks, and evidence. A source-only unit pass does not close a native packaging gate. Local-v1 adoption additionally needs an installed offline app, disposable writing/recovery/backup drills, migration review, and owner-reviewed pilot per SPEC S15.5.

Test on synthetic files only. Expected outputs need independent review; never generate goldens from the implementation and accept them automatically.

## Coverage summaries

Detailed per-task coverage lives in [development](development.md) (commands) and `docs/test-evidence/M*.md` (results). Key coverage areas:

- **M1 proofs**: Fountain round-trip, native editor input, PDF renderer, durable replacement, history store, bounded composition
- **M2 headless**: Safe open, recovery checkpoints, serialized source replacement, versioned IPC, startup review, recovery choices, snapshots, protected close, curated history
- **M3 codec/editor**: Independent conformance corpus, production primary codec, complex Fountain regions, editor state/source captures, structural keys, picker/shortcut routing/remapping, local completion source/caret/ranking/key/pointer acceptance and undo; M3-08 clipboard/emphasis/protected import and real IME commit/cancel/Enter; corrected M3-13 default-app corpus/input/lifecycle matrix and separate safety re-review passed on tmpfs/Btrfs
- **M4 daily workflows**: recents/Home, manuscript index/outline, workflow protection, scene/section moves, title page, find/replace, Script Check, presentation, offline spellcheck, characters/counts/position, palette/menus/accessibility; M4-15 integrated exit (19-mode tmpfs/Btrfs matrix + separate post-integration review)
- **M5 publication**: bundled offline renderer helper, native render jobs, frozen US Letter profile + regression goldens, SC005/SC008 assessment, authoritative preview/page-count freshness, protected exact-version PDF export; M5-07 integrated publication exit + separate review
- **M6 hardening (bounded, Linux)**: M6-01 shutdown/retained-crash disposition; M6-02 interruption/restart matrix recorded, disposition open ([M6-02-R1](tasks/M6-02-R1.md))

Each area's exact commands, host, outcomes, and limitations are recorded in the linked evidence files.

- **M4-03 advisory navigation**: independent boundary/attachment/Unicode/newline/protected text tests, capture coalescing/session/version/hash/Undo/import/restore rejection, read-only/frozen/composition selection guards and visible display bounds. Default-app outline/IME/scaling and isolated index measurements are task-scoped; second-filesystem projection tests are unnecessary. Full paint/page/long-session/accessibility remain open; [M4 evidence](test-evidence/M4.md) owns results and limits.

- **M4-04 workflow protection**: frontend/session stale document/selection/identity/composition/cancel/receipt and unavailable-source guards; read-only/frozen owned-dispatch import/Undo/cadence integration; strict MockRuntime envelopes over real native stores; native operation/byte/label/ref/recovery/source isolation and existing interruption/lease matrix on tmpfs/Btrfs. Default release import/cancel/history-failure uses the shared guard with visible controls. Moves remain M4-05; [M4 evidence](test-evidence/M4.md) distinguishes native headless, MockRuntime and WebKit observations.
