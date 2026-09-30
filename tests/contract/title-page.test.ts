import { describe, expect, it } from 'vitest';
import { redo, undo } from 'prosemirror-history';
import { TextSelection } from 'prosemirror-state';
import {
  parseFountain,
  serializeFountain,
} from '../../src/domain/fountainCodec';
import { changeTitlePage } from '../../src/domain/titlePage';
import { titlePageTransaction } from '../../src/editor/titlePage';
import {
  applyEditorTransaction,
  createEditorState,
  editorVersion,
} from '../../src/editor/state';
import { captureEditor } from '../../src/editor/sourceBridge';

const bytes = (s: string) => new Uint8Array(new TextEncoder().encode(s));
const literal =
  '\ufeffTitle:\t**A**\r\n\t  First\r\nAuthor: Ann\nX-Private: retain  \r\nAuthor: Bob\r\n\r\n.INT. ROOM\r\n!Body *untouched*.  ';
const body = '\r\n.INT. ROOM\r\n!Body *untouched*.  ';
const doc = () => parseFountain(bytes(literal));
const exact = (document: ReturnType<typeof doc>, text: string) =>
  expect(serializeFountain(document)).toEqual(bytes(text));

describe('explicit source-preserving title authorship', () => {
  it('edits multiline/empty values retaining key prefix, existing indent/endings and every other byte', () => {
    const d = doc();
    const edited = changeTitlePage(d, {
      kind: 'edit',
      id: d.titleFields[0]!.id,
      key: 'Title',
      values: ['**B**', 'Second', 'Third'],
    });
    exact(
      edited,
      '\ufeffTitle:\t**B**\r\n\t  Second\r\n    Third\r\nAuthor: Ann\nX-Private: retain  \r\nAuthor: Bob\r\n' +
        body,
    );
    const empty = changeTitlePage(edited, {
      kind: 'edit',
      id: edited.titleFields[1]!.id,
      key: 'Author',
      values: [''],
    });
    exact(
      empty,
      '\ufeffTitle:\t**B**\r\n\t  Second\r\n    Third\r\nAuthor: \nX-Private: retain  \r\nAuthor: Bob\r\n' +
        body,
    );
  });
  it('same field input is byte no-op and retains the document', () => {
    const d = doc();
    expect(
      changeTitlePage(d, {
        kind: 'edit',
        id: d.titleFields[0]!.id,
        key: 'Title',
        values: ['**A**', 'First'],
      }),
    ).toBe(d);
    exact(d, literal);
  });
  it('moves complete fields with mixed endings, duplicates, emphasis and unknown keys intact', () => {
    const d = doc();
    const next = changeTitlePage(d, {
      kind: 'move',
      id: d.titleFields[2]!.id,
      direction: 'up',
    });
    exact(
      next,
      '\ufeffTitle:\t**A**\r\n\t  First\r\nX-Private: retain  \r\nAuthor: Ann\nAuthor: Bob\r\n' +
        body,
    );
    expect(next.titleFields.map((f) => f.id)).toEqual([
      d.titleFields[0]!.id,
      d.titleFields[2]!.id,
      d.titleFields[1]!.id,
      d.titleFields[3]!.id,
    ]);
    exact(
      changeTitlePage(next, {
        kind: 'move',
        id: next.titleFields[1]!.id,
        direction: 'down',
      }),
      literal,
    );
  });
  it('adds and removes only the selected field; body and existing order remain exact', () => {
    const d = doc();
    const next = changeTitlePage(d, {
      kind: 'add',
      key: 'Contact',
      values: ['', 'Somewhere'],
    });
    exact(
      next,
      literal.replace(
        'Author: Bob\r\n\r\n',
        'Author: Bob\r\nContact: \r\n    Somewhere\r\n\r\n',
      ),
    );
    exact(
      changeTitlePage(next, {
        kind: 'remove',
        id: next.titleFields.at(-1)!.id,
      }),
      literal,
    );
    exact(
      changeTitlePage(d, { kind: 'remove', id: d.titleFields[1]!.id }),
      literal.replace('Author: Ann\n', ''),
    );
  });
  it.each(['', '\ufeff', '!Existing body.', '\n!Existing body.\n'])(
    'adds a title page to %j with explicit separator and retains existing body bytes',
    (source) => {
      const d = parseFountain(bytes(source));
      const next = changeTitlePage(d, {
        kind: 'add',
        key: 'Title',
        values: ['Film'],
      });
      const expected =
        source === ''
          ? 'Title: Film'
          : source === '\ufeff'
            ? '\ufeffTitle: Film'
            : source.startsWith('\n')
              ? 'Title: Film\n' + source
              : 'Title: Film\n\n' + source;
      exact(next, expected);
    },
  );
  it('refuses malformed values, empty continuations, stale IDs, EOF joins and neighbor retyping', () => {
    const d = doc();
    for (const values of [[], ['A', ''], ['A\nB'], ['A', '   indented']])
      expect(() =>
        changeTitlePage(d, {
          kind: 'edit',
          id: d.titleFields[0]!.id,
          key: 'Title',
          values,
        }),
      ).toThrow();
    for (const key of ['Bad: key', '', ' Title', 'Title\nAuthor'])
      expect(() =>
        changeTitlePage(d, { kind: 'add', key, values: ['A'] }),
      ).toThrow();
    expect(() =>
      changeTitlePage(d, { kind: 'remove', id: 'foreign' }),
    ).toThrow();
    const eof = parseFountain(bytes('Title: A\nAuthor: B'));
    expect(() =>
      changeTitlePage(eof, {
        kind: 'move',
        id: eof.titleFields[1]!.id,
        direction: 'up',
      }),
    ).toThrow(/EOF/);
    expect(() =>
      changeTitlePage(eof, { kind: 'add', key: 'Contact', values: ['C'] }),
    ).toThrow(/EOF/);
    const ambiguous = parseFountain(bytes('Title: A\nBOB\nhello'));
    expect(() =>
      changeTitlePage(ambiguous, {
        kind: 'remove',
        id: ambiguous.titleFields[0]!.id,
      }),
    ).toThrow(/source region/);
    exact(d, literal);
  });
  it('refuses invalid encoding without replacing any bytes', () => {
    const d = parseFountain(new Uint8Array([255]));
    expect(() =>
      changeTitlePage(d, { kind: 'add', key: 'Title', values: ['A'] }),
    ).toThrow(/UTF-8/);
    expect(d.bytes).toEqual(new Uint8Array([255]));
  });
});

describe('title edits are isolated sole-authority transactions', () => {
  it('preserves body marks/IDs/backward selection, undo/redo source spelling and advancing versions', () => {
    let state = createEditorState(bytes(literal));
    const last = state.doc.content.size - 1;
    state = state.apply(
      state.tr.setSelection(
        TextSelection.create(state.doc, last - 1, last - 4),
      ),
    );
    const originalSelection = state.selection;
    const originalIds = state.doc.content.content.map((n) => n.attrs.id);
    const tr = titlePageTransaction(state, {
      kind: 'edit',
      id: originalIds[0],
      key: 'Title',
      values: ['*New*', 'More', 'Extra'],
    })!;
    state = applyEditorTransaction(state, tr).state;
    expect(captureEditor(state).source).toEqual(
      bytes(
        literal.replace(
          '**A**\r\n\t  First\r\n',
          '*New*\r\n\t  More\r\n    Extra\r\n',
        ),
      ),
    );
    expect(state.doc.lastChild!.content).toEqual(
      createEditorState(bytes(literal)).doc.lastChild!.content,
    );
    expect(state.selection.anchor - state.selection.head).toBe(3);
    const version = editorVersion(state);
    expect(
      undo(state, (t) => {
        state = applyEditorTransaction(state, t).state;
      }),
    ).toBe(true);
    expect(captureEditor(state).source).toEqual(bytes(literal));
    expect(state.selection.eq(originalSelection)).toBe(true);
    expect(editorVersion(state)).toBeGreaterThan(version);
    expect(
      redo(state, (t) => {
        state = applyEditorTransaction(state, t).state;
      }),
    ).toBe(true);
    expect(captureEditor(state).document.titleFields[0]!.values[2]!.text).toBe(
      'Extra',
    );
  });
  it('no-op field edit creates no transaction/version/history and IDs are not reused after undo', () => {
    let state = createEditorState(bytes(literal));
    expect(
      titlePageTransaction(state, {
        kind: 'edit',
        id: 'b0',
        key: 'Title',
        values: ['**A**', 'First'],
      }),
    ).toBeNull();
    state = applyEditorTransaction(
      state,
      titlePageTransaction(state, {
        kind: 'add',
        key: 'Contact',
        values: ['One'],
      })!,
    ).state;
    const firstId = captureEditor(state).document.titleFields.at(-1)!.id;
    undo(state, (tr) => {
      state = applyEditorTransaction(state, tr).state;
    });
    state = applyEditorTransaction(
      state,
      titlePageTransaction(state, {
        kind: 'add',
        key: 'Contact',
        values: ['Two'],
      })!,
    ).state;
    expect(captureEditor(state).document.titleFields.at(-1)!.id).not.toBe(
      firstId,
    );
  });
  it('removing selected title rows yields a valid caret and one-step undo restores selection', () => {
    let state = createEditorState(bytes(literal));
    state = state.apply(
      state.tr.setSelection(TextSelection.create(state.doc, 1, 2)),
    );
    const selected = state.selection;
    state = applyEditorTransaction(
      state,
      titlePageTransaction(state, { kind: 'remove', id: 'b0' })!,
    ).state;
    expect(captureEditor(state).source).toEqual(
      bytes(literal.replace('Title:\t**A**\r\n\t  First\r\n', '')),
    );
    undo(state, (tr) => {
      state = applyEditorTransaction(state, tr).state;
    });
    expect(state.selection.eq(selected)).toBe(true);
    expect(captureEditor(state).source).toEqual(bytes(literal));
  });
});

it('clamps changed title selection at a Unicode scalar boundary and undo restores the old caret', () => {
  let state = createEditorState(bytes('Title: ABC\n\n!Body.'));
  state = state.apply(
    state.tr.setSelection(TextSelection.create(state.doc, 2)),
  );
  state = applyEditorTransaction(
    state,
    titlePageTransaction(state, {
      kind: 'edit',
      id: 'b0',
      key: 'Title',
      values: ['🚀'],
    })!,
  ).state;
  expect(state.selection.from).toBe(1);
  expect(captureEditor(state).source).toEqual(bytes('Title: 🚀\n\n!Body.'));
  undo(state, (tr) => {
    state = applyEditorTransaction(state, tr).state;
  });
  expect(state.selection.from).toBe(2);
});
