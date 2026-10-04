import { isCurrent, applyEditorTransaction } from './state';
import { closeHistory } from 'prosemirror-history';
import { TextSelection, type EditorState } from 'prosemirror-state';
import type { ManuscriptProjection } from '../application/manuscriptProjection';
import type { FindMatch, FindOptions } from '../domain/find';
import { screenplaySchema } from './schema';
import { captureEditor } from './sourceBridge';
import { logicalEditorOffset } from './outlineNavigation';

/** Replacement text caps at the same bound as the find query it answers. */
export const MAX_REPLACE_TEXT = 1024;
/**
 * Replace-all at or above this many editable matches needs an explicit second
 * confirmation in the panel. The count is exact for current results only.
 */
export const REPLACE_ALL_CONFIRM_THRESHOLD = 100;

const loneSurrogate =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;
const hiddenDelimiter = /\[\[|\]\]|\/\*|\*\//;

export function validateReplacementText(text: string): void {
  if (text.length > MAX_REPLACE_TEXT)
    throw new RangeError(
      `Replacement exceeds ${MAX_REPLACE_TEXT} UTF-16 units. Shorten it.`,
    );
  if (/[\r\n]/.test(text))
    throw new RangeError(
      'Replacement cannot contain line breaks. Replace within one row only.',
    );
  if (loneSurrogate.test(text))
    throw new RangeError('Replacement contains incomplete Unicode input.');
  if (hiddenDelimiter.test(text))
    throw new RangeError(
      'Replacement cannot introduce hidden-region delimiters. Source retained.',
    );
}

export interface ReplaceEdit {
  readonly match: FindMatch;
  readonly row: number;
  readonly id: string;
  /** Scalar-safe offset in the retained editor row. */
  readonly editorFrom: number;
  readonly editorTo: number;
  /** Exact editor text covered at plan time; apply refuses anything else. */
  readonly expected: string;
}
export interface ReplaceRefusal {
  readonly match: FindMatch;
  readonly reason: string;
}
export interface ReplacePlan {
  readonly session: object;
  readonly version: number;
  readonly doc: EditorState['doc'];
  readonly query: string;
  readonly options: FindOptions;
  readonly replacement: string;
  readonly edits: readonly ReplaceEdit[];
  readonly refused: readonly ReplaceRefusal[];
  readonly large: boolean;
}

function refusalReason(scope: FindMatch['location']['scope']): string {
  switch (scope) {
    case 'title':
      return 'Title matches stay read-only here. Use the Title page form; source retained.';
    case 'note':
      return 'A protected note region keeps its exact bytes; source retained.';
    case 'omitted':
      return 'A protected omission keeps its exact bytes; source retained.';
    case 'raw':
      return 'A protected raw region keeps its exact bytes; source retained.';
    default:
      return 'A protected row keeps its exact bytes; source retained.';
  }
}

/** Preserve a uniformly formatted match; refuse ambiguous emphasis changes. */
function replacementMarks(node: EditorState['doc'], from: number, to: number) {
  const marks = node.childAfter(from).node?.marks ?? [];
  let mixed = false;
  node.nodesBetween(from, to, (part) => {
    if (
      part.isText &&
      (part.marks.length !== marks.length ||
        part.marks.some((mark, i) => !mark.eq(marks[i]!)))
    )
      mixed = true;
  });
  if (mixed)
    throw new Error(
      'This match crosses different emphasis. Edit it directly to preserve each mark; source retained.',
    );
  return marks;
}

/**
 * Pure bounded plan over current find matches. Maps logical ranges into the
 * retained editor rows for later EditorState transactions; raw Fountain
 * source is never edited directly. Protected or unmappable matches are
 * classified as refusals, never silently dropped or partially rewritten.
 */
export function planReplace(
  projection: ManuscriptProjection,
  matches: readonly FindMatch[],
  options: FindOptions,
  replacement: string,
): ReplacePlan {
  validateReplacementText(replacement);
  const edits: ReplaceEdit[] = [];
  const refused: ReplaceRefusal[] = [];
  for (const match of matches) {
    const location = match.location;
    if (!projection.index.texts.includes(location)) {
      refused.push(
        Object.freeze({
          match,
          reason: 'A foreign result cannot authorize replacement.',
        }),
      );
      continue;
    }
    const node = projection.doc.child(location.row);
    if (!node || node.attrs.id !== location.rowId) {
      refused.push(
        Object.freeze({
          match,
          reason: 'Replace preview is stale. Search again before replacing.',
        }),
      );
      continue;
    }
    if (node.attrs.protected || location.scope === 'title') {
      refused.push(
        Object.freeze({ match, reason: refusalReason(location.scope) }),
      );
      continue;
    }
    let editorFrom: number, editorTo: number;
    try {
      editorFrom = logicalEditorOffset(projection, location, match.from);
      editorTo = logicalEditorOffset(projection, location, match.to);
    } catch {
      refused.push(
        Object.freeze({
          match,
          reason:
            'A match cannot be mapped to the editor row; source retained.',
        }),
      );
      continue;
    }
    if (
      editorFrom < 0 ||
      editorTo > node.textContent.length ||
      editorFrom >= editorTo
    ) {
      refused.push(
        Object.freeze({
          match,
          reason:
            'A match cannot be mapped to the editor row; source retained.',
        }),
      );
      continue;
    }
    try {
      replacementMarks(node, editorFrom, editorTo);
    } catch (failure) {
      refused.push(
        Object.freeze({ match, reason: (failure as Error).message }),
      );
      continue;
    }
    edits.push(
      Object.freeze({
        match,
        row: location.row,
        id: String(node.attrs.id),
        editorFrom,
        editorTo,
        expected: node.textContent.slice(editorFrom, editorTo),
      }),
    );
  }
  return Object.freeze({
    session: projection.session,
    version: projection.version,
    doc: projection.doc,
    query: options.query,
    options: Object.freeze({ ...options }),
    replacement,
    edits: Object.freeze(edits),
    refused: Object.freeze(refused),
    large: edits.length >= REPLACE_ALL_CONFIRM_THRESHOLD,
  });
}

/** Position of a planned edit for one match, or -1 when it is refused. */
export function editForMatch(plan: ReplacePlan, match: FindMatch): number {
  return plan.edits.findIndex((edit) => edit.match === match);
}

function checkEdit(state: EditorState, edit: ReplaceEdit): void {
  const node = state.doc.child(edit.row);
  if (!node || String(node.attrs.id) !== edit.id)
    throw new Error('Replace preview is stale. Search again before replacing.');
  if (node.attrs.protected)
    throw new Error('A protected row keeps its exact bytes; source retained.');
  if (node.textContent.slice(edit.editorFrom, edit.editorTo) !== edit.expected)
    throw new Error('Replace preview is stale. Search again before replacing.');
}

function checkPlan(state: EditorState, plan: ReplacePlan): void {
  if (!isCurrent(state, plan))
    throw new Error('Replace preview is stale. Search again before replacing.');
}

function insertReplacement(
  tr: EditorState['tr'],
  from: number,
  to: number,
  replacement: string,
): EditorState['tr'] {
  const start = tr.doc.resolve(from);
  const end = tr.doc.resolve(to);
  const marks = replacementMarks(
    start.parent,
    start.parentOffset,
    end.parentOffset,
  );
  return replacement
    ? tr.replaceWith(from, to, screenplaySchema.text(replacement, marks))
    : tr.delete(from, to);
}

/**
 * One replace-one editor transaction over the exact planned range. The caller
 * trial-applies and dispatches; this function never touches source bytes.
 */
export function replaceOneTransaction(
  state: EditorState,
  projection: ManuscriptProjection,
  plan: ReplacePlan,
  editIndex: number,
): EditorState['tr'] {
  checkPlan(state, plan);
  const edit = plan.edits[editIndex];
  if (!edit) throw new Error('That match is not replaceable; source retained.');
  checkEdit(state, edit);
  const row = projection.rows[edit.row];
  if (!row || row.id !== edit.id)
    throw new Error('Replace preview is stale. Search again before replacing.');
  const from = row.from + edit.editorFrom;
  const to = row.from + edit.editorTo;
  const tr = insertReplacement(
    closeHistory(state.tr),
    from,
    to,
    plan.replacement,
  );
  return tr.setSelection(
    TextSelection.create(tr.doc, from + plan.replacement.length),
  );
}

/**
 * Atomic replace-all over every planned edit in one transaction, applied in
 * reverse document order so earlier offsets stay valid. One history event, so
 * one Undo restores the complete source and previous selection.
 */
export function replaceAllTransaction(
  state: EditorState,
  projection: ManuscriptProjection,
  plan: ReplacePlan,
): EditorState['tr'] {
  checkPlan(state, plan);
  if (!plan.edits.length)
    throw new Error('There is no replaceable match; source retained.');
  for (const edit of plan.edits) checkEdit(state, edit);
  const ordered = [...plan.edits].sort((a, b) =>
    a.row === b.row ? b.editorFrom - a.editorFrom : b.row - a.row,
  );
  let tr = closeHistory(state.tr);
  // Reverse document order keeps the pre-edit absolute positions of every
  // not-yet-edited range valid within the single transaction.
  let caret = 0;
  for (const edit of ordered) {
    const row = projection.rows[edit.row];
    if (!row || row.id !== edit.id)
      throw new Error(
        'Replace preview is stale. Search again before replacing.',
      );
    const from = row.from + edit.editorFrom;
    tr = insertReplacement(
      tr,
      from,
      from + (edit.editorTo - edit.editorFrom),
      plan.replacement,
    );
    caret = from + plan.replacement.length;
  }
  return tr.setSelection(TextSelection.create(tr.doc, caret));
}

/**
 * Trial-apply plus deferred capture before dispatch. A capture refusal keeps
 * the live editor unchanged, so planning can never publish an older source
 * past a representability failure.
 */
export function prepareEditorReplace(
  state: EditorState,
  projection: ManuscriptProjection,
  plan: ReplacePlan,
  scope: { one: number } | { all: true },
): EditorState['tr'] {
  const transaction =
    'one' in scope
      ? replaceOneTransaction(state, projection, plan, scope.one)
      : replaceAllTransaction(state, projection, plan);
  const next = applyEditorTransaction(state, transaction);
  if (!next.accepted)
    throw new Error('The editor refused this replacement; source retained.');
  try {
    captureEditor(next.state);
  } catch (failure) {
    throw new Error(
      failure instanceof Error
        ? `Replacement cannot round-trip to Fountain; source retained: ${failure.message}`
        : 'Replacement cannot round-trip to Fountain; source retained.',
      { cause: failure },
    );
  }
  return transaction;
}
