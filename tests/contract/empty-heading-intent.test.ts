import { describe, expect, it } from 'vitest';
import { closeHistory, redo, undo } from 'prosemirror-history';
import { TextSelection, type EditorState } from 'prosemirror-state';
import { EditorCaptureBoundary } from '../../src/application/editorCapture';
import {
  editorRecovery,
  verifiedEditorMetadata,
} from '../../src/application/editorMetadata';
import {
  parseFountain,
  replaceLine,
  serializeFountain,
} from '../../src/domain/fountainCodec';
import {
  convertEditorSelection,
  smartKeyTransaction,
} from '../../src/editor/commands';
import { captureEditor } from '../../src/editor/sourceBridge';
import {
  applyEditorTransaction,
  createEditorState,
} from '../../src/editor/state';

const bytes = (text: string) => new TextEncoder().encode(text);
const text = (source: Uint8Array) => new TextDecoder().decode(source);
const kinds = (state: EditorState) =>
  state.doc.content.content.map(
    (node) => `${node.type.name}:${node.textContent}`,
  );
function select(state: EditorState, row: number, offset = 0) {
  const at =
    1 +
    state.doc.content.content
      .slice(0, row)
      .reduce((sum, node) => sum + node.nodeSize, 0) +
    offset;
  return state.apply(
    state.tr.setSelection(TextSelection.create(state.doc, at)),
  );
}
function heading(state: EditorState) {
  const result = convertEditorSelection(state, 'sceneHeading');
  expect(result.transaction, result.reason).toBeDefined();
  return applyEditorTransaction(state, result.transaction!).state;
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

describe('AUDIT-PARK-H-F2 empty heading source and recovery intent', () => {
  it.each([
    ['!Alpha.\n\n!Omega.\n', 1],
    ['\ufeff!Alpha.  \r\n\r\n[[retained\r\nnote]]\r\n', 1],
    ['!Alpha.\n\n', 1],
  ] as const)('keeps exact physical blank bytes in %j', (original, row) => {
    const before = parseFountain(bytes(original));
    const after = replaceLine(before, row, { kind: 'sceneHeading', text: '' });
    expect([...serializeFountain(after)]).toEqual([...bytes(original)]);
    expect(after.lines[row]).toMatchObject({
      kind: 'blank',
      sourceText: '',
      text: '',
      intendedKind: 'sceneHeading',
      blankRole: 'draft',
    });
    expect(after.lines[row]!.id).toBe(before.lines[row]!.id);
    const restored = createEditorState(after.bytes, after.recovery);
    expect(restored.doc.child(row).type.name).toBe('sceneHeading');
    expect([...captureEditor(restored).source]).toEqual([...bytes(original)]);
    expect(createEditorState(after.bytes).doc.child(row).type.name).toBe(
      'action',
    );
  });

  it('new empty heading allows unrelated text capture and sparse hash-bound recovery', async () => {
    let state = select(createEditorState(bytes('!Alpha.\n')), 0, 6);
    const entered = smartKeyTransaction(state, 'Enter');
    expect(entered.transaction, entered.reason).toBeDefined();
    state = applyEditorTransaction(state, entered.transaction!).state;
    state = heading(state);
    state = select(state, 0);
    state = applyEditorTransaction(state, state.tr.insertText('Later. ')).state;
    const snapshot = (await new EditorCaptureBoundary(() => state).capture())
      .snapshot;
    const expected = '!Later. Alpha.\n\n\n';
    expect(snapshot.source).toEqual([...bytes(expected)]);
    expect(snapshot.draftMetadata).toMatchObject({
      schema: 'babel-editor-capture-v1',
      drafts: [{ index: 2, intendedKind: 'sceneHeading' }],
    });
    const metadata = await verifiedEditorMetadata(
      snapshot.source,
      snapshot.draftMetadata,
    );
    const restored = createEditorState(
      bytes(expected),
      editorRecovery(bytes(expected), metadata),
    );
    expect(kinds(restored)).toEqual(kinds(state));
    expect(text(captureEditor(restored).source)).toBe(expected);
  });

  it('multiple headings retain sparse intent at their own exact indexes', async () => {
    const original = '!Alpha.\r\n\r\n!Omega.\r\n\r\n';
    let state = heading(select(createEditorState(bytes(original)), 1));
    state = heading(select(state, 3));
    const snapshot = (await new EditorCaptureBoundary(() => state).capture())
      .snapshot;
    expect(snapshot.source).toEqual([...bytes(original)]);
    expect(snapshot.draftMetadata).toMatchObject({
      drafts: [
        { index: 1, intendedKind: 'sceneHeading' },
        { index: 3, intendedKind: 'sceneHeading' },
      ],
    });
  });

  it('completion, Undo and Redo preserve exact source and current intent at every step', () => {
    let state = heading(select(createEditorState(bytes('!Alpha.\n\n')), 1));
    const empty = captureEditor(state);
    expect(text(empty.source)).toBe('!Alpha.\n\n');
    state = state.apply(closeHistory(state.tr));
    state = applyEditorTransaction(state, state.tr.insertText('HALL')).state;
    const complete = captureEditor(state);
    expect(text(complete.source)).toBe('!Alpha.\n.HALL\n');
    expect(complete.document.lines[1]!.intendedKind).toBeUndefined();
    state = step(state, undo);
    expect(kinds(state)).toEqual(['action:Alpha.', 'sceneHeading:']);
    expect(text(captureEditor(state).source)).toBe('!Alpha.\n\n');
    expect(captureEditor(state).document.lines[1]!.intendedKind).toBe(
      'sceneHeading',
    );
    state = step(state, redo);
    expect(text(captureEditor(state).source)).toBe('!Alpha.\n.HALL\n');
    expect(
      captureEditor(state).document.lines[1]!.intendedKind,
    ).toBeUndefined();
  });

  it('conversion back to Action drops heading intent without changing blank bytes', () => {
    let state = heading(select(createEditorState(bytes('!Alpha.\n\n')), 1));
    const captured = captureEditor(state);
    state = createEditorState(captured.source, captured.document.recovery);
    state = select(state, 1);
    const result = convertEditorSelection(state, 'action');
    expect(result.transaction, result.reason).toBeDefined();
    state = applyEditorTransaction(state, result.transaction!).state;
    expect(text(captureEditor(state).source)).toBe('!Alpha.\n\n');
    expect(
      captureEditor(state).document.lines[1]!.intendedKind,
    ).toBeUndefined();
  });

  it('deleting an unnumbered heading text retains its physical row and empty intent', () => {
    const before = parseFountain(bytes('!Alpha.\n.HALL\n'));
    const after = replaceLine(before, 1, { kind: 'sceneHeading', text: '' });
    expect(text(after.bytes)).toBe('!Alpha.\n\n');
    expect(after.lines[1]!.intendedKind).toBe('sceneHeading');
  });

  it('stale, duplicated, nonempty, whitespace and protected intent cannot reinterpret source', async () => {
    const original = bytes('!Alpha.\n\n  \n[[note]]\n');
    const captured = (
      await new EditorCaptureBoundary(() =>
        createEditorState(original),
      ).capture()
    ).snapshot;
    const metadata = {
      ...(captured.draftMetadata as object),
      drafts: [{ index: 1, intendedKind: 'sceneHeading' }],
    };
    expect(
      await verifiedEditorMetadata(
        [...bytes('!Changed.\n\n  \n[[note]]\n')],
        metadata,
      ),
    ).toBeUndefined();
    for (const index of [0, 2, 3]) {
      const recovery = editorRecovery(original, {
        ...metadata,
        drafts: [{ index, intendedKind: 'sceneHeading' }],
      });
      const parsed = parseFountain(original, recovery);
      expect(
        parsed.lines.every((line) => line.intendedKind === undefined),
      ).toBe(true);
      expect(
        parsed.diagnostics.some((d) => d.code === 'recovery-mismatch'),
      ).toBe(true);
      expect([...parsed.bytes]).toEqual([...original]);
    }
    expect(
      editorRecovery(original, {
        drafts: [metadata.drafts[0]!, metadata.drafts[0]!],
      }),
    ).toBeUndefined();
  });

  it('empty unterminated EOF and a retained production number remain refused', () => {
    for (const original of ['.HALL', '.HALL #12#\n']) {
      const before = parseFountain(bytes(original));
      expect(() =>
        replaceLine(before, 0, { kind: 'sceneHeading', text: '' }),
      ).toThrow();
      expect([...before.bytes]).toEqual([...bytes(original)]);
    }
  });
});
