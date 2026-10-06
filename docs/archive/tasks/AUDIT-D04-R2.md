# AUDIT-D04-R2 — renderer/codec disagreement sweep

Status: **done 2026-10-04**; base `30f05d8`.
[Evidence](../../test-evidence/AUDIT.md#audit-d04-r2--renderercodec-disagreement-sweep).
Dependencies: AUDIT-D04 complete; its evidence names the remaining role
differences ("for example leading or trailing whitespace on headings and
transitions"). Requirements: SPEC S09.2 (unchanged: "any text the renderer would
drop or print differently from what the script shows" needs a decision),
CHECK-01/02, PDF-01/04, INV-03/06/10; ADR 0037/0039.

## Deliverable and acceptance

- **Hand-written cases** appended to `fixtures/assessment/oracle.json`
  (existing bytes unchanged): leading/trailing whitespace on headings and
  transitions, notes and boneyards inside speech and action paragraphs, dual
  dialogue, lyrics, centered text, page breaks and forced elements, plus cases
  that agree on both sides as guards.
- **The helper is the authority.** `test_helper.py` renders every case and
  checks printed and omitted text. Expectations come from the pinned parser's
  source and a parse-level probe, written before the assessment side ran.
- **Findings become limitations.** Where the assessment is clean but the PDF
  drops or changes text, `src/domain/exportAssessment.ts` adds a blocking SC005
  with an accurate message. Assessment only: codec classification, editor
  protection and source bytes do not change. Cases the frozen helper refuses
  outright (unpaired dual) stay with the existing layout probes.

## Do NOT do

Change codec classification, Rust, IPC, the helper, profile, fonts or pins;
rewrite existing fixture bytes; weaken an existing assertion. No native claim:
the pdf-export, script-check and publication-exit drills are **BLOCKED** here.

## Checks and stopping

Red first: new corpus cases fail on the assessment side only. Then one injected
fault per new guard must fail the corpus; source restored byte-identical. Scan
every tracked `.fountain` fixture for newly reported lines. Tier 2 frontend
domain: full `pnpm check`, `pnpm test:pdf-helper`, browser smoke; Rust gates
unchanged from the session baseline. Record evidence; update TODO,
current-state and the owning validation doc; one commit.
