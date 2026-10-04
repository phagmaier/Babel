# AUDIT-D04-R1 — an all-empty leading `Key:` block is body text

Status: **done 2026-10-04**; base `aad1e83`.
[Evidence](../test-evidence/AUDIT.md#audit-d04-r1--all-empty-leading-key-block).
Dependencies: AUDIT-D04 (finding), AUDIT-PARK (both sides confirmed).
Requirements: DOC-04, INV-02, SPEC S09.2; owning contract
[document model](../document-model.md#m3-03-complex-source-structures-and-editing).

## Owner-approved rule (2026-10-04)

A leading `Key:` block is a title page only if at least one field has a value,
on the same line or as an indented continuation. If every field in the block is
empty, the block is body text, as the pinned renderer treats it. Update
`docs/document-model.md` and the tests together; show that the title-page form
cannot produce an all-empty block.

## Deliverable and acceptance

- Codec: `classify` decides the opening block once, before classifying lines. A
  value that is only spaces or tabs is empty (the renderer strips it). Source
  bytes, no-op identity, BOM/CRLF and every non-empty title page are unchanged.
- Title form: add, edit, remove and move either succeed with at least one value
  left, remove the block entirely, or refuse with the source retained. The add
  path validates a new field beside a valued seed field, so an empty field can
  still be added to a page that has a value (the native title drill does this).
- Assessment: the renderer's title-page reading is mirrored for the opening
  block. Where it disagrees with the codec (an indented line after a valued key;
  an indented first key) the result is a blocking SC005 with the renderer's
  reason. Found while checking this rule; same class as AUDIT-D04-R2.
- Hand-written cases appended to `fixtures/assessment/oracle.json` and checked
  by the helper (PDF text) and the assessment; the AUDIT-PARK `FADE IN:` case
  flips to clean.

## Do NOT do

Change Rust, IPC, the helper, profile, fonts or pins; rewrite fixture bytes
from before this session; weaken an existing assertion. No native claim: the
native title-page drill (`--title-page`) is **BLOCKED** here (no display).

## Checks and stopping

Red first (codec, form and corpus), then injected faults for the rule, its
whitespace and continuation details, the add seed and both assessment branches.
Full `pnpm check`, `pnpm test:pdf-helper`, browser smoke; Rust gates unchanged
from the session baseline. Evidence, TODO, current-state and the owning docs in
one commit.
