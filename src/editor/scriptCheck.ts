import { isCurrent, editorOrigin, editorVersion } from './state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import { Plugin, TextSelection } from 'prosemirror-state';
import type { ManuscriptProjection } from '../application/manuscriptProjection';
import type { CheckIssue } from '../domain/scriptCheck';

export const CHECK_HIGHLIGHT_LIMIT = 500;
const highlights = new WeakMap<
  ManuscriptProjection['doc'],
  { projection: ManuscriptProjection; set: DecorationSet }
>();
export const checkHighlightPlugin = new Plugin({
  props: {
    decorations(state) {
      const entry = highlights.get(state.doc);
      return entry &&
        editorOrigin(state).session === entry.projection.session &&
        editorVersion(state) === entry.projection.version
        ? entry.set
        : DecorationSet.empty;
    },
  },
});

function current(view: EditorView, projection: ManuscriptProjection) {
  return !view.isDestroyed && isCurrent(view.state, projection);
}

/**
 * Source document lines and editor rows share stable ids; every mapping below
 * goes through ids, never through a bare line index, so row compaction (for
 * example virtual or merged rows) can never silently misdirect navigation.
 */
function rowForLine(
  projection: ManuscriptProjection,
  byId: Map<string, number>,
  line: number,
): number {
  const id = projection.snapshot.capture.document.lines[line]?.id;
  if (id === undefined) return -1;
  return byId.get(id) ?? -1;
}

function rowIndex(projection: ManuscriptProjection): Map<string, number> {
  const rows = new Map<string, number>();
  projection.rows.forEach((row, index) => rows.set(row.id, index));
  return rows;
}

/**
 * View-only block highlights for visible check issues. Decorations never
 * change EditorState identity, source, marks, Undo or versions.
 */
export function highlightCheckIssues(
  view: EditorView,
  projection: ManuscriptProjection | null,
  issues: readonly CheckIssue[],
) {
  if (view.isDestroyed || view.composing) return;
  const decorations: Decoration[] = [];
  if (projection && current(view, projection)) {
    const byId = rowIndex(projection);
    for (const issue of issues.slice(0, CHECK_HIGHLIGHT_LIMIT)) {
      if (issue.line === null) continue;
      const start = rowForLine(projection, byId, issue.line);
      const end = rowForLine(projection, byId, issue.endLine);
      const row = start >= 0 ? start : end;
      if (row < 0) continue;
      const node = projection.doc.child(row);
      const from = projection.rows[row];
      if (!node || !from || String(node.attrs.id) !== from.id) continue;
      decorations.push(
        Decoration.inline(from.from, from.from + node.textContent.length, {
          class: `check-highlight check-${issue.severity}`,
        }),
      );
    }
  }
  highlights.delete(view.state.doc);
  if (projection && decorations.length && current(view, projection))
    highlights.set(view.state.doc, {
      projection,
      set: DecorationSet.create(view.state.doc, decorations),
    });
  // Redraw plugin props without a transaction or EditorState identity change.
  view.setProps({});
}

/** Editor range covering the affected rows, derived through stable ids. */
export function checkIssueRange(
  projection: ManuscriptProjection,
  issue: CheckIssue,
): { from: number; to: number } | null {
  if (issue.line === null) return null;
  const byId = rowIndex(projection);
  const lines = projection.snapshot.capture.document.lines;
  let start = -1;
  let end = -1;
  for (let line = issue.line; line <= issue.endLine; line++) {
    const row = rowForLine(projection, byId, line);
    if (row >= 0) {
      if (start < 0) start = row;
      end = row;
    }
  }
  if (start < 0) {
    // A blank-only finding (for example trailing spacing) offers the next
    // content row; nothing follows it, there is no honest target.
    for (let line = issue.endLine + 1; line < lines.length; line++) {
      const row = rowForLine(projection, byId, line);
      if (row >= 0) {
        start = row;
        end = row;
        break;
      }
    }
  }
  if (start < 0) return null;
  const first = projection.rows[start];
  const last = projection.rows[end];
  const lastNode = projection.doc.child(end);
  if (!first || !last || !lastNode || String(lastNode.attrs.id) !== last.id)
    return null;
  const from = first.from;
  return { from, to: last.from + lastNode.textContent.length };
}

/**
 * Explicit Go to Issue navigation selecting the affected block. Reveals
 * hidden/title content through selection without editing it.
 */
export function navigateCheckIssue(
  view: EditorView,
  projection: ManuscriptProjection,
  issue: CheckIssue,
): boolean {
  if (view.isDestroyed || view.composing) return false;
  if (!current(view, projection)) return false;
  const range = checkIssueRange(projection, issue);
  if (!range) return false;
  // Selection and focus apply now; the writing view scrolls once after paint
  // through the same deferred path as find navigation.
  const tr = view.state.tr
    .setSelection(TextSelection.create(view.state.doc, range.from, range.to))
    .setMeta('addToHistory', false)
    .setMeta('outlineNavigation', true);
  view.dispatch(tr);
  view.dom.focus({ preventScroll: true });
  view.focus();
  return true;
}
