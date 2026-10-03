import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { SessionSelection } from '../application/writingSession';

/** Read the live editor selection as plain session offsets. */
export function toSessionSelection(view: EditorView): SessionSelection | null {
  return {
    anchor: view.state.selection.anchor,
    head: view.state.selection.head,
  };
}

/** Human-readable failure text; the draft always stays open. */
export function writingFailureMessage(failure: unknown): string {
  if (failure instanceof Error) return failure.message;
  const value = failure as { code?: string; error?: { code?: string } } | null;
  const code = value?.error?.code ?? value?.code;
  const messages: Record<string, string> = {
    checkpointConflict:
      'Recovery contains a different draft at this version. Your current text stays open; save a copy before retrying.',
    staleRecoveryVersion:
      'Recovery holds a newer version. Your current text stays open; refresh the recovery comparison.',
    recoveryNeedsAttention:
      'Existing recovery needs review. Your current text stays open; save a copy or review recovery.',
    invalidDestination:
      'The selected destination is unavailable or unsafe. Choose another location.',
    sourceChanged:
      'The source changed outside this session. Both versions are preserved; save a copy before choosing how to continue.',
    permissionDenied:
      'Writing was denied. Your text stays open; choose a writable copy destination.',
    io: 'The storage operation failed. Your text stays open; retry or save a copy to another location.',
    historyNeedsAttention:
      'Local history needs attention. Normal saving and emergency copies remain available.',
  };
  return code
    ? (messages[code] ??
        `The action could not be confirmed (${code}). Your text stays open.`)
    : 'The action could not be confirmed. Your text stays open.';
}

/** Clamp plain session offsets into a valid editor selection. */
export function clampedSelection(
  doc: import('prosemirror-model').Node,
  selection: SessionSelection,
) {
  const clamp = (position: number) =>
    TextSelection.near(
      doc.resolve(Math.max(0, Math.min(position, doc.content.size))),
    ).from;
  return TextSelection.create(
    doc,
    clamp(selection.anchor),
    clamp(selection.head),
  );
}
