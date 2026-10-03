import { useEffect, useRef, useState } from 'react';
import type { EditorView } from 'prosemirror-view';
import type { Node as ProseMirrorNode } from 'prosemirror-model';
import type { Selection as ProseMirrorSelection } from 'prosemirror-state';
import type { FindController } from '../application/find';
import {
  ScriptCheckController,
  type CheckState,
} from '../application/scriptCheck';
import type { CheckIssue } from '../domain/scriptCheck';
import { navigateCheckIssue } from '../editor/scriptCheck';
import { editorOrigin, editorVersion } from '../editor/state';

/** Component-owned handles the check session reads. All are stable refs
 *  except the plain render values, which the hook re-reads every render —
 *  the same semantics as the previous inline callbacks. Panel visibility
 *  (`showCheck`) and the find-shared `closeCheck` stay composed in
 *  WritingView: the find session consumes `closeCheck`, so moving it here
 *  would force re-opening that landed hook. */
export interface CheckSessionDeps {
  findRef: { current: FindController | null };
  viewRef: { current: EditorView | null };
  popupRef: { current: { controller: { dismiss(): void } } | null };
  operationRef: { current: boolean };
  frozenRef: { current: boolean };
  readyRef: { current: boolean };
  showClose: boolean;
  titleDraftRef: { current: boolean };
  titleComposingRef: { current: boolean };
  setShowCheck: (show: boolean) => void;
  setError: (message: string) => void;
}

export interface CheckSession {
  checkRef: { current: ScriptCheckController | null };
  checkState: CheckState | null;
  setCheckState: (state: CheckState | null) => void;
  openCheck: () => void;
  navigateIssue: (issue: CheckIssue) => void;
}

/** Owns the script-check session: scroll ref, controller ref, panel state,
 *  the issue-scroll effect and the open/navigate callbacks. The
 *  ScriptCheckController itself is still created and disposed by the
 *  writing session lifecycle through the returned checkRef. */
export function useCheckSession(deps: CheckSessionDeps): CheckSession {
  const {
    findRef,
    viewRef,
    popupRef,
    operationRef,
    frozenRef,
    readyRef,
    showClose,
    titleDraftRef,
    titleComposingRef,
    setShowCheck,
    setError,
  } = deps;
  const checkScrollRef = useRef<{
    view: EditorView;
    session: object;
    version: number;
    doc: ProseMirrorNode;
    selection: ProseMirrorSelection;
  } | null>(null);
  const [checkState, setCheckState] = useState<CheckState | null>(null);
  const checkRef = useRef<ScriptCheckController | null>(null);

  const openCheck = () => {
    if (
      !checkRef.current ||
      viewRef.current?.composing ||
      titleDraftRef.current ||
      titleComposingRef.current
    )
      return;
    popupRef.current?.controller.dismiss();
    // Panels remain mutually exclusive; each clears only its own plugin highlights.
    findRef.current?.configure(findRef.current.state.options, false);
    setShowCheck(true);
  };
  const navigateIssue = (issue: CheckIssue) => {
    const view = viewRef.current;
    const projection = checkRef.current?.state.projection;
    if (
      !view ||
      !projection ||
      view.composing ||
      operationRef.current ||
      frozenRef.current ||
      !readyRef.current ||
      showClose ||
      titleDraftRef.current ||
      titleComposingRef.current
    )
      return;
    popupRef.current?.controller.dismiss();
    if (!navigateCheckIssue(view, projection, issue)) {
      setError(
        'Issue navigation is unavailable for this version. Text and selection are retained.',
      );
      return;
    }
    checkScrollRef.current = {
      view,
      session: editorOrigin(view.state).session,
      version: editorVersion(view.state),
      doc: view.state.doc,
      selection: view.state.selection,
    };
  };
  useEffect(() => {
    // Scroll once after the issue panel commits, mirroring find navigation.
    const target = checkScrollRef.current;
    const view = viewRef.current;
    if (!target || !view || view.isDestroyed || target.view !== view) return;
    checkScrollRef.current = null;
    requestAnimationFrame(() => {
      const current = target.view;
      if (
        current.isDestroyed ||
        current.composing ||
        operationRef.current ||
        frozenRef.current ||
        !current.hasFocus() ||
        editorOrigin(current.state).session !== target.session ||
        editorVersion(current.state) !== target.version ||
        current.state.doc !== target.doc ||
        !current.state.selection.eq(target.selection)
      )
        return;
      current.dispatch(
        current.state.tr.setMeta('addToHistory', false).scrollIntoView(),
      );
    });
  }, [checkState]);

  return {
    checkRef,
    checkState,
    setCheckState,
    openCheck,
    navigateIssue,
  };
}
