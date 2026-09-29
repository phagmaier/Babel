import { useState, useSyncExternalStore } from 'react';
import { undoDepth, redoDepth } from 'prosemirror-history';
import type { EditorState } from 'prosemirror-state';
import {
  elementChoices,
  shortcutCommands,
  type ShortcutRegistry,
} from '../application/shortcuts';
import { contextualElements, selectionElement } from '../editor/commands';
import './editor-controls.css';

export function EditorControls({
  state,
  registry,
  execute,
  pickerId = 'screenplay-element',
}: {
  state: EditorState;
  registry: ShortcutRegistry;
  execute: (id: string) => void;
  pickerId?: string;
}) {
  useSyncExternalStore(registry.subscribe, registry.getSnapshot);
  const [commandId, setCommandId] = useState(shortcutCommands[0]!.id);
  const [binding, setBinding] = useState(registry.binding(commandId) ?? '');
  const [notice, setNotice] = useState('');
  const current = selectionElement(state);
  const known =
    current === 'mixed' || elementChoices.some(([id]) => id === current);
  return (
    <section className="editor-controls" aria-label="Writing controls">
      <label htmlFor={pickerId}>Element</label>
      <select
        id={pickerId}
        value={current}
        aria-describedby={`${pickerId}-context`}
        onChange={(event) => execute(`element.${event.target.value}`)}
      >
        <option value="mixed" disabled>
          Mixed
        </option>
        {!known && (
          <option value={current} disabled>
            Protected {current}
          </option>
        )}
        {elementChoices.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
      <span id={`${pickerId}-context`}>
        Tab:{' '}
        {contextualElements(state)
          .map((id) => elementChoices.find(([kind]) => kind === id)![1])
          .join(' → ')}
        . Shift+Tab reverses. F6 moves to Element.
      </span>
      <details>
        <summary>Commands and shortcut help</summary>
        <ul>
          {shortcutCommands.map((command) => (
            <li key={command.id}>
              <button
                type="button"
                disabled={
                  !!command.unavailable ||
                  (command.id === 'undo' && undoDepth(state) === 0) ||
                  (command.id === 'redo' && redoDepth(state) === 0)
                }
                onClick={() => execute(command.id)}
              >
                {command.label}
              </button>
              <kbd>{registry.label(command.id)}</kbd>
              {command.unavailable && <span>{command.unavailable}</span>}
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary>Shortcut settings</summary>
        <p>
          Mod means {registry.platform === 'mac' ? 'Command' : 'Control'}. Use
          letters or digits, optionally Shift. Leave blank to unassign. Bindings
          follow the typed key for your layout; Alt/AltGraph, OS shortcuts and
          F6 remain reserved.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setNotice(registry.remap(commandId, binding).reason);
          }}
        >
          <label>
            Command
            <select
              value={commandId}
              onChange={(event) => {
                setCommandId(event.target.value);
                setBinding(registry.binding(event.target.value) ?? '');
              }}
            >
              {shortcutCommands.map((command) => (
                <option key={command.id} value={command.id}>
                  {command.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Shortcut
            <input
              value={binding}
              onChange={(event) => setBinding(event.target.value)}
              placeholder="Mod+Shift+K"
              autoComplete="off"
            />
          </label>
          <button type="submit">Save shortcut</button>
          <button
            type="button"
            onClick={() => {
              const result = registry.reset();
              setNotice(result.reason);
              if (result.ok) setBinding(registry.binding(commandId) ?? '');
            }}
          >
            Restore defaults
          </button>
        </form>
        <p role="status">{notice || registry.notice}</p>
      </details>
    </section>
  );
}
