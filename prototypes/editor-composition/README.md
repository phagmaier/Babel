# M1-06 bounded composition investigation

This diagnostic composes the M1-01 codec, typed ProseMirror nodes and the existing M2 native writer/controller. It is isolated from the production route and enabled only by the Linux `editor-composition-proof` Cargo feature and explicit proof config. No picker, smart keys, remote transfer, retention, PDF or production editor is added.

## Source and transaction ownership

`model.ts` creates one EditorState with typed heading/action/character/dialogue nodes and protected source nodes. Stable line IDs remain editor attributes. A private plugin retains the original immutable source snapshot; it never advances an independently writable source buffer. Serialization derives edited bytes from the current typed nodes using the existing codec's conservative line replacement and neighboring-grammar checks. Undo restores both node text and selection, so a document matching the original nodes returns the original bytes, including original forcing markers. Current source ranges and UTF-16/UTF-8 selection anchors are derived at capture, rather than treating original offsets as current offsets.

The diagnostic admits 1–32 lines and at most 4 KiB. Its transaction filter synchronously checks the bounded grammar/byte transformation before accepting edits; measured timings include that work. This is deliberately small and is not a production incremental codec/performance design. Hashing, snapshot capture and native work run outside key/transaction handlers. Each content or explicit selection transaction advances the persistence version, including undo/redo. The visible live version reads directly from EditorState while asynchronous capture/hashing is pending, so an older receipt cannot label a newer editor state saved. Captures are serialized, copied and submitted through the existing PersistenceController/native checkpoint/save commands; exact unchanged versions can be explicitly flushed again.

Supported: text edits inside heading, action, cue/dialogue; Unicode; same-line selection replacement; undo/redo; unchanged blank/unknown source regions; BOM/CRLF and no final newline. Refused: line splits/joins, node/type/ID changes, protected source edits, grammar drift, multiline paste and invalid UTF-8/Unicode. Plain-text paste is inserted as text; HTML is not interpreted. Full Fountain grammar, structural edits, IME, empty drafting intent and large-script performance remain later gates. Reopen verifies disk bytes in a fresh native registration; restoration of draft selection across reopen is outside this diagnostic.

## Synthetic fixtures and native isolation

`fixtures/` contains original synthetic material authored for this investigation; its text may be reused for testing this project. `*-edited.fountain` is an independent literal oracle: action text gains ` é🚀`, and the codec's explicit action marker is expected. The oracle was not produced by the implementation. `.gitattributes` disables text conversion for all Fountain files. Do not format fixture bytes.

Seed a new root explicitly (optional argument chooses the reference filesystem):

```sh
python3 prototypes/editor-composition/seed.py /tmp
python3 prototypes/editor-composition/seed.py $PWD
```

Use the printed path, keeping data isolated beneath it:

```sh
env BABEL_EDITOR_COMPOSITION_ROOT=/tmp/babel-editor-composition-REPLACE \
  XDG_DATA_HOME=/tmp/babel-editor-composition-REPLACE/data \
  pnpm tauri dev --features editor-composition-proof \
  --config src-tauri/tauri.editor-composition-proof.conf.json --no-watch
```

Native initialization requires an absolute canonical private root with the `babel-editor-composition-` name prefix and exact private single-link `SYNTHETIC-M1-06` marker. The opening command accepts only `lf`, `crlf` or `no-final-newline`; their filenames are chosen natively. Native source permission/ownership/lease checks still apply. No frontend path or shell endpoint is introduced. Startup recovery is also isolated beneath this root; production writer initialization and capabilities are unchanged. Root/marker checks are diagnostic safeguards for owned synthetic data, not a sandbox against a malicious local account racing these checks.

F1 opens the selected fixture; F2 checkpoints and safely saves; F3 freezes editor input and invokes the M2-05D protected close policy on the latest capture before reopening; F4 cycles fixture before opening; F7 focuses the action end; F6 selects `lamp`; F8 logs a bounded native report. Open a fresh seed/process for another fixture or fault run. Stop after reopen; earlier-session recovery adoption is a separate native recovery workflow, and this proof does not bypass it.

M2-05D close drills: F9 requests a native window close; the host prevents it
while a registration is open and the editor captures/saves the latest version.
F10 chooses only the fixed proof destination for an emergency copy and closes
after its exact receipt. F11 closes with risk only after checking the visible
"I understand" control. For failure drills use only a newly marked synthetic
root: modify its fixture source externally after typing to force divergence,
or make its private recovery directory unavailable to verify the memory-only
warning. A failed F9 leaves the editor open. The default shell and ordinary
manuscripts never use this diagnostic selector.

## Checks and native observation

```sh
pnpm exec vitest run tests/contract/editor-composition.test.ts
cargo test -p babel-desktop --features editor-composition-proof --locked
BABEL_COMPOSITION_TEST_ROOT=$PWD \
  cargo test -p babel-desktop --features editor-composition-proof --locked editor_composition_proof
```

With the real WebKit proof window focused and the chosen fixture opened:

```sh
python3 prototypes/editor-composition/native-input.py \
  /tmp/babel-m1-06-native-webview.log /tmp/babel-editor-composition-REPLACE lf
```

The driver checks the focused window title before Wayland input, exercises native typing/selection/undo/redo, reads bounded Rust command reports, and compares actual disk bytes with the independent oracle. Browser or MockRuntime results do not close the native WebView gate. Timing samples are `EditorState.applyTransaction` plus view update and keydown-to-next-animation-frame proxies, not actual paint measurements or a performance-budget pass. Shared checks, default/feature builds, filesystem fault checks and final evidence are recorded once in [M1 evidence](../../docs/test-evidence/M1.md).
