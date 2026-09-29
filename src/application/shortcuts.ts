/** Local UI preferences only: no manuscript bytes, paths or native capabilities. */
export const elementChoices = [
  ['sceneHeading', 'Scene Heading'],
  ['action', 'Action'],
  ['character', 'Character'],
  ['dialogue', 'Dialogue'],
  ['parenthetical', 'Parenthetical'],
  ['transition', 'Transition'],
  ['shot', 'Shot'],
  ['lyrics', 'Lyrics'],
  ['centered', 'Centered'],
  ['section', 'Section'],
  ['synopsis', 'Synopsis'],
  ['note', 'Note'],
  ['boneyard', 'Omitted material'],
  ['pageBreak', 'Page Break'],
] as const;
export type ElementChoice = (typeof elementChoices)[number][0];
export const shortcutCommands = [
  ...elementChoices.map(([element, label], index) => ({
    id: `element.${element}`,
    label,
    scope: 'editor' as const,
    binding: index < 8 ? `Mod+${index + 1}` : null,
    unavailable: null,
  })),
  {
    id: 'undo',
    label: 'Undo',
    binding: 'Mod+Z',
    scope: 'editor',
    unavailable: null,
  },
  {
    id: 'redo',
    label: 'Redo',
    binding: 'Mod+Shift+Z',
    scope: 'editor',
    unavailable: null,
  },
  ...[
    ['bold', 'Bold', 'Mod+B'],
    ['italic', 'Italic', 'Mod+I'],
    ['underline', 'Underline', 'Mod+U'],
  ].map(([id, label, binding]) => ({
    id: `format.${id}`,
    label: label!,
    binding: binding!,
    scope: 'editor' as const,
    unavailable: null,
  })),
  ...[
    ['save', 'Save', 'Mod+S', null],
    ['saveAs', 'Save As', 'Mod+Shift+S', null],
    ['open', 'Open', 'Mod+O', null],
    ['find', 'Find', 'Mod+F', 'Find is awaiting M4.'],
    ['replace', 'Replace', null, 'Replace is awaiting M4.'],
    ['nextMatch', 'Next Match', 'Mod+G', 'Find is awaiting M4.'],
    ['previousMatch', 'Previous Match', 'Mod+Shift+G', 'Find is awaiting M4.'],
    ['exportPdf', 'Export PDF', null, 'PDF export is awaiting M5.'],
    ['scriptCheck', 'Script Check', null, 'Script Check is awaiting M4.'],
    ['focusMode', 'Focus Mode', null, 'Focus mode is awaiting M4.'],
    [
      'commandPalette',
      'Command Palette',
      'Mod+Shift+P',
      'Command palette is awaiting M4.',
    ],
    ['nextScene', 'Next Scene', null, 'Scene navigation is awaiting M4.'],
    [
      'previousScene',
      'Previous Scene',
      null,
      'Scene navigation is awaiting M4.',
    ],
  ].map(([id, label, binding, unavailable]) => ({
    id: id!,
    label: label!,
    binding: binding ?? null,
    scope: 'application' as const,
    unavailable: unavailable!,
  })),
] as const;
export type ShortcutPlatform = 'mac' | 'other';
export interface ShortcutStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export const shortcutStorageKey = 'babel.shortcuts.v1';
const reserved = new Set([
  'Mod+Q',
  'Mod+W',
  'Mod+R',
  'Mod+Shift+R',
  'Mod+Tab',
  'Mod+Space',
  'Mod+Shift+Q',
  'Mod+Shift+W',
  'Mod+H',
  'Mod+M',
  'Mod+Shift+U',
  'Mod+Shift+E',
  'Mod+Shift+3',
  'Mod+Shift+4',
  'Mod+Shift+5',
]);
/** Logical keys, not physical scan codes; Alt/AltGraph/OS chords are never assigned. */
export function normalizeBinding(input: string): string | null {
  const parts = input.trim().split('+');
  if (parts[0] !== 'Mod' || parts.length < 2 || parts.length > 3) return null;
  const shift = parts.length === 3;
  if (shift && parts[1] !== 'Shift') return null;
  const key = parts.at(-1)!.toUpperCase();
  if (!/^[A-Z0-9]$/.test(key)) return null;
  const binding = `Mod+${shift ? 'Shift+' : ''}${key}`;
  return reserved.has(binding) ? null : binding;
}
export function eventBinding(
  event: KeyboardEvent,
  platform: ShortcutPlatform,
): string | null {
  if (
    event.isComposing ||
    event.key === 'Dead' ||
    event.key === 'Process' ||
    event.keyCode === 229 ||
    event.altKey ||
    event.getModifierState('AltGraph')
  )
    return null;
  if (
    platform === 'mac'
      ? !event.metaKey || event.ctrlKey
      : !event.ctrlKey || event.metaKey
  )
    return null;
  return normalizeBinding(`Mod+${event.shiftKey ? 'Shift+' : ''}${event.key}`);
}
export class ShortcutRegistry {
  private overrides: Record<string, string | null> = {};
  private revision = 0;
  private listeners = new Set<() => void>();
  notice = '';
  constructor(
    readonly platform: ShortcutPlatform,
    private storage?: ShortcutStorage,
  ) {
    if (!storage)
      this.notice = 'Shortcut storage unavailable; defaults are active.';
    try {
      const raw = storage?.getItem(shortcutStorageKey);
      if (raw) {
        if (raw.length > 16_384) throw new Error('Oversized preference');
        const stored = JSON.parse(raw) as {
          version?: unknown;
          bindings?: unknown;
        };
        if (
          stored.version !== 1 ||
          !stored.bindings ||
          typeof stored.bindings !== 'object' ||
          Array.isArray(stored.bindings)
        )
          throw new Error('Invalid preference');
        const candidate: Record<string, string | null> = {};
        for (const [id, binding] of Object.entries(stored.bindings)) {
          if (
            !shortcutCommands.some((command) => command.id === id) ||
            !(
              binding === null ||
              (typeof binding === 'string' &&
                normalizeBinding(binding) === binding)
            )
          )
            throw new Error('Invalid binding');
          candidate[id] = binding;
        }
        if (this.collision(candidate))
          throw new Error('Conflicting preference');
        this.overrides = candidate;
      }
    } catch {
      this.notice =
        'Shortcut preferences could not be read; defaults are active.';
    }
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.revision;
  binding(id: string): string | null {
    return Object.hasOwn(this.overrides, id)
      ? this.overrides[id]!
      : (shortcutCommands.find((command) => command.id === id)?.binding ??
          null);
  }
  label(id: string): string {
    const binding = this.binding(id);
    return (
      binding?.replace('Mod', this.platform === 'mac' ? 'Command' : 'Ctrl') ??
      'Unassigned'
    );
  }
  match(event: KeyboardEvent) {
    const binding = eventBinding(event, this.platform);
    return binding
      ? shortcutCommands.find((command) => this.binding(command.id) === binding)
      : undefined;
  }
  private collision(overrides: Record<string, string | null>) {
    const used = new Set<string>();
    for (const command of shortcutCommands) {
      const binding = Object.hasOwn(overrides, command.id)
        ? overrides[command.id]
        : command.binding;
      if (!binding) continue;
      if (used.has(binding)) return true;
      used.add(binding);
    }
    return false;
  }
  private publish(candidate: Record<string, string | null>): {
    ok: boolean;
    reason: string;
  } {
    if (!this.storage)
      return {
        ok: false,
        reason: 'Local shortcut storage is unavailable; bindings unchanged.',
      };
    try {
      this.storage.setItem(
        shortcutStorageKey,
        JSON.stringify({ version: 1, bindings: candidate }),
      );
    } catch {
      return {
        ok: false,
        reason: 'Shortcut preferences could not be stored; bindings unchanged.',
      };
    }
    this.overrides = candidate;
    this.notice = 'Shortcuts saved locally.';
    this.revision++;
    for (const listener of this.listeners) listener();
    return { ok: true, reason: this.notice };
  }
  remap(id: string, input: string) {
    if (!shortcutCommands.some((command) => command.id === id))
      return { ok: false, reason: 'Unknown command.' };
    const binding = input.trim() ? normalizeBinding(input) : null;
    if (input.trim() && !binding)
      return {
        ok: false,
        reason:
          'Use Mod+letter/digit, optionally Shift. OS shortcuts, Alt and F6 are reserved.',
      };
    const candidate = { ...this.overrides, [id]: binding };
    if (this.collision(candidate))
      return {
        ok: false,
        reason: 'That shortcut is already assigned. Unassign it first.',
      };
    return this.publish(candidate);
  }
  reset() {
    return this.publish({});
  }
}
export function localShortcutRegistry(
  platform: ShortcutPlatform,
): ShortcutRegistry {
  try {
    return new ShortcutRegistry(platform, window.localStorage);
  } catch {
    return new ShortcutRegistry(platform);
  }
}
