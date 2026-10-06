# AUDIT-D04-R3 — remaining renderer/codec reading differences

Status: **done 2026-10-04**; base `bb0fd45`.
[Evidence](../../test-evidence/AUDIT.md#audit-d04-r3--remaining-renderercodec-reading-differences).
Dependencies: AUDIT-D04-R2 and AUDIT-DEV-REVIEW complete; the review evidence
names five classes that are clean in the export check and print differently.
Requirements: SPEC S09.2 (unchanged), CHECK-01/02, PDF-01/04, INV-03/06/10;
ADR 0037/0039.

## Deliverable and acceptance

- **Hand-written cases** appended to `fixtures/assessment/oracle.json` (existing
  bytes stay an unchanged prefix; `json.dumps(indent=2, ensure_ascii=False)`
  plus a newline). Five classes, text-dropping class first:
  1. a boneyard on its own line is deleted and leaves an empty line, so the
     line beside it changes role, in the body and in the opening `Key:` block;
  2. a line of a tab or two or more spaces does not end a paragraph;
  3. an unclosed parenthetical keeps the following speech lines parenthetical;
  4. `#12#` followed by spaces is still read as a scene number;
  5. a bare heading prefix with trailing whitespace prints as action.
     Plus guards that agree on both sides, and any further class the probes find.
- **The helper is the authority.** `test_helper.py` renders every case and
  checks printed and omitted text. Several classes print the same words in a
  different role, so new cases also carry the renderer's own paragraph
  classification (`paragraphs`, as in `typed-scene.json`), checked by a helper
  test. Expectations come from the pinned parser's source and a parse-level
  probe, written before the assessment side runs.
- **Findings become limitations.** A blocking SC005 in
  `src/domain/exportAssessment.ts` with a message that states what the profile
  does. Assessment only: codec classification, editor protection and source
  bytes do not change.

## Do NOT do

Change codec classification, Rust, IPC, the helper, profile, fonts or pins;
rewrite existing fixture bytes; weaken or delete an existing assertion; remove
an existing limitation, even where it over-reports beside a boneyard.

## Checks and stopping

Red first: new finding cases fail on the assessment side only. One injected
fault per new guard must fail the corpus; source restored byte-identical. Scan
every tracked `.fountain` fixture for newly reported lines. Differential probe
against the pinned renderer: no source that was clean and equal becomes gated.
Tier 2 frontend domain: full `pnpm check`, `pnpm test:pdf-helper`, browser
smoke; Rust gates unchanged. Native pdf-export, script-check, publication-exit
and title-page drills on tmpfs and Btrfs after a fresh build. Record evidence;
update TODO, current-state and the owning validation doc; one commit.
