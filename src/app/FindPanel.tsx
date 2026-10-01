import { useEffect, useMemo, useRef, useState } from 'react';
import type { FindController, FindState } from '../application/find';
import { MAX_FIND_QUERY } from '../domain/find';
import {
  editForMatch,
  MAX_REPLACE_TEXT,
  planReplace,
  REPLACE_ALL_CONFIRM_THRESHOLD,
  type ReplacePlan,
} from '../editor/replace';
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
  onReplaceOne,
  onReplaceAll,
  replaceDisabled,
  replaceMessage,
}: {
  controller: FindController;
  state: FindState;
  disabled: boolean;
  onNavigate: (direction: 1 | -1, index?: number) => void;
  onClose: () => void;
  onReplaceOne?: (plan: ReplacePlan, editIndex: number) => void;
  onReplaceAll?: (plan: ReplacePlan) => void;
  replaceDisabled?: boolean;
  replaceMessage?: string;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const composing = useRef(false);
  const compositionEnded = useRef(false);
  const [replacement, setReplacement] = useState('');
  const [confirmArmed, setConfirmArmed] = useState(false);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const current = state.phase === 'current';
  const active = state.matches[state.active];
  const plan = useMemo(() => {
    if (!current || !state.projection) return null;
    try {
      return planReplace(
        state.projection,
        state.matches,
        state.options,
        replacement,
      );
    } catch {
      return null;
    }
  }, [current, state.projection, state.matches, state.options, replacement]);
  useEffect(() => {
    setConfirmArmed(false);
  }, [replacement, state.matches, state.options, state.projection]);
  const activeEdit = active && plan ? editForMatch(plan, active) : -1;
  const refusals = useMemo(() => {
    const counts = new Map<string, number>();
    for (const refusal of plan?.refused ?? [])
      counts.set(refusal.reason, (counts.get(refusal.reason) ?? 0) + 1);
    return [...counts.entries()];
  }, [plan]);
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
      <h2>Replace</h2>
      <label>
        Replace with{' '}
        <input
          type="text"
          maxLength={MAX_REPLACE_TEXT + 1}
          value={replacement}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
            compositionEnded.current = true;
          }}
          onChange={(e) => setReplacement(e.target.value)}
          onKeyDown={(event) => {
            if (
              composing.current ||
              event.nativeEvent.isComposing ||
              event.keyCode === 229 ||
              compositionEnded.current
            )
              return;
            if (event.key === 'Enter') {
              event.preventDefault();
              if (plan && !replaceDisabled) {
                if (event.shiftKey) {
                  if (plan.edits.length && onReplaceAll) {
                    if (!plan.large || confirmArmed) onReplaceAll(plan);
                    else setConfirmArmed(true);
                  }
                } else if (activeEdit >= 0 && onReplaceOne)
                  onReplaceOne(plan, activeEdit);
              }
            }
          }}
        />
      </label>
      <p>
        Replacement is plain text within one row and retains uniform emphasis;
        line breaks, incomplete Unicode and hidden-region delimiters are
        refused. Matches crossing different emphasis are excluded. Title,
        protected note, omitted and raw matches stay read-only and are listed
        below, not replaced.
      </p>
      <p>
        {current && plan
          ? `${plan.edits.length} replaceable${plan.refused.length ? ` · ${plan.refused.length} excluded` : ''}${plan.large ? ` · large change of ${plan.edits.length} matches (at least ${REPLACE_ALL_CONFIRM_THRESHOLD}) needs confirmation` : ''}.`
          : current
            ? 'Enter a valid replacement to preview changes.'
            : 'Replacement preview follows current find results.'}
      </p>
      {refusals.map(([reason, count]) => (
        <p key={reason}>
          Excluded {count}: {reason}
        </p>
      ))}
      <button
        type="button"
        disabled={
          disabled ||
          Boolean(replaceDisabled) ||
          !current ||
          !plan ||
          activeEdit < 0 ||
          !onReplaceOne
        }
        onClick={() => {
          if (plan && activeEdit >= 0 && onReplaceOne)
            onReplaceOne(plan, activeEdit);
        }}
      >
        Replace match
      </button>
      <button
        type="button"
        disabled={
          disabled ||
          Boolean(replaceDisabled) ||
          !current ||
          !plan ||
          !plan.edits.length ||
          !onReplaceAll
        }
        onClick={() => {
          if (!plan || !onReplaceAll) return;
          if (plan.large && !confirmArmed) {
            setConfirmArmed(true);
            return;
          }
          onReplaceAll(plan);
        }}
      >
        {plan?.large && !confirmArmed
          ? `Confirm replace all ${plan.edits.length} matches`
          : 'Replace all'}
      </button>
      {replaceMessage ? <p role="alert">{replaceMessage}</p> : null}
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
