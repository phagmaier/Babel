import { createHash } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import { undo } from 'prosemirror-history';
import { EditorCaptureBoundary } from '../../src/application/editorCapture';
import { ManuscriptProjectionController } from '../../src/application/manuscriptProjection';
import { buildManuscriptIndex } from '../../src/domain/manuscriptIndex';
import {
  createEditorState,
  editorOrigin,
  editorVersion,
  sourceImportTransaction,
  applyEditorTransaction,
} from '../../src/editor/state';
import { smartKeyTransaction } from '../../src/editor/commands';
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const bytes = (text: string) => new TextEncoder().encode(text);
function setup(source = '.INT. LAB - DAY\n!Draft.\n') {
  let state = createEditorState(bytes(source));
  const stamp = () => ({
    session: editorOrigin(state).session,
    version: editorVersion(state),
    doc: state.doc,
  });
  const build = vi.fn(
    (snapshot: Parameters<ManuscriptProjectionController['accept']>[0]) =>
      buildManuscriptIndex(snapshot.capture.document),
  );
  const controller = new ManuscriptProjectionController(stamp, vi.fn(), build);
  const boundary = new EditorCaptureBoundary(() => state, {
    defer: async () => {},
    hash: async (source) => createHash('sha256').update(source).digest('hex'),
  });
  return {
    controller,
    build,
    stamp,
    boundary,
    get state() {
      return state;
    },
    set state(next) {
      state = next;
    },
  };
}
it('coalesces one pending build, binds session/version/hash, and reuses only an identical immutable document for selection changes', async () => {
  vi.useFakeTimers();
  const f = setup();
  const snapshot = (await f.boundary.capture()).snapshot;
  f.controller.accept(snapshot, f.stamp());
  f.controller.accept(snapshot, f.stamp());
  expect(f.build).not.toHaveBeenCalled();
  vi.runAllTimers();
  expect(f.build).toHaveBeenCalledTimes(1);
  const first = f.controller.state.projection!;
  expect(first.sourceSha256).toBe(snapshot.sourceSha256);
  f.state = f.state.apply(
    f.state.tr.setSelection(TextSelection.create(f.state.doc, 2)),
  );
  f.controller.changedDraft();
  expect(f.controller.isCurrent(first)).toBe(false);
  const selected = (await f.boundary.capture()).snapshot;
  f.controller.accept(selected, f.stamp());
  vi.runAllTimers();
  expect(f.controller.state.projection!.index).toBe(first.index);
  expect(f.build).toHaveBeenCalledTimes(1);
  f.controller.dispose();
});
it('rejects foreign same-version captures and pending results after editing, Undo, import/restore, session replacement and disposal', async () => {
  vi.useFakeTimers();
  const f = setup();
  const foreign = setup();
  f.controller.accept(
    (await foreign.boundary.capture()).snapshot,
    foreign.stamp(),
  );
  vi.runAllTimers();
  expect(f.build).not.toHaveBeenCalled();
  const old = (await f.boundary.capture()).snapshot,
    stamp = f.stamp();
  f.controller.accept(old, stamp);
  f.state = f.state.apply(f.state.tr.insertText('X', 1));
  f.controller.changedDraft();
  vi.runAllTimers();
  f.controller.accept(old, stamp);
  vi.runAllTimers();
  expect(f.build).not.toHaveBeenCalled();
  f.controller.accept((await f.boundary.capture()).snapshot, f.stamp());
  vi.runAllTimers();
  const edited = f.controller.state.projection!;
  undo(f.state, (tr) => {
    f.state = applyEditorTransaction(f.state, tr).state;
  });
  f.controller.changedDraft();
  expect(f.controller.isCurrent(edited)).toBe(false);
  f.controller.accept((await f.boundary.capture()).snapshot, f.stamp());
  f.state = applyEditorTransaction(
    f.state,
    sourceImportTransaction(
      f.state,
      bytes('.EXT. NEW - DAY\n'),
      editorVersion(f.state) + 1,
    ),
  ).state;
  f.controller.changedDraft();
  vi.runAllTimers();
  expect(f.build).toHaveBeenCalledTimes(1);
  f.controller.accept((await f.boundary.capture()).snapshot, f.stamp());
  f.state = createEditorState(bytes('.EXT. SWITCH - DAY\n'));
  vi.runAllTimers();
  expect(f.build).toHaveBeenCalledTimes(1);
  f.controller.accept((await f.boundary.capture()).snapshot, f.stamp());
  f.controller.dispose();
  vi.runAllTimers();
  expect(f.build).toHaveBeenCalledTimes(1);
});
it('keeps uncapturable accepted text in the editor and marks the old projection unavailable', async () => {
  vi.useFakeTimers();
  const f = setup('@MAYA\n(softly)\nHello.\n');
  f.controller.accept((await f.boundary.capture()).snapshot, f.stamp());
  vi.runAllTimers();
  const prior = f.controller.state.projection;
  const p = f.state.doc.child(0).nodeSize + 5;
  f.state = f.state.apply(
    f.state.tr.setSelection(TextSelection.create(f.state.doc, p)),
  );
  f.state = applyEditorTransaction(
    f.state,
    smartKeyTransaction(f.state, 'Enter').transaction!,
  ).state;
  f.controller.changedDraft();
  await expect(f.boundary.capture()).rejects.toThrow();
  f.controller.unavailable();
  expect(f.controller.state.phase).toBe('unavailable');
  expect(f.controller.state.projection).toBe(prior);
  expect(f.state.doc.textContent).toBe('MAYA(softly)Hello.');
  expect(f.controller.isCurrent(prior!)).toBe(false);
});
it('isolates index bounds/failure from capture and never publishes a partial current projection', async () => {
  vi.useFakeTimers();
  const f = setup();
  f.build.mockImplementation(() => {
    throw new RangeError('bound');
  });
  f.controller.accept((await f.boundary.capture()).snapshot, f.stamp());
  vi.runAllTimers();
  expect(f.controller.state).toMatchObject({
    phase: 'unavailable',
    projection: null,
  });
});
it('lets navigation render before derivative work, then captures the latest edits with exact current version/hash', async () => {
  vi.useFakeTimers();
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  let state = createEditorState(bytes('!Draft.\n'));
  const hash = vi.fn(async (source: Uint8Array) =>
    createHash('sha256').update(source).digest('hex'),
  );
  const boundary = new EditorCaptureBoundary(() => state, { hash });
  const pending = boundary.capture({ latest: true, afterPaint: true });
  expect(frames).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(0);
  frames[0]!(0);
  expect(hash).not.toHaveBeenCalled();
  state = state.apply(state.tr.insertText('X', 1));
  frames[1]!(16);
  expect(hash).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  const result = await pending;
  expect(result.status).toBe('current');
  expect(result.snapshot.version).toBe(editorVersion(state));
  expect(result.snapshot.source).toEqual(Array.from(bytes('!XDraft.\n')));
  expect(result.snapshot.sourceSha256).toBe(
    createHash('sha256').update(bytes('!XDraft.\n')).digest('hex'),
  );
});
it('keeps navigation capture live in a hidden window via its bounded fallback', async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 7),
  );
  const cancel = vi.fn();
  vi.stubGlobal('cancelAnimationFrame', cancel);
  const state = createEditorState(bytes('!Retained.\n'));
  const hash = vi.fn(async (source: Uint8Array) =>
    createHash('sha256').update(source).digest('hex'),
  );
  const boundary = new EditorCaptureBoundary(() => state, { hash });
  const pending = boundary.capture({ latest: true, afterPaint: true });
  await vi.advanceTimersByTimeAsync(63);
  expect(hash).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect((await pending).status).toBe('current');
  expect(cancel).toHaveBeenCalledWith(7);
});
