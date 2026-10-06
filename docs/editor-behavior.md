# Editor behavior contract

Status: M3-04–08 supply the sole editor, keys, completion, clipboard/import and bounded native IME evidence. M3-12 activates production writing and lifecycle guards; the bounded Linux M3-13 integrated input/IME exit and corrected separate re-review passed. [M3 evidence](test-evidence/M3.md), [ADR 0021](decisions/0021-production-editor-source-captures.md), [ADR 0026](decisions/0026-writing-lifecycle.md). [SPEC S07](../SPEC.md#s07); EDIT-01–EDIT-06, INV-03/11/12/14.

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

Linux production startup enables WebKitGTK client preedit after Wry creates the
WebView ([ADR 0034](decisions/0034-linux-client-preedit.md)). Real candidate
composition must deliver trusted start/end events to the editor and title/find
forms; candidate commits or end-only totals do not prove in-progress guards.
[M4-15-R1](tasks/M4-15-R1.md) supersedes earlier end-only IME claims while keeping
the historical logs. Fcitx/Mozc are test-host prerequisites, not bundled app
dependencies or global application configuration.

M1-02 native WebKit observation: a dead-key Return committed composition, then delivered `keydown:Enter` with `isComposing=false` in the same sequence. The production view guards the composition-to-Enter boundary using the event sequence, not `isComposing` alone. This is an implementation requirement under the existing table; no Enter behavior was amended.

Key priority: IME > open completion menu > explicit element command > smart editor behavior > normal focus navigation outside editor. An active suggestion accepted with Enter consumes that key; a second Enter runs the table. Tab accepts a selected suggestion, otherwise cycles contextual types; Shift+Tab reverses. F6 or equivalent provides an escape from editor Tab handling. The element picker reflects caret type or Mixed and converts explicit selections without dropping text.

Autocomplete is local: speaker cues, heading prefixes, established locations, and times of day. Acceptance is one undo step and never happens by timing alone, in IME, paste, boneyard, or raw content. Implemented undo covers text, structural edits, completion, paste and formatting; M4-05 scene moves now have exact-source/selection Undo; replace-all and applied diagnostic fixes remain M4 obligations. Paste sanitizes external HTML and has a separate import-as-Fountain path. M1 proves native input/selection/composition; M3 implements these rules with table-driven caret/source/undo tests. [ADR 0003](decisions/0003-editor-and-native-ownership.md).

M1-06 demonstrates typed-line text edits, Unicode selection replacement and undo/redo with restored content and selection through the existing native writer. Undo/redo advances persistence versions; F2 captures/hashes outside input handlers and validates exact native receipts. The diagnostic refuses structural/type/protected-region transformations and bounds synchronous grammar filtering to 32 lines/4 KiB. That proof excludes the full Enter/IME/structural and production integration gate; the subsequent bounded M3 exit verifies those paths. See [M1 evidence](test-evidence/M1.md#m1-06--bounded-codeceditornative-composition-proof).

## M3-04 sole state and capture boundary

[Schema](../src/editor/schema.ts), [state](../src/editor/state.ts), [view](../src/editor/view.ts) and [source bridge](../src/editor/sourceBridge.ts) use the production codec, never the proofs. `createEditorState(bytes, recovery?)` retains immutable source origin in the state plugin. Known primary rows display extracted text/styles; source blanks project as Action/spacers, matching incomplete intent outranks inferred type, and title/hidden/raw and imported malformed rows remain protected. Explicit cue/group, scene/outline, Shot and source ownership survive in the codec/origin fields. An empty source has a virtual Action without a source row. Invalid UTF-8 displays read-only and retains exact bytes.

`mountScreenplayEditor` keeps the current state in EditorView; observers receive state/version facts, not a mutable source mirror. DOM rules retain whitespace, marks and origin fields; the transaction guard requires unchanged identity/type/origin and protects raw rows against deletion or typing. Foreign mark types, invalid Unicode/newline text and unapproved structural/type/ID changes refuse atomically. M3-05–08 authorize tested structural commands and clipboard transactions; arbitrary drop remains refused. The guard compares affected nodes without codec parsing, encoding, hashing or full source serialization. There is no proof's 32-row/4-KiB production limit; the bounded M3 native input/capture gates pass, while full compositor/page/long-session performance remains open.

Ordinary typing and direct supported mark transactions use ProseMirror history. Undo/redo restore text/styles/selection and original source spelling on no-op, while `editorVersion` advances for content or explicit selection metadata. Stored marks and view-only settings do not become source changes or history events. M3-05–08 add Enter, joins, type conversion, completion and clipboard commands over this foundation; M4-05 adds exact-source scene/section moves.

Call `captureEditor` only outside synchronous input/dispatch. It derives source through atomic adjacent-row context edits, retaining exact untouched bytes and original no-op syntax. `EditorCaptureBoundary` schedules that work and hashing after dispatch, bounds two active requests, returns frozen compatible persistence snapshots and validates version/session ownership. `isCurrent` is checked again before applying a derived result; no capture method changes the live state. Receipt/status UI must compare directly against the editor's latest version while hashing is pending; production controller/cadence integration is M3-10.

An empty Scene Heading after text captures as a physical blank with
hash-bound recovery-only heading intent. Edits elsewhere keep saving and
journaling while it stays empty. Explicit recovery restores the type;
source-only reopen shows a blank. Completing it removes the empty intent.
This does not relax capture refusals for incompatible/protected source or
persist a zero-byte virtual placeholder's picker choice.

Selection anchors bind editor ID/source index, UTF-16 offset, UTF-8 byte offset and grapheme index/intra-grapheme offset. A surrogate-splitting selection refuses capture rather than guessing bytes. Escapes and emphasis delimiter gaps have an explicit left-boundary mapping. Protected/unknown source is copied verbatim; invalid encoding has no fabricated Unicode selection map. If grammar/styles cannot round-trip, the live draft stays in EditorState and `copyEditorDraft` returns current rows/styles plus exact original bytes. It must not be called a latest Fountain save; the current M3-12-R1 workflow presents the refusal and offers a verified labeled native draft-bundle copy.

[Contract tests](../tests/contract/editor-bridge.test.ts) and [synthetic native harness](../tests/native/editor-bridge/README.md) cover no-op corpus bytes, primary fields/rich edits, IDs/anchors, protected/forged content, virtual/invalid source, undo/version and asynchronous failure/staleness. Native WebKit evidence is a declared typing/selection/capture subset, not real IME, structural commands, native writing, printed layout or production activation.

## M3-05 structural commands and safe source boundaries

[Commands](../src/editor/commands.ts) authorize only their own row-changing transactions; history undo/redo may replay them. Changed rows keep stable IDs, new rows use a monotonically advancing session ID counter, and deleted IDs are not reused after undo. Deferred [source capture](../src/editor/sourceBridge.ts) applies atomic codec edits between unchanged protected rows. A note edit owns its entire closed, unambiguous standalone region. The key handler never parses, serializes, encodes or hashes a complete source in synchronous dispatch. Source/caret/undo expectations and real WebKit interaction are in [M3-05 evidence](test-evidence/M3.md#m3-05--smart-keys-joins-and-structural-undo).

At the end of a nonempty row, Enter follows the table. Starting a new Action paragraph inserts a real blank separator and then its editable Action row; the caret skips the separator, and Undo restores both in one event. Existing intentional blank rows remain intact. Within a speech that has a following row under the same cue, Enter inserts an attached Dialogue continuation instead of ending the group before its remaining text. The Dialogue → Action transition applies to the final speech row. If a Character or Parenthetical already has an attached Dialogue immediately after it, Enter moves into that existing Dialogue without inserting a source blank that would reclassify the following text. Start-of-row Enter inserts an Action before nonempty content, except on a Dialogue or Parenthetical under its cue, where it refuses (Dialogue has no forcing marker, so a row above it would detach the speech). Middle Enter splits into two rows of the same type, except that the tail of a split Scene Heading becomes Action. A selection replaces its selected content as one structural transaction while retaining prefix/suffix text. Empty Character, Dialogue, Parenthetical and Lyrics exit to Action; repeated empty Action keeps a physical blank. An explicit page break creates an Action after it.

Mid-row Character splits have portable cue source. A mid-row Parenthetical split retains both typed rows/text in EditorState but can be structurally incomplete in Fountain; deferred capture refuses that exact draft and `copyEditorDraft` retains both current rows plus the original bytes. The persistence workflow must show the refusal and copy route before it claims a latest source save. A numbered Scene Heading keeps its number on the original row, and an explicit Shot does not automatically propagate to a newly inserted Action.

Unforced source ([AUDIT-C01](tasks/AUDIT-C01.md)): when an edit changes the grammar context of an unchanged, unforced Scene Heading, Character, Transition or Action (typing on or deleting the blank row beside it, or Enter after it), deferred capture owns that neighbour and inserts only its forcing marker (`.`, `@`, `>`, `!`) into the authored spelling; indentation, scene-number bytes and every row the edit does not own stay byte-identical, and reverting the edit restores the unforced bytes. A Backspace/Delete join that would leave text after a closed parenthetical refuses. Still uncapturable, with the alert shown: Enter between the rows of one speech followed by typing (the Enter table belongs to AUDIT-D01), edits that regroup dual dialogue, and edits beside protected rows.

Refusal wording ([AUDIT-PARK-H-F3](tasks/AUDIT-PARK-H-F3.md)): a refused capture
is shown in author words, in the protection alert and after an explicit Save.
When a recovery-only copy exists ([ADR 0044](decisions/0044-recovery-independent-of-capture.md))
it states that saving the file is paused while recovery still protects all of
the text, and which element the first refused row reopens as after a crash.
Otherwise it states that saving and recovery are paused and points to Close
session's emergency copy. Both name the row (`Row N`, element
label and quoted excerpt, or "an empty … row") and say to change that row or
Undo. The row is named only when
the codec identifies the one submitted edit it cannot write; a refusal about a
whole context names none. The named row is the one Fountain cannot hold, which
can be a neighbour the edit stranded (a dual cue beside a typed blank) rather
than the row last typed in. Wording only: the drafts listed in the brief stay
refused, and failures that are not codec refusals keep their own text.

Emptied speech rows ([AUDIT-PARK-H-F4-02](tasks/AUDIT-PARK-H-F4.md)): a
Dialogue or Parenthetical row emptied while nonempty rows of its speech follow
no longer pauses saving. Deferred capture writes it as Fountain's two-space
dialogue line, as Shift+Enter does for an empty break row, so the rows below
stay in the speech. The live row stays empty and keeps its element; both are
recovery-only intent, restored by exact recovery, and the caret in the row
maps to the end of its two spaces. Opened from the file alone, the row is a
Dialogue holding two spaces. Typing into the row writes ordinary text.
Captures that saved before keep their bytes: an emptied last row of a speech
is still a blank line. Where another row of the draft has no spelling, that
row is now the one named instead of the Dialogue below the emptied row. Still
refused: an emptied row above a protected row, and the drafts in the brief's
group F and other pinned refusals.

Emptied last rows ([AUDIT-PARK-H-F4-05](tasks/AUDIT-PARK-H-F4.md), owner
decision 2026-10-04): an unterminated last physical row emptied by the author
gains one ending in the existing local/file convention, falling back to LF
only when the file has no ending. It stays a physical blank with its element
as existing recovery-only intent; saving, journaling and other edits continue.
Exact recovery restores the element and caret; source-only reopen keeps the
blank. Undo restores the original unterminated bytes. An emptied numbered
heading stays refused and named: the scene number is authored text and
cannot live only in recovery. Already successful captures keep their bytes.

Speech that opens with a parenthesis
([AUDIT-PARK-H-F4-03](tasks/AUDIT-PARK-H-F4.md), owner decision 2026-10-04):
such rows no longer pause saving. A Dialogue row `(laughs) Oh no.` saves as
ordinary Dialogue. A Dialogue row that is only a wrapped pair, `(laughs)`,
and a Parenthetical row with text after its closing parenthesis, `(beat) x`,
save exactly as typed; the row keeps its element as recovery-only intent,
restored by exact recovery. Opened from the file alone, the first is a
Parenthetical and the second a Dialogue row, as Fountain reads them. Every
keystroke on the way saves, and typing on drops the intent once Fountain
agrees with the row. A line in an opened file that begins with a closed
parenthetical is an ordinary editable row; it used to be read-only. A line
whose parenthesis never closes is still read-only unless its draft intent is
recovered. Commands keep their rules: a join that would leave text after a
closed parenthetical, a hard break in Dialogue that would start a row with
a parenthesis, and conversion of such text to or from Parenthetical still
refuse, and they now give those reasons for a row that used to answer only
that it was protected. A Parenthetical whose text does not open with `(`
stays refused, and its alert says "A Parenthetical starts with an opening
parenthesis." Script Check no longer flags the unprotected line; export
review still does, because the print profile reads it as a parenthetical.

Typed text Fountain reads as other syntax
([AUDIT-PARK-H-F4-04](tasks/AUDIT-PARK-H-F4.md), owner decision 2026-10-04,
[ADR 0042](decisions/0042-other-syntax-fallback-container.md)): such rows no
longer pause saving where their exact bytes are one editable Action line. A
Scene Heading such as `'TIL DAWN`, a Character such as `BOB ^`, a Transition
such as `CUT<` and a Dialogue starting with `!` save exactly as typed, as an
Action row with the typed element as recovery-only intent; opened from the
file alone the row is Action. A `!` that would end a speech mid-list still
pauses the draft and names the typed row: following rows the author did not
touch are never rewritten. Marker texts that would reopen as a cue, heading,
section or other restructuring element stay refused with the named-row
alert. Every saved row carries one dismissible Script Check advisory naming
it; warnings and export review are unchanged (an orphaned cue still warns,
and the print profile still notes a broken speech paragraph).

Command refusals ([AUDIT-PARK-H-F4-01](tasks/AUDIT-PARK-H-F4.md)): a formatting
or conversion command refuses, with a reason and no change, when it would
leave a row capture cannot write. Emphasis cannot begin a Scene Heading,
whether applied to a selection or set as a stored mark at the row start; it
can begin anywhere after the first character. A Dialogue or Parenthetical row
cannot become a non-speech element while unselected, nonempty rows of the same
speech follow, because Fountain would read those rows as Action; selecting the
rest of the speech converts it together. A row cannot become an element that
cannot hold its text, such as a Scene Heading from text that does not start
with a letter or digit or that ends in `#1#`. Each command asks the codec
about the one changed row read alone, as a three-line synthetic source. It
never parses the manuscript or runs a capture, so the synchronous-dispatch
rule above holds. A row that already has no spelling can still be converted,
since that repairs it.
The Tab cycle stops at such an element with the same reason instead of passing
through it; Shift+Tab and the picker still reach the others.
Typed text is never refused here, so the typed shapes in the brief stay
refused by capture, and the mid-row Parenthetical split above is unchanged.

Backspace/Delete at a boundary remove an empty row or join editable text into one row. Same-type text retains its type; unlike nonempty text becomes Action except compatible speech continuations, which remain Dialogue. A nonempty speaker cue is never silently removed to join speech. Selections that cross a dialogue group or a note boundary refuse with a reason if a safe group-preserving join is unavailable. Explicit conversion retains text and refuses conversion that would detach a speaker; the visible picker/shortcut registry is supplied by M3-06.

Closed, unambiguous standalone Note rows permit a literal mid-row Enter split with both delimiter halves intact. Unclosed, mixed or ambiguous notes remain protected. Delimiter-boundary splits that would create an ambiguous note row refuse. Raw/boneyard rows remain protected. Shift+Enter splits an editable Action or attached Dialogue into same-kind physical rows, retaining marks, row identities and speaker with one Undo/Redo event. Empty Dialogue break rows use Fountain's two-space spelling. A split that would turn speech into a parenthetical, a cross-row selection, unsupported types and protected rows refuse visibly. Deferred capture uses the codec's `replaceLineWithBreaks` for owned same-kind splits; no complete source capture runs on the key. The view's composition event sequence consumes the first Enter after compositionend even if that keydown says `isComposing=false`; a later separate Enter applies the table. Full real IME, paste and formatting interaction remains M3-08.

Boundary Backspace at a new empty Action, or Delete at the preceding row end, removes its separator and placeholder together. Two Action paragraphs can join across a separator in one event with their text and marks retained. Other speech, note and protected-source join refusals remain in force.

## M3-06 picker and shared shortcuts

[Controls](../src/app/EditorControls.tsx) read the current EditorState's caret/type or Mixed selection. All 14 authoring choices, including Shot, Note, Omitted material and Page Break, have direct commands and picker options. Raw/title source is shown as protected when selected; it is never converted speculatively. [Registry](../src/application/shortcuts.ts) drives command labels, help, remapping and keyboard routing; [ADR 0022](decisions/0022-local-shortcut-preferences.md) owns the preference/platform policy. The components run in the [synthetic native diagnostic](../tests/native/editor-shortcuts/README.md); M3-12 connects them to default native writing.

Conversion preserves IDs, text, marks and the full forward/backward selection in one undo transaction. An exclusive selection end at the next row's start excludes that row. Re-selecting the current type is a no-op. Shot is explicit Action metadata, retained in captures/recovery; selecting Action clears it. Native source bytes and untouched syntax remain owned by the existing codec/capture boundary.

The visible **Toggle dual dialogue** command in Commands and shortcut help is keyboard-remappable through the same registry. Select a cue or rows within the right speech to pair/unpair it with the immediately preceding complete speech, separated only by retained blank rows. Validation uses current live IDs and rejects incomplete, nonadjacent, overlapping or protected groups; composition/read-only/frozen guards still apply. Only the right cue's relationship changes; text, marks, logical selection and row IDs survive one Undo/Redo. Deferred capture applies `setDualDialogue` over both complete groups and updates byte anchors for the cue marker. [AUDIT-D01 evidence](test-evidence/AUDIT.md#audit-d01--portable-enter-separators-and-explicit-speechbreak-authoring) is mocked/JSDOM plus browser smoke, not native writing or an independent PDF oracle.

Narrative Tab cycles Action → Character → Scene Heading → Transition; an isolated cue stays in that narrative context. Within attached speech, the cycle is Dialogue → Parenthetical → Character. Shift+Tab reverses. A conversion that would detach a speaker/continuation, or turn wrapped Parenthetical text into unrepresentable Dialogue, refuses visibly without changing the draft. Empty speech may attach only to an adjacent known cue/continuation. Contextual Tab is enabled only when the mounting controller supplies F6's focus escape; the controls explain the cycle and provide direct selection. Outside the editor, Tab retains native focus traversal.

Note/Omitted conversion wraps a complete selection of delimiter-free, unstyled literal rows in explicit Fountain delimiters, retaining every original character and row ID. Existing malformed/protected hidden syntax cannot be reclassified. Deferred capture owns the whole newly authored region through checked concrete codec transactions; edited/split Notes must still be complete and unambiguous. Page Break requires an empty row or existing equals-sign break text; nonempty author text is retained and the conversion refuses. Ambiguous/styled hidden conversions retain current source and explain the refusal. Removing hidden wrappers is still a separate reviewed region operation.

[AUDIT-PARK-H-F1](tasks/AUDIT-PARK-H-F1.md) includes hidden regions whose rows were inserted after opening source, including empty rows, multiple groups and split Notes. A group replaces its contiguous prior source rows when present; otherwise it inserts after the nearest preceding surviving source row, or at the beginning. Structural capture then reconciles intervening new rows. Checked whole-region and neighbor validation remains in force; untouched source bytes, local line endings and the EOF convention remain retained. New Note/Omitted rows no longer suspend capture, saving or journaling. Empty Scene Heading capture and wrapper-removal refusals remain separate.

IME and the composition-to-Enter guard precede an injected completion-key hook; completion precedes explicit registry commands, which precede smart keys. M3-07 supplies the completion popup below. The default Mod+1–8 profile is remappable with local storage, duplicate/reserved-key rejection and fixed storage failure messages. Unimplemented source/workflow/PDF actions are visibly disabled and their bound keys report unavailability in the editor. Commands remain editor-scoped; settings inputs keep their normal text-field shortcuts. No native menu accelerators or global listeners are installed. [M3-06 evidence](test-evidence/M3.md#m3-06--element-picker-and-configurable-shortcut-registry) records actual native focus, logical-key and preference-reload outcomes; full real IME/screenreader/multiplatform tests remain open.

## M3-07 local completion

[Domain vocabulary](../src/domain/completion.ts) derives speakers only from editable Character cues and locations/times only from editable Scene Headings in the current EditorState. Hidden/protected rows never contribute. Parenthesized cue extensions, including multiple or unfinished extensions, remain separate from the name; acceptance retains the suffix unchanged. Exact spellings stay distinct. Case-insensitive exact matches rank before prefixes, then subsequence fuzzy matches; frequency precedes recent use and a stable spelling tie-break. Existing source order seeds recency; subsequent deferred cue/heading edits advance session-local use order. The active row does not suggest itself, while established exact matches remain eligible. There is no online dictionary or separate persistent user-vocabulary editor in this task.

Heading prefix, location and time are independent ranges. Prefixes and common times have a small built-in vocabulary; established locations and qualifiers come from this screenplay. Prefix acceptance adds one separator only if no following segment exists. Location/time acceptance preserves the existing prefix, separator, other segments and scene number. Unconventional forced headings can complete their established location text without introducing an interior/exterior prefix. Completion operates at the segment end with an empty selection, including before a cue extension or heading time separator; mid-segment text is retained without speculative suffix replacement.

[Controller and transactions](../src/editor/completion.ts) defer index/ranking work until after dispatch. A popup offer binds the exact immutable document, session, version, range and caret. A stale result, changed caret, different session or detached old mouse option cannot insert. Acceptance performs only active-row validation and a text-range transaction, preserving unrelated attributes/marks; it never parses/captures/hashes the whole source on a key. History boundaries isolate completion from preceding and immediately following typing. Opening, navigation, dismissal and elapsed time never change content.

[Popup](../src/app/CompletionPopup.ts) anchors to the native writing caret, repositions on scroll/resize and exposes a listbox with selected options and editor active-descendant metadata. Up/Down select; plain Enter or Tab accepts the selected item and consumes only that key; Escape dismisses until a new editor version. A second Enter follows the smart-key table. With no selected/available suggestion Tab follows the contextual type cycle; Shift+Tab retains reverse cycling. Left mouse down prevents focus movement, validates the exact displayed offer and returns focus to writing. Modifier chords keep registry routing, and F6 escapes focus. Composition/dead keys dismiss suggestions; compositionstart suspends them, and the composition-to-Enter guard remains first. M3-08 paste uses the safe clipboard policy and drop remains refused; both dismiss suggestions; paste-tagged transactions cannot reopen the menu in that version. Raw, boneyard, notes, title fields and nonempty selections have no completion.

Mount by creating the popup, passing its controller as `mountScreenplayEditor`'s `completion` observer, then binding the resulting view. Destroy the popup before destroying/replacing the view to remove listeners/ARIA and cancel pending work. The [native diagnostic](../tests/native/editor-completion/README.md) exercises these production components; [M3-07 evidence](test-evidence/M3.md#m3-07--local-character-and-heading-completion) records real keyboard/pointer/source/caret/undo results separately from synthetic DOM composition. Full real IME/paste, screenreader/platform coverage and default production activation remain M3-08/12/13 and later gates.

## M3-08 clipboard, emphasis and explicit Fountain import

[Clipboard policy](../src/editor/clipboard.ts) retains literal target type for external/plain paste, normalizes clipboard CRLF into physical rows and keeps author whitespace. Dialogue does not infer Fountain elements. Internal `application/x-babel-screenplay-v1` carries bounded row kinds, inline bold/italic/underline and relative speech/dual references; complete groups get fresh IDs. Partial mixed structure, incomplete groups, protected/hidden targets, detached relationships, invalid Unicode and size/grammar failures refuse visibly with current source and clipboard intact. Explicit paste validates source before dispatch, outside the ordinary typing path. HTML is inertly parsed, scripts/resources/foreign content removed and remaining text inserted; plain text takes precedence. Copy/cut preserve supported inline structure. Paste/cut are isolated undo actions. Composition suppresses clipboard mutations and completion; drop remains refused.

The shared registry adds Mod+B/I/U. Nonempty selections preserve their anchors, reject protected/literal regions and validate row-local Fountain emphasis before dispatch. Empty selection toggles stored marks for subsequent typing; whitespace typed at the edge of such a span is captured unstyled (`**Fast** `), because Fountain emphasis cannot open or close against whitespace, while an explicit selection toggle with edge whitespace still refuses. A capture-failure alert clears on the next successful capture. Undo groups formatting independently of adjacent typing.

[Fountain import panel](../src/app/FountainImportPanel.ts) stages content and clearly names whole-screenplay replacement. [Application boundary](../src/application/fountainImport.ts) requires an exact pre-import native checkpoint plus curated safety revision and refuses stale editor/view/composition or invalid receipts. The stage remains available after failure/success. Imported bytes and previous source provenance travel through one isolated undo/redo event; source files are not saved by import. [ADR 0023](decisions/0023-protected-fountain-import.md) explains ownership. M3-12 connects staged import to the active production session and retains staged text across autosaves. [M3-08 evidence](test-evidence/M3.md#m3-08--paste-formatting-and-native-input) separates browser/mocks, bounded native input/IME evidence and remaining performance gates.

## M3-12 lifecycle and input guards

The editor transaction observer rejects document and selection changes while the session is frozen, and document changes under read-only native ownership, including command and paste transactions. M4-03 explicitly admits selection-only navigation for ready read-only sessions. F6 focuses an enabled screenplay action outside the editor; protected close focuses Retry. One shortcut registry serves editor, controls and shell. Save As rebuilds state at a fresh identity with the actual numeric caret selection and a new undo history. Validated recovery/restore bytes advance the native version through one isolated undoable source transaction; future Undo keeps versions monotonic. Initial open allocates above discovered recovery versions without choosing content. See [ADR 0026](decisions/0026-writing-lifecycle.md) for coordination and [M3-12 evidence](test-evidence/M3.md#m3-12--production-writing-lifecycle-and-failure-ui) for scope.

[M3-13 review R03](reviews/2026-09-29-m3-13-review.md) records the original capture-refusal integration failure. [M3-12-R1](tasks/M3-12-R1.md) now publishes immediate live-version facts, keeps the refusal visible and offers a native-verified `.draft.json` preservation bundle when Fountain capture is impossible. Old receipts grant newer work no protection. Explicit copy/risk decisions bind the frozen live version; retry retains Fountain's representability checks.

[M3-04-R1](tasks/M3-04-R1.md) and [M3-03-R1](tasks/M3-03-R1.md) remove repeated failed delimiter scans and per-scalar UTF-8 encoding allocations. Capture caches only derived styled-text signatures, with weak immutable-node/line keys; there is no mutable manuscript cache. Corpus, source/caret/Undo tests and integrated default-app timing evidence bound these changes. rAF remains an event-loop proxy, not compositor paint or page calibration.

## M4-03 outline navigation

The mounted writing surface admits exact current captures to a coalesced deferred index controller. Pending/unavailable results retain a visibly stale, inert outline. Edits/Undo/import/restore/session changes invalidate navigation before capture; selection-only frames may reuse a session/document/hash-identical index. [ADR 0029](decisions/0029-versioned-manuscript-index.md) defines hierarchy, attachment and anchor policy.

The outline uses nested semantic lists/buttons, collapse and a coalesced heading/synopsis/authored-number filter. Tab/Enter and pointer activation set a scalar-safe selection, synchronize editor focus and then issue a scroll-only transaction; native checks verify the caret row is actually visible. `outlineNavigation.ts` checks the exact session/version/document/row ID and actual dispatch acceptance; transactions use `addToHistory: false`. Rich text uses decoded offsets; literal hidden/raw/title text maps source boundaries without dropping unknowns. Composition refuses outline navigation. Ready read-only sessions can explicitly allow selection-only navigation; document mutations and frozen-session selection remain refused. Display caps label excerpts/remainders and can filter to every indexed heading.

## M4-05 move transactions

[Editor moves](../src/editor/sceneMoves.ts) bind the exact immutable state/session/version to the source plan and independently verify candidate capture before exposing Apply. A separately authorized origin-rebase transaction preserves row IDs/content/marks, refreshes source-dependent row metadata and allows complete protected regions to move without opening them for editing. One isolated history event restores complete source/selection on Undo/Redo while the live version advances. A selection wholly inside the moved span follows its row IDs and offsets, including backward selections; otherwise the caret follows the moved heading. Ordinary subsequent note editing and earlier Undo provenance remain available.

Both outline drag and keyboard commands create the same explicit preview. Dispatch rechecks the original state, composition and actual acceptance; read-only/frozen views refuse. Large moves use the existing exact-version frozen protection guard and native operation-specific receipt before synchronous dispatch. Cancellation/failure retains review copies and current content; normal Save remains independent. The ordinary changed observer invalidates outline/completion and future diagnostics. No parsing, source encoding or hashing runs in the move's dispatch/typing path. [Evidence](test-evidence/M4.md#m4-05--reversible-scene-and-section-moves).

## M4-06 title-page form

[TitlePagePanel](../src/app/TitlePagePanel.tsx) displays fields from the current captured document, including unknown keys and separate duplicate entries. Edit/Add use a single visibly uncommitted draft bound to its immutable EditorState; Apply executes one checked title transaction and Discard explicitly abandons only that draft. Opening/closing the form is a source-byte no-op. Stale/read-only/composing/busy submissions retain input and report refusal. Empty values are supported; ambiguous or unrepresentable continuation/EOF changes retain source and input.

Draft changes and composition publish their guards synchronously. Dirty title input blocks source Save/Save As/export, document/window close, Home/Open, import and native restore/recovery adoption. Editor document mutations stay disabled while a dirty form is open; selection navigation can make its exact-state submission stale and the draft remains available to copy/discard. Background cadence protects only committed editor content; the draft status explicitly says it is not saved or recovery-protected. This temporary input is not a second committed title store. Application shortcuts ignore title inputs and composition; input-local Undo and IME remain owned by the form. Escape closes only a clean noncomposing panel, and close returns focus to the title-page action. [Native/contract evidence](test-evidence/M4.md#m4-06--source-preserving-title-page-form).

## Logical find (M4-07)

[Matcher](../src/domain/find.ts), [controller](../src/application/find.ts) and [FindPanel](../src/app/FindPanel.tsx) consume the existing exact-version manuscript projection. Search is literal, non-overlapping and confined to one physical logical row/region; it can span rich marks within that row, but never row/element/hidden boundaries. Known rich/title text decodes supported emphasis/escapes; notes/omissions and protected raw fragments retain literal contents inside their retained boundaries. Unknown/unclosed/ambiguous regions and incomplete markup are labeled as uncertain. Default Full script includes title values, notes, omissions and raw author text; explicit independent filters disclose exclusions. Title keys are field labels, not value matches. Current scene uses M4-03 half-open heading/body boundaries, including notes but ending at every scene/section heading; a caret outside a scene refuses that scope.

Case-insensitive search lowercases each Unicode scalar without locale tailoring, normalization or full case folding: composed/decomposed spellings remain distinct; `İ` maps to `i` plus combining dot and cannot match only part of that expansion; `ß` does not match `ss`. Whole-word boundaries use Unicode Letter/Mark/Number/Connector_Punctuation; apostrophes/hyphens/emoji are separators and adjacent CJK letters belong to one word. Match endpoints cannot split a scalar or folded expansion.

One cancellable timer scans bounded 16,384-unit slices (including long rows), yielding after 8 ms or 256 slices. There is no query debounce; superseded query/projection work cancels before publication. Queries cap at 1,024 UTF-16 units; more than 10,000 matches produce an explicit refine-query refusal with no navigable partial result. Counts are exact only for completed current results. The list shows the first 100 and Next/Previous reaches the full bounded set; highlights show the first 500 plus the active match. Uncapturable/stale results stay disabled.

Registry Find/Next/Previous, panel Enter/Shift+Enter and result buttons share current-version navigation. Exact decoded/source offsets map into the retained editor row; selection/focus/scroll reveal title/hidden/protected text with a labeled result context. Composition/frozen/staged-title states refuse navigation. View-only decorations never change EditorState identity, source, marks, Undo or versions; every view update rejects stale highlight stamps. Find selection advances the existing selection version, but rebinds only advisory capture/projection and does not schedule native writes. `EditorCaptureBoundary.rebindSelection` requires a snapshot branded to that boundary, identical immutable document and session; it reuses the exact source/hash/document/ranges, updates frozen selection metadata with size checks, and retains one source root across repeated rebinding. Find selection bypasses the stale-outline repaint; old outline anchors still check exact versions until the scheduled rebind lands. Navigation scrolls once after the result/reveal panel commits and only if its session/version/document/selection/focus remain current. Subsequent explicit Save/close or authored edits keep the established protection policy. Closing find focuses the current editor selection and never restores an earlier caret. [Evidence](test-evidence/M4.md#m4-07--logical-text-find-and-hidden-navigation) owns bounded Linux verification.

## Transactional replace (M4-08)

[Planner/transactions](../src/editor/replace.ts) consume current find matches and the exact manuscript projection. Replacement is plain text within one row: at most 1,024 UTF-16 units, no line breaks, no unpaired surrogates and no hidden-region delimiters (`[[`, `]]`, `/*`, `*/`); violations refuse the whole plan with an explicit reason. Each match maps through the same scalar-safe logical-to-editor offsets as navigation. Title, protected note/omitted/raw rows and unmappable or foreign/stale rows become classified refusals with retained-content reasons, never silent partial rewrites. Safe single-line notes stay editable with delimiters preserved by the existing note-region capture. Plans brand the exact session/version/document plus the query/options snapshot; apply rechecks row identity, protection, expected text and projection rows before dispatch, so a changed document, Undo/import/restore or a changed query/scope cannot authorize an older preview.

Replace-one commits one planned range and collapses the caret at the replacement end; the writing view then advances to the match that slid into the replaced match's slot once refreshed results are current, keeping editor focus, and rests at the replacement when nothing follows. Replace-all commits every planned edit in one reverse-document-order transaction: one history event, so one Undo restores the complete source and previous selection, with the caret at the first replacement. Both trial-apply and run deferred capture before dispatch; a capture refusal keeps the live editor unchanged, so planning can never publish an older source past a representability failure. Replacement retains the uniform marks of the exact matched range, including matches at a mark boundary. Matches spanning different emphasis become explicit preview refusals so no mark assignment is guessed. Marks outside replaced ranges and dual/speech relationships survive because row attributes are untouched; untouched source bytes round-trip through the existing capture. Replace-all at or above 100 editable matches needs explicit panel confirmation. Planning is pure and bounded over the already-bounded match set; capture/serialization stay off key handlers. Registry Replace stays disabled for the M4-14 palette; the panel buttons and Replace-input Enter/Shift+Enter are the M4-08 surface. Read-only, frozen, busy, composing and staged-title states refuse with the text/selection retained. [Evidence](test-evidence/M4.md#m4-08--transactional-replace-one-and-replace-all) owns bounded Linux verification.

## Script Check diagnostics (M4-09)

[Controller](../src/application/scriptCheck.ts) evaluates the current manuscript projection on demand and brands results with its session/version. [Panel](../src/app/ScriptCheckPanel.tsx) groups issues by stable code with exact counts, severity filters and advisory dismissal, plus an always-visible export-assessment-unavailable section; [decorations/navigation](../src/editor/scriptCheck.ts) highlight affected blocks view-only and reveal hidden/title targets through selection without editing them. Running, filtering, dismissing or navigating leaves source, files, cursor ownership and Undo clean, never blocks Save/recovery and performs no network request. Selection-only drift (including Go to Issue itself) rebases results on the identical document; content/session changes mark them stale with navigation refused until Refresh. Read-only, frozen, busy, composing and staged-title states refuse navigation with text retained. The find and check panels are mutually exclusive. AUDIT-C356 gives Find and Script Check separate stamped plugin decoration sets: clearing or republishing either cannot erase the other. Closed check reports never repaint on projection updates, and Next/Previous/caret rebinding retains current Find highlights. Highlight redraws issue no transaction and preserve EditorState identity. Registry Script Check stays disabled for the M4-14 palette; the toolbar button is the M4-09 surface. [Evidence](test-evidence/M4.md#m4-09--non-destructive-script-check-and-issue-navigation) owns bounded Linux verification.

## Presentation without an editor transaction (M4-10)

[UI preferences](../src/application/viewPreferences.ts) control app theme and the writing host's font size plus focus/typewriter CSS classes. They do not recreate the sole EditorView/EditorState, serialize a manuscript or alter source version, selection, marks, Undo, export fonts or layout. The sticky header measures its own height for document scroll padding; explicit selection scrolling respects its lower edge. Completion positioning observes editor resize as well as viewport scroll/resize, so zoom remains a view concern. Unchanged outlines reuse their rendered tree during presentation changes; callbacks refresh with projection/busy changes so navigation guards remain current. A completion-consumed Escape dismisses that offer before a subsequent Escape can exit focus.

[Typewriter follow](../src/editor/presentation.ts) observes input intent and accepted transaction facts without dispatching a transaction. It coalesces one post-paint caret-coordinate read and instant viewport scroll; no document scan runs on this path. A current doc/selection/focus check prevents a queued follow after navigation. Manual gestures cancel queued work; new typing/arrows can resume it. Composition, modified/dead/process/page/home/end keys, ranges, programmatic navigation/import/undo, dialogs and inactive editor focus suppress follow. Listeners/queued frames are removed on editor replacement or session disposal. [M4-10 evidence](test-evidence/M4.md#m4-10--presentation-modes) distinguishes JSDOM no-op contracts from real WebKit input and timing observations.

## Explicit spelling corrections (M4-12)

[Spellcheck](../src/application/spellcheck.ts) scans immutable current editor
rows only after explicit Check spelling, outside the typing transaction path.
Names come from editable Character cues with extensions stripped; title, notes,
boneyards, raw and protected rows do not contribute spelling issues. Results and
[view-only highlights](../src/editor/spellcheck.ts) bind session/document/version;
any selection/content change clears them. The existing editor remains the only
content authority. Native WebKit spellcheck is disabled to route all corrections
through the application guards.

Review never moves the caret. An explicit suggestion replaces only its exact
current word, keeps uniform emphasis, places the caret after the correction and
isolates one Undo event. Trial apply plus capture rejects unrepresentable edits
before dispatch. Mixed emphasis is refused with a direct-edit explanation;
composition/read-only/frozen/title-staging guards still apply. Ignore, Add,
language/Off preferences and highlights never change source, versions, selection
or Undo. [ADR 0033](decisions/0033-production-spellcheck-boundary.md) and
[M4 evidence](test-evidence/M4.md#m4-12--production-offline-spellcheck) detail bounds
and native scope.
