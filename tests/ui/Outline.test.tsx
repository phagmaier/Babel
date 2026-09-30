import { createHash } from 'node:crypto';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { undo, undoDepth, redoDepth } from 'prosemirror-history';
import type { EditorView } from 'prosemirror-view';
import { parseFountain } from '../../src/domain/fountainCodec';
import { buildManuscriptIndex } from '../../src/domain/manuscriptIndex';
import { Outline, OUTLINE_RENDER_LIMIT } from '../../src/app/Outline';
import { EditorCaptureBoundary } from '../../src/application/editorCapture';
import {
  ManuscriptProjectionController,
  type ProjectionState,
} from '../../src/application/manuscriptProjection';
import {
  createEditorState,
  editorOrigin,
  editorVersion,
} from '../../src/editor/state';
import { mountScreenplayEditor } from '../../src/editor/view';
import { captureEditor } from '../../src/editor/sourceBridge';
import {
  navigateOutline,
  navigateLogicalText,
} from '../../src/editor/outlineNavigation';
let view: EditorView | undefined;
afterEach(() => {
  cleanup();
  view?.destroy();
  view = undefined;
  document.body.replaceChildren();
});
async function fixture(
  source: string,
  observers: Parameters<typeof mountScreenplayEditor>[2] = {},
) {
  const host = document.createElement('div');
  document.body.append(host);
  view = mountScreenplayEditor(
    host,
    createEditorState(new TextEncoder().encode(source)),
    observers,
  );
  const current = view;
  // JSDOM has no Range layout. Verify the request/focus order here; actual
  // caret visibility and scroll geometry are asserted in the WebKit drill.
  const scroll = vi.fn(() => {
    expect(current.hasFocus()).toBe(true);
    return true;
  });
  current.setProps({ handleScrollToSelection: scroll });
  const controller = new ManuscriptProjectionController(
    () => ({
      session: editorOrigin(current.state).session,
      version: editorVersion(current.state),
      doc: current.state.doc,
    }),
    vi.fn(),
  );
  const boundary = new EditorCaptureBoundary(() => current.state, {
    defer: async () => {},
    hash: async (source) => createHash('sha256').update(source).digest('hex'),
  });
  const snapshot = (await boundary.capture()).snapshot;
  controller.accept(snapshot, {
    session: editorOrigin(current.state).session,
    version: editorVersion(current.state),
    doc: current.state.doc,
  });
  await waitFor(() => expect(controller.state.phase).toBe('current'));
  controller.dispose();
  return {
    state: controller.state,
    projection: controller.state.projection!,
    view: current,
    scroll,
  };
}
it('nests sections, collapses children, filters synopsis with ancestors, and distinguishes duplicate authored numbers from ordinals', async () => {
  const f = await fixture(
    '# Act\n## Turn\n.INT. LAB - DAY #7#\n= Secret arrival\n!A.\n.INT. ROOF - DAY #7#\n',
  );
  const navigate = vi.fn();
  render(<Outline state={f.state} onNavigate={navigate} />);
  const first = await screen.findByRole('button', {
    name: 'Go to Scene 1: INT. LAB - DAY',
  });
  await waitFor(() =>
    expect((first as HTMLButtonElement).disabled).toBe(false),
  );
  expect(screen.getAllByText('Authored #7#')).toHaveLength(2);
  expect(
    first
      .closest('ol')!
      .parentElement!.closest('ol')!
      .parentElement!.closest('ol'),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Collapse Turn' }));
  expect(
    screen.queryByRole('button', { name: 'Go to Scene 1: INT. LAB - DAY' }),
  ).toBeNull();
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'secret' },
  });
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Go to Scene 1: INT. LAB - DAY',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  expect(
    screen.queryByRole('button', { name: 'Go to Scene 2: INT. ROOF - DAY' }),
  ).toBeNull();
  fireEvent.click(
    screen.getByRole('button', { name: 'Go to Scene 1: INT. LAB - DAY' }),
  );
  expect(navigate).toHaveBeenCalledWith(f.projection.index.items[2]);
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'nothing matches' },
  });
  expect(await screen.findByText('No outline matches.')).toBeTruthy();
});
it('keeps stale/unavailable results visible and inert; empty and section-only drafts work', async () => {
  const f = await fixture('# Planning\n');
  const navigate = vi.fn();
  const mounted = render(<Outline state={f.state} onNavigate={navigate} />);
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Go to Section: Planning',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  const stale: ProjectionState = {
    phase: 'unavailable',
    projection: f.projection,
    message: 'Earlier results are stale.',
  };
  mounted.rerender(<Outline state={stale} onNavigate={navigate} />);
  const button = screen.getByRole('button', {
    name: 'Go to Section: Planning',
  });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(button);
  expect(navigate).not.toHaveBeenCalled();
  mounted.unmount();
  view!.destroy();
  const empty = await fixture('');
  render(<Outline state={empty.state} onNavigate={navigate} />);
  expect(screen.getByText(/No scenes or sections yet/)).toBeTruthy();
});
it('bounds rendered headings visibly and allows filtering to every heading without truncating the index', async () => {
  const f = await fixture('');
  const source = Array.from(
    { length: OUTLINE_RENDER_LIMIT + 1 },
    (_, i) => `.INT. ROOM ${i} - DAY\n!A.\n`,
  ).join('');
  const index = buildManuscriptIndex(
    parseFountain(new TextEncoder().encode(source)),
  );
  const state = { ...f.state, projection: { ...f.projection, index } };
  render(<Outline state={state} onNavigate={vi.fn()} />);
  await waitFor(() =>
    expect(screen.getByText(/Showing the first 1000/)).toBeTruthy(),
  );
  expect(document.querySelectorAll('.outline-target')).toHaveLength(1000);
  expect(index.items).toHaveLength(1001);
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'ROOM 1000' },
  });
  await waitFor(() => {
    const targets =
      document.querySelectorAll<HTMLButtonElement>('.outline-target');
    expect(targets.length).toBe(1);
    expect(targets[0]!.disabled).toBe(false);
    expect(targets[0]!.getAttribute('aria-label')).toBe(
      'Go to Scene 1001: INT. ROOM 1000 - DAY',
    );
  });
});
it('discloses synopsis/heading excerpts without splitting Unicode or limiting the filter to the excerpts', async () => {
  const label = 'a'.repeat(499) + '🚀 tail';
  const f = await fixture(
    '# ' +
      label +
      '\n' +
      Array.from(
        { length: 12 },
        (_, i) =>
          '= ' + (i === 11 ? 'hidden final synopsis' : `Line ${i}`) + '\n',
      ).join(''),
  );
  render(<Outline state={f.state} onNavigate={vi.fn()} />);
  expect(document.querySelector('.outline-target')!.textContent).toBe(
    'a'.repeat(499) + '… (abbreviated)',
  );
  expect(screen.getByText(/Showing 10 of 12 synopsis lines/)).toBeTruthy();
  expect(f.projection.index.items[0]!.label).toBe(label);
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'hidden final synopsis' },
  });
  await waitFor(() =>
    expect(
      document.querySelector<HTMLButtonElement>('.outline-target')!.disabled,
    ).toBe(false),
  );
  expect(document.querySelectorAll('.outline-target')).toHaveLength(1);
});
it('changes selection and focus only, keeps exact bytes and undo/redo depths, then Undo restores the authored edit', async () => {
  const f = await fixture(
    'Title: T\r\n\r\n.INT. LAB é🚀 - DAY #9#\r\n!A.\r\n.EXT. ROOF - NIGHT\r\n',
  );
  f.view.dispatch(f.view.state.tr.insertText('X', f.projection.rows[3]!.from));
  // Fresh capture after an edit is required, even for a heading whose text is unchanged.
  expect(navigateOutline(f.view, f.projection, 4)).toBe(false);
  const boundary = new EditorCaptureBoundary(() => f.view.state, {
    defer: async () => {},
    hash: async (source) => createHash('sha256').update(source).digest('hex'),
  });
  const snapshot = (await boundary.capture()).snapshot;
  const stamp = {
    session: editorOrigin(f.view.state).session,
    version: editorVersion(f.view.state),
    doc: f.view.state.doc,
  };
  const rows: { id: string; from: number }[] = [];
  f.view.state.doc.forEach((node, p) =>
    rows.push({ id: node.attrs.id, from: p + 1 }),
  );
  const projection = {
    ...f.projection,
    ...stamp,
    snapshot,
    sourceSha256: snapshot.sourceSha256,
    rows,
  };
  const before = captureEditor(f.view.state).source,
    depths = [undoDepth(f.view.state), redoDepth(f.view.state)];
  expect(navigateOutline(f.view, projection, 4)).toBe(true);
  expect(f.view.state.selection.head).toBe(rows[4]!.from);
  expect(f.view.hasFocus()).toBe(true);
  expect(f.scroll).toHaveBeenCalledTimes(1);
  expect(captureEditor(f.view.state).source).toEqual(before);
  expect([undoDepth(f.view.state), redoDepth(f.view.state)]).toEqual(depths);
  undo(f.view.state, (tr) => f.view.dispatch(tr));
  expect(new TextDecoder().decode(captureEditor(f.view.state).source)).toBe(
    'Title: T\r\n\r\n.INT. LAB é🚀 - DAY #9#\r\n!A.\r\n.EXT. ROOF - NIGHT\r\n',
  );
});
it('maps rich Unicode, title, hidden and unknown logical locations exactly and rejects split scalars and stale anchors', async () => {
  const f = await fixture('Title: Title\n\n!é🚀 **bold**\n[[秘密🚀]]\n');
  const title = f.projection.index.texts.find((t) => t.scope === 'title')!;
  expect(navigateLogicalText(f.view, f.projection, title, 5)).toBe(true);
  expect(captureEditor(f.view.state).selection!.head.utf16Offset).toBe(5);
  // Restore original immutable frame purely for testing other anchors; navigation itself increments the version.
  const initial = createEditorState(
    new TextEncoder().encode('Title: Title\n\n!é🚀 **bold**\n[[秘密🚀]]\n'),
  );
  f.view.updateState(initial);
  expect(navigateLogicalText(f.view, f.projection, title, 0)).toBe(false);
  f.view.destroy();
  view = undefined;
  const rich = await fixture('!é🚀 **bold**\n');
  expect(navigateOutline(rich.view, rich.projection, 0, 2)).toBe(false);
  expect(
    navigateLogicalText(
      rich.view,
      rich.projection,
      rich.projection.index.texts[0]!,
      3,
    ),
  ).toBe(true);
  expect(captureEditor(rich.view.state).selection!.head.utf16Offset).toBe(3);
  rich.view.destroy();
  view = undefined;
  const hidden = await fixture('!Before [[秘密🚀]] after\n');
  expect(
    navigateLogicalText(
      hidden.view,
      hidden.projection,
      hidden.projection.index.texts.find((t) => t.scope === 'note')!,
      4,
    ),
  ).toBe(true);
  expect(hidden.view.state.selection.head).toBe(1 + '!Before [[秘密🚀'.length);
});
it('allows explicit read-only selection navigation but refuses mutations, frozen navigation and active composition', async () => {
  let enabled = true;
  const f = await fixture('.INT. LAB - DAY\n!A.\n', {
    canEdit: () => false,
    canNavigate: () => enabled,
  });
  const bytes = captureEditor(f.view.state).source;
  f.view.dispatch(f.view.state.tr.insertText('X', f.projection.rows[1]!.from));
  expect(captureEditor(f.view.state).source).toEqual(bytes);
  enabled = false;
  expect(navigateOutline(f.view, f.projection, 1)).toBe(false);
  enabled = true;
  f.view.dom.dispatchEvent(
    new CompositionEvent('compositionstart', { bubbles: true }),
  );
  expect(navigateOutline(f.view, f.projection, 1)).toBe(false);
  f.view.dom.dispatchEvent(
    new CompositionEvent('compositionend', { bubbles: true }),
  );
  // WebKit's real composition gate is additionally covered in the native drill.
  expect(navigateOutline(f.view, f.projection, 1)).toBe(true);
  expect(f.view.hasFocus()).toBe(true);
  expect(captureEditor(f.view.state).source).toEqual(bytes);
  expect(undoDepth(f.view.state)).toBe(0);
});
