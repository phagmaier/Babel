import { expect, it, vi } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import {
  RecentPositions,
  positionStorageKey,
  MAX_POSITION_ENTRIES,
  type RecentPosition,
} from '../../src/application/recentPosition';
import { recentSelection } from '../../src/editor/recentPosition';
import { createEditorState } from '../../src/editor/state';
const id = '11111111-1111-4111-8111-111111111111',
  sha = 'a'.repeat(64);
function hint(): RecentPosition {
  return {
    documentId: id,
    sourceSha256: sha,
    anchor: { row: 0, offset: 2 },
    head: { row: 0, offset: 4 },
    viewport: { row: 0, fraction: 0.5 },
  };
}
function fixture() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    }),
  };
  return { data, storage, positions: new RecentPositions(storage) };
}
it('retains bounded identity/hash anchors across restart without content, paths or session handles', () => {
  const f = fixture();
  expect(f.positions.remember(hint())).toBe(true);
  expect(new RecentPositions(f.storage).find(id, sha)).toEqual(hint());
  expect(f.positions.find(id, 'b'.repeat(64))).toBeNull();
  expect(
    f.positions.find('22222222-2222-4222-8222-222222222222', sha),
  ).toBeNull();
  expect(
    Object.keys(
      JSON.parse(f.data.get(positionStorageKey)!).positions[0],
    ).sort(),
  ).toEqual(['anchor', 'documentId', 'head', 'sourceSha256', 'viewport']);
});
it('validates exact hash/identity, row/scalar bounds, direction and checkpoint precedence with fresh source ids', () => {
  const state = createEditorState(
    new TextEncoder().encode('!é🚀 café\r\n!tail\r\n'),
  );
  const h = {
    ...hint(),
    anchor: { row: 0, offset: 4 },
    head: { row: 0, offset: 1 },
  };
  const selection = recentSelection(state, h, id, sha)!;
  expect(selection.anchor).toBe(5);
  expect(selection.head).toBe(2);
  expect(selection instanceof TextSelection).toBe(true);
  for (const bad of [
    { ...h, head: { row: 0, offset: 2 } },
    { ...h, head: { row: 2, offset: 0 } },
    { ...h, head: { row: 0, offset: 99 } },
    { ...h, head: { row: -1, offset: 0 } },
  ])
    expect(recentSelection(state, bad, id, sha)).toBeNull();
  expect(recentSelection(state, h, id, sha, true)).toBeNull();
  expect(recentSelection(state, h, id, 'b'.repeat(64))).toBeNull();
  expect(
    recentSelection(
      state,
      { ...h, documentId: '22222222-2222-4222-8222-222222222222' },
      id,
      sha,
    ),
  ).toBeNull();
});
it('retains corrupt/unknown/oversize/duplicate data, reports unavailable and refuses overwrite', () => {
  for (const raw of [
    '{',
    JSON.stringify({ version: 2, positions: [] }),
    'x'.repeat(48_001),
    JSON.stringify({ version: 1, positions: [hint(), hint()] }),
    JSON.stringify({
      version: 1,
      positions: [{ ...hint(), source: 'manuscript' }],
    }),
  ]) {
    const f = fixture();
    f.data.set(positionStorageKey, raw);
    expect(f.positions.find(id, sha)).toBeNull();
    expect(f.positions.error).toContain('retained');
    expect(f.positions.remember(hint())).toBe(false);
    expect(f.storage.setItem).not.toHaveBeenCalled();
    expect(f.data.get(positionStorageKey)).toBe(raw);
  }
});
it('bounds entries and isolates quota/unavailable/write failures from author protection', () => {
  const f = fixture();
  for (let i = 1; i <= 65; i++)
    expect(
      f.positions.remember({
        ...hint(),
        documentId:
          i.toString(16).padStart(8, '0') + '-1111-4111-8111-111111111111',
      }),
    ).toBe(true);
  expect(JSON.parse(f.data.get(positionStorageKey)!).positions).toHaveLength(
    MAX_POSITION_ENTRIES,
  );
  const prior = f.data.get(positionStorageKey);
  f.storage.setItem.mockImplementation(() => {
    throw Error('Quota');
  });
  expect(f.positions.remember(hint())).toBe(false);
  expect(f.data.get(positionStorageKey)).toBe(prior);
  expect(f.positions.error).toContain('close remain available');
  expect(new RecentPositions().find(id, sha)).toBeNull();
  expect(
    f.positions.remember({ ...hint(), viewport: { row: 0, fraction: NaN } }),
  ).toBe(false);
});

it('captures manual viewport independently of caret, rejects stale/composing frames and restores a bounded row fraction', async () => {
  const { mountScreenplayEditor } = await import('../../src/editor/view');
  const { captureRecentPosition, restoreRecentViewport } =
    await import('../../src/editor/recentPosition');
  const { editorOrigin, editorVersion } =
    await import('../../src/editor/state');
  const host = document.createElement('div');
  document.body.append(host);
  const view = mountScreenplayEditor(
    host,
    createEditorState(new TextEncoder().encode('!first\n!second\n')),
  );
  const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
  try {
    const first = view.dom.children[0] as HTMLElement,
      second = view.dom.children[1] as HTMLElement;
    vi.spyOn(first, 'getBoundingClientRect').mockReturnValue({
      top: -100,
      bottom: -50,
      height: 50,
    } as DOMRect);
    const rect = vi
      .spyOn(second, 'getBoundingClientRect')
      .mockReturnValue({ top: -50, bottom: 30, height: 80 } as DOMRect);
    const stamp = {
      doc: view.state.doc,
      session: editorOrigin(view.state).session,
      version: editorVersion(view.state),
      sourceSha256: sha,
    };
    const h = captureRecentPosition(view, stamp, id)!;
    expect(h.anchor).toEqual({ row: 0, offset: 0 });
    expect(h.viewport).toEqual({ row: 1, fraction: 0.625 });
    let rowTop = 40;
    rect.mockImplementation(
      () => ({ top: rowTop, bottom: rowTop + 80, height: 80 }) as DOMRect,
    );
    scroll.mockImplementation((options) => {
      rowTop -= (options as ScrollToOptions).top ?? 0;
    });
    expect(restoreRecentViewport(view, h)).toBe(true);
    expect(scroll).toHaveBeenCalledWith({ top: 90, behavior: 'instant' });
    expect(
      restoreRecentViewport(view, { ...h, viewport: { row: 99, fraction: 0 } }),
    ).toBe(false);
    Object.defineProperty(view, 'composing', {
      value: true,
      configurable: true,
    });
    expect(captureRecentPosition(view, stamp, id)).toBeNull();
    expect(restoreRecentViewport(view, h)).toBe(false);
    Object.defineProperty(view, 'composing', {
      value: false,
      configurable: true,
    });
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)),
    );
    expect(captureRecentPosition(view, stamp, id)).toBeNull();
  } finally {
    view.destroy();
    host.remove();
    vi.restoreAllMocks();
  }
});

it('corrects the toolbar natural offset once after it becomes sticky, without moving selection or source', async () => {
  const { mountScreenplayEditor } = await import('../../src/editor/view');
  const { restoreRecentViewport } =
    await import('../../src/editor/recentPosition');
  const main = document.createElement('main'),
    header = document.createElement('div'),
    host = document.createElement('div');
  header.className = 'writing-presentation';
  main.append(header, host);
  document.body.append(main);
  const view = mountScreenplayEditor(
      host,
      createEditorState(new TextEncoder().encode('!first\n!second\n')),
    ),
    state = view.state;
  let rowTop = 400,
    headerBottom = 120;
  vi.spyOn(
    view.dom.children[1] as HTMLElement,
    'getBoundingClientRect',
  ).mockImplementation(
    () => ({ top: rowTop, bottom: rowTop + 80, height: 80 }) as DOMRect,
  );
  vi.spyOn(header, 'getBoundingClientRect').mockImplementation(
    () =>
      ({ top: headerBottom - 20, bottom: headerBottom, height: 20 }) as DOMRect,
  );
  const scroll = vi.spyOn(window, 'scrollBy').mockImplementation((options) => {
    rowTop -= (options as ScrollToOptions).top ?? 0;
    headerBottom = 20;
  });
  try {
    expect(
      restoreRecentViewport(view, {
        ...hint(),
        viewport: { row: 1, fraction: 0 },
      }),
    ).toBe(true);
    expect(scroll.mock.calls).toEqual([
      [{ top: 280, behavior: 'instant' }],
      [{ top: 100, behavior: 'instant' }],
    ]);
    expect(rowTop).toBe(20);
    expect(view.state).toBe(state);
  } finally {
    view.destroy();
    main.remove();
    vi.restoreAllMocks();
  }
});
