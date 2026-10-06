# AUDIT-SWEEP-COVERAGE — a second generated source corpus

Status: **done 2026-10-05**; base `660f869`, main, local only.
[Evidence](../../test-evidence/AUDIT.md#audit-sweep-coverage--second-mixed-generated-corpus).
Origin: [tracker](../../tasks/AUDIT-TRACKER.md),
[reading evidence](../../test-evidence/AUDIT-READING-CANDIDATES.md#classification--2026-10-05),
[warning evidence](../../test-evidence/AUDIT.md#audit-export-warnings--renderer-warnings-compared-at-export).
Requirements: SPEC S09.2 / INV-03; standing
[differential policy](../../testing.md#differential-regression-gates).

## Deliverable and acceptance

Add a deterministic, better-mixed **70,000-source supplemental corpus** beside
the frozen 70,000. Use full mixed output bits, a separate recorded seed, all
30 original tokens plus the 30 scratch-sweep tokens, varied indentation,
trailing whitespace, gaps and 1–7 authored rows. Keep both corpora generated,
with no manuscript input or fixture-byte rewrites.

- Preserve the original generator body, seed `0x104d04`, ordered output,
  baseline `8084690`, and every existing reading/warning assertion. Keep their
  original runs; add supplemental runs through **both actual pinned oracles**.
- Red first: executable coverage guards must reject a control using the frozen
  generator's coupled LCG draws with the supplemental choices, showing its absent tokens, indentation
  and row counts before implementing the mixed generator.
- Guard repeatability and useful diversity: every vocabulary item, prefix,
  suffix, gap and row count occurs; every token pair occurs; each token appears
  at each row position and each opening indentation; at least 60,000 distinct
  sources. Record counts and corpus SHA-256, including independent replay of
  the frozen output. These are source-choice checks, not statistical proof.
- Reading: compare the supplemental inputs to the actual pinned parser and
  frozen control. Reject new parser disagreements/refusals and new clean
  disagreements. Report every frozen-control candidate and admission change.
- Warnings: compare the same supplemental inputs to the helper's own warnings
  and current announcements. Unknown categories/refusals fail. Record every
  unannounced source. If broader coverage reproduces existing gaps, review and
  retain an exact, source-specific disposition inventory with named finding
  classes; reject unexplained sources. Do not automatically accept generated
  expectations, broaden the original exceptions or fix the assessment.
- Report corpus origin and separate totals so supplemental findings cannot
  erase frozen results. Update the owning tracker/current-state and evidence.

## Reviewed supplemental limits before final gates

Discovery retained in `target/audit-sweep-coverage-20261005/discovery.*.json`:
634 pinned `unsupported-publication:unpaired-dual-dialogue` refusals,
404 existing disagreements (398 title decisions with a note-only `Key: [[v]]`
value, six paragraph counts with overlapping note/boneyard markers), four
additional AUDIT-D04-R4 admission corrections, and 333 unannounced warning
occurrences (330 unknown title fields, two notes, one boneyard).
No new reading regression or clean disagreement relative to `8084690` among
sources accepted by the renderer oracle; preparation refusals do not enter
reading/assessment comparisons. The warning oracle still reads all 70,000.

The initial supplemental tests correctly failed on the undispositioned limits.
They cannot require universal agreement without fixing production behavior,
which is outside this task. The reviewed
[inventory](../../../tests/differential/mixed-findings.json) pins every ordered
source and oracle outcome by count and SHA-256, with the four R4 sources written
literally. All 404 mismatching facts are identical on frozen and current;
every refusal's reason was independently rerun through pinned `prepare`.
Source-level inspection confirms the note-only title-value and overlapping
marker classes; it does not prove PDF fidelity or classify every candidate as
safe. The full readable sources remain in reproducible reports. This inventory
retains failing outcomes, not accepted publication behavior. Supplemental tests
reject changes to any retained set, new regression/clean disagreement, unknown
warning or warning refusal. The frozen tests are unchanged byte for byte.
A scoped correction must review and update its supplemental inventory as well
as its literal regressions; never regenerate the inventory just for green.

AUDIT-D04-R5 remains next for its three existing finding shapes. The marker
paragraph/announcement cases need a separate future brief; no fix starts here.

## Scope and safety

Test generators, differential tests/reporting, coverage guards and owning docs
only. No production codec, bridge, mirror, assessment, export, helper, profile,
font, dependency, Rust or IPC changes. No AUDIT-D04-R5 implementation, case
flips, unrelated task, native-crash disposition, retained artifact pruning,
baseline advance, assertion weakening, push or release claim. Any unexplained
new discrepancy needs a scoped disposition here before claiming coverage done.
The corpus exercises parsing/assessment in memory and the pinned helper; it
cannot verify PDF layout, native writing, save bytes or installed acceptance.

## Exact checks and skips

Tier 2 **test-only**, following the prior reading investigation's shared-gate
scope. Run with Node 26.7.0 / pnpm 11.22.0 through
`mise exec node@26.7.0 pnpm@11.22.0 --` and retain logs under a fresh ignored
`target/audit-sweep-coverage-*` root.

1. Red then green:
   `pnpm exec vitest run tests/contract/generated-corpus.test.ts`.
2. Focused contracts:
   `pnpm exec vitest run tests/contract/generated-corpus.test.ts tests/contract/renderer-reading.test.ts tests/contract/export-assessment.test.ts`.
3. Sequential helper build/verification:
   `pnpm pdf-helper`;
   `python3 tools/pdf-helper/verify_runtime.py target/pdf-helper/runtime --exact`;
   `pnpm test:pdf-helper`.
4. `BABEL_DIFFERENTIAL_REPORT=<fresh-prefix> pnpm test:differential`;
   repeat with each `BABEL_DIFFERENTIAL_FAULT=capture`, `renderer`,
   `assessment`, `announced`, expecting failure in its relevant gate.
5. `python3 -m unittest discover -s tests/tools -p 'test_*.py'`;
   `pnpm check` (guidance, all links, format, lint, typecheck, full unit/UI,
   build); `git diff --check`. After final docs, rerun format/links/guidance.
6. Independently replay corpus generation/choice counts and verify unchanged
   frozen generator, baseline configuration, original assertions, fixture and
   production paths against base `660f869`.

Native drill **skipped**: no production behavior, DOM/input, native boundary or
filesystem path changes; no executable native mode is needed for generated
parse-level coverage. Browser smoke, desktop/package build, Rust
format/Clippy/workspace tests and the tmpfs/Btrfs matrix are skipped for the
same test-only scope, as in AUDIT-READING-CANDIDATES. Existing native failures,
M6-02, C1/F2 and Local v1 stay open. Record one labeled evidence line per check,
including failures, elapsed shared-gate times and every omission.

Stop after acceptance/evidence, tracker/handoff and a local task-ID commit on
main. **AUDIT-D04-R5 is next; do not start it in this run. No push.**
