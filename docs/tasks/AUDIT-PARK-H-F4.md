# AUDIT-PARK-H-F4 — drafts that still stop saving

Status: **decomposed 2026-10-04**; base `2456c2c`. F4-01 and F4-02 are ready
agent work. F4-03, F4-04 and F4-05 each need one owner decision first.
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

| Group | Shape                                                                                                                                                                                                                                                                                  |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | A command creates it: bold, italic or underline from a Scene Heading's first character; a speech row converted while rows of that speech follow; a row converted to an element that cannot hold its text; Enter inside a Parenthetical.                                                |
| B     | A Dialogue or Parenthetical row emptied while rows of that speech follow. Fountain ends the speech at the blank; the row named is the one below.                                                                                                                                       |
| C     | Speech text that opens with a parenthesis. A Dialogue row is refused from the closing parenthesis on: `(laughs)`, `(laughs) Oh no.`. A Parenthetical is refused with any text after it: `(beat) x`.                                                                                    |
| D     | Typed text Fountain reads as other syntax. Scene Heading not starting with a letter or digit (`'TIL DAWN`, `"X"`, leading space or `.`), or ending in `#1#`. Dialogue starting with `.x`, `!`, `@`, `>`, `~`, `# `, `=`. Character ending `^`. Transition ending `<`. `{{` in any row. |
| E     | An empty row that needs bytes it does not have. A numbered heading emptied (the number has no line). A heading, Dialogue or Parenthetical emptied on a last line with no line ending.                                                                                                  |
| F     | Dual dialogue: typing on the blank row between paired cues, or converting inside a pair. Section or Synopsis starting with a space. Parenthetical text before its opening parenthesis.                                                                                                 |

Group C is ordinary writing and the most frequent. Group A is one shortcut.

## Decisions

| Sub-task | Group | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F4-01    | A     | **Ready.** The command refuses with a reason, as conversion and join commands already do. No saved byte, parser rule or capture path changes.                                                                                                                                                                                                                                                                                                                                                                            |
| F4-02    | B     | **Ready.** Spell the emptied row as Fountain's two-space dialogue line, which the break command already writes. Needs its own red tests for intent, recovery and selection mapping.                                                                                                                                                                                                                                                                                                                                      |
| F4-03    | C     | **Owner decision.** Saving the exact text with recovery-only intent extends the documented incomplete-parenthesis draft and needs no new format. Alone it is a trap: the parser protects any speech or Action line that opens with a parenthesis and is not one wrapped pair, so the author's own line reopens read-only. Recommended: do both, and stop protecting a line that merely begins with a closed parenthetical. That changes how existing files open (bytes and element unchanged, the row becomes editable). |
| F4-04    | D     | **Owner decision.** Three options per shape: save the exact text as Action or Dialogue with the typed element kept only in recovery, and tell the author; refuse the keystroke; or read more syntax (accept `.` before emphasis, read a typed `#1#` as the scene number). The first is uniform and matches S05.5 but saves a visible Scene Heading as Action, a lasting format choice that needs an ADR. Recommended: the first, with a non-blocking notice naming the row.                                              |
| F4-05    | E     | **Owner decision.** A numbered empty heading needs the number carried in draft metadata (a new optional field). An emptied last line needs a line ending the file did not have. Both change a documented limit.                                                                                                                                                                                                                                                                                                          |
| —        | F     | Not scheduled. Tracked here; the F3 alert names the row.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

## F4-01 deliverable and acceptance

1. Formatting: a mark that would leave a row with no Fountain spelling as its
   element is refused, for a selection and for a stored mark at a row start.
   The check asks the codec about that one row; no grammar rule is copied.
2. Conversion: a speech row cannot become a non-speech element while
   unselected rows of the same speech follow; a row cannot become an element
   that cannot hold its text. A row that already has no spelling may still be
   converted, since that is how the author repairs it.
3. Enter strictly inside a Parenthetical, or a selection ending inside one, is
   refused.
4. Every refusal leaves the document, selection and Undo history unchanged
   and shows a reason. Commands that captured before still capture the same
   bytes.
5. Red tests before the fix for each command, then one contract case per
   shape showing the row before the command still captures.

## Do NOT do

Change the codec's accepted or refused set, parser classification, error
codes or messages, recovery metadata or any captured byte; run a capture on
the typing path or inside a command; refuse typed text; implement F4-02 to
F4-05; change native code; rewrite fixtures or frozen root AUDIT.md; push.

## Checks and stopping

Tier 2 frontend (editor commands plus one read-only codec helper): focused
red then green, `pnpm check`, tracked frontend count, helper, browser smoke,
Rust format/clippy/workspace on one filesystem, fresh release build. No native
drill: no capture success path, saved byte or native boundary changes.
Update editor-behavior, TODO/current-state and append-only audit evidence.
One task-ID commit per sub-task on main; finish `git diff --check` and stop.
