import { describe, expect, it } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import { undo, redo } from 'prosemirror-history';
import {
  buildLocalVocabulary,
  rankVocabulary,
} from '../../src/domain/completion';
import {
  acceptEditorCompletion,
  completionChangesText,
  indexEditorCompletion,
  offerEditorCompletion,
} from '../../src/editor/completion';
import {
  applyEditorTransaction,
  createEditorState,
  editorVersion,
} from '../../src/editor/state';
import { captureEditor } from '../../src/editor/sourceBridge';

function stateFor(source: string, row: number, offset?: number) {
  let state = createEditorState(new TextEncoder().encode(source));
  const pos =
    1 +
    state.doc.content.content
      .slice(0, row)
      .reduce((n, node) => n + node.nodeSize, 0) +
    (offset ?? state.doc.child(row).textContent.length);
  state = applyEditorTransaction(
    state,
    state.tr.setSelection(TextSelection.create(state.doc, pos)),
  ).state;
  return state;
}
const decode = (state: ReturnType<typeof createEditorState>) =>
  new TextDecoder('utf-8', { ignoreBOM: true }).decode(
    captureEditor(state).source,
  );
function complete(state: ReturnType<typeof createEditorState>, item: string) {
  const offer = offerEditorCompletion(state, indexEditorCompletion(state))!;
  expect(offer).not.toBeNull();
  expect(offer.items).toContain(item);
  const tr = acceptEditorCompletion(state, offer, offer.items.indexOf(item))!;
  expect(tr).not.toBeNull();
  return applyEditorTransaction(state, tr).state;
}
describe('local vocabulary identity and ranking', () => {
  it('derives only cues/headings, separates extensions and ignores hidden/protected source', () => {
    const index = buildLocalVocabulary([
      { kind: 'action', text: 'UPPERCASE PHRASE' },
      { kind: 'character', text: 'MAYA (V.O.)' },
      { kind: 'character', text: 'MAYA (O.S.)' },
      { kind: 'character', text: 'MAY' },
      { kind: 'character', text: 'Maya' },
      { kind: 'character', text: 'SECRET', hidden: true },
      { kind: 'character', text: 'RAW', protected: true },
      { kind: 'sceneHeading', text: 'INT. LAB - NIGHT' },
      { kind: 'sceneHeading', text: 'EXT. LAB - DAY' },
      { kind: 'sceneHeading', text: 'SOMEWHERE STRANGE' },
    ]);
    expect(
      index.characters.map((entry) => [entry.text, entry.frequency]),
    ).toEqual([
      ['MAYA', 2],
      ['MAY', 1],
      ['Maya', 1],
    ]);
    expect(index.locations.map((entry) => entry.text)).toEqual([
      'LAB',
      'SOMEWHERE STRANGE',
    ]);
    expect(index.times.map((entry) => entry.text)).toEqual(['NIGHT', 'DAY']);
  });
  it('ranks exact then prefix then subsequence, frequency then recent without merging names', () => {
    const entries = [
      { text: 'MAY', frequency: 1, recent: 0 },
      { text: 'MAYA', frequency: 2, recent: 1 },
      { text: 'MAYBELL', frequency: 2, recent: 9 },
      { text: 'MARY', frequency: 20, recent: 12 },
    ];
    expect(rankVocabulary(entries, 'may')).toEqual([
      'MAY',
      'MAYBELL',
      'MAYA',
      'MARY',
    ]);
    expect(rankVocabulary(entries, 'MY')).toEqual([
      'MARY',
      'MAYBELL',
      'MAYA',
      'MAY',
    ]);
    expect(rankVocabulary(entries, 'zzz')).toEqual([]);
  });
});
describe('completion source/caret/undo and segment boundaries', () => {
  it('preserves cue extension, spelling, source bytes and one-step undo/redo', () => {
    const source = '\uFEFF\r\n@Maya (V.O.)\r\nHello.\r\n\r\n@ma (O.S.)\r\n';
    const state = stateFor(source, 4, 2);
    const before = state.selection.from;
    const result = complete(state, 'Maya');
    expect(decode(result)).toBe(source.replace('@ma (O.S.)', '@Maya (O.S.)'));
    expect(result.selection.from).toBe(before + 2);
    let undone = result;
    undo(result, (tr) => {
      undone = applyEditorTransaction(result, tr).state;
    });
    expect(decode(undone)).toBe(source);
    expect(undone.selection.from).toBe(before);
    expect(editorVersion(undone)).toBeGreaterThan(editorVersion(result));
    redo(undone, (tr) => {
      undone = applyEditorTransaction(undone, tr).state;
    });
    expect(decode(undone)).toBe(decode(result));
  });
  it.each([
    ['INT. LA - DAY', 7, 'LAB', 'INT. LAB - DAY', 'location'],
    ['EXT. LAB - NI', 13, 'NIGHT', 'EXT. LAB - NIGHT', 'time'],
    ['IN', 2, 'INT.', 'INT. ', 'prefix'],
    ['INT. LAB - DAY', 4, 'INT.', 'INT. LAB - DAY', 'prefix'],
    ['SOME', 4, 'SOMEWHERE STRANGE', 'SOMEWHERE STRANGE', 'location'],
  ])(
    'completes %s without duplicating prefix/time',
    (text, offset, value, expected, segment) => {
      const source = `\n.INT. LAB - NIGHT\n\n.SOMEWHERE STRANGE\n\n.${text}\n`;
      const state = stateFor(source, 5, offset as number);
      expect(
        offerEditorCompletion(state, indexEditorCompletion(state))?.segment,
      ).toBe(segment);
      const result = complete(state, value as string);
      expect(result.doc.child(5).textContent).toBe(expected);
      expect(decode(result)).toBe(
        source.replace(`.${text}\n`, `.${expected}\n`),
      );
    },
  );
  it('retains heading scene numbers and unrelated marks/IDs', () => {
    const source = '\n.INT. LAB - NIGHT\n\n.INT. LA - DAY #12#\n';
    const state = stateFor(source, 3, 7);
    const id = state.doc.child(3).attrs.id;
    const result = complete(state, 'LAB');
    expect(result.doc.child(3).attrs.id).toBe(id);
    expect(decode(result)).toBe(source.replace('LA - DAY', 'LAB - DAY'));
  });
  it.each([' (V.O.) (CONT’D)', ' (V.O.'])(
    'keeps %s separate from speaker identity and completion range',
    (extension) => {
      const source = `\n@MAYA${extension}\nHi.\n\n@MA${extension}\n`;
      const state = stateFor(source, 4, 2);
      expect(
        indexEditorCompletion(state).vocabulary.characters.map(
          (entry) => entry.text,
        ),
      ).toEqual(['MAYA', 'MA']);
      expect(decode(complete(state, 'MAYA'))).toBe(
        source.replace(`@MA${extension}`, `@MAYA${extension}`),
      );
      const withinExtension = stateFor(source, 4);
      expect(
        offerEditorCompletion(
          withinExtension,
          indexEditorCompletion(withinExtension),
        ),
      ).toBeNull();
    },
  );
  it('preserves selected-name formatting and extension formatting', () => {
    const source = '\n@Maya\nHello.\n\n@*Ma* **(V.O.)**\n';
    const state = stateFor(source, 4, 2);
    const result = complete(state, 'Maya');
    expect(decode(result)).toBe(source.replace('@*Ma*', '@*Maya*'));
    expect(result.doc.child(4).child(0).marks[0]?.type.name).toBe('italic');
  });
  it('does not suggest an incomplete cue to itself, but retains established exact matches', () => {
    const unique = stateFor('\n@MAYA\n', 1);
    expect(
      offerEditorCompletion(unique, indexEditorCompletion(unique)),
    ).toBeNull();
    const repeated = stateFor('\n@MAYA\nHi.\n\n@maya\n', 4);
    expect(
      offerEditorCompletion(repeated, indexEditorCompletion(repeated))?.items,
    ).toEqual(['MAYA']);
  });
  it('keeps built-in time vocabulary even when the active heading is its only use', () => {
    const state = stateFor('\n.EXT. LAB - NIGHT\n', 1);
    expect(
      offerEditorCompletion(state, indexEditorCompletion(state))?.items[0],
    ).toBe('NIGHT');
  });
  it('an identical suggestion is no acceptance; case, completion and prefix spacing are (S07.6)', () => {
    const changes = (source: string) => {
      const state = stateFor(source, 1);
      const offer = offerEditorCompletion(state, indexEditorCompletion(state))!;
      return [offer.items[0], completionChangesText(state, offer, 0)];
    };
    // Enter/Tab keep their normal job when acceptance would change nothing.
    expect(changes('\n.EXT. LAB - NIGHT\n')).toEqual(['NIGHT', false]);
    expect(changes('\n.EXT. LAB - night\n')).toEqual(['NIGHT', true]);
    expect(changes('\n.EXT. LAB - NI\n')).toEqual(['NIGHT', true]);
    expect(changes('\n.INT.\n')).toEqual(['INT.', true]);
    const state = stateFor('\n.EXT. LAB - NIGHT\n', 1);
    const offer = offerEditorCompletion(state, indexEditorCompletion(state))!;
    expect(completionChangesText(state, offer, offer.items.length)).toBe(false);
  });
  it('indexes current EditorState edits and undo, not immutable original source', () => {
    let state = stateFor('\n@MAYA\nHi.\n\n@M\n', 1);
    state = applyEditorTransaction(
      state,
      state.tr.insertText(
        'ZOE',
        state.selection.$from.start(),
        state.selection.$from.end(),
      ),
    ).state;
    expect(
      indexEditorCompletion(state).vocabulary.characters.map(
        (entry) => entry.text,
      ),
    ).toEqual(['ZOE', 'M']);
    undo(state, (tr) => {
      state = applyEditorTransaction(state, tr).state;
    });
    expect(
      indexEditorCompletion(state).vocabulary.characters.map(
        (entry) => entry.text,
      ),
    ).toEqual(['MAYA', 'M']);
  });
  it('refuses stale index, stale version, another session, forged range and moved caret', () => {
    const source = '\n@MAYA\nHi.\n\n@MA\n';
    const state = stateFor(source, 4);
    const index = indexEditorCompletion(state);
    const offer = offerEditorCompletion(state, index)!;
    const changed = applyEditorTransaction(
      state,
      state.tr.insertText('Y'),
    ).state;
    expect(offerEditorCompletion(changed, index)).toBeNull();
    expect(acceptEditorCompletion(changed, offer, 0)).toBeNull();
    const other = stateFor(source, 4);
    expect(acceptEditorCompletion(other, offer, 0)).toBeNull();
    expect(offerEditorCompletion(other, index)).toBeNull();
    expect(acceptEditorCompletion(state, { ...offer, from: 1 }, 0)).toBeNull();
    const left = applyEditorTransaction(state, state.tr.insertText('Y')).state;
    const right = applyEditorTransaction(state, state.tr.insertText('R')).state;
    const leftIndex = indexEditorCompletion(left);
    const leftOffer = offerEditorCompletion(left, leftIndex)!;
    expect(editorVersion(left)).toBe(editorVersion(right));
    expect(offerEditorCompletion(right, leftIndex)).toBeNull();
    expect(acceptEditorCompletion(right, leftOffer, 0)).toBeNull();
    const moved = applyEditorTransaction(
      state,
      state.tr.setSelection(
        TextSelection.create(state.doc, state.selection.from - 1),
      ),
    ).state;
    expect(acceptEditorCompletion(moved, offer, 0)).toBeNull();
  });
  it.each([
    '!UPPERCASE',
    '/* SECRET */',
    '[[ Note ]]',
    'Title: Test',
    '{{ unsupported }}',
  ])('does not suggest inside %s', (text) => {
    const state = stateFor(`\n${text}\n`, 1);
    expect(
      offerEditorCompletion(state, indexEditorCompletion(state)),
    ).toBeNull();
  });
  it('does not overwrite mid-name, extensions or a nonempty selection', () => {
    const state = stateFor('\n@MAYA\nHi.\n\n@MA (V.O.)\n', 4, 4);
    expect(
      offerEditorCompletion(state, indexEditorCompletion(state)),
    ).toBeNull();
    const middle = stateFor('\n@MAYA\nHi.\n', 1, 2);
    expect(
      offerEditorCompletion(middle, indexEditorCompletion(middle)),
    ).toBeNull();
    const selection = applyEditorTransaction(
      state,
      state.tr.setSelection(
        TextSelection.create(
          state.doc,
          state.selection.from - 1,
          state.selection.from,
        ),
      ),
    ).state;
    expect(
      offerEditorCompletion(selection, indexEditorCompletion(selection)),
    ).toBeNull();
  });
});
