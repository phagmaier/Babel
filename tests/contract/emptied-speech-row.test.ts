import { describe, expect, it } from 'vitest';
import { closeHistory, redo, undo } from 'prosemirror-history';
import { TextSelection, type EditorState } from 'prosemirror-state';
import { EditorCaptureBoundary } from '../../src/application/editorCapture';
import {
  editorRecovery,
  metadataSelection,
  verifiedEditorMetadata,
} from '../../src/application/editorMetadata';
import {
  FountainEditError,
  parseFountain,
  replaceLine,
  replaceLines,
  serializeFountain,
} from '../../src/domain/fountainCodec';
import type { FountainRecovery } from '../../src/domain/fountainModel';
import { smartKeyTransaction } from '../../src/editor/commands';
import { captureEditor, refusedRow } from '../../src/editor/sourceBridge';
import {
  applyEditorTransaction,
  createEditorState,
} from '../../src/editor/state';

// AUDIT-PARK-H-F4-02: a Dialogue or Parenthetical row emptied while rows of
// its speech follow is written as Fountain's two-space dialogue line, the
// spelling the break command already uses. The row's element and its
// emptiness are recovery-only intent. Captures that saved before keep their
// bytes.
const bytes = (text: string) => new TextEncoder().encode(text);
const text = (source: Uint8Array) =>
  new TextDecoder('utf-8', { ignoreBOM: true }).decode(source);
const open = (source: string) => createEditorState(bytes(source));
const saved = (state: EditorState) => text(captureEditor(state).source);
const rows = (state: EditorState) =>
  state.doc.content.content.map(
    (node) => `${node.type.name}:${node.textContent}`,
  );
function at(state: EditorState, row: number, offset: number) {
  let position = 1;
  for (let index = 0; index < row; index++)
    position += state.doc.child(index).nodeSize;
  return (
    position +
    (offset < 0 ? state.doc.child(row).content.size + offset + 1 : offset)
  );
}
/** Caret in `row`; a negative offset counts back from the row's end. */
function caret(state: EditorState, row: number, offset: number, to?: number) {
  return state.apply(
    state.tr.setSelection(
      TextSelection.create(
        state.doc,
        at(state, row, offset),
        to === undefined ? undefined : at(state, row, to),
      ),
    ),
  );
}
function typed(state: EditorState, value: string) {
  const applied = applyEditorTransaction(state, state.tr.insertText(value));
  expect(applied.accepted).toBe(true);
  return applied.state;
}
function emptied(state: EditorState, row: number) {
  const selected = caret(state, row, 0, -1);
  const applied = applyEditorTransaction(
    selected,
    selected.tr.deleteSelection(),
  );
  expect(applied.accepted).toBe(true);
  return applied.state;
}
function step(state: EditorState, command: typeof undo) {
  let next = state;
  expect(
    command(state, (tr) => {
      const applied = applyEditorTransaction(state, tr);
      expect(applied.accepted).toBe(true);
      next = applied.state;
    }),
  ).toBe(true);
  return next;
}
function refusal(run: () => unknown): FountainEditError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(FountainEditError);
    return error as FountainEditError;
  }
  throw new Error('Expected a refusal');
}
/** Reopen from the captured bytes and the sparse hash-bound draft metadata. */
async function recovered(state: EditorState) {
  const snapshot = (await new EditorCaptureBoundary(() => state).capture())
    .snapshot;
  const source = Uint8Array.from(snapshot.source);
  const metadata = await verifiedEditorMetadata(
    snapshot.source,
    snapshot.draftMetadata,
  );
  expect(metadata).toBeDefined();
  const restored = createEditorState(source, editorRecovery(source, metadata));
  return { snapshot, source, metadata, restored };
}

describe('AUDIT-PARK-H-F4-02 the codec spells an emptied speech row inside its speech', () => {
  it.each([
    ['dialogue', '@BOB\nOne.\nTwo.\n', '@BOB\n  \nTwo.\n'],
    ['parenthetical', '@BOB\n(beat)\nHi.\n', '@BOB\n  \nHi.\n'],
    [
      'dialogue',
      '\ufeff@BOB\r\nOne.\r\nTwo.\r\n',
      '\ufeff@BOB\r\n  \r\nTwo.\r\n',
    ],
    ['dialogue', 'BOB\nOne.\nTwo.', 'BOB\n  \nTwo.'],
    ['dialogue', '@BOB\n   One.\n   Two.\n', '@BOB\n  \n   Two.\n'],
  ] as const)(
    'an emptied %s that owns the speech below it: %j',
    (kind, original, expected) => {
      const before = parseFountain(bytes(original));
      const below = before.lines[2]!;
      const after = replaceLines(before, 1, 2, [
        { kind, text: '' },
        { kind: 'dialogue', text: below.text },
      ]);
      expect(text(serializeFountain(after))).toBe(expected);
      expect(after.lines[1]).toMatchObject({
        id: before.lines[1]!.id,
        kind: 'dialogue',
        sourceText: '  ',
        text: '',
        intendedKind: kind,
        speechOf: before.lines[0]!.id,
        editable: true,
      });
      expect(after.lines[1]!.blankRole).toBeUndefined();
      expect(after.lines[0]).toEqual(before.lines[0]);
      expect(after.lines[2]).toMatchObject({
        id: below.id,
        kind: 'dialogue',
        text: below.text,
        sourceText: below.sourceText,
        speechOf: before.lines[0]!.id,
      });
      expect(after.diagnostics).toContainEqual({
        code: 'draft-intent',
        line: 1,
        message:
          'Incomplete block intent is recovery-only; external Fountain interpretation may differ',
      });
    },
  );

  it('spells every emptied row that has nonempty speech below it, and leaves a trailing one blank', () => {
    const before = parseFountain(bytes('@BOB\nOne.\nTwo.\nThree.\nFour.\n'));
    const after = replaceLines(before, 1, 4, [
      { kind: 'dialogue', text: '' },
      { kind: 'parenthetical', text: '' },
      { kind: 'dialogue', text: 'Three.' },
      { kind: 'dialogue', text: '' },
    ]);
    expect(text(after.bytes)).toBe('@BOB\n  \n  \nThree.\n\n');
    expect(
      after.lines.map((line) => [line.kind, line.intendedKind, line.text]),
    ).toEqual([
      ['character', undefined, 'BOB'],
      ['dialogue', 'dialogue', ''],
      ['dialogue', 'parenthetical', ''],
      ['dialogue', undefined, 'Three.'],
      ['blank', 'dialogue', ''],
    ]);
  });

  it('a single owned row still reports the speech below it instead of respelling alone', () => {
    // The draft must own the speech it would reinterpret; the bridge widens.
    const before = parseFountain(bytes('@BOB\nOne.\nTwo.\n'));
    const drift = refusal(() =>
      replaceLine(before, 1, { kind: 'dialogue', text: '' }),
    );
    expect([drift.code, drift.line, drift.edit]).toEqual([
      'neighbor-drift',
      2,
      undefined,
    ]);
    expect(text(before.bytes)).toBe('@BOB\nOne.\nTwo.\n');
  });

  it('keeps the blank spelling wherever it captured before', () => {
    const speech = parseFountain(bytes('@BOB\nOne.\nTwo.\n'));
    // The last row of a speech, and a speech emptied whole.
    const last = replaceLine(speech, 2, { kind: 'dialogue', text: '' });
    expect(text(last.bytes)).toBe('@BOB\nOne.\n\n');
    expect(last.lines[2]).toMatchObject({
      kind: 'blank',
      intendedKind: 'dialogue',
      blankRole: 'draft',
    });
    const whole = replaceLines(speech, 1, 2, [
      { kind: 'dialogue', text: '' },
      { kind: 'parenthetical', text: '' },
    ]);
    expect(text(whole.bytes)).toBe('@BOB\n\n\n');
    expect(whole.lines.map((line) => line.intendedKind)).toEqual([
      undefined,
      'dialogue',
      'parenthetical',
    ]);
    // The row below leaves the speech with it.
    const left = replaceLines(speech, 1, 2, [
      { kind: 'dialogue', text: '' },
      { kind: 'action', text: 'Two.' },
    ]);
    expect(text(left.bytes)).toBe('@BOB\n\n!Two.\n');
    // An incomplete parenthetical draft below is not stranded by a blank.
    const draft = replaceLines(
      parseFountain(bytes('@BOB\nOne.\n(beat)\n')),
      1,
      2,
      [
        { kind: 'dialogue', text: '' },
        { kind: 'parenthetical', text: '(beat' },
      ],
    );
    expect(text(draft.bytes)).toBe('@BOB\n\n(beat\n');
  });

  it('reads the saved bytes alone as the two-space Dialogue line Fountain already defines', () => {
    const before = parseFountain(bytes('@BOB\n(beat)\nHi.\n'));
    const after = replaceLines(before, 1, 2, [
      { kind: 'parenthetical', text: '' },
      { kind: 'dialogue', text: 'Hi.' },
    ]);
    const plain = parseFountain(after.bytes);
    expect(plain.lines[1]).toMatchObject({
      kind: 'dialogue',
      text: '  ',
      sourceText: '  ',
      speechOf: plain.lines[0]!.id,
    });
    expect(plain.lines[1]!.intendedKind).toBeUndefined();
    expect(plain.lines[2]).toMatchObject({ kind: 'dialogue', text: 'Hi.' });
    expect(plain.diagnostics).toEqual([]);
    expect(open(text(after.bytes)).doc.child(1).textContent).toBe('  ');
  });

  it('exact recovery restores the element and the empty row; other intent on that line is a mismatch', () => {
    const before = parseFountain(bytes('@BOB\n(beat)\nHi.\n'));
    const after = replaceLines(before, 1, 2, [
      { kind: 'parenthetical', text: '' },
      { kind: 'dialogue', text: 'Hi.' },
    ]);
    const recovery = JSON.parse(
      JSON.stringify(after.recovery),
    ) as FountainRecovery;
    const reopened = parseFountain(after.bytes, recovery);
    expect(reopened.lines).toEqual(after.lines);
    expect(reopened.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'draft-intent',
    ]);
    const restored = createEditorState(after.bytes, recovery);
    expect(rows(restored)).toEqual([
      'character:BOB',
      'parenthetical:',
      'dialogue:Hi.',
    ]);
    expect(restored.doc.child(1).attrs.speechOf).toBe(before.lines[0]!.id);
    for (const intendedKind of ['sceneHeading', 'character'] as const) {
      const wrong = parseFountain(after.bytes, {
        ...recovery,
        lines: recovery.lines.map((line, index) =>
          index === 1 ? { ...line, intendedKind } : line,
        ),
      });
      expect(wrong.lines.map((line) => line.intendedKind)).toEqual([
        undefined,
        undefined,
        undefined,
      ]);
      expect(wrong.lines[1]!.text).toBe('  ');
      expect(wrong.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
        'recovery-mismatch',
      ]);
    }
    // Two spaces outside a speech are a blank line; no speech intent fits it.
    const outside = bytes('!Alpha.\n\n  \n!Omega.\n');
    const plain = parseFountain(outside);
    const stray = parseFountain(outside, {
      ...plain.recovery,
      lines: plain.recovery.lines.map((line, index) =>
        index === 2 ? { ...line, intendedKind: 'dialogue' as const } : line,
      ),
    });
    expect(stray.lines[2]).toMatchObject({ kind: 'blank', text: '  ' });
    expect(stray.lines[2]!.intendedKind).toBeUndefined();
    expect(stray.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'recovery-mismatch',
    ]);
  });

  it('text typed into the row replaces the two spaces and drops the intent', () => {
    const emptiedSpeech = (kind: 'dialogue' | 'parenthetical') =>
      replaceLines(parseFountain(bytes('@BOB\nOne.\nTwo.\n')), 1, 2, [
        { kind, text: '' },
        { kind: 'dialogue', text: 'Two.' },
      ]);
    const spoken = replaceLine(emptiedSpeech('dialogue'), 1, {
      kind: 'dialogue',
      text: 'Hi',
    });
    expect(text(spoken.bytes)).toBe('@BOB\nHi\nTwo.\n');
    expect(spoken.lines[1]!.intendedKind).toBeUndefined();
    const opening = replaceLine(emptiedSpeech('parenthetical'), 1, {
      kind: 'parenthetical',
      text: '(',
    });
    expect(text(opening.bytes)).toBe('@BOB\n(\nTwo.\n');
    expect(opening.lines[1]).toMatchObject({
      kind: 'dialogue',
      text: '(',
      intendedKind: 'parenthetical',
    });
    const closed = replaceLine(opening, 1, {
      kind: 'parenthetical',
      text: '(beat)',
    });
    expect(text(closed.bytes)).toBe('@BOB\n(beat)\nTwo.\n');
    expect(closed.lines[1]).toMatchObject({ kind: 'parenthetical' });
    expect(closed.lines[1]!.intendedKind).toBeUndefined();
  });

  it('an unchanged emptied row keeps its two spaces when a wider edit owns it', () => {
    for (const kind of ['dialogue', 'parenthetical'] as const) {
      const draft = replaceLines(
        parseFountain(bytes('@BOB\nOne.\nTwo.\n')),
        1,
        2,
        [
          { kind, text: '' },
          { kind: 'dialogue', text: 'Two.' },
        ],
      );
      // The row below is removed with the emptied row owned: nothing follows
      // it now, and its authored spelling still stands.
      const shorter = replaceLines(draft, 1, 2, [{ kind, text: '' }]);
      expect(text(shorter.bytes)).toBe('@BOB\n  \n');
      expect(shorter.lines[1]).toMatchObject({
        kind: 'dialogue',
        text: '',
        intendedKind: kind,
      });
      // The cue is renamed with the whole speech owned.
      const renamed = replaceLines(draft, 0, 3, [
        { kind: 'character', text: 'AMY' },
        { kind, text: '' },
        { kind: 'dialogue', text: 'Two.' },
      ]);
      expect(text(renamed.bytes)).toBe('@AMY\n  \nTwo.\n');
      expect(renamed.lines[1]!.intendedKind).toBe(kind);
      // No change at all is the same document.
      expect(
        replaceLines(draft, 1, 2, [
          { kind, text: '' },
          { kind: 'dialogue', text: 'Two.' },
        ]),
      ).toBe(draft);
    }
  });

  it('a two-space row the break command writes stays text with no intent', () => {
    const before = parseFountain(bytes('@BOB\nOne.\nTwo.\n'));
    const after = replaceLine(before, 1, { kind: 'dialogue', text: '  ' });
    expect(text(after.bytes)).toBe('@BOB\n  \nTwo.\n');
    expect(after.lines[1]).toMatchObject({ kind: 'dialogue', text: '  ' });
    expect(after.lines[1]!.intendedKind).toBeUndefined();
    expect(after.diagnostics).toEqual([]);
  });
});

describe('AUDIT-PARK-H-F4-02 the editor saves a draft with an emptied speech row', () => {
  it.each([
    ['@BOB\nOne.\nTwo.\n', [1], '@BOB\n  \nTwo.\n'],
    ['@BOB\n(beat)\nHi.\n', [1], '@BOB\n  \nHi.\n'],
    ['@BOB\nHi.\n(beat)\nBye.\n', [1], '@BOB\n  \n(beat)\nBye.\n'],
    ['@BOB\nHi.\n(beat)\nBye.\n', [2], '@BOB\nHi.\n  \nBye.\n'],
    ['@BOB\nOne.\nTwo.\nThree.\n', [2], '@BOB\nOne.\n  \nThree.\n'],
    ['@BOB\nOne.\nTwo.\nThree.\n', [1, 2], '@BOB\n  \n  \nThree.\n'],
    ['@BOB\nOne.\nTwo.\nThree.\n', [1, 3], '@BOB\n  \nTwo.\n\n'],
    ['\ufeff@BOB\r\nOne.\r\nTwo.\r\n', [1], '\ufeff@BOB\r\n  \r\nTwo.\r\n'],
    ['@BOB\nOne.\nTwo.', [1], '@BOB\n  \nTwo.'],
    ['BOB\nOne.\nTwo.\n', [1], 'BOB\n  \nTwo.\n'],
    ['@BOB\nOne.\n  \nThree.\n', [1], '@BOB\n  \n  \nThree.\n'],
    ['@BOB\nOne.\nTwo.\n\n!Act.\n', [1], '@BOB\n  \nTwo.\n\n!Act.\n'],
  ] as const)(
    '%j with rows %j emptied saves %j',
    (original, empties, expected) => {
      let state = open(original);
      const live = rows(state);
      for (const row of empties) state = emptied(state, row);
      const capture = captureEditor(state);
      expect(text(capture.source)).toBe(expected);
      // The live rows stay as the author left them; only their spelling is new.
      expect(rows(state)).toEqual(
        live.map((row, index) =>
          (empties as readonly number[]).includes(index)
            ? row.slice(0, row.indexOf(':') + 1)
            : row,
        ),
      );
      expect(
        capture.document.lines.map(
          (line) =>
            line.intendedKind ?? (line.kind === 'blank' ? 'action' : line.kind),
        ),
      ).toEqual(state.doc.content.content.map((node) => node.type.name));
      expect(capture.document.lines.map((line) => line.id)).toEqual(
        state.doc.content.content.map((node) => node.attrs.id),
      );
    },
  );

  it('text typed elsewhere while the row stays empty is captured with it', () => {
    let state = emptied(open('@BOB\nOne.\nTwo.\n\n!Alpha.\n'), 1);
    state = typed(caret(state, 4, -1), ' Beta.');
    state = typed(caret(state, 2, -1), ' Three.');
    expect(saved(state)).toBe('@BOB\n  \nTwo. Three.\n\n!Alpha. Beta.\n');
  });

  it('sparse hash-bound metadata recovers the element and the empty row', async () => {
    for (const [original, kind] of [
      ['@BOB\nOne.\nTwo.\n', 'dialogue'],
      ['@BOB\n(beat)\nHi.\n', 'parenthetical'],
    ] as const) {
      const state = emptied(open(original), 1);
      const { snapshot, source, restored } = await recovered(state);
      expect(snapshot.draftMetadata).toMatchObject({
        schema: 'babel-editor-capture-v1',
        drafts: [{ index: 1, intendedKind: kind }],
      });
      expect(rows(restored)).toEqual(rows(state));
      expect(restored.doc.child(1).type.name).toBe(kind);
      expect(restored.doc.child(1).attrs).toMatchObject({
        id: state.doc.child(1).attrs.id,
        speechOf: state.doc.child(0).attrs.id,
        protected: false,
      });
      // The restored draft captures the same bytes and intent again.
      const again = captureEditor(restored);
      expect([...again.source]).toEqual([...source]);
      expect(again.document.lines[1]!.intendedKind).toBe(kind);
      // Without the metadata the same bytes open as an ordinary Dialogue row.
      expect(rows(createEditorState(source))[1]).toBe('dialogue:  ');
      // Metadata for other bytes is not adopted.
      expect(
        await verifiedEditorMetadata(
          [...bytes(original)],
          snapshot.draftMetadata,
        ),
      ).toBeUndefined();
    }
  });

  it('typing into the recovered row writes ordinary speech', async () => {
    const { restored } = await recovered(
      emptied(open('@BOB\nOne.\nTwo.\n'), 1),
    );
    const spoken = typed(caret(restored, 1, 0), 'Hi.');
    expect(rows(spoken)[1]).toBe('dialogue:Hi.');
    expect(saved(spoken)).toBe('@BOB\nHi.\nTwo.\n');
    expect(
      captureEditor(spoken).document.lines[1]!.intendedKind,
    ).toBeUndefined();
    const aside = await recovered(emptied(open('@BOB\n(beat)\nHi.\n'), 1));
    const opening = typed(caret(aside.restored, 1, 0), '(');
    expect(saved(opening)).toBe('@BOB\n(\nHi.\n');
    expect(saved(typed(opening, 'beat)'))).toBe('@BOB\n(beat)\nHi.\n');
  });

  it('the caret in the emptied row maps into its two-space line and back', async () => {
    const original = '\ufeff@BOB\r\nOne.\r\nTwo.\r\n';
    const state = caret(emptied(open(original), 1), 1, 0);
    const capture = captureEditor(state);
    const line = capture.document.lines[1]!;
    // BOM 3, `@BOB\r\n` 6: the row's two spaces occupy bytes 9 and 10.
    expect([line.sourceStart, line.contentEnd, line.sourceEnd]).toEqual([
      9, 11, 13,
    ]);
    expect(capture.ranges[1]).toEqual({ id: line.id, from: 9, to: 13 });
    const anchor = {
      id: line.id,
      sourceIndex: 1,
      utf16Offset: 0,
      byteOffset: 11,
      graphemeIndex: 0,
      graphemeUtf16Offset: 0,
    };
    expect(capture.selection).toEqual({ anchor, head: anchor });
    // A caret in the row below is unmoved by the row above being respelled.
    const below = captureEditor(caret(state, 2, 2)).selection!.head;
    expect([below.sourceIndex, below.utf16Offset, below.byteOffset]).toEqual([
      2, 2, 15,
    ]);
    const { restored, metadata } = await recovered(state);
    const selection = metadataSelection(restored, metadata);
    expect(selection).not.toBeNull();
    expect([selection!.anchor, selection!.head]).toEqual([
      at(restored, 1, 0),
      at(restored, 1, 0),
    ]);
    expect(selection!.$head.parent.type.name).toBe('dialogue');
    expect(selection!.$head.parent.textContent).toBe('');
    // The same anchor on the bytes alone stays inside that row's two spaces.
    const plain = metadataSelection(
      createEditorState(Uint8Array.from(capture.source)),
      metadata,
    );
    expect(plain!.$head.parent.textContent).toBe('  ');
    expect(plain!.$head.parentOffset).toBe(0);
  });

  it('Undo and Redo capture the original bytes and the two-space line at every step', () => {
    const original = '@BOB\nOne.\nTwo.\n';
    let state = open(original);
    state = state.apply(closeHistory(state.tr));
    state = emptied(state, 1);
    expect(saved(state)).toBe('@BOB\n  \nTwo.\n');
    state = step(state, undo);
    expect(rows(state)).toEqual([
      'character:BOB',
      'dialogue:One.',
      'dialogue:Two.',
    ]);
    expect(saved(state)).toBe(original);
    expect(
      captureEditor(state).document.lines.some((line) => line.intendedKind),
    ).toBe(false);
    state = step(state, redo);
    expect(rows(state)).toEqual([
      'character:BOB',
      'dialogue:',
      'dialogue:Two.',
    ]);
    expect(saved(state)).toBe('@BOB\n  \nTwo.\n');
    expect(captureEditor(state).document.lines[1]!.intendedKind).toBe(
      'dialogue',
    );
  });

  it('a row the break command split off and the author then cleared is written by that command as before', () => {
    // The break primitive owns this split; its two spaces carry no intent.
    let state = caret(open('@BOB\nOne.\n'), 1, 0);
    const broken = smartKeyTransaction(state, 'ShiftEnter');
    expect(broken.transaction, broken.reason).toBeDefined();
    state = applyEditorTransaction(state, broken.transaction!).state;
    expect(rows(state)).toEqual([
      'character:BOB',
      'dialogue:  ',
      'dialogue:One.',
    ]);
    for (const draft of [state, emptied(state, 1)]) {
      const capture = captureEditor(draft);
      expect(text(capture.source)).toBe('@BOB\n  \nOne.\n');
      expect(capture.document.lines[1]).toMatchObject({
        kind: 'dialogue',
        text: '  ',
      });
      expect(capture.document.lines[1]!.intendedKind).toBeUndefined();
    }
  });

  it('the recovered row keeps its two spaces when the rows below it go', async () => {
    const { restored } = await recovered(
      emptied(open('@BOB\nOne.\nTwo.\n\n!Act.\n'), 1),
    );
    // The row below is emptied: a trailing blank, as it captured before.
    let state = emptied(restored, 2);
    expect(saved(state)).toBe('@BOB\n  \n\n\n!Act.\n');
    // Backspace then joins that empty row away.
    const joined = smartKeyTransaction(caret(state, 2, 0), 'Backspace');
    expect(joined.transaction, joined.reason).toBeDefined();
    state = applyEditorTransaction(state, joined.transaction!).state;
    expect(rows(state)).toEqual([
      'character:BOB',
      'dialogue:',
      'action:',
      'action:Act.',
    ]);
    const capture = captureEditor(state);
    expect(text(capture.source)).toBe('@BOB\n  \n\n!Act.\n');
    expect(capture.document.lines[1]).toMatchObject({
      kind: 'dialogue',
      text: '',
      intendedKind: 'dialogue',
    });
  });

  it('joining the row below into the recovered empty row writes ordinary speech', async () => {
    const { restored } = await recovered(
      emptied(open('@BOB\nOne.\nTwo.\n\n!Act.\n'), 1),
    );
    const joined = smartKeyTransaction(caret(restored, 2, 0), 'Backspace');
    expect(joined.transaction, joined.reason).toBeDefined();
    const state = applyEditorTransaction(restored, joined.transaction!).state;
    expect(rows(state).slice(0, 2)).toEqual(['character:BOB', 'dialogue:Two.']);
    expect(saved(state)).toBe('@BOB\nTwo.\n\n!Act.\n');
  });
});

describe('AUDIT-PARK-H-F4-02 shapes left refused', () => {
  it('a protected row below, an emptied numbered heading and an emptied last line are unchanged', () => {
    // F4-03 shape: the parser protects an imported unclosed parenthesis, so
    // the emptied row cannot own it.
    const guarded = emptied(open('@BOB\nOne.\n(beat\n'), 1);
    const drift = refusal(() => captureEditor(guarded));
    expect([drift.code, drift.line, refusedRow(drift)]).toEqual([
      'neighbor-drift',
      2,
      undefined,
    ]);
    // F4-05 shapes.
    const numbered = emptied(open('!Alpha.\n\n.HALL #12#\n'), 2);
    expect(refusedRow(refusal(() => captureEditor(numbered)))).toEqual({
      index: 2,
      kind: 'sceneHeading',
      text: '',
    });
    const last = refusal(() =>
      captureEditor(emptied(open('@BOB\nOne.\nTwo.'), 2)),
    );
    expect(last.message).toBe(
      'Edit cannot retain every intended source line (empty EOF needs a line ending)',
    );
    expect(refusedRow(last)).toBeUndefined();
  });

  it('another refused row in the same draft is the one named', () => {
    // The emptied row no longer strands the speech, so `Two.` is not named.
    // Speech text after a closing parenthesis (F4-03 shape) stays refused.
    let state = emptied(open('@BOB\nOne.\nTwo.\nThree.\n'), 1);
    state = typed(caret(state, 3, 0, -1), '(laughs) Oh no.');
    expect(rows(state)).toEqual([
      'character:BOB',
      'dialogue:',
      'dialogue:Two.',
      'dialogue:(laughs) Oh no.',
    ]);
    const error = refusal(() => captureEditor(state));
    expect([error.code, error.message]).toEqual([
      'round-trip',
      'Requested element cannot round-trip unambiguously; source remains unchanged',
    ]);
    expect(refusedRow(error)).toEqual({
      index: 3,
      kind: 'dialogue',
      text: '(laughs) Oh no.',
    });
    // The same text typed over the row directly below is named there, as before.
    const adjacent = typed(
      caret(emptied(open('@BOB\nOne.\nTwo.\n'), 1), 2, 0, -1),
      '(laughs) Oh no.',
    );
    expect(refusedRow(refusal(() => captureEditor(adjacent)))).toEqual({
      index: 2,
      kind: 'dialogue',
      text: '(laughs) Oh no.',
    });
  });
});
