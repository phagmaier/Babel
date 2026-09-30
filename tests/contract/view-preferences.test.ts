import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ViewPreferences,
  defaultViewSettings,
  viewStorageKey,
} from '../../src/application/viewPreferences';
import { TypewriterScroll } from '../../src/editor/presentation';
import { mountScreenplayEditor } from '../../src/editor/view';
import { createEditorState, editorVersion } from '../../src/editor/state';
import { captureEditor } from '../../src/editor/sourceBridge';
import { undoDepth } from 'prosemirror-history';
import { TextSelection } from 'prosemirror-state';

function store(raw: string | null = null) {
  return {
    getItem: vi.fn(() => raw),
    setItem: vi.fn((_key: string, value: string) => {
      raw = value;
    }),
  };
}
afterEach(() => vi.restoreAllMocks());
describe('M4-10 UI-only preferences', () => {
  it('roundtrips only the versioned UI schema after successful writes', () => {
    const storage = store();
    const p = new ViewPreferences(storage);
    expect(p.getSnapshot().settings).toEqual(defaultViewSettings);
    expect(
      p.update({ theme: 'dark', zoom: 150, focus: true, typewriter: true }),
    ).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith(
      viewStorageKey,
      JSON.stringify({
        version: 1,
        settings: { theme: 'dark', zoom: 150, focus: true, typewriter: true },
      }),
    );
    expect(new ViewPreferences(storage).getSnapshot().settings).toEqual(
      p.getSnapshot().settings,
    );
    expect(Object.isFrozen(p.getSnapshot().settings)).toBe(true);
  });
  it.each([
    'null',
    '{',
    JSON.stringify({ version: 2, settings: defaultViewSettings }),
    JSON.stringify({
      version: 1,
      settings: { ...defaultViewSettings, zoom: 201 },
    }),
    JSON.stringify({
      version: 1,
      settings: { ...defaultViewSettings, theme: 'invalid' },
    }),
    JSON.stringify({
      version: 1,
      settings: { ...defaultViewSettings, focus: 'yes' },
    }),
    JSON.stringify({
      version: 1,
      settings: { ...defaultViewSettings, manuscript: 'secret' },
    }),
    JSON.stringify({
      version: 1,
      settings: defaultViewSettings,
      path: '/private',
    }),
    ' '.repeat(513),
  ])(
    'retains corrupt/unknown stored bytes and exposes defaults with an error (%s)',
    (raw) => {
      const storage = store(raw);
      const p = new ViewPreferences(storage);
      expect(p.getSnapshot().settings).toEqual(defaultViewSettings);
      expect(p.getSnapshot().error).toContain('could not be read');
      expect(storage.setItem).not.toHaveBeenCalled();
    },
  );
  it('retains prior working settings on failed write, publishes errors and recovers explicitly', () => {
    const storage = store();
    const p = new ViewPreferences(storage);
    const listener = vi.fn();
    const unsubscribe = p.subscribe(listener);
    p.update({ zoom: 125 });
    const before = p.getSnapshot().settings;
    storage.setItem.mockImplementationOnce(() => {
      throw new Error('quota');
    });
    expect(p.update({ focus: true })).toBe(false);
    expect(p.getSnapshot().settings).toBe(before);
    expect(p.getSnapshot().error).toContain('could not be stored');
    expect(p.update({ zoom: Number.NaN })).toBe(false);
    expect(p.getSnapshot().settings).toBe(before);
    expect(p.update({ focus: true })).toBe(true);
    expect(p.getSnapshot().error).toBe('');
    expect(listener).toHaveBeenCalledTimes(4);
    unsubscribe();
  });
  it('isolates unavailable/denied reads and writes', () => {
    const p = new ViewPreferences({
      getItem() {
        throw new Error();
      },
      setItem() {
        throw new Error();
      },
    });
    expect(p.getSnapshot().error).toBeTruthy();
    expect(p.update({ theme: 'light' })).toBe(false);
    expect(new ViewPreferences().update({ theme: 'dark' })).toBe(false);
  });
});

describe('M4-10 view-only typewriter', () => {
  it('follows intended editing once without changing source/version/selection/Undo and cancels for manual scroll, composition, navigation, dialogs and destruction', () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let next = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callbacks.set(++next, callback);
      return next;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      callbacks.delete(id);
    });
    const flush = () => {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((f) => f(0));
    };
    const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
    const original = new TextEncoder().encode('\ufeff!Action.  \r\n\r\n');
    const host = document.createElement('div');
    document.body.append(host);
    let enabled = true,
      blocked = false;
    const follow = new TypewriterScroll(
      () => enabled,
      () => blocked,
    );
    const view = mountScreenplayEditor(host, createEditorState(original));
    follow.attach(view);
    vi.spyOn(view, 'hasFocus').mockReturnValue(true);
    vi.spyOn(view, 'coordsAtPos').mockReturnValue({
      top: 800,
      bottom: 824,
      left: 1,
      right: 1,
    });
    const selection = view.state.selection,
      state = view.state;
    const signal = () =>
      view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    const queue = () =>
      follow.changed(view, view.state.tr.setSelection(view.state.selection));
    // Programmatic selection and toggling the flag alone never scroll.
    queue();
    flush();
    expect(scroll).not.toHaveBeenCalled();
    signal();
    queue();
    flush();
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(view.state).toBe(state);
    expect(view.state.selection).toBe(selection);
    expect(editorVersion(view.state)).toBe(editorVersion(state));
    expect(undoDepth(view.state)).toBe(0);
    expect(Array.from(captureEditor(view.state).source)).toEqual(
      Array.from(original),
    );
    signal();
    queue();
    window.dispatchEvent(new WheelEvent('wheel'));
    flush();
    signal();
    queue();
    window.dispatchEvent(new Event('pointerdown'));
    flush();
    signal();
    queue();
    follow.changed(view, view.state.tr.setMeta('outlineNavigation', true));
    flush();
    signal();
    queue();
    blocked = true;
    flush();
    blocked = false;
    signal();
    queue();
    enabled = false;
    flush();
    enabled = true;
    signal();
    queue();
    view.updateState(
      view.state.apply(
        view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)),
      ),
    );
    flush();
    expect(scroll).toHaveBeenCalledTimes(1);
    signal();
    view.dom.dispatchEvent(new Event('compositionstart'));
    queue();
    flush();
    view.dom.dispatchEvent(new Event('compositionend'));
    queue();
    flush();
    signal();
    queue();
    follow.destroy();
    flush();
    expect(scroll).toHaveBeenCalledTimes(1);
    view.destroy();
    host.remove();
  });
});
