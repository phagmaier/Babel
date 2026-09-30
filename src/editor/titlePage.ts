import type { EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { TitleAction } from '../domain/titlePage';
import { captureEditor } from './sourceBridge';
import {
  applyEditorTransaction,
  editorOrigin,
  sourceTitleTransaction,
} from './state';
import { dispatchIsolated } from './formatting';

/** All source validation is explicit form work, outside the typing path. */
export function titlePageTransaction(state: EditorState, action: TitleAction) {
  const tr = sourceTitleTransaction(state, action);
  if (!tr) return null;
  const checked = applyEditorTransaction(state, tr);
  if (!checked.accepted) throw new Error('Editor refused the title edit.');
  const actual = captureEditor(checked.state).source;
  const expected = editorOrigin(checked.state).document.bytes;
  if (
    actual.length !== expected.length ||
    actual.some((b, i) => b !== expected[i])
  )
    throw new Error('Title edit did not retain exact source.');
  return tr;
}

export function applyTitlePage(
  view: EditorView,
  expected: EditorState,
  action: TitleAction,
): boolean {
  if (
    view.isDestroyed ||
    view.composing ||
    view.someProp('editable', (editable) => editable(view.state) === false) ||
    view.state !== expected
  )
    return false;
  const tr = titlePageTransaction(expected, action);
  if (!tr) return true;
  dispatchIsolated(view, tr);
  return view.state.doc === tr.doc;
}
