# M3-06 synthetic picker and shortcut inspection

This diagnostic mounts production `EditorControls`, registry and editor modules on literal synthetic text. It never opens or writes a screenplay. The existing feature-only Rust report transport is reused; default app routing/capabilities remain unchanged. No diagnostic is enabled in a release.

Create a fresh private root with `python3 prototypes/editor-composition/seed.py /tmp`; use the printed root for both environment variables. A fresh root is necessary because the drill deliberately persists a remap in WebKit's local preferences.

```sh
env CARGO_HOME=/tmp/babel-cargo \
  BABEL_EDITOR_COMPOSITION_ROOT=/tmp/babel-editor-composition-REPLACE \
  XDG_DATA_HOME=/tmp/babel-editor-composition-REPLACE/data \
  GSETTINGS_BACKEND=memory \
  pnpm tauri dev --features editor-composition-proof \
  --config tests/native/editor-shortcuts/tauri.conf.json --no-watch \
  > /tmp/babel-m3-06-native-final.log 2>&1
```

Run `python3 tests/native/editor-shortcuts/native-input.py /tmp/babel-m3-06-native-final.log`. The driver rechecks exactly one window with the diagnostic title and `babel-desktop` class before each real input and validates literal bytes/hash/selection, picker state and focus. It uses the existing documented Hyprland focus dispatcher without changing desktop configuration. It runs on the reference Wayland host; missing/multiple targets fail before typing.

F1 resets the synthetic editor, F7 places the Action caret, F9 places the Parenthetical caret, F8 reports a deferred capture, F2 opens settings and focuses its shortcut input, and F12 reconstructs the registry from actual WebKit localStorage. F6 is the production focus escape to Element. The driver uses the native select's `l` type-ahead key for Lyrics; Space-popup automation timed out on this host and is not claimed as verified. Reports contain synthetic source and diagnostic key facts only. Restart the diagnostic in the same private profile, then run the driver with `--reload-only` to verify process-restart retention. Stop the owned app after the drill.

[M3 evidence](../../../docs/test-evidence/M3.md#m3-06--element-picker-and-configurable-shortcut-registry) owns exact run/results, reserved/layout outcomes and omitted platform/screenreader/full IME gates. This is UI/keyboard verification, not native manuscript publication or Local v1 adoption.
