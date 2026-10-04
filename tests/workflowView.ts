/** Mounted synthetic editor adapter for workflow tests and the native input fixture.
 * The fixture owns initial mounting; only workflow capture/dispatch is exercised.
 */
import type { EditorView } from 'prosemirror-view';
import { EditorCaptureBoundary } from '../src/application/editorCapture';
import type { SessionEditor } from '../src/application/writingSession';
import { editorVersion } from '../src/editor/state';

export function workflowView(
  getView: () => EditorView,
  boundary = new EditorCaptureBoundary(() => getView().state),
): SessionEditor {
  const unused = () => {
    throw new Error('Operation unavailable in the workflow-only fixture');
  };
  const capture = async () => {
    const result = await boundary.capture();
    if (result.status !== 'current')
      throw new Error('Fixture capture is stale');
    return result.snapshot;
  };
  return {
    loadInitial() {}, // The diagnostic/test mounts its independently declared bytes.
    applySource: unused,
    prepareSource: async () => unused(),
    advanceVersion: unused,
    capture,
    captureDraft: capture,
    retain: () => () => {},
    getVersion: () => editorVersion(getView().state),
    freeze: () => {
      const view = getView();
      const editable = view.props.editable;
      view.setProps({ editable: () => false });
      return () => {
        if (!view.isDestroyed) view.setProps({ editable });
      };
    },
    workflowState: () => {
      const view = getView();
      return view.isDestroyed
        ? null
        : { token: view.state, composing: view.composing };
    },
    applyWorkflow: (apply) => apply(),
    getSelection: () => ({
      anchor: getView().state.selection.anchor,
      head: getView().state.selection.head,
    }),
    setSelection: unused,
  };
}
