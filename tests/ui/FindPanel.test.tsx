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
import { highlightCheckIssues } from '../../src/editor/scriptCheck';
import { evaluateScriptCheck } from '../../src/domain/scriptCheck';
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
async function replaceFixture(source: string, query: string) {
  const f = await fixture(source);
  f.controller.configure({ ...defaultFindOptions, query }, true);
  await waitFor(() => expect(f.controller.state.phase).toBe('current'));
  return f;
}

function replacePanel(f: Awaited<ReturnType<typeof fixture>>) {
  const onReplaceOne = vi.fn();
  const onReplaceAll = vi.fn();
  const ui = render(
    <FindPanel
      controller={f.controller}
      state={f.controller.state}
      disabled={false}
      onNavigate={vi.fn()}
      onClose={vi.fn()}
      onReplaceOne={onReplaceOne}
      onReplaceAll={onReplaceAll}
    />,
  );
  return { ui, onReplaceOne, onReplaceAll };
}

it('previews replaceable/excluded counts and applies replace-all through the plan', async () => {
  const f = await replaceFixture(
    'Title: moon\n\n!moon shines.\n[[moon]]\n/*moon*/\n',
    'moon',
  );
  const { onReplaceAll } = replacePanel(f);
  fireEvent.change(screen.getByLabelText('Replace with'), {
    target: { value: 'sun' },
  });
  expect(screen.getByText(/2 replaceable · 2 excluded/)).toBeTruthy();
  expect(screen.getByText(/Title page form/)).toBeTruthy();
  expect(screen.getByText(/protected omission/)).toBeTruthy();
  const replaceAll = screen.getByRole('button', { name: 'Replace all' });
  expect((replaceAll as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(replaceAll);
  expect(onReplaceAll).toHaveBeenCalledTimes(1);
  const plan = onReplaceAll.mock.calls[0]![0];
  expect(plan.replacement).toBe('sun');
  expect(plan.edits).toHaveLength(2);
  expect(plan.refused).toHaveLength(2);
  expect(plan.large).toBe(false);
  f.controller.dispose();
});

it('replaces only the active match and refuses invalid or composing replacements', async () => {
  const f = await replaceFixture('!moon and moon\n', 'moon');
  expect(
    f.controller.navigate(1, (projection, match) =>
      navigateFind(f.view, projection, match),
    ),
  ).toBe(true);
  const onReplaceOne = vi.fn();
  const onReplaceAll = vi.fn();
  const ui = render(
    <FindPanel
      controller={f.controller}
      state={f.controller.state}
      disabled={false}
      onNavigate={vi.fn()}
      onClose={vi.fn()}
      onReplaceOne={onReplaceOne}
      onReplaceAll={onReplaceAll}
    />,
  );
  fireEvent.change(screen.getByLabelText('Replace with'), {
    target: { value: 'sun' },
  });
  const replaceMatch = screen.getByRole('button', { name: 'Replace match' });
  expect((replaceMatch as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(replaceMatch);
  expect(onReplaceOne).toHaveBeenCalledTimes(1);
  expect(onReplaceOne.mock.calls[0]![1]).toBe(0);
  fireEvent.change(screen.getByLabelText('Replace with'), {
    target: { value: 'a[[b' },
  });
  expect(screen.getByText(/valid replacement/)).toBeTruthy();
  ui.rerender(
    <FindPanel
      controller={f.controller}
      state={f.controller.state}
      disabled={false}
      onNavigate={vi.fn()}
      onClose={vi.fn()}
      onReplaceOne={onReplaceOne}
      onReplaceAll={onReplaceAll}
    />,
  );
  expect(
    (screen.getByRole('button', { name: 'Replace match' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(
    (screen.getByRole('button', { name: 'Replace all' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.change(screen.getByLabelText('Replace with'), {
    target: { value: 'sun' },
  });
  fireEvent.compositionStart(screen.getByLabelText('Replace with'));
  fireEvent.keyDown(screen.getByLabelText('Replace with'), { key: 'Enter' });
  expect(onReplaceOne).toHaveBeenCalledTimes(1);
  fireEvent.compositionEnd(screen.getByLabelText('Replace with'));
  fireEvent.keyUp(screen.getByLabelText('Replace with'), { key: 'Enter' });
  fireEvent.keyDown(screen.getByLabelText('Replace with'), { key: 'Enter' });
  expect(onReplaceOne).toHaveBeenCalledTimes(2);
  f.controller.dispose();
});

it('requires explicit confirmation for large replace-all and honors disabled state', async () => {
  const f = await replaceFixture('!moon\n'.repeat(150), 'moon');
  expect(f.controller.state.matches).toHaveLength(150);
  const onReplaceAll = vi.fn();
  render(
    <FindPanel
      controller={f.controller}
      state={f.controller.state}
      disabled={false}
      onNavigate={vi.fn()}
      onClose={vi.fn()}
      onReplaceOne={vi.fn()}
      onReplaceAll={onReplaceAll}
    />,
  );
  fireEvent.change(screen.getByLabelText('Replace with'), {
    target: { value: 'sun' },
  });
  expect(screen.getByText(/needs confirmation/)).toBeTruthy();
  const confirm = screen.getByRole('button', {
    name: 'Confirm replace all 150 matches',
  });
  fireEvent.click(confirm);
  expect(onReplaceAll).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Replace all' }));
  expect(onReplaceAll).toHaveBeenCalledTimes(1);
  cleanup();
  render(
    <FindPanel
      controller={f.controller}
      state={f.controller.state}
      disabled={false}
      onNavigate={vi.fn()}
      onClose={vi.fn()}
      onReplaceOne={vi.fn()}
      onReplaceAll={vi.fn()}
      replaceDisabled
      replaceMessage="Replacement is unavailable for this version."
    />,
  );
  fireEvent.change(screen.getByLabelText('Replace with'), {
    target: { value: 'sun' },
  });
  expect(
    (
      screen.getByRole('button', {
        name: 'Confirm replace all 150 matches',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(screen.getByRole('alert').textContent).toContain('unavailable');
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

it('AUDIT-C356 keeps independently cleared check and find sets without state or Undo writes', async () => {
  const f = await fixture('!moon moon moon\n\n@ORPHAN');
  const before = f.view.state;
  const issues = evaluateScriptCheck(
    f.projection.snapshot.capture.document,
  ).issues;
  highlightFind(f.view, f.projection, f.controller.state.matches, 0);
  highlightCheckIssues(f.view, null, []);
  expect(document.querySelectorAll('.find-highlight')).toHaveLength(3);
  highlightCheckIssues(f.view, f.projection, issues);
  const checks = document.querySelectorAll('.check-highlight').length;
  expect(checks).toBeGreaterThan(0);
  highlightFind(f.view, null, [], -1);
  expect(document.querySelectorAll('.check-highlight')).toHaveLength(checks);
  expect(f.view.state).toBe(before);
  expect(undoDepth(f.view.state)).toBe(0);
  f.controller.dispose();
});
