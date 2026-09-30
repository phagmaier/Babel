import { EditorView } from 'prosemirror-view';
import {
  clipboardHtmlText,
  copyEditorSelection,
  pasteEditorContent,
  clipboardMime,
} from './clipboard';
import { dispatchIsolated } from './formatting';
import type { EditorState } from 'prosemirror-state';
import { applyEditorTransaction, editorOrigin } from './state';
import { routeEditorShortcut } from './shortcuts';
import type { LocalCompletion } from './completion';
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
    transactionMeasured?: (durationMs: number, changed: boolean) => void;
    refused?: (reason?: string) => void;
    shortcuts?: ShortcutRegistry;
    completion?: LocalCompletion;
    completionKey?: (view: EditorView, event: KeyboardEvent) => boolean;
    escapeFocus?: () => void;
    canEdit?: () => boolean;
    canNavigate?: () => boolean;
  } = {},
): EditorView {
  let composing = false;
  let compositionEndedBeforeKeyup = false;
  const view = new EditorView(host, {
    state,
    attributes: { tabindex: '0' },
    editable: (current) =>
      !editorOrigin(current).document.readOnlyReason &&
      (observers.canEdit?.() ?? true),
    dispatchTransaction(transaction) {
      if (
        (transaction.getMeta('outlineNavigation') ||
          transaction.getMeta('outlineMove')) &&
        (composing || view.composing)
      ) {
        observers.refused?.('Outline actions wait until composition finishes');
        return;
      }
      if (
        observers.canEdit?.() === false &&
        (transaction.docChanged ||
          (transaction.selectionSet && !observers.canNavigate?.()))
      ) {
        observers.refused?.('The editor is read-only or protecting a version');
        return;
      }
      const started = observers.transactionMeasured ? performance.now() : 0;
      const result = applyEditorTransaction(view.state, transaction);
      view.updateState(result.state);
      observers.transactionMeasured?.(
        performance.now() - started,
        transaction.docChanged,
      );
      if (!result.accepted) observers.refused?.();
      else if (transaction.docChanged || transaction.selectionSet) {
        observers.changed?.(result.state);
        observers.completion?.changed(view);
        if (
          transaction.getMeta('paste') ||
          transaction.getMeta('uiEvent') === 'paste'
        )
          observers.completion?.dismiss();
      }
    },
    handleDOMEvents: {
      copy(current, event) {
        if (!event.clipboardData || current.state.selection.empty) return false;
        const content = copyEditorSelection(current.state);
        event.clipboardData.setData('text/plain', content.text);
        if (content.structured)
          event.clipboardData.setData(clipboardMime, content.structured);
        event.preventDefault();
        return true;
      },
      cut(current, event) {
        if (!event.clipboardData || current.state.selection.empty) return false;
        const content = copyEditorSelection(current.state);
        event.clipboardData.setData('text/plain', content.text);
        if (content.structured)
          event.clipboardData.setData(clipboardMime, content.structured);
        event.preventDefault();
        if (composing || current.composing) {
          observers.refused?.('Cut waits until composition finishes');
          return true;
        }
        const result = pasteEditorContent(current.state, { text: '' });
        if (result.transaction) dispatchIsolated(current, result.transaction);
        else observers.refused?.(result.reason);
        return true;
      },
      paste(current, event) {
        event.preventDefault();
        observers.completion?.dismiss();
        if (composing || current.composing) {
          observers.refused?.('Paste waits until composition finishes');
          return true;
        }
        if (!event.clipboardData) {
          observers.refused?.(
            'Clipboard data is unavailable; content retained',
          );
          return true;
        }
        const result = pasteEditorContent(current.state, {
          text: event.clipboardData.getData('text/plain'),
          html: event.clipboardData.getData('text/html'),
          structured: event.clipboardData.getData(clipboardMime),
        });
        if (result.transaction) dispatchIsolated(current, result.transaction);
        else observers.refused?.(result.reason);
        return true;
      },
      focus() {
        observers.completion?.changed(view);
        return false;
      },
      blur() {
        observers.completion?.dismiss();
        return false;
      },
      compositionstart() {
        observers.completion?.suspend();
        composing = true;
        compositionEndedBeforeKeyup = false;
        return false;
      },
      compositionend() {
        composing = false;
        compositionEndedBeforeKeyup = true;
        observers.completion?.dismiss();
        observers.completion?.resume(view);
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
      ) {
        observers.completion?.dismiss();
        return false;
      }
      if (event.key === 'Enter' && compositionEndedBeforeKeyup) {
        compositionEndedBeforeKeyup = false;
        return true;
      }
      compositionEndedBeforeKeyup = false;
      if (observers.completion?.key(current, event)) return true;
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
    // Programmatic ProseMirror paste is sanitized before its parser sees any HTML.
    transformPastedHTML(html) {
      const text = clipboardHtmlText(html);
      return `<p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`;
    },
    handlePaste(current, _event, slice) {
      observers.completion?.dismiss();
      if (composing || current.composing) {
        observers.refused?.('Paste waits until composition finishes');
        return true;
      }
      if (!slice) {
        observers.refused?.('Paste has no readable content');
        return true;
      }
      const result = pasteEditorContent(current.state, {
        text: slice.content.textBetween(0, slice.content.size, '\n'),
      });
      if (result.transaction) dispatchIsolated(current, result.transaction);
      else observers.refused?.(result.reason);
      return true;
    },
    handleDrop() {
      observers.completion?.dismiss();
      observers.refused?.();
      return true;
    },
  });
  return view;
}
