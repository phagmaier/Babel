import { expect, it } from 'vitest';
import { TextSelection, type EditorState } from 'prosemirror-state';
import { undo, redo, undoDepth } from 'prosemirror-history';
import { parseFountain, semanticView } from '../../src/domain/fountainCodec';
import { buildManuscriptIndex } from '../../src/domain/manuscriptIndex';
import { planSourceMove, readyMove } from '../../src/domain/sceneMoves';
import {
  createEditorState,
  editorOrigin,
  editorVersion,
  applyEditorTransaction,
} from '../../src/editor/state';
import { captureEditor } from '../../src/editor/sourceBridge';
import { prepareEditorMove } from '../../src/editor/sceneMoves';
import { EditorCaptureBoundary } from '../../src/application/editorCapture';
import type { ManuscriptProjection } from '../../src/application/manuscriptProjection';
const bytes = (s: string) => new TextEncoder().encode(s);
const text = (b: Uint8Array) =>
  new TextDecoder('utf-8', { ignoreBOM: true }).decode(b);
function domain(
  source: string,
  itemLabel: string,
  targetLabel: string,
  placement: 'before' | 'after' = 'before',
) {
  const doc = parseFountain(bytes(source));
  const index = buildManuscriptIndex(doc);
  const request = {
    itemId: index.items.find((i) => i.label === itemLabel)!.id,
    targetId: index.items.find((i) => i.label === targetLabel)!.id,
    placement,
  };
  return { doc, index, request, review: planSourceMove(doc, index, request) };
}
async function projection(state: EditorState): Promise<ManuscriptProjection> {
  const snapshot = (
    await new EditorCaptureBoundary(() => state, {
      defer: async () => {},
      hash: async () => 'a'.repeat(64),
    }).capture()
  ).snapshot;
  const rows: { id: string; from: number }[] = [];
  state.doc.forEach((node, at) =>
    rows.push({ id: node.attrs.id as string, from: at + 1 }),
  );
  return {
    session: editorOrigin(state).session,
    version: editorVersion(state),
    doc: state.doc,
    snapshot,
    sourceSha256: snapshot.sourceSha256,
    index: buildManuscriptIndex(snapshot.capture.document),
    rows,
  };
}
it('moves exact scene bytes and attached synopsis/notes/blanks without absorbing an act', () => {
  const source =
    '\ufeffTitle: Test\r\n\r\n# Act I\r\n.INT. A #12#\r\n= A synopsis\r\n!**é🚀**.\r\n[[A note\r\ncontinued]]\r\n  \r\n.INT. B #12#\r\n!B.\r\n\r\n# Act II\r\n.INT. C\r\n!C.\r\n';
  const f = domain(source, 'INT. A', 'INT. B', 'after');
  expect(f.review.status).toBe('ready');
  expect(text(f.review.candidateBytes!)).toBe(
    '\ufeffTitle: Test\r\n\r\n# Act I\r\n.INT. B #12#\r\n!B.\r\n\r\n.INT. A #12#\r\n= A synopsis\r\n!**é🚀**.\r\n[[A note\r\ncontinued]]\r\n  \r\n# Act II\r\n.INT. C\r\n!C.\r\n',
  );
  expect(text(f.review.movedBytes)).toBe(
    '.INT. A #12#\r\n= A synopsis\r\n!**é🚀**.\r\n[[A note\r\ncontinued]]\r\n  \r\n',
  );
  expect(
    f.review.ambiguities.filter((a) => a.moves).map((a) => a.from),
  ).toEqual([6, 7, 8]);
  expect([...f.doc.bytes]).toEqual([...bytes(source)]);
  const copy = f.review.candidateBytes!;
  copy.fill(0);
  expect(text(f.review.candidateBytes!)).toContain('!B.');
});
it('moves a whole nested section subtree and preserves blank/newline bytes', () => {
  const f = domain(
    '# A\n.INT. ONE\n!One.\n\n## Nested\n= Nested synopsis\n.INT. TWO\n!Two.\n\n# B\n.INT. THREE\n!Three.\n\n',
    'A',
    'B',
    'after',
  );
  expect(f.review.status).toBe('ready');
  expect(text(f.review.candidateBytes!)).toBe(
    '# B\n.INT. THREE\n!Three.\n\n# A\n.INT. ONE\n!One.\n\n## Nested\n= Nested synopsis\n.INT. TWO\n!Two.\n\n',
  );
  expect(f.review.rows).toBe(9);
});
it('moves intact dual dialogue, omitted and raw content without conversion', () => {
  const f = domain(
    '.INT. A\n\n@ADA\n**Left.**\n\n@BEA ^\n_Right._\n\n/* omitted\ntext */\n!Before [[mixed note]] after\n\n.INT. B\n!B.\n\n',
    'INT. A',
    'INT. B',
    'after',
  );
  expect(f.review.status).toBe('ready');
  expect(text(f.review.candidateBytes!)).toBe(
    '.INT. B\n!B.\n\n.INT. A\n\n@ADA\n**Left.**\n\n@BEA ^\n_Right._\n\n/* omitted\ntext */\n!Before [[mixed note]] after\n\n',
  );
  const moved = readyMove(f.review).document;
  expect(moved.dialogueGroups.map((g) => [g.id, g.dualWith])).toEqual(
    f.doc.dialogueGroups.map((g) => [g.id, g.dualWith]),
  );
  expect(moved.hiddenRegions.map((r) => r.content)).toEqual(
    f.doc.hiddenRegions.map((r) => r.content),
  );
});
it('supports moving a scene into another section without moving either act boundary', () => {
  const f = domain(
    '# A\n.INT. ONE\n!One.\n\n# B\n.INT. TWO\n!Two.\n\n',
    'INT. ONE',
    'INT. TWO',
    'after',
  );
  expect(f.review.status).toBe('ready');
  expect(text(f.review.candidateBytes!)).toBe(
    '# A\n# B\n.INT. TWO\n!Two.\n\n.INT. ONE\n!One.\n\n',
  );
});
it('keeps an unmodified final unterminated row exact when the move does not touch EOF', () => {
  const f = domain(
    '.INT. A\n!A.\n\n.INT. B\n!B.\n\n# End\n!EOF',
    'INT. B',
    'INT. A',
  );
  expect(f.review.status).toBe('ready');
  expect(text(f.review.candidateBytes!)).toBe(
    '.INT. B\n!B.\n\n.INT. A\n!A.\n\n# End\n!EOF',
  );
});
it('refuses unterminated EOF permutations with independent original/candidate review copies', () => {
  const f = domain('.INT. A\n!A.\n\n.INT. B\n!B.', 'INT. B', 'INT. A');
  expect(f.review.status).toBe('refused');
  expect(text(f.review.originalBytes)).toBe('.INT. A\n!A.\n\n.INT. B\n!B.');
  expect(text(f.review.candidateBytes!)).toBe('.INT. B\n!B..INT. A\n!A.\n\n');
  expect(() => readyMove(f.review)).toThrow();
});
it('refuses separator interpretation drift, invalid targets, same position and incompatible sections', () => {
  const drift = domain('INT. A\n\n!A.\n\n.INT. B\n!B.\n', 'INT. B', 'INT. A');
  expect(drift.review.status).toBe('refused');
  expect(drift.review.reason).toContain('meaning');
  const f = domain('# A\n## Nested\n.INT. A\n\n# B\n.INT. B\n\n', 'A', 'B');
  expect(
    planSourceMove(f.doc, f.index, { ...f.request, targetId: f.request.itemId })
      .status,
  ).toBe('refused');
  expect(
    planSourceMove(f.doc, f.index, { ...f.request, targetId: 'missing' })
      .status,
  ).toBe('refused');
  expect(
    planSourceMove(f.doc, f.index, {
      ...f.request,
      targetId: f.index.items[1]!.id,
    }).status,
  ).toBe('refused');
  expect(
    planSourceMove(
      f.doc,
      buildManuscriptIndex(parseFountain(bytes('!Foreign.'))),
      f.request,
    ).status,
  ).toBe('refused');
});
it('applies one Undo/Redo with advancing versions and exact backward selection/source/IDs', async () => {
  const original =
    '\ufeff.INT. A\r\n!**Alpha🚀**.\r\n\r\n.INT. B\r\n!Beta.\r\n\r\n';
  let state = createEditorState(bytes(original));
  // Edit first, to prove move rebases captured source and retains prior Undo provenance.
  state = applyEditorTransaction(state, state.tr.insertText('X', 2)).state;
  const edited = captureEditor(state).source;
  const secondRow = 1 + state.doc.child(0).nodeSize;
  state = applyEditorTransaction(
    state,
    state.tr
      .setSelection(
        TextSelection.create(state.doc, secondRow + 7, secondRow + 2),
      )
      .setMeta('addToHistory', false),
  ).state;
  const before = state;
  const p = await projection(state);
  const move = prepareEditorMove(state, p, {
    itemId: p.index.items[0]!.id,
    targetId: p.index.items[1]!.id,
    placement: 'after',
  });
  expect(move.review.status).toBe('ready');
  const apply = (tr: EditorState['tr']) => {
    state = applyEditorTransaction(state, tr).state;
  };
  apply(move.transaction!);
  expect(undoDepth(state)).toBe(2);
  expect(text(captureEditor(state).source)).toBe(
    '\ufeff.INT. B\r\n!Beta.\r\n\r\n.IXNT. A\r\n!**Alpha🚀**.\r\n\r\n',
  );
  expect(state.selection.anchor - state.selection.head).toBe(5);
  expect(state.doc.child(state.selection.$head.index(0)).attrs.id).toBe(
    before.doc.child(1).attrs.id,
  );
  const movedVersion = editorVersion(state);
  const movedSelection = state.selection.toJSON();
  expect(undo(state, apply)).toBe(true);
  expect(captureEditor(state).source).toEqual(edited);
  expect(state.selection.toJSON()).toEqual(before.selection.toJSON());
  expect(editorVersion(state)).toBeGreaterThan(movedVersion);
  expect(redo(state, apply)).toBe(true);
  expect(state.selection.toJSON()).toEqual(movedSelection);
  expect(captureEditor(state).source).toEqual(move.review.candidateBytes);
  // External reopen reproduces portable order/marks/numbering, independent of editor capture.
  expect(semanticView(parseFountain(captureEditor(state).source))).toEqual(
    semanticView(parseFountain(move.review.candidateBytes!)),
  );
});
it('moves the caret to the moved heading when selection is elsewhere and refuses stale projections', async () => {
  let state = createEditorState(bytes('.INT. A\n!A.\n\n.INT. B\n!B.\n\n'));
  const p = await projection(state);
  const move = prepareEditorMove(state, p, {
    itemId: p.index.items[1]!.id,
    targetId: p.index.items[0]!.id,
    placement: 'before',
  });
  const next = applyEditorTransaction(state, move.transaction!).state;
  expect(next.selection.head).toBe(1);
  expect(next.doc.child(0).attrs.id).toBe(p.index.items[1]!.id);
  state = applyEditorTransaction(
    state,
    state.tr
      .setSelection(TextSelection.create(state.doc, 2))
      .setMeta('addToHistory', false),
  ).state;
  expect(() => prepareEditorMove(state, p, move.review.request)).toThrow(
    'stale',
  );
  expect(() => readyMove({ ...move.review })).toThrow();
});
it('counts the full moved span against row and UTF-8 byte thresholds', async () => {
  for (const [body, large] of [
    [Array(46).fill('!A.\n').join(''), false],
    [Array(48).fill('!A.\n').join(''), true],
    ['!' + 'é'.repeat(8192) + '\n', true],
  ] as const) {
    const state = createEditorState(
      bytes('.INT. A\n' + body + '\n.INT. B\n!B.\n\n'),
    );
    const p = await projection(state);
    const move = prepareEditorMove(state, p, {
      itemId: p.index.items[0]!.id,
      targetId: p.index.items[1]!.id,
      placement: 'after',
    });
    expect(move.review.status).toBe('ready');
    expect(move.large).toBe(large);
  }
});

it('rebases newly authored notes so moving, further note editing and nested Undo remain capturable', async () => {
  const { convertEditorSelection } = await import('../../src/editor/commands');
  let state = createEditorState(
    bytes('.INT. A\n!Note text.\n\n.INT. B\n!B.\n\n'),
  );
  const row = state.doc.child(0).nodeSize + 1;
  state = applyEditorTransaction(
    state,
    state.tr
      .setSelection(TextSelection.create(state.doc, row))
      .setMeta('addToHistory', false),
  ).state;
  const converted = convertEditorSelection(state, 'note');
  expect(converted.transaction).toBeDefined();
  state = applyEditorTransaction(state, converted.transaction!).state;
  const before = captureEditor(state).source;
  expect(text(before)).toBe('.INT. A\n[[Note text.]]\n\n.INT. B\n!B.\n\n');
  const p = await projection(state);
  const move = prepareEditorMove(state, p, {
    itemId: p.index.items[0]!.id,
    targetId: p.index.items[1]!.id,
    placement: 'after',
  });
  expect(move.review.status).toBe('ready');
  state = applyEditorTransaction(state, move.transaction!).state;
  expect(text(captureEditor(state).source)).toBe(
    '.INT. B\n!B.\n\n.INT. A\n[[Note text.]]\n\n',
  );
  let at = 1;
  for (let row = 0; row < 4; row++) at += state.doc.child(row).nodeSize;
  state = applyEditorTransaction(
    state,
    state.tr.insertText('Changed ', at + 2),
  ).state;
  expect(text(captureEditor(state).source)).toBe(
    '.INT. B\n!B.\n\n.INT. A\n[[Changed Note text.]]\n\n',
  );
});
