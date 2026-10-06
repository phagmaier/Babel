import { describe, expect, it } from 'vitest';
import { TextSelection, type EditorState } from 'prosemirror-state';
import { writingFailureMessage } from '../../src/app/writingHelpers';
import {
  EditorCaptureBoundary,
  recoverySnapshotOf,
  refusalRecovery,
  sha256,
} from '../../src/application/editorCapture';
import {
  editorRecovery,
  verifiedEditorMetadata,
} from '../../src/application/editorMetadata';
import { FountainEditError } from '../../src/domain/fountainCodec';
import {
  convertEditorSelection,
  smartKeyTransaction,
} from '../../src/editor/commands';
import {
  captureEditor,
  captureForRecovery,
} from '../../src/editor/sourceBridge';
import {
  applyEditorTransaction,
  createEditorState,
  editorVersion,
} from '../../src/editor/state';

// CAPTURE-RECOVERY (ADR 0044): a draft Fountain refuses still reaches the
// recovery journal as a recovery-only copy. The refusal itself is unchanged.
const bytes = (text: string) => new TextEncoder().encode(text);
const text = (source: Uint8Array | readonly number[]) =>
  new TextDecoder('utf-8', { ignoreBOM: true }).decode(Uint8Array.from(source));
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
function typed(state: EditorState, inserted: string) {
  const applied = applyEditorTransaction(state, state.tr.insertText(inserted));
  expect(applied.accepted).toBe(true);
  return applied.state;
}
function deleted(state: EditorState, row: number, from: number, to: number) {
  const applied = applyEditorTransaction(
    state,
    state.tr.delete(at(state, row, from), at(state, row, to)),
  );
  expect(applied.accepted).toBe(true);
  return applied.state;
}
function emptied(state: EditorState, row: number) {
  const selected = caret(state, row, 0, -1);
  return deleted(selected, row, 0, -1);
}
function refusal(state: EditorState): FountainEditError {
  try {
    captureEditor(state);
  } catch (error) {
    expect(error).toBeInstanceOf(FountainEditError);
    return error as FountainEditError;
  }
  throw new Error('Expected a refusal');
}
const rowTexts = (state: EditorState) =>
  state.doc.content.content.map((node) => node.textContent);

describe('captureForRecovery', () => {
  it('keeps a Parenthetical missing its opening parenthesis as Dialogue text', () => {
    const state = deleted(open('@BOB\n(beat)\nHi.\n'), 1, 0, 1);
    const before = state.doc;
    const result = captureForRecovery(state, refusal(state))!;
    expect(text(result.capture.source)).toBe('@BOB\nbeat)\nHi.\n');
    expect(result.retyped).toEqual([
      {
        row: { index: 1, kind: 'parenthetical', text: 'beat)' },
        kind: 'dialogue',
      },
    ]);
    expect(result.capture.version).toBe(editorVersion(state));
    // The live editor is never touched.
    expect(state.doc).toBe(before);
    expect(state.doc.child(1).type.name).toBe('parenthetical');
  });

  it('retypes every refused row and preserves BOM, CRLF and unknown regions', () => {
    const source =
      '﻿@BOB\r\n(beat)\r\nHi.\r\n\r\n@ANN\r\n(sigh)\r\nNo.\r\n\r\nopaque [[unknown]] tail\r\n!After.\r\n';
    let state = typed(caret(open(source), 1, 0), 'x ');
    state = typed(caret(state, 5, 0), 'y ');
    const result = captureForRecovery(state, refusal(state))!;
    expect([...result.capture.source.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(text(result.capture.source)).toBe(
      '﻿@BOB\r\nx (beat)\r\nHi.\r\n\r\n@ANN\r\ny (sigh)\r\nNo.\r\n\r\nopaque [[unknown]] tail\r\n!After.\r\n',
    );
    expect(result.retyped.map(({ row, kind }) => [row.index, kind])).toEqual([
      [1, 'dialogue'],
      [5, 'dialogue'],
    ]);
  });

  it('keeps refused text outside a speech as Action', () => {
    let state = caret(open('!Alpha.\n'), 0, -1);
    const enter = smartKeyTransaction(state, 'Enter');
    state = applyEditorTransaction(state, enter.transaction!).state;
    const heading = convertEditorSelection(state, 'sceneHeading');
    state = applyEditorTransaction(state, heading.transaction!).state;
    state = typed(state, '# hey');
    const result = captureForRecovery(state, refusal(state))!;
    expect(text(result.capture.source)).toBe('!Alpha.\n\n!# hey\n');
    expect(result.retyped.map(({ kind }) => kind)).toEqual(['action']);
  });

  it('omits a refused empty row, which has no text to keep', () => {
    const state = typed(
      caret(emptied(open('!Alpha.\n\n.HALL #12#\n\n!Beta.\n'), 2), 4, -1),
      ' More.',
    );
    const result = captureForRecovery(state, refusal(state))!;
    expect(result.retyped.map(({ kind }) => kind)).toEqual(['omitted']);
    expect(text(result.capture.source)).toContain('!Beta. More.');
  });

  it('returns null when the codec names no row, leaving the refusal as before', () => {
    const state = emptied(open('@BOB\nOne.\n(beat'), 1);
    expect(captureForRecovery(state, refusal(state))).toBeNull();
    expect(captureForRecovery(state, new Error('unrelated'))).toBeNull();
  });
});

describe('EditorCaptureBoundary refusal', () => {
  const boundaryFor = (state: EditorState) =>
    new EditorCaptureBoundary(() => state, { defer: async () => undefined });

  it('rethrows the same refusal with a hash-bound recovery-only snapshot', async () => {
    const state = typed(
      caret(deleted(open('@BOB\n(beat)\nHi.\n'), 1, 0, 1), 2, -1),
      ' Fine.',
    );
    const error = await boundaryFor(state)
      .capture()
      .then(
        () => {
          throw new Error('Expected a refusal');
        },
        (failure: unknown) => failure,
      );
    expect(error).toBeInstanceOf(FountainEditError);
    const snapshot = recoverySnapshotOf(error)!;
    expect(snapshot.recoveryOnly).toBe(true);
    expect(snapshot.version).toBe(editorVersion(state));
    expect(text(snapshot.source)).toBe('@BOB\nbeat)\nHi. Fine.\n');
    expect(snapshot.sourceSha256).toBe(
      await sha256(Uint8Array.from(snapshot.source)),
    );
    expect(snapshot.draftMetadata).toMatchObject({
      schema: 'babel-editor-capture-v1',
      sourceSha256: snapshot.sourceSha256,
    });

    // After a crash, recovery reopens every row's text.
    const source = Uint8Array.from(snapshot.source);
    const metadata = await verifiedEditorMetadata(
      snapshot.source,
      snapshot.draftMetadata,
    );
    const reopened = createEditorState(
      source,
      editorRecovery(source, metadata),
    );
    expect(rowTexts(reopened)).toEqual(['BOB', 'beat)', 'Hi. Fine.']);
    expect(text(captureEditor(reopened).source)).toBe(text(source));
  });

  it('attaches nothing when no recovery copy is possible', async () => {
    const state = emptied(open('@BOB\nOne.\n(beat'), 1);
    const error = await boundaryFor(state)
      .capture()
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(FountainEditError);
    expect(recoverySnapshotOf(error)).toBeUndefined();
    expect(writingFailureMessage(error)).toMatch(
      /^Saving and recovery are paused\./,
    );
  });

  it('tells the author recovery still protects the text, and how the row returns', async () => {
    const state = deleted(open('@BOB\n(beat)\nHi.\n'), 1, 0, 1);
    const error = await boundaryFor(state)
      .capture()
      .catch((e: unknown) => e);
    expect(refusalRecovery(error)?.retyped).toHaveLength(1);
    expect(writingFailureMessage(error)).toBe(
      'Saving the file is paused; recovery still protects all of your text. Row 2, the Parenthetical “beat)”, cannot be saved as Fountain as it stands. A Parenthetical starts with an opening parenthesis. Change that row or Undo to resume. If babel closes unexpectedly, recovery reopens row 2 as Dialogue.',
    );
  });
});
