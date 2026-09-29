import { closeHistory } from 'prosemirror-history';
import type { EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { sourceForInline } from '../domain/fountainInline';
import { nodeRuns } from './state';
import { screenplaySchema } from './schema';
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
    return {
      handled: true,
      transaction: type.isInSet(marks)
        ? state.tr.removeStoredMark(type)
        : state.tr.addStoredMark(type.create()),
    };
  }
  const tr = closeHistory(state.tr);
  const transaction = state.doc.rangeHasMark(from, to, type)
    ? tr.removeMark(from, to, type)
    : tr.addMark(from, to, type.create());
  try {
    transaction.doc.nodesBetween(from, to, (node) => {
      if (node.isTextblock) {
        const encoded = sourceForInline(nodeRuns(node));
        if (
          node.type.name === 'parenthetical' &&
          !/^\([^)]*(?:\))?$/.test(encoded)
        )
          throw new Error('Keep the Parenthetical envelope outside emphasis');
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
