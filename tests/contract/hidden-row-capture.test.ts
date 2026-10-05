import { describe, expect, it } from 'vitest';
import { redo, undo } from 'prosemirror-history';
import { TextSelection, type EditorState } from 'prosemirror-state';
import {
  convertEditorSelection,
  smartKeyTransaction,
} from '../../src/editor/commands';
import { captureEditor } from '../../src/editor/sourceBridge';
import {
  applyEditorTransaction,
  createEditorState,
} from '../../src/editor/state';

// AUDIT-PARK-H-F1: expectations are hand-written before the sourceBridge fix.
// Only production authoring commands create/convert rows; captures are deferred.
const bytes = (text: string) => new TextEncoder().encode(text);
function position(state: EditorState, row: number, offset = 0) {
  return (
    1 +
    state.doc.content.content
      .slice(0, row)
      .reduce((at, node) => at + node.nodeSize, 0) +
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
  return state.apply(
    state.tr.setSelection(
      TextSelection.create(
        state.doc,
        position(state, row, offset),
        position(state, last, end),
      ),
    ),
  );
}
function enter(state: EditorState) {
  const result = smartKeyTransaction(state, 'Enter');
  expect(result.transaction, result.reason).toBeDefined();
  const applied = applyEditorTransaction(state, result.transaction!);
  expect(applied.accepted).toBe(true);
  return applied.state;
}
function convert(state: EditorState, kind: 'note' | 'boneyard') {
  const result = convertEditorSelection(state, kind);
  expect(result.transaction, result.reason).toBeDefined();
  const applied = applyEditorTransaction(state, result.transaction!);
  expect(applied.accepted).toBe(true);
  return applied.state;
}
function rows(state: EditorState) {
  return state.doc.content.content.map(
    (node) => `${node.type.name}:${node.textContent}`,
  );
}
function exact(state: EditorState, expected: string) {
  const captured = captureEditor(state);
  expect([...captured.source]).toEqual([...bytes(expected)]);
  const reopened = createEditorState(captured.source);
  expect(rows(reopened)).toEqual(rows(state));
  expect([...captureEditor(reopened).source]).toEqual([...bytes(expected)]);
  const recovered = createEditorState(
    captured.source,
    captured.document.recovery,
  );
  expect(recovered.doc.content.content.map((node) => node.attrs.id)).toEqual(
    state.doc.content.content.map((node) => node.attrs.id),
  );
  expect([...captureEditor(recovered).source]).toEqual([...bytes(expected)]);
}
const kinds = ['note', 'boneyard'] as const;
const spelling = (kind: (typeof kinds)[number], text: string) =>
  kind === 'note' ? `[[${text}]]` : `/*${text}*/`;
const original = '\ufeff!Alpha.  \r\n\r\n!Omega.\r\n';

describe('AUDIT-PARK-H-F1 newly authored hidden source ownership', () => {
  for (const kind of kinds) {
    it.each(['', 'remember'])(
      `${kind} at the end, with %j, preserves BOM/CRLF bytes`,
      (text) => {
        let state = createEditorState(bytes(original));
        state = enter(select(state, 2, 6));
        state = convert(state, kind);
        if (text) state = state.apply(state.tr.insertText(text));
        exact(state, original + `\r\n${spelling(kind, text)}\r\n`);
      },
    );

    it.each(['beginning', 'middle'])(
      `${kind} at the %s only inserts its line`,
      (location) => {
        let state = createEditorState(bytes(original));
        state = enter(select(state, location === 'beginning' ? 0 : 2));
        state = convert(state, kind);
        state = state.apply(state.tr.insertText('remember'));
        exact(
          state,
          location === 'beginning'
            ? `\ufeff${spelling(kind, 'remember')}\r\n!Alpha.  \r\n\r\n!Omega.\r\n`
            : `\ufeff!Alpha.  \r\n\r\n${spelling(kind, 'remember')}\r\n!Omega.\r\n`,
        );
      },
    );

    it(`${kind} directly beside unknown/hidden source keeps every retained byte`, () => {
      const source =
        '\ufeff!Alpha.\r\n\r\n{{Vendor:\t opaque  }}\r\n\r\n[[unclosed\r\nTail  \r\n';
      let state = createEditorState(bytes(source));
      // Enter on the existing blank inserts a new blank immediately before
      // the protected unclosed region; conversion owns only that new row.
      state = enter(select(state, 1));
      state = convert(state, kind);
      state = state.apply(state.tr.insertText('remember'));
      exact(
        state,
        `\ufeff!Alpha.\r\n\r\n${spelling(kind, 'remember')}\r\n{{Vendor:\t opaque  }}\r\n\r\n[[unclosed\r\nTail  \r\n`,
      );
    });

    it(`${kind}: two new groups, separated by new blank rows, keep their order`, () => {
      let state = createEditorState(bytes('!Alpha.\n\n!Omega.\n'));
      // Insert both before the original first row, without a surviving predecessor.
      state = enter(select(state, 0));
      state = enter(state);
      state = enter(state);
      state = convert(select(state, 0), kind);
      state = state.apply(state.tr.insertText('one'));
      state = convert(select(state, 2), kind);
      state = state.apply(state.tr.insertText('two'));
      exact(
        state,
        `${spelling(kind, 'one')}\n\n${spelling(kind, 'two')}\n!Alpha.\n\n!Omega.\n`,
      );
    });

    it(`${kind}: multiline conversion whose rows are all new captures`, () => {
      let state = createEditorState(bytes(original));
      state = enter(select(state, 2));
      state = state.apply(state.tr.insertText('one two'));
      state = enter(select(state, 2, 3));
      state = convert(select(state, 2, 0, 3, 4), kind);
      exact(
        state,
        kind === 'note'
          ? '\ufeff!Alpha.  \r\n\r\n[[one\r\n two]]\r\n!Omega.\r\n'
          : '\ufeff!Alpha.  \r\n\r\n/*one\r\n two*/\r\n!Omega.\r\n',
      );
    });

    it(`${kind}: existing row plus a new row can convert as one complete group`, () => {
      let state = createEditorState(bytes(original));
      state = enter(select(state, 0, 3));
      state = convert(select(state, 0, 0, 1, 5), kind);
      exact(
        state,
        kind === 'note'
          ? '\ufeff[[Alp\r\nha.  ]]\r\n\r\n!Omega.\r\n'
          : '\ufeff/*Alp\r\nha.  */\r\n\r\n!Omega.\r\n',
      );
    });

    it(`${kind}: new first row plus an existing row keeps source ownership`, () => {
      let state = createEditorState(bytes(original));
      state = enter(select(state, 0));
      state = state.apply(state.tr.insertText('prefix'));
      state = convert(select(state, 0, 0, 1, 8), kind);
      exact(
        state,
        kind === 'note'
          ? '\ufeff[[prefix\r\nAlpha.  ]]\r\n\r\n!Omega.\r\n'
          : '\ufeff/*prefix\r\nAlpha.  */\r\n\r\n!Omega.\r\n',
      );
    });

    it(`${kind} after an unterminated last source row captures`, () => {
      let state = createEditorState(bytes('!Alpha.'));
      state = enter(select(state, 0, 6));
      state = convert(state, kind);
      state = state.apply(state.tr.insertText('remember'));
      // Keep the existing unterminated EOF convention after adding physical rows.
      exact(state, `!Alpha.\n\n${spelling(kind, 'remember')}`);
    });

    it(`${kind}: every Undo/Redo step through conversion remains capturable`, () => {
      let state = createEditorState(bytes(original));
      state = enter(select(state, 2, 6));
      state = convert(state, kind);
      state = state.apply(state.tr.insertText('remember'));
      const final = original + `\r\n${spelling(kind, 'remember')}\r\n`;
      exact(state, final);
      const snapshots: Uint8Array[] = [];
      while (
        undo(state, (tr) => {
          state = state.apply(tr);
        })
      ) {
        snapshots.push(captureEditor(state).source);
      }
      exact(state, original);
      for (const prior of snapshots.slice(0, -1).reverse()) {
        expect(
          redo(state, (tr) => {
            state = state.apply(tr);
          }),
        ).toBe(true);
        expect([...captureEditor(state).source]).toEqual([...prior]);
      }
      expect(
        redo(state, (tr) => {
          state = state.apply(tr);
        }),
      ).toBe(true);
      exact(state, final);
    });
  }

  it('Enter inside a newly inserted Note adds a note line; later edits capture', () => {
    let state = createEditorState(bytes(original));
    state = enter(select(state, 2, 6));
    state = convert(state, 'note');
    state = state.apply(state.tr.insertText('one two'));
    state = enter(select(state, 4, 5));
    state = state.apply(state.tr.insertText('more '));
    exact(state, original + '\r\n[[one\r\nmore  two]]\r\n');
  });

  it('editing a Note from the opened file keeps exact untouched source', () => {
    const source = original + '[[one two]]\r\n';
    let state = createEditorState(bytes(source));
    state = enter(select(state, 3, 5));
    state = state.apply(state.tr.insertText('more '));
    exact(state, original + '[[one\r\nmore  two]]\r\n');
  });
});
