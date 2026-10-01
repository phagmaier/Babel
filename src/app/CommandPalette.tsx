import { flushSync } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import './command-palette.css';

export interface PaletteEntry {
  id: string;
  label: string;
  hint: string;
  activate: () => void;
}
/** Entries hold captured navigation frames; activation must revalidate them. */
export function CommandPalette({
  entries,
  onClose,
}: {
  entries: readonly PaletteEntry[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const returnTo = useRef(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const filtered = entries.filter((entry) =>
    entry.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const visible = filtered.slice(0, 100);
  const index = Math.min(selected, Math.max(0, visible.length - 1));
  const active = visible[index];
  useEffect(() => {
    const previous = returnTo.current;
    const owned = dialog.current;
    const retained: { element: HTMLElement; inert: boolean }[] = [];
    let branch: HTMLElement | null = dialog.current;
    while (branch?.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          retained.push({ element: sibling, inert: Boolean(sibling.inert) });
          sibling.inert = true;
        }
      }
      branch = branch.parentElement;
    }
    input.current?.focus();
    return () => {
      for (const { element, inert } of retained) element.inert = inert;
      // Preserve newer focus owned by a protection dialog that interrupted us.
      const active = document.activeElement;
      if (
        (active === document.body ||
          !active?.isConnected ||
          owned?.contains(active)) &&
        previous?.isConnected &&
        !previous.closest('[inert]')
      )
        previous.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    document
      .getElementById(`palette-option-${index}`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [index]);
  const activate = (entry: PaletteEntry) => {
    flushSync(onClose);
    // Unmount/focus return happens before an action opens another panel/picker.
    queueMicrotask(entry.activate);
  };
  return (
    <div
      className="palette-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby="palette-title"
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
          if (e.key === 'Escape' || e.key === 'F6') {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setSelected(
              (index + (e.key === 'ArrowDown' ? 1 : -1) + visible.length) %
                (visible.length || 1),
            );
          } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            if (active) activate(active);
          } else if (e.key === 'Tab') {
            const controls = [
              ...dialog.current!.querySelectorAll<HTMLElement>('input, button'),
            ];
            const current = controls.indexOf(
              document.activeElement as HTMLElement,
            );
            e.preventDefault();
            controls[
              (current + (e.shiftKey ? -1 : 1) + controls.length) %
                controls.length
            ]?.focus();
          }
        }}
      >
        <h2 id="palette-title">Command Palette</h2>
        <label htmlFor="palette-query">Find an action, scene or section</label>
        <input
          ref={input}
          id="palette-query"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-options"
          aria-describedby="palette-help"
          aria-activedescendant={active ? `palette-option-${index}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
        />
        <p id="palette-help">
          Up/Down chooses; Enter runs; Escape or F6 returns. Tab stays in this
          dialog.
        </p>
        <p role="status">
          {filtered.length} available results
          {filtered.length > 100
            ? '; showing the first 100 — refine your search.'
            : '.'}
        </p>
        <ul
          id="palette-options"
          role="listbox"
          aria-label="Available commands and navigation"
        >
          {visible.map((entry, i) => (
            <li
              key={entry.id}
              id={`palette-option-${i}`}
              role="option"
              aria-selected={index === i}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => activate(entry)}
            >
              {entry.label} <small>{entry.hint}</small>
            </li>
          ))}
        </ul>
        {!visible.length && (
          <p>No enabled results. Finish pending work or refine your search.</p>
        )}
        <button type="button" onClick={onClose}>
          Cancel palette
        </button>
      </div>
    </div>
  );
}
