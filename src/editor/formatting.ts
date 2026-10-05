import { closeHistory } from 'prosemirror-history';
import type { EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { Fragment } from 'prosemirror-model';
import { sourceForInline } from '../domain/fountainInline';
import { nodeRuns } from './state';
import { screenplaySchema } from './schema';
import { rowSpells } from './sourceBridge';
import type { EditorCommandResult } from './commands';

export function toggleEditorMark(
  state: EditorState,
  style: string,
): EditorCommandResult {
  const type = screenplaySchema.marks[style];
  if (!type)
    return { handled: true, reason: 'Unsupported screenplay formatting' };
  const { from, to, empty, $from } = state.selection;
  let unsafe = false;
  state.doc.nodesBetween(from, to, (node) => {
    if (
      node.isTextblock &&
      (node.attrs.protected ||
        node.attrs.literal ||
        node.attrs.hiddenOf ||
        node.type.name === 'pageBreak')
    )
      unsafe = true;
  });
  if (
    unsafe ||
    ($from.parent.isTextblock &&
      ($from.parent.attrs.protected ||
        $from.parent.attrs.literal ||
        $from.parent.attrs.hiddenOf))
  )
    return {
      handled: true,
      reason: 'Formatting cannot safely round-trip in this source region',
    };
  if (empty) {
    const marks = state.storedMarks ?? $from.marks();
    if (type.isInSet(marks))
      return { handled: true, transaction: state.tr.removeStoredMark(type) };
    // Text typed at a row start would open the row with the marker.
    const row = $from.parent;
    if (row.isTextblock && $from.parentOffset === 0) {
      const opened = (styled: boolean) =>
        row.copy(
          Fragment.from(
            screenplaySchema.text('x', styled ? [type.create()] : []),
          ).append(row.content),
        );
      if (rowSpells(opened(false)) && !rowSpells(opened(true)))
        return {
          handled: true,
          reason:
            'Emphasis cannot start at the beginning of this element in Fountain',
        };
    }
    return {
      handled: true,
      transaction: state.tr.addStoredMark(type.create()),
    };
  }
  const tr = closeHistory(state.tr);
  const transaction = state.doc.rangeHasMark(from, to, type)
    ? tr.removeMark(from, to, type)
    : tr.addMark(from, to, type.create());
  try {
    transaction.doc.nodesBetween(from, to, (node, position) => {
      if (node.isTextblock) {
        const encoded = sourceForInline(nodeRuns(node));
        if (
          node.type.name === 'parenthetical' &&
          !/^\([^)]*(?:\))?$/.test(encoded)
        )
          throw new Error('Keep the Parenthetical envelope outside emphasis');
        // A marker in front of the text can cost the row its element.
        const before = state.doc.nodeAt(position);
        if (before?.textContent && rowSpells(before) && !rowSpells(node))
          throw new Error('The marked row has no Fountain spelling');
      }
    });
  } catch {
    return {
      handled: true,
      reason:
        'Selected emphasis cannot round-trip in Fountain; selection retained',
    };
  }
  return { handled: true, transaction };
}
export function dispatchIsolated(
  view: EditorView,
  transaction: EditorState['tr'],
) {
  view.dispatch(transaction);
  view.dispatch(closeHistory(view.state.tr).setMeta('addToHistory', false));
}
