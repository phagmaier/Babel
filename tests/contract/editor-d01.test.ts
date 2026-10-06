import { afterEach, describe, expect, it, vi } from 'vitest';
import { undo, redo } from 'prosemirror-history';
import { TextSelection, type EditorState } from 'prosemirror-state';
import * as codec from '../../src/domain/fountainCodec';
import {
  evaluateExportAssessment,
  PUBLICATION_ASSESSMENT_IDENTITY as identity,
} from '../../src/domain/exportAssessment';
import {
  createEditorState,
  applyEditorTransaction,
} from '../../src/editor/state';
import {
  smartKeyTransaction,
  convertEditorSelection,
  type SmartKey,
} from '../../src/editor/commands';
import { captureEditor } from '../../src/editor/sourceBridge';
import { ShortcutRegistry } from '../../src/application/shortcuts';
import { executeEditorCommand } from '../../src/editor/shortcuts';
import { mountScreenplayEditor } from '../../src/editor/view';

const bytes = (s: string) => new TextEncoder().encode(s);
const text = (state: EditorState) =>
  new TextDecoder().decode(captureEditor(state).source);
const pos = (state: EditorState, row: number, offset = 0) =>
  1 +
  offset +
  state.doc.content.content
    .slice(0, row)
    .reduce((n, node) => n + node.nodeSize, 0);
function caret(state: EditorState, row: number, offset: number) {
  return applyEditorTransaction(
    state,
    state.tr.setSelection(
      TextSelection.create(state.doc, pos(state, row, offset)),
    ),
  ).state;
}
function key(state: EditorState, key: SmartKey) {
  const result = smartKeyTransaction(state, key);
  expect(result.transaction, result.reason).toBeDefined();
  const next = applyEditorTransaction(state, result.transaction!);
  expect(next.accepted).toBe(true);
  return next.state;
}
function type(state: EditorState, s: string) {
  const next = applyEditorTransaction(state, state.tr.insertText(s));
  expect(next.accepted).toBe(true);
  return next.state;
}
function replay(state: EditorState, command: typeof undo) {
  let next = state;
  expect(
    command(state, (tr) => {
      next = applyEditorTransaction(state, tr).state;
    }),
  ).toBe(true);
  return next;
}
function reopens(state: EditorState) {
  const capture = captureEditor(state);
  const opened = createEditorState(capture.source, capture.document.recovery);
  const meaning = (s: EditorState) =>
    s.doc.content.content.map((n) => [
      n.type.name,
      n.textContent,
      n.attrs.speechOf,
      n.attrs.dualWith,
    ]);
  expect(meaning(opened)).toEqual(meaning(state));
  return capture;
}
afterEach(() => vi.restoreAllMocks());

describe('AUDIT-D01 portable paragraph and speech authoring', () => {
  it('types the single-Enter scene from empty with literal separators and no blocking assessment', () => {
    // A new screenplay starts on a Scene Heading row (PILOT-2026-10-06).
    let state = createEditorState(bytes(''));
    expect(state.doc.child(0).type.name).toBe('sceneHeading');
    state = type(state, 'INT. KITCHEN - DAY');
    state = key(state, 'Enter');
    state = type(state, 'Maya enters.');
    state = key(state, 'Enter');
    state = applyEditorTransaction(
      state,
      convertEditorSelection(state, 'character').transaction!,
    ).state;
    state = type(state, 'MAYA');
    state = key(state, 'Enter');
    state = type(state, 'Hello there.');
    state = key(state, 'Enter');
    state = type(state, 'She leaves.');
    const captured = reopens(state);
    expect(text(state)).toBe(
      '.INT. KITCHEN - DAY\n\n!Maya enters.\n\n@MAYA\nHello there.\n\n!She leaves.\n',
    );
    expect(
      evaluateExportAssessment(captured.document, {
        identity,
        version: captured.version,
        sourceSha256: 'a'.repeat(64),
      }),
    ).toMatchObject({ status: 'verified', issues: [] });
  });

  it('ends an opened unforced speech before narrative, preserving its spelling and exact undo', () => {
    const original = 'MAYA\nHello.\n';
    let state = caret(createEditorState(bytes(original)), 1, 6);
    const before = captureEditor(state);
    state = key(state, 'Enter');
    expect(state.doc.content.content.map((n) => n.type.name)).toEqual([
      'character',
      'dialogue',
      'action',
      'action',
    ]);
    expect(captureEditor(state).selection!.head.sourceIndex).toBe(3);
    const after = text(state);
    state = replay(state, undo);
    expect(text(state)).toBe(original);
    expect(captureEditor(state).selection).toEqual(before.selection);
    state = replay(state, redo);
    expect(text(state)).toBe(after);
    state = type(state, 'She leaves.');
    expect(text(state)).toBe('MAYA\nHello.\n\n!She leaves.\n');
    reopens(state);
  });

  it('Enter inside a continuing speech then typing stays attached and capturable', () => {
    let state = caret(
      createEditorState(bytes('MAYA\nFirst.\nSecond.\n')),
      1,
      6,
    );
    state = type(key(state, 'Enter'), 'Inserted.');
    expect(text(state)).toBe('MAYA\nFirst.\nInserted.\nSecond.\n');
    expect(state.doc.child(2).attrs.speechOf).toBe(state.doc.child(0).attrs.id);
    reopens(state);
  });

  for (const direction of ['Backspace', 'Delete'] as const)
    it(`${direction} reverses the blank separator and empty Action as one event`, () => {
      let state = caret(createEditorState(bytes('!Bell.\n')), 0, 5);
      state = key(state, 'Enter');
      const after = captureEditor(state);
      if (direction === 'Delete') state = caret(state, 0, 5);
      state = key(state, direction);
      expect(text(state)).toBe('!Bell.\n');
      expect(state.doc.childCount).toBe(1);
      state = replay(state, undo);
      expect(text(state)).toBe(new TextDecoder().decode(after.source));
      state = replay(state, redo);
      expect(text(state)).toBe('!Bell.\n');
    });

  it('joins two Action paragraphs across their separator with marks and undo', () => {
    let state = caret(
      createEditorState(bytes('!**Bell.**\n\n! Rings.\n')),
      2,
      0,
    );
    state = key(state, 'Backspace');
    expect(text(state)).toBe('!**Bell.** Rings.\n');
    expect(state.doc.child(0).child(0).marks[0]!.type.name).toBe('bold');
    state = replay(state, undo);
    expect(text(state)).toBe('!**Bell.**\n\n! Rings.\n');
  });

  for (const [original, row, offset, expected] of [
    ['!**AlphaBeta**\n', 0, 5, '!**Alpha**\n!**Beta**\n'],
    ['MAYA\nAlphaBeta\n', 1, 5, 'MAYA\nAlpha\nBeta\n'],
    ['MAYA\nAlpha\n', 1, 5, 'MAYA\nAlpha\n  \n'],
    ['MAYA\nAlpha\n', 1, 0, 'MAYA\n  \nAlpha\n'],
  ] as const)
    it(`Shift+Enter ${JSON.stringify(original)} at ${offset} is a same-kind hard break`, () => {
      const spy = vi.spyOn(codec, 'replaceLineWithBreaks');
      let state = caret(createEditorState(bytes(original)), row, offset);
      const before = captureEditor(state);
      state = key(state, 'ShiftEnter');
      expect(spy).not.toHaveBeenCalled(); // deferred capture, never on a key
      expect(state.doc.child(row + 1).type).toBe(state.doc.child(row).type);
      expect(text(state)).toBe(expected);
      expect(spy).toHaveBeenCalled();
      reopens(state);
      const after = captureEditor(state);
      state = replay(state, undo);
      expect(text(state)).toBe(original);
      expect(captureEditor(state).selection).toEqual(before.selection);
      state = replay(state, redo);
      expect(text(state)).toBe(expected);
      expect(captureEditor(state).selection).toEqual(after.selection);
    });

  for (const [original, row, offset] of [
    ['.INT. ROOM - DAY\n', 0, 5],
    ['MAYA\n(quietly)\nHello.\n', 1, 4],
    ['MAYA\nHello.(quietly)\n', 1, 6],
    ['[[unclosed\n', 0, 3],
  ] as const)
    it(`refuses unproven hard break ${JSON.stringify(original)}`, () => {
      const state = caret(createEditorState(bytes(original)), row, offset);
      const result = smartKeyTransaction(state, 'ShiftEnter');
      expect(result.transaction).toBeUndefined();
      expect(result.reason).toBeTruthy();
      expect(text(state)).toBe(original);
    });

  it('toggles dual dialogue through the production command, capture, undo and redo', () => {
    const original =
      '!Before.\r\n\r\nMAYA\r\n**One.**\r\n\r\nJON\r\nTwo.\r\n\r\n!After.\r\n';
    const spy = vi.spyOn(codec, 'setDualDialogue');
    const view = mountScreenplayEditor(
      document.createElement('div'),
      caret(createEditorState(bytes(original)), 6, 2),
    );
    try {
      const before = captureEditor(view.state);
      expect(executeEditorCommand(view, 'dialogue.dual')).toBe(true);
      expect(spy).not.toHaveBeenCalled();
      const after = reopens(view.state);
      expect(spy).toHaveBeenCalled();
      expect(text(view.state)).toBe(original.replace('JON\r\n', '@JON ^\r\n'));
      expect(after.selection!.head).toMatchObject({
        ...before.selection!.head,
        byteOffset: before.selection!.head.byteOffset + 3,
      });
      expect(after.selection!.anchor).toEqual(after.selection!.head);
      expect(view.state.doc.child(5).attrs.dualWith).toBe(
        view.state.doc.child(2).attrs.id,
      );
      expect(executeEditorCommand(view, 'undo')).toBe(true);
      expect(text(view.state)).toBe(original);
      expect(executeEditorCommand(view, 'redo')).toBe(true);
      expect(text(view.state)).toContain('@JON ^\r\n');
      expect(executeEditorCommand(view, 'dialogue.dual')).toBe(true);
      reopens(view.state);
      expect(text(view.state)).not.toContain(' ^');
    } finally {
      view.destroy();
    }
  });

  for (const [original, row] of [
    ['MAYA\nOne.\n\nJON\n', 3],
    ['MAYA\nOne.\n\n!Between.\n\nJON\nTwo.\n', 6],
    ['MAYA\nOne.\n\nJON ^\nTwo.\n\nSAM\nThree.\n', 7],
    ['[[unclosed\n', 0],
  ] as const)
    it(`refuses unsafe dual toggle ${JSON.stringify(original)}`, () => {
      const refused = vi.fn();
      const view = mountScreenplayEditor(
        document.createElement('div'),
        caret(createEditorState(bytes(original)), row, 0),
      );
      try {
        const before = view.state;
        expect(executeEditorCommand(view, 'dialogue.dual', refused)).toBe(true);
        expect(refused).toHaveBeenCalled();
        expect(view.state).toBe(before);
        expect(text(view.state)).toBe(original);
      } finally {
        view.destroy();
      }
    });

  it('routes a remapped dual command from the keyboard with Undo', () => {
    const registry = new ShortcutRegistry('other', window.localStorage);
    expect(registry.remap('dialogue.dual', 'Mod+Shift+D').ok).toBe(true);
    const view = mountScreenplayEditor(
      document.createElement('div'),
      caret(createEditorState(bytes('MAYA\nOne.\n\nJON\nTwo.\n')), 4, 4),
      { shortcuts: registry },
    );
    try {
      const event = new KeyboardEvent('keydown', {
        key: 'D',
        ctrlKey: true,
        shiftKey: true,
      });
      expect(view.someProp('handleKeyDown')!(view, event)).toBe(true);
      expect(text(view.state)).toContain('@JON ^');
      expect(executeEditorCommand(view, 'undo')).toBe(true);
      expect(text(view.state)).toBe('MAYA\nOne.\n\nJON\nTwo.\n');
    } finally {
      view.destroy();
    }
  });

  it('captures an empty virtual cue without fabricating a source row', () => {
    const initial = createEditorState(bytes(''));
    const state = applyEditorTransaction(
      initial,
      convertEditorSelection(initial, 'character').transaction!,
    ).state;
    expect(text(state)).toBe('');
    expect(
      smartKeyTransaction(state, 'ShiftEnter').transaction,
    ).toBeUndefined();
  });

  it('composition and read-only views retain content for the dual command', () => {
    const original = 'MAYA\nOne.\n\nJON\nTwo.\n';
    const refused = vi.fn();
    const view = mountScreenplayEditor(
      document.createElement('div'),
      caret(createEditorState(bytes(original)), 4, 0),
      { canEdit: () => false, refused },
    );
    try {
      expect(executeEditorCommand(view, 'dialogue.dual', refused)).toBe(true);
      expect(text(view.state)).toBe(original);
      expect(refused).toHaveBeenCalled();
      vi.spyOn(view, 'composing', 'get').mockReturnValue(true);
      expect(executeEditorCommand(view, 'dialogue.dual')).toBe(false);
      expect(text(view.state)).toBe(original);
    } finally {
      view.destroy();
    }
  });
});
