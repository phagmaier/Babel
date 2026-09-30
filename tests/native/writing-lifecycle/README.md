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

The [corrected M3-13 re-review](../../../docs/reviews/2026-09-29-m3-13-rereview.md)
and [fresh exit evidence](../../../docs/test-evidence/M3.md#m3-13--corrected-integrated-exit-re-review)
record passing full default-app input/IME/lifecycle runs on tmpfs/Btrfs after
the corrections. This is a bounded Linux editor gate; release limits remain.

## M4-01 native recents

Build the default production release as above, then run sequentially:

```sh
python3 tests/native/writing-lifecycle/drill.py /tmp --recents
python3 tests/native/writing-lifecycle/drill.py /home/phagmaier/Code/babel/target --recents
```

This mode drives the five production recent commands through real WebKit IPC
and actual owned GTK pickers. It verifies New recovery stays separate, Open
and Locate cancellation, exact-byte recent reopen, metadata/identity restart,
missing/moved loose-file confirmation, explicit different/read-only selection,
Save As cancellation/rollback/publication, metadata-only removal and corrupt
registry isolation with native checkpoint/restart. It adds no production hook,
proof feature or app capability. Home presentation remains M4-02. Native core
filesystem tests additionally cover managed rename/unknown JSON, leases, safe
anchors, bounds and real process interruption during registry publication.
Do not call generated MockRuntime IPC dispatch or Vitest contracts WebView E2E.

## M4-02 native Home workflows

Build the default production release, then run sequentially with other builds
and checks idle for the timing observations:

```sh
python3 tests/native/writing-lifecycle/drill.py /tmp --home
python3 tests/native/writing-lifecycle/drill.py /home/phagmaier/Code/babel/target --home
```

`home_workflows.py` drives actual visible Home/writing controls and real GTK
pickers. It does not call native commands through driver JavaScript. It checks
Home keyboard focus/Tab/Enter, Open/New-destination cancellation, initial empty
checkpoint, New with native destination publication, recent reopen, missing
source refusal, Locate cancellation/comparison/explicit moved link, metadata-only
Remove, mismatch/different/read-only Save As, restart recovery/resume, >64 KiB
preview truncation with full-byte resume, explicit Keep, failed Home switching
under divergence, emergency copy and corrupt-registry isolation. Independent
literal byte/hash oracles retain original checkpoints and external source.

The runner selects the intended checkpoint by its explicit document/generation
facts; it never assumes the first Resume button selects the newest content.
Previously opened source journals require the visible explicit Keep choice when
identical; the driver does not bypass that protection. Actions wait until initial
capture has completed, including on the 70,016-byte synthetic fixture.
`home-measurements.json` records warm launch from WebDriver session creation
to usable Home (including bounded reads, CSP probe and polling), observed WebKit
`performance.now` after reads, and elapsed protected return (including close/checkpoint/release
and polling). These are warm observations on the reference host, not compositor
paint, installed/cold-start, long-session or assistive-technology certification.
App-only screenshots accompany failure/recovery/registry states. All app/profile,
source and copy files are disposable under the requested filesystem root; owned
process and picker safeguards in `drill.py` remain in force.

## M4-03 outline mode

`python3 tests/native/writing-lifecycle/drill.py /tmp --outline` uses the default embedded release with no proof features and visible controls. DOM probes observe selections, focus, trusted events and timings; they do not invoke native commands or install an app-state hook. Disposable LF/CRLF/BOM/no-final-newline sources exercise hierarchy, collapse, synopsis filtering, duplicate authored numbers, Unicode caret, selection-only navigation, Undo, an uncapturable accepted parenthetical draft and recovery to a current outline. Owned real pinyin input covers commit/cancel with the panel mounted. A local 150% DOM zoom inspects app scaling without changing global settings.

Typical/stress workloads match the independently authored V8 measurement fixtures: 150/1,500 scenes, 18 physical rows per scene (4 Action, 2 cues, 6 Dialogue, 3 blanks, heading, 2 synopses), plus 3 header rows. No PDF page-equivalence claim. The stress outline explicitly discloses its 1,000-heading view limit; filtering reaches the last complete indexed scene. `outline-measurements.json` separates picker-through-current-outline wall time, navigation through its handler, editor focus and two animation frames. Each navigation independently asserts that the caret row is inside the viewport and the two-frame observation is below 200 ms on these fixed workloads. Selection-only capture yields this rendered turn before derivative/persistence work; later main-thread stalls remain a separate performance concern. Neither is compositor paint or an isolated native index-build timer; isolated V8 measurements exclude parsing/capture and run separately with builds idle. Exact source files/hashes, IME event report and app-only screenshots remain in the disposable artifact root. Pure index/selection behavior needs one filesystem run; persistence/identity services are unchanged.
