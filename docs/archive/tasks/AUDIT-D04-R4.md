# AUDIT-D04-R4 — boneyard inside the renderer's opening title block

Status: **done 2026-10-05**; base `7efc80d`.
[Evidence](../../test-evidence/AUDIT.md#audit-d04-r4--boneyard-inside-the-renderers-opening-title-block).
The owner delegated both open decisions to
the agent on 2026-10-05 ("do whatever you think is best"): gate handling is
**option A** below, chosen by the agent; the helper-warning question stays
outside this fix as proposed task [AUDIT-EXPORT-WARNINGS](AUDIT-EXPORT-WARNINGS.md).
Origin: [AUDIT-READING-CANDIDATES](AUDIT-READING-CANDIDATES.md),
[evidence](../../test-evidence/AUDIT-READING-CANDIDATES.md#classification--2026-10-05).
Dependencies: AUDIT-D04-R1 and AUDIT-D04-R3 complete.
Requirements: SPEC S09.2 (unchanged), INV-03; ADR 0037;
[validation contract](../../screenplay-validation.md#audit-d04-omission-summary-and-inline-hidden-text).

## Finding

The export assessment is verified and clean, and reports only "1 boneyard",
for a source whose opening lines the pinned renderer takes as a title page with
an unknown key and never prints. Visible script text is omitted from the PDF
with no SC005 and no decision asked of the author.

Shape: the codec reads no title field; the first line is `Key:` with no value
(`FADE IN:`, `CUT TO:`, indented or not); each line below it, up to the first
empty line, is whitespace of four or more columns after tab expansion, text
indented three or more columns, or a boneyard on its own line that leaves such
whitespace once the renderer deletes it. The renderer reads them all as values
of that key. The column counts come from the parser mirror's rule; the samples
exercise a tab, a space plus a tab, and a four-space indent.

Cause, by reading [the assessment](../../../src/domain/exportAssessment.ts): the
AUDIT-D04-R1 title comparison is skipped whenever any line of the opening block
contains `/*`. That skip was written for a boneyard inside a codec title field,
which `rendererOnlyHidden` reports separately. Nothing reports a boneyard line
the renderer folds into a title block the codec does not see. Without the
boneyard the same source is blocked correctly (control K3).

Retained red evidence, [matrix](../../../tests/investigation/reading-candidates.json):

| Sample           | Assessment | PDF                                                |
| ---------------- | ---------- | -------------------------------------------------- |
| S3–S7 (9 sweep)  | clean      | one blank page; `FADE IN:` / `CUT TO:` not printed |
| P1, P2 (written) | clean      | `A lamp glows.` only; `FADE IN:` not printed       |
| P4 (written)     | clean      | `FADE IN:` and `Maya waits.` not printed           |

## Deliverable and acceptance

- **Hand-written cases** appended to `fixtures/assessment/oracle.json` (existing
  bytes stay an unchanged prefix, same serialisation as AUDIT-D04-R3): S3, S4,
  S6, P1, P2 and P4 with `prints`, `omits`, `clean: false`, `blockingLines`
  naming every visible line of the block, the renderer's `title` keys and
  `paragraphs`. Guards: K2 stays clean and prints `FADE IN:`; K3 stays blocked.
  Expectations come from the retained PDFs and pinned-parser readings, written
  before the assessment side changes.
- **Red first.** New cases fail on the assessment side only; the helper side
  already prints what they state.
- **The finding becomes a limitation.** A blocking SC005 over the renderer's
  title block whenever the renderer reads a title page and the codec reads
  none, with or without a boneyard line inside it; the message states what the
  profile does. Keep the skip only where a boneyard lies inside a codec title
  field and is already reported. Assessment only.
- **Probe the two sibling arms** under the same skip (codec title with no
  renderer title; both title with an indented key) with a boneyard line in the
  block. P3 is already blocked by another limitation; add a case for any
  outcome that is clean and prints differently.
- **The reproducer turns green** with an unchanged matrix:
  `BABEL_READING_ROOT=<fresh dir> pnpm exec vitest run --config tests/investigation/vitest.config.ts`.
- Update the validation doc's open note and this tracker entry.

## Gate handling (owner decision before coding)

The renderer gate counts a source as a new false gate when the frozen control
is clean, its mirror agrees with the pinned parser and the current assessment
is not clean. All nine sweep occurrences (five sources) meet that test, so a
correct fix fails `pnpm test:differential` as written. They are named changed
outcomes with independent literal evidence, not false gates. Derived from the
gate's predicate; not executed against a fix.

- **A (recommended).** Keep baseline `8084690`. Exclude from the false-gate
  list only sources where the frozen control reads no title and the renderer
  reads one, and assert that list is exactly the five reviewed sources. Lyric
  mappings stay protected; the three fault modes must still fail.
- **B.** Land the fix with the gate red for exactly those sources, then advance
  the baseline to the fix commit in a reviewed follow-up commit.

Either way [policy](../../testing.md#differential-regression-gates) applies: no
baseline or predicate change merely to clear a failure, no seed change.

**As built: A, refined.** The sibling-arm probes found two more sources that
are clean on the frozen control and print differently (P5, P6: a literal `/*`
with no closer in a title field hid an unprinted indented `Key: value` line and
a block printed as script text). Both have a codec title, so a "no title" rule
cannot name them. The gate carries a literal list of ten sources (S3–S7, P1,
P2, P4, P5, P6) and asserts the newly gated set equals it exactly, after every
earlier assertion. Baseline, seed and earlier assertions are unchanged. P5 and
P6 joined the matrix before the fix; no earlier expectation changed.

## Do NOT do

Change codec classification, the parser mirror's reading, Rust, IPC, the
helper, profile, fonts or pins; rewrite fixture bytes; weaken or delete an
assertion; remove an existing limitation; regenerate expectations from the
implementation; suppress the helper's `unknown-title-fields` warning.

## Checks and stopping

Tier 2 frontend domain plus the native drills AUDIT-D04-R3 ran. Focused:
`pnpm exec vitest run tests/contract/export-assessment.test.ts tests/contract/renderer-reading.test.ts`
and the reproducer above. Then `pnpm pdf-helper`,
`python3 tools/pdf-helper/verify_runtime.py target/pdf-helper/runtime --exact`,
`pnpm test:pdf-helper`, `pnpm test:differential` with each
`BABEL_DIFFERENTIAL_FAULT` mode failing, one injected fault for the new guard
failing the corpus, a scan of every tracked `.fountain` fixture for newly
reported lines, `pnpm check` and `pnpm test:browser`. Rust gates unchanged:
no Rust path is touched. Native, after a fresh build, on tmpfs and Btrfs: the
`pdf-export script-check publication-exit title-page` modes of
`integrated_exit.py`, invoked as recorded in
[AUDIT-D04-R3 evidence](../../test-evidence/AUDIT.md#audit-d04-r3--remaining-renderercodec-reading-differences)
with `BABEL_NATIVE_IME_TEMP_ROOT` set to a task-owned Btrfs directory, as the
[native guide](../../../tests/native/writing-lifecycle/README.md) requires once
retained `/tmp` roots exhaust inodes. Check `df -i /tmp` first;
confirm prerequisites before the run and record any skip with its reason.
Record evidence, update tracker and current-state, one commit, no push.
