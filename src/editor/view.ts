import { EditorView } from 'prosemirror-view';
import type { EditorState } from 'prosemirror-state';
import { applyEditorTransaction, editorOrigin } from './state';

/** EditorView owns the sole current state; observers receive immutable transaction results. */
export function mountScreenplayEditor(
  host: HTMLElement,
  state: EditorState,
  observers: {
    changed?: (state: EditorState) => void;
    refused?: () => void;
  } = {},
): EditorView {
  const view = new EditorView(host, {
    state,
    editable: (current) => !editorOrigin(current).document.readOnlyReason,
    dispatchTransaction(transaction) {
      const result = applyEditorTransaction(view.state, transaction);
      view.updateState(result.state);
      if (!result.accepted) observers.refused?.();
      else if (transaction.docChanged || transaction.selectionSet)
        observers.changed?.(result.state);
    },
    // Clipboard policies/structural commands have their own M3 gates.
    handlePaste() {
      observers.refused?.();
      return true;
    },
    handleDrop() {
      observers.refused?.();
      return true;
    },
  });
  return view;
}
