import { isCurrent, editorOrigin, editorVersion } from './state';
import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import type { ManuscriptProjection } from '../application/manuscriptProjection';
import type { CharacterEntry } from '../domain/characterCounts';
export const CHARACTER_HIGHLIGHT_LIMIT = 1_000;
const highlights = new WeakMap<
  object,
  { session: object; version: number; set: DecorationSet }
>();
/** Separate plugin source composes with Find/Check/spelling without replacing their props. */
export const characterFocusPlugin = new Plugin({
  props: {
    decorations(state) {
      const entry = highlights.get(state.doc);
      return entry?.session === editorOrigin(state).session &&
        entry.version === editorVersion(state)
        ? entry.set
        : DecorationSet.empty;
    },
  },
});
export function highlightCharacter(
  view: EditorView,
  projection: ManuscriptProjection | null,
  character: CharacterEntry | null,
) {
  if (view.isDestroyed || view.composing) return;
  highlights.delete(view.state.doc);
  if (
    projection &&
    character &&
    projection.facts.characters.includes(character) &&
    isCurrent(view.state, projection)
  ) {
    const decorations: Decoration[] = [];
    for (const row of character.speechRows.slice(
      0,
      CHARACTER_HIGHLIGHT_LIMIT,
    )) {
      const target = projection.rows[row];
      const node = projection.doc.maybeChild(row);
      if (target && node && target.id === node.attrs.id)
        decorations.push(
          Decoration.node(target.from - 1, target.from - 1 + node.nodeSize, {
            class: 'character-highlight',
          }),
        );
    }
    highlights.set(projection.doc, {
      session: projection.session,
      version: projection.version,
      set: DecorationSet.create(projection.doc, decorations),
    });
  }
  view.setProps({});
}
