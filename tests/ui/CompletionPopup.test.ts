import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import { undo, undoDepth } from 'prosemirror-history';
import type { EditorView } from 'prosemirror-view';
import { createCompletionPopup } from '../../src/app/CompletionPopup';
import { createEditorState } from '../../src/editor/state';
import { mountScreenplayEditor } from '../../src/editor/view';
import { captureEditor } from '../../src/editor/sourceBridge';
import { ShortcutRegistry } from '../../src/application/shortcuts';
let view: EditorView;
let popup: ReturnType<typeof createCompletionPopup>;
const source = '\n@MAYA\nHi.\n\n@MARY\nHello.\n\n@MA\n';
const read = () => new TextDecoder().decode(captureEditor(view.state).source);
function key(key: string, options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  view.dom.dispatchEvent(event);
  return event;
}
function caret(row = 7) {
  const pos =
    1 +
    view.state.doc.content.content
      .slice(0, row)
      .reduce((n, node) => n + node.nodeSize, 0) +
    view.state.doc.child(row).textContent.length;
  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)),
  );
}
function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  popup = createCompletionPopup(document.body);
  view = mountScreenplayEditor(
    host,
    createEditorState(new TextEncoder().encode(source)),
    {
      completion: popup.controller,
      shortcuts: new ShortcutRegistry('other'),
      escapeFocus: () => host.focus(),
    },
  );
  vi.spyOn(view, 'coordsAtPos').mockReturnValue({
    left: 40,
    right: 40,
    top: 20,
    bottom: 40,
  });
  popup.bind(view);
  view.focus();
  caret();
  vi.runOnlyPendingTimers();
}
beforeEach(() => {
  vi.useFakeTimers();
  mount();
});
afterEach(() => {
  popup.destroy();
  view.destroy();
  document.body.replaceChildren();
  vi.useRealTimers();
});
describe('anchored completion and input priorities (JSDOM)', () => {
  it('opens without mutation, labels selection and Escape dismisses with no undo', () => {
    expect(read()).toBe(source);
    expect(undoDepth(view.state)).toBe(0);
    expect(
      document.querySelector('[role=listbox]')?.getAttribute('data-segment'),
    ).toBe('character');
    expect(view.dom.getAttribute('aria-activedescendant')).toBeTruthy();
    expect(key('Escape').defaultPrevented).toBe(true);
    expect(document.querySelector<HTMLElement>('[role=listbox]')!.hidden).toBe(
      true,
    );
    expect(read()).toBe(source);
    expect(undoDepth(view.state)).toBe(0);
    popup.controller.changed(view);
    vi.runOnlyPendingTimers();
    expect(popup.controller.offer).toBeNull();
  });
  it('navigates, accepts Enter once and second Enter performs smart transition', () => {
    expect(popup.controller.offer?.items).toEqual(['MARY', 'MAYA']);
    expect(key('ArrowDown').defaultPrevented).toBe(true);
    expect(key('Enter').defaultPrevented).toBe(true);
    expect(read()).toBe(source.replace('@MA\n', '@MAYA\n'));
    expect(view.state.doc.childCount).toBe(8);
    vi.runOnlyPendingTimers();
    expect(popup.controller.offer).toBeNull();
    key('Enter');
    expect(view.state.doc.childCount).toBe(9);
    expect(view.state.selection.$from.parent.type.name).toBe('dialogue');
  });
  it('Tab accepts without type cycle, unselected/unavailable menu falls through', () => {
    key('ArrowDown');
    key('Tab');
    expect(view.state.selection.$from.parent.type.name).toBe('character');
    expect(read()).toBe(source.replace('@MA\n', '@MAYA\n'));
    popup.controller.dismiss();
    key('Tab');
    expect(view.state.selection.$from.parent.type.name).toBe('sceneHeading');
  });
  it('mouse acceptance preserves writing focus and undo/caret', () => {
    const before = view.state.selection.from;
    const option = [...document.querySelectorAll('[role=option]')].find(
      (item) => item.textContent === 'MAYA',
    )!;
    const event = new MouseEvent('mousedown', {
      button: 0,
      bubbles: true,
      cancelable: true,
    });
    option.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(view.hasFocus()).toBe(true);
    expect(read()).toBe(source.replace('@MA\n', '@MAYA\n'));
    expect(view.state.selection.from).toBe(before + 2);
    undo(view.state, (tr) => view.dispatch(tr));
    expect(read()).toBe(source);
    expect(view.state.selection.from).toBe(before);
  });
  it('isolates completion from immediately preceding and following typing', () => {
    key('Escape');
    view.dispatch(view.state.tr.insertText('Y'));
    vi.runOnlyPendingTimers();
    const index = popup.controller.offer!.items.indexOf('MAYA');
    popup.controller.accept(index);
    view.dispatch(view.state.tr.insertText('X'));
    undo(view.state, (tr) => view.dispatch(tr));
    expect(read()).toBe(source.replace('@MA\n', '@MAYA\n'));
    undo(view.state, (tr) => view.dispatch(tr));
    expect(read()).toBe(source.replace('@MA\n', '@MAY\n'));
    undo(view.state, (tr) => view.dispatch(tr));
    expect(read()).toBe(source);
  });
  it('ordinary keys and explicit shortcuts retain their priority', () => {
    expect(key('x').defaultPrevented).toBe(false);
    key('2', { ctrlKey: true });
    expect(view.state.selection.$from.parent.type.name).toBe('action');
    expect(popup.controller.offer).toBeNull();
    expect(key('Enter', { isComposing: true }).defaultPrevented).toBe(false);
  });
  it('hides on a composing/dead key even if the WebView omitted compositionstart', () => {
    expect(popup.controller.offer).not.toBeNull();
    expect(key('Enter', { isComposing: true }).defaultPrevented).toBe(false);
    expect(popup.controller.offer).toBeNull();
    expect(read()).toBe(source);
    caret();
    vi.runOnlyPendingTimers();
    expect(popup.controller.offer).not.toBeNull();
    expect(key('Dead').defaultPrevented).toBe(false);
    expect(popup.controller.offer).toBeNull();
  });
  it('does not insert by elapsed time and unselected Tab follows the contextual cycle', () => {
    vi.advanceTimersByTime(10000);
    expect(read()).toBe(source);
    popup.controller.selected = -1;
    key('Tab');
    expect(view.state.selection.$from.parent.type.name).toBe('sceneHeading');
    expect(view.state.doc.child(7).textContent).toBe('MA');
  });
  it('suppresses IME menu/keys/mouse and guarded post-composition Enter', () => {
    const old = document.querySelector('[role=option]')!;
    view.dom.dispatchEvent(
      new CompositionEvent('compositionstart', { bubbles: true }),
    );
    expect(popup.controller.offer).toBeNull();
    key('Enter', { isComposing: true });
    old.dispatchEvent(
      new MouseEvent('mousedown', {
        button: 0,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(read()).toBe(source);
    view.dom.dispatchEvent(
      new CompositionEvent('compositionend', { bubbles: true }),
    );
    key('Enter');
    expect(read()).toBe(source);
    vi.runOnlyPendingTimers();
    expect(popup.controller.offer).toBeNull();
  });
  it('refuses paste, hides suggestions and a paste-marked transaction does not reopen', () => {
    view.someProp('handlePaste', (handler) =>
      handler(view, new Event('paste') as ClipboardEvent, undefined as never),
    );
    expect(popup.controller.offer).toBeNull();
    expect(read()).toBe(source);
    view.dispatch(view.state.tr.insertText('Y').setMeta('paste', true));
    vi.runOnlyPendingTimers();
    expect(popup.controller.offer).toBeNull();
  });
  it('ranks recently used established cues after deferred edits without merging spelling', () => {
    caret(1);
    view.dispatch(view.state.tr.insertText('X'));
    vi.runOnlyPendingTimers();
    view.dispatch(
      view.state.tr.delete(
        view.state.selection.from - 1,
        view.state.selection.from,
      ),
    );
    vi.runOnlyPendingTimers();
    caret();
    vi.runOnlyPendingTimers();
    expect(popup.controller.offer?.items).toEqual(['MAYA', 'MARY']);
    expect(read()).toBe(source);
  });
  it('stale mouse options and deferred results cannot accept after caret/version change', () => {
    const old = [...document.querySelectorAll('[role=option]')].find(
      (item) => item.textContent === 'MAYA',
    )!;
    caret(1);
    vi.runOnlyPendingTimers();
    old.dispatchEvent(
      new MouseEvent('mousedown', {
        button: 0,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(read()).toBe(source);
    view.dispatch(view.state.tr.insertText('Z'));
    view.dispatch(view.state.tr.insertText('Q'));
    vi.runOnlyPendingTimers();
    expect(popup.controller.offer).toBeNull();
  });
  it('cleans pending work and ARIA on teardown', () => {
    caret();
    popup.destroy();
    vi.runOnlyPendingTimers();
    expect(document.querySelector('[role=listbox]')).toBeNull();
    expect(view.dom.hasAttribute('aria-controls')).toBe(false);
  });
});
