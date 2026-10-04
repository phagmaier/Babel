/** Advisory derivatives from the existing capture path; one pending projection. */
import type { Node as EditorNode } from 'prosemirror-model';
import {
  buildManuscriptIndex,
  type ManuscriptIndex,
} from '../domain/manuscriptIndex';
import type { CapturedEditorSnapshot } from './editorCapture';
import {
  buildCharacterCounts,
  type CharacterCounts,
} from '../domain/characterCounts';
export interface ManuscriptStamp {
  readonly session: object;
  readonly version: number;
  readonly doc: EditorNode;
}
export function sameStamp(a: ManuscriptStamp, b: ManuscriptStamp): boolean {
  return a.session === b.session && a.version === b.version && a.doc === b.doc;
}
export interface ManuscriptProjection extends ManuscriptStamp {
  readonly sourceSha256: string;
  readonly index: ManuscriptIndex;
  readonly facts: CharacterCounts;
  readonly snapshot: CapturedEditorSnapshot;
  readonly rows: readonly { readonly id: string; readonly from: number }[];
}
export interface ProjectionState {
  readonly phase: 'pending' | 'current' | 'unavailable';
  readonly projection: ManuscriptProjection | null;
  readonly message: string;
}
export class ManuscriptProjectionController {
  private live = true;
  private sequence = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: {
    snapshot: CapturedEditorSnapshot;
    stamp: ManuscriptStamp;
  } | null = null;
  state: ProjectionState = {
    phase: 'pending',
    projection: null,
    message: 'Preparing outline…',
  };
  constructor(
    private readonly stamp: () => ManuscriptStamp | null,
    private readonly changed: (state: ProjectionState) => void,
    private readonly build: (
      snapshot: CapturedEditorSnapshot,
    ) => ManuscriptIndex = (snapshot) =>
      buildManuscriptIndex(snapshot.capture.document),
  ) {}
  private update(state: ProjectionState) {
    if (this.live) {
      this.state = Object.freeze(state);
      this.changed(this.state);
    }
  }
  isCurrent(projection: ManuscriptProjection): boolean {
    const current = this.stamp();
    return this.live && Boolean(current && sameStamp(current, projection));
  }
  changedDraft() {
    if (!this.live) return;
    this.sequence++;
    this.pending = null;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.state.phase !== 'pending')
      this.update({
        phase: 'pending',
        projection: this.state.projection,
        message:
          'Outline is updating. Earlier results cannot navigate this version.',
      });
  }
  unavailable() {
    this.changedDraft();
    this.update({
      phase: 'unavailable',
      projection: this.state.projection,
      message:
        'Outline is unavailable for the current draft. Earlier results are stale; all live text remains in the editor.',
    });
  }
  accept(snapshot: CapturedEditorSnapshot, capturedStamp: ManuscriptStamp) {
    if (!this.live) return;
    const stamp = this.stamp();
    if (
      !stamp ||
      stamp.version !== snapshot.version ||
      !sameStamp(stamp, capturedStamp)
    )
      return;
    this.pending = { snapshot, stamp };
    if (this.timer !== null) return;
    const sequence = this.sequence;
    this.timer = setTimeout(() => {
      this.timer = null;
      const pending = this.pending;
      this.pending = null;
      if (!pending || !this.live || sequence !== this.sequence) return;
      const { snapshot, stamp } = pending;
      const current = this.stamp();
      if (!current || !sameStamp(current, stamp)) return;
      try {
        const previous = this.state.projection;
        const reuse =
          previous &&
          previous.session === stamp.session &&
          previous.doc === stamp.doc &&
          previous.sourceSha256 === snapshot.sourceSha256;
        const index = reuse ? previous.index : this.build(snapshot);
        const facts = reuse
          ? previous.facts
          : buildCharacterCounts(snapshot.capture.document, index);
        const rows: { id: string; from: number }[] = [];
        if (!reuse)
          stamp.doc.forEach((node, position) =>
            rows.push(
              Object.freeze({ id: String(node.attrs.id), from: position + 1 }),
            ),
          );
        const projection = Object.freeze({
          ...stamp,
          sourceSha256: snapshot.sourceSha256,
          index,
          facts,
          snapshot,
          rows: reuse ? previous.rows : Object.freeze(rows),
        });
        if (this.isCurrent(projection))
          this.update({
            phase: 'current',
            projection,
            message: `Outline from version ${projection.version}.`,
          });
      } catch {
        this.unavailable();
      }
    }, 0);
  }
  dispose() {
    this.live = false;
    this.sequence++;
    this.pending = null;
    if (this.timer !== null) clearTimeout(this.timer);
  }
}
