# AUDIT-EXPORT-WARNINGS — stop an export the renderer warns about and the check did not predict

Status: **in progress 2026-10-05**; base `675685b`. The owner delegated the
design decisions to the agent on 2026-10-05; the choices and their reasons are
recorded below, before any code changed.
Origin: [classification evidence](../test-evidence/AUDIT-READING-CANDIDATES.md#classification--2026-10-05).
Requirements: SPEC S09.2, S12.2, INV-03; ADR 0037 limits and assessment handoff.

## Finding

The helper's receipt lists `unsupported-publication:*` warnings: boneyards,
notes, sections, synopses and unknown title fields. By reading
`src/application/exportPdf.ts` and `requiresExportReview`, export review depends
only on Script Check issues; only the preview panel shows helper warnings. For
the AUDIT-D04-R4 sources the helper warned `unknown-title-fields` while the
assessment was clean, and nothing compared the two. That fix closes the known
shape. A comparison at export would stop the same class of omission whatever
the assessment or its parser mirror misses next.

## Design as settled

Settled from the code and from a scratch probe that ran the pinned helper's
`warnings()` beside the current assessment over the shared oracle, the tracked
`.fountain` fixtures and the renderer gate's 70,000 generated sources (59,098
distinct), plus hand-written edge cases. Counts are in the evidence.

- **What the assessment predicts: an announced set.** The verified assessment
  gains `announced`: the omission categories the author is told about, in the
  helper's names. A category is announced by a counted omission in the summary
  line, or by a blocking issue that says the profile omits or may omit that
  kind. Issues and omission counts are unchanged. Reason: counts alone would
  refuse exports the author has already reviewed. In the probe 1,988 sources
  warn `unknown-title-fields` with no "unknown title field" issue (1,986 are the
  opening-block limitation, 2 an indented key), and escaped or unclosed hidden
  text and lines the renderer takes as a section or synopsis all warn with a
  zero count. A public per-issue field was rejected: nothing else would read it.
- **One direction fails.** A renderer warning outside the announced set stops
  the export. A counted omission the renderer does not warn about does not.
  Reasons: the helper under-reports (an empty synopsis line, `# Act` then `=`,
  is omitted and counted, and the helper does not warn `synopses` because the
  text is empty, so stopping would refuse a drafting placeholder); a closed
  note or boneyard always matches the helper's whole-source pattern, so the
  reverse check could never fire for them; and a category flag shows only the
  case where every element of a kind was missed. Hidden text printing stays
  owned by the renderer gate's role comparison.
- **Outcome on mismatch.** No publication call. The rendered artifact is
  cancelled (native `cancel_publication` removes it), the capture is retired,
  and the export fails naming each category. There is no acceptance path: the
  helper gives no location, so the author could not make an informed decision.
  Source, Save and recovery are untouched.
- **Unknown or unreadable warnings fail too.** A code outside the five known
  categories, or a warnings value that is not a list of coded entries, counts
  as unannounced.
- **Where.** `ExportPdfController.publishCapture`, after the render result is
  verified and before `publish`, against the report held for the same captured
  version and hash. Helper, profile, pins, codec, IPC and Rust are unchanged.
- **Limits.** Categories only: matching categories do not prove matching
  extent, and an acknowledged issue covers any warning in its category.
  **Known false stop:** note brackets inside a title field
  (`Title: Film [[x]]`). The renderer prints them as written; the helper warns
  `notes` because its pattern scans the whole source. Export stops although
  nothing is omitted. Explaining a warning away needs a new assessment rule, so
  it is a proposed follow-up in the tracker, not part of this task.

## Acceptance

- **Red first.** A render result carrying `unknown-title-fields` beside a clean
  assessment must not reach a successful export.
- **`announced` contract cases.** Each category through the summary and through
  a blocking issue; a clean source and issues that say text prints announce
  nothing.
- **Export cases.** Each category unannounced: failed, no publish, render
  cancelled, capture retired, message names the category. Each category
  announced by the summary or by an acknowledged issue: succeeds. An
  acknowledged issue of another category does not cover. Unknown code and
  malformed warnings fail. A counted omission without a warning succeeds. A
  mismatching result that arrives after cancellation stays cancelled. The known
  false stop is pinned as a case with the helper's literal output.
- **Corpus gate.** The renderer gate also asserts that every pinned-helper
  warning is announced for each shared-oracle and generated source, that each
  category is exercised both ways, and reports the reverse direction without
  asserting it. `BABEL_DIFFERENTIAL_FAULT=announced` must fail it.
- **Assessment unchanged.** Issues and omission counts are identical to base
  `675685b` for every corpus source (scratch comparison).
- **Wording** reviewed in a panel test.
- **Native.** `pdf-export` gains the known false stop as the only natural
  trigger available: the real helper warns, the export stops, no PDF exists and
  the saved source bytes are unchanged.

## Do NOT do

Change the helper, profile, fonts, pins, codec, parser mirror, Rust or IPC; add,
remove or reword an assessment issue; change the gate's seed, baseline or an
existing assertion; suppress or filter a helper warning; add an acceptance path
for a mismatch.

## Checks and stopping

Tier 2 frontend (application and domain), plus browser smoke and named native
drills because the comparison reads warnings produced across the native
boundary. Focused:
`pnpm exec vitest run tests/contract/export-pdf.test.ts tests/contract/export-assessment.test.ts tests/ui/ExportPdfPanel.test.tsx`.
Then `pnpm pdf-helper`,
`python3 tools/pdf-helper/verify_runtime.py target/pdf-helper/runtime --exact`,
`pnpm test:pdf-helper`, `pnpm test:differential` with each
`BABEL_DIFFERENTIAL_FAULT` mode (`capture`, `renderer`, `assessment`,
`announced`) failing, `python3 -m unittest discover -s tests/tools -p 'test_*.py'`,
`pnpm check` and `pnpm test:browser`. Native, after a fresh
`pnpm tauri build --no-bundle`, on tmpfs and Btrfs: the
`pdf-export script-check publication-exit title-page` modes of
`integrated_exit.py`, invoked as recorded in
[AUDIT-D04-R4 evidence](../test-evidence/AUDIT.md#audit-d04-r4--boneyard-inside-the-renderers-opening-title-block);
check `df -i /tmp` first and set `BABEL_NATIVE_IME_TEMP_ROOT` to a new
directory under `target/`. Skipped, with reason: Rust format, Clippy and tests
and the tmpfs/Btrfs workspace matrix (no Rust, IPC or filesystem path changes);
the installed or bundled package (a release gate, not this task). Record
evidence, update tracker and current-state, commit locally on main, no push.
