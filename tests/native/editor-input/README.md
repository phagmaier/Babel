# M3-08 synthetic native input diagnostic

This mounts the production editor, clipboard/formatting registry and explicit Fountain import panel on synthetic text. A native feature-only handle selects only an existing marked M1 fixture; import protects the current live draft, not just the source file. Default writing remains inactive.

Create a private root with `python3 prototypes/editor-composition/seed.py /tmp`. Substitute its path:

```sh
env CARGO_HOME=/tmp/babel-cargo \
  BABEL_EDITOR_COMPOSITION_ROOT=/tmp/babel-editor-composition-REPLACE \
  XDG_DATA_HOME=/tmp/babel-editor-composition-REPLACE/data \
  GSETTINGS_BACKEND=memory \
  pnpm tauri dev --features editor-composition-proof \
  --config tests/native/editor-input/tauri.conf.json --no-watch \
  > /tmp/babel-m3-08-native.log 2>&1
python3 tests/native/editor-input/build-keyboard.py
python3 tests/native/editor-input/native-input.py /tmp/babel-m3-08-native.log
python3 tests/native/editor-input/native-input.py /tmp/babel-m3-08-native.log --selection-only
python3 tests/native/editor-input/verify-protection.py /tmp/babel-m3-08-native.log /tmp/babel-editor-composition-REPLACE
node tests/native/editor-input/browser-security.mjs
```

The driver checks exactly one owned `babel-desktop` window with this title before every input. `wtype` supplies logical typing, Unicode, dead keys and editor registry chords. Its generated keymap reports `code=Escape`, which GTK does not translate into native clipboard shortcuts. The disposable helper supplies actual US evdev Ctrl+C/X/V, Backspace, Escape, Enter and Shift+Home and requires trusted WebKit clipboard events. It creates only a temporary virtual keyboard and never changes the compositor configuration. The driver owns a temporary synthetic clipboard process for external paste; internal copy/paste uses GTK clipboard data. This drill overwrites the clipboard with synthetic content; do not use it while retaining needed clipboard data.

The builder uses installed `xkbcli`, `wayland-scanner`, `wayland-client`, `cc` and `pkg-config`. It downloads the MIT protocol XML from upstream wtype v0.4 at pinned commit `d71be3a7b3f93b534a2823fd68cabd7ac2a02359`, verifies SHA-256 `7ad7870003ecd592cae47dc19d277a609b7f18fd7b7be012623cf3225a7294f5`, and keeps the license in generated files under `/tmp`. Nothing is bundled or added to application dependencies/permissions. Missing prerequisites block the associated drill.

F1 resets, F2 selects `world`, F3 selects Dialogue, F4 explicitly imports a fixed BOM/CRLF synthetic screenplay after native protection, F5 selects a complete speech group, F7 creates an Action paste target, F8 emits an exact native report. F9/10/11 create 2,400/6,000/12,000 Action rows; Shift+F9/10/11 create complete mixed speech/action/hidden-note cycles with 8,320-character paragraphs (2,399/5,996/11,991 physical rows). All fixtures are independently reproduced by the driver with exact hashes. Reports measure synchronous editor transaction/update and key-to-requestAnimationFrame latency on 120 actual ASCII inputs. These are row workloads and a rendering proxy, not page counts or compositor paint. The mixed cycle includes two Dialogue rows, one Parenthetical, one Character, two source blanks, three hidden rows and two Actions; long paragraphs replace selected first Actions. A pinned PDF/page-equivalent calibration and actual paint remain later gates. No expensive source capture happens until explicit F8.

The Chromium script intercepts all resource requests during hostile HTML paste and checks no external request, execution or unsafe DOM adoption. It is browser security evidence, not real WebKit input or an OS clipboard proof. Full CJK/RTL IME is separate from trusted GTK dead keys; absent engines stay blocked. The reference GTK dead-key Escape committed a spacing acute instead of cancelling. The driver retains that observation, checks Undo, continues independent checks and exits 2 with acceptance blocked. Do not call cancellation verified. See [M3 evidence](../../../docs/test-evidence/M3.md#m3-08--paste-formatting-and-native-input) for actual outcomes and omissions. Stop the owned app after inspection.
