import { shortcutCommands, type ShortcutCommand } from './shortcuts';

/** Current UI facts only; native services/editor retain every mutation guard. */
export interface CommandContext {
  route: 'home' | 'writing';
  native: boolean;
  ready: boolean;
  blocked: boolean;
  composing: boolean;
  staged: boolean;
  readOnly: boolean;
  form: boolean;
  undo: boolean;
  redo: boolean;
  navigation: boolean;
  matches: boolean;
  exporting?: boolean;
  pdfAvailable?: boolean;
}
export function commandReason(
  command: ShortcutCommand,
  context: CommandContext,
): string | null {
  if (command.unavailable) return command.unavailable;
  if (context.composing) return 'Finish composing first.';
  if (context.blocked)
    return 'Finish the current action or protection review first.';
  if (command.id === 'commandPalette') return null;
  if (!context.native) return 'Requires the native desktop app.';
  if (!context.ready) return 'The screenplay is not ready.';
  if (context.staged)
    return 'Apply or Discard the uncommitted title input first.';
  if (context.route === 'home')
    return ['new', 'newDestination', 'open'].includes(command.id)
      ? null
      : 'Open a screenplay first.';
  if (command.id === 'exportPdf' && context.pdfAvailable === false)
    return 'PDF export requires the native publication services.';
  if (
    context.exporting &&
    [
      'exportPdf',
      'saveAs',
      'exportFountain',
      'open',
      'home',
      'closeSession',
    ].includes(command.id)
  )
    return 'Finish or cancel PDF export first.';
  if (['new', 'newDestination'].includes(command.id))
    return 'Return Home to start a new screenplay.';
  if (context.form && command.scope === 'editor')
    return 'This form owns typing and Undo; focus the screenplay first.';
  if (
    context.readOnly &&
    (command.scope === 'editor' ||
      command.id === 'save' ||
      command.id === 'exportPdf' ||
      command.id === 'replace')
  )
    return 'This screenplay is read-only; Save As can create a writable copy.';
  if (command.id === 'undo' && !context.undo)
    return 'No screenplay edit to Undo.';
  if (command.id === 'redo' && !context.redo)
    return 'No screenplay edit to Redo.';
  if (
    ['nextScene', 'previousScene'].includes(command.id) &&
    !context.navigation
  )
    return 'No current scene navigation is available.';
  if (['nextMatch', 'previousMatch'].includes(command.id) && !context.matches)
    return 'No current search match is available.';
  return null;
}
export function dispatchCommand(
  id: unknown,
  context: CommandContext,
  execute: (id: string) => void,
): boolean {
  const command = shortcutCommands.find((item) => item.id === id);
  if (!command || commandReason(command, context)) return false;
  execute(command.id);
  return true;
}
export function formOwnsInput(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    !!target.closest(
      'input, textarea, select, [contenteditable="true"]:not(.ProseMirror)',
    ) &&
    !target.closest('.command-palette')
  );
}
