import { afterEach, expect, it, vi } from 'vitest';
import {
  parseFountain,
  serializeFountain,
} from '../../src/domain/fountainCodec';
import {
  buildManuscriptIndex,
  logicalByteAt,
} from '../../src/domain/manuscriptIndex';
import {
  defaultFindOptions,
  findSlices,
  MAX_FIND_MATCHES,
  MAX_FIND_QUERY,
} from '../../src/domain/find';
import { FindController } from '../../src/application/find';
import type { ManuscriptProjection } from '../../src/application/manuscriptProjection';
import {
  createEditorState,
  editorOrigin,
  editorVersion,
} from '../../src/editor/state';
const bytes = (text: string) => new TextEncoder().encode(text);
const index = (text: string) =>
  buildManuscriptIndex(parseFountain(bytes(text)));
const matches = (source: string, query: string, options = {}, row = -1) =>
  [
    ...findSlices(
      index(source),
      { ...defaultFindOptions, query, ...options },
      row,
    ),
  ].flat();
afterEach(() => vi.useRealTimers());
it('matches decoded emphasis/escaped literals across marks, without delimiter syntax or physical/hidden boundaries', () => {
  const source =
    '\ufeffTitle: **Red** moon\r\n\r\n!Red **moon** \\* 🚀.\r\n[[Red moon]]\n/*Red moon*/\n!Red [[moon]] tail\n!Red\n!moon';
  const result = matches(source, 'Red moon');
  expect(
    result.map((m) => [m.location.scope, m.location.row, m.from, m.to]),
  ).toEqual([
    ['title', 0, 0, 8],
    ['body', 2, 0, 8],
    ['note', 3, 0, 8],
    ['omitted', 4, 0, 8],
  ]);
  expect(matches(source, '**')).toEqual([]);
  expect(matches(source, '[[')).toEqual([]);
  expect(matches(source, 'Red\nmoon')).toEqual([]);
  const rocket = matches(source, '🚀')[0]!;
  expect(rocket.to - rocket.from).toBe(2);
  expect(logicalByteAt(rocket.location, rocket.from)).toBe(
    bytes('\ufeffTitle: **Red** moon\r\n\r\n!Red **moon** \\* ').length,
  );
  expect(Array.from(serializeFountain(parseFountain(bytes(source))))).toEqual(
    Array.from(bytes(source)),
  );
});
it('includes raw mixed fragments separately and applies every explicit hidden filter', () => {
  const source =
    'Title: moon\n\n!moon\n[[moon]]\n/*moon*/\n!moon [[moon]] moon';
  expect(matches(source, 'moon').map((m) => m.location.scope)).toEqual([
    'title',
    'body',
    'note',
    'omitted',
    'raw',
    'note',
    'raw',
  ]);
  expect(
    matches(source, 'moon', {
      title: false,
      note: false,
      omitted: false,
      raw: false,
    }).map((m) => m.location.scope),
  ).toEqual(['body']);
  expect(matches('[[unfinished moon', 'moon')[0]!.location.scope).toBe('note');
});
it('documents Unicode lowercase, no normalization/full folding, scalar and whole-word boundaries', () => {
  const source = '!É é é İ i ẞ ß ss 中文 文 abc_abc abc-abc 🚀abc🚀 𐐀 𐐨';
  expect(matches(source, 'é', { wholeWord: true })).toHaveLength(2);
  expect(matches(source, 'é', { wholeWord: true })).toHaveLength(1);
  expect(matches(source, 'é', { caseSensitive: true })).toHaveLength(1);
  expect(matches(source, 'i', { wholeWord: true })).toHaveLength(1);
  expect(matches(source, 'i̇', { wholeWord: true })).toHaveLength(1);
  expect(matches(source, 'ß', { wholeWord: true })).toHaveLength(2);
  expect(matches(source, 'ss', { wholeWord: true })).toHaveLength(1);
  expect(matches(source, '文', { wholeWord: true })).toHaveLength(1);
  expect(matches(source, 'abc', { wholeWord: true })).toHaveLength(3);
  expect(matches(source, '𐐨', { wholeWord: true })).toHaveLength(2);
  expect(() => matches(source, '\ud83d')).toThrow('incomplete Unicode');
  expect(matches('!aaaa', 'aa')).toHaveLength(2);
});
it('uses half-open scene boundaries, ends at section headings and refuses out-of-scene scope', () => {
  const source =
    'Title: moon\n\n.INT. ONE - DAY\n!moon\n[[moon]]\n# moon\n!moon\n.INT. TWO - DAY\n!moon';
  expect(
    matches(source, 'moon', { scope: 'scene' }, 4).map((m) => m.location.row),
  ).toEqual([3, 4]);
  expect(
    matches(source, 'moon', { scope: 'scene' }, 8).map((m) => m.location.row),
  ).toEqual([8]);
  expect(() => matches(source, 'moon', { scope: 'scene' }, 6)).toThrow(
    'outside a scene',
  );
});
it('bounds queries/results honestly, handles empty/no-match, and retains boundary-spanning long-row matches', () => {
  expect(matches('!draft', '')).toEqual([]);
  expect(matches('!draft', 'absent')).toEqual([]);
  expect(() => matches('!draft', 'a'.repeat(MAX_FIND_QUERY + 1))).toThrow(
    'Query exceeds',
  );
  expect(() => matches('!' + 'a '.repeat(MAX_FIND_MATCHES + 1), 'a')).toThrow(
    'More than 10,000',
  );
  const source = '!' + 'x'.repeat(16_382) + '🚀needle' + 'x'.repeat(30_000);
  expect(matches(source, '🚀needle').map((m) => [m.from, m.to])).toEqual([
    [16_382, 16_390],
  ]);
});
function projectionFixture(source: string) {
  const state = createEditorState(bytes(source));
  return {
    session: editorOrigin(state).session,
    version: editorVersion(state),
    doc: state.doc,
    index: index(source),
    sourceSha256: 'test',
    rows: [],
    snapshot: {},
  } as unknown as ManuscriptProjection;
}
it('coalesces/cancels query jobs and refuses old sessions, edits, Undo/import/restore stamps and disposal', () => {
  vi.useFakeTimers();
  const projection = projectionFixture('!moon moon');
  let stamp = {
    session: projection.session,
    version: projection.version,
    doc: projection.doc,
  };
  const changed = vi.fn();
  const controller = new FindController(() => stamp, changed);
  controller.setProjection({ phase: 'current', projection, message: '' }, 0);
  controller.configure({ ...defaultFindOptions, query: 'moon' }, true);
  controller.configure({ ...defaultFindOptions, query: 'absent' }, true);
  vi.runAllTimers();
  expect(controller.state.matches).toHaveLength(0);
  controller.configure({ ...defaultFindOptions, query: 'moon' }, true);
  stamp = { ...stamp, version: stamp.version + 1 };
  vi.runAllTimers();
  expect(controller.state.phase).toBe('pending');
  expect(controller.navigate(1, vi.fn())).toBe(false);
  stamp = {
    session: projection.session,
    version: projection.version,
    doc: projection.doc,
  };
  controller.setProjection({ phase: 'current', projection, message: '' }, 0);
  vi.runAllTimers();
  const apply = vi.fn(() => true);
  expect(controller.navigate(1, apply)).toBe(true);
  expect(controller.state.active).toBe(0);
  expect(controller.navigate(-1, apply)).toBe(true);
  expect(controller.state.message).toContain('Wrapped');
  expect(controller.navigate(1, () => false)).toBe(false);
  expect(controller.state.active).toBe(1);
  stamp = { ...stamp, session: {} };
  expect(controller.navigate(1, apply)).toBe(false);
  controller.dispose();
  const calls = changed.mock.calls.length;
  controller.configure(defaultFindOptions, true);
  vi.runAllTimers();
  expect(changed).toHaveBeenCalledTimes(calls);
});
it('clears partial results on limit/refusal and exposes uncapturable drafts rather than old locations', () => {
  vi.useFakeTimers();
  const projection = projectionFixture('!' + 'a '.repeat(MAX_FIND_MATCHES + 1));
  const controller = new FindController(() => projection, vi.fn());
  controller.setProjection({ phase: 'current', projection, message: '' }, 0);
  controller.configure({ ...defaultFindOptions, query: 'a' }, true);
  vi.runAllTimers();
  expect(controller.state.phase).toBe('unavailable');
  expect(controller.state.matches).toHaveLength(0);
  expect(controller.state.message).toContain('More than');
  controller.setProjection(
    { phase: 'unavailable', projection, message: '' },
    0,
  );
  expect(controller.state.message).toContain('waiting for current');
});

it('rebinds branded immutable selection snapshots with exact metadata/hash and rejects changed/foreign contents', async () => {
  const { EditorCaptureBoundary } =
    await import('../../src/application/editorCapture');
  const { TextSelection } = await import('prosemirror-state');
  let state = createEditorState(bytes('!é🚀 moon'));
  const hash = vi.fn(async (source: Uint8Array) =>
    (await import('node:crypto'))
      .createHash('sha256')
      .update(source)
      .digest('hex'),
  );
  const boundary = new EditorCaptureBoundary(() => state, {
    defer: async () => {},
    hash,
  });
  const first = (await boundary.capture()).snapshot;
  state = state.apply(
    state.tr.setSelection(TextSelection.create(state.doc, 5, 9)),
  );
  const selected = boundary.rebindSelection(first)!;
  expect(selected.version).toBe(editorVersion(state));
  expect(selected.capture.document).toBe(first.capture.document);
  expect(selected.source).toEqual(first.source);
  expect(selected.sourceSha256).toBe(first.sourceSha256);
  expect(selected.capture.selection?.anchor.utf16Offset).toBe(4);
  expect(selected.capture.selection?.head.utf16Offset).toBe(8);
  expect(selected.draftMetadata).toMatchObject({
    selection: { anchor: { utf16Offset: 4 }, head: { utf16Offset: 8 } },
  });
  expect(hash).toHaveBeenCalledTimes(1);
  const other = new EditorCaptureBoundary(() => state);
  expect(other.rebindSelection(selected)).toBeNull();
  // Repeated rebinding retains one source root, rather than a growing getter chain.
  let repeated = selected;
  for (let at = 0; at < 12_000; at++)
    repeated = boundary.rebindSelection(repeated)!;
  expect(repeated.source).toEqual(first.source);
  state = state.apply(state.tr.insertText('X', 1));
  expect(boundary.rebindSelection(selected)).toBeNull();
  state = createEditorState(bytes('!é🚀 moon'));
  expect(boundary.rebindSelection(selected)).toBeNull();
});
