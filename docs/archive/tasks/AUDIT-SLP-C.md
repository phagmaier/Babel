# AUDIT-SLP-C — Remove unused complex codec edit APIs

Status: **complete; stopped before AUDIT-SIMP-N**. Base `186ea59`, clean main, 2026-10-03.
Dependencies: AUDIT-SLP-B and AUDIT-D01 complete; Wave 3 approved in TODO.
Requirements: QA-01, INV-02/03; existing source protection/editor contracts.

## Scope and acceptance

- S-08: delete replaceInline, replaceHiddenContent, proposeSourceConversion,
  acceptSourceConversion, ConversionProposal, proposals, stale-conversion and
  the conversion/mixedHidden bypass parameters. Keep replaceKnownSourceContext
  protection strict. Keep setDualDialogue, replaceLineWithBreaks and existingSource
  byte-identical and wired through AUDIT-D01 deferred capture.
- Port supported inline edits to production EditorState transactions/capture and
  title edits to the existing title action. Port standalone hidden edits to
  complete known context, retaining exact endings/wrappers/refusal assertions.
  Retired mixed-hidden and raw-conversion successes become independent parser
  fixtures plus production protection tests; do not recreate removed helpers.
- Preserve every independent fixture/hash/source/semantic literal. Renderer
  tooling must distinguish independently authored historical edited samples from
  live operation checks. Repair document-model and ADR 0007 capability claims.

## Tests first and checks

Record red removal/retention check before edits. Tier 2: focused complex codec,
production codec, editor bridge/keys/shortcuts/input tests; full pnpm check,
Rust fmt/Clippy/workspace tests on one filesystem, browser smoke and independent
pinned renderer comparison. Pure codec/test/tooling change; no filesystem/native
IPC/packaging behavior changes, so no second filesystem or new native drill.
Finish changed links, Python lint and git diff --check. Retain failed runs and
one labeled line per check in [audit evidence](../../test-evidence/AUDIT.md).

## Do NOT do / stopping point

Keep frozen AUDIT.md, independent literals, native/editor production paths,
inline encoder, prior crashes and failure evidence unchanged. No new conversion
UI/API, dependencies, schema, persistence, SIMP-N/F, D-06 or gate closure.
Commit on main and stop after AUDIT-SLP-C; next task is AUDIT-SIMP-N's separate
bounded brief. No push. SELinux, C1/F2, M6-02 and Local v1 remain open.

Acceptance/checks/failures: [AUDIT-SLP-C evidence](../../test-evidence/AUDIT.md#audit-slp-c--unused-complex-codec-edit-apis).
