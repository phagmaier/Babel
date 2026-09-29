import { EditorView } from 'prosemirror-view';
import type { EditorState } from 'prosemirror-state';
import { applyEditorTransaction, editorOrigin } from './state';
import { smartKeyTransaction, type SmartKey } from './commands';

/** EditorView owns the sole current state; observers receive immutable transaction results. */
export function mountScreenplayEditor(
  host: HTMLElement,
  state: EditorState,
  observers: {
    changed?: (state: EditorState) => void;
    refused?: (reason?: string) => void;
  } = {},
): EditorView {
  let composing = false;
  let compositionEndedBeforeKeyup = false;
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
    handleDOMEvents: {
      compositionstart() {
        composing = true;
        compositionEndedBeforeKeyup = false;
        return false;
      },
      compositionend() {
        composing = false;
        compositionEndedBeforeKeyup = true;
        return false;
      },
      keyup() {
        compositionEndedBeforeKeyup = false;
        return false;
      },
    },
    handleKeyDown(current, event) {
      if (
        event.key !== 'Enter' &&
        event.key !== 'Backspace' &&
        event.key !== 'Delete'
      ) {
        compositionEndedBeforeKeyup = false;
        return false;
      }
      if (composing || event.isComposing) return false;
      if (event.key === 'Enter' && compositionEndedBeforeKeyup) {
        compositionEndedBeforeKeyup = false;
        return true;
      }
      const key: SmartKey =
        event.key === 'Enter' && event.shiftKey
          ? 'ShiftEnter'
          : (event.key as SmartKey);
      const result = smartKeyTransaction(current.state, key);
      if (!result.handled) return false;
      if (result.transaction) current.dispatch(result.transaction);
      else observers.refused?.(result.reason);
      return true;
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
