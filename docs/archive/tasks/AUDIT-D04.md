# AUDIT-D04 — non-blocking omissions and inline-note assessment

Status: **done 2026-10-04**; base `02dc86c`.
[Evidence](../../test-evidence/AUDIT.md#audit-d04--non-blocking-omissions-and-inline-note-assessment).
Dependencies: DESIGN triage accepted D-04; AUDIT-D03 complete.
Requirements: SPEC S09.2 (amended here), CHECK-01/02, PDF-01/04, INV-03/06/10;
ADR 0037/0039. Covers
[D-04](../AUDIT.md#d-04--export-pdf-demands-an-acknowledgement-for-content-fountain-defines-as-non-printing-impact-medium-m).
The frozen audit and [refuted proposals](../AUDIT.md#dropped-or-refuted) remain read-only.

## Deliverable and acceptance

- **Omission summary.** Closed, unambiguous notes and boneyards, section
  headings and synopses that the frozen profile omits are reported once, as a
  non-blocking summary with counts, line totals and ranges on the verified
  assessment. They are no longer SC005 issues, need no acknowledgement and do
  not consume the 1,000-issue budget. The summary appears in Script Check and
  in every phase of the export panel.
- **Inline hidden content, for assessment only.** A line that is raw solely
  because closed, unambiguous single-line note/boneyard spans follow visible
  text is assessed as the element it is without those spans, as the pinned
  renderer prints it. This removes its raw SC005, its SC004 and the false
  SC001/SC002 on the surrounding speech. Codec classification, editor
  protection and source bytes do not change.
- **Still gated.** Unknown or extra title fields; unclosed or ambiguous regions;
  regions spanning lines with visible text on a boundary line; lines that start
  with a hidden span or are otherwise raw (`{{`, stray markers); paragraph
  limitations; glyph, shaping and layout refusals; SC001–SC004.
- **Truthful summary guards** (each confirmed against the pinned renderer). A
  section or synopsis is summarised only where the renderer also omits it;
  otherwise it stays a blocking limitation with accurate wording. Text the
  renderer would drop while the codec shows it as printed becomes a blocking
  limitation: a `#`-led or `=`-led line the codec treats as text, a
  backslash-escaped hidden marker, and a boneyard opener in a title line.
- **Export flow.** With no blocking issue and no warning, Export PDF goes
  straight from the protected capture to the destination picker. Otherwise
  review and the per-export acknowledgement are unchanged. Advisories alone do
  not force review.
- SPEC S09.2, `docs/screenplay-validation.md`, `docs/pdf-and-formatting.md` and
  ADR 0039 change together with the contract/UI tests and affected drills.

## Do NOT do

Change codec classification, editor protection, serialization or fixture bytes;
native Rust/IPC; helper, profile, fonts or pins. Do not remember
acknowledgements, add automatic fixes, or widen what the renderer accepts. Do
not change title-field detection: `FADE IN:` as a first line is confirmed as a
false "omits title field" and is tracked separately. No SELinux, C1/F2, M6-02 or
Local v1 closure; no push.

## Checks and stopping

Red first: contract tests for the summary, inline see-through, every still-gated
class, each guard, direct export and retained review; mounted panel tests.
Independent oracle: one hand-authored fixture checked by the pinned renderer in
the helper's Python tests (text extracted from rendered PDFs) and by the
assessment in vitest. Expectations are hand-authored from Fountain semantics and
a parse-level probe of the pinned renderer; where it departs from Fountain they
record what it prints. Then
full `pnpm check`, browser smoke, `pnpm test:pdf-helper`, Rust fmt/clippy/
workspace tests. Tier 2: frontend domain/UI only; no filesystem-matrix path, IPC
or native adapter change, so one filesystem for Rust. Native WebKit on
tmpfs/Btrfs with the binary in place beside its helper: pdf-export,
script-check and publication-exit, with owned shutdown attribution. Update a
drill expectation only where the accepted flow changes it, and record it.

Update owning docs, TODO and current-state; link evidence in
`docs/test-evidence/AUDIT.md`. Commit locally on main and stop after D-04.
