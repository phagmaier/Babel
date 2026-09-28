# Editor behavior contract

Status: M1-02 isolated native input proof exists; no production editor. [M1 evidence](test-evidence/M1.md), [ADR 0008](decisions/0008-native-editor-input.md). [SPEC S07](../SPEC.md#s07); EDIT-01–EDIT-06, INV-03/11/12/14.

At the end of a nonempty block, with no IME composition or completion acceptance active, Enter follows this table. The state machine is an editor transaction and must be undoable.

| Current            | Enter result                                                      |
| ------------------ | ----------------------------------------------------------------- |
| Scene heading      | Action                                                            |
| Action / Shot      | Action; retain explicit Shot only where meaningful                |
| Character          | Dialogue attached to speaker                                      |
| Parenthetical      | Dialogue in same group                                            |
| Dialogue           | Action; end group                                                 |
| Transition         | Action                                                            |
| Lyrics             | Lyrics; empty lyrics exits to Action                              |
| Centered           | Action                                                            |
| Section / Synopsis | Action, preserving outline relationship                           |
| Note               | Note line inside multiline note; explicit exit returns to context |
| Page break         | Action after break                                                |
| Raw/unsupported    | Raw-preserving edit; no guessed conversion                        |

Mid-block Enter splits at caret and initially retains type on both sides; start-of-block Enter inserts before without retyping existing content. Empty Dialogue/Character/Parenthetical Enter exits to Action. Empty Action remains intentional, including repeated blank content. Shift+Enter makes a hard break only where source-round-trip is proven. Selection replacement and joins preserve all text and group relationships. IME owns keys during composition; no structural transition fires from a composing Enter.

M1-02 native WebKit observation: a dead-key Return committed composition, then delivered `keydown:Enter` with `isComposing=false` in the same sequence. M3 must guard the composition-to-Enter boundary using the event sequence, not `isComposing` alone. This is an implementation requirement under the existing table; no Enter behavior was amended.

Key priority: IME > open completion menu > explicit element command > smart editor behavior > normal focus navigation outside editor. An active suggestion accepted with Enter consumes that key; a second Enter runs the table. Tab accepts a selected suggestion, otherwise cycles contextual types; Shift+Tab reverses. F6 or equivalent provides an escape from editor Tab handling. The element picker reflects caret type or Mixed and converts explicit selections without dropping text.

Autocomplete is local: speaker cues, heading prefixes, established locations, and times of day. Acceptance is one undo step and never happens by timing alone, in IME, paste, boneyard, or raw content. Undo covers structural edits, scene moves, replace-all, formatting, and fixes. Paste sanitizes external HTML and has a separate import-as-Fountain path. M1 proves native input/selection/composition; M3 implements these rules with table-driven caret/source/undo tests. [ADR 0003](decisions/0003-editor-and-native-ownership.md).
