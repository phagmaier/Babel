# AUDIT-D07 — typed-scene oracle

Status: **done 2026-10-04**; base `718c6e8`.
[Evidence](../../test-evidence/AUDIT.md#audit-d07--typed-scene-oracle).
Dependencies: DESIGN triage accepted the D-07 oracle; AUDIT-D01 and AUDIT-D04
complete. Requirements: SPEC S07.2/S07.3/S07.6, CHECK-01/02, PDF-01, INV-03.
Covers the oracle part of
[D-07](../AUDIT.md#d-07--the-verification-regime-never-typed-a-scene-add-an-independent-end-to-end-oracle-and-an-early-owner-session-impact-high-m).
The owner session is non-blocking and not part of this task. The frozen audit
and [refuted proposals](../AUDIT.md#dropped-or-refuted) remain read-only.

## Deliverable and acceptance

- **Typed from empty.** One vitest test mounts the production editor with the
  real completion popup and shortcut registry, starts from zero bytes and
  writes a scene that reaches every S07.2 row a writer can type: scene
  heading, action, character, parenthetical, dialogue, dual dialogue, transition,
  shot, lyrics and the empty-lyrics exit, centered, section, synopsis, page
  break and a multiline note. Keys go through the view's DOM keydown handler
  (Enter, Tab, `Ctrl+1/6/7/8`); unbound choices go through the same command
  route as the palette and element picker. Text is inserted as typed text.
- **Pinned.** Exact captured bytes, row kinds and speech attachment, the Enter
  presses consumed by an open suggestion (S07.6), a lossless reopen, full
  Undo to zero bytes and Redo back, Script Check issues (none) and the export
  assessment (clean, one omission summary).
- **Same fixture, independent renderer.** The bytes live once in
  `fixtures/assessment/typed-scene.json`. `tools/pdf-helper/test_helper.py`
  renders them with the pinned helper and checks the renderer's own paragraph
  classification and the `pdftotext` output against hand-written expectations
  from Fountain semantics.
- **Findings stay visible.** A behavior the oracle exposes is pinned as found,
  reported with its reproduction in evidence and TODO, and fixed only within
  the session bug-fix rule. Raw/unsupported rows cannot be typed from empty;
  their refusals stay covered by the existing key tests.

## Do NOT do

Change Rust, IPC, the PDF helper, profile, fonts or pins; rewrite existing
fixture bytes; weaken an existing assertion; resolve an S07.2/S07.3 conflict
without the owner. No native claim: the native typed-export case (type,
export, `pdftotext`) is **BLOCKED** here (no display) and stays with the owner.

## Checks and stopping

Expectations are written by hand before running either side. Then injected
faults in the Enter table and the codec spelling must each fail the oracle;
source restored byte-identical. Tier 1 for behavior (tests and docs only):
full `pnpm check`, `pnpm test:pdf-helper`, `git diff --check`; browser and Rust
gates unchanged from the session baseline. Record results in
`docs/test-evidence/AUDIT.md`; update TODO and current-state; one commit.
