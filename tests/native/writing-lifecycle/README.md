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
File pickers receive one Return. Folder acceptance uses the exact owned GTK
AT-SPI Select action after location navigation; a disposed target fails without
sending a key into the editor. The folder picker leaves GTK Recent with Alt+Home before entering the explicit disposable path; no personal file is opened.

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

M5-06 export-only drills: after a default release build and keyboard-helper build,
run `python3 tests/native/writing-lifecycle/drill.py /tmp --pdf-export`, then repeat
with `/home/phagmaier/Code/babel/target`. These use actual WebKit/GTK/native helper
and synthetic BOM/CRLF drafts: informed omissions/SC008 refusal, review/picker
cancellation, capture while typing/Save, preview resumption, verified atomic
replacement/previous PDF, protected-source/app-data refusal and destination
permission failure. A delayed real render callback tests capture freshness; no
mock renderer/destination or feature flag is used. Poppler checks actual pages
and text. Each run retains its report and app-only screenshots.

## M5-07 integrated publication gate

After `mise exec -- pnpm tauri build` and the keyboard-helper build, use the
existing continuous descendant ledger/crash-journal runner with the new mode:

```sh
BABEL_SHUTDOWN_MODE=ordinary GTK_IM_MODULE=gtk-im-context-simple python3 tests/native/writing-lifecycle/integrated_exit.py /tmp "$PWD/target" --modes publication-exit --output target/publication-matrix-new
```

Run from the live graphical session, or pass its Wayland/Hyprland/display
environment to these test processes. The original 19-mode M4 default is
unchanged. The new scenario checks same-version preview/export source, profile,
fonts, actual count, Poppler word boxes and full page rasters, exact BOM/CRLF
Save, then the M5-06 failure/cancellation/typing drill and M5-05 delayed real
reply/preview-open typing drill. Each run owns fresh profiles and files; ordinary
app-window shutdown precedes stale WebDriver cleanup. The runner retains failed
workloads, runtime crash lines, PID/start identities, survivors and journal scans.
Polling and bounded journal delivery do not establish lossless crash tracing.

Extract the freshly built AppImage in a new directory with
`--appimage-extract`. Repeat against `squashfs-root`:

```sh
BABEL_SHUTDOWN_MODE=ordinary GTK_IM_MODULE=gtk-im-context-simple python3 tests/native/writing-lifecycle/offline_publication.py target/package-new/squashfs-root /tmp
BABEL_SHUTDOWN_MODE=ordinary GTK_IM_MODULE=gtk-im-context-simple python3 tests/native/writing-lifecycle/offline_publication.py target/package-new/squashfs-root "$PWD/target"
```

`unshare` isolates the driver/app network with only loopback enabled for WebKit
automation. `bwrap` hides home/temp development toolchains and masks system
Python/Node/Rust executables and Python libraries only in the owned AppRun/app.
Host input and independent inspection tools remain outside that mount namespace.
Retained namespace/route witnesses and launcher inventory make
the scope reviewable. This tests the extracted package's actual AppRun and GTK
hooks; FUSE launch, desktop registration and other platforms stay separate.
Never run the two interactive commands concurrently.

Full corpus and two-viewer checks (inspection-only venv from the PDF helper guide):

```sh
BABEL_PDF_HELPER_RUNTIME="$PWD/target/package-new/squashfs-root/usr/lib/babel/pdf-helper" unshare --user --net target/dev-python/bin/python tools/pdf-helper/test_profile.py --output target/corpus-new
python3 tools/pdf-helper/audit_viewers.py target/corpus-new --output target/viewers-new
```

Output directories must be new. Poppler layout/text/fonts/22 goldens and
Ghostscript raster/selectable-text checks are independent of the renderer;
visually inspect all pages in both viewers before acceptance. No golden is
regenerated or adopted by this gate. Shared frontend/browser/Rust, tmpfs/Btrfs,
package runtime verifier, syntax, formatting and local-link checks still apply.

## M4-15 standalone WebKit shutdown control

On the existing GTK3/WebKitGTK/Hyprland desktop, run installed libraries first:

```sh
python3 tests/native/writing-lifecycle/test_minimal_webdriver.py
python3 tests/native/writing-lifecycle/minimal_webdriver.py --output target/minimal-webkit-home --repeats 4
python3 tests/native/writing-lifecycle/minimal_webdriver.py --output target/minimal-webkit-editor --repeats 4 --leave-editor
```

Each output directory must be new. The runner compiles `minimal_webkit.c` with
`-Wall -Wextra -Werror` and installed GTK3/WebKitGTK 4.1 development packages;
it unsets private loader overrides, records live library mappings/hashes, and
uses disposable XDG profiles. No Babel/Tauri/manuscript/persistence code runs.
The synthetic 2,703/27,003-row pages exercise remote element IDs, trusted typing,
exact native Undo, font changes, scrolling and viewport screenshots. Requests
allow up to 120 seconds for full-document relayout; timings are diagnostic.
`--composited` retains the draft forced `translateZ(0)` editor layer. That variant
timed out before close at both 30s and 120s request budgets. The default has no
forced layer, consistent with Babel’s editor CSS; all row/input/zoom checks stay.
The default blurs the editor after typing/Undo, as Babel's zoom dropdown moves
focus away from the editor. `--keep-editor-focus` retains the draft active-caret
variant; that variant also timed out before close without the forced layer.
These are explicit control differences, not a product workaround or proof of the
shutdown corruption's cause.

The default single-character edit uses `document.execCommand('undo')`, WebCore's
native editing history, and records exact text plus delivered events. This is
an explicit browser editing command, not a physical shortcut or Babel Undo
verification. `--undo-method keys --edit-text 'PROBE '` retains the original
Ctrl+Z diagnostic: the bare host received trusted keys without undoing text on
the reference runtime. An Undo failure stays a failed workload, never exit proof.

Ordinary close targets the owned PID/start/window address through Hyprland while
WebDriver remains attached. GTK drains for two seconds after window destruction;
only after all observed descendants exit does the runner delete the stale session
and stop the driver. `--leave-editor` closes with the large document present;
the default removes it for a synthetic Home. These differ from Babel's event loop
and protected manuscript close. They cannot satisfy M4-15 application acceptance.

Results retain request/phase spans, source snapshots, PID/start ledgers, exit
observations, screenshots and bounded journal scans. Any crash/core observation,
failed observation, fallback signal, survivor or incomplete workload prevents a
strict pass. Failed cleanup pins a process with a pidfd and rechecks start time
before signalling. Sampling and delayed journal delivery remain limitations.
All failed evidence is retained; a clean control does not establish a fix or
exclude a Babel-dependent trigger. No private-stack comparison is meaningful
until the installed control reproduces the relevant failure.

`--exit-order tao` (default `drain`) passes `--exit-order=tao` to the host and
follows pinned Tao 0.37.1/Tauri 2.12.0 on Linux instead: `delete-event` is
inhibited, the window is destroyed outside GTK dispatch, two non-blocking
`gtk_main_iteration_do` calls run, then `exit(0)` (Rust `process::exit`) with the
WebContext still referenced, as Tauri's Linux `WebContextStore` keeps it. The
host exits about 1ms after destroy, so the web process may outlive it. The strict
oracle requires this path's markers and refuses the drain marker. Remaining
differences: ephemeral context versus Tauri's data directory, a WebDriver-created
view versus Wry returning the app's existing view, and a plain `GtkWindow` versus
Tao's `GApplication` window. From a non-graphical (for example SSH) shell, pass
the live Hyprland session's `WAYLAND_DISPLAY`, `DISPLAY`, `XDG_SESSION_TYPE`,
`XDG_CURRENT_DESKTOP` and `HYPRLAND_INSTANCE_SIGNATURE` to the runner only;
otherwise the host cannot open a display and the session request times out.

`--view-owner app` (default `automation`) passes `--view-owner=app`: as Wry
0.57.0 does, the host builds its window and view at startup, loads
`about:blank`, and every automation `create-web-view` request returns that
existing view instead of creating one. The strict oracle requires the startup
and reuse markers and refuses them in the default mode. It combines with
`--exit-order tao`; it does not add Wry's `GtkBox` packing or Tauri's custom-scheme page.

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

## M4-15 integrated exit

Build the default release and existing helpers, then run the sequential matrix:

```sh
PATH=/tmp:$PATH python3 tests/native/writing-lifecycle/integrated_exit.py /tmp /home/phagmaier/Code/Babel/target --output /tmp/babel-m4-15-native-final
```

The new output directory retains `results.json` plus each exact mode command/log.
Each run owns fresh app data and a WebDriver; never run two native modes together.
The 19 modes include a continuous screenplay session and all existing M4 feature
runners plus inherited editor/input/capture/acknowledged-save/restart/latency
reviews. `--modes daily-session capture-review` selects an explicit partial rerun.
`--modes find-timing` independently runs the existing typical/stress Find/navigation
measurements; full Find still requires its actual pinyin checks.
Partial results cannot replace the required full acceptance matrix.

The continuous session edits a synthetic 274-byte BOM/CRLF screenplay with an
unknown title field, three scenes/two sections, Unicode, bold/mixed-emphasis text, safe hidden
note, protected omission and incomplete speech. It exercises title Apply/Save/
Undo/Redo, visible/hidden replacement with formatting retained and protected
omission/mixed emphasis excluded, warning selection, unavailable M5 assessment, presentation,
characters/counts/spelling, actual dead-key commit/Undo, normal process restart/Recent/recovery review, exact
reopened bytes/marks and independent named-original snapshot retention. Other
modes supply New/destination/recovery/missing/read-only/protection/history,
scene/section pointer/keyboard moves, palette/native menu/remap/accessibility,
spelling language/Ignore/Add/offline resources, actual IME/dead keys/clipboard,
external divergence/emergency copy and acknowledged checkpoint SIGKILL recovery.

File picker acceptance now uses one Return in every mode. Folder selection
requires the existing AT-SPI bus and `gdbus`; only driver-descendant connections
and the exact Choose destination folder subtree's single Select button can be
activated. No arbitrary application or editor key receives the action.
Runtime crash lines are recorded for separate review, including intentional-kill
scenarios carrying C1. Every mode also keeps an owned-process ledger
(`*-processes.json`) and bounded crash journal (`*-journal.json`): journal-only
cores and surviving app/WebKit processes fail `crashAuditPassed`. Replay them
with `audit_process_watch.py <results.json> --output <new-dir>`. New ordinary-editing/close crashes block acceptance even
when expected bytes pass. Measurements remain native observations/rAF proxies;
no screenreader, full S13, installed package, power-loss or Local v1 claim.

Retained artifact audit (read-only, independent of application parsing):

```sh
python3 tests/native/writing-lifecycle/audit_retained.py /tmp/babel-m4-15-native-final/results.json --output /tmp/babel-m4-15-retained.json
```

This audits successful roots only. It rechecks journal/confirmed frame checksums,
source hashes, snapshot record/source bindings and safety-ref source blobs, and
inventories previous-source generations. Scenario literal oracles remain the
content/ordering/selection authority; checksum agreement alone is not semantic
acceptance. Preserve failed-root evidence separately.

### Isolated Fcitx prerequisite for M4-15

For a private corrected WebKit trial, use `stack_probe.py` **inside** the IME
wrapper, after building/installing the candidate into a private prefix:

```sh
python3 tests/native/writing-lifecycle/isolated_ime.py \
  /tmp/babel-m4-15-fcitx/prefix -- \
  python3 tests/native/writing-lifecycle/stack_probe.py \
  --prefix /home/phagmaier/Code/Babel/target/m4-15-webkit-candidate-1/prefix \
  --output /tmp/babel-m4-15-candidate-stack-1 -- \
  python3 tests/native/writing-lifecycle/shutdown_isolation.py \
  /tmp /home/phagmaier/Code/Babel/target --repeats 2 \
  --output /tmp/babel-m4-15-candidate-paired-1
```

Use fresh output directories. The observer preserves the IME library path while
prepending candidate libraries/driver, checks mapped paths/device/inodes and
executable identities in owned descendants, and rechecks expected file hashes
and Python tooling after the command. Each observation retains its current
process name; an observed exec transition requires a complete mapping proof for
each executable, and reads spanning a name change are discarded. It observes expected mapping devices
through private read-only mmaps; Btrfs stat and mapping devices can differ,
and both are retained. Missing Babel/driver/web-process observations, a missing or
unexpected native mapping/executable, changed files or command failure refuse
success. Driver processes need their candidate executable; other native roles
also need both candidate WebKit/JSC mappings. `stack.json` is checkpointed during
execution and finalized separately from the native matrix. Polling can miss
short-lived processes/mapping changes and adds overhead; do not call observed
maps lossless tracing or compare these timings as if the observer were absent.
This proof supplements exact byte/checkpoint and strict crash/journal audits.
It neither supplies a supported package nor establishes crash correction.
Synthetic tooling checks: `python3 tests/native/writing-lifecycle/test_stack_probe.py`.

`isolated_ime.py <verified-prefix> -- <drill-command...>` runs real Fcitx GTK3,
pinyin and Mozc from signed, unpacked host packages. It refuses an existing
Fcitx service or personal legacy `~/.mozc` profile. It uses a private XDG profile,
a read-only package/system overlay and an owned PID namespace; cleanup stops
only that namespace, including its Mozc server. The host needs `bwrap` with
read-only overlay/PID-namespace support, `gtk-query-immodules-3.0`, `gdbus`,
the existing keyboard helpers and native GUI. No system installation, autostart,
global settings, xcb/waylandim keyboard frontend or cloud-pinyin addon. The
existing accessibility/session bus remains available for owned GTK pickers.

The caller must verify signatures before extraction. Current retained preparation:
`pacman -Sp --print-format '%n %v %l' fcitx5 fcitx5-gtk fcitx5-chinese-addons fcitx5-mozc`
identifies package URLs/versions without installing. Download each selected
package and `.sig`, verify with
`gpgv --keyring /etc/pacman.d/gnupg/pubring.gpg <package>.sig <package>`, then
`bsdtar -xf <package> -C <private-prefix>`. All verification must succeed.
The current nine-package manifest excludes unused Qt/WebEngine packages; exact
URLs, versions, signatures and verification log are retained under
`/tmp/babel-m4-15-fcitx`. This host-specific preparation is test-only.

Run the affected matrix with:

```sh
python3 tests/native/writing-lifecycle/isolated_ime.py \
  /tmp/babel-m4-15-fcitx/prefix -- \
  python3 tests/native/writing-lifecycle/integrated_exit.py \
  /tmp /home/phagmaier/Code/Babel/target \
  --modes outline title-page find presentation editor-exit \
  --output /tmp/babel-m4-15-preedit-native-1
```

Use a new output directory for every rerun. Retain the printed `IME ARTIFACTS`
root. [M4-15-R1](../../../docs/tasks/M4-15-R1.md) enables real client preedit in
the production Linux WebView. Each scenario requires trusted compositionstart
and compositionend, literal byte/Undo oracles and actual candidate commit/cancel.
Editor-exit checks each pinyin/mozc case independently; unrelated Unicode
compositionend events cannot satisfy the prerequisite. A cold Mozc switch waits
for the observed engine name and records failed switch attempts; it does not
substitute a synthetic input. Title baseline typing selects keyboard-us, then
pinyin owns the cancellation preedit. Publication/thaw and focus adoption are
observed before subsequent presentation checks. Outline rectangle visibility
allows one CSS pixel for integer-scroll/subpixel rounding and retains exact
expected row/offset, timing and failure screenshots.

The shared drill selects GTK's exact built-in `gtk-im-context-simple` ID for
spellcheck/characters/commands. The shorthand `simple` was an unknown module ID
that previously fell back to the system default; an isolated Fcitx wildcard
cache changes that fallback. Genuine GTK Unicode commit/cancel remains required.
Every active native session and forced WebDriver session DELETE is phase-marked
in the native log, including profile restart; corruption lines remain detected
and fail the matrix for review. A clean later rerun does not establish the origin
of an earlier heap abort or close its safety finding.

### M4-15 paired shutdown isolation

After the same default release build and verified IME preparation above:

```sh
python3 tests/native/writing-lifecycle/isolated_ime.py \
  /tmp/babel-m4-15-fcitx/prefix -- \
  python3 tests/native/writing-lifecycle/shutdown_isolation.py \
  /tmp /home/phagmaier/Code/Babel/target --repeats 2 \
  --output /tmp/babel-m4-15-shutdown-paired-1
```

This is a diagnostic subset, not the full M4 exit. Each arm uses the unchanged
production binary and a fresh profile, runs all existing presentation oracles,
and exits twice (preference restart and final Home). `ordinary` sends Hyprland's
[graceful window-close request](https://github.com/hyprwm/hyprland-wiki/blob/main/content/configuring/core/dispatchers.md)
to the driver-owned Babel address after protected document close. It observes
app/WebKit descendant exit before stale session DELETE; it never kills the app.
`forced` deletes the active WebDriver session at the same point and observes its
process exit. PID/start-time tokens distinguish exited/zombie processes from
PID reuse. Failed ordinary exits remain failures even if fallback cleanup works.
Both arms use WebView automation; this does not certify non-automation exits or
closing a still-open/dirty document through the window manager.

`binary.json`, per-run logs, aggregate `results.json` and each profile's
`shutdown-phases.json` retain binary hash, arm/order/filesystem, process inventory
and wall-clock phase boundaries. Two repetitions alternate arm order. All crash
lines still fail the strict matrix; clean repeats do not fix retained C1/C2.

Add `--presentation-no-restart` to run the same typical/stress, zoom, real IME,
Undo/divergence/Save As and protected document-close oracles with one final exit.
It omits preference restart verification and requires `--modes presentation`
alone. The manifest records `presentationRestart: false`; the byte auditor
requires one complete exit for this diagnostic and two for the default scenario.
Use a new output directory for every run.

Paired cases now retain a continuous `/proc` descendant ledger beside their
logs (`*-processes.json`), rooted at the owned drill process before WebDriver
starts. PID/start tokens and first-observed parent links persist across orphaning
and restarts; polling sleeps 50ms, with actual maximum gaps recorded. This is
not lossless fork tracing: processes living entirely between samples can escape
attribution. After cleanup, five seconds of continued observation precede a
per-case bounded kernel/coredump journal scan (`*-journal.json`). Owned and
unattributed WebKit/Babel crash events, scan failure or surviving native
processes fail `crashAuditPassed` and the matrix. Delayed journal delivery beyond
the recorded window remains an omission; retained-window replay and targeted
owned-PID core checks provide additional evidence. Core identity fields are
checked even when journalctl omits an oversized `MESSAGE` as null. Journal
warnings also prevent a complete read claim. Replay exact retained windows using
`python3 tests/native/writing-lifecycle/audit_process_watch.py <results.json> --output <new-directory>`;
it preserves original manifests and exit codes, creates derived reports and
returns the strict verdict. The broader
retained auditor excludes failed crash/phase/matrix verdicts. These diagnostics
add no product hook or dependency and do not replace the integrated gate.
Audit frozen presentation bytes and exact source/checkpoint hashes in **all**
roots, including crash-failed cases, without changing their native verdict:

```sh
python3 tests/native/writing-lifecycle/audit_shutdown.py /tmp/babel-m4-15-shutdown-paired-1/results.json --output /tmp/babel-m4-15-shutdown-byte-audit.json
```

Its literal hashes were independently checked against retained pre-isolation
presentation artifacts; it imports the independent checksum auditor, not the
production codec or scenario generator. It also checks complete phase sequences or an honestly
retained prefix after failure. Incomplete sequences remain native failures. The existing `audit_retained.py` accepts this aggregate manifest for
broader journal/snapshot/ref auditing of strict successful roots. Failed roots
remain retained without relabelling them successful.

For a separate cold-Home control without WebKitWebDriver or the automation
environment variable, run the same binary sequentially (after the paired run):

```sh
python3 tests/native/writing-lifecycle/isolated_ime.py \
  /tmp/babel-m4-15-fcitx/prefix -- \
  python3 tests/native/writing-lifecycle/plain_quit.py \
  /tmp /home/phagmaier/Code/Babel/target --repeats 4 \
  --output /tmp/babel-m4-15-plain-quit-1
```

Each cold launch has a fresh profile and an owned native window, waits for its
WebKit process plus one second, sends the same graceful close request and
records process/phase/exit/stderr evidence. There is no WebDriver process or
session DELETE. This control covers cold Home exit only; it neither opens a
manuscript nor verifies drafting/content protection. A failed close remains a
failure; any fallback parent kill is explicitly recorded. Include
`plain_quit.py` and `audit_shutdown.py` in Python syntax checks. Query only
recorded owned WebKit PIDs with `coredumpctl` when checking for new cores.

### M4-15 own-code shutdown controls

`shutdown_isolation.py --arms ordinary` restricts the existing paired runner to
native window close. `--presentation-control` defaults to `baseline`; diagnostic
choices are `preedit-disabled` (requires a separately built default release with
client preedit disabled and asserts zero trusted composition starts), `no-ime`,
`typical-only`, `no-zoom`, and `cleanup-probes` (removes the presentation probe's
listeners and pending animation frames before document close). Real input/Undo
and frozen source oracles remain for every workload actually exercised. These
omissions are recorded in the manifest and measurements and cannot pass the
integrated acceptance gate. Never use a reduced workload as proof of a fix.

`BABEL_SHUTDOWN_PREPARATION=idle` waits five seconds at Home before exit;
`blank` navigates to `about:blank`, verifies the navigation and waits five seconds.
The default `none` retains immediate exit. Document-close/byte assertions precede
both alternatives. Blank navigation retains an automation session and is not a
non-automation control. In this driver-owned launch, WebDriver session DELETE
closes the window itself; it is not a detach operation before native close.

Every shutdown now records `shutdown-observations-N.json`: owned PID/start-token
state, `CoreDumping`, shared pending signals, thread names/wait channels and
new stderr with first-observed timestamps, sampled every 100 ms. These read-only
observations distinguish time waiting before an abort from time writing its
core. Polling, inaccessible proc fields and thread exits limit attribution;
there is no ptrace, signal injection, compositor/global setting or crash filter.
The independent continuous descendant ledger/journal gate remains authoritative.
Run `python3 tests/native/writing-lifecycle/test_shutdown_observer.py` for the
synthetic observer tests; these are not native-exit evidence.

For copied diagnostic binaries, retain the basename `babel-desktop` in separate
directories: GTK derives the window class from it and the input harness refuses
other classes. Pin `RUSTUP_TOOLCHAIN=1.97.1` and use
`mise exec node@26.7.0 pnpm@11.22.0 -- pnpm tauri build --no-bundle` for an embedded
production build. Plain `cargo build --release` does not select Tauri's production
configuration. Retain both source diffs and binary hashes, restore production
source/binary after the comparison, and use new output directories for each run.

### M4-15 presentation without WebDriver

`plain_presentation.py` launches the unchanged production binary directly with
fresh XDG directories and verifies the automation environment flag is absent.
AT-SPI operates only controls whose bus owners descend from the launched app;
PID/start tokens are rechecked before mutations. `wtype` input requires an owned
focused window. Disposed accessibility objects may be rediscovered during reads;
ambiguous mutation failures are never retried. No JavaScript/DOM injection or
WebDriver session is used. This is OS-assisted automation, not manual testing.

```sh
python3 tests/native/writing-lifecycle/isolated_ime.py /path/to/verified-prefix -- \
  python3 tests/native/writing-lifecycle/plain_presentation.py /tmp target \
    --repeats 2 --output /tmp/babel-plain-presentation-results-1
python3 tests/native/writing-lifecycle/audit_plain_presentation.py \
  /tmp/babel-plain-presentation-results-1/results.json \
  --output /tmp/babel-plain-presentation-audit-1
python3 tests/native/writing-lifecycle/test_owned_accessibility.py
```

Use fresh output directories. Existing `busctl`, the accessibility/compositor
bus, verified `wtype`, and `/tmp/babel-m3-08-keyboard` are required. Build the
keyboard helper with the existing `tests/native/editor-input/build-keyboard.py`.
No GI binding, screenreader, package installation or global setting is required.
The IME wrapper retains the prior environment; this control does not compose text.

The default workloads use the exact typical/stress manuscript hashes from the
presentation auditor. They exercise real Save, a verified edit/Undo, theme/zoom,
focus/typewriter, long-document scrolling, Save As and protected document close.
A post-Save-As edit must change the copy while leaving the original intact, then
Undo restores the exact copy. Native confirmed/recovery frames are independently
checked. `--workloads typical` or `stress` selects a diagnostic subset.

IME, completion/Find, external divergence, geometry assertions and preference
restart remain omitted. These are not the full presentation acceptance workload;
clean results do not establish that WebDriver is necessary for the crash.
The runner retains continuous process attribution, close/core-dump observations,
strict stderr/journal failures, command/binary/tooling provenance and failed
setup cases. Failed-probe forced cleanup is never ordinary-close evidence.
The independent auditor reports byte coverage separately from strict results;
an audit completing successfully does not relabel a crashed run as passing.
