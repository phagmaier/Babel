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

## M4-04 workflow protection mode

`python3 tests/native/writing-lifecycle/drill.py /tmp --workflow-protection` (repeat on the Btrfs target root) drives the default embedded release through the shared frozen import guard, trusted keyboard cancellation, exact recovery/safety bytes, retry/import/one-step Undo and corrupt-history refusal while ordinary source Save continues. Cancellation observes trusted events and frozen input; it never interrupts a started native write. DOM scripts only inspect UI/focus/selection; no native invoke or editor-state hooks. Independent Git CLI reads inspect disposable safety blobs/refs, without an app runtime Git dependency. Strict/stale native request tests and interrupted publication remain native headless/MockRuntime layers, distinct from this WebKit UI drill. Source/copy/profile/report/screenshots remain disposable.

## M4-05 scene/section moves

After the default release build, run `python3 tests/native/writing-lifecycle/drill.py /tmp --scene-moves` and repeat on `/home/phagmaier/Code/babel/target`. `scene_moves.py` uses trusted WebDriver Enter and physical compositor pointer drag and visible Apply/Cancel/Save controls, with DOM-only observations and explicit backward-selection setup. Independent literal BOM/CRLF/EOF bytes/order, caret IDs/offsets, recovery checksums and native safety blobs verify small/large scene and nested-section moves, one-step Undo, immediate Save/reopen, history failure with ordinary Save independent, and refused EOF permutations with retained source review copies. Reports/screenshots/profile/source files remain in the disposable artifact root. No editor-state/native-invoke hook, mock port, personal manuscript, credential or remote operation is used.

For the M4-05 reference-host drag drill also build `python3 tests/native/editor-completion/build-pointer.py`. Its existing pinned MIT protocol and compiler prerequisites are documented in the [completion guide](../editor-completion/README.md). The disposable helper retains four-argument click behavior and accepts destination x/y as two additional arguments for a physical compositor drag. The runner refuses multiple monitors and coordinates outside the sole owned app. WebDriver-only HTML drag did not deliver dragover/drop, and physical native HTML drags reached trusted target dragover but still delivered no drop. Production outline handles therefore use owned pointer capture; the physical helper verifies trusted pointer-down/up and resulting preview/Apply. No desktop settings or application capability are changed.

## M4-06 title-page form

After the default embedded release build, run `python3 tests/native/writing-lifecycle/drill.py /tmp --title-page` and repeat on `/home/phagmaier/Code/babel/target`. `title_page.py` drives visible form/Save/snapshot/recovery controls, WebDriver trusted keyboard/pointer and owned compositor pinyin commit/cancel. Enter is sent as a keyboard action between textarea continuation lines because raw newline characters in WebKit's text-entry command are dropped. Independent literal BOM/mixed-ending/EOF/body oracles check no-op, edit/Undo/immediate Save, complete-field add/remove/reorder, refused continuation input, staged Home/restore protection, named restore/reopen, source-divergence refusal/recovery/Save As and read-only bytes. DOM scripts observe or focus controls only; they never invoke native commands or editor-state hooks. Exact-byte reports, actual composition events and app-only screenshots remain in each disposable root. The runner requires uninterrupted desktop use while owned keyboard/IME/pickers are active and restores the prior IME selection.

## M4-07 logical find and hidden navigation

After the default embedded release build, run `python3 tests/native/writing-lifecycle/drill.py /tmp --find`. `find_workflows.py` uses visible production controls, trusted WebKit keyboard shortcuts and real pinyin commit/cancel in the local query. It checks full/scene scopes, case/filter counts, wrap, title/note/omitted/raw selection and viewport, no editor recreation, no source/journal writes from find alone, exact authored Undo/Save and typical/stress last-heading navigation. All profiles/files are disposable; no app state hook or native invoke is added. Measurements retain fixed workload hash/dimensions and distinguish trusted last-input-to-count/two-rAF from navigation/two-rAF; neither certifies compositor paint or full S13. No second filesystem run is needed for this advisory matcher/view/selection increment.

## M4-08 transactional replace one/all

After the default embedded release build, run `python3 tests/native/writing-lifecycle/drill.py /tmp --replace` (`--replace-smoke` covers preview/apply/Save/close alone). `replace_workflows.py` drives the visible find-panel replacement controls with trusted keyboard/pointer: preview counts with the title refusal listed, disabled Replace on the title match, button and keyboard-Enter replace-one with focus and advance, atomic replace-all with one-step Undo, explicit Save, close, reopen and identical-content recovery resolution. Independent literal source audits verify each stage and the reopened bytes; screenshots and the disposable artifact root are retained. Saves run only after refreshed current results prove the replacement capture settled, and find is closed before saving, matching the M4-07 save discipline. No app state hook or native invoke is added. No second filesystem run is needed: replacement commits through the same EditorState/capture/persistence path as authored edits, and the persistence adapter is unchanged.

## M4-09 non-destructive Script Check

After the default embedded release build, run `python3 tests/native/writing-lifecycle/drill.py /tmp --script-check`. `scriptcheck_workflows.py` drives the visible Script Check toolbar action, severity filters, advisory dismissal, Go to Issue navigation, Refresh, Escape and Save-with-warnings using trusted keyboard/pointer. Independent literal source audits verify the file never changes under checks, dismissal, navigation or saving; screenshots and the disposable artifact root are retained. Selection-only navigation keeps prior results current without a stale banner, exercising the same-document rebase path. No app state hook or native invoke is added. The pure evaluator needs no second filesystem run.

## M4-10 presentation modes

After building the default embedded release, run `python3 tests/native/writing-lifecycle/drill.py /tmp --presentation` with GUI/compositor access and builds/tests idle. The private-profile drill uses visible theme/zoom/focus/typewriter controls, trusted WebKit keys/wheel, owned real pinyin commit/cancel, selection/geometry/event probes and independent BOM/CRLF/whitespace byte oracles. It checks bounded zoom, final-line centering, manual-scroll pause, Escape, outline jumps, one-step Undo, persistent save failure in focus, Home and profile restart. Explicit DOM viewport positioning precedes trusted clicks when WebKit's nested-scroller automation cannot reach an outline row; no native invoke or EditorState hook is used.

`presentation-measurements.json` records fixture bytes/rows/hash, actual device scale, synchronous event capture-to-document-bubble spans, input-to-rAF and toggle-to-two-rAF observations on 150/1,500-scene workloads. Handler spans include event routing and any synchronous work inside that event; asynchronous input/capture work and compositor paint are excluded. They do not certify the complete transaction/plugin frame budget, full S13, all DPI/platforms or long sessions. App-only screenshots, trusted composition events and all synthetic source/profile artifacts stay under the disposable root. Filesystem/native services are unchanged, so one filesystem is sufficient here.

## M4-12 production spellcheck

Build the default release/package and the owned pointer helper with
`python3 tests/native/editor-completion/build-pointer.py`, then build the physical
keyboard helper with `python3 tests/native/editor-input/build-keyboard.py`. Its additional test-only
`unicode-start` and `hex-4/f/6/0` actions exercise GTK's built-in simple Unicode
IME; no system IME/compositor setting is changed. If `wtype` is absent, build the
same existing helper's pinned MIT source in `/tmp` (no application dependency):

```sh
curl -fsSL https://raw.githubusercontent.com/atx/wtype/d71be3a7b3f93b534a2823fd68cabd7ac2a02359/main.c -o /tmp/babel-m4-12-wtype.c
wayland-scanner client-header /tmp/babel-m3-08-virtual-keyboard.xml /tmp/virtual-keyboard-unstable-v1-client-protocol.h
cc -O2 -DVERSION='"0.4 pinned d71be3a"' -I/tmp /tmp/babel-m4-12-wtype.c /tmp/babel-m3-08-virtual-keyboard.c $(pkg-config --cflags --libs wayland-client wayland-cursor xkbcommon) -lrt -o /tmp/wtype
PATH=/tmp:$PATH unshare --user --map-root-user --net /bin/sh -c 'ip link set lo up && exec python3 tests/native/writing-lifecycle/drill.py /tmp --spellcheck'
```

Repeat the final command with `/home/phagmaier/Code/Babel/target` instead of
`/tmp`. The runner requires only loopback in its private network namespace and
checks compiled local resource URLs. It uses real default-release controls and
trusted keyboard activation, with exact independent BOM/CRLF/marks/Unicode
source/selection/Undo oracles. It audits language/resources, established names,
Ignore/Add/Off, dictionary generations, owned process restart and a retained
synthetic dictionary-only failure while source Save continues. GTK simple IME
coverage is distinct from the earlier M4-11 pinyin proof; it does not claim East
Asian production IME or other-language/resource coverage. No editor-state/native
invoke hooks, mock ports, personal manuscript/dictionary or app runtime network.

## M4-13 characters/counts/recent position

Build the default release with the pinned Node/Rust PATH prefixes, `CARGO_HOME=/tmp/babel-cargo XDG_CACHE_HOME=/tmp/babel-cache pnpm tauri build`.
Run `PATH=/tmp:$PATH python3 tests/native/writing-lifecycle/drill.py /tmp --characters`
and repeat on `/home/phagmaier/Code/Babel/target`. Existing picker/keyboard/compositor
prerequisites apply. `python3 -m py_compile tests/native/writing-lifecycle/drill.py tests/native/writing-lifecycle/character_workflows.py` checks syntax.

Synthetic BOM/CRLF/Unicode/emphasis/title/note/omission source exercises actual
Character select/checkbox/navigation, editor focus, trusted typing/Undo and GTK
simple IME commit/cancel, zoom/theme/typewriter/manual scroll, protected close/
restart, external hash mismatch, Save As identity isolation, corrupt auxiliary
storage with real source Save/close and retained checkpoint selection on Resume.
DOM selection/viewport observations do not access EditorState or invoke native
commands. The restart scroll check uses a programmatic production Close control
activation to preserve the manual viewport before the close panel; typing, IME,
pickers, source save/recovery and process restart are native. Artifacts include
`characters-result.json` and app-only screenshots; no personal manuscript/profile.
No new native publication adapter is introduced. Installed-profile retention,
other platforms/screenreaders and long-session certification remain open.

## M4-14 palette/menus/accessibility

After the default embedded release/package finishes, run
`PATH=/tmp:$PATH python3 tests/native/writing-lifecycle/drill.py /tmp --commands`
and repeat on `/home/phagmaier/Code/Babel/target`. Uses existing owned Wayland
keyboard/wtype helpers, WebKitWebDriver, actual GTK native menus/file pickers and
disposable BOM/CRLF/Unicode source. File pickers use one confirmation to avoid
racing teardown into authored Return input. `commands-result.json`, screenshots
and driver logs remain under each printed synthetic root. Native menu labels/
selection must be visually inspected; semantic DOM facts are not screenreader
verification. Record actual AT-SPI inspection separately and keep missing Orca/
other-screenreader/platform coverage open. No proof feature, plugin, personal
manuscript, credential or new filesystem publication engine is used.

Rebuild `/tmp/babel-m3-08-keyboard` with the checked-in `keyboard.c` and existing
pinned generated Wayland protocol/keymap, as documented in
[development commands](../../../docs/development.md). `command-menu-save-as`
sends Escape/F10/Down/Down/Enter within one virtual-keyboard lifetime; separate
wtype invocations did not traverse the GTK menu reliably. The existing `gdbus`
accessibility bus and AT-SPI constants header are prerequisites for
`command_accessibility.py`. Only application descendants of the owned driver
are inspected. Actual numeric dialog/combobox/listbox/list-item roles and native
menu names are recorded; WebKit's empty localized role names are not treated as
missing numeric roles. This is AT-SPI exposure, with no Orca/speech/announcement
or screenreader shortcut claim. Dark 200% writing zoom is native preference
behavior; additional 150% whole-view CSS scaling is a synthetic layout probe.
The production Close control is invoked programmatically to test interruption
of an inert background; subsequent protection/release uses actual native services.
