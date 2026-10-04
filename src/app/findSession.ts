import { stampOf, isCurrent } from '../editor/state';
import { useEffect, useRef, useState } from 'react';
import type { EditorView } from 'prosemirror-view';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { Selection as ProseMirrorSelection } from 'prosemirror-state';
import { FindController, type FindState } from '../application/find';
import type { ActiveInfo } from '../application/writingSession';
import { navigateFind } from '../editor/find';
import { dispatchIsolated } from '../editor/formatting';
import { prepareEditorReplace, type ReplacePlan } from '../editor/replace';

/** Component-owned handles the find session reads. All are stable refs
 *  except the plain render values, which the hook re-reads every render —
 *  the same semantics as the previous inline callbacks. */
export interface FindSessionDeps {
  viewRef: { current: EditorView | null };
  popupRef: { current: { controller: { dismiss(): void } } | null };
  operationRef: { current: boolean };
  frozenRef: { current: boolean };
  readyRef: { current: boolean };
  titleDraftRef: { current: boolean };
  titleComposingRef: { current: boolean };
  writableRef: { current: boolean };
  showClose: boolean;
  busy: boolean;
  active: ActiveInfo | null;
  setError: (message: string) => void;
  closeCheck: () => void;
}

export interface FindSession {
  findRef: { current: FindController | null };
  findState: FindState | null;
  setFindState: (state: FindState | null) => void;
  replaceMessage: string;
  openFind: () => void;
  navigateSearch: (direction: 1 | -1, index?: number) => void;
  closeFind: () => void;
  replaceOne: (plan: ReplacePlan, editIndex: number) => void;
  replaceAll: (plan: ReplacePlan) => void;
}

/** Owns the find/replace session: controller ref, scroll/advance refs,
 *  panel state, the two findState effects and the seven session callbacks.
 *  The FindController itself is still created and disposed by the writing
 *  session lifecycle through the returned findRef. */
export function useFindSession(deps: FindSessionDeps): FindSession {
  const {
    viewRef,
    popupRef,
    operationRef,
    frozenRef,
    readyRef,
    titleDraftRef,
    titleComposingRef,
    writableRef,
    showClose,
    busy,
    active,
    setError,
    closeCheck,
  } = deps;
  const findRef = useRef<FindController | null>(null);
  const findScrollRef = useRef<{
    view: EditorView;
    session: object;
    version: number;
    doc: ProseMirrorNode;
    selection: ProseMirrorSelection;
  } | null>(null);
  const [findState, setFindState] = useState<FindState | null>(null);
  const [replaceMessage, setReplaceMessage] = useState('');
  const replaceAdvanceRef = useRef<{
    query: string;
    options: string;
    index: number;
  } | null>(null);

  useEffect(() => {
    const target = findScrollRef.current;
    const find = findRef.current;
    if (
      !target ||
      !find ||
      !findState?.enabled ||
      findState.phase !== 'current' ||
      !find.isCurrent(findState.projection)
    )
      return;
    findScrollRef.current = null;
    // React has committed the result/reveal panel; scroll only the still-current selection.
    requestAnimationFrame(() => {
      const view = target.view;
      if (
        view.isDestroyed ||
        view.composing ||
        !find.state.enabled ||
        operationRef.current ||
        frozenRef.current ||
        !view.hasFocus() ||
        !isCurrent(view.state, target) ||
        !view.state.selection.eq(target.selection)
      )
        return;
      view.dispatch(
        view.state.tr.setMeta('addToHistory', false).scrollIntoView(),
      );
    });
  }, [findState]);

  useEffect(() => {
    // Replace-one advances to the match that followed the replaced one once
    // refreshed results are current. The caret resting at the replacement is
    // the honest fallback when nothing follows.
    const pending = replaceAdvanceRef.current;
    const find = findRef.current;
    const view = viewRef.current;
    if (!pending || !find || !view || view.isDestroyed) return;
    if (
      !findState?.enabled ||
      findState.phase !== 'current' ||
      !find.isCurrent(findState.projection)
    )
      return;
    if (
      findState.options.query !== pending.query ||
      JSON.stringify(findState.options) !== pending.options
    ) {
      replaceAdvanceRef.current = null;
      return;
    }
    replaceAdvanceRef.current = null;
    if (!findState.matches.length) return;
    const index = Math.min(pending.index, findState.matches.length - 1);
    if (
      find.navigate(
        1,
        (projection, match) => navigateFind(view, projection, match, false),
        index,
      )
    ) {
      findScrollRef.current = {
        view,
        ...stampOf(view.state),
        selection: view.state.selection,
      };
    }
  }, [findState]);

  const openFind = () => {
    if (
      !findRef.current ||
      viewRef.current?.composing ||
      titleDraftRef.current ||
      titleComposingRef.current
    )
      return;
    popupRef.current?.controller.dismiss();
    closeCheck();
    findRef.current.configure(findRef.current.state.options, true);
    // Repeated Find focuses the existing query without replacing editor state.
    document
      .querySelector<HTMLInputElement>('.find-panel input[type="search"]')
      ?.focus();
  };
  const navigateSearch = (direction: 1 | -1, index?: number) => {
    const view = viewRef.current;
    if (
      !view ||
      operationRef.current ||
      frozenRef.current ||
      !readyRef.current ||
      showClose ||
      titleDraftRef.current ||
      titleComposingRef.current
    )
      return;
    popupRef.current?.controller.dismiss();
    if (
      findRef.current?.navigate(
        direction,
        (projection, match) => navigateFind(view, projection, match, false),
        index,
      )
    ) {
      findScrollRef.current = {
        view,
        ...stampOf(view.state),
        selection: view.state.selection,
      };
    } else {
      setError(
        'Find navigation is unavailable for this version. Text and selection are retained.',
      );
    }
  };
  const closeFind = () => {
    findScrollRef.current = null;
    replaceAdvanceRef.current = null;
    setReplaceMessage('');
    findRef.current?.configure(findRef.current.state.options, false);
    const view = viewRef.current;
    if (view && !view.isDestroyed && !view.composing) {
      view.dom.focus({ preventScroll: true });
      view.focus();
    }
  };
  const replacePlanCurrent = (plan: ReplacePlan): boolean => {
    const find = findRef.current;
    return (
      !!find &&
      find.state.phase === 'current' &&
      find.isCurrent(find.state.projection) &&
      plan.query === find.state.options.query &&
      JSON.stringify(plan.options) === JSON.stringify(find.state.options)
    );
  };
  const dispatchReplacement = (
    plan: ReplacePlan,
    scope: { one: number } | { all: true },
  ): boolean => {
    const view = viewRef.current;
    const projection = findRef.current?.state.projection;
    setReplaceMessage('');
    if (
      !view ||
      view.isDestroyed ||
      view.composing ||
      !projection ||
      operationRef.current ||
      frozenRef.current ||
      !readyRef.current ||
      showClose ||
      busy ||
      !writableRef.current ||
      titleDraftRef.current ||
      titleComposingRef.current ||
      active?.readOnly ||
      !replacePlanCurrent(plan)
    ) {
      setReplaceMessage(
        'Replacement is unavailable for this version. Text and selection are retained.',
      );
      return false;
    }
    popupRef.current?.controller.dismiss();
    try {
      const transaction = prepareEditorReplace(
        view.state,
        projection,
        plan,
        scope,
      );
      dispatchIsolated(view, transaction);
    } catch (failure) {
      setReplaceMessage(
        failure instanceof Error
          ? failure.message
          : 'Replacement failed; source retained.',
      );
      return false;
    }
    view.dom.focus({ preventScroll: true });
    view.focus();
    return true;
  };
  const replaceOne = (plan: ReplacePlan, editIndex: number) => {
    // Advance by position in the full match list, not the edits list: refused
    // matches keep their slots, so the match after the replaced one slides
    // into the replaced match's own index once results refresh.
    const matchIndex =
      plan.edits[editIndex] &&
      findRef.current?.state.matches.indexOf(plan.edits[editIndex]!.match);
    if (
      dispatchReplacement(plan, { one: editIndex }) &&
      typeof matchIndex === 'number' &&
      matchIndex >= 0
    )
      replaceAdvanceRef.current = {
        query: plan.query,
        options: JSON.stringify(plan.options),
        index: matchIndex,
      };
  };
  const replaceAll = (plan: ReplacePlan) => {
    replaceAdvanceRef.current = null;
    if (dispatchReplacement(plan, { all: true }))
      setReplaceMessage(
        plan.edits.length === 1
          ? 'Replaced 1 match in one step. Undo restores the complete source and previous selection.'
          : `Replaced ${plan.edits.length} matches in one step. Undo restores the complete source and previous selection.`,
      );
  };

  return {
    findRef,
    findState,
    setFindState,
    replaceMessage,
    openFind,
    navigateSearch,
    closeFind,
    replaceOne,
    replaceAll,
  };
}
