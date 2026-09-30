import type { EditorView } from 'prosemirror-view';
import { TextSelection } from 'prosemirror-state';
import type { ManuscriptProjection } from '../application/manuscriptProjection';
import { editorOrigin, editorVersion } from './state';
import {
  extractedContentStart,
  logicalByteAt,
  type LogicalText,
} from '../domain/manuscriptIndex';

export function navigateOutline(
  view: EditorView,
  projection: ManuscriptProjection,
  row: number,
  offset = 0,
): boolean {
  if (
    view.isDestroyed ||
    view.composing ||
    editorOrigin(view.state).session !== projection.session ||
    editorVersion(view.state) !== projection.version ||
    view.state.doc !== projection.doc
  )
    return false;
  const target = projection.rows[row];
  const node = view.state.doc.maybeChild(row);
  if (
    !target ||
    !node ||
    node.attrs.id !== target.id ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > node.textContent.length
  )
    return false;
  const text = node.textContent;
  if (
    offset > 0 &&
    offset < text.length &&
    /[\uD800-\uDBFF]/.test(text[offset - 1]!) &&
    /[\uDC00-\uDFFF]/.test(text[offset]!)
  )
    return false;
  const position = target.from + offset;
  const previous = view.state;
  view.dispatch(
    view.state.tr
      .setSelection(TextSelection.create(view.state.doc, position))
      .setMeta('addToHistory', false)
      .setMeta('outlineNavigation', true),
  );
  if (view.state === previous || view.state.selection.head !== position)
    return false;
  // ProseMirror ignores a scroll request while the DOM selection is outside
  // its editor (as it is after activating an outline button). Focus and sync
  // the accepted caret first, including a selectable read-only view.
  view.dom.focus({ preventScroll: true });
  view.focus();
  view.dispatch(view.state.tr.setMeta('addToHistory', false).scrollIntoView());
  return true;
}

/** Scalar-safe logical offset in the retained editor row, or typed refusal. */
export function logicalEditorOffset(
  projection: ManuscriptProjection,
  location: LogicalText,
  offset: number,
): number {
  if (!projection.index.texts.includes(location))
    throw new RangeError('Foreign logical location');
  // Validate offsets even for rich rows.
  const byte = logicalByteAt(location, offset);
  const node = projection.doc.child(location.row);
  const line = projection.snapshot.capture.document.lines[location.row]!;
  if (
    !node.attrs.literal &&
    line.inline?.complete &&
    !['note', 'omitted', 'raw'].includes(location.scope)
  )
    return offset;
  let sourceOffset = 0,
    atByte = line.sourceStart;
  while (sourceOffset < line.sourceText.length && atByte < byte) {
    const code = line.sourceText.codePointAt(sourceOffset)!;
    sourceOffset += code > 0xffff ? 2 : 1;
    atByte += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  if (atByte !== byte) throw new RangeError('Unmapped logical boundary');
  return sourceOffset - extractedContentStart(line);
}
/** Source-to-editor adapter for title/hidden/raw and rich Unicode text locations. */
export function navigateLogicalText(
  view: EditorView,
  projection: ManuscriptProjection,
  location: LogicalText,
  offset: number,
): boolean {
  try {
    return navigateOutline(
      view,
      projection,
      location.row,
      logicalEditorOffset(projection, location, offset),
    );
  } catch {
    return false;
  }
}
