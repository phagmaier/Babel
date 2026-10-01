import { closeHistory } from 'prosemirror-history';
import { Plugin, TextSelection, type EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import { editorOrigin, editorVersion, applyEditorTransaction } from './state';
import { captureEditor } from './sourceBridge';
import type { SpellingScan, SpellingWord } from '../application/spellcheck';

const highlights = new WeakMap<
  EditorState['doc'],
  { version: number; set: DecorationSet }
>();
export const spellcheckPlugin = new Plugin({
  props: {
    decorations(state) {
      const entry = highlights.get(state.doc);
      return entry?.version === editorVersion(state)
        ? entry.set
        : DecorationSet.empty;
    },
  },
});
export function highlightSpelling(
  view: EditorView,
  scan: SpellingScan | null,
  issues: readonly SpellingWord[],
) {
  if (view.isDestroyed) return;
  highlights.delete(view.state.doc);
  if (
    scan &&
    scan.doc === view.state.doc &&
    scan.version === editorVersion(view.state)
  )
    highlights.set(scan.doc, {
      version: scan.version,
      set: DecorationSet.create(
        scan.doc,
        issues.map((w) =>
          Decoration.inline(w.from, w.to, { class: 'spelling-issue' }),
        ),
      ),
    });
  if (!view.composing) view.setProps({});
}
/** Branded range, exact state/version, uniform marks and trial round-trip before dispatch. */
export function correctSpelling(
  state: EditorState,
  scan: SpellingScan,
  word: SpellingWord,
  replacement: string,
) {
  if (
    state.doc !== scan.doc ||
    editorOrigin(state).session !== scan.session ||
    editorVersion(state) !== scan.version ||
    !scan.words.includes(word)
  )
    throw new Error(
      'Spelling suggestion is stale. Check again; source retained.',
    );
  if (editorOrigin(state).document.readOnlyReason)
    throw new Error('Read-only manuscript; source retained.');
  if (
    !replacement ||
    new TextEncoder().encode(replacement).length > 128 ||
    !/^\p{L}[\p{L}\p{M}\p{N}]*(?:['’-][\p{L}\p{M}\p{N}]+)*$/u.test(replacement)
  )
    throw new Error('Invalid correction; source retained.');
  const from = state.doc.resolve(word.from),
    to = state.doc.resolve(word.to);
  if (
    from.parent !== to.parent ||
    from.parent.attrs.protected ||
    from.parent.textBetween(from.parentOffset, to.parentOffset) !== word.word
  )
    throw new Error('Protected or changed spelling range; source retained.');
  const marks = from.parent.childAfter(from.parentOffset).node?.marks ?? [];
  let mixed = false;
  state.doc.nodesBetween(word.from, word.to, (node) => {
    if (
      node.isText &&
      (node.marks.length !== marks.length ||
        node.marks.some((m, i) => !m.eq(marks[i]!)))
    )
      mixed = true;
  });
  if (mixed)
    throw new Error(
      'This word crosses different emphasis. Edit it directly to preserve each mark; source retained.',
    );
  const tr = closeHistory(state.tr).replaceWith(
    word.from,
    word.to,
    state.schema.text(replacement, marks),
  );
  tr.setSelection(TextSelection.create(tr.doc, word.from + replacement.length))
    .setMeta('spellcheck', true)
    .scrollIntoView();
  const trial = applyEditorTransaction(state, tr);
  if (!trial.accepted) throw new Error('Correction refused; source retained.');
  captureEditor(trial.state);
  return tr;
}
