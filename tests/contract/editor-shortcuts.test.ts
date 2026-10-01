import { describe, expect, it, vi } from 'vitest';
import { redo, undo } from 'prosemirror-history';
import { TextSelection, type EditorState } from 'prosemirror-state';
import {
  createEditorState,
  applyEditorTransaction,
} from '../../src/editor/state';
import {
  smartKeyTransaction,
  convertEditorSelection,
  selectionElement,
  cycleEditorElement,
} from '../../src/editor/commands';
import { mountScreenplayEditor } from '../../src/editor/view';
import { parseFountain, replaceLine } from '../../src/domain/fountainCodec';
import { captureEditor } from '../../src/editor/sourceBridge';
import {
  ShortcutRegistry,
  elementChoices,
  eventBinding,
  shortcutCommands,
  shortcutStorageKey,
  type ShortcutStorage,
} from '../../src/application/shortcuts';
const bytes = (text: string) => new TextEncoder().encode(text);
const source = (state: EditorState) =>
  new TextDecoder('utf-8', { ignoreBOM: true }).decode(
    captureEditor(state).source,
  );
function position(state: EditorState, row: number, offset = 0) {
  return (
    1 +
    state.doc.content.content
      .slice(0, row)
      .reduce((n, node) => n + node.nodeSize, 0) +
    offset
  );
}
function select(
  state: EditorState,
  row: number,
  offset = 0,
  last = row,
  end = offset,
) {
  return applyEditorTransaction(
    state,
    state.tr.setSelection(
      TextSelection.create(
        state.doc,
        position(state, row, offset),
        position(state, last, end),
      ),
    ),
  ).state;
}
function convert(state: EditorState, kind: string) {
  const result = convertEditorSelection(state, kind);
  expect(result.transaction, result.reason).toBeDefined();
  const applied = applyEditorTransaction(state, result.transaction!);
  expect(applied.accepted).toBe(true);
  return applied.state;
}
function history(state: EditorState, command: typeof undo) {
  let next = state;
  expect(
    command(state, (tr) => {
      next = applyEditorTransaction(state, tr).state;
    }),
  ).toBe(true);
  return next;
}
function storage(): ShortcutStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}
describe('M3-06 picker conversions and source boundaries', () => {
  for (const [kind, original, row, expected] of [
    ['sceneHeading', '\n!A bell.\n', 1, '\n.A bell.\n'],
    ['action', '\n~A bell.\n', 1, '\n!A bell.\n'],
    ['character', '\n!A bell.\n', 1, '\n@A bell.\n'],
    ['dialogue', '\n@MAYA\n(quietly)\n', 2, null],
    ['parenthetical', '\n@MAYA\nSignal.\n', 2, null],
    ['transition', '\n!A bell.\n', 1, '\n>A bell.\n'],
    ['shot', '\n!A bell.\n', 1, '\n!A bell.\n'],
    ['lyrics', '\n!A bell.\n', 1, '\n~A bell.\n'],
    ['centered', '\n!A bell.\n', 1, '\n>A bell.<\n'],
    ['section', '\n!A bell.\n', 1, '\n# A bell.\n'],
    ['synopsis', '\n!A bell.\n', 1, '\n= A bell.\n'],
    ['note', '\n!A bell.\n', 1, '\n[[A bell.]]\n'],
    ['boneyard', '\n!A bell.\n', 1, '\n/*A bell.*/\n'],
    ['pageBreak', '\n\n', 1, '\n===\n'],
  ] as const)
    it(`${kind} is reachable with text, ID, selection and undo preservation or an explicit ambiguity refusal`, () => {
      const initial = createEditorState(bytes(original));
      let state = select(
        initial,
        row,
        0,
        row,
        Math.min(3, initial.doc.child(row).textContent.length),
      );
      const before = state;
      const result = convertEditorSelection(state, kind);
      if (expected === null) {
        expect(result.reason).toMatch(/wrapped/i);
        expect(state).toBe(before);
        return;
      }
      state = convert(state, kind);
      expect(source(state)).toBe(expected);
      expect(state.doc.child(row).attrs.id).toBe(
        before.doc.child(row).attrs.id,
      );
      if (kind !== 'pageBreak')
        expect(state.doc.child(row).textContent).toContain(
          before.doc.child(row).textContent,
        );
      expect(state.selection.anchor).toBe(
        before.selection.anchor +
          (kind === 'note' || kind === 'boneyard' ? 2 : 0),
      );
      const captured = captureEditor(state);
      state = history(state, undo);
      expect(source(state)).toBe(original);
      expect(state.selection.eq(before.selection)).toBe(true);
      state = history(state, redo);
      expect(captureEditor(state).source).toEqual(captured.source);
    });
  it('parenthetical direct conversion is reachable from attached empty speech with recovery intent', () => {
    const doc = replaceLine(parseFountain(bytes('\n@MAYA\n\n')), 2, {
      kind: 'dialogue',
      text: '',
    });
    let state = select(createEditorState(doc.bytes, doc.recovery), 2);
    state = convert(state, 'parenthetical');
    expect(selectionElement(state)).toBe('parenthetical');
    expect(state.doc.child(2).attrs.speechOf).toBe(state.doc.child(1).attrs.id);
    expect(source(state)).toBe('\n@MAYA\n\n');
    state = convert(state, 'dialogue');
    expect(selectionElement(state)).toBe('dialogue');
    expect(source(state)).toBe('\n@MAYA\n\n');
  });
  it('Mixed conversion retains backwards multirow selection, styles, neighboring source and one undo step', () => {
    const original = '\ufeff\r\n!A **bell**.\r\n~River.\r\n\r\n[[retain]]\r\n';
    let state = createEditorState(bytes(original));
    state = select(state, 2, 6, 1, 2);
    expect(selectionElement(state)).toBe('mixed');
    const before = state;
    state = convert(state, 'action');
    expect(state.selection.eq(before.selection)).toBe(true);
    expect(state.doc.child(1).content.eq(before.doc.child(1).content)).toBe(
      true,
    );
    expect(source(state)).toBe(
      '\ufeff\r\n!A **bell**.\r\n!River.\r\n\r\n[[retain]]\r\n',
    );
    expect(source(history(state, undo))).toBe(original);
  });
  it('exclusive row-start endpoint does not convert the next row', () => {
    let state = createEditorState(bytes('\n!First.\n~Second.\n'));
    state = select(state, 1, 0, 2, 0);
    expect(selectionElement(state)).toBe('action');
    state = convert(state, 'sceneHeading');
    expect(state.doc.child(2).type.name).toBe('lyrics');
    expect(source(state)).toBe('\n.First.\n~Second.\n');
  });
  it('Shot metadata is recoverable, Action clears it, and no-op choice creates no undo', () => {
    let state = select(createEditorState(bytes('\n!A bell.\n')), 1);
    expect(convertEditorSelection(state, 'action').transaction).toBeUndefined();
    state = convert(state, 'shot');
    expect(selectionElement(state)).toBe('shot');
    const capture = captureEditor(state);
    expect(
      selectionElement(
        select(createEditorState(capture.source, capture.document.recovery), 1),
      ),
    ).toBe('shot');
    state = convert(state, 'action');
    expect(
      captureEditor(state).document.lines[1]!.actionSubtype,
    ).toBeUndefined();
  });
  it('multiline hidden conversion retains all literal text, byte convention and undo', () => {
    const original = '\ufeff\r\n!First.\r\n!Second.\r\n';
    for (const kind of ['note', 'boneyard']) {
      let state = select(createEditorState(bytes(original)), 1, 0, 2, 7);
      const before = state;
      state = convert(state, kind);
      expect(source(state)).toBe(
        kind === 'note'
          ? '\ufeff\r\n[[First.\r\nSecond.]]\r\n'
          : '\ufeff\r\n/*First.\r\nSecond.*/\r\n',
      );
      expect(state.doc.childCount).toBe(before.doc.childCount);
      expect(source(history(state, undo))).toBe(original);
    }
  });
  it('empty Page Break choice preserve selected row endpoints as markers are added', () => {
    let state = select(createEditorState(bytes('\n\n\n')), 2, 0, 1, 0);
    state = convert(state, 'pageBreak');
    expect(state.doc.child(1).type.name).toBe('pageBreak');
    // Exclusive endpoint at row 2 means only row 1 is selected.
    expect(state.doc.child(2).type.name).toBe('action');
    expect(state.selection.anchor).toBe(position(state, 2));
    expect(state.selection.head).toBe(position(state, 1));
    expect(source(state)).toBe('\n===\n\n');
    expect(source(history(state, undo))).toBe('\n\n\n');
  });
  it('an empty-source hidden conversion captures portable LF syntax and undo restores zero bytes', () => {
    for (const kind of ['note', 'boneyard']) {
      let state = createEditorState(new Uint8Array());
      state = convert(state, kind);
      expect(source(state)).toBe(kind === 'note' ? '[[]]\n' : '/**/\n');
      expect(source(history(state, undo))).toBe('');
    }
  });
  it('new Note split and later text retain complete hidden source ownership', () => {
    let state = select(createEditorState(bytes('\n!A bell.\n')), 1, 3);
    state = convert(state, 'note');
    state = applyEditorTransaction(
      state,
      smartKeyTransaction(state, 'Enter').transaction!,
    ).state;
    expect(source(state)).toBe('\n[[A b\nell.]]\n');
    expect(source(history(state, undo))).toBe('\n[[A bell.]]\n');
  });
  it('hidden conversion at an exclusive following-row endpoint retains selection of authored text', () => {
    let state = select(
      createEditorState(bytes('\n!First.\n~Second.\n')),
      1,
      0,
      2,
      0,
    );
    state = convert(state, 'note');
    expect(
      state.doc.textBetween(state.selection.from, state.selection.to),
    ).toBe('First.');
    expect(source(state)).toBe('\n[[First.]]\n~Second.\n');
  });
  it('a complete speaker/group conversion retains every text row in one undo step', () => {
    const original = '\n@MAYA\nSignal.\n';
    let state = select(createEditorState(bytes(original)), 1, 0, 2, 7);
    const before = state;
    state = convert(state, 'action');
    expect(state.doc.child(1).textContent).toBe('MAYA');
    expect(state.doc.child(2).textContent).toBe('Signal.');
    expect(state.selection.eq(before.selection)).toBe(true);
    expect(source(state)).toBe('\n!MAYA\n!Signal.\n');
    expect(source(history(state, undo))).toBe(original);
  });
  it('protected content, delimiters, styled hidden conversion, nonempty page breaks and detached speakers refuse atomically', () => {
    for (const [original, kind, row] of [
      ['\n[[unclosed\n', 'action', 1],
      ['\n/*omit*/\n', 'action', 1],
      ['\n!A **bell**.\n', 'note', 1],
      ['\n!literal [[x]]\n', 'note', 1],
      ['\n!A bell.\n', 'pageBreak', 1],
      ['\n@MAYA\nSignal.\n', 'action', 1],
      ['\n!A bell.\n', 'dialogue', 1],
    ] as const) {
      const state = select(createEditorState(bytes(original)), row);
      const result = convertEditorSelection(state, kind);
      expect(result.transaction).toBeUndefined();
      expect(result.reason).toBeTruthy();
      expect(source(state)).toBe(original);
    }
  });
  it('context cycles narrative forward/reverse with selection and undo; speech refusal retains group', () => {
    let state = select(createEditorState(bytes('\n!A bell.\n')), 1, 2);
    for (const expected of [
      'character',
      'sceneHeading',
      'transition',
      'action',
    ]) {
      const before = state;
      const result = cycleEditorElement(state, false);
      state = applyEditorTransaction(state, result.transaction!).state;
      expect(selectionElement(state)).toBe(expected);
      expect(source(history(state, undo))).toBe(source(before));
    }
    state = applyEditorTransaction(
      state,
      cycleEditorElement(state, true).transaction!,
    ).state;
    expect(selectionElement(state)).toBe('transition');
    const doc = replaceLine(parseFountain(bytes('\n@MAYA\n\n')), 2, {
      kind: 'dialogue',
      text: '',
    });
    state = select(createEditorState(doc.bytes, doc.recovery), 2);
    state = applyEditorTransaction(
      state,
      cycleEditorElement(state, false).transaction!,
    ).state;
    expect(selectionElement(state)).toBe('parenthetical');
  });
});
describe('M3-06 local shortcut registry', () => {
  it('contains every element and S07.4 workflow command; unavailable actions remain disabled', () => {
    const registry = new ShortcutRegistry('other', storage());
    for (const [kind] of elementChoices)
      expect(
        shortcutCommands.find((c) => c.id === `element.${kind}`),
      ).toBeDefined();
    // M3-12 activates the writing lifecycle: save, Save As and Open are
    // available while later-milestone workflows stay disabled.
    for (const id of [
      'save',
      'saveAs',
      'open',
      'find',
      'nextMatch',
      'previousMatch',
      'focusMode',
      'replace',
      'scriptCheck',
      'commandPalette',
      'nextScene',
      'previousScene',
    ])
      expect(shortcutCommands.find((c) => c.id === id)?.unavailable).toBeNull();
    for (const id of ['exportPdf', 'history', 'upload', 'getLatest'])
      expect(
        shortcutCommands.find((c) => c.id === id)?.unavailable,
      ).toBeTruthy();
    expect(registry.label('element.shot')).toBe('Ctrl+7');
  });
  it('persists and reloads remaps/unassign/reset, with stable notifications', () => {
    const port = storage();
    const registry = new ShortcutRegistry('other', port);
    const listener = vi.fn();
    const stop = registry.subscribe(listener);
    expect(registry.remap('element.action', 'Mod+Shift+k').ok).toBe(true);
    expect(registry.label('element.action')).toBe('Ctrl+Shift+K');
    expect(new ShortcutRegistry('mac', port).label('element.action')).toBe(
      'Command+Shift+K',
    );
    expect(registry.remap('element.action', '').ok).toBe(true);
    expect(
      registry.match(new KeyboardEvent('keydown', { key: '2', ctrlKey: true })),
    ).toBeUndefined();
    expect(registry.reset().ok).toBe(true);
    expect(listener).toHaveBeenCalledTimes(3);
    stop();
  });
  it('duplicate and OS/Alt/physical-key bindings refuse; malformed stored data cannot hijack shortcuts', () => {
    const port = storage();
    const registry = new ShortcutRegistry('other', port);
    for (const binding of [
      'Mod+1',
      'Mod+Q',
      'Mod+W',
      'Mod+R',
      'Alt+F4',
      'Ctrl+Alt+Q',
      'F6',
      'Mod+F6',
      'Mod+Space',
      'Mod+KeyA',
      'Mod+H',
      'Mod+M',
      'Mod+Shift+U',
      'Mod+Shift+E',
      'Mod+Shift+3',
    ])
      expect(registry.remap('element.action', binding).ok).toBe(false);
    for (const bindings of [
      { undo: 'Mod+1' },
      { undo: 'Mod+Q' },
      { injected: 'Mod+K' },
      { undo: 4 },
    ]) {
      port.setItem(
        shortcutStorageKey,
        JSON.stringify({ version: 1, bindings }),
      );
      const loaded = new ShortcutRegistry('other', port);
      expect(loaded.binding('undo')).toBe('Mod+Z');
      expect(loaded.notice).toContain('could not be read');
    }
  });
  it('storage failures retain prior bindings and do not report success', () => {
    const port = {
      getItem() {
        throw new Error('private');
      },
      setItem() {
        throw new Error('quota');
      },
    };
    const registry = new ShortcutRegistry('other', port);
    expect(registry.remap('element.action', 'Mod+K').ok).toBe(false);
    expect(registry.binding('element.action')).toBe('Mod+2');
    expect(new ShortcutRegistry('other').reset().ok).toBe(false);
  });
  it('uses logical layout keys, correct platform Mod and ignores composition/dead/AltGraph/OS keys', () => {
    const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);
    expect(
      eventBinding(key({ key: '1', code: 'Digit9', ctrlKey: true }), 'other'),
    ).toBe('Mod+1');
    expect(
      eventBinding(key({ key: 'é', code: 'Digit2', ctrlKey: true }), 'other'),
    ).toBeNull();
    expect(eventBinding(key({ key: 'k', metaKey: true }), 'mac')).toBe('Mod+K');
    for (const init of [
      { key: 'k', ctrlKey: true, altKey: true },
      { key: 'k', ctrlKey: true, metaKey: true },
      { key: 'k', ctrlKey: true, isComposing: true },
      { key: 'Dead', ctrlKey: true },
    ])
      expect(eventBinding(key(init), 'other')).toBeNull();
  });
});
describe('M3-06 view routing priorities and focus', () => {
  it('IME > completion > explicit > smart, F6 escapes and outside Tab remains ordinary focus', () => {
    const host = document.createElement('div');
    const outside = document.createElement('button');
    document.body.append(host, outside);
    const registry = new ShortcutRegistry('other', storage());
    const completion = vi.fn(() => false);
    const refused = vi.fn();
    const view = mountScreenplayEditor(
      host,
      select(createEditorState(bytes('\n!A bell.\n')), 1, 7),
      {
        shortcuts: registry,
        completionKey: completion,
        refused,
        escapeFocus: () => outside.focus(),
      },
    );
    const key = view.someProp('handleKeyDown')!;
    const event = (key: string, extra: KeyboardEventInit = {}) =>
      new KeyboardEvent('keydown', { key, ...extra });
    const initial = view.state;
    expect(key(view, event('1', { ctrlKey: true, isComposing: true }))).toBe(
      false,
    );
    expect(completion).not.toHaveBeenCalled();
    expect(view.state).toBe(initial);
    completion.mockReturnValue(true);
    expect(key(view, event('Enter'))).toBe(true);
    expect(view.state).toBe(initial);
    expect(key(view, event('Tab'))).toBe(true);
    expect(view.state).toBe(initial);
    expect(key(view, event('1', { ctrlKey: true }))).toBe(true);
    expect(view.state).toBe(initial);
    completion.mockReturnValue(false);
    expect(key(view, event('1', { ctrlKey: true }))).toBe(true);
    expect(selectionElement(view.state)).toBe('sceneHeading');
    expect(key(view, event('Tab'))).toBe(true);
    expect(selectionElement(view.state)).toBe('transition');
    expect(key(view, event('Tab', { shiftKey: true }))).toBe(true);
    expect(selectionElement(view.state)).toBe('sceneHeading');
    // M3-12: available application Save bubbles to the shell instead of refusing.
    expect(key(view, event('s', { ctrlKey: true }))).toBe(false);
    expect(refused).not.toHaveBeenCalledWith(expect.stringContaining('M3-10'));
    // M4-07: Find bubbles to the same application registry handler.
    expect(key(view, event('f', { ctrlKey: true }))).toBe(false);
    view.focus();
    expect(key(view, event('F6'))).toBe(true);
    expect(document.activeElement).toBe(outside);
    const tab = event('Tab');
    expect(outside.dispatchEvent(tab)).toBe(true);
    expect(tab.defaultPrevented).toBe(false);
    view.destroy();
    host.remove();
    outside.remove();
  });
});
