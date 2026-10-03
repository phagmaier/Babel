import type { EditorView } from 'prosemirror-view';
import type { ProjectionState } from '../application/manuscriptProjection';
import type { CommandContext } from '../application/commandDispatch';
import { navigateOutline } from '../editor/outlineNavigation';
import type { PaletteEntry } from './CommandPalette';

/** Render values and the live command-facts closure stay component-owned. */
export interface PaletteSessionDeps {
  outline: ProjectionState;
  viewRef: { current: EditorView | null };
  getFacts: () => CommandContext;
  setError: (message: string) => void;
}

export interface PaletteSession {
  paletteNavigation: () => PaletteEntry[];
}

export function usePaletteSession({
  outline,
  viewRef,
  getFacts,
  setError,
}: PaletteSessionDeps): PaletteSession {
  const paletteNavigation = () =>
    outline.phase === 'current' && outline.projection
      ? outline.projection.index.items.map((item) => {
          const captured = outline.projection!;
          return {
            id: `navigation.${item.id}`,
            label: `${item.kind === 'scene' ? 'Scene ' + item.ordinal : 'Section'}: ${item.label.slice(0, 300)}`,
            hint: item.sceneNumber
              ? `Authored number ${item.sceneNumber}`
              : 'Navigate without editing',
            activate: () => {
              const current = viewRef.current;
              const facts = getFacts();
              if (
                !current ||
                facts.blocked ||
                facts.composing ||
                facts.staged ||
                !facts.ready ||
                !navigateOutline(current, captured, item.row)
              )
                setError(
                  'Palette navigation is stale or unavailable. Text and selection are retained.',
                );
            },
          };
        })
      : [];

  return { paletteNavigation };
}
