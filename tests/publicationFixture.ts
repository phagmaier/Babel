import { createHash } from 'node:crypto';
import { vi } from 'vitest';
import { EditorCaptureBoundary } from '../src/application/editorCapture';
import { ManuscriptProjectionController } from '../src/application/manuscriptProjection';
import {
  createEditorState,
  editorOrigin,
  editorVersion,
} from '../src/editor/state';
import {
  PUBLICATION_FONTS,
  PUBLICATION_FONT_SET,
  PUBLICATION_PROFILE,
  type PublicationRequest,
  type PublicationResult,
} from '../src/application/publication';
export function publicationResult(r: PublicationRequest): PublicationResult {
  return {
    identity: r.identity,
    requestId: r.requestId,
    version: r.version,
    sourceSha256: r.sourceSha256,
    sourceBytes: r.source.length,
    artifact: `render-1-${r.requestId}`,
    pageCount: 2,
    profile: PUBLICATION_PROFILE,
    profileFrozen: true,
    fontSet: PUBLICATION_FONT_SET,
    renderer: { python: '3.13.16', screenplain: '0.12.0', reportlab: '4.4.7' },
    fonts: PUBLICATION_FONTS,
    sourceMap: 'unsupported',
    warnings: [],
  };
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
export async function previewFixture() {
  let state = createEditorState(
    new TextEncoder().encode('INT. LAB - DAY\n\nA light.\n'),
  );
  const identity = {
    handle: 'handle',
    documentId: 'doc',
    sessionId: 'session',
  };
  const stamp = () => ({
    session: editorOrigin(state).session,
    version: editorVersion(state),
    doc: state.doc,
  });
  const boundary = new EditorCaptureBoundary(() => state, {
    defer: async () => {},
    hash: async (bytes) => createHash('sha256').update(bytes).digest('hex'),
  });
  const projection = new ManuscriptProjectionController(stamp, vi.fn());
  async function capture() {
    projection.accept((await boundary.capture()).snapshot, stamp());
    await vi.advanceTimersByTimeAsync(0);
    return projection.state;
  }
  return {
    identity,
    stamp,
    capture,
    get state() {
      return state;
    },
    set state(value) {
      state = value;
    },
  };
}
