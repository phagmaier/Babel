import { describe, expect, it } from 'vitest';
import { redo, undo } from 'prosemirror-history';
import { TextSelection, type EditorState } from 'prosemirror-state';
import {
  createEditorState,
  applyEditorTransaction,
  editorVersion,
} from '../../src/editor/state';
import {
  smartKeyTransaction,
  convertEditorSelection,
  type SmartKey,
} from '../../src/editor/commands';
import { captureEditor, copyEditorDraft } from '../../src/editor/sourceBridge';
import { mountScreenplayEditor } from '../../src/editor/view';
import { parseFountain, replaceLine } from '../../src/domain/fountainCodec';

const bytes = (source: string) => new TextEncoder().encode(source);
const source = (state: EditorState) =>
  new TextDecoder('utf-8', { ignoreBOM: true }).decode(
    captureEditor(state).source,
  );
function pos(state: EditorState, index: number, offset = 0) {
  let result = 1 + offset;
  for (let i = 0; i < index; i++) result += state.doc.child(i).nodeSize;
  return result;
}
function select(
  state: EditorState,
  index: number,
  offset: number,
  endIndex = index,
  endOffset = offset,
) {
  return applyEditorTransaction(
    state,
    state.tr.setSelection(
      TextSelection.create(
        state.doc,
        pos(state, index, offset),
        pos(state, endIndex, endOffset),
      ),
    ),
  ).state;
}
function run(state: EditorState, key: SmartKey) {
  const result = smartKeyTransaction(state, key);
  expect(result.handled).toBe(true);
  expect(result.transaction, result.reason).toBeDefined();
  const applied = applyEditorTransaction(state, result.transaction!);
  expect(applied.accepted).toBe(true);
  return applied.state;
}
function history(state: EditorState, action: typeof undo) {
  let next = state;
  expect(
    action(state, (tr) => {
      next = applyEditorTransaction(state, tr).state;
    }),
  ).toBe(true);
  return next;
}

describe('M3-05 structural key matrix (production state and codec)', () => {
  for (const [kind, original, index, expectedKind] of [
    ['sceneHeading', '\n.INT. ROOM - DAY\n', 1, 'action'],
    ['action', '\n!A bell.\n', 1, 'action'],
    ['character', '\n@MAYA\n', 1, 'dialogue'],
    ['parenthetical', '\n@MAYA\n(quietly)\n', 2, 'dialogue'],
    ['dialogue', '\n@MAYA\nSignal.\n', 2, 'action'],
    ['transition', '\n>CUT TO:\n', 1, 'action'],
    ['lyrics', '\n~River.\n', 1, 'lyrics'],
    ['centered', '\n>Center<\n', 1, 'action'],
    ['section', '\n## Act\n', 1, 'action'],
    ['synopsis', '\n= Beat\n', 1, 'action'],
  ] as const)
    it(`${kind} end Enter creates ${expectedKind}, captures source and restores source/caret through undo`, () => {
      let state = createEditorState(bytes(original));
      expect(state.doc.child(index).type.name).toBe(kind);
      state = select(state, index, state.doc.child(index).textContent.length);
      const before = captureEditor(state);
      state = run(state, 'Enter');
      const newIndex = index + (expectedKind === 'action' ? 2 : 1);
      if (expectedKind === 'action')
        expect(state.doc.child(index + 1).textContent).toBe('');
      expect(state.doc.child(newIndex).type.name).toBe(expectedKind);
      if (expectedKind === 'dialogue') {
        const cueId =
          kind === 'character'
            ? state.doc.child(index).attrs.id
            : state.doc.child(index - 1).attrs.id;
        expect(state.doc.child(newIndex).attrs.speechOf).toBe(cueId);
      }
      expect(captureEditor(state).selection!.head.sourceIndex).toBe(newIndex);
      expect(captureEditor(state).selection!.head.utf16Offset).toBe(0);
      const after = captureEditor(state);
      const expectedSource =
        original +
        (expectedKind === 'action'
          ? '\n\n'
          : expectedKind === 'lyrics'
            ? '~\n'
            : '\n');
      expect(new TextDecoder().decode(after.source)).toBe(expectedSource);
      expect(after.document.lines[index]!.id).toBe(
        before.document.lines[index]!.id,
      );
      state = history(state, undo);
      expect(source(state)).toBe(original);
      expect(captureEditor(state).selection).toEqual(before.selection);
      expect(editorVersion(state)).toBeGreaterThan(after.version);
      state = history(state, redo);
      expect(source(state)).toBe(new TextDecoder().decode(after.source));
      expect(captureEditor(state).selection).toEqual(after.selection);
    });

  it('explicit Shot remains on its authored row while Enter starts ordinary Action', () => {
    let document = parseFountain(bytes('\n!A still frame.\n'));
    document = replaceLine(document, 1, {
      kind: 'action',
      text: 'A still frame.',
      actionSubtype: 'shot',
    });
    let state = createEditorState(document.bytes, document.recovery);
    expect(state.doc.child(1).attrs.actionSubtype).toBe('shot');
    state = select(state, 1, state.doc.child(1).textContent.length);
    state = run(state, 'Enter');
    expect(state.doc.child(1).attrs.actionSubtype).toBe('shot');
    expect(state.doc.child(2).textContent).toBe('');
    expect(state.doc.child(2).attrs.actionSubtype).toBeNull();
    expect(state.doc.child(3).attrs.actionSubtype).toBeNull();
    expect(state.doc.child(3).type.name).toBe('action');
    state = history(state, undo);
    expect(state.doc.child(1).attrs.actionSubtype).toBe('shot');
    state = select(state, 1, 0);
    state = run(state, 'Enter');
    expect(state.doc.child(1).attrs.actionSubtype).toBeNull();
    expect(state.doc.child(2).attrs.actionSubtype).toBe('shot');
  });

  it('splitting a numbered heading retains its number only on the original row', () => {
    let state = createEditorState(bytes('\nINT. ROOM - DAY #12#\n'));
    state = select(state, 1, 5);
    state = run(state, 'Enter');
    expect(state.doc.child(1).attrs.sceneNumber).toBe('12');
    expect(state.doc.child(2).attrs.sceneNumber).toBeNull();
    expect(
      state.doc.child(1).textContent + state.doc.child(2).textContent,
    ).toBe('INT. ROOM - DAY');
    state = history(state, undo);
    expect(source(state)).toBe('\nINT. ROOM - DAY #12#\n');
  });

  it('middle Character and Parenthetical splits retain every character, with a copy route if source grammar refuses', () => {
    for (const [original, index, offset, kind] of [
      ['\n@MAYA\n', 1, 2, 'character'],
      ['\n@MAYA\n(quietly)\n', 2, 3, 'parenthetical'],
    ] as const) {
      let state = createEditorState(bytes(original));
      const text = state.doc.child(index).textContent;
      state = select(state, index, offset);
      state = run(state, 'Enter');
      expect(state.doc.child(index).type.name).toBe(kind);
      expect(state.doc.child(index + 1).type.name).toBe(kind);
      expect(
        state.doc.child(index).textContent +
          state.doc.child(index + 1).textContent,
      ).toBe(text);
      if (kind === 'character') {
        expect(source(state)).toBe('\n@MA\n@YA\n');
      } else {
        expect(() => captureEditor(state)).toThrow();
        const copy = copyEditorDraft(state);
        expect(
          copy.rows[index]!.runs.map((run) => run.text).join('') +
            copy.rows[index + 1]!.runs.map((run) => run.text).join(''),
        ).toBe(text);
        expect(new TextDecoder().decode(copy.originalSource)).toBe(original);
      }
      state = history(state, undo);
      expect(source(state)).toBe(original);
    }
  });

  it('start/middle/empty and selection Enter preserve content, type, source and one undo step', () => {
    for (const offset of [0, 3, 7]) {
      let state = createEditorState(bytes('\n!A bell.\n'));
      state = select(state, 1, offset);
      const before = captureEditor(state);
      state = run(state, 'Enter');
      expect(state.doc.child(1).type.name).toBe('action');
      expect(state.doc.child(2).type.name).toBe('action');
      expect(
        state.doc.child(1).textContent + state.doc.child(2).textContent,
      ).toBe('A bell.');
      expect(source(state)).toContain(state.doc.child(1).textContent);
      expect(source(state)).toContain(state.doc.child(2).textContent);
      state = history(state, undo);
      expect(source(state)).toBe('\n!A bell.\n');
      expect(captureEditor(state).selection).toEqual(before.selection);
    }
    let selected = createEditorState(bytes('\n!A bell.\n'));
    selected = select(selected, 1, 2, 1, 5);
    const originalSelection = captureEditor(selected).selection;
    selected = run(selected, 'Enter');
    expect(
      selected.doc.child(1).textContent + selected.doc.child(2).textContent,
    ).toBe('A l.');
    selected = history(selected, undo);
    expect(source(selected)).toBe('\n!A bell.\n');
    expect(captureEditor(selected).selection).toEqual(originalSelection);
  });

  for (const [kind, original, index, expected] of [
    ['character', '\n@\n', 1, '\n!\n'],
    ['dialogue', '\n@MAYA\n\n', 2, '\n@MAYA\n\n'],
    ['parenthetical', '\n@MAYA\n\n', 2, '\n@MAYA\n\n'],
  ] as const)
    it(`empty ${kind} exits to Action`, () => {
      let document = parseFountain(bytes(original));
      document = replaceLine(document, index, { kind, text: '' });
      let state = createEditorState(document.bytes, document.recovery);
      expect(state.doc.child(index).type.name).toBe(kind);
      state = select(state, index, 0);
      state = run(state, 'Enter');
      expect(state.doc.child(index).type.name).toBe('action');
      expect(source(state)).toBe(expected);
      state = history(state, undo);
      expect(state.doc.child(index).type.name).toBe(kind);
    });

  it('repeated empty Action Enter keeps intentional physical blanks and undo', () => {
    let state = createEditorState(bytes('\n\n'));
    state = select(state, 1, 0);
    const before = source(state);
    state = run(state, 'Enter');
    expect(state.doc.childCount).toBe(3);
    expect(source(state)).toBe('\n\n\n');
    state = history(state, undo);
    expect(source(state)).toBe(before);
  });

  it('undo never recycles a newly allocated structural row ID', () => {
    let state = createEditorState(bytes('\n!A bell.\n'));
    state = select(state, 1, 7);
    state = run(state, 'Enter');
    const firstId = state.doc.child(2).attrs.id;
    state = history(state, undo);
    state = run(state, 'Enter');
    expect(state.doc.child(2).attrs.id).not.toBe(firstId);
    expect(captureEditor(state).document.lines[2]!.id).toBe(
      state.doc.child(2).attrs.id,
    );
  });

  it('empty Lyrics exits to Action while preserving its original source on undo', () => {
    let state = createEditorState(bytes('\n~\n'));
    expect(state.doc.child(1).type.name).toBe('lyrics');
    state = select(state, 1, 0);
    state = run(state, 'Enter');
    expect(state.doc.child(1).type.name).toBe('action');
    state = history(state, undo);
    expect(source(state)).toBe('\n~\n');
  });

  it('boundary joins retain Unicode text and undo; cue/dialogue join refuses without mutation', () => {
    let state = createEditorState(bytes('\n!Zoë\n! waits.\n'));
    state = select(state, 2, 0);
    const before = captureEditor(state);
    state = run(state, 'Backspace');
    expect(state.doc.child(1).textContent).toBe('Zoë waits.');
    expect(source(state)).toContain('Zoë waits.');
    state = history(state, undo);
    expect(source(state)).toBe('\n!Zoë\n! waits.\n');
    expect(captureEditor(state).selection).toEqual(before.selection);
    state = createEditorState(bytes('\n@MAYA\nSignal.\n'));
    state = select(state, 2, 0);
    const refusal = smartKeyTransaction(state, 'Backspace');
    expect(refusal).toMatchObject({ handled: true });
    expect(refusal.transaction).toBeUndefined();
    expect(source(state)).toBe('\n@MAYA\nSignal.\n');
    state = createEditorState(bytes('\n@MAYA\n(quietly)\nSignal.\n'));
    state = select(state, 2, 0);
    expect(smartKeyTransaction(state, 'Backspace').transaction).toBeUndefined();
    expect(source(state)).toBe('\n@MAYA\n(quietly)\nSignal.\n');
  });

  it('dialogue continuation joins inside the same speaker group with undo', () => {
    let state = createEditorState(bytes('\n@MAYA\nFirst.\nSecond.\n'));
    expect(state.doc.child(2).type.name).toBe('dialogue');
    expect(state.doc.child(3).type.name).toBe('dialogue');
    state = select(state, 3, 0);
    const before = captureEditor(state).selection;
    state = run(state, 'Backspace');
    expect(state.doc.child(2).type.name).toBe('dialogue');
    expect(state.doc.child(2).attrs.speechOf).toBe(state.doc.child(1).attrs.id);
    expect(source(state)).toBe('\n@MAYA\nFirst.Second.\n');
    state = history(state, undo);
    expect(source(state)).toBe('\n@MAYA\nFirst.\nSecond.\n');
    expect(captureEditor(state).selection).toEqual(before);
  });

  it('Delete joins unlike editable rows as Action; cross-row deletion is one undo step', () => {
    let state = createEditorState(bytes('\n!A bell.\n>CUT TO:\n'));
    state = select(state, 1, 7);
    const before = captureEditor(state);
    state = run(state, 'Delete');
    expect(state.doc.child(1).type.name).toBe('action');
    expect(state.doc.child(1).textContent).toBe('A bell.CUT TO:');
    expect(source(state)).toBe('\n!A bell.CUT TO:\n');
    state = history(state, undo);
    expect(source(state)).toBe('\n!A bell.\n>CUT TO:\n');
    expect(captureEditor(state).selection).toEqual(before.selection);

    state = createEditorState(bytes('\n!Alpha\n!Beta\n'));
    state = select(state, 1, 2, 2, 2);
    const selected = captureEditor(state).selection;
    state = run(state, 'Backspace');
    expect(state.doc.child(1).textContent).toBe('Alta');
    expect(source(state)).toBe('\n!Alta\n');
    state = history(state, undo);
    expect(source(state)).toBe('\n!Alpha\n!Beta\n');
    expect(captureEditor(state).selection).toEqual(selected);
  });

  it('unsupported hard break refuses and explicit type conversion preserves text/undo', () => {
    let state = createEditorState(bytes('\n!A bell.\n'));
    expect(
      smartKeyTransaction(
        select(createEditorState(bytes('\n.INT. ROOM - DAY\n')), 1, 5),
        'ShiftEnter',
      ),
    ).toMatchObject({
      handled: true,
      reason: expect.any(String),
    });
    state = select(state, 1, 3);
    const result = convertEditorSelection(state, 'sceneHeading');
    expect(result.transaction).toBeDefined();
    state = applyEditorTransaction(state, result.transaction!).state;
    expect(state.doc.child(1).type.name).toBe('sceneHeading');
    expect(state.doc.child(1).textContent).toBe('A bell.');
    expect(source(state)).toContain('.A bell.');
    state = history(state, undo);
    expect(source(state)).toBe('\n!A bell.\n');
    const speech = convertEditorSelection(state, 'dialogue');
    expect(speech.transaction).toBeUndefined();
    expect(speech.reason).toMatch(/speaker/);
    let grouped = createEditorState(bytes('\n@MAYA\nSignal.\n'));
    grouped = select(grouped, 1, 2);
    const detached = convertEditorSelection(grouped, 'action');
    expect(detached.transaction).toBeUndefined();
    expect(detached.reason).toMatch(/speaker/);
  });

  it('page break creates Action; raw and unclosed note Enter refuse without changing bytes', () => {
    let state = createEditorState(bytes('\n===\n'));
    expect(state.doc.child(1).type.name).toBe('pageBreak');
    state = select(state, 1, state.doc.child(1).textContent.length);
    state = run(state, 'Enter');
    expect(state.doc.child(2).type.name).toBe('action');
    expect(state.doc.child(3).type.name).toBe('action');
    expect(captureEditor(state).selection!.head.sourceIndex).toBe(3);
    expect(source(state)).toBe('\n===\n\n\n');
    for (const original of ['\n[[Unclosed\n', '\n{{raw}}\n']) {
      let protectedState = createEditorState(bytes(original));
      protectedState = select(protectedState, 1, 0);
      const before = captureEditor(protectedState);
      const result = smartKeyTransaction(protectedState, 'Enter');
      expect(result).toMatchObject({
        handled: true,
        reason: expect.any(String),
      });
      expect(result.transaction).toBeUndefined();
      expect(captureEditor(protectedState)).toEqual(before);
    }
  });

  it('a closed note splits within its complete region with exact source and structural undo', () => {
    const original = '\n[[A quiet note]]\n';
    let state = createEditorState(bytes(original));
    expect(state.doc.child(1).attrs.protected).toBe(false);
    state = select(state, 1, 7);
    const before = captureEditor(state);
    state = run(state, 'Enter');
    expect(state.doc.child(1).type.name).toBe('note');
    expect(state.doc.child(2).type.name).toBe('note');
    expect(source(state)).toBe('\n[[A qui\net note]]\n');
    expect(captureEditor(state).document.lines[2]!.id).toBe(
      state.doc.child(2).attrs.id,
    );
    expect(captureEditor(state).selection!.head.sourceIndex).toBe(2);
    state = history(state, undo);
    expect(source(state)).toBe(original);
    expect(captureEditor(state).selection).toEqual(before.selection);
  });

  it('note splitting inherits BOM/CRLF and refuses delimiter-boundary splits', () => {
    const original = '\ufeff\r\n[[A quiet note]]\r\n';
    let state = createEditorState(bytes(original));
    state = select(state, 1, 7);
    state = run(state, 'Enter');
    expect(source(state)).toBe('\ufeff\r\n[[A qui\r\net note]]\r\n');
    state = history(state, undo);
    expect(source(state)).toBe(original);
    state = select(state, 1, 1);
    const result = smartKeyTransaction(state, 'Enter');
    expect(result).toMatchObject({ handled: true, reason: expect.any(String) });
    expect(result.transaction).toBeUndefined();
  });

  it('Enter inside a multiline Note inserts a note line without changing its opener or closer', () => {
    const original = '\n[[First\nsecond line\nLast]]\n';
    let state = createEditorState(bytes(original));
    expect(state.doc.child(2).type.name).toBe('note');
    state = select(state, 2, 6);
    const before = captureEditor(state).selection;
    state = run(state, 'Enter');
    expect(source(state)).toBe('\n[[First\nsecond\n line\nLast]]\n');
    expect(state.doc.child(3).type.name).toBe('note');
    state = history(state, undo);
    expect(source(state)).toBe(original);
    expect(captureEditor(state).selection).toEqual(before);
  });

  it('literal note markup remains byte-identical on no-op capture', () => {
    const original = '\n[[A **quiet** note]]\n';
    const state = createEditorState(bytes(original));
    expect(state.doc.child(1).textContent).toBe('[[A **quiet** note]]');
    expect(source(state)).toBe(original);
  });

  it('insertion before a heading keeps its exact authored spelling, BOM, CRLF and IDs', () => {
    const original = '\ufeff\r\nINT. ROOM - DAY\r\n';
    let state = createEditorState(bytes(original));
    const headingId = state.doc.child(1).attrs.id;
    state = select(state, 1, 0);
    state = run(state, 'Enter');
    expect(state.doc.child(2).attrs.id).toBe(headingId);
    expect(source(state)).toBe('\ufeff\r\n\r\nINT. ROOM - DAY\r\n');
    state = history(state, undo);
    expect(source(state)).toBe(original);
  });

  it('a no-final-newline append owns the preceding ending and restores it on undo', () => {
    let state = createEditorState(bytes('!A bell.'));
    state = select(state, 0, 7);
    state = run(state, 'Enter');
    expect(source(state)).toBe('!A bell.\n\n\n');
    state = history(state, undo);
    expect(source(state)).toBe('!A bell.');
  });

  it('a later text edit after a structural insert preserves intervening protected bytes', () => {
    let state = createEditorState(bytes('\n!First.\n{{raw}}\n\n!Last.\n'));
    state = select(state, 1, 6);
    state = run(state, 'Enter');
    state = select(state, 6, 5);
    state = applyEditorTransaction(state, state.tr.insertText(' X')).state;
    expect(source(state)).toBe('\n!First.\n\n\n{{raw}}\n\n!Last. X\n');
  });

  it('parenthetical Enter moves into an already attached dialogue without rewriting source', () => {
    const original = '\n@MAYA\n(quietly)\nSignal.\n';
    let state = createEditorState(bytes(original));
    state = select(state, 2, 9);
    state = run(state, 'Enter');
    expect(state.doc.childCount).toBe(4);
    expect(captureEditor(state).selection!.head.sourceIndex).toBe(3);
    expect(source(state)).toBe(original);
  });

  it('compositionend followed by noncomposing Enter consumes one key sequence', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const view = mountScreenplayEditor(
      host,
      createEditorState(bytes('\n!A bell.\n')),
    );
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(view.state.doc, pos(view.state, 1, 7)),
      ),
    );
    const dom = view.someProp('handleDOMEvents')!;
    const key = view.someProp('handleKeyDown')!;
    dom.compositionstart!(view, new CompositionEvent('compositionstart'));
    expect(
      key(
        view,
        new KeyboardEvent('keydown', { key: 'Enter', isComposing: true }),
      ),
    ).toBe(false);
    expect(source(view.state)).toBe('\n!A bell.\n');
    dom.compositionend!(view, new CompositionEvent('compositionend'));
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    expect(key(view, event)).toBe(true);
    expect(source(view.state)).toBe('\n!A bell.\n');
    dom.keyup!(view, new KeyboardEvent('keyup', { key: 'Enter' }));
    expect(key(view, event)).toBe(true);
    expect(view.state.doc.childCount).toBe(4);
    view.destroy();
    host.remove();
  });
});

it('skips a reserved native version without changing manuscript, selection or Undo', async () => {
  const { advanceEditorVersion } = await import('../../src/editor/state');
  const { undoDepth } = await import('prosemirror-history');
  const state = createEditorState(bytes('!Retained draft.\r\n'));
  const next = applyEditorTransaction(
    state,
    advanceEditorVersion(state, 9),
  ).state;
  expect(editorVersion(next)).toBe(9);
  expect(next.doc).toBe(state.doc);
  expect(next.selection.eq(state.selection)).toBe(true);
  expect(undoDepth(next)).toBe(undoDepth(state));
  expect(source(next)).toBe('!Retained draft.\r\n');
});
