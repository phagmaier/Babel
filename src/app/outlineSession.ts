import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EditorView } from 'prosemirror-view';
import type { EditorState } from 'prosemirror-state';
import type { ProjectionState } from '../application/manuscriptProjection';
import {
  localRecentPositions,
  type RecentPosition,
} from '../application/recentPosition';
import { highlightCharacter } from '../editor/characterFocus';
import { restoreRecentViewport } from '../editor/recentPosition';
import { navigateOutline } from '../editor/outlineNavigation';
import type { OutlineItem } from '../domain/manuscriptIndex';
import type { CharacterEntry } from '../domain/characterCounts';

/** Component-owned handles the outline session reads. All are stable
 *  refs except the plain render values, which the hook re-reads every
 *  render — the same semantics as the previous inline callbacks. */
export interface OutlineSessionDeps {
  viewRef: { current: EditorView | null };
  readyRef: { current: boolean };
  frozenRef: { current: boolean };
  operationRef: { current: boolean };
  titleDraftRef: { current: boolean };
  titleComposingRef: { current: boolean };
  phase: 'opening' | 'active' | 'failed';
  setError: (message: string) => void;
}

export interface OutlineSession {
  outline: ProjectionState;
  setOutline: (state: ProjectionState) => void;
  character: string | null;
  setCharacter: (name: string | null) => void;
  characterHighlight: boolean;
  setCharacterHighlight: (enabled: boolean) => void;
  positions: ReturnType<typeof localRecentPositions>;
  positionError: string;
  setPositionError: (message: string) => void;
  positionRemember: { current: (closing?: boolean) => void };
  positionClosing: { current: boolean };
  positionCloseHint: { current: RecentPosition | null };
  positionRestore: {
    current: { hint: RecentPosition; state: EditorState } | null;
  };
  retainClosingPosition: () => void;
  onOutlineNavigate: (item: OutlineItem) => void;
  navigateCharacter: (entry: CharacterEntry) => void;
}

/** Owns the outline/character/position session: projection and
 *  character state, the recent-position store and its refs, the
 *  highlight/restore effects and both navigation callbacks (one moved
 *  from a memoized component callback, one named from an inline panel
 *  callback; bodies byte-identical). The writing session lifecycle
 *  still feeds this session through the returned handles: it assigns
 *  `positionRemember`, publishes `outline`/`positionError` and reads
 *  the position refs — all stable identities, so the mount-once
 *  lifecycle closure keeps exact semantics. */
export function useOutlineSession(deps: OutlineSessionDeps): OutlineSession {
  const {
    viewRef,
    readyRef,
    frozenRef,
    operationRef,
    titleDraftRef,
    titleComposingRef,
    phase,
    setError,
  } = deps;
  const [outline, setOutline] = useState<ProjectionState>({
    phase: 'pending',
    projection: null,
    message: 'Preparing outline…',
  });
  const [character, setCharacter] = useState<string | null>(null);
  const [characterHighlight, setCharacterHighlight] = useState(false);
  const positions = useMemo(() => localRecentPositions(), []);
  const [positionError, setPositionError] = useState('');
  const positionRemember = useRef<(closing?: boolean) => void>(() => {});
  const positionClosing = useRef(false);
  const positionCloseHint = useRef<RecentPosition | null>(null);
  const retainClosingPosition = () => {
    positionRemember.current();
    positionClosing.current = true;
  };
  const positionRestore = useRef<{
    hint: RecentPosition;
    state: EditorState;
  } | null>(null);

  useEffect(() => {
    const view = viewRef.current;
    if (view)
      highlightCharacter(
        view,
        outline.phase === 'current' ? outline.projection : null,
        characterHighlight
          ? (outline.projection?.facts.characters.find(
              (entry) => entry.name === character,
            ) ?? null)
          : null,
      );
  }, [outline, character, characterHighlight]);

  useEffect(() => {
    const pending = positionRestore.current,
      view = viewRef.current;
    if (phase !== 'active' || outline.phase !== 'current' || !pending || !view)
      return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        if (
          positionRestore.current !== pending ||
          view.isDestroyed ||
          view.state.doc !== pending.state.doc ||
          !view.state.selection.eq(pending.state.selection)
        )
          return;
        positionRestore.current = null;
        restoreRecentViewport(view, pending.hint);
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [phase, outline]);

  const onOutlineNavigate = useCallback(
    (item: OutlineItem) => {
      const current = viewRef.current;
      const captured = outline.projection;
      if (
        !current ||
        !captured ||
        !readyRef.current ||
        frozenRef.current ||
        !navigateOutline(current, captured, item.row)
      )
        setError(
          'Outline navigation is unavailable for this version. Your selection and text are retained.',
        );
    },
    [outline.projection],
  );
  const navigateCharacter = (entry: CharacterEntry) => {
    const view = viewRef.current,
      captured = outline.projection;
    const row = view?.state.selection.$head.index(0) ?? -1;
    const next = entry.cues.find((cue) => cue > row) ?? entry.cues[0];
    if (
      !view ||
      !captured ||
      !captured.facts.characters.includes(entry) ||
      next === undefined ||
      !readyRef.current ||
      frozenRef.current ||
      operationRef.current ||
      titleDraftRef.current ||
      titleComposingRef.current ||
      !navigateOutline(view, captured, next)
    )
      setError(
        'Character navigation is unavailable for this version. Text and selection are retained.',
      );
  };

  return {
    outline,
    setOutline,
    character,
    setCharacter,
    characterHighlight,
    setCharacterHighlight,
    positions,
    positionError,
    setPositionError,
    positionRemember,
    positionClosing,
    positionCloseHint,
    positionRestore,
    retainClosingPosition,
    onOutlineNavigate,
    navigateCharacter,
  };
}
