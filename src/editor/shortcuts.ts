import { undo, redo } from 'prosemirror-history';
import type { EditorView } from 'prosemirror-view';
import type { ShortcutRegistry } from '../application/shortcuts';
import { toggleEditorMark, dispatchIsolated } from './formatting';
import { convertEditorSelection } from './commands';

export function executeEditorCommand(
  view: EditorView,
  id: string,
  refused?: (reason?: string) => void,
): boolean {
  if (view.composing) return false;
  if (id === 'undo' || id === 'redo') {
    return (id === 'undo' ? undo : redo)(view.state, (tr) => view.dispatch(tr));
  }
  if (id.startsWith('format.')) {
    const result = toggleEditorMark(view.state, id.slice(7));
    if (result.transaction) dispatchIsolated(view, result.transaction);
    else if (result.reason) refused?.(result.reason);
    return result.handled;
  }
  if (!id.startsWith('element.')) return false;
  const result = convertEditorSelection(
    view.state,
    id.slice('element.'.length),
  );
  if (result.transaction) view.dispatch(result.transaction);
  else if (result.reason) refused?.(result.reason);
  return result.handled;
}
export function routeEditorShortcut(
  view: EditorView,
  event: KeyboardEvent,
  registry: ShortcutRegistry,
  refused?: (reason?: string) => void,
): boolean {
  const command = registry.match(event);
  if (!command) return false;
  if (command.unavailable) {
    refused?.(command.unavailable);
    return true;
  }
  executeEditorCommand(view, command.id, refused);
  // A bound undo with no history must not fall through into a WebView command.
  return true;
}
