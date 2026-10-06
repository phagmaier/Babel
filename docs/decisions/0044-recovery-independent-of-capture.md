# ADR 0044: Recovery journaling does not depend on Fountain capture

Status: **Accepted direction; implemented in CAPTURE-RECOVERY 2026-10-06**
Date: 2026-10-06. Task: CAPTURE-RECOVERY. Decided by the working agent under
[ADR 0043](0043-agent-decision-authority.md).

## Context

SPEC S03 keeps recovery, source saving, Undo and history independent. Before
this change one row the Fountain codec could not write (for example a
Parenthetical whose `(` was deleted) made `captureEditor` throw, so
`WritingSession.noteEdit` never reached the save cadence: nothing typed
anywhere in the draft was journaled or saved until that row changed. The audit
(AUDIT.md C-01/C-02) named the class fix; AUDIT-C01 and the PARK-H/F4 tasks
closed individual shapes instead.

## Decision

A refused capture still produces a **recovery-only snapshot**: refused rows
are retyped on a never-dispatched copy of the editor state (Dialogue inside a
speech, else Action; empty rows omitted) until the existing codec serializes
it. The snapshot is attached to the unchanged refusal error. Journaling paths
(`noteEdit`, explicit Save) record it; the cadence never source-saves it and
`PersistenceController.save` rejects it. No codec, native, IPC or recovery
schema change: the journal receives ordinary Fountain bytes plus the existing
hash-bound metadata, and startup recovery opens them as usual.

## Alternatives

- Journal the `babel-draft-copy-v1` JSON bundle: needs native schema and an
  importer; recovery would not open it as a script. Rejected for now.
- Write the retyped bytes to the source file: silently changes the author's
  element in the file. Rejected; the file waits for a faithful capture.
- Keep fixing refusal shapes one at a time: leaves the class open. Rejected.

## Consequences

After a crash in the refused state the author gets every row's text back; the
refused row reopens as Dialogue/Action instead of its typed element, which the
alert states in advance. Refusals with no named row keep the old paused
behavior. [Contract tests](../../tests/contract/capture-recovery.test.ts),
[persistence contract](../persistence-and-recovery.md#recovery-independent-of-capture-refusals).

## Evidence still needed

Native writing-lifecycle phase E (`tests/native/writing-lifecycle/empty_heading.py`)
was updated but not run in the agent container (no desktop/WebDriver host).
