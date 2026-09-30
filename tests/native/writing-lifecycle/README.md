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

`BABEL_NATIVE_BINARY` can select an explicitly built default release binary
outside `target/release`. Emergency copies use a dedicated empty fixture folder
so GTK's directory-list navigation cannot select a nested manuscript fixture.
Each mode first verifies that release CSP blocks a synthetic development-server
fetch with a `connect-src` policy violation. The request is blocked by CSP;
production IPC remains available. The resource assertion is still not a packet
capture.

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

## M3-13 integrated editor and separate review

After the default release build and keyboard helper above, run sequentially:

```sh
python3 tests/native/writing-lifecycle/drill.py /tmp --editor-exit
python3 tests/native/writing-lifecycle/drill.py /home/phagmaier/Code/babel/target --editor-exit
python3 tests/native/writing-lifecycle/drill.py /tmp --capture-review
python3 tests/native/writing-lifecycle/drill.py /home/phagmaier/Code/babel/target --capture-review
python3 tests/native/writing-lifecycle/drill.py /tmp --latency-review
python3 tests/native/writing-lifecycle/drill.py /home/phagmaier/Code/babel/target --latency-review
```

For the repository audit corrections, run `--audit-fixes` on both roots before
the separate capture and latency modes. It adds actual permission-read-only
Save As/cancel/reopen, acknowledged unsaved-checkpoint SIGKILL/restart and
explicit resume under a fresh identity, and selected managed-project recovery
with a subsequent Save. It then runs the original lifecycle failures and adds
an immediate Save after snapshot restore. This focused mode does not change
clipboard content or input-method preferences.

`--editor-exit` adds independent no-op audits of 12 conformance sources, eight
complex sources and invalid UTF-8; eight literal edits/Undo; primary semantic,
scene-number and speech/dual relationship audits; backward selection, rich
native clipboard, Unicode/graphemes, real pinyin commit/cancel and mozc Enter;
completion/caret/Undo, smart speech, F6 and Enter/joins/Tab. Ordinary default-app
pickers and controls then run the original lifecycle failure/restart drill.
The native input method is temporarily selected and restored in `finally`.
The clipboard receives only synthetic content, replacing its previous contents.
DOM selection setup is explicitly distinguished from physical Shift+Home and
trusted key/clipboard/composition events in `trusted-input.json`.

The original negative read-only/unsaved-route assertions are replaced by the
positive `--audit-fixes` checks above. `--capture-review` retains the documented
unrepresentable middle Parenthetical split and now requires truthful pending /
only-in-memory status, refusal of an unsafe Fountain close, and a verified,
explicitly labeled `.draft.json` copy containing all live rows/styles, caret and
exact original bytes. Source and old checkpoints remain unchanged.
`--latency-review` uses trusted Ctrl+End
before 120 physical inputs in a 2,400-row source, recording exact bytes, delivered
keys and raw key-to-rAF samples with production capture/cadence/completion active.
It asserts key delivery and bytes before any timing claim. rAF is an event-loop
proxy, not compositor paint or a page-equivalent benchmark.

Each mode retains its private artifact root. Capture review closes only after
the independently inspected draft bundle is published; its observed rows remain
in `capture-review.json`. Timing reports also record driver dispatch time and
the observed input span so delivery backlog is visible. Run timing probes without
concurrent builds/tests. See the
[M3-13 review](../../../docs/reviews/2026-09-29-m3-13-review.md) and
[evidence](../../../docs/test-evidence/M3.md#m3-13--integrated-editor-gate-and-separate-safety-review)
for the original gate decision, and the
[audit correction evidence](../../../docs/test-evidence/M3.md#repository-audit-corrections)
for later results and remaining limits.
