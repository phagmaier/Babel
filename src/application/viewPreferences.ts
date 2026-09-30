/** UI configuration only; no author content, identities, paths or capabilities. */
export interface ViewSettings {
  readonly theme: 'system' | 'light' | 'dark';
  readonly zoom: number;
  readonly focus: boolean;
  readonly typewriter: boolean;
}
export const viewStorageKey = 'babel.view.v1';
export const defaultViewSettings: ViewSettings = Object.freeze({
  theme: 'system',
  zoom: 100,
  focus: false,
  typewriter: false,
});
export const zoomLevels = [75, 90, 100, 110, 125, 150, 175, 200] as const;
interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
function valid(value: unknown): value is ViewSettings {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return (
    Object.keys(s).sort().join(',') === 'focus,theme,typewriter,zoom' &&
    typeof s.theme === 'string' &&
    ['system', 'light', 'dark'].includes(s.theme) &&
    typeof s.zoom === 'number' &&
    zoomLevels.some((z) => z === s.zoom) &&
    typeof s.focus === 'boolean' &&
    typeof s.typewriter === 'boolean'
  );
}
export class ViewPreferences {
  private snapshot: { settings: ViewSettings; error: string } = {
    settings: defaultViewSettings,
    error: '',
  };
  private listeners = new Set<() => void>();
  constructor(private readonly storage?: StoragePort) {
    try {
      if (!storage) throw new Error('unavailable');
      const raw = storage.getItem(viewStorageKey);
      if (raw !== null) {
        if (raw.length > 512) throw new Error('invalid');
        const value = JSON.parse(raw) as Record<string, unknown>;
        if (
          !value ||
          Object.keys(value).sort().join(',') !== 'settings,version' ||
          value.version !== 1 ||
          !valid(value.settings)
        )
          throw new Error('invalid');
        this.snapshot = {
          settings: Object.freeze({ ...value.settings }),
          error: '',
        };
      }
    } catch {
      this.snapshot = {
        settings: defaultViewSettings,
        error:
          'Presentation preferences could not be read. Defaults are active; stored settings are retained.',
      };
    }
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  update(patch: Partial<ViewSettings>): boolean {
    const candidate = { ...this.snapshot.settings, ...patch };
    let error = '';
    if (!valid(candidate))
      error = 'Invalid presentation settings; working settings retained.';
    else
      try {
        if (!this.storage) throw new Error('unavailable');
        this.storage.setItem(
          viewStorageKey,
          JSON.stringify({ version: 1, settings: candidate }),
        );
      } catch {
        error =
          'Presentation preferences could not be stored; working settings retained. Retry after storage is available.';
      }
    this.snapshot = {
      settings: error ? this.snapshot.settings : Object.freeze(candidate),
      error,
    };
    for (const listener of this.listeners) listener();
    return !error;
  }
}
export function localViewPreferences(): ViewPreferences {
  try {
    return new ViewPreferences(window.localStorage);
  } catch {
    return new ViewPreferences();
  }
}
