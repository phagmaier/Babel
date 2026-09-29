# M3-04 production editor inspection

This diagnostic imports only production editor/capture modules. It runs real WebKit typing, selection replacement, undo/redo, protected raw selection and delayed stale-capture checks against the unchanged M1-06 LF/BOM-CRLF/no-final-newline literal fixtures. It does not submit a source save. The existing feature-only Rust guard/logger is reused; default app commands, writer initialization and capabilities are unchanged. `M1_COMPOSITION_PROOF` is the existing transport prefix; each report explicitly says task `M3-04`.

Seed a fresh private synthetic root: `python3 prototypes/editor-composition/seed.py /tmp`. Use the printed path for both environment variables:

```sh
CARGO_HOME=/tmp/babel-cargo \
  BABEL_EDITOR_COMPOSITION_ROOT=/tmp/babel-editor-composition-REPLACE \
  XDG_DATA_HOME=/tmp/babel-editor-composition-REPLACE/data \
  pnpm tauri dev --features editor-composition-proof \
  --config tests/native/editor-bridge/tauri.conf.json --no-watch \
  > /tmp/babel-m3-04-native-webview.log 2>&1
```

Run `python3 tests/native/editor-bridge/native-input.py /tmp/babel-m3-04-native-webview.log`. The driver targets exactly one window with the diagnostic title and `babel-desktop` class, rechecks focus before every input, compares full independent literal bytes/hash/selection/IDs and exercises all three cases. On the reference Hyprland Lua host it uses the [documented focus dispatcher](https://wiki.hypr.land/configuring/core/dispatchers/) if focus was lost; it changes no desktop configuration. Missing/multiple targets fail before input. Stop the owned diagnostic after inspection. Never point it at a real manuscript or production app data.

F1 resets/opens LF; F4 cycles/open; F7 focuses the action end; F6 selects `lamp`; F8 logs a deferred capture; F9 selects protected raw text; Ctrl+Z/Ctrl+Shift+Z use history; F5 holds a capture before serialization and F10 releases it after later typing. The report includes real host/user agent and bounded apply-plus-view timings. These timings are not paint, large-script capture latency, IME or S13 budget acceptance. Fixture loading is development-only same-origin Vite data; production modules have no runtime network dependency. [M3 evidence](../../../docs/test-evidence/M3.md#m3-04--sole-editor-authority-and-source-bridge) records actual commands/host/results and exclusions.
