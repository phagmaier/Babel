# M3-07 synthetic completion inspection

The diagnostic mounts production local indexes, completion controller, popup and editor on literal synthetic text. It reuses the existing feature-only native report transport. Default writing, source saving and native capabilities remain unchanged.

Create a fresh private root using `python3 prototypes/editor-composition/seed.py /tmp` and substitute its printed path below:

```sh
env CARGO_HOME=/tmp/babel-cargo \
  BABEL_EDITOR_COMPOSITION_ROOT=/tmp/babel-editor-composition-REPLACE \
  XDG_DATA_HOME=/tmp/babel-editor-composition-REPLACE/data \
  GSETTINGS_BACKEND=memory \
  pnpm tauri dev --features editor-composition-proof \
  --config tests/native/editor-completion/tauri.conf.json --no-watch \
  > /tmp/babel-m3-07-native.log 2>&1
```

Run `python3 tests/native/editor-completion/native-input.py /tmp/babel-m3-07-native.log`. It rechecks exactly one owned `babel-desktop` window with this diagnostic title before input, sends real Wayland keys with `wtype`, waits for the F8 report and independently asserts literal source/hash/caret/undo. F1 resets; F7 places the name caret before its extension; F9/10/11 place location/time/prefix carets. F6 is the production focus escape. F2 exercises a **synthetic DOM mouse** event; F3 exercises a **synthetic composition sequence**, not real IME input. Stop the owned app after the drill.

For actual pointer acceptance on the single-monitor reference Wayland host:

```sh
python3 tests/native/editor-completion/build-pointer.py
python3 tests/native/editor-completion/native-input.py /tmp/babel-m3-07-native.log \
  --pointer /tmp/babel-m3-07-pointer
```

The disposable C helper uses installed `wayland-client`, `wayland-scanner`, `cc`, and `pkg-config`. Its builder downloads only the upstream MIT-licensed wlr virtual-pointer development protocol at pinned revision `b010a03648b88d143236de193bddbfea0c08bc84`, validates SHA-256 `3ff6d540be0bc5228195bf072bde42117ea17945a5c2061add5d3cf97d6bb524`, and retains its license notice in generated files under `/tmp`. The helper is test-only and never linked/bundled into babel; no application dependency or permission is added. Missing protocol/compiler/compositor prerequisites block only this pointer drill. No desktop setting is changed.

The driver refuses multi-monitor layouts and targets outside the owned app bounds, clicks the reported MAYA option using the compositor's virtual pointer, refreshes pointer focus with a one-pixel motion inside that option, then requires a trusted WebKit mouse event on its exact ID and checks source/caret/focus and one-step undo. `grim` captures only the synthetic app rectangle as `/tmp/babel-m3-07-popup.png`. This proves actual mouse dispatch in WebKit on the reference host; screenreader/touch/other-OS and real IME remain separate gates. [M3 evidence](../../../docs/test-evidence/M3.md#m3-07--local-character-and-heading-completion) owns exact commands, outcomes and limits.
