import { memo } from 'react';
import type { ProjectionState } from '../application/manuscriptProjection';
import type { CharacterEntry } from '../domain/characterCounts';
import { COUNT_RULES } from '../domain/characterCounts';
import { CHARACTER_HIGHLIGHT_LIMIT } from '../editor/characterFocus';
export const CHARACTER_RENDER_LIMIT = 500;
export const CharacterPanel = memo(function CharacterPanel({
  state,
  selected,
  highlight,
  disabled = false,
  onSelect,
  onHighlight,
  onNavigate,
}: {
  state: ProjectionState;
  selected: string | null;
  highlight: boolean;
  disabled?: boolean;
  onSelect: (name: string | null) => void;
  onHighlight: (enabled: boolean) => void;
  onNavigate: (entry: CharacterEntry) => void;
}) {
  const facts = state.projection?.facts;
  const current = state.phase === 'current' && !!facts;
  const character = facts?.characters.find((entry) => entry.name === selected);
  return (
    <aside className="character-panel" aria-label="Characters and counts">
      <h2>Characters and counts</h2>
      <p role="status">
        {current
          ? `Counts from version ${state.projection!.version}.`
          : state.phase === 'unavailable'
            ? 'Counts unavailable; earlier facts are stale.'
            : 'Counts updating; earlier facts are stale.'}
      </p>
      {facts && (
        <p>
          {facts.words.body} script words · {facts.scenes} scenes ·{' '}
          {facts.characters.length} characters. Title: {facts.words.title};
          notes: {facts.words.note}; omissions: {facts.words.omitted}; raw:{' '}
          {facts.words.raw}; outline: {facts.words.outline} words.
        </p>
      )}
      <details>
        <summary>Count inclusion rules</summary>
        <p>{COUNT_RULES}</p>
        <p>
          Character spellings remain distinct, including case and Unicode
          normalization. Extensions do not create a new speaker. Dialogue
          highlighting includes associated parentheticals and both independent
          speakers of dual dialogue.
        </p>
      </details>
      <label>
        Character focus{' '}
        <select
          aria-label="Character focus"
          value={character?.name ?? ''}
          disabled={!current || disabled}
          onChange={(event) => onSelect(event.target.value || null)}
        >
          <option value="">All characters</option>
          {facts?.characters.slice(0, CHARACTER_RENDER_LIMIT).map((entry) => (
            <option key={entry.name} value={entry.name}>
              {entry.name} ({entry.cues.length} cues)
            </option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={highlight}
          disabled={!current || disabled}
          onChange={(event) => onHighlight(event.target.checked)}
        />
        Highlight dialogue
      </label>
      <button
        type="button"
        disabled={!current || disabled || !character}
        onClick={() => character && onNavigate(character)}
      >
        Next character cue
      </button>
      {facts && facts.characters.length > CHARACTER_RENDER_LIMIT && (
        <p>
          Showing the first {CHARACTER_RENDER_LIMIT} of{' '}
          {facts.characters.length} character spellings.
        </p>
      )}
      {highlight &&
        character &&
        character.speechRows.length > CHARACTER_HIGHLIGHT_LIMIT && (
          <p>
            Highlighting the first {CHARACTER_HIGHLIGHT_LIMIT} of{' '}
            {character.speechRows.length} dialogue/parenthetical rows.
          </p>
        )}
    </aside>
  );
});
