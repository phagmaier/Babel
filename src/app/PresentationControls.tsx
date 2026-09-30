import { useEffect, useSyncExternalStore } from 'react';
import {
  type ViewPreferences,
  zoomLevels,
} from '../application/viewPreferences';

export function usePresentation(preferences: ViewPreferences) {
  const snapshot = useSyncExternalStore(
    preferences.subscribe,
    preferences.getSnapshot,
  );
  useEffect(() => {
    document.documentElement.dataset.theme = snapshot.settings.theme;
  }, [snapshot.settings.theme]);
  return snapshot;
}
export function PresentationControls({
  preferences,
  writing = false,
  disabled = false,
  canChange = () => true,
}: {
  preferences: ViewPreferences;
  writing?: boolean;
  disabled?: boolean;
  canChange?: () => boolean;
}) {
  const { settings, error } = usePresentation(preferences);
  const update = (patch: Parameters<ViewPreferences['update']>[0]) => {
    if (canChange()) preferences.update(patch);
  };
  return (
    <section className="presentation" aria-label="Presentation settings">
      <div className="presentation-controls">
        <label>
          Theme{' '}
          <select
            aria-label="Theme"
            value={settings.theme}
            disabled={disabled}
            onChange={(e) =>
              update({
                theme: e.target.value as typeof settings.theme,
              })
            }
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        {writing && (
          <>
            <label>
              Writing zoom{' '}
              <select
                aria-label="Writing zoom"
                value={settings.zoom}
                disabled={disabled}
                onChange={(e) => update({ zoom: Number(e.target.value) })}
              >
                {zoomLevels.map((z) => (
                  <option key={z} value={z}>
                    {z}%
                  </option>
                ))}
              </select>
            </label>
            <button
              id="writing-focus"
              type="button"
              disabled={disabled}
              aria-pressed={settings.focus}
              onClick={() => update({ focus: !settings.focus })}
            >
              {settings.focus ? 'Exit focus mode' : 'Focus mode'}
            </button>
            <label>
              <input
                type="checkbox"
                checked={settings.typewriter}
                disabled={disabled}
                onChange={(e) => update({ typewriter: e.target.checked })}
              />{' '}
              Typewriter scroll
            </label>
          </>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
