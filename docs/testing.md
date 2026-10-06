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

Use current [development tiers](development.md#check-tiers-use-the-lowest-tier-that-covers-the-change): local checks cover changed boundaries, broad suites run in CI/integration/release. Retain task acceptance and relevant native/fault/Undo checks. Explain skips in one compact check table; do not rerun unrelated languages or matrices merely because an old brief listed them.

## Differential regression gates

Local capture/codec/bridge changes run
`pnpm exec vitest run --config tests/differential/vitest.config.ts tests/differential/capture.test.ts`.
Renderer/assessment/export-warning changes run
`pnpm exec vitest run --config tests/differential/vitest.config.ts tests/differential/renderer.test.ts tests/differential/mixed-renderer.test.ts`
plus focused contracts and the shared [assessment oracle](../fixtures/assessment/oracle.json)
on both sides (focused assessment tests and `pnpm test:pdf-helper`). Run both
selections when both boundaries change. For helper-using gates verify
`python3 tools/pdf-helper/verify_runtime.py target/pdf-helper/runtime --exact`;
build with `pnpm pdf-helper` only when missing or changed. The full
`pnpm test:differential` remains in CI and final integration/release checks.
A missing required baseline/helper is a failure, not a skip or waived test.

Keep the two existing generated corpora fixed. Broader corpus expansion needs
a separately selected bounded question, expected coverage benefit and stopping
rule; discovery counts alone do not authorize or prioritize product changes.
Known findings retain exact inventories and explicit disposition below.

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
- Warning gate, same file: the pinned helper's own `warnings()`
  ([oracle tool](../tools/differential/warning_oracle.py)) over the
  [export-warnings corpus](../fixtures/assessment/export-warnings.json), the
  shared oracle and the same 70,000 sources. The helper must report exactly
  the corpus's stated warnings, and every warning must be in the assessment's
  `announced` set except for the corpus cases marked `exports: false`, which
  are named open findings. Each category must be seen announced by an issue
  and, where counted, by the summary. A counted omission the helper does not
  warn about is reported, not asserted. Clear an open finding by reporting it
  in the assessment and flipping its case, never by widening `announced`.
- Baseline `8084690` is loaded from Git by the dedicated test configuration;
  no archived test suite is discovered. Advance it only in a reviewed task
  that names changed outcomes and independent literal/semantic evidence.
  Never regenerate expectations or move a baseline merely to clear a failure.
- [Supplemental gates](../tests/differential/mixed-renderer.test.ts) feed both
  pinned oracles the same second 70,000 sources from
  [Mulberry32 seed `0x5eed04`](../tests/differential/generated-corpus.ts),
  alongside the unchanged frozen runs above. Coverage guards require all 60
  tokens, whitespace/row-count choices, token pairs and token/position/opening
  combinations; an independent replay pins the corpus bytes. This wider set
  exposes existing refusals and reading/warning gaps. Their
  [reviewed inventory](../tests/differential/mixed-findings.json) pins exact
  ordered source/outcome sets by count and hash, with literal R4 corrections.
  R5 requires full pinned agreement for the exact former 398 title-reading
  mismatches and zero remaining title-warning gaps; their previous hashes stay
  recorded. Independent raw-source classification and retained PDFs support
  this scoped correction. AUDIT-MARKER-READING requires agreement for all six
  former marker-reading sources while preserving their original outcome hash;
  zero marker disagreements remain. Its shared literal oracle checks removal
  order, blocking review, source bytes and pinned parser/PDF text.
  AUDIT-MARKER-WARNINGS closes the three separate marker-warning gaps through
  located blocking SC005; their original source/category hashes remain asserted
  as corrected sets. All current helper warnings must be announced. The 634
  preparation refusals remain retained failures, not publication acceptance.
  No new reading regression,
  clean disagreement, unknown warning or warning refusal is allowed. Every
  existing mismatch must retain the frozen facts. Fixes require independent
  literal evidence and a scoped inventory update; do not regenerate for green.
  [Brief](tasks/AUDIT-SWEEP-COVERAGE.md) records the limits and review.
- Every editor/capture gate includes synthetic externally authored/unforced
  sources. Force-marked app-authored fixtures alone are insufficient.
  A new unexplained refusal or disagreement blocks the relevant change until
  reproduced and fixed or explicitly dispositioned. Existing recorded findings
  do not select another audit automatically or block unrelated product work.

Optional retained reports: set `BABEL_DIFFERENTIAL_REPORT` to a fresh path
prefix outside fixtures; the suite writes exclusive-create JSON summaries.
The renderer report lists every candidate occurrence (`baselineRoleOccurrences`);
the warning report lists every unannounced source.
Supplemental `.mixed-renderer.json` and `.mixed-warnings.json` reports retain
separate corpus identity/choice counts and every refusal, disagreement,
admission change, candidate and unannounced source, including duplicates.
Reproducers under `tests/investigation/` run by name only, outside `pnpm test`,
this gate and CI; one may stay red while its tracked finding is open. The
reading-candidates reproducer is green since AUDIT-D04-R4.
`BABEL_DIFFERENTIAL_FAULT=capture`, `renderer`, `assessment` or `announced`
injects an in-memory fault in the dedicated suite only. Repeat these rejection
checks when the injection/configuration, compared assertions, corpus/oracle or
inventory logic changes, not for every product correction. Use the applicable
file selections above; all affected modes must fail in their expected gate,
after an uninjected pass. Setup/timeouts are not successful fault detection.
No product source is modified. Unchanged harness checks may cite prior evidence.

## Finding disposition

Prioritize ordinary writing, content protection and owner workflow over corpus
breadth. Record one of: open investigation, repaired with independent evidence,
or accepted limitation. A limitation names exact triggers, visible behavior,
preserved source/recovery, regression evidence and explicit reviewer/owner
acceptance; safe export refusal names the category and leaves no artifact.
Acceptance is distinct from repair and preserves the original failure record.

Do not waive source corruption, falsely saved/current status, unprotected
ordinary drafting, silent publication loss or unsafe native/privacy behavior.
New parser disagreement on admitted sources, unknown/unannounced warnings and
capture regressions remain hard failures. Reviewed baseline/inventory changes
still require literal independent evidence; never regenerate for green.
Native residual-risk decisions follow the [native register](native-findings.md#disposition-and-escalation).
Timebox an investigation to one scoped attempt/control or artifact review;
finish with a disposition or a concrete narrowed follow-up, not an automatic
repeat of the same non-reproducing sweep. No deadline or clean rerun grants
acceptance, and unrelated eligible work may continue with findings recorded.

## Mandatory save faults (SPEC S15.2)

Crash before/after temporary write and replacement, partial write, sync failure, disk full, corrupt journal tail, out-of-order acknowledgements, external edit, second instance, history failure, and interrupted restore/remote adoption. Every failure must preserve known good generations and report truthful status. Real filesystem process-termination tests complement, but do not universally prove, mock fault tests.

## Evidence conventions

Use one compact task section/report under `docs/test-evidence/`: brief outcome,
base/host/build, then a table of command / kind / result / elapsed / skip reason.
Group equivalent static checks; add only necessary failure/disposition detail.
Trackers and handoffs link it instead of repeating check counts or narratives.
Full logs, per-source inventories and corpus statistics stay in ignored task
output or retained CI artifacts; tracked fixtures/inventories remain executable
expectations. Preserve historical failure records and independent evidence.
Before pruning irreplaceable artifacts, establish durable provenance/retention;
an ignored path alone is not archival storage. Existing evidence is retained;
do not append new tasks to the large audit report. A source-only pass does not
close native packaging or Local-v1 adoption gates in SPEC S15.5.

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
