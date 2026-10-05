# AUDIT-PARK-H-F4 — drafts that still stop saving

Status: **decomposed 2026-10-04**; base `2456c2c`. **F4-01 done** at base
`a9287ed`, [evidence](../test-evidence/AUDIT.md#audit-park-h-f4-01--commands-refuse-instead-of-creating-a-refused-draft).
**F4-02 done** at base `10650c0`, [evidence](../test-evidence/AUDIT.md#audit-park-h-f4-02--emptied-speech-rows-keep-their-speech).
The owner decided F4-03, F4-04 and F4-05 on 2026-10-04 (table below).
**F4-03 done** at base `15d5da8`,
[evidence](../test-evidence/AUDIT.md#audit-park-h-f4-03--speech-that-opens-with-a-parenthesis).
F4-04 and F4-05 are decided and ready; each still needs its deliverable
section here before code.
Dependencies: AUDIT-PARK-H, F1, F2 and F3 complete. The owner delegated task
selection, wording and implementation decisions on 2026-10-04; that covers
extending a mechanism the contract already documents, not a new saved-format
tradeoff. Push authorization is unchanged.
Requirements: SPEC S03, S05.5, S06.1, S06.3, S07.1, EDIT-02, INV-01/04;
[document model](../document-model.md#m3-02-production-codec-foundation),
[ADR 0027](../decisions/0027-uncapturable-draft-preservation.md).

## Probe (before edits, JSDOM contract level)

Scratch test, removed; source and output retained in `target/audit-park-h-f4/`.
Sixteen element contexts times 53 texts: **229 of 848 refused**. Marks,
stepwise typing, structure and end-of-file cases add 47 more. The reach is
wider than F3 listed. Each shape below is accepted by the editor and refused
by capture, so nothing typed anywhere is saved or journaled until it changes.

| Group | Shape                                                                                                                                                                                                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | A command creates it: bold, italic or underline from a Scene Heading's first character; a speech row converted while rows of that speech follow; a row converted to an element that cannot hold its text.                                                                                   |
| B     | A Dialogue or Parenthetical row emptied while rows of that speech follow. Fountain ends the speech at the blank; the row named is the one below.                                                                                                                                            |
| C     | Speech text that opens with a parenthesis. A Dialogue row is refused from the closing parenthesis on: `(laughs)`, `(laughs) Oh no.`. A Parenthetical is refused with any text after it: `(beat) x`.                                                                                         |
| D     | Typed text Fountain reads as other syntax. Scene Heading not starting with a letter or digit (`'TIL DAWN`, `"X"`, leading space or `.`), or ending in `#1#`. Dialogue starting with `.x`, `!`, `@`, `>`, `~`, `# `, `=`. Character ending `^`. Transition ending `<`. `{{` in any row.      |
| E     | An empty row that needs bytes it does not have. A numbered heading emptied (the number has no line). A heading, Dialogue or Parenthetical emptied on a last line with no line ending.                                                                                                       |
| F     | Dual dialogue: typing on the blank row between paired cues, or converting inside a pair. Section or Synopsis starting with a space. Parenthetical text before its opening parenthesis. Enter inside a Parenthetical: accepted on purpose since M3-05, with the emergency copy as its route. |

Group C is ordinary writing and the most frequent. Group A is one shortcut.

## Decisions

| Sub-task | Group | Decision                                                                                                                                                                                                                                                                                                                                                                                         |
| -------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F4-01    | A     | **Ready.** The command refuses with a reason, as conversion and join commands already do. No saved byte, parser rule or capture path changes.                                                                                                                                                                                                                                                    |
| F4-02    | B     | **Done.** Spell the emptied row as Fountain's two-space dialogue line, which the break command already writes. Needs its own red tests for intent, recovery and selection mapping.                                                                                                                                                                                                               |
| F4-03    | C     | **Owner decided 2026-10-04: save and unprotect.** Save the exact text with recovery-only intent, and stop protecting a line that merely begins with a closed parenthetical. Existing files: such a line was read-only and becomes editable; bytes and element are unchanged. An unclosed `(laughs` keeps its handling. Saving alone was rejected: the author's own line would reopen read-only.  |
| F4-04    | D     | **Owner decided 2026-10-04: save as Action or Dialogue.** Save the exact text as Action (Dialogue inside a speech), keep the typed element only in recovery, and show a non-blocking notice naming the row. Reopened without recovery the row is Action or Dialogue. A lasting saved-format choice: write the ADR with the task. Refusing the keystroke and reading more syntax were not chosen. |
| F4-05    | E     | **Owner decided 2026-10-04: line ending only.** When a row is emptied on a last line with no line ending, add a line ending in the file's own convention so the row still exists. An emptied numbered heading stays refused: the number is authored text and S05.5 keeps authored text in the Fountain file, not in recovery metadata.                                                           |
| —        | F     | Not scheduled. Tracked here; the F3 alert names the row.                                                                                                                                                                                                                                                                                                                                         |

## F4-01 deliverable and acceptance

1. Formatting: a mark that would leave a row with no Fountain spelling as its
   element is refused, for a selection and for a stored mark at a row start.
   The check asks the codec about that one row; no grammar rule is copied.
2. Conversion: a speech row cannot become a non-speech element while
   unselected, nonempty rows of the same speech follow; a row cannot become an
   element that cannot hold its text. A row that already has no spelling may
   still be converted, since that is how the author repairs it.
3. Every refusal leaves the document, selection and Undo history unchanged
   and shows a reason. Commands that captured before still capture the same
   bytes.
4. Red tests before the fix for each command, then one contract case per
   shape showing the row before the command still captures.

Withdrawn during the task: refusing Enter inside a Parenthetical. Three
incumbent tests and the editor-behavior contract pin that split as accepted,
with the emergency copy as its route. Changing it is a contract change, so it
moved to group F.

## F4-02 deliverable and acceptance

1. A Dialogue or Parenthetical row emptied while nonempty rows of its speech
   follow is written as the two-space dialogue line, with its element and
   emptiness as recovery-only intent on that line. The codec chooses the
   spelling, and only for an edit it would otherwise refuse.
2. Every capture that saved before saves the same bytes and intent. Refusals
   keep their codes and messages. A draft with another unwritable row names
   that row instead of the Dialogue below the emptied one.
3. Red tests before the fix for intent, exact recovery, sparse metadata,
   selection mapping, Undo/Redo and typing into the row; a mounted save and
   checkpoint test; an old-against-new differential over typed drafts.
4. Left refused and pinned: an emptied row above a protected row (F4-03
   shape) and a row emptied on a last line with no line ending (F4-05).

## F4-03 deliverable and acceptance

1. Opening a file: a speech or Action line that opens with `(` and has a
   closing `)` somewhere is an ordinary editable row with no
   `malformed-parenthetical` diagnostic. Its bytes, element and text are
   unchanged. A line with no closing parenthesis stays protected as before.
2. Saving, with the existing `intendedKind` values and no schema change:
   - Dialogue `(laughs) Oh no.` needs no intent once rule 1 holds.
   - Dialogue that Fountain reads as a parenthetical (`(laughs)`, edge
     spaces ignored) is written exactly; the line is `parenthetical` with
     recovery-only intent `dialogue` and the exact text.
   - A Parenthetical with text after its closing parenthesis (`(beat) x`,
     `(beat) `) is written exactly with recovery-only intent `parenthetical`.
     Exact recovery restores the element and text; the file alone opens as
     Fountain reads it.
3. Every capture that saved before saves the same bytes and intent, except
   that a draft holding a line rule 1 unprotects may now own it. Refusals keep
   their codes. A Parenthetical whose text does not open with `(` stays
   refused (group F) and is the F3 alert's example from now on.
4. Red tests before the fix for each shape, stepwise typing, exact recovery,
   sparse metadata, selection mapping, Undo/Redo and typing on after
   recovery; opened-file tests for rule 1 including a no-op capture; Script
   Check and the export gate on the unprotected line; a mounted save and
   checkpoint test; an old-against-new differential over typed drafts.
5. Left refused and pinned: an imported unclosed parenthesis and an emptied
   row above one; Parenthetical text before its parenthesis; group D to F.

## Do NOT do (F4-01)

Change the codec's accepted or refused set, parser classification, error
codes or messages, recovery metadata or any captured byte; run a capture on
the typing path or inside a command; refuse typed text; implement F4-02 to
F4-05; change native code; rewrite fixtures or frozen root AUDIT.md; push.

## Do NOT do (F4-02)

Change parser classification, error codes or messages, the recovery metadata
schema or any byte of a capture that saved before; run a capture on the
typing path or inside a command; implement F4-03 to F4-05 or group F; change
native code; rewrite fixtures or frozen root AUDIT.md; push.

## Do NOT do (F4-03)

Change any other parser classification, the recovery metadata schema or any
error code; unprotect an unclosed parenthesis or any raw, title or hidden
region; change a command's rule (join, hard break and conversion keep their
refusals); run a capture on the typing path or inside a command; implement
F4-04, F4-05 or group F; change native code; rewrite fixtures or frozen root
AUDIT.md; push.

## Checks and stopping

F4-01, Tier 2 frontend (editor commands plus one read-only codec helper):
focused red then green, `pnpm check`, tracked frontend count, helper, browser
smoke, Rust format/clippy/workspace on one filesystem, fresh release build. No
native drill: no capture success path, saved byte or native boundary changes.

F4-02, Tier 2 frontend plus named native modes (pure codec change, saved bytes
change). Focused: `pnpm exec vitest run --exclude 'target/**'
tests/contract/emptied-speech-row.test.ts tests/contract/capture-refusal.test.ts
tests/ui/WritingView.test.tsx -t AUDIT-PARK-H`. Shared gates as F4-01. Native
through `integrated_exit.py`: `empty-heading` (new phase F) on tmpfs and
Btrfs, since it saves and journals the new bytes; `pdf-export script-check
publication-exit title-page typed-export` on Btrfs only, as regression of
unchanged capture paths. Skipped: the tmpfs/Btrfs workspace matrix, because no
native, IPC or filesystem path changes.

F4-03, Tier 2 frontend plus named native modes (codec change; saved bytes and
the opened reading change). Focused: `pnpm exec vitest run --exclude
'target/**' tests/contract/speech-parenthesis.test.ts
tests/contract/capture-refusal.test.ts
tests/contract/emptied-speech-row.test.ts tests/ui/WritingView.test.tsx -t
AUDIT-PARK-H`. Shared gates as F4-01. Native through `integrated_exit.py`:
`empty-heading` (phase E moves to the group F example, new phase G) on tmpfs
and Btrfs; `pdf-export script-check publication-exit title-page typed-export`
on Btrfs only. Skipped: the tmpfs/Btrfs workspace matrix, because no native,
IPC or filesystem path changes.

Update editor-behavior, TODO/current-state and append-only audit evidence.
One task-ID commit per sub-task on main; finish `git diff --check` and stop.
