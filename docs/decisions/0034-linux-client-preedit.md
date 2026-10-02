# ADR 0034: Linux client preedit on the production WebView

Status: **Accepted direction**
Date: 2026-10-01

## Decision and evidence

Enable WebKitGTK client preedit through Tauri's main-thread `with_webview`
startup callback. Pinned Wry 0.57.0 otherwise calls
`input_context.set_enable_preedit(false)`. Real restored Fcitx pinyin committed
candidates but supplied no in-progress DOM composition events. End-only totals
also counted non-IME Unicode input. That cannot verify the editor/form
composition guards in [the input contract](../editor-behavior.md).

Use exact Linux-only `webkit2gtk = 2.0.2`, already in Cargo.lock through Wry,
with its existing v2_28 API. The crate is MIT licensed; WebKitGTK remains the
existing dynamically linked Linux platform runtime, with its existing notices
and distribution obligations. No additional engine, bundled binary, runtime
network, native command or frontend permission is introduced. Tauri itself is
exactly pinned. Upgrade reviews must retain real preedit/candidate/Undo evidence.

Server-side candidate-only editing would conceal in-progress composition from
application guards. Patching vendor crates or fabricating DOM composition events
would be a second source of behavior or unsupported native evidence. Keep the
upstream dependency unchanged and configure the existing native context instead.

Evidence: [M4-15-R1](../tasks/M4-15-R1.md) real trusted composition start/end,
exact bytes/Undo on both filesystems, shared/default-release checks and a separate
same-agent source review are recorded in [M4 evidence](../test-evidence/M4.md#continuation-from-e8c2304--isolated-ime-and-m4-15-r1).
Evidence still needed: the full integrated exit remains open because native
presentation restarts emitted heap aborts; ordinary application-quit impact and
corruption origin remain unresolved. Other platforms/distribution are unverified.
The ordinary-close abort is mitigated separately by [ADR 0035](0035-linux-web-process-close.md).
