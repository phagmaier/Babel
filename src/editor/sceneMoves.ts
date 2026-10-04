import {
  isCurrent,
  applyEditorTransaction,
  sourceMoveTransaction,
} from './state';
import type { EditorState, Transaction } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { ManuscriptProjection } from '../application/manuscriptProjection';
import { requiresMoveProtection } from '../application/workflowProtection';
import {
  planSourceMove,
  type MoveRequest,
  type MoveReview,
} from '../domain/sceneMoves';
import { captureEditor } from './sourceBridge';
import { dispatchIsolated } from './formatting';

export interface PreparedMove {
  readonly state: EditorState;
  readonly projection: ManuscriptProjection;
  readonly review: MoveReview;
  readonly transaction: Transaction | null;
  readonly large: boolean;
}
export function prepareEditorMove(
  state: EditorState,
  projection: ManuscriptProjection,
  request: MoveRequest,
): PreparedMove {
  if (!isCurrent(state, projection))
    throw new Error(
      'Move preview is stale. Refresh the outline before moving.',
    );
  const review = planSourceMove(
    projection.snapshot.capture.document,
    projection.index,
    request,
  );
  const transaction =
    review.status === 'ready' ? sourceMoveTransaction(state, review) : null;
  if (transaction) {
    const next = applyEditorTransaction(state, transaction);
    if (!next.accepted)
      throw new Error('Editor refused this move; source retained.');
    const actual = captureEditor(next.state).source;
    const expected = review.candidateBytes!;
    if (
      actual.length !== expected.length ||
      actual.some((byte, at) => byte !== expected[at])
    )
      throw new Error(
        'Move capture differs from the exact source plan; source retained.',
      );
  }
  return Object.freeze({
    state,
    projection,
    review,
    transaction,
    large:
      review.status === 'ready' &&
      requiresMoveProtection(review.rows, review.byteLength),
  });
}
export function applyPreparedMove(
  view: EditorView,
  move: PreparedMove,
): boolean {
  if (
    view.isDestroyed ||
    view.composing ||
    view.state !== move.state ||
    !move.transaction
  )
    return false;
  const before = view.state;
  dispatchIsolated(view, move.transaction);
  if (view.state.doc === before.doc) return false;
  view.dom.focus({ preventScroll: true });
  view.focus();
  view.dispatch(view.state.tr.setMeta('addToHistory', false).scrollIntoView());
  return true;
}
