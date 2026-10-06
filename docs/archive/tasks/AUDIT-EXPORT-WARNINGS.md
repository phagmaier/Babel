# AUDIT-EXPORT-WARNINGS — stop an export the renderer warns about and the check did not predict

Status: **done 2026-10-05**; base `675685b`.
[Evidence](../../test-evidence/AUDIT.md#audit-export-warnings--renderer-warnings-compared-at-export).
The owner delegated the design decisions to the agent on 2026-10-05. The first
choices were recorded before any code changed (`b2b9ed4`); a wider scratch
sweep then showed two of them would refuse legitimate exports, and they were
revised as stated below.
Origin: [classification evidence](../../test-evidence/AUDIT-READING-CANDIDATES.md#classification--2026-10-05).
Requirements: SPEC S09.2, S12.2, INV-03; ADR 0037 limits and assessment handoff.

## Finding

The helper's receipt lists `unsupported-publication:*` warnings: boneyards,
notes, sections, synopses and unknown title fields. By reading
`src/application/exportPdf.ts` and `requiresExportReview`, export review depends
only on Script Check issues; only the preview panel shows helper warnings. For
the AUDIT-D04-R4 sources the helper warned `unknown-title-fields` while the
assessment was clean, and nothing compared the two. That fix closes the known
shape. A comparison at export stops the same class of omission whatever the
assessment or its parser mirror misses next.

## Design as settled

Settled from the code, from the pinned helper's own `warnings()` run beside the
assessment over the shared oracle, the tracked fixtures and the gate's 70,000
generated sources, and from a scratch sweep of 206,282 better-mixed sources.
Counts and retained PDFs are in the evidence.

- **What the assessment predicts: an announced set.** The verified assessment
  gains `announced`: the omission categories the author is told about, in the
  helper's names. Issues and omission counts are unchanged (identical to base
  for every corpus source). A category is announced by:
  1. a counted omission in the summary line;
  2. a blocking issue that says the profile omits or may omit that kind. Counts
     alone are not enough: 1,988 corpus sources warn `unknown-title-fields`
     with no "unknown title field" issue, and escaped or unclosed hidden text
     and lines the renderer takes as a section or synopsis warn with a zero
     count;
  3. a limitation on a line the codec reads as a section or synopsis. Its
     message may say the line prints while the renderer omits it (beside a
     boneyard it deletes, or past a note it skips). A section or synopsis is
     non-printing by SPEC S09 either way;
  4. hidden-text syntax inside lines already told about. The helper finds notes
     and boneyards by pattern over the raw source, so it also reports a note
     inside a counted boneyard, hidden text inside an omitted title field, and
     note brackets in a title value, which the renderer prints as written. An
     unclosed or ambiguous region and a raw line are unverified: they also
     announce a section or synopsis line they contain.

  Rules 3 and 4 were added after the sweep: without them 7,888 of 206,282
  sources stopped, most often a commented-out block that contains a note.

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
  helper gives no location, so the author could not make the informed decision
  SPEC S09 requires. Source, Save and recovery are untouched.
- **Unknown or unreadable warnings fail too.** A code outside the five known
  categories, or a warnings value that is not a list of coded entries, counts
  as unannounced.
- **Where.** `ExportPdfController.publishCapture`, after the render result is
  verified and before `publish`, against the report held for the same captured
  version and hash. Helper, profile, pins, codec, IPC and Rust are unchanged.
- **Limits.** Categories only: matching categories do not prove matching
  extent, and an announcement covers any warning in its category. The stop
  names a category, not a line. The announced rules were validated on generated
  sources, not on a real manuscript.

## Open findings this comparison now stops

The sweep found real omissions the assessment does not report. Export now
stops for each; none is fixed here, because a located limitation is an
assessment rule. Retained PDFs are in the evidence; the proposed follow-up is
AUDIT-D04-R5 in the [tracker](../../tasks/AUDIT-TRACKER.md).

| Source                                    | Assessment                 | PDF                                  |
| ----------------------------------------- | -------------------------- | ------------------------------------ |
| ` FADE IN: [[cold open]]` as opening line | clean, "1 note"            | `FADE IN:` not printed               |
| `Title: A Story` then ` Draft date: 1`    | "needs an empty line" only | ` Draft date: 1` not printed         |
| the same with a boneyard in the title     | boneyard and empty line    | the same line not printed (R4 limit) |

## Acceptance

- **Red first.** A render result carrying `unknown-title-fields` beside a clean
  assessment must not reach a successful export.
- **Hand-authored corpus**, `fixtures/assessment/export-warnings.json`: each
  case states the helper's warnings, what is announced, whether export reviews
  first and whether a PDF may be published. Both sides read it.
- **Export cases.** Each category unannounced: failed, no publish, render
  cancelled, capture retired, message names the category. An acknowledged issue
  of another category does not cover. Unknown code and malformed warnings fail.
  A counted omission without a warning succeeds. A mismatching result that
  arrives after cancellation stays cancelled.
- **Corpus gate.** The renderer gate also asserts that the pinned helper
  reports exactly the corpus's warnings, that every helper warning is announced
  for each shared-oracle and generated source except the named open findings,
  and that each category is exercised both ways. The reverse direction is
  reported, not asserted. `BABEL_DIFFERENTIAL_FAULT=announced` must fail it.
- **Assessment unchanged.** Issues and omission counts are identical to base
  `675685b` for every corpus source and tracked fixture (scratch comparison).
- **Wording** reviewed in a panel test.
- **Native.** `pdf-export` gains two steps with the real helper: a note inside
  a boneyard exports directly, and the first open finding stops with no PDF and
  unchanged saved bytes.

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
[AUDIT-D04-R4 evidence](../../test-evidence/AUDIT.md#audit-d04-r4--boneyard-inside-the-renderers-opening-title-block);
check `df -i /tmp` first and set `BABEL_NATIVE_IME_TEMP_ROOT` to a new
directory under `target/`. Skipped, with reason: Rust format, Clippy and tests
and the tmpfs/Btrfs workspace matrix (no Rust, IPC or filesystem path changes);
the installed or bundled package (a release gate, not this task). Record
evidence, update tracker and current-state, commit locally on main, no push.
