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
import { captureEditor, refusedRow } from '../../src/editor/sourceBridge';
import {
  applyEditorTransaction,
  createEditorState,
} from '../../src/editor/state';

// AUDIT-PARK-H-F4-05: one physical blank needs one line ending at EOF.
// Numbers remain authored content; emptiness cannot hide one in recovery.
const bytes = (value: string) => new TextEncoder().encode(value);
const text = (value: Uint8Array) =>
  new TextDecoder('utf-8', { ignoreBOM: true }).decode(value);
const rows = (state: EditorState) =>
  state.doc.content.content.map(
    (node) => `${node.type.name}:${node.textContent}`,
  );
const saved = (state: EditorState) => text(captureEditor(state).source);
function at(state: EditorState, row: number) {
  let position = 1;
  for (let index = 0; index < row; index++)
    position += state.doc.child(index).nodeSize;
  return position;
}
function rewrite(state: EditorState, row: number, value: string) {
  const start = at(state, row);
  const applied = applyEditorTransaction(
    state,
    state.tr
      .setSelection(
        TextSelection.create(
          state.doc,
          start,
          start + state.doc.child(row).content.size,
        ),
      )
      .insertText(value),
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
function refusal(run: () => unknown) {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(FountainEditError);
    return error as FountainEditError;
  }
  throw new Error('Expected refusal');
}

const kinds = ['sceneHeading', 'dialogue', 'parenthetical'] as const;
const content = {
  sceneHeading: '.HALL',
  dialogue: 'Hello.',
  parenthetical: '(beat)',
};
const contexts = [
  ['', '', '\n'],
  ['\ufeff', '', '\n'],
  ['', '\n', '\n'],
  ['', '\r\n', '\r\n'],
  ['\ufeff', '\r\n', '\r\n'],
  ['', '\r', '\r'],
] as const;

describe('AUDIT-PARK-H-F4-05 an emptied last row keeps a physical line', () => {
  it.each(
    kinds.flatMap((kind) =>
      contexts.map(([bom, ending, expectedEnding]) => ({
        kind,
        bom,
        ending,
        expectedEnding,
      })),
    ),
  )(
    '$kind with BOM=$bom and ending=$ending',
    ({ kind, bom, ending, expectedEnding }) => {
      // Speech has a cue even when the file has no earlier ending convention.
      const prefix =
        kind === 'sceneHeading'
          ? ending
            ? `!Alpha.${ending}${ending}`
            : ''
          : `@BOB${ending || '\n'}`;
      const original = bom + prefix + content[kind];
      const before = parseFountain(bytes(original));
      const row = before.lines.length - 1;
      const after = replaceLine(before, row, { kind, text: '' });
      expect(text(serializeFountain(after))).toBe(
        bom + prefix + expectedEnding,
      );
      expect(after.lines).toHaveLength(before.lines.length);
      expect(after.lines[row]).toMatchObject({
        id: before.lines[row]!.id,
        kind: 'blank',
        text: '',
        sourceText: '',
        intendedKind: kind,
        newline: expectedEnding,
        blankRole: 'draft',
        editable: true,
      });
      expect(after.lines.slice(0, row)).toEqual(before.lines.slice(0, row));
      expect(text(serializeFountain(before))).toBe(original);
      const again = replaceLine(after, row, { kind, text: '' });
      expect(text(again.bytes)).toBe(bom + prefix + expectedEnding);
      const reopened = parseFountain(after.bytes);
      expect(reopened.lines[row]!.kind).toBe('blank');
      expect(reopened.lines[row]!.intendedKind).toBeUndefined();
      expect(text(reopened.bytes)).toBe(bom + prefix + expectedEnding);
    },
  );

  it('inherits the nearest preceding ending in a one-row mixed-ending edit', () => {
    const before = parseFountain(bytes('\ufeff!Alpha.\n\r\n.HALL'));
    const after = replaceLine(before, 2, { kind: 'sceneHeading', text: '' });
    expect(text(after.bytes)).toBe('\ufeff!Alpha.\n\r\n\r\n');
    expect(after.lines.slice(0, 2)).toEqual(before.lines.slice(0, 2));
  });

  it('uses the existing owned-context convention in a wider mixed-ending edit', () => {
    const before = parseFountain(bytes('!Alpha.\r\n\n.HALL'));
    const after = replaceLines(before, 0, 3, [
      { kind: 'action', text: 'Beta.' },
      { kind: 'blank', text: '' },
      { kind: 'sceneHeading', text: '' },
    ]);
    expect(text(after.bytes)).toBe('!Beta.\r\n\n\r\n');
  });

  it.each(kinds)(
    'already terminated %s and nonempty EOF edits keep their bytes',
    (kind) => {
      const prefix = kind === 'sceneHeading' ? '!Alpha.\r\n\r\n' : '@BOB\r\n';
      const before = parseFountain(bytes(prefix + content[kind] + '\r\n'));
      const row = before.lines.length - 1;
      expect(text(replaceLine(before, row, { kind, text: '' }).bytes)).toBe(
        prefix + '\r\n',
      );
      const noEnding = parseFountain(bytes(prefix + content[kind]));
      const value = kind === 'parenthetical' ? '(pause)' : 'More.';
      const after = replaceLine(noEnding, row, { kind, text: value });
      expect(text(after.bytes)).toBe(
        prefix + (kind === 'sceneHeading' ? '.' : '') + value,
      );
      expect(after.lines[row]!.newline).toBe('');
    },
  );
});

describe('AUDIT-PARK-H-F4-05 exact recovery and editor history', () => {
  it.each(kinds)(
    '%s keeps sparse intent, selection, unrelated edits and continuation',
    async (kind) => {
      const prefix =
        kind === 'sceneHeading'
          ? '\ufeff!Alpha.\r\n\r\n'
          : '\ufeff!Alpha.\r\n\r\n@BOB\r\n';
      const original = prefix + content[kind];
      let state = createEditorState(bytes(original));
      const row = state.doc.childCount - 1;
      state = rewrite(state, row, '');
      const blank = prefix + '\r\n';
      expect(rows(state)[row]).toBe(kind + ':');
      expect(saved(state)).toBe(blank);
      const snapshot = (await new EditorCaptureBoundary(() => state).capture())
        .snapshot;
      expect(snapshot.draftMetadata).toMatchObject({
        drafts: [{ index: row, intendedKind: kind }],
      });
      const metadata = await verifiedEditorMetadata(
        snapshot.source,
        snapshot.draftMetadata,
      );
      expect(metadata).toBeDefined();
      const source = Uint8Array.from(snapshot.source);
      const restored = createEditorState(
        source,
        editorRecovery(source, metadata),
      );
      expect(rows(restored)).toEqual(rows(state));
      expect(saved(restored)).toBe(blank);
      const selection = metadataSelection(restored, metadata);
      expect(selection).not.toBeNull();
      expect(selection!.head).toBe(at(restored, row));
      const capture = captureEditor(state);
      expect(capture.selection).not.toBeNull();
      expect(capture.selection!.head).toMatchObject({
        sourceIndex: row,
        utf16Offset: 0,
        byteOffset: bytes(prefix).length,
      });
      expect(capture.document.lines[row]).toMatchObject({
        sourceStart: bytes(prefix).length,
        contentEnd: bytes(prefix).length,
        sourceEnd: bytes(blank).length,
      });
      expect(
        await verifiedEditorMetadata(
          [...bytes(original)],
          snapshot.draftMetadata,
        ),
      ).toBeUndefined();
      const plain = createEditorState(source);
      expect(rows(plain)[row]).toBe('action:');
      expect(saved(plain)).toBe(blank);
      const later = rewrite(restored, 0, 'Beta.');
      expect(saved(later)).toBe(blank.replace('Alpha.', 'Beta.'));
      expect(captureEditor(later).document.lines[row]!.intendedKind).toBe(kind);
      const value =
        kind === 'parenthetical'
          ? '(pause)'
          : kind === 'sceneHeading'
            ? 'HALL'
            : 'More.';
      const continued = rewrite(later, row, value);
      expect(saved(continued)).toBe(
        prefix.replace('Alpha.', 'Beta.') +
          (kind === 'sceneHeading' ? '.' : '') +
          value +
          '\r\n',
      );
      expect(
        captureEditor(continued).document.lines[row]!.intendedKind,
      ).toBeUndefined();
    },
  );

  it.each(kinds)(
    '%s Undo restores unterminated bytes; Redo restores the blank and intent',
    (kind) => {
      const original =
        (kind === 'sceneHeading' ? '!Alpha.\n\n' : '@BOB\n') + content[kind];
      let state = createEditorState(bytes(original));
      state = state.apply(closeHistory(state.tr));
      const row = state.doc.childCount - 1;
      state = rewrite(state, row, '');
      const blank = (kind === 'sceneHeading' ? '!Alpha.\n\n' : '@BOB\n') + '\n';
      expect(saved(state)).toBe(blank);
      state = step(state, undo);
      expect(saved(state)).toBe(original);
      state = step(state, redo);
      expect(saved(state)).toBe(blank);
      expect(captureEditor(state).document.lines[row]!.intendedKind).toBe(kind);
    },
  );
});

describe('AUDIT-PARK-H-F4-05 authored numbers and refusal boundaries', () => {
  it.each(['', '\n', '\r\n', '\r'])(
    'an emptied numbered heading with ending %j keeps its number and refusal',
    (ending) => {
      const original = '!Alpha.\n\n.HALL #12#' + ending;
      const before = parseFountain(bytes(original));
      const error = refusal(() =>
        replaceLine(before, 2, { kind: 'sceneHeading', text: '' }),
      );
      expect([error.code, error.edit]).toEqual(['round-trip', 0]);
      expect(text(serializeFountain(before))).toBe(original);
      const state = rewrite(createEditorState(bytes(original)), 2, '');
      const bridgeError = refusal(() => captureEditor(state));
      expect(refusedRow(bridgeError)).toEqual({
        index: 2,
        kind: 'sceneHeading',
        text: '',
      });
      expect(state.doc.child(2).attrs.sceneNumber).toBe('12');
    },
  );

  it('an emptied EOF beside another unwritable row names that row', () => {
    let state = createEditorState(bytes('@BOB\n(beat)\n\n.HALL'));
    state = rewrite(state, 3, '');
    state = rewrite(state, 1, 'x (beat)');
    expect(refusedRow(refusal(() => captureEditor(state)))).toEqual({
      index: 1,
      kind: 'parenthetical',
      text: 'x (beat)',
    });
  });

  it('a protected following row, newlines and surrogates keep their guards', () => {
    const before = parseFountain(bytes('@BOB\nOne.\n(beat'));
    expect(
      refusal(() => replaceLine(before, 1, { kind: 'dialogue', text: '' }))
        .code,
    ).toBe('neighbor-drift');
    const heading = parseFountain(bytes('.HALL'));
    for (const value of ['\n', '\r', '\ud800'])
      expect(
        refusal(() =>
          replaceLine(heading, 0, { kind: 'sceneHeading', text: value }),
        ).code,
      ).toBe('invalid-edit');
    expect(text(before.bytes)).toBe('@BOB\nOne.\n(beat');
  });
});
