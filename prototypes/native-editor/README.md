# M1-02 disposable native editor proof

This is a separate Vite page loaded only by the [Tauri proof config](../../src-tauri/tauri.native-proof.conf.json). The production app route remains the M0 skeleton. The `native-editor-proof` Cargo feature enables a bounded diagnostic log command only for the explicit proof run; it provides no file or shell access.

Run from the repository root:

```sh
node prototypes/native-editor/hash-fixtures.mjs
CARGO_HOME=/tmp/babel-cargo pnpm tauri dev --features native-editor-proof --config src-tauri/tauri.native-proof.conf.json
```

The generator produces deterministic synthetic action, heading, cue, dialogue, and long wrapping paragraphs. Its 120/300/600 labels are **workload equivalents**, not rendered PDF page counts. `hash-fixtures.mjs` records source bytes, lines, blocks, and SHA-256 before testing. No private manuscript is loaded.

Inside the native window, `F7` focuses the editor at the end, `F8` logs a bounded report via the proof-only native command, and `F10` cycles workload. The report includes native-host identity, fixture hash, document/DOM selection, event counts and order, document tail, and timing samples. `keydown` to the next `requestAnimationFrame` is a frame timing proxy, not a compositor paint measurement. Transaction timing covers `EditorState.apply` plus `EditorView.updateState`; neither is a full end-to-end input guarantee.

Use real native input for the proof: paced `wtype` keys, `Shift+Home` selection, Ctrl+Z / Ctrl+Shift+Z undo/redo, a live `wl-copy --foreground` source followed by Ctrl+V, and a dead-key sequence for WebKit composition. A plain browser run can inspect the page but is not native evidence. The command log and results are summarized in [M1 evidence](../../docs/test-evidence/M1.md); [ADR 0008](../../docs/decisions/0008-native-editor-input.md) records the decision and remaining limits.
