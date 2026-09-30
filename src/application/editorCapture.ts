import type { EditorState } from 'prosemirror-state';
import {
  captureEditor,
  copyEditorDraft,
  type EditorCapture,
} from '../editor/sourceBridge';
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

/** Derived results only: never sets EditorState or clears dirty state. No save cadence policy. */
export class EditorCaptureBoundary {
  private active = 0;
  private previousCapture: EditorCapture | undefined;
  private readonly origins = new WeakMap<CapturedEditorSnapshot, EditorState>();
  private readonly getState: () => EditorState;
  private readonly hash: Hasher;
  private readonly defer: (afterPaint?: boolean) => Promise<void>;
  constructor(
    getState: () => EditorState,
    options: {
      hash?: Hasher;
      defer?: (afterPaint?: boolean) => Promise<void>;
    } = {},
  ) {
    this.getState = getState;
    this.hash = options.hash ?? sha256;
    this.defer =
      options.defer ??
      ((afterPaint = false) =>
        new Promise((resolve) => {
          if (typeof requestAnimationFrame !== 'function') {
            setTimeout(resolve, 0);
            return;
          }
          // Let pending input/render callbacks run before whole-source work. The
          // timer keeps hidden windows and close operations independent of rAF.
          const start = () => {
            let frame = 0;
            const fallback = setTimeout(
              () => {
                cancelAnimationFrame(frame);
                resolve();
              },
              afterPaint ? 64 : 32,
            );
            const next = (remaining: number) => {
              frame = requestAnimationFrame(() => {
                if (remaining > 1) next(remaining - 1);
                else {
                  clearTimeout(fallback);
                  setTimeout(resolve, 0);
                }
              });
            };
            next(afterPaint ? 2 : 1);
          };
          // Navigation first finishes its selection/scroll handler and gets
          // a rendered frame. Hidden/frozen callers retain a bounded fallback.
          if (afterPaint) setTimeout(start, 0);
          else start();
        }));
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
  async capture(
    options: { latest?: boolean; afterPaint?: boolean } = {},
  ): Promise<CaptureResult> {
    if (this.active >= 2) throw new RangeError('Editor capture queue full');
    this.active++;
    try {
      return await this.captureState(
        options.latest ?? false,
        options.afterPaint ?? false,
      );
    } finally {
      this.active--;
    }
  }
  /** Explicit emergency preservation, independent of Fountain representability. */
  async captureDraft(): Promise<CapturedSnapshot> {
    const state = this.getState();
    await this.defer();
    const draft = copyEditorDraft(state);
    let originalSourceBase64 = '';
    const source = draft.originalSource;
    for (let at = 0; at < source.length; at += 24 * 1024)
      originalSourceBase64 += btoa(
        String.fromCharCode(...source.subarray(at, at + 24 * 1024)),
      );
    const artifact = new TextEncoder().encode(
      JSON.stringify({
        schema: 'babel-draft-copy-v1',
        version: draft.version,
        originalSourceBase64,
        rows: draft.rows,
        selection: {
          anchor: state.selection.anchor,
          head: state.selection.head,
        },
      }),
    );
    if (artifact.length > MAX_SOURCE_BYTES)
      throw new RangeError(
        'Draft recovery bundle exceeds the 16 MiB copy limit',
      );
    const sourceSha256 = await this.hash(artifact);
    if (!validHash(sourceSha256)) throw new Error('Invalid draft bundle hash');
    if (this.getState() !== state)
      throw new Error('Editor changed during draft preservation');
    return Object.freeze({
      version: draft.version,
      get source() {
        return Array.from(artifact);
      },
      sourceSha256,
      draftMetadata: null,
    });
  }
  private async captureState(
    latest: boolean,
    afterPaint: boolean,
  ): Promise<CaptureResult> {
    let state = this.getState();
    await this.defer(afterPaint);
    if (latest) state = this.getState();
    const capture = captureEditor(state, this.previousCapture);
    this.previousCapture = capture;
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
      // Do not freeze a manuscript-sized indexed array: WebKit visits every
      // property. Private bytes plus owned copies preserve the same isolation.
      get source() {
        return Array.from(bytes);
      },
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
