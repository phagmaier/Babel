import { describe, expect, it } from 'vitest';
import {
  TextSelection,
  type EditorState,
  type Transaction,
} from 'prosemirror-state';
import { closeHistory, undo, redo } from 'prosemirror-history';
import {
  createEditorState,
  applyEditorTransaction,
  sourceImportTransaction,
  editorOrigin,
  editorVersion,
} from '../../src/editor/state';
import { captureEditor } from '../../src/editor/sourceBridge';
import {
  copyEditorSelection,
  pasteEditorContent,
  clipboardHtmlText,
} from '../../src/editor/clipboard';
import { toggleEditorMark } from '../../src/editor/formatting';
const bytes = (s: string) => new TextEncoder().encode(s);
const source = (state: EditorState) =>
  new TextDecoder('utf-8', { ignoreBOM: true }).decode(
    captureEditor(state).source,
  );
function pos(state: EditorState, row: number, offset = 0) {
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
  end = offset,
  endRow = row,
) {
  return state.apply(
    state.tr.setSelection(
      TextSelection.create(
        state.doc,
        pos(state, row, offset),
        pos(state, endRow, end),
      ),
    ),
  );
}
function apply(state: EditorState, tr?: Transaction) {
  expect(tr).toBeDefined();
  const next = applyEditorTransaction(state, tr!);
  expect(next.accepted).toBe(true);
  return next.state.apply(
    closeHistory(next.state.tr).setMeta('addToHistory', false),
  );
}
function hist(state: EditorState, command = undo) {
  let next = state;
  expect(
    command(state, (tr) => {
      next = applyEditorTransaction(state, tr).state;
    }),
  ).toBe(true);
  return next;
}

describe('literal and internal clipboard (pure editor/source contracts)', () => {
  it('keeps Fountain-looking multiline Unicode literal in Dialogue with one undo and exact selection', () => {
    const original = '\n@MAYA\nHello world.\n';
    let state = select(createEditorState(bytes(original)), 2, 6, 11);
    const before = state;
    const selection = state.selection;
    state = apply(
      state,
      pasteEditorContent(state, {
        text: 'INT. LAB - NIGHT\r\nMore literal text\r\nمرحبا 👩🏽‍🚀 é',
      }).transaction,
    );
    expect(
      state.doc.content.content.slice(2).map((node) => node.type.name),
    ).toEqual(['dialogue', 'dialogue', 'dialogue']);
    expect(
      state.doc.content.content.slice(2).map((node) => node.textContent),
    ).toEqual(['Hello INT. LAB - NIGHT', 'More literal text', 'مرحبا 👩🏽‍🚀 é.']);
    expect(source(state)).toContain(
      'Hello INT. LAB - NIGHT\nMore literal text\nمرحبا 👩🏽‍🚀 é.',
    );
    expect(source(hist(state))).toBe(original);
    expect(hist(state).selection.eq(selection)).toBe(true);
    expect(source(hist(hist(state), redo))).toBe(source(state));
    expect(source(before)).toBe(original);
  });
  it('replaces reverse and exclusive-next-row-end selections without deleting following row', () => {
    let state = createEditorState(bytes('!one\n!two\n!three\n'));
    state = state.apply(
      state.tr.setSelection(
        TextSelection.create(state.doc, pos(state, 2), pos(state, 0)),
      ),
    );
    state = apply(
      state,
      pasteEditorContent(state, { text: 'new' }).transaction,
    );
    expect(state.doc.content.content.map((n) => n.textContent)).toEqual([
      'new',
      'three',
    ]);
    expect(source(hist(state))).toBe('!one\n!two\n!three\n');
  });
  it('copies complete speech group and emphasis, allocates fresh IDs and preserves graph', () => {
    let from = createEditorState(bytes('\n@MAYA\n**Hi** there.\n'));
    from = select(from, 1, 0, from.doc.child(2).content.size, 2);
    const copied = copyEditorSelection(from);
    let target = createEditorState(bytes('!before\n!after\n'));
    target = select(target, 0, 0, target.doc.child(0).content.size);
    const oldId = target.doc.child(0).attrs.id;
    target = apply(target, pasteEditorContent(target, copied).transaction);
    expect(target.doc.child(0).type.name).toBe('character');
    expect(target.doc.child(0).attrs.id).not.toBe(oldId);
    expect(target.doc.child(1).attrs.speechOf).toBe(
      target.doc.child(0).attrs.id,
    );
    expect(target.doc.child(1).child(0).marks[0]?.type.name).toBe('bold');
    expect(source(target)).toContain('**Hi** there.');
    expect(source(hist(target))).toBe('!before\n!after\n');
  });
  it('pastes a complete speech paragraph inline into an existing target speech group', () => {
    let from = createEditorState(bytes('\n@MAYA\n**Hi** there.\n'));
    from = select(from, 2, 0, from.doc.child(2).content.size);
    let target = select(createEditorState(bytes('\n@OTHER\nSay.\n')), 2, 0, 3);
    const cue = target.doc.child(2).attrs.speechOf;
    target = apply(
      target,
      pasteEditorContent(target, copyEditorSelection(from)).transaction,
    );
    expect(target.doc.child(2).attrs.speechOf).toBe(cue);
    expect(source(target)).toBe('\n@OTHER\n**Hi** there..\n');
    expect(source(hist(target))).toBe('\n@OTHER\nSay.\n');
  });
  it('keeps inline copied marks in the target type', () => {
    const from = select(createEditorState(bytes('!**Hi** there\n')), 0, 0, 2);
    let target = select(createEditorState(bytes('\n@MAYA\nSay.\n')), 2, 0, 3);
    target = apply(
      target,
      pasteEditorContent(target, copyEditorSelection(from)).transaction,
    );
    expect(target.doc.child(2).type.name).toBe('dialogue');
    expect(source(target)).toContain('**Hi**.');
  });
  it.each(['[[unclosed\n', '/*\nsecret\n*/\n'])(
    'refuses protected source %j',
    (original) => {
      const state = select(createEditorState(bytes(original)), 0);
      expect(
        pasteEditorContent(state, { text: 'new' }).transaction,
      ).toBeUndefined();
      expect(source(state)).toBe(original);
    },
  );
  it('refuses incomplete speech group, hostile structure, mismatched text and surrogate input', () => {
    const cue = createEditorState(bytes('\n@MAYA\nHi\n'));
    const copied = copyEditorSelection(select(cue, 2, 0, 2));
    const target = createEditorState(bytes('!here\n'));
    for (const input of [
      copied,
      { ...copied, text: 'tampered' },
      { text: '\ud800' },
      {
        text: 'here',
        structured:
          '{"schema":1,"wholeRows":true,"rows":[{"kind":"raw","runs":[]}]}',
      },
    ])
      expect(pasteEditorContent(target, input).transaction).toBeUndefined();
    expect(source(target)).toBe('!here\n');
  });
  it('sanitizes HTML to inert literal text and prefers explicit plain text', () => {
    const html =
      '<div onclick="globalThis.owned=true">A<img src="https://invalid.example/pixel"><script>globalThis.owned=true</script><svg onload="owned=true">BAD</svg><br><b>B</b></div>';
    expect(clipboardHtmlText(html)).toBe('A\nB');
    const state = createEditorState(bytes('!here\n'));
    expect(
      source(
        apply(
          state,
          pasteEditorContent(state, { text: 'safe', html }).transaction,
        ),
      ),
    ).toBe('!safehere\n');
    expect(
      source(
        apply(state, pasteEditorContent(state, { text: '', html }).transaction),
      ),
    ).toBe('!A\n!Bhere\n');
  });
});

describe('inline emphasis and whole-source import provenance', () => {
  it.each(['bold', 'italic', 'underline'])(
    '%s is selection-preserving and isolated from neighboring typing',
    (style) => {
      let state = select(createEditorState(bytes('!Zoë 👩🏽‍🚀 walks.\n')), 0, 0, 3);
      const selection = state.selection;
      state = apply(state, toggleEditorMark(state, style).transaction);
      expect(state.selection.eq(selection)).toBe(true);
      expect(state.doc.child(0).child(0).marks[0]?.type.name).toBe(style);
      const marked = source(state);
      state = apply(state, state.tr.insertText('New'));
      state = hist(state);
      expect(source(state)).toBe(marked);
      state = hist(state);
      expect(source(state)).toBe('!Zoë 👩🏽‍🚀 walks.\n');
      expect(state.selection.eq(selection)).toBe(true);
    },
  );
  it('keeps Parenthetical punctuation outside emphasis and refuses a styled Page Break', () => {
    const original = '\n@MAYA\n(softly)\nHello.\n';
    const state = select(createEditorState(bytes(original)), 2, 0, 8);
    expect(toggleEditorMark(state, 'bold').transaction).toBeUndefined();
    const inner = select(state, 2, 1, 7);
    expect(
      source(apply(inner, toggleEditorMark(inner, 'bold').transaction)),
    ).toBe('\n@MAYA\n(**softly**)\nHello.\n');
    const page = select(createEditorState(bytes('===\n')), 0, 0, 3);
    expect(toggleEditorMark(page, 'italic').transaction).toBeUndefined();
  });
  it('toggles stored marks for subsequent typing and refuses protected/literal marks', () => {
    let state = select(createEditorState(bytes('!Hello\n')), 0, 5);
    state = apply(state, toggleEditorMark(state, 'bold').transaction);
    state = apply(state, state.tr.insertText('yes'));
    expect(source(state)).toBe('!Hello**yes**\n');
    const raw = createEditorState(bytes('[[unclosed\n'));
    expect(toggleEditorMark(raw, 'italic').transaction).toBeUndefined();
  });
  it('AUDIT-C02: whitespace at the edge of emphasis stays capturable and is saved unstyled', () => {
    const typing = (state: EditorState, text: string) => {
      for (const character of text)
        state = apply(state, state.tr.insertText(character));
      return state;
    };
    const bold = (state: EditorState) =>
      apply(state, toggleEditorMark(state, 'bold').transaction);
    const start = () => select(createEditorState(bytes('!X\n')), 0, 1);
    // Every keystroke of a multi-word bold phrase captures.
    let state = bold(start());
    for (const [typed, expected] of [
      ['Fast', '!X**Fast**\n'],
      [' ', '!X**Fast** \n'],
      ['car', '!X**Fast car**\n'],
    ] as const) {
      state = typing(state, typed);
      expect(source(state)).toBe(expected);
    }
    // Bold switched off after the space no longer leaves the draft stuck.
    state = typing(bold(typing(bold(start()), 'Fast ')), 'then on');
    expect(source(state)).toBe('!X**Fast** then on\n');
    // A leading space under bold heals as soon as text follows, and stays healed.
    state = typing(bold(start()), ' ');
    expect(source(state)).toBe('!X \n');
    state = typing(state, 'big dog');
    expect(source(state)).toBe('!X **big dog**\n');
    expect(
      createEditorState(captureEditor(state).source).doc.child(0).textContent,
    ).toBe('X big dog');
    // Underline follows the same rule; an explicit selection toggle still refuses.
    state = start();
    state = apply(state, toggleEditorMark(state, 'underline').transaction);
    expect(source(typing(state, 'a '))).toBe('!X_a_ \n');
    state = select(createEditorState(bytes('!Hello there\n')), 0, 0, 6);
    expect(toggleEditorMark(state, 'underline').transaction).toBeUndefined();
  });
  it.each([
    '\ufeffTitle: Imported\r\nOdd field: retained\r\n\r\nINT. LAB - DAY\r\n!  space  \r\n/* secret */\r\n',
    '',
    '[[unclosed\n',
  ])(
    'imports exact bytes and restores both source origins on undo/redo: %j',
    (imported) => {
      const original = '\ufeff!old  \r\n/* protected */\r\n';
      let state = select(createEditorState(bytes(original)), 0, 1, 3);
      const before = state;
      const session = editorOrigin(state).session;
      const version = editorVersion(state);
      state = apply(state, sourceImportTransaction(state, bytes(imported)));
      expect(Array.from(captureEditor(state).source)).toEqual(
        Array.from(bytes(imported)),
      );
      expect(editorOrigin(state).session).toBe(session);
      expect(editorVersion(state)).toBeGreaterThan(version);
      const high = editorOrigin(state).nextId;
      state = hist(state);
      expect(source(state)).toBe(original);
      expect(state.selection.eq(before.selection)).toBe(true);
      expect(editorOrigin(state).nextId).toBe(high);
      state = hist(state, redo);
      expect(Array.from(captureEditor(state).source)).toEqual(
        Array.from(bytes(imported)),
      );
    },
  );
  it('retains invalid UTF-8 as read-only import and can undo it', () => {
    let state = createEditorState(bytes('!old\n'));
    const bad = new Uint8Array([0xff, 0x0a]);
    state = apply(state, sourceImportTransaction(state, bad));
    expect(Array.from(captureEditor(state).source)).toEqual([...bad]);
    expect(editorOrigin(state).document.readOnlyReason).toBeTruthy();
    state = hist(state);
    expect(source(state)).toBe('!old\n');
  });
  it('cannot forge a source origin or swap another editor origin with an ordinary transaction', () => {
    const state = createEditorState(bytes('!old\n'));
    const other = createEditorState(bytes('!else\n'));
    for (const token of [{}, other.doc.attrs.sourceOrigin, null])
      expect(
        applyEditorTransaction(
          state,
          state.tr.setDocAttribute('sourceOrigin', token),
        ).accepted,
      ).toBe(false);
    expect(source(state)).toBe('!old\n');
  });
});

it.each([
  {
    name: 'mid-row caret',
    original: '!Alpha Omega\n',
    row: 0,
    start: 6,
    endRow: 0,
    end: 6,
    expected: '!Alpha \n!one\n!two\n!Omega\n',
  },
  {
    name: 'row start',
    original: '!Alpha Omega\n',
    row: 0,
    start: 0,
    endRow: 0,
    end: 0,
    expected: '!one\n!two\n!Alpha Omega\n',
  },
  {
    name: 'partial cross-row selection',
    original: '!Alpha tail\n!head Omega\n',
    row: 0,
    start: 6,
    endRow: 1,
    end: 5,
    expected: '!Alpha \n!one\n!two\n!Omega\n',
  },
])(
  'AUDIT-TEST structured paste retains text at $name with exact Undo/Redo',
  ({ original, row, start, endRow, end, expected }) => {
    const from = createEditorState(bytes('!one\n!two\n'));
    const copied = copyEditorSelection(select(from, 0, 0, 3, 1));
    const before = select(
      createEditorState(bytes(original)),
      row,
      start,
      end,
      endRow,
    );
    const pasted = apply(
      before,
      pasteEditorContent(before, copied).transaction,
    );
    expect(source(pasted)).toBe(expected);
    const undone = hist(pasted);
    expect(source(undone)).toBe(original);
    expect(undone.selection.eq(before.selection)).toBe(true);
    expect(source(hist(undone, redo))).toBe(expected);
    expect(source(before)).toBe(original);
  },
);
