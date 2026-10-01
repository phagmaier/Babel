import { useEffect, useRef, useState } from 'react';
import type { EditorView } from 'prosemirror-view';
import {
  SpellcheckController,
  type SpellcheckPort,
  type SpellcheckState,
} from '../application/spellcheck';

export function SpellcheckPanel({
  port,
  getView,
  blocked,
  readOnly = () => false,
  onController,
  onClose,
}: {
  port: SpellcheckPort;
  getView: () => EditorView | null;
  blocked: () => boolean;
  readOnly?: () => boolean;
  onController: (controller: SpellcheckController | null) => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<SpellcheckState | null>(null);
  const controller = useRef<SpellcheckController | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const language = useRef<HTMLSelectElement | null>(null);
  const restoreLanguageFocus = useRef(false);
  const callbacks = useRef({ getView, blocked, readOnly, onController });
  callbacks.current = { getView, blocked, readOnly, onController };
  useEffect(() => {
    const current = new SpellcheckController(
      port,
      () => callbacks.current.getView(),
      () => callbacks.current.blocked(),
      setState,
      () => callbacks.current.readOnly(),
    );
    controller.current = current;
    onController(current);
    heading.current?.focus();
    void current.load();
    return () => {
      current.dispose();
      controller.current = null;
      onController(null);
    };
    // Each panel owns one controller. Getters read the writing surface's live refs.
  }, []);
  const disabled =
    !state || state.busy || blocked() || Boolean(getView()?.composing);
  const status = state?.status;
  useEffect(() => {
    if (restoreLanguageFocus.current && !disabled) {
      language.current?.focus();
      restoreLanguageFocus.current = false;
    }
  }, [status?.language, disabled]);
  return (
    <section
      className="spellcheck-panel"
      aria-label="Offline spellcheck"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !e.nativeEvent.isComposing) {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <h2 tabIndex={-1} ref={heading}>
        Offline spellcheck
      </h2>
      <p>
        Check the current script explicitly. Editing or moving the caret clears
        old results. Suggestions never change text until you choose a
        correction.
      </p>
      <p>
        Ignore lasts for this application session and language. Add persists
        only in Babel’s local dictionary for that language. Editable Character
        cue names (without cue extensions) are skipped case-insensitively in
        this script; they are never automatically added.
      </p>
      <p role="status" aria-live="polite">
        {state?.message ?? 'Loading offline dictionaries…'}
      </p>
      {status && (
        <>
          <p>
            Effective spelling language: {status.language} (
            {status.available ? 'available' : 'unavailable'}). {status.resource}{' '}
            · {status.addedCount} added · {status.ignoredCount} ignored.
          </p>
          <label>
            <input
              type="checkbox"
              aria-label="Enable spellcheck"
              checked={status.enabled}
              disabled={disabled || status.needsAttention}
              onChange={(e) =>
                void controller.current?.configure(
                  status.language,
                  e.target.checked,
                )
              }
            />{' '}
            Enable spellcheck
          </label>
          <label>
            Spelling language{' '}
            <select
              aria-label="Spelling language"
              key={status.language}
              ref={language}
              value={status.language}
              disabled={disabled || status.needsAttention}
              onChange={(e) => {
                restoreLanguageFocus.current =
                  document.activeElement === e.currentTarget;
                void controller.current?.configure(
                  e.target.value,
                  status.enabled,
                );
              }}
            >
              {!status.languages.includes(status.language) && (
                <option value={status.language}>
                  {status.language} (unavailable)
                </option>
              )}
              {status.languages.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>
          </label>
          {!status.available && (
            <p role="alert">
              No installed offline dictionary for {status.language}. Writing and
              saving remain available.
            </p>
          )}
          {status.needsAttention && (
            <p role="alert">
              Local dictionary needs attention. Existing words are retained; Add
              and preferences are blocked.
            </p>
          )}
        </>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => void controller.current?.load()}
      >
        Reload dictionaries
      </button>
      <button
        type="button"
        disabled={disabled || !status?.enabled || !status.available}
        onClick={() => void controller.current?.check()}
      >
        Check spelling
      </button>
      <button type="button" onClick={onClose}>
        Close spellcheck
      </button>
      {state?.active && (
        <section aria-label="Spelling suggestions">
          <h3>“{state.active.word}”</h3>
          {state.suggestions.map((word) => (
            <button
              type="button"
              key={word}
              disabled={disabled || readOnly()}
              onClick={() => controller.current?.correct(word)}
            >
              Use {word}
            </button>
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={() => void controller.current?.vocabulary('ignore')}
          >
            Ignore this session
          </button>
          <button
            type="button"
            disabled={disabled || status?.needsAttention}
            onClick={() => void controller.current?.vocabulary('add')}
          >
            Add to local dictionary
          </button>
        </section>
      )}
      {!!state?.issues.length && (
        <ol aria-label="Spelling issues">
          {state.issues.map((word) => (
            <li key={word.from}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => void controller.current?.choose(word)}
              >
                Review {word.word} (row {word.row + 1})
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
