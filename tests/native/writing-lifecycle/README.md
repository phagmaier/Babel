# M3-12 production writing lifecycle drill

Run on the reference Linux/Hyprland host with installed WebKitWebDriver, wtype,
grim, Wayland development tools and GTK/WebKit. Build the production app with
no proof feature and build the disposable physical-key helper:

```sh
CARGO_HOME=/tmp/babel-cargo pnpm tauri build --no-bundle
python3 tests/native/editor-input/build-keyboard.py
python3 tests/native/writing-lifecycle/drill.py /tmp
python3 tests/native/writing-lifecycle/drill.py /home/phagmaier/Code/babel/target
```

The helper's pinned protocol/license and prerequisites are documented in the
[editor input guide](../editor-input/README.md). It supports physical Ctrl+L/A
and Alt+Home for GTK picker location/filename entry in addition to existing clipboard keys.
No application dependency, global configuration or privileged package is added.

The runner uses Python's standard library to drive the installed WebKitWebDriver
on local port 4447. Tauri's existing `TAURI_WEBVIEW_AUTOMATION=true` environment
switch enables automation only in the test process; no app plugin, mock native
port, proof feature or diagnostic route is installed. Every run creates a fresh
private `babel-writing-*` root and redirects its data/config/cache into that
root. It drives the actual production UI and IPC. WebDriver input actions retain
the caret; GTK dialogs receive physical keys and literal wtype path entry. Each
compositor input/screenshot is restricted to descendants of the owned driver.
A second Return is sent only while the owned GTK dialog remains open. The folder picker leaves GTK Recent with Alt+Home before entering the explicit disposable path; no personal file is opened.

The drill checks New, explicit protection, Save As cancellation/publication,
source autosave status, protected close, native picker reopen, explicit Keep
Current File, named snapshot/restore/undo, source failure with recovery intact,
independently audited recovery followed by killing only the owned app/restart,
recovery adoption, history failure isolation, external divergence, persistent
close refusal, and an exact emergency copy. File bytes, SHA-256 hashes,
checkpoint frame checksums, source hashes and caret metadata are independently
read from the disposable files. App-only PNGs and the driver log remain in the
printed artifact directory. The failed-source drill removes write permission
from the synthetic source directory; the history drill restricts only its
synthetic history directory. These prove ordinary permission failures, not
actual disk-full or hardware power-loss guarantees.

The runner retains all fixture/evidence files. On failure it captures the owned
window and synthetic UI text, then stops the driver/session. Recovery after
SIGKILL is tested only after the latest checkpoint's bytes/checksums are audited.
It never discovers personal credentials, opens an owner's manuscript, or sends
network requests to a remote service. The resource assertion observes embedded
WebView resource entries; it is not a packet capture. Full compositor paint,
page-calibrated performance, other platforms and installed/offline adoption
remain separate gates.
