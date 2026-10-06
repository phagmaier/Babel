# AUDIT-D04-R5 — located limitations for the retained title omissions

Status: **done 2026-10-05**; base `d1c6efe`, main, local only.
Owner selected R5 explicitly. Dependencies: AUDIT-D04-R4,
AUDIT-EXPORT-WARNINGS and AUDIT-SWEEP-COVERAGE complete.
Requirements: SPEC S09.2 / INV-03; ADR 0037; existing assessment contract.
Origin: [warning findings](AUDIT-EXPORT-WARNINGS.md#open-findings-this-comparison-now-stops),
[supplemental inventory](../../tests/differential/mixed-findings.json).

## Deliverable and acceptance

- Report blocking SC005 with original source byte/line targets for the three
  retained omissions: an indented opening key with only a note value; a slightly
  indented unknown key beneath a title field; that key beside a title boneyard.
  State that the title text is omitted. Export requires acknowledgement before
  choosing a destination and can then publish the captured version.
- Read the opening title block before the assessment removes inline notes.
  Keep the codec view for inline-note assessment and the existing paragraph
  comparison; preserve the separately retained overlapping-marker outcomes.
  Check renderer keys outside codec field ranges and beside reported boneyards.
  Locate a separate key through its own values, stopping before the next key.
- Correct the two limitations saying a section beside a removed boneyard or a
  synopsis past a note prints, when the mirrored renderer says it is omitted.
  Retain their blocking severity and existing omission-summary boundaries.
- Write literal oracle cases before behavior edits, including the three
  findings, indentation/range, note-free/recognized-title and false-title
  continuation controls. Verify
  them against actual pinned parser readings and retained PDFs. Flip the three
  `exports: false` warning cases and their native drill step; never widen
  `announced`. Red first: located issue/wording and corpus expectations fail.
- Account for supplemental title-reading and title-warning inventory changes
  with an independent source classification and PDF evidence. Pin exact changed
  sets; preserve baseline `8084690`, frozen generator/seed and all unrelated
  assertions. Keep marker disagreements and three marker-warning gaps open.
- Assessment must leave source bytes unchanged, including BOM/CRLF. Native
  `pdf-export` verifies all three findings: located review before destination,
  cancellation writes no PDF, acknowledgement exports the observed omissions,
  Save leaves original bytes unchanged. No new renderer-fidelity claim.

## Do NOT do

Change codec, parser mirror rules, helper/profile/fonts/pins, Rust/IPC,
export-warning acceptance rules or source/save/recovery behavior; change the
frozen audit, baseline, seed or unrelated inventory; normalize fixture bytes;
start overlapping-marker remediation, M6/F4/group F or release admission.

## Checks and stop

Tier 2 frontend domain, with named browser/native drills. Focused:
`pnpm exec vitest run tests/contract/export-assessment.test.ts tests/contract/renderer-reading.test.ts tests/contract/export-pdf.test.ts tests/ui/ExportPdfPanel.test.tsx`.
Then sequential helper build `pnpm pdf-helper`,
`python3 tools/pdf-helper/verify_runtime.py target/pdf-helper/runtime --exact`,
`pnpm test:pdf-helper`, `pnpm test:differential` with fresh report prefixes,
and each `BABEL_DIFFERENTIAL_FAULT=capture`, `renderer`, `assessment`,
`announced` rejected. Run tooling
`python3 -m unittest discover -s tests/tools -p 'test_*.py'`, `pnpm check`,
`pnpm test:browser`, `cargo fmt --check`, `cargo clippy -- -D warnings`,
`cargo test --workspace --locked` (single filesystem; no filesystem-path change).
Use `mise exec node@26.7.0 pnpm@11.22.0 --` and the existing Cargo cache.

After `pnpm tauri build --no-bundle`, check `df -i /tmp`, recreate missing drill
helpers and set `BABEL_NATIVE_IME_TEMP_ROOT` to this task's new Btrfs directory.
Native exact invocation (ordinary close, tmpfs and Btrfs):
`BABEL_NATIVE_IME_TEMP_ROOT=$PWD/target/audit-d04-r5-20261005/ime BABEL_SHUTDOWN_MODE=ordinary python3 tests/native/writing-lifecycle/isolated_ime.py target/audit-simp-f/prerequisites/prefix -- python3 tests/native/writing-lifecycle/integrated_exit.py /tmp $PWD/target --output $PWD/target/audit-d04-r5-20261005/native-1 --modes pdf-export script-check publication-exit title-page`.
Skip the full workspace filesystem matrix (no filesystem/native code changes)
and installed/bundled package acceptance (release gate). Retain failures and
crash identities; clean controls cannot close historical findings.

Append [evidence](../test-evidence/AUDIT.md#audit-d04-r5--located-title-omission-limitations),
update owning tracker/current-state and the changed assessment/testing contract,
review final diff, commit locally on main and stop. **No push or next task.**
