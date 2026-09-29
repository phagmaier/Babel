import { EditorView } from 'prosemirror-view';
import type { EditorState } from 'prosemirror-state';
import { applyEditorTransaction, editorOrigin } from './state';
import { routeEditorShortcut } from './shortcuts';
import type { ShortcutRegistry } from '../application/shortcuts';
import {
  cycleEditorElement,
  smartKeyTransaction,
  type SmartKey,
} from './commands';

/** EditorView owns the sole current state; observers receive immutable transaction results. */
export function mountScreenplayEditor(
  host: HTMLElement,
  state: EditorState,
  observers: {
    changed?: (state: EditorState) => void;
    refused?: (reason?: string) => void;
    shortcuts?: ShortcutRegistry;
    completionKey?: (view: EditorView, event: KeyboardEvent) => boolean;
    escapeFocus?: () => void;
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
        composing ||
        current.composing ||
        event.isComposing ||
        event.keyCode === 229 ||
        event.key === 'Dead' ||
        event.key === 'Process'
      )
        return false;
      if (event.key === 'Enter' && compositionEndedBeforeKeyup) {
        compositionEndedBeforeKeyup = false;
        return true;
      }
      compositionEndedBeforeKeyup = false;
      if (observers.completionKey?.(current, event)) return true;
      if (
        observers.shortcuts &&
        routeEditorShortcut(
          current,
          event,
          observers.shortcuts,
          observers.refused,
        )
      )
        return true;
      if (
        event.key === 'F6' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        if (!observers.escapeFocus) return false;
        observers.escapeFocus();
        return true;
      }
      if (
        event.key === 'Tab' &&
        observers.escapeFocus &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        const result = cycleEditorElement(current.state, event.shiftKey);
        if (result.transaction) current.dispatch(result.transaction);
        else if (result.reason) observers.refused?.(result.reason);
        return true;
      }
      if (
        !['Enter', 'Backspace', 'Delete'].includes(event.key) ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return false;
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
