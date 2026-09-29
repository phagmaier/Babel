import type { EditorState } from 'prosemirror-state';
import { captureEditor, type EditorCapture } from '../editor/sourceBridge';
import { editorOrigin, editorVersion } from '../editor/state';
import type { CapturedSnapshot } from './persistenceController';
import {
  MAX_DRAFT_METADATA_BYTES,
  MAX_SOURCE_BYTES,
  validHash,
} from './persistenceState';

export interface CapturedEditorSnapshot extends CapturedSnapshot {
  readonly capture: EditorCapture;
}
export interface CaptureResult {
  readonly status: 'current' | 'stale';
  readonly snapshot: CapturedEditorSnapshot;
}
type Hasher = (source: Uint8Array) => Promise<string>;
async function sha256(source: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    Uint8Array.from(source).buffer,
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Derived results only: never sets EditorState or clears dirty state. No scheduler/timers policy. */
export class EditorCaptureBoundary {
  private active = 0;
  private readonly origins = new WeakMap<CapturedEditorSnapshot, EditorState>();
  private readonly getState: () => EditorState;
  private readonly hash: Hasher;
  private readonly defer: () => Promise<void>;
  constructor(
    getState: () => EditorState,
    options: { hash?: Hasher; defer?: () => Promise<void> } = {},
  ) {
    this.getState = getState;
    this.hash = options.hash ?? sha256;
    this.defer =
      options.defer ?? (() => new Promise((resolve) => setTimeout(resolve, 0)));
  }
  isCurrent(snapshot: CapturedEditorSnapshot): boolean {
    const source = this.origins.get(snapshot);
    const current = this.getState();
    return Boolean(
      source &&
      editorOrigin(source).session === editorOrigin(current).session &&
      editorVersion(source) === editorVersion(current),
    );
  }
  async capture(): Promise<CaptureResult> {
    if (this.active >= 2) throw new RangeError('Editor capture queue full');
    this.active++;
    try {
      return await this.captureState();
    } finally {
      this.active--;
    }
  }
  private async captureState(): Promise<CaptureResult> {
    const state = this.getState();
    await this.defer();
    const capture = captureEditor(state);
    const bytes = capture.source;
    if (bytes.length > MAX_SOURCE_BYTES)
      throw new RangeError('Editor capture exceeds native source bound');
    const sourceSha256 = await this.hash(bytes.slice());
    if (!validHash(sourceSha256)) throw new Error('Invalid source hash result');
    // Persist only sparse drafting intent. IDs are session aids; no full manuscript mirror in metadata.
    const drafts = capture.document.lines.flatMap((line, index) =>
      line.intendedKind || line.actionSubtype
        ? [
            Object.freeze({
              index,
              ...(line.intendedKind ? { intendedKind: line.intendedKind } : {}),
              ...(line.actionSubtype
                ? { actionSubtype: line.actionSubtype }
                : {}),
            }),
          ]
        : [],
    );
    const draftMetadata = Object.freeze({
      schema: 'babel-editor-capture-v1',
      sourceSha256,
      selection: capture.selection
        ? Object.freeze({
            anchor: Object.freeze({ ...capture.selection.anchor }),
            head: Object.freeze({ ...capture.selection.head }),
          })
        : null,
      virtualPlaceholder: capture.document.lines.length === 0,
      drafts: Object.freeze(drafts),
    });
    if (
      new TextEncoder().encode(JSON.stringify(draftMetadata)).length >
      MAX_DRAFT_METADATA_BYTES
    )
      throw new RangeError('Editor capture exceeds native metadata bound');
    const snapshot: CapturedEditorSnapshot = Object.freeze({
      version: capture.version,
      source: Object.freeze(Array.from(bytes)),
      sourceSha256,
      draftMetadata,
      capture,
    });
    this.origins.set(snapshot, state);
    return Object.freeze({
      status: this.isCurrent(snapshot) ? 'current' : 'stale',
      snapshot,
    });
  }
}
