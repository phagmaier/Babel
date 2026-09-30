import { TextSelection } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import type { ManuscriptProjection } from '../application/manuscriptProjection';
import type { FindMatch } from '../domain/find';
import { editorOrigin, editorVersion } from './state';
import { logicalEditorOffset } from './outlineNavigation';
export const FIND_HIGHLIGHT_LIMIT = 500;
function current(view: EditorView, projection: ManuscriptProjection) {
  return (
    !view.isDestroyed &&
    editorOrigin(view.state).session === projection.session &&
    editorVersion(view.state) === projection.version &&
    view.state.doc === projection.doc
  );
}
function range(projection: ManuscriptProjection, match: FindMatch) {
  const row = projection.rows[match.location.row];
  if (!row || row.id !== match.location.rowId)
    throw new RangeError('Foreign row');
  return {
    from:
      row.from + logicalEditorOffset(projection, match.location, match.from),
    to: row.from + logicalEditorOffset(projection, match.location, match.to),
  };
}
export function highlightFind(
  view: EditorView,
  projection: ManuscriptProjection | null,
  matches: readonly FindMatch[],
  active: number,
) {
  if (view.isDestroyed || view.composing) return;
  const decorations: Decoration[] = [];
  if (projection && current(view, projection)) {
    const shown = matches.slice(0, FIND_HIGHLIGHT_LIMIT);
    if (active >= FIND_HIGHLIGHT_LIMIT && matches[active])
      shown.push(matches[active]!);
    for (const match of shown) {
      try {
        const { from, to } = range(projection, match);
        decorations.push(
          Decoration.inline(from, to, {
            class:
              match === matches[active]
                ? 'find-highlight find-active'
                : 'find-highlight',
          }),
        );
      } catch {
        /* An unmappable advisory range never changes text. */
      }
    }
  }
  if (!decorations.length) {
    if (view.props.decorations) view.setProps({ decorations: undefined });
    return;
  }
  const set = DecorationSet.create(view.state.doc, decorations);
  // View-only decorations preserve EditorState identity for staged/frozen workflows.
  // Every editor update checks the captured stamp, so edits/selection clear stale marks.
  view.setProps({
    decorations: () =>
      projection && current(view, projection) ? set : DecorationSet.empty,
  });
}
export function navigateFind(
  view: EditorView,
  projection: ManuscriptProjection,
  match: FindMatch,
  scroll = true,
): boolean {
  if (!current(view, projection) || view.composing) return false;
  try {
    const { from, to } = range(projection, match);
    const previous = view.state;
    view.dispatch(
      view.state.tr
        .setSelection(TextSelection.create(view.state.doc, from, to))
        .setMeta('outlineNavigation', true)
        .setMeta('findNavigation', true)
        .setMeta('addToHistory', false),
    );
    if (
      previous === view.state ||
      view.state.selection.from !== from ||
      view.state.selection.to !== to
    )
      return false;
    view.dom.focus({ preventScroll: true });
    view.focus();
    if (scroll)
      view.dispatch(
        view.state.tr.setMeta('addToHistory', false).scrollIntoView(),
      );
    return true;
  } catch {
    return false;
  }
}
