import { createHash } from 'node:crypto';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { undoDepth, undo } from 'prosemirror-history';
import type { EditorView } from 'prosemirror-view';
import { FindPanel } from '../../src/app/FindPanel';
import { FindController } from '../../src/application/find';
import { ManuscriptProjectionController } from '../../src/application/manuscriptProjection';
import { EditorCaptureBoundary } from '../../src/application/editorCapture';
import {
  createEditorState,
  editorOrigin,
  editorVersion,
} from '../../src/editor/state';
import { mountScreenplayEditor } from '../../src/editor/view';
import { captureEditor } from '../../src/editor/sourceBridge';
import { highlightFind, navigateFind } from '../../src/editor/find';
import { defaultFindOptions, findSlices } from '../../src/domain/find';
import { buildManuscriptIndex } from '../../src/domain/manuscriptIndex';
let view: EditorView | undefined;
afterEach(() => {
  cleanup();
  view?.destroy();
  view = undefined;
  document.body.replaceChildren();
});
async function fixture(source: string, canNavigate = true) {
  const host = document.createElement('div');
  document.body.append(host);
  view = mountScreenplayEditor(
    host,
    createEditorState(new TextEncoder().encode(source)),
    { canEdit: () => false, canNavigate: () => canNavigate },
  );
  const current = view;
  current.setProps({ handleScrollToSelection: () => true });
  const stamp = () => ({
    session: editorOrigin(current.state).session,
    version: editorVersion(current.state),
    doc: current.state.doc,
  });
  const projections = new ManuscriptProjectionController(stamp, vi.fn());
  const boundary = new EditorCaptureBoundary(() => current.state, {
    defer: async () => {},
    hash: async (bytes) => createHash('sha256').update(bytes).digest('hex'),
  });
  projections.accept((await boundary.capture()).snapshot, stamp());
  await waitFor(() => expect(projections.state.phase).toBe('current'));
  const projection = projections.state.projection!;
  projections.dispose();
  const controller = new FindController(stamp, vi.fn());
  controller.setProjection({ phase: 'current', projection, message: '' }, 0);
  controller.configure({ ...defaultFindOptions, query: 'moon' }, true);
  await waitFor(() => expect(controller.state.phase).toBe('current'));
  return { view: current, projection, controller };
}
it('selects exact rich/title/hidden/raw Unicode ranges, focuses and highlights without bytes, versions or Undo writes', async () => {
  const source =
    '\ufeffTitle: **moon**\r\n\r\n!é🚀 **moon**.\r\n[[moon]]\n/*moon*/\n!moon [[tail]]';
  const f = await fixture(source);
  const expected = [
    [0, 0, 4],
    [2, 4, 8],
    [3, 2, 6],
    [4, 2, 6],
    [5, 1, 5],
  ];
  const originalVersion = editorVersion(f.view.state);
  highlightFind(f.view, f.projection, f.controller.state.matches, 0);
  expect(editorVersion(f.view.state)).toBe(originalVersion);
  expect(document.querySelectorAll('.find-highlight')).toHaveLength(5);
  for (const [i, match] of f.controller.state.matches.entries()) {
    const refreshed = { ...f.projection, version: editorVersion(f.view.state) };
    expect(navigateFind(f.view, refreshed, match)).toBe(true);
    const selection = f.view.state.selection;
    expect([
      selection.$from.index(0),
      selection.$from.parentOffset,
      selection.$to.parentOffset,
    ]).toEqual(expected[i]);
    expect(f.view.hasFocus()).toBe(true);
    expect(undoDepth(f.view.state)).toBe(0);
    expect(Array.from(captureEditor(f.view.state).source)).toEqual(
      Array.from(new TextEncoder().encode(source)),
    );
  }
  f.controller.dispose();
});
it('rejects stale, foreign, composing and frozen targets without replacing selection', async () => {
  const f = await fixture('!moon', false);
  const before = f.view.state;
  expect(
    navigateFind(f.view, f.projection, f.controller.state.matches[0]!),
  ).toBe(false);
  expect(f.view.state).toBe(before);
  expect(
    navigateFind(
      f.view,
      { ...f.projection, session: {} },
      f.controller.state.matches[0]!,
    ),
  ).toBe(false);
  Object.defineProperty(f.view, 'composing', {
    value: true,
    configurable: true,
  });
  expect(
    navigateFind(f.view, f.projection, f.controller.state.matches[0]!),
  ).toBe(false);
  expect(f.view.state).toBe(before);
  f.controller.dispose();
});
it('labels scopes/counts and keyboard navigation, leaves composition local and closes without restoring a saved selection', async () => {
  const f = await fixture('Title: moon\n\n[[moon]]\n/*moon*/\n!moon [[tail]]');
  const navigate = vi.fn(),
    close = vi.fn();
  const ui = render(
    <FindPanel
      controller={f.controller}
      state={f.controller.state}
      disabled={false}
      onNavigate={navigate}
      onClose={close}
    />,
  );
  const input = screen.getByLabelText('Find text');
  expect(document.activeElement).toBe(input);
  expect(screen.getByRole('status').textContent).toContain('4 matches');
  expect(screen.getByText(/Protected raw text/)).toBeTruthy();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(navigate).toHaveBeenLastCalledWith(1);
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
  expect(navigate).toHaveBeenLastCalledWith(-1);
  fireEvent.compositionStart(input);
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(close).not.toHaveBeenCalled();
  fireEvent.compositionEnd(input);
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(navigate).toHaveBeenCalledTimes(2);
  fireEvent.keyUp(input, { key: 'Enter' });
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(close).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByLabelText('Include notes'));
  await waitFor(() => expect(f.controller.state.phase).toBe('current'));
  expect(f.controller.state.matches).toHaveLength(3);
  ui.rerender(
    <FindPanel
      controller={f.controller}
      state={f.controller.state}
      disabled={true}
      onNavigate={navigate}
      onClose={close}
    />,
  );
  expect(
    (screen.getByRole('button', { name: 'Next match' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  f.controller.dispose();
});
it('search navigation leaves an authored edit undoable in one step', async () => {
  const f = await fixture('!moon');
  f.view.setProps({
    dispatchTransaction: (tr) => f.view.updateState(f.view.state.apply(tr)),
  });
  f.view.dispatch(f.view.state.tr.insertText('X', 1));
  // Old locations cannot authorize another document; a newly captured projection can.
  expect(
    navigateFind(f.view, f.projection, f.controller.state.matches[0]!),
  ).toBe(false);
  const boundary = new EditorCaptureBoundary(() => f.view.state, {
    defer: async () => {},
    hash: async (bytes) => createHash('sha256').update(bytes).digest('hex'),
  });
  const snapshot = (await boundary.capture()).snapshot;
  const rows: { id: string; from: number }[] = [];
  f.view.state.doc.forEach((node, position) =>
    rows.push({ id: node.attrs.id, from: position + 1 }),
  );
  const projection = {
    ...f.projection,
    doc: f.view.state.doc,
    version: editorVersion(f.view.state),
    snapshot,
    index: buildManuscriptIndex(snapshot.capture.document),
    rows,
  };
  const match = [
    ...findSlices(
      projection.index,
      { ...defaultFindOptions, query: 'moon' },
      0,
    ),
  ].flat()[0]!;
  const beforeHighlights = f.view.state;
  highlightFind(f.view, projection, [match], 0);
  expect(f.view.state).toBe(beforeHighlights);
  expect(navigateFind(f.view, projection, match)).toBe(true);
  expect(undoDepth(f.view.state)).toBe(1);
  expect(undo(f.view.state, (tr) => f.view.dispatch(tr))).toBe(true);
  expect(Array.from(captureEditor(f.view.state).source)).toEqual(
    Array.from(new TextEncoder().encode('!moon')),
  );
  f.controller.dispose();
});
