import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { undoDepth } from 'prosemirror-history';
import type { EditorView } from 'prosemirror-view';
import { ScriptCheckPanel } from '../../src/app/ScriptCheckPanel';
import {
  ScriptCheckController,
  visibleIssues,
} from '../../src/application/scriptCheck';
import {
  createEditorState,
  editorOrigin,
  editorVersion,
} from '../../src/editor/state';
import { mountScreenplayEditor } from '../../src/editor/view';
import { captureEditor } from '../../src/editor/sourceBridge';
import {
  highlightCheckIssues,
  navigateCheckIssue,
} from '../../src/editor/scriptCheck';
import type { ManuscriptProjection } from '../../src/application/manuscriptProjection';

let view: EditorView | undefined;
afterEach(() => {
  cleanup();
  view?.destroy();
  view = undefined;
  document.body.replaceChildren();
});

const SOURCE =
  'Title: Check panel\n\n.INT. A - DAY #1#\n@ALICE\n(Hello?)\n.INT. B - DAY #1#\n';

async function fixture(source: string) {
  const host = document.createElement('div');
  document.body.append(host);
  view = mountScreenplayEditor(
    host,
    createEditorState(new TextEncoder().encode(source)),
    { canEdit: () => true, canNavigate: () => true },
  );
  const current = view;
  current.setProps({ handleScrollToSelection: () => true });
  const stamp = () => ({
    session: editorOrigin(current.state).session,
    version: editorVersion(current.state),
    doc: current.state.doc,
  });
  const projection = {
    ...stamp(),
    snapshot: { capture: captureEditor(current.state) },
    rows: (() => {
      const rows: { id: string; from: number }[] = [];
      current.state.doc.forEach((node, position) =>
        rows.push({ id: String(node.attrs.id), from: position + 1 }),
      );
      return rows;
    })(),
    sourceSha256: 'test',
  } as unknown as ManuscriptProjection;
  const controller = new ScriptCheckController(stamp, vi.fn());
  controller.setProjection({ phase: 'current', projection, message: '' });
  controller.run();
  await waitFor(() => expect(controller.state.phase).toBe('current'));
  return { view: current, projection, controller };
}

it('groups counts, filters severities and dismisses advisories only', async () => {
  const f = await fixture(SOURCE);
  const navigate = vi.fn();
  const close = vi.fn();
  render(
    <ScriptCheckPanel
      controller={f.controller}
      state={f.controller.state}
      disabled={false}
      onNavigate={navigate}
      onClose={close}
    />,
  );
  expect(screen.getByRole('status').textContent).toContain(
    '2 warnings · 1 advisories',
  );
  expect(screen.getAllByRole('button', { name: 'Go to issue' })).toHaveLength(
    3,
  );
  // Only the advisory carries a Dismiss control.
  expect(screen.getAllByRole('button', { name: 'Dismiss' })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  expect(visibleIssues(f.controller.state)).toHaveLength(2);
  fireEvent.click(screen.getByLabelText('Show advisories'));
  expect(f.controller.state.showAdvisories).toBe(false);
  f.controller.dispose();
});

it('navigates to the affected block, keeps source and Undo clean, and closes on Escape', async () => {
  const f = await fixture(SOURCE);
  const version = editorVersion(f.view.state);
  const bytes = Array.from(captureEditor(f.view.state).source);
  highlightCheckIssues(f.view, f.projection, visibleIssues(f.controller.state));
  expect(editorVersion(f.view.state)).toBe(version);
  expect(document.querySelectorAll('.check-highlight')).toHaveLength(3);
  const navigate = vi.fn();
  const close = vi.fn();
  const ui = render(
    <ScriptCheckPanel
      controller={f.controller}
      state={f.controller.state}
      disabled={false}
      onNavigate={navigate}
      onClose={close}
    />,
  );
  fireEvent.click(screen.getAllByRole('button', { name: 'Go to issue' })[0]!);
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(navigate.mock.calls[0]![0].code).toBe('SC001');
  const issue = visibleIssues(f.controller.state)[0]!;
  expect(issue.code).toBe('SC001');
  const refreshed = { ...f.projection, version: editorVersion(f.view.state) };
  expect(navigateCheckIssue(f.view, refreshed, issue)).toBe(true);
  // The affected cue block is selected through stable ids, not bare indexes.
  expect(f.view.state.selection.$from.index(0)).toBe(3);
  expect(f.view.state.selection.$to.index(0)).toBe(3);
  expect(
    f.view.state.doc
      .child(3)
      .textContent.slice(
        f.view.state.selection.$from.parentOffset,
        f.view.state.selection.$to.parentOffset,
      ),
  ).toBe('ALICE');
  expect(f.view.hasFocus()).toBe(true);
  expect(undoDepth(f.view.state)).toBe(0);
  expect(Array.from(captureEditor(f.view.state).source)).toEqual(bytes);
  fireEvent.keyDown(document.querySelector('.check-panel')!, {
    key: 'Escape',
  });
  expect(close).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/Export assessment unavailable/)).toBeTruthy();
  ui.unmount();
  f.controller.dispose();
});

it('shows stale results honestly and refuses them until refresh', async () => {
  const f = await fixture(SOURCE);
  // Inside the editable cue row; the title row is protected and would refuse.
  f.view.dispatch(
    f.view.state.tr.insertText('X', f.projection.rows[3]!.from + 1),
  );
  f.controller.setProjection({
    phase: 'current',
    projection: {
      ...f.projection,
      version: editorVersion(f.view.state),
      doc: f.view.state.doc,
    },
    message: '',
  });
  expect(f.controller.state.phase).toBe('stale');
  render(
    <ScriptCheckPanel
      controller={f.controller}
      state={f.controller.state}
      disabled={false}
      onNavigate={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  expect(screen.getByRole('status').textContent).toContain('stale');
  expect(
    (
      screen.getAllByRole('button', {
        name: 'Go to issue',
      })[0] as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  f.controller.dispose();
});

it('creates no issues for an empty draft and declines document-level navigation', async () => {
  const f = await fixture('');
  expect(f.controller.state.report!.issues).toEqual([]);
  expect(screen.queryByRole('status')).toBeNull();
  render(
    <ScriptCheckPanel
      controller={f.controller}
      state={f.controller.state}
      disabled={false}
      onNavigate={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  expect(screen.getByRole('status').textContent).toContain(
    '0 warnings · 0 advisories',
  );
  f.controller.dispose();
});
