import { describe, expect, it } from 'vitest';
import { TextSelection, type EditorState } from 'prosemirror-state';
import { writingFailureMessage } from '../../src/app/writingHelpers';
import {
  FountainEditError,
  parseFountain,
  replaceLine,
  replaceLines,
} from '../../src/domain/fountainCodec';
import {
  convertEditorSelection,
  smartKeyTransaction,
} from '../../src/editor/commands';
import { captureEditor, refusedRow } from '../../src/editor/sourceBridge';
import {
  applyEditorTransaction,
  createEditorState,
} from '../../src/editor/state';

// AUDIT-PARK-H-F3: a refused capture names the row that cannot be written and
// how to resume. Nothing here becomes capturable; codes and messages stay.
const bytes = (text: string) => new TextEncoder().encode(text);
const open = (source: string) => createEditorState(bytes(source));
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
function typed(state: EditorState, text: string) {
  const applied = applyEditorTransaction(state, state.tr.insertText(text));
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
function converted(state: EditorState, kind: 'sceneHeading' | 'action') {
  const result = convertEditorSelection(state, kind);
  expect(result.transaction, result.reason).toBeDefined();
  return applyEditorTransaction(state, result.transaction!).state;
}
function entered(state: EditorState) {
  const result = smartKeyTransaction(state, 'Enter');
  expect(result.transaction, result.reason).toBeDefined();
  return applyEditorTransaction(state, result.transaction!).state;
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
const rows = (state: EditorState) =>
  state.doc.content.content.map(
    (node) => `${node.type.name}:${node.textContent}`,
  );

const roundTrip =
  'Requested element cannot round-trip unambiguously; source remains unchanged';
const wrapped =
  'Parenthetical must be wrapped or an incomplete opening parenthesis';
const copy =
  ' To keep the draft exactly as it is, use Close session, then Save Emergency Copy and close.';

describe('AUDIT-PARK-H-F3 the codec names the edit it cannot write', () => {
  it('a per-edit refusal carries that edit offset with its code and message unchanged', () => {
    const speech = parseFountain(bytes('@BOB\n(beat)\nHi.\n'));
    const invalid = refusal(() =>
      replaceLine(speech, 1, { kind: 'parenthetical', text: '(beat) x' }),
    );
    expect([invalid.code, invalid.message, invalid.edit]).toEqual([
      'invalid-edit',
      wrapped,
      0,
    ]);
    const scene = parseFountain(bytes('!Alpha.\n\n!Omega.\n'));
    const mismatch = refusal(() =>
      replaceLines(scene, 0, 3, [
        { kind: 'action', text: 'Later. Alpha.' },
        { kind: 'blank', text: '' },
        { kind: 'sceneHeading', text: 'x #1#' },
      ]),
    );
    expect([mismatch.code, mismatch.message, mismatch.edit]).toEqual([
      'round-trip',
      roundTrip,
      2,
    ]);
    expect(new TextDecoder().decode(scene.bytes)).toBe('!Alpha.\n\n!Omega.\n');
  });

  it('a refusal about the whole context or an unowned neighbour names no edit', () => {
    const eof = refusal(() =>
      replaceLine(parseFountain(bytes('.HALL')), 0, {
        kind: 'sceneHeading',
        text: '',
      }),
    );
    expect([eof.code, eof.edit]).toEqual(['round-trip', undefined]);
    expect(eof.message).toBe(
      'Edit cannot retain every intended source line (empty EOF needs a line ending)',
    );
    const drift = refusal(() =>
      replaceLine(parseFountain(bytes('@BOB\nOne.\nTwo.\n')), 1, {
        kind: 'action',
        text: 'One.',
      }),
    );
    expect([drift.code, drift.line, drift.edit]).toEqual([
      'neighbor-drift',
      2,
      undefined,
    ]);
  });
});

describe('AUDIT-PARK-H-F3 the bridge records the live row', () => {
  it('names the single row typed after a closed parenthetical', () => {
    const state = typed(caret(open('@BOB\n(beat)\nHi.\n'), 1, -1), ' x');
    const error = refusal(() => captureEditor(state));
    expect([error.code, error.message]).toEqual(['invalid-edit', wrapped]);
    expect(refusedRow(error)).toEqual({
      index: 1,
      kind: 'parenthetical',
      text: '(beat) x',
    });
  });

  it('names the refused row inside a changed range that spans other edited rows', () => {
    let state = entered(caret(open('!Alpha.\n'), 0, -1));
    state = typed(converted(state, 'sceneHeading'), 'x #1#');
    state = typed(caret(state, 0, 0), 'Later. ');
    expect(rows(state)).toEqual([
      'action:Later. Alpha.',
      'action:',
      'sceneHeading:x #1#',
    ]);
    const error = refusal(() => captureEditor(state));
    expect([error.code, error.message]).toEqual(['round-trip', roundTrip]);
    expect(refusedRow(error)).toEqual({
      index: 2,
      kind: 'sceneHeading',
      text: 'x #1#',
    });
  });

  it('no longer reaches a converted first Dialogue row: the command refuses it', () => {
    // AUDIT-PARK-H-F4-01. This case used to strand the Dialogue below and
    // name it; the emptied row in the next case still shows that attribution.
    const state = caret(open('@BOB\nOne.\nTwo.\n'), 1, 0);
    const result = convertEditorSelection(state, 'action');
    expect([result.transaction, result.reason]).toEqual([
      undefined,
      'Convert the rest of the speech together; Fountain ends dialogue at another element',
    ]);
    expect(new TextDecoder().decode(captureEditor(state).source)).toBe(
      '@BOB\nOne.\nTwo.\n',
    );
  });

  it('no longer reaches an emptied Dialogue with speech below it; names an emptied numbered heading itself', () => {
    // AUDIT-PARK-H-F4-02. The blank line used to end the speech and the
    // Dialogue below was named; the row is now the two-space dialogue line.
    const speech = emptied(open('@BOB\nOne.\nTwo.\n'), 1);
    expect(rows(speech)).toEqual([
      'character:BOB',
      'dialogue:',
      'dialogue:Two.',
    ]);
    expect(new TextDecoder().decode(captureEditor(speech).source)).toBe(
      '@BOB\n  \nTwo.\n',
    );
    // A row below that has no spelling of its own is still the one named.
    const below = typed(caret(speech, 2, 0, -1), '(laughs) Oh no.');
    expect(refusedRow(refusal(() => captureEditor(below)))).toEqual({
      index: 2,
      kind: 'dialogue',
      text: '(laughs) Oh no.',
    });
    const numbered = emptied(open('!Alpha.\n\n.HALL #12#\n'), 2);
    expect(refusedRow(refusal(() => captureEditor(numbered)))).toEqual({
      index: 2,
      kind: 'sceneHeading',
      text: '',
    });
  });

  it('records no row when the codec names no single edit', () => {
    const state = emptied(open('!Alpha.\n\n.HALL'), 2);
    const error = refusal(() => captureEditor(state));
    expect(error.message).toBe(
      'Edit cannot retain every intended source line (empty EOF needs a line ending)',
    );
    expect(refusedRow(error)).toBeUndefined();
    expect(refusedRow(new Error('unrelated'))).toBeUndefined();
    expect(refusedRow(undefined)).toBeUndefined();
  });

  it('a row that is changed back captures the same bytes as before', () => {
    const original = '@BOB\n(beat)\nHi.\n';
    const refused = typed(caret(open(original), 1, -1), ' x');
    expect(() => captureEditor(refused)).toThrow(wrapped);
    const selected = caret(refused, 1, -3, -1);
    const repaired = applyEditorTransaction(
      selected,
      selected.tr.deleteSelection(),
    ).state;
    expect(new TextDecoder().decode(captureEditor(repaired).source)).toBe(
      original,
    );
  });
});

describe('AUDIT-PARK-H-F3 author wording', () => {
  const message = (state: EditorState) =>
    writingFailureMessage(refusal(() => captureEditor(state)));

  it('names the row, its element and text, how to resume and the copy route', () => {
    expect(
      message(typed(caret(open('@BOB\n(beat)\nHi.\n'), 1, -1), ' x')),
    ).toBe(
      'Saving and recovery are paused. Row 2, the Parenthetical “(beat) x”, cannot be saved as Fountain as it stands. A Parenthetical keeps all of its text inside one pair of parentheses. Change that row or Undo to resume.' +
        copy,
    );
    let heading = entered(caret(open('!Alpha.\n'), 0, -1));
    heading = typed(converted(heading, 'sceneHeading'), 'x #1#');
    expect(message(heading)).toBe(
      'Saving and recovery are paused. Row 3, the Scene Heading “x #1#”, cannot be saved as Fountain as it stands. Change that row or Undo to resume.' +
        copy,
    );
  });

  it('describes an empty row by its element and asks for its text', () => {
    expect(message(emptied(open('!Alpha.\n\n.HALL #12#\n'), 2))).toBe(
      'Saving and recovery are paused. Row 3, an empty Scene Heading row, cannot be saved as Fountain as it stands. Type its text or Undo to resume.' +
        copy,
    );
    // AUDIT-PARK-H-F4-02: the emptied Dialogue above saves; the alert is
    // about the row that still has no spelling.
    const speech = emptied(open('@BOB\nOne.\nTwo.\n'), 1);
    expect(message(typed(caret(speech, 2, 0, -1), '(laughs) Oh no.'))).toBe(
      'Saving and recovery are paused. Row 3, the Dialogue “(laughs) Oh no.”, cannot be saved as Fountain as it stands. Change that row or Undo to resume.' +
        copy,
    );
  });

  it('shortens a long row to an excerpt without splitting a character', () => {
    const long = '(' + '😀'.repeat(60) + ') x';
    const state = typed(caret(open('@BOB\n(beat)\nHi.\n'), 1, 0, -1), long);
    expect(message(state)).toContain(
      `Row 2, the Parenthetical “(${'😀'.repeat(47)}…”, cannot`,
    );
  });

  it('names no row when none is known, and never shows codec wording', () => {
    const generic =
      'Saving and recovery are paused. Part of this draft cannot be saved as Fountain as it stands. Undo the latest changes to resume.' +
      copy;
    expect(message(emptied(open('!Alpha.\n\n.HALL'), 2))).toBe(generic);
    expect(
      writingFailureMessage(
        new FountainEditError(
          'protected-region',
          'Protected row identity or order changed',
        ),
      ),
    ).toBe(generic);
    for (const state of [
      typed(caret(open('@BOB\n(beat)\nHi.\n'), 1, -1), ' x'),
      typed(
        caret(emptied(open('@BOB\nOne.\nTwo.\n'), 1), 2, 0, -1),
        '(laughs) Oh no.',
      ),
      emptied(open('!Alpha.\n\n.HALL'), 2),
    ])
      expect(message(state)).not.toMatch(
        /round-trip|unambiguous|must be wrapped|source remains|intended source line/,
      );
  });

  it('leaves read-only reasons and failures that are not capture refusals as they were', () => {
    expect(
      writingFailureMessage(
        new FountainEditError('read-only', 'This screenplay is read-only.'),
      ),
    ).toBe('This screenplay is read-only.');
    expect(
      writingFailureMessage(new Error('Editor changed during capture')),
    ).toBe('Editor changed during capture');
    expect(writingFailureMessage({ code: 'io' })).toBe(
      'The storage operation failed. Your text stays open; retry or save a copy to another location.',
    );
  });
});
