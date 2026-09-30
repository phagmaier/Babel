import { useEffect, useRef } from 'react';
import type { FindController, FindState } from '../application/find';
import { MAX_FIND_QUERY } from '../domain/find';
export const FIND_LIST_LIMIT = 100;
const labels = {
  body: 'Script',
  title: 'Title field',
  note: 'Note',
  omitted: 'Omitted material',
  raw: 'Protected raw text — literal, interpretation uncertain',
};
export function FindPanel({
  controller,
  state,
  disabled,
  onNavigate,
  onClose,
}: {
  controller: FindController;
  state: FindState;
  disabled: boolean;
  onNavigate: (direction: 1 | -1, index?: number) => void;
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const composing = useRef(false);
  const compositionEnded = useRef(false);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const current = state.phase === 'current';
  const active = state.matches[state.active];
  const label = (match: (typeof state.matches)[number]) => {
    const projection = state.projection;
    const location = match.location;
    const field =
      location.scope === 'title'
        ? projection?.snapshot.capture.document.titleFields.find((field) =>
            field.values.some((value) => value.lineId === location.rowId),
          )
        : null;
    const uncertain = projection?.index.intact.some(
      (range) =>
        range.ambiguous &&
        range.from <= location.row &&
        location.row < range.to &&
        ['raw', 'note', 'boneyard'].includes(range.kind),
    );
    const incomplete =
      projection?.snapshot.capture.document.lines[location.row]?.inline
        ?.complete === false;
    return `${labels[location.scope]}${field ? ` (${field.key})` : ''}${(uncertain && location.scope !== 'raw') || incomplete ? ' — literal, interpretation uncertain' : ''}`;
  };
  return (
    <section
      className="find-panel"
      aria-label="Find in script"
      onKeyDown={(event) => {
        if (
          composing.current ||
          event.nativeEvent.isComposing ||
          event.keyCode === 229 ||
          compositionEnded.current
        )
          return;
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
        if (event.key === 'Enter' && event.target === input.current) {
          event.preventDefault();
          onNavigate(event.shiftKey ? -1 : 1);
        }
      }}
      onKeyUp={() => {
        compositionEnded.current = false;
      }}
    >
      <h2>Find</h2>
      <label>
        Find text{' '}
        <input
          ref={input}
          type="search"
          maxLength={MAX_FIND_QUERY + 1}
          value={state.options.query}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
            compositionEnded.current = true;
          }}
          onChange={(e) =>
            controller.configure({ ...state.options, query: e.target.value })
          }
        />
      </label>
      <label>
        Search scope{' '}
        <select
          value={state.options.scope}
          onChange={(e) =>
            controller.configure({
              ...state.options,
              scope: e.target.value as 'script' | 'scene',
            })
          }
        >
          <option value="script">Full script</option>
          <option value="scene">Current scene</option>
        </select>
      </label>
      {(
        [
          'caseSensitive',
          'wholeWord',
          'title',
          'note',
          'omitted',
          'raw',
        ] as const
      ).map((key, i) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={state.options[key]}
            onChange={(e) =>
              controller.configure({
                ...state.options,
                [key]: e.target.checked,
              })
            }
          />
          {
            [
              'Case sensitive',
              'Whole word',
              'Include title fields',
              'Include notes',
              'Include omitted material',
              'Include protected raw text',
            ][i]
          }
        </label>
      ))}
      <p>
        Matches stay within one source line or region. Whole word uses Unicode
        letters, accent marks, numbers and underscores. Case-insensitive search
        keeps different Unicode spellings distinct. Notes, omissions and
        uncertain text are searched literally.
      </p>
      <p role="status" aria-live="polite">
        {current
          ? `${state.matches.length} matches${active ? `; ${state.active + 1} of ${state.matches.length}` : ''}. ${state.message}`
          : state.message}
      </p>
      <button
        type="button"
        disabled={disabled || !current || !state.matches.length}
        onClick={() => onNavigate(-1)}
      >
        Previous match
      </button>
      <button
        type="button"
        disabled={disabled || !current || !state.matches.length}
        onClick={() => onNavigate(1)}
      >
        Next match
      </button>
      <button
        type="button"
        onClick={() => {
          if (!composing.current) onClose();
        }}
      >
        Close find
      </button>
      {active && current && (
        <p className="find-reveal">
          Revealed {label(active)}, source row {active.location.row + 1}:{' '}
          <strong>{active.location.text.slice(active.from, active.to)}</strong>.
          The exact target is selected in the editor; protected source remains
          read-only.
        </p>
      )}
      {current && state.matches.length > FIND_LIST_LIMIT && (
        <p>
          Showing the first {FIND_LIST_LIMIT} results. Next/Previous reaches all{' '}
          {state.matches.length}. Editor highlights show the first 500 and the
          active match.
        </p>
      )}
      {current && (
        <ol>
          {state.matches.slice(0, FIND_LIST_LIMIT).map((match, i) => (
            <li key={`${match.location.id}:${match.from}`}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onNavigate(1, i)}
              >
                {label(match)} · row {match.location.row + 1} ·{' '}
                {match.location.text.slice(
                  Math.max(0, match.from - 24),
                  Math.min(match.location.text.length, match.to + 24),
                )}
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
