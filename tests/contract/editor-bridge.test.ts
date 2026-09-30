import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { DOMParser, DOMSerializer, Schema } from 'prosemirror-model';
import { closeHistory, undo, redo } from 'prosemirror-history';
import {
  TextSelection,
  type EditorState,
  type Transaction,
} from 'prosemirror-state';
import * as codec from '../../src/domain/fountainCodec';
import {
  createEditorState,
  applyEditorTransaction,
  editorVersion,
  editorOrigin,
} from '../../src/editor/state';
import { captureEditor, copyEditorDraft } from '../../src/editor/sourceBridge';
import { screenplaySchema } from '../../src/editor/schema';
import { mountScreenplayEditor } from '../../src/editor/view';
import { EditorCaptureBoundary } from '../../src/application/editorCapture';
import { smartKeyTransaction } from '../../src/editor/commands';

const bytes = (text: string) => new Uint8Array(new TextEncoder().encode(text));
const decode = (source: Uint8Array) =>
  new TextDecoder('utf-8', { ignoreBOM: true }).decode(source);
const digest = async (source: Uint8Array) =>
  createHash('sha256').update(source).digest('hex');

it('preserves an uncapturable accepted draft as explicit JSON with exact original bytes, live rows/styles and selection', async () => {
  const original = bytes('@MAYA\r\n(softly)\r\nHello.\r\n');
  let state = createEditorState(original);
  state = state.apply(
    state.tr.setSelection(
      TextSelection.create(state.doc, state.doc.child(0).nodeSize + 5),
    ),
  );
  const split = smartKeyTransaction(state, 'Enter').transaction!;
  state = applyEditorTransaction(state, split).state;
  const boundary = new EditorCaptureBoundary(() => state, {
    defer: async () => {},
    hash: digest,
  });
  await expect(boundary.capture()).rejects.toThrow();
  const result = await boundary.captureDraft();
  const artifact = JSON.parse(decode(Uint8Array.from(result.source)));
  expect(artifact.schema).toBe('babel-draft-copy-v1');
  expect(artifact.version).toBe(editorVersion(state));
  expect(
    [...atob(artifact.originalSourceBase64)].map((c) => c.charCodeAt(0)),
  ).toEqual(Array.from(original));
  expect(
    artifact.rows.map((row: { runs: { text: string }[] }) =>
      row.runs.map((run) => run.text).join(''),
    ),
  ).toEqual(['MAYA', '(sof', 'tly)', 'Hello.']);
  expect(artifact.rows[1].kind).toBe('parenthetical');
  expect(artifact.selection).toEqual({
    anchor: state.selection.anchor,
    head: state.selection.head,
  });
  expect(result.sourceSha256).toBe(
    await digest(Uint8Array.from(result.source)),
  );
});
function position(state: EditorState, index: number, offset = 0) {
  let start = 1;
  for (let at = 0; at < index; at++) start += state.doc.child(at).nodeSize;
  return start + offset;
}
function select(
  state: EditorState,
  index: number,
  offset: number,
  head = offset,
) {
  return applyEditorTransaction(
    state,
    state.tr.setSelection(
      TextSelection.create(
        state.doc,
        position(state, index, offset),
        position(state, index, head),
      ),
    ),
  ).state;
}
function command(state: EditorState, action: typeof undo) {
  let next = state;
  expect(
    action(state, (tr) => {
      next = applyEditorTransaction(state, tr).state;
    }),
  ).toBe(true);
  return next;
}
const originalCorpus = JSON.parse(
  readFileSync('fixtures/expected/m3-conformance.json', 'utf8'),
) as { cases: { id: string; sourceLiteral: string }[] };
const complexCorpus = JSON.parse(
  readFileSync('fixtures/expected/m3-complex.json', 'utf8'),
) as { cases: { id: string; source: string }[] };

describe('production sole editor/source boundary (pure contract, no native I/O)', () => {
  for (const entry of originalCorpus.cases)
    it(`original ${entry.id}: exact no-op source and physical spans`, () => {
      const state = createEditorState(bytes(entry.sourceLiteral));
      const capture = captureEditor(state);
      expect(Array.from(capture.source)).toEqual(
        Array.from(bytes(entry.sourceLiteral)),
      );
      expect(capture.ranges.length).toBe(capture.document.lines.length);
      capture.ranges.forEach((range, index) => {
        expect(range).toEqual({
          id: state.doc.child(index).attrs.id,
          from: capture.document.lines[index]!.sourceStart,
          to: capture.document.lines[index]!.sourceEnd,
        });
      });
    });
  for (const entry of complexCorpus.cases)
    it(`complex ${entry.id}: all author content survives the editor projection`, () => {
      const state = createEditorState(bytes(entry.source));
      expect(Array.from(captureEditor(state).source)).toEqual(
        Array.from(bytes(entry.source)),
      );
      expect(state.doc.childCount).toBe(
        editorOrigin(state).document.lines.length,
      );
    });

  for (const name of ['lf', 'crlf', 'no-final-newline'])
    it(`${name}: independent Unicode edit oracle, selection and coherent undo/redo`, () => {
      const original = new Uint8Array(
        readFileSync(`prototypes/editor-composition/fixtures/${name}.fountain`),
      );
      const expected = new Uint8Array(
        readFileSync(
          `prototypes/editor-composition/fixtures/${name}-edited.fountain`,
        ),
      );
      let state = createEditorState(original);
      const ids = state.doc.content.content.map((node) => node.attrs.id);
      state = select(state, 2, state.doc.child(2).textContent.length);
      const before = captureEditor(state);
      state = applyEditorTransaction(
        state,
        closeHistory(state.tr).insertText(' é🚀'),
      ).state;
      const typed = captureEditor(state);
      expect(Array.from(typed.source)).toEqual(Array.from(expected));
      expect(typed.selection!.head.utf16Offset).toBe(28);
      expect(typed.version).toBeGreaterThan(before.version);
      state = command(state, undo);
      expect(Array.from(captureEditor(state).source)).toEqual(
        Array.from(original),
      );
      expect(captureEditor(state).selection).toEqual(before.selection);
      expect(editorVersion(state)).toBeGreaterThan(typed.version);
      state = command(state, redo);
      expect(Array.from(captureEditor(state).source)).toEqual(
        Array.from(expected),
      );
      expect(captureEditor(state).selection).toEqual(typed.selection);
      expect(state.doc.content.content.map((node) => node.attrs.id)).toEqual(
        ids,
      );
      state = select(state, 2, 2, 6);
      const selected = captureEditor(state);
      state = applyEditorTransaction(
        state,
        closeHistory(state.tr).insertText('beacon'),
      ).state;
      expect(decode(captureEditor(state).source)).toContain(
        '!A beacon glows beside Zoë. é🚀',
      );
      state = command(state, undo);
      expect(captureEditor(state).selection).toEqual(selected.selection);
      expect(Array.from(captureEditor(state).source)).toEqual(
        Array.from(expected),
      );
    });

  for (const [kind, original, index, offset, inserted, expected] of [
    [
      'sceneHeading',
      '\nINT. OFFICE - DAY #12#\n\n',
      1,
      17,
      'X',
      '\n.INT. OFFICE - DAYX #12#\n\n',
    ],
    ['character', '\n@A\nSignal.\n', 1, 1, 'B', '\n@AB\nSignal.\n'],
    ['dialogue', '\n@A\nSignal.\n', 2, 7, 'X', '\n@A\nSignal.X\n'],
    [
      'parenthetical',
      '\n@A\n(soft)\nSignal.\n',
      2,
      1,
      'X',
      '\n@A\n(Xsoft)\nSignal.\n',
    ],
    ['transition', '\n>CUT TO:\n', 1, 7, 'X', '\n>CUT TO:X\n'],
    ['lyrics', '\n~River.\n', 1, 6, 'X', '\n~River.X\n'],
    ['centered', '\n>Center<\n', 1, 6, 'X', '\n>CenterX<\n'],
    ['section', '\n## Act\n', 1, 3, 'X', '\n## ActX\n'],
    ['synopsis', '\n= Beat\n', 1, 4, 'X', '\n= BeatX\n'],
  ] as const)
    it(`${kind}: explicit type and fields survive ordinary text edits and source/undo`, () => {
      let state = createEditorState(bytes(original));
      expect(state.doc.child(index).type.name).toBe(kind);
      state = select(state, index, offset);
      state = applyEditorTransaction(
        state,
        closeHistory(state.tr).insertText(inserted),
      ).state;
      const capture = captureEditor(state);
      expect(decode(capture.source)).toBe(expected);
      expect(capture.document.lines[index]!.kind).toBe(kind);
      state = command(state, undo);
      expect(decode(captureEditor(state).source)).toBe(original);
    });

  it('models every primary type, hidden/title ownership, dual relationships and actual inline DOM marks', () => {
    const state = createEditorState(
      bytes(
        '\n!A **bright** _low_ *small* bell.\n\n@A\nFirst.\n\n@B ^\nSecond.\n',
      ),
    );
    expect(state.doc.child(1).textContent).toBe('A bright low small bell.');
    expect(state.doc.child(6).attrs.dualWith).toBe(state.doc.child(3).attrs.id);
    const host = document.createElement('div');
    host.append(
      DOMSerializer.fromSchema(screenplaySchema).serializeFragment(
        state.doc.content,
      ),
    );
    expect(host.querySelector('strong')!.textContent).toBe('bright');
    expect(host.querySelector('u')!.textContent).toBe('low');
    expect(host.querySelector('em')!.textContent).toBe('small');
    const protectedState = createEditorState(
      bytes('Title: Quiet\nUnknown: Keep\n\n[[Note]]\n\n{{raw}}\n'),
    );
    expect(
      protectedState.doc.content.content.filter((node) => node.attrs.protected)
        .length,
    ).toBe(3);
    expect(protectedState.doc.child(3).type.name).toBe('note');
    expect(protectedState.doc.child(3).attrs.protected).toBe(false);
  });

  it('owned editor DOM reparses marks, identity and meaningful whitespace; forged DOM/foreign marks cannot alter authority', () => {
    const state = createEditorState(bytes('\n!  A **bright**  bell.  \n'));
    const host = document.createElement('div');
    host.append(
      DOMSerializer.fromSchema(screenplaySchema).serializeFragment(
        state.doc.content,
      ),
    );
    const parsed = DOMParser.fromSchema(screenplaySchema).parse(host);
    expect(parsed.content.eq(state.doc.content)).toBe(true);
    expect(parsed.attrs.sourceOrigin).toBeNull(); // Immutable source provenance stays private, outside DOM.
    const foreign = new Schema({
      nodes: { doc: { content: 'text*' }, text: {} },
      marks: { bold: { toDOM: () => ['script', 0] } },
    });
    const result = applyEditorTransaction(
      state,
      state.tr.addMark(
        position(state, 1, 2),
        position(state, 1, 3),
        foreign.marks.bold!.create(),
      ),
    );
    expect(result.accepted).toBe(false);
    const paragraph = host.querySelector('p[data-kind="action"]')!;
    paragraph.setAttribute('data-origin', '{"id":"forged"}');
    const forged = DOMParser.fromSchema(screenplaySchema).parse(host);
    expect(
      applyEditorTransaction(
        state,
        state.tr.replaceWith(0, state.doc.content.size, forged.content),
      ).accepted,
    ).toBe(false);
  });

  it('local rich edits preserve nested styles, untouched source bytes, IDs and undo syntax', () => {
    let state = createEditorState(
      bytes('\ufeff\r\n!A **low *gentle*** bell.\r\n\r\n{{keep  raw}}'),
    );
    const original = captureEditor(state);
    state = select(state, 1, 6, 12);
    state = applyEditorTransaction(
      state,
      closeHistory(state.tr).insertText('soft'),
    ).state;
    expect(decode(captureEditor(state).source)).toBe(
      '\ufeff\r\n!A **low *soft*** bell.\r\n\r\n{{keep  raw}}',
    );
    state = command(state, undo);
    expect(Array.from(captureEditor(state).source)).toEqual(
      Array.from(original.source),
    );
  });

  it('maps Unicode, combining/grapheme interiors, escapes and emphasis to independently specified source bytes', () => {
    let state = createEditorState(bytes('\n!A e\u0301👩‍🚀 z\n'));
    state = select(state, 1, 3);
    expect(captureEditor(state).selection!.head).toMatchObject({
      utf16Offset: 3,
      byteOffset: 5,
      graphemeIndex: 2,
      graphemeUtf16Offset: 1,
    });
    state = select(state, 1, 9);
    expect(captureEditor(state).selection!.head).toMatchObject({
      byteOffset: 18,
      graphemeIndex: 4,
      graphemeUtf16Offset: 0,
    });
    state = select(state, 1, 5);
    expect(() => captureEditor(state)).toThrow('Unicode scalar');
    state = createEditorState(bytes('\n!x \\*y\\* **e\u0301** 🚀\n'));
    state = select(state, 1, 7);
    expect(captureEditor(state).selection!.head.byteOffset).toBe(13);
    state = select(state, 1, 11);
    expect(captureEditor(state).selection!.head.byteOffset).toBe(22);
  });

  it('interior U+FEFF remains authored content when a line caret prefix starts with it', () => {
    let state = createEditorState(bytes('\n!\ufeffMark.\n'));
    state = select(state, 1, 1);
    expect(captureEditor(state).selection!.head.byteOffset).toBe(5);
    expect(decode(captureEditor(state).source)).toBe('\n!\ufeffMark.\n');
  });

  it('empty and repeated marker text anchors start after forcing syntax, never at an earlier matching marker', () => {
    for (const [literal, index, offset, expected] of [
      ['\n!!\n', 1, 0, 2],
      ['\n@\n', 1, 0, 2],
      ['\n@@\n', 1, 0, 2],
      ['Title: \n\n!body\n', 0, 0, 7],
      ['\n## \n', 1, 0, 4],
    ] as const) {
      let state = createEditorState(bytes(literal));
      state = select(state, index, offset);
      expect(captureEditor(state).selection!.head.byteOffset).toBe(expected);
    }
  });

  it('rejects protected text, cross-block deletion, type/ID changes, splits/joins and invalid Unicode atomically', () => {
    const state = createEditorState(bytes('\n!A bell.\n\n{{protected}}\n'));
    const original = captureEditor(state);
    const attempts: Transaction[] = [
      state.tr.insertText('x', position(state, 3)),
      state.tr.delete(position(state, 1), position(state, 3, 2)),
      state.tr.setNodeMarkup(
        position(state, 1) - 1,
        screenplaySchema.nodes.character,
      ),
      state.tr.setNodeMarkup(position(state, 1) - 1, undefined, {
        ...state.doc.child(1).attrs,
        id: 'forged',
      }),
      state.tr.split(position(state, 1, 2)),
      state.tr.insertText('\n', position(state, 1)),
      state.tr.insertText('\ud800', position(state, 1)),
    ];
    for (const transaction of attempts) {
      const result = applyEditorTransaction(state, transaction);
      expect(result.accepted).toBe(false);
      expect(result.state).toBe(state);
      expect(Array.from(captureEditor(result.state).source)).toEqual(
        Array.from(original.source),
      );
    }
  });

  it('equal foreign document transactions and scalar-splitting marks cannot modify the live authority', () => {
    const state = createEditorState(bytes('\n!A 🚀 bell.\n'));
    const foreign = createEditorState(bytes('\n!A 🚀 bell.\n'));
    expect(foreign.doc.eq(state.doc)).toBe(true);
    expect(
      applyEditorTransaction(
        state,
        foreign.tr.insertText('Stale.', position(foreign, 1)),
      ).accepted,
    ).toBe(false);
    const splitScalar = state.tr.addMark(
      position(state, 1, 2),
      position(state, 1, 3),
      screenplaySchema.marks.bold!.create(),
    );
    expect(applyEditorTransaction(state, splitScalar).accepted).toBe(false);
    expect(decode(captureEditor(state).source)).toBe('\n!A 🚀 bell.\n');
  });

  it('keeps unsafe grammar/style drafts live with a reviewable latest draft and exact original copy', () => {
    let state = createEditorState(bytes('\n@A\nSignal.\n'));
    state = select(state, 2, 0, 7);
    state = applyEditorTransaction(
      state,
      state.tr.insertText('@Literal'),
    ).state;
    expect(state.doc.child(2).textContent).toBe('@Literal');
    expect(() => captureEditor(state)).toThrow();
    const copy = copyEditorDraft(state);
    expect(copy.rows[2]!.runs[0]!.text).toBe('@Literal');
    expect(decode(copy.originalSource)).toBe('\n@A\nSignal.\n');
    copy.originalSource.fill(0);
    expect(decode(copy.originalSource)).toBe('\n@A\nSignal.\n');
    expect(Object.isFrozen(copy.rows[2]!.runs[0]!.styles)).toBe(true);
  });

  it('empty source is a recovery-only virtual placeholder; first typing becomes portable LF action and undo restores zero bytes', () => {
    let state = createEditorState(bytes(''));
    const id = state.doc.firstChild!.attrs.id;
    expect(captureEditor(state).source.length).toBe(0);
    state = applyEditorTransaction(state, state.tr.insertText('A bell.')).state;
    expect(decode(captureEditor(state).source)).toBe('!A bell.\n');
    expect(captureEditor(state).document.lines[0]!.id).toBe(id);
    expect(state.doc.firstChild!.attrs.id).toBe(id);
    state = command(state, undo);
    expect(captureEditor(state).source.length).toBe(0);
  });

  it('a BOM-only virtual source anchors after its BOM and retains it through first typing and undo', () => {
    let state = createEditorState(bytes('\ufeff'));
    expect(captureEditor(state).selection!.head.byteOffset).toBe(3);
    state = applyEditorTransaction(state, state.tr.insertText('A bell.')).state;
    expect(decode(captureEditor(state).source)).toBe('\ufeff!A bell.\n');
    state = command(state, undo);
    expect(Array.from(captureEditor(state).source)).toEqual([239, 187, 191]);
    expect(captureEditor(state).selection!.head.byteOffset).toBe(3);
  });

  it('recovery draft types and Shot are source metadata in EditorState; partial text can complete without lost intent', () => {
    let document = codec.parseFountain(bytes('\n@A\nSignal.\n\n!Shot.\n'));
    document = codec.replaceLine(document, 2, {
      kind: 'parenthetical',
      text: '(quiet',
    });
    document = codec.replaceLine(document, 4, {
      kind: 'action',
      text: 'Shot.',
      actionSubtype: 'shot',
    });
    let state = createEditorState(document.bytes, document.recovery);
    expect(state.doc.child(2).type.name).toBe('parenthetical');
    expect(state.doc.child(4).attrs.actionSubtype).toBe('shot');
    state = select(state, 2, 6);
    state = applyEditorTransaction(state, state.tr.insertText(')')).state;
    expect(
      captureEditor(state).document.lines[2]!.intendedKind,
    ).toBeUndefined();
    expect(decode(captureEditor(state).source)).toContain('(quiet)');
  });

  it('invalid UTF-8 is view-only, with exact source copy and no invented Unicode byte anchors', () => {
    const original = new Uint8Array([0x61, 0xff, 0x62]);
    const state = createEditorState(original);
    expect(captureEditor(state).selection).toBeNull();
    expect(Array.from(captureEditor(state).source)).toEqual([0x61, 0xff, 0x62]);
    expect(
      applyEditorTransaction(state, state.tr.insertText('x', 1)).accepted,
    ).toBe(false);
  });

  it('capture byte/range/selection derivatives are frozen or owned copies', () => {
    const state = createEditorState(bytes('\n!Original.\n'));
    const capture = captureEditor(state);
    capture.source.fill(0);
    expect(decode(capture.source)).toBe('\n!Original.\n');
    expect(Object.isFrozen(capture.ranges[0])).toBe(true);
    expect(Object.isFrozen(capture.selection!.head)).toBe(true);
  });

  it('typing in a 6000-row state does not call parser, full serialization or byte encoding in dispatch', () => {
    const state = createEditorState(
      bytes(
        Array.from({ length: 6000 }, (_, index) => `!Line ${index}.`).join(
          '\n',
        ),
      ),
    );
    const parseSpy = vi.spyOn(codec, 'parseFountain');
    const serializeSpy = vi.spyOn(codec, 'serializeFountain');
    const replaceSpy = vi.spyOn(codec, 'replaceLines');
    const encodeSpy = vi.spyOn(TextEncoder.prototype, 'encode');
    const result = applyEditorTransaction(
      state,
      state.tr.insertText('X', position(state, 3000, 2)),
    );
    expect(result.accepted).toBe(true);
    expect(parseSpy).not.toHaveBeenCalled();
    expect(serializeSpy).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
    expect(encodeSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('mounted view owns live edits and reports refusals without accepting paste/drop or duplicating editor authority', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const changed = vi.fn();
    const refused = vi.fn();
    const view = mountScreenplayEditor(
      host,
      createEditorState(bytes('\n!A bell.\n')),
      { changed, refused },
    );
    view.dispatch(view.state.tr.insertText('X', position(view.state, 1)));
    expect(view.state.doc.child(1).textContent).toBe('XA bell.');
    expect(changed).toHaveBeenCalledTimes(1);
    view.dispatch(view.state.tr.split(position(view.state, 1, 2)));
    expect(refused).toHaveBeenCalledTimes(1);
    expect(
      view.someProp('handlePaste', (handle) =>
        handle(view, new Event('paste') as ClipboardEvent, null!),
      ),
    ).toBe(true);
    view.destroy();
    host.remove();
  });
});

describe('asynchronous version/session-bound captures', () => {
  it('still captures when a hidden window never delivers an animation frame', async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', () => 123);
    vi.stubGlobal('cancelAnimationFrame', cancel);
    try {
      const state = createEditorState(bytes('!A bell.\n'));
      const boundary = new EditorCaptureBoundary(() => state, {
        hash: async () => 'a'.repeat(64),
      });
      const pending = boundary.capture({ latest: true });
      await vi.advanceTimersByTimeAsync(32);
      expect((await pending).status).toBe('current');
      expect(cancel).toHaveBeenCalledWith(123);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
  it('coalesces pending production input before serialization and still binds the resulting immutable version', async () => {
    let current = createEditorState(bytes('!A bell.\n'));
    let release!: () => void;
    const hash = vi.fn(digest);
    const boundary = new EditorCaptureBoundary(() => current, {
      hash,
      defer: () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    });
    const pending = boundary.capture({ latest: true });
    current = applyEditorTransaction(
      current,
      current.tr.insertText('X', 1),
    ).state;
    current = applyEditorTransaction(
      current,
      current.tr.insertText('Y', 2),
    ).state;
    expect(hash).not.toHaveBeenCalled();
    release();
    const result = await pending;
    expect(result.status).toBe('current');
    expect(result.snapshot.version).toBe(editorVersion(current));
    expect(decode(result.snapshot.capture.source)).toBe('!XYA bell.\n');
    expect(hash).toHaveBeenCalledOnce();
  });
  it('defers all source/hash work and labels an old capture stale without altering newer state', async () => {
    let current = createEditorState(bytes('\n!A bell.\n'));
    let release!: () => void;
    const hash = vi.fn(digest);
    const boundary = new EditorCaptureBoundary(() => current, {
      hash,
      defer: () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    });
    const pending = boundary.capture();
    expect(hash).not.toHaveBeenCalled();
    current = applyEditorTransaction(
      current,
      current.tr.insertText('X', position(current, 1)),
    ).state;
    release();
    const result = await pending;
    expect(result.status).toBe('stale');
    expect(decode(result.snapshot.capture.source)).toBe('\n!A bell.\n');
    expect(current.doc.child(1).textContent).toBe('XA bell.');
    expect(boundary.isCurrent(result.snapshot)).toBe(false);
  });

  it('out-of-order hashing, session replacement and fabricated results cannot earn current status', async () => {
    let current = createEditorState(bytes('\n!A bell.\n'));
    const releases: (() => void)[] = [];
    const boundary = new EditorCaptureBoundary(() => current, {
      defer: async () => {},
      hash: (source) =>
        new Promise<string>((resolve) =>
          releases.push(() => {
            void digest(source).then(resolve);
          }),
        ),
    });
    const first = boundary.capture();
    await Promise.resolve();
    current = applyEditorTransaction(
      current,
      current.tr.insertText('X', position(current, 1)),
    ).state;
    const second = boundary.capture();
    await Promise.resolve();
    await expect(boundary.capture()).rejects.toThrow('queue full');
    releases[1]!();
    const latest = await second;
    expect(latest.status).toBe('current');
    releases[0]!();
    expect((await first).status).toBe('stale');
    expect(boundary.isCurrent({ ...latest.snapshot })).toBe(false);
    current = createEditorState(bytes('\n!A bell.\n'));
    current = applyEditorTransaction(
      current,
      current.tr.insertText('X', position(current, 1)),
    ).state;
    expect(editorVersion(current)).toBe(latest.snapshot.version);
    expect(boundary.isCurrent(latest.snapshot)).toBe(false);
  });

  it('immutable IPC snapshots contain exact source/hash, sparse drafting/selection metadata and no full source mirror', async () => {
    const state = createEditorState(bytes('\n!A bell.\n'));
    const boundary = new EditorCaptureBoundary(() => state, {
      hash: digest,
      defer: async () => {},
    });
    const result = await boundary.capture();
    expect(result.snapshot.sourceSha256).toBe(
      await digest(bytes('\n!A bell.\n')),
    );
    expect(Object.isFrozen(result.snapshot)).toBe(true);
    const sourceCopy = result.snapshot.source as number[];
    sourceCopy.fill(0);
    expect(result.snapshot.source).toEqual(Array.from(bytes('\n!A bell.\n')));
    expect(result.snapshot.sourceSha256).toBe(
      await digest(bytes('\n!A bell.\n')),
    );
    expect(Object.isFrozen(result.snapshot.draftMetadata)).toBe(true);
    expect(JSON.stringify(result.snapshot.draftMetadata)).not.toContain(
      'A bell.',
    );
    expect(boundary.isCurrent(result.snapshot)).toBe(true);
  });

  it('sparse drafting metadata is bounded without truncating source or clearing live state', async () => {
    const source = bytes(
      Array.from({ length: 2000 }, () => '!Shot.').join('\n'),
    );
    const original = codec.parseFountain(source);
    let current = createEditorState(source, {
      ...original.recovery,
      lines: original.recovery.lines.map((line) => ({
        ...line,
        actionSubtype: 'shot' as const,
      })),
    });
    const boundary = new EditorCaptureBoundary(() => current, {
      hash: digest,
      defer: async () => {},
    });
    await expect(boundary.capture()).rejects.toThrow('metadata bound');
    expect(Array.from(copyEditorDraft(current).originalSource)).toEqual(
      Array.from(source),
    );
    current = createEditorState(bytes('\n!Small.\n'));
    expect((await boundary.capture()).status).toBe('current');
  });

  it('hash rejection releases admission and only owned byte copies reach the hasher', async () => {
    const current = createEditorState(bytes('\n!A bell.\n'));
    let calls = 0;
    const boundary = new EditorCaptureBoundary(() => current, {
      defer: async () => {},
      hash: async (source) => {
        calls++;
        if (calls === 1) throw new Error('Synthetic hash failure');
        source.fill(0);
        return digest(bytes('\n!A bell.\n'));
      },
    });
    await expect(boundary.capture()).rejects.toThrow('Synthetic hash failure');
    const captured = await boundary.capture();
    expect(decode(captured.snapshot.capture.source)).toBe('\n!A bell.\n');
    expect(captured.status).toBe('current');
  });

  it('hash failure/invalid result releases admission, retains the live state and leaves a copy route', async () => {
    const current = createEditorState(bytes('\n!A bell.\n'));
    const boundary = new EditorCaptureBoundary(() => current, {
      defer: async () => {},
      hash: async () => 'invalid',
    });
    for (let index = 0; index < 3; index++)
      await expect(boundary.capture()).rejects.toThrow('Invalid source hash');
    expect(decode(copyEditorDraft(current).originalSource)).toBe(
      '\n!A bell.\n',
    );
  });
});
