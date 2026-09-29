# Editor behavior contract

Status: M3-05 adds production smart Enter, boundary joins, explicit type conversion and structural undo on the M3-04 editor state. The default app remains inactive; picker, completion, paste/formatting and full IME integration remain open. M1 proofs remain bounded. [M3 evidence](test-evidence/M3.md#m3-05--smart-keys-joins-and-structural-undo), [ADR 0021](decisions/0021-production-editor-source-captures.md). [SPEC S07](../SPEC.md#s07); EDIT-01–EDIT-06, INV-03/11/12/14.

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

M1-06 demonstrates typed-line text edits, Unicode selection replacement and undo/redo with restored content and selection through the existing native writer. Undo/redo advances persistence versions; F2 captures/hashes outside input handlers and validates exact native receipts. The diagnostic refuses structural/type/protected-region transformations and bounds synchronous grammar filtering to 32 lines/4 KiB. The Enter table, full IME/structural input and production integration remain open. See [M1 evidence](test-evidence/M1.md#m1-06--bounded-codeceditornative-composition-proof).

## M3-04 sole state and capture boundary

[Schema](../src/editor/schema.ts), [state](../src/editor/state.ts), [view](../src/editor/view.ts) and [source bridge](../src/editor/sourceBridge.ts) use the production codec, never the proofs. `createEditorState(bytes, recovery?)` retains immutable source origin in the state plugin. Known primary rows display extracted text/styles; source blanks project as Action/spacers, matching incomplete intent outranks inferred type, and title/hidden/raw and imported malformed rows remain protected. Explicit cue/group, scene/outline, Shot and source ownership survive in the codec/origin fields. An empty source has a virtual Action without a source row. Invalid UTF-8 displays read-only and retains exact bytes.

`mountScreenplayEditor` keeps the current state in EditorView; observers receive state/version facts, not a mutable source mirror. DOM rules retain whitespace, marks and origin fields; the transaction guard requires unchanged identity/type/origin and protects raw rows against deletion or typing. Foreign mark types, invalid Unicode/newline text, structural splits/joins and type/ID changes refuse atomically. Paste/drop remain refused until M3-08. The guard compares affected nodes without codec parsing, encoding, hashing or full source serialization. There is no proof's 32-row/4-KiB production limit; the measured performance/input matrix remains open.

Ordinary typing and direct supported mark transactions use ProseMirror history. Undo/redo restore text/styles/selection and original source spelling on no-op, while `editorVersion` advances for content or explicit selection metadata. Stored marks and view-only settings do not become source changes or history events. The Enter table, joins, moves, type conversion and completion commands are not implemented by this foundation.

Call `captureEditor` only outside synchronous input/dispatch. It derives source through atomic adjacent-row context edits, retaining exact untouched bytes and original no-op syntax. `EditorCaptureBoundary` schedules that work and hashing after dispatch, bounds two active requests, returns frozen compatible persistence snapshots and validates version/session ownership. `isCurrent` is checked again before applying a derived result; no capture method changes the live state. Receipt/status UI must compare directly against the editor's latest version while hashing is pending; production controller/cadence integration is M3-10.

Selection anchors bind editor ID/source index, UTF-16 offset, UTF-8 byte offset and grapheme index/intra-grapheme offset. A surrogate-splitting selection refuses capture rather than guessing bytes. Escapes and emphasis delimiter gaps have an explicit left-boundary mapping. Protected/unknown source is copied verbatim; invalid encoding has no fabricated Unicode selection map. If grammar/styles cannot round-trip, the live draft stays in EditorState and `copyEditorDraft` returns current rows/styles plus exact original bytes. It must not be called a latest Fountain save; later failure/copy workflows must present the refusal.

[Contract tests](../tests/contract/editor-bridge.test.ts) and [synthetic native harness](../tests/native/editor-bridge/README.md) cover no-op corpus bytes, primary fields/rich edits, IDs/anchors, protected/forged content, virtual/invalid source, undo/version and asynchronous failure/staleness. Native WebKit evidence is a declared typing/selection/capture subset, not real IME, structural commands, native writing, printed layout or production activation.

## M3-05 structural commands and safe source boundaries

[Commands](../src/editor/commands.ts) authorize only their own row-changing transactions; history undo/redo may replay them. Changed rows keep stable IDs, new rows use a monotonically advancing session ID counter, and deleted IDs are not reused after undo. Deferred [source capture](../src/editor/sourceBridge.ts) applies atomic codec edits between unchanged protected rows. A note edit owns its entire closed, unambiguous standalone region. The key handler never parses, serializes, encodes or hashes a complete source in synchronous dispatch. Source/caret/undo expectations and real WebKit interaction are in [M3-05 evidence](test-evidence/M3.md#m3-05--smart-keys-joins-and-structural-undo).

At the end of a nonempty row, Enter follows the table. If a Character or Parenthetical already has an attached Dialogue immediately after it, Enter moves into that existing Dialogue without inserting a source blank that would reclassify the following text. Start-of-row Enter inserts an Action before nonempty content; middle Enter splits into two rows of the same type. A selection replaces its selected content as one structural transaction while retaining prefix/suffix text. Empty Character, Dialogue, Parenthetical and Lyrics exit to Action; repeated empty Action keeps a physical blank. An explicit page break creates an Action after it.

Mid-row Character splits have portable cue source. A mid-row Parenthetical split retains both typed rows/text in EditorState but can be structurally incomplete in Fountain; deferred capture refuses that exact draft and `copyEditorDraft` retains both current rows plus the original bytes. The persistence workflow must show the refusal and copy route before it claims a latest source save. A numbered Scene Heading keeps its number on the original row, and an explicit Shot does not automatically propagate to a newly inserted Action.

Backspace/Delete at a boundary remove an empty row or join editable text into one row. Same-type text retains its type; unlike nonempty text becomes Action except compatible speech continuations, which remain Dialogue. A nonempty speaker cue is never silently removed to join speech. Selections that cross a dialogue group or a note boundary refuse with a reason if a safe group-preserving join is unavailable. Explicit conversion retains text and refuses conversion that would detach a speaker; the visible picker/shortcut registry remains M3-06.

Closed, unambiguous standalone Note rows permit a literal mid-row Enter split with both delimiter halves intact. Unclosed, mixed or ambiguous notes remain protected. Delimiter-boundary splits that would create an ambiguous note row refuse. Raw/boneyard rows remain protected. Shift+Enter has a visible refusal until a hard-break source round trip is established; it never inserts an unproven newline. The view's composition event sequence consumes the first Enter after compositionend even if that keydown says `isComposing=false`; a later separate Enter applies the table. Full real IME, paste and formatting interaction remains M3-08.
