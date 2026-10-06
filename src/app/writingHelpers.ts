import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { elementChoices } from '../application/shortcuts';
import type { SessionSelection } from '../application/writingSession';
import { FountainEditError } from '../domain/fountainCodec';
import { refusedRow } from '../editor/sourceBridge';
import { refusalRecovery } from '../application/editorCapture';

/** Read the live editor selection as plain session offsets. */
export function toSessionSelection(view: EditorView): SessionSelection | null {
  return {
    anchor: view.state.selection.anchor,
    head: view.state.selection.head,
  };
}

const elementLabels: ReadonlyMap<string, string> = new Map(elementChoices);

/**
 * A draft Fountain cannot hold pauses source saving. Recovery keeps journaling
 * a recovery-only copy when one exists (ADR 0044). Name the row when the codec
 * did, and always how to resume.
 */
function captureRefusalMessage(failure: FountainEditError): string {
  const row = refusedRow(failure);
  let stopped =
    'Part of this draft cannot be saved as Fountain as it stands. Undo the latest changes to resume.';
  if (row) {
    const label = elementLabels.get(row.kind);
    const scalars = Array.from(row.text);
    const excerpt =
      scalars.length > 48 ? `${scalars.slice(0, 48).join('')}…` : row.text;
    const named = row.text
      ? `${label ? `the ${label} ` : ''}“${excerpt}”`
      : `an empty ${label ? `${label} ` : ''}row`;
    const rule =
      row.kind === 'parenthetical' && failure.code === 'invalid-edit'
        ? ' A Parenthetical starts with an opening parenthesis.'
        : '';
    const resume = row.text
      ? 'Change that row or Undo to resume.'
      : 'Type its text or Undo to resume.';
    stopped = `Row ${row.index + 1}, ${named}, cannot be saved as Fountain as it stands.${rule} ${resume}`;
  }
  const recovery = refusalRecovery(failure);
  if (recovery) {
    const first = recovery.retyped[0];
    const kept =
      first && first.kind !== 'omitted'
        ? ` If babel closes unexpectedly, recovery reopens row ${first.row.index + 1} as ${elementLabels.get(first.kind)}.`
        : '';
    return `Saving the file is paused; recovery still protects all of your text. ${stopped}${kept}`;
  }
  return `Saving and recovery are paused. ${stopped} To keep the draft exactly as it is, use Close session, then Save Emergency Copy and close.`;
}

/** Human-readable failure text; the draft always stays open. */
export function writingFailureMessage(failure: unknown): string {
  if (failure instanceof FountainEditError && failure.code !== 'read-only')
    return captureRefusalMessage(failure);
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
