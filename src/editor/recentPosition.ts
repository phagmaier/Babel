import { isCurrent } from './state';
import { TextSelection, type EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type {
  RecentPosition,
  PositionAnchor,
} from '../application/recentPosition';
import type { ManuscriptStamp } from '../application/manuscriptProjection';
function resolve(state: EditorState, anchor: PositionAnchor): number | null {
  if (
    !Number.isInteger(anchor.row) ||
    anchor.row < 0 ||
    anchor.row >= state.doc.childCount ||
    !Number.isInteger(anchor.offset) ||
    anchor.offset < 0
  )
    return null;
  const node = state.doc.child(anchor.row),
    text = node.textContent;
  if (
    anchor.offset > text.length ||
    (anchor.offset > 0 &&
      anchor.offset < text.length &&
      /[\uD800-\uDBFF]/.test(text[anchor.offset - 1]!) &&
      /[\uDC00-\uDFFF]/.test(text[anchor.offset]!))
  )
    return null;
  let from = 1;
  for (let row = 0; row < anchor.row; row++)
    from += state.doc.child(row).nodeSize;
  return from + anchor.offset;
}
/** Caller must supply current durable native identity/hash; checkpoint selection wins. */
export function recentSelection(
  state: EditorState,
  hint: RecentPosition,
  documentId: string,
  sourceSha256: string,
  checkpointSelection = false,
): TextSelection | null {
  if (
    checkpointSelection ||
    hint.documentId !== documentId ||
    hint.sourceSha256 !== sourceSha256 ||
    state.doc.childCount > 50_000
  )
    return null;
  const anchor = resolve(state, hint.anchor),
    head = resolve(state, hint.head);
  return anchor === null || head === null
    ? null
    : TextSelection.create(state.doc, anchor, head);
}
function edge(view: EditorView) {
  return (
    view.dom
      .closest('main')
      ?.querySelector('.writing-presentation')
      ?.getBoundingClientRect().bottom ?? 0
  );
}
function rowElement(view: EditorView, row: number): HTMLElement | null {
  return view.dom.children.item(row) as HTMLElement | null;
}
/** Binary layout probes, bounded by the existing index; manual scroll is independent of caret. */
export function captureRecentPosition(
  view: EditorView,
  projection: ManuscriptStamp & { readonly sourceSha256: string },
  documentId: string,
): RecentPosition | null {
  if (
    view.isDestroyed ||
    view.composing ||
    !isCurrent(view.state, projection) ||
    view.state.doc.childCount > 50_000
  )
    return null;
  const point = (position: number): PositionAnchor => {
    const resolved = view.state.doc.resolve(position);
    return { row: resolved.index(0), offset: resolved.parentOffset };
  };
  let low = 0,
    high = view.state.doc.childCount - 1;
  const top = edge(view);
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const rect = rowElement(view, middle)?.getBoundingClientRect();
    if (!rect) return null;
    if (rect.bottom < top) low = middle + 1;
    else high = middle;
  }
  const rect = rowElement(view, low)?.getBoundingClientRect();
  const viewport =
    rect &&
    rect.height > 0 &&
    rect.top < window.innerHeight &&
    rect.bottom >= top
      ? {
          row: low,
          fraction: Math.max(0, Math.min(1, (top - rect.top) / rect.height)),
        }
      : null;
  const anchor = point(view.state.selection.anchor),
    head = point(view.state.selection.head);
  if (
    resolve(view.state, anchor) === null ||
    resolve(view.state, head) === null
  )
    return null;
  return {
    documentId,
    sourceSha256: projection.sourceSha256,
    anchor,
    head,
    viewport,
  };
}
export function restoreRecentViewport(
  view: EditorView,
  hint: RecentPosition,
): boolean {
  if (view.isDestroyed || view.composing || !hint.viewport) return false;
  const target = rowElement(view, hint.viewport.row);
  if (!target) return false;
  // At the top of a newly opened document the sticky toolbar still has its
  // natural top offset. Re-read after scrolling once so its pinned edge, rather
  // than that old offset, determines the final viewport. Two probes, no follow.
  for (let pass = 0; pass < 2; pass++) {
    const rect = target.getBoundingClientRect();
    if (!Number.isFinite(rect.height) || rect.height <= 0) return false;
    const top = rect.top + rect.height * hint.viewport.fraction - edge(view);
    if (Math.abs(top) > 0.5) window.scrollBy({ top, behavior: 'instant' });
  }
  return true;
}
