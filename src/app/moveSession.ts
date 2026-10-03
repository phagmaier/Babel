import { useCallback, useRef, useState } from 'react';
import type { EditorView } from 'prosemirror-view';
import type { ProjectionState } from '../application/manuscriptProjection';
import type { WritingSession } from '../application/writingSession';
import {
  applyPreparedMove,
  prepareEditorMove,
  type PreparedMove,
} from '../editor/sceneMoves';
import type { MoveRequest } from '../domain/sceneMoves';

/** Component-owned handles the move session reads. All are stable refs
 *  except the plain render values, which the hook re-reads every render
 *  — the same semantics as the previous inline callbacks. */
export interface MoveSessionDeps {
  viewRef: { current: EditorView | null };
  operationRef: { current: boolean };
  frozenRef: { current: boolean };
  readyRef: { current: boolean };
  writableRef: { current: boolean };
  sessionRef: { current: WritingSession | null };
  outline: ProjectionState;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  refresh: () => void;
  setError: (message: string) => void;
}

export interface MoveSession {
  move: PreparedMove | null;
  moveMessage: string;
  moveBusy: boolean;
  moveAbortRef: { current: AbortController | null };
  previewMove: (request: MoveRequest) => void;
  applyMove: () => Promise<void>;
  cancelMove: () => void;
}

/** Owns the scene/section move session: prepared-move state, the
 *  preview/apply/cancel callbacks (previously a memoized component
 *  callback, a plain async handler and an inline panel callback;
 *  bodies byte-identical) and the in-flight abort ref. The abort is
 *  still triggered by the writing session teardown through the
 *  returned moveAbortRef. */
export function useMoveSession(deps: MoveSessionDeps): MoveSession {
  const {
    viewRef,
    operationRef,
    frozenRef,
    readyRef,
    writableRef,
    sessionRef,
    outline,
    busy,
    setBusy,
    refresh,
    setError,
  } = deps;
  const [move, setMove] = useState<PreparedMove | null>(null);
  const [moveMessage, setMoveMessage] = useState('');
  const [moveBusy, setMoveBusy] = useState(false);
  const moveAbortRef = useRef<AbortController | null>(null);

  const previewMove = useCallback(
    (request: MoveRequest) => {
      const view = viewRef.current;
      const projection = outline.projection;
      if (
        !view ||
        !projection ||
        busy ||
        operationRef.current ||
        frozenRef.current ||
        !readyRef.current ||
        !writableRef.current ||
        view.composing
      ) {
        setError(
          'Move is unavailable while read-only, composing or protecting a draft. Source retained.',
        );
        return;
      }
      try {
        setMove(prepareEditorMove(view.state, projection, request));
        setMoveMessage('');
      } catch (failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : 'Move preview failed; source retained.',
        );
      }
    },
    [outline.projection, busy],
  );
  const applyMove = async () => {
    const view = viewRef.current;
    const session = sessionRef.current;
    if (
      !move ||
      !view ||
      !session ||
      view.state !== move.state ||
      view.composing ||
      busy ||
      operationRef.current ||
      frozenRef.current ||
      !writableRef.current ||
      !readyRef.current
    ) {
      setMoveMessage(
        'Move refused for this version. Source and review copies retained.',
      );
      return;
    }
    operationRef.current = true;
    setBusy(true);
    setMoveBusy(true);
    const abort = new AbortController();
    moveAbortRef.current = abort;
    try {
      if (move.large) {
        setMoveMessage('Protecting the exact current draft before moving…');
        const result = await session.runProtectedWorkflow(
          move.review.kind === 'scene' ? 'sceneMove' : 'sectionMove',
          () => applyPreparedMove(view, move),
          abort.signal,
        );
        if (result.status === 'refused') {
          setMoveMessage(result.reason);
          return;
        }
      } else if (!applyPreparedMove(view, move)) {
        setMoveMessage(
          'Editor refused the move. Source and review copies retained.',
        );
        return;
      }
      setMove(null);
      setError(
        'Move applied. Undo restores the complete source and previous selection.',
      );
    } catch (failure) {
      setMoveMessage(
        failure instanceof Error
          ? failure.message
          : 'Move failed; source and review copies retained.',
      );
    } finally {
      moveAbortRef.current = null;
      operationRef.current = false;
      setBusy(false);
      setMoveBusy(false);
      refresh();
    }
  };
  const cancelMove = () => {
    if (moveBusy) {
      moveAbortRef.current?.abort();
      setMoveMessage(
        'Cancellation requested; waiting for native protection to settle.',
      );
    } else {
      setMove(null);
      setMoveMessage('');
    }
  };

  return {
    move,
    moveMessage,
    moveBusy,
    moveAbortRef,
    previewMove,
    applyMove,
    cancelMove,
  };
}
