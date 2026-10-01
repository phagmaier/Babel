import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  shortcutCommands,
  type ShortcutRegistry,
} from '../application/shortcuts';
import {
  commandReason,
  dispatchCommand,
  formOwnsInput,
  type CommandContext,
} from '../application/commandDispatch';
import { nativeCommands } from '../infrastructure/nativeCommands';
import { CommandPalette, type PaletteEntry } from './CommandPalette';

export function CommandSurface({
  registry,
  context,
  execute,
  navigation = [],
  paletteRequested = 0,
  onPaletteChange,
}: {
  registry: ShortcutRegistry;
  context: () => CommandContext;
  execute: (id: string) => void;
  navigation?: readonly PaletteEntry[] | (() => readonly PaletteEntry[]);
  paletteRequested?: number;
  onPaletteChange?: (open: boolean) => void;
}) {
  useSyncExternalStore(registry.subscribe, registry.getSnapshot);
  const [open, setOpen] = useState(false);
  const [, refresh] = useState(0);
  const [error, setError] = useState('');
  const [listenError, setListenError] = useState('');
  const composing = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [owner] = useState(() => crypto.randomUUID());
  const revision = useRef(0);
  const menuToken = useRef('');
  const latest = useRef({ context, execute });
  latest.current = { context, execute };
  const openRef = useRef(open);
  openRef.current = open;
  const getContext = () => ({
    ...latest.current.context(),
    composing: composing.current || latest.current.context().composing,
    form: formOwnsInput(document.activeElement),
  });
  const dispatch = (id: string) =>
    mounted.current &&
    dispatchCommand(id, getContext(), (known) => {
      if (known === 'commandPalette') setOpen(true);
      else latest.current.execute(known);
    });
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const facts = getContext();
  useEffect(() => {
    if (facts.blocked) setOpen(false);
  }, [facts.blocked]);
  const menu = shortcutCommands.map((command) => ({
    id: command.id,
    binding: registry.binding(command.id),
    enabled: !open && !commandReason(command, facts),
  }));
  const menuKey = JSON.stringify(menu);
  useEffect(() => {
    if (paletteRequested) dispatchRef.current('commandPalette');
  }, [paletteRequested]);
  useEffect(() => {
    onPaletteChange?.(open);
  }, [open, onPaletteChange]);
  useEffect(() => {
    const focus = () => refresh((n) => n + 1);
    const start = () => {
      composing.current = true;
      focus();
    };
    const end = () => {
      composing.current = false;
      focus();
    };
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || openRef.current || composing.current)
        return;
      if (
        event.key === 'F6' &&
        !event.isComposing &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey
      ) {
        if (!(
          event.target instanceof HTMLElement &&
          event.target.closest('.ProseMirror')
        )) {
          event.preventDefault();
          document
            .querySelector<HTMLElement>('.ProseMirror, #home-new')
            ?.focus();
        }
        return;
      }
      const command = registry.match(event);
      if (
        !command ||
        command.scope !== 'application' ||
        formOwnsInput(event.target)
      )
        return;
      event.preventDefault();
      dispatchRef.current(command.id);
    };
    window.addEventListener('keydown', key);
    window.addEventListener('focusin', focus);
    window.addEventListener('compositionstart', start);
    window.addEventListener('compositionend', end);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('focusin', focus);
      window.removeEventListener('compositionstart', start);
      window.removeEventListener('compositionend', end);
    };
  }, [registry]);
  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return;
    let live = true;
    let unlisten: (() => void) | undefined;
    void nativeCommands
      .listen((event) => {
        if (
          live &&
          !openRef.current &&
          event?.token === menuToken.current &&
          typeof event.id === 'string'
        )
          dispatchRef.current(event.id);
      })
      .then((stop) => {
        if (live) unlisten = stop;
        else stop();
      })
      .catch(() => {
        if (live)
          setListenError(
            'Native menus unavailable. Use the palette or visible controls.',
          );
      });
    return () => {
      live = false;
      unlisten?.();
      menuToken.current = '';
      void nativeCommands
        .publish({
          token: `${owner}:${++revision.current}`,
          commands: shortcutCommands.map((command) => ({
            id: command.id,
            binding: registry.binding(command.id),
            enabled: false,
          })),
        })
        .catch(() => {});
    };
  }, [registry]);
  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return;
    let live = true;
    const token = `${owner}:${++revision.current}`;
    menuToken.current = token;
    void nativeCommands
      .publish({ token, commands: JSON.parse(menuKey) as typeof menu })
      .then(() => {
        if (live) setError('');
      })
      .catch(() => {
        if (live)
          setError(
            'Native menu update failed. Use the palette or visible controls.',
          );
      });
    return () => {
      live = false;
    };
  }, [menuKey]);
  const entries: PaletteEntry[] = shortcutCommands
    .filter(
      (command) =>
        command.id !== 'commandPalette' && !commandReason(command, facts),
    )
    .map((command) => ({
      id: command.id,
      label: command.label,
      hint: registry.label(command.id),
      activate: () => dispatchRef.current(command.id),
    }));
  if (open && !facts.blocked && !facts.composing && !facts.staged)
    entries.push(
      ...(typeof navigation === 'function' ? navigation() : navigation),
    );
  return (
    <div className="command-surface">
      <button
        type="button"
        id="command-palette-open"
        disabled={
          !!commandReason(
            shortcutCommands.find((c) => c.id === 'commandPalette')!,
            facts,
          )
        }
        onClick={() => dispatch('commandPalette')}
      >
        Command Palette
      </button>
      {registry.notice && registry.notice !== 'Shortcuts saved locally.' && (
        <p role="alert">{registry.notice}</p>
      )}
      {(error || listenError) && <p role="alert">{error || listenError}</p>}
      {open && (
        <CommandPalette entries={entries} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}
