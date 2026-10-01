import { createHash } from 'node:crypto';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { undo, undoDepth } from 'prosemirror-history';
import type { EditorView } from 'prosemirror-view';
import { CharacterPanel } from '../../src/app/CharacterPanel';
import { EditorCaptureBoundary } from '../../src/application/editorCapture';
import { ManuscriptProjectionController } from '../../src/application/manuscriptProjection';
import {
  createEditorState,
  editorOrigin,
  editorVersion,
} from '../../src/editor/state';
import { mountScreenplayEditor } from '../../src/editor/view';
import { highlightCharacter } from '../../src/editor/characterFocus';
import { captureEditor } from '../../src/editor/sourceBridge';
import { navigateOutline } from '../../src/editor/outlineNavigation';
import { highlightFind } from '../../src/editor/find';
import { findSlices, defaultFindOptions } from '../../src/domain/find';
let view: EditorView | undefined;
afterEach(() => {
  cleanup();
  view?.destroy();
  view = undefined;
  document.body.replaceChildren();
});
async function fixture() {
  const host = document.createElement('div');
  document.body.append(host);
  view = mountScreenplayEditor(
    host,
    createEditorState(
      new TextEncoder().encode(
        '@Zøë (V.O.)\r\n**Hi** é🚀.\r\n\r\n@ÉVA\r\nOther.\r\n',
      ),
    ),
  );
  const current = view;
  current.setProps({ handleScrollToSelection: () => true });
  const stamp = () => ({
    session: editorOrigin(current.state).session,
    version: editorVersion(current.state),
    doc: current.state.doc,
  });
  const projection = new ManuscriptProjectionController(stamp, vi.fn());
  const boundary = new EditorCaptureBoundary(() => current.state, {
    defer: async () => {},
    hash: async (b) => createHash('sha256').update(b).digest('hex'),
  });
  projection.accept((await boundary.capture()).snapshot, stamp());
  await waitFor(() => expect(projection.state.phase).toBe('current'));
  return { current, projection, boundary, stamp };
}
it('shows exact counts/rules/names, keyboard-native semantic controls and disables stale navigation', async () => {
  const f = await fixture(),
    selected = vi.fn(),
    highlighted = vi.fn(),
    navigate = vi.fn();
  const props = {
    state: f.projection.state,
    selected: 'Zøë',
    highlight: false,
    onSelect: selected,
    onHighlight: highlighted,
    onNavigate: navigate,
  };
  const ui = render(<CharacterPanel {...props} />);
  expect(screen.getByText(/2 characters/)).toBeTruthy();
  expect(screen.getByText('Count inclusion rules')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Character focus'), {
    target: { value: 'ÉVA' },
  });
  expect(selected).toHaveBeenCalledWith('ÉVA');
  fireEvent.click(screen.getByLabelText('Highlight dialogue'));
  expect(highlighted).toHaveBeenCalledWith(true);
  fireEvent.click(screen.getByRole('button', { name: 'Next character cue' }));
  expect(navigate).toHaveBeenCalledWith(
    f.projection.state.projection!.facts.characters[0],
  );
  ui.rerender(
    <CharacterPanel {...props} state={{ ...props.state, phase: 'pending' }} />,
  );
  expect(
    (
      screen.getByRole('button', {
        name: 'Next character cue',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(screen.getByText(/earlier facts are stale/)).toBeTruthy();
  ui.rerender(
    <CharacterPanel
      {...props}
      state={{ ...props.state, phase: 'unavailable' }}
    />,
  );
  expect(screen.getByText(/Counts unavailable/)).toBeTruthy();
  f.projection.dispose();
});
it('focus is view-only, composes with Find, survives navigation refresh, refuses foreign/stale/composing and leaves one-step authored Undo', async () => {
  const f = await fixture(),
    p = f.projection.state.projection!,
    c = p.facts.characters[0]!;
  const before = f.current.state,
    source = captureEditor(before).source;
  highlightCharacter(f.current, p, c);
  expect(f.current.state).toBe(before);
  expect(undoDepth(f.current.state)).toBe(0);
  expect(f.current.dom.querySelectorAll('.character-highlight')).toHaveLength(
    1,
  );
  highlightFind(
    f.current,
    p,
    [...findSlices(p.index, { ...defaultFindOptions, query: 'Hi' }, 0)].flat(),
    0,
  );
  expect(f.current.dom.querySelector('.find-highlight')).toBeTruthy();
  expect(f.current.dom.querySelector('.character-highlight')).toBeTruthy();
  expect(navigateOutline(f.current, p, 3)).toBe(true);
  expect(f.current.hasFocus()).toBe(true);
  expect(captureEditor(f.current.state).source).toEqual(source);
  expect(undoDepth(f.current.state)).toBe(0);
  highlightCharacter(f.current, p, c); // still same version if selection-only versions do not advance
  const snapshot = (await f.boundary.capture()).snapshot;
  f.projection.accept(snapshot, f.stamp());
  await new Promise((r) => setTimeout(r, 5));
  const next = f.projection.state.projection!;
  expect(next.facts).toBe(p.facts);
  highlightCharacter(f.current, next, c);
  expect(f.current.dom.querySelector('.character-highlight')).toBeTruthy();
  Object.defineProperty(f.current, 'composing', {
    value: true,
    configurable: true,
  });
  expect(navigateOutline(f.current, next, 0)).toBe(false);
  highlightCharacter(f.current, null, null);
  expect(f.current.state.doc).toBe(next.doc);
  Object.defineProperty(f.current, 'composing', {
    value: false,
    configurable: true,
  });
  highlightCharacter(f.current, next, { ...c });
  expect(f.current.dom.querySelector('.character-highlight')).toBeNull();
  f.current.dispatch(f.current.state.tr.insertText('x', next.rows[1]!.from));
  highlightCharacter(f.current, next, c);
  expect(f.current.dom.querySelector('.character-highlight')).toBeNull();
  expect(undo(f.current.state, f.current.dispatch)).toBe(true);
  expect(captureEditor(f.current.state).source).toEqual(source);
  expect(undoDepth(f.current.state)).toBe(0);
  f.projection.dispose();
});
