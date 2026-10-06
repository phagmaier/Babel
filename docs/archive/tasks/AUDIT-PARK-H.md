# AUDIT-PARK-H — empty Scene Heading row cannot be captured: confirm first

Status: **done 2026-10-04** (verdicts recorded; findings tracked as
AUDIT-PARK-H-F); base `53a4b65`.
[Evidence](../../test-evidence/AUDIT.md#audit-park-h--empty-scene-heading-capture).
Dependencies: AUDIT-DEV-REVIEW recorded the observation (JSDOM only, same on
`main`): after some text, Enter then Ctrl+1 (or Tab, Escape, Tab) leaves an
empty Scene Heading row, and `captureEditor` throws "Requested element cannot
round-trip unambiguously" until a character is typed. Requirements: SPEC S03
(recovery, saving and close are distinct and none may silently lose work),
S07.2, INV-01/04; docs/persistence-and-recovery.md.

## Deliverable and acceptance

- **Confirm or refute**, in the mounted editor and in the real app, with a
  verdict for each question:
  1. Does the empty row stop capture, and what does the author see?
  2. Save cadence: do edits made elsewhere while the row is empty reach the
     source file?
  3. Recovery: do they reach the journal? What survives an owned SIGKILL?
  4. Protected close: is it refused, and can the draft still be preserved?
  5. Does capture resume, with nothing lost, once the row has text or is gone?
- **Tests that pin the behaviour as found**: one WritingView test (JSDOM,
  mocked native ports) and one native drill mode on disposable content.
- **No fix** to save, recovery, journal, snapshot, lease, IPC or native code.
  A confirmed defect is recorded with its reproduction in the evidence and
  tracked in TODO for an owner decision.
- **Scope added while confirming:** which other Element choices leave an
  uncapturable row. A new Note or Omitted material row in an opened screenplay
  does, even with text; it is confirmed the same way and tracked with the rest.

## Do NOT do

Change product source at all in this task unless a failing test first shows a
small bug wholly inside `src/domain`, `src/editor`, `src/application` or
`src/app` that does not touch the paths above. Never use the owner's files:
synthetic text, disposable roots, owned processes only.

## Checks and stopping

Tier 1 tests and docs. `pnpm check`; the native mode on tmpfs and Btrfs with
the binary in place. Record one line per check and the verdict table; update
TODO and current-state; one commit.
