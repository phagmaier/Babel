import { useEffect, useRef, useState } from 'react';
import type { EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { FountainDocument } from '../domain/fountainModel';
import type { TitleAction } from '../domain/titlePage';
import { applyTitlePage } from '../editor/titlePage';

interface Draft {
  id: string | null;
  key: string;
  value: string;
  originalKey: string;
  originalValue: string;
  state: EditorState;
}
export function TitlePagePanel({
  document,
  state,
  getView,
  disabled,
  readOnly,
  onDraft,
  onApply,
  onClose,
}: {
  document: FountainDocument | null;
  state: EditorState;
  getView: () => EditorView | null;
  disabled: boolean;
  readOnly: boolean;
  onDraft: (dirty: boolean, composing: boolean) => void;
  onApply: (apply: () => boolean) => boolean;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const composing = useRef(false);
  const compositionEnded = useRef(false);
  const [compositionActive, setCompositionActive] = useState(false);
  const fieldInput = useRef<HTMLInputElement | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const dirty = Boolean(
    draft &&
    (draft.id === null ||
      draft.key !== draft.originalKey ||
      draft.value !== draft.originalValue),
  );
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const publish = (next: Draft | null) => {
    const changed = Boolean(
      next &&
      (next.id === null ||
        next.key !== next.originalKey ||
        next.value !== next.originalValue),
    );
    // Publish synchronously, before a native close event or global shortcut can run.
    if (!next) compositionEnded.current = false;
    dirtyRef.current = changed;
    onDraft(changed, composing.current);
    setDraft(next);
  };
  useEffect(() => {
    closeButton.current?.focus();
  }, []);
  useEffect(() => {
    if (draft) fieldInput.current?.focus();
  }, [draft?.id]);
  const close = () => {
    if (composing.current || dirtyRef.current) {
      setError(
        'Apply or Discard the uncommitted title input before closing this form.',
      );
      return;
    }
    onDraft(false, false);
    onClose();
  };
  const perform = (action: TitleAction, expected = state) => {
    const view = getView();
    if (
      !view ||
      disabled ||
      readOnly ||
      composing.current ||
      view.composing ||
      view.state !== expected
    ) {
      setError(
        'Title change refused: read-only, composing, busy or stale. Input retained.',
      );
      return false;
    }
    try {
      if (!onApply(() => applyTitlePage(view, expected, action)))
        throw new Error('Editor refused the title change. Input retained.');
      setError('');
      return true;
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Title change refused. Input retained.',
      );
      return false;
    }
  };
  return (
    <section
      className="title-page-panel"
      aria-label="Title page"
      onCompositionStart={() => {
        composing.current = true;
        compositionEnded.current = false;
        setCompositionActive(true);
        onDraft(dirtyRef.current, true);
      }}
      onCompositionEnd={() => {
        composing.current = false;
        compositionEnded.current = true;
        setCompositionActive(false);
        onDraft(dirtyRef.current, false);
      }}
      onKeyUp={() => {
        compositionEnded.current = false;
      }}
      onKeyDown={(event) => {
        if (
          event.key === 'Enter' &&
          compositionEnded.current &&
          (event.target instanceof HTMLInputElement ||
            event.target instanceof HTMLTextAreaElement)
        ) {
          event.preventDefault();
          return;
        }
        if (
          event.key === 'Escape' &&
          !event.nativeEvent.isComposing &&
          !composing.current &&
          event.keyCode !== 229
        ) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <h2>Title page</h2>
      <p>
        Fields keep their authored order and Fountain emphasis. Enter adds a
        continuation line. Empty continuations may be unrepresentable.
      </p>
      <button ref={closeButton} type="button" onClick={close}>
        Close title page
      </button>
      {readOnly && <p>This title page is read-only.</p>}
      {!document && <p role="status">Waiting for a current source capture…</p>}
      {document && (
        <ol>
          {document.titleFields.map((field, i) => (
            <li key={field.id}>
              <strong>{field.key}</strong>
              {field.unknown && <span> (unknown field)</span>}
              <pre>
                {field.values.map((v) => v.text).join('\n') || '(empty value)'}
              </pre>
              <button
                type="button"
                aria-label={`Edit field ${i + 1}: ${field.key}`}
                disabled={disabled || readOnly || !!draft}
                onClick={() => {
                  const value = field.values.map((v) => v.text).join('\n');
                  publish({
                    id: field.id,
                    key: field.key,
                    value,
                    originalKey: field.key,
                    originalValue: value,
                    state,
                  });
                  setError('');
                }}
              >
                Edit
              </button>
              <button
                type="button"
                aria-label={`Remove field ${i + 1}: ${field.key}`}
                disabled={disabled || readOnly || !!draft}
                onClick={() => perform({ kind: 'remove', id: field.id })}
              >
                Remove
              </button>
              {(['up', 'down'] as const).map((direction) => (
                <button
                  key={direction}
                  type="button"
                  aria-label={`Move field ${i + 1}: ${field.key} ${direction}`}
                  disabled={
                    disabled ||
                    readOnly ||
                    !!draft ||
                    (direction === 'up'
                      ? i === 0
                      : i === document.titleFields.length - 1)
                  }
                  onClick={() =>
                    perform({ kind: 'move', id: field.id, direction })
                  }
                >
                  {direction === 'up' ? 'Move up' : 'Move down'}
                </button>
              ))}
            </li>
          ))}
        </ol>
      )}
      <button
        type="button"
        disabled={!document || disabled || readOnly || !!draft}
        onClick={() =>
          publish({
            id: null,
            key: 'Title',
            value: '',
            originalKey: '',
            originalValue: '',
            state,
          })
        }
      >
        Add field
      </button>
      {draft && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const action: TitleAction =
              draft.id === null
                ? {
                    kind: 'add',
                    key: draft.key,
                    values: draft.value.split('\n'),
                  }
                : {
                    kind: 'edit',
                    id: draft.id,
                    key: draft.key,
                    values: draft.value.split('\n'),
                  };
            if (perform(action, draft.state)) {
              publish(null);
              closeButton.current?.focus();
            }
          }}
        >
          <p role="status">
            {dirty
              ? 'Uncommitted title input — not saved or protected by recovery. Apply or Discard before leaving.'
              : 'Editing field — no uncommitted changes.'}
          </p>
          {draft.state !== state && (
            <p role="alert">
              This draft belongs to an older editor version. Input is retained;
              copy it before discarding and reopening the field.
            </p>
          )}
          <label>
            Field key
            <input
              ref={fieldInput}
              list="title-standard-fields"
              value={draft.key}
              disabled={disabled || readOnly}
              onChange={(event) =>
                publish({ ...draft, key: event.target.value })
              }
            />
          </label>
          <datalist id="title-standard-fields">
            {[
              'Title',
              'Credit',
              'Author',
              'Authors',
              'Source',
              'Draft date',
              'Contact',
              'Copyright',
              'Notes',
            ].map((key) => (
              <option key={key} value={key} />
            ))}
          </datalist>
          <label>
            Field value
            <textarea
              rows={4}
              value={draft.value}
              disabled={disabled || readOnly}
              onChange={(event) =>
                publish({ ...draft, value: event.target.value })
              }
            />
          </label>
          <button type="submit" disabled={disabled || readOnly}>
            Apply title input
          </button>
          <button
            type="button"
            disabled={disabled || compositionActive}
            onClick={() => {
              if (composing.current) return;
              publish(null);
              setError('');
              closeButton.current?.focus();
            }}
          >
            Discard title input
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
