# M4-11 isolated offline spellcheck proof

This is a synthetic GTK3/WebKitGTK 4.1 host using the production
`mountScreenplayEditor`, schema, source bridge and shortcut registry. It is
**native dictionary/input evidence**, not production Tauri activation, IPC,
packaging or a performance gate. No proof code/resource enters the default app.

Run on the provisional Linux GUI host with its existing GTK3, WebKitGTK 4.1,
Enchant 2, Hunspell English dictionary, JSON-GLib, C compiler, user/network
namespaces, Hyprland, grim, wtype, fcitx5/pinyin and Wayland helpers. Do not
install dictionaries or change system settings to conceal unavailable resources.
The helpers use the already recorded, pinned test-only Wayland protocols.

```sh
python3 tests/native/editor-input/build-keyboard.py
python3 tests/native/editor-completion/build-pointer.py
pnpm exec vite build --config tests/native/spellcheck/vite.config.ts
cc -std=c11 -Wall -Wextra -Werror tests/native/spellcheck/host.c $(pkg-config --cflags --libs webkit2gtk-4.1 enchant-2 json-glib-1.0) -o /tmp/babel-m4-11-host
python3 -m py_compile tests/native/spellcheck/run.py
python3 tests/native/spellcheck/run.py
pnpm exec vitest run tests/contract/spellcheck-probe.test.ts
```

The runner creates a private `/tmp/babel-m4-11-*` profile, supplies
`ENCHANT_CONFIG_DIR` and all XDG profile directories, and runs the owned host
with `unshare --user --map-root-user --net`. It checks a distinct network
namespace with only loopback and observes every WebView resource request.
Compiled assets load through a fixed local `babel-spell://probe/` scheme;
there is no Vite/HTTP server or expanded file-access permission. The host refuses
dictionary/config directories outside the disposable task prefix. System base
dictionaries are read; personal names are written only to the task profile.
`HOME` and global dictionaries/settings are untouched. Only owned compositor
windows receive input. The prior fcitx engine is restored in `finally`.

The compositor helper's optional fifth argument `right` opens the unmodified
WebKit GTK context menu. Native GTK widget allocations locate a real pointer
click on the selected suggestion/Ignore/Learn; there is no replacement string
inserted by the runner and no mocked dictionary. Ignore/Learn require selecting
the full word; a caret permits suggestions but disables those actions on this
runtime. `wtype -k z` sends an actual Ctrl+Z key; the runner waits for the real
EditorView composition guard to settle after native `compositionend` before
Undo. It never bypasses that guard. Keyboard invocation/selection of the
native popup did not pass and remains a production accessibility concern.

Cases: bold/italic typo correction, exact selection/one-step Undo and unchanged
origin attributes; BOM/CRLF/trailing spaces, emoji/combining/Hebrew neighbors;
English language/alias selection and unavailable French with no English fallback;
process-wide context scope; session Ignore, persistent ASCII/Unicode Learn,
restart and fresh-profile isolation; uppercase learned character cues and a
fixed view-only established-name decoration; continuous-check disabling versus
context-menu suggestions; real pinyin commit/cancel/Undo. Fixed name ranges are
only a proof of capability; M4-12 must derive/map them against current versions.
Reports capture existing EditorState on request, outside the typing handler.

`result.json`, event logs, stderr and three screenshots remain in the printed
artifact root. The fixture's independent oracle is 130 bytes, SHA-256
`e3eb9e6e956ad136b98a6feff459abb118d8785b2c842dcca2b4ba271a47ac5c`.
Unavailable prerequisites, native actions or dictionaries cause a failed command;
no silent cloud fallback, fake success or broadened permissions. Shared gates
and default-release regression remain required separately. No application
dictionary publication adapter is added, so a second filesystem run is not
required for this proof.

The four JSDOM contracts check source/state/Undo, DOM correction, forged origin
attributes and protection refusal. They contain no native engine/IME claim.
[Evidence](../../../docs/test-evidence/M4.md#m4-11--offline-spellcheck-proof) and
[ADR 0032](../../../docs/decisions/0032-linux-native-spellcheck.md) own the bounded
selection, inventory and remaining production/platform obligations.
