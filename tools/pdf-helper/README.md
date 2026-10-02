# Offline PDF renderer helper (M5-01)

A self-contained renderer bundled with the app as a Tauri resource
(`pdf-helper/`). It pins Screenplain 0.12.0, ReportLab 4.4.7, charset-normalizer
3.5.1 and the Courier Prime fonts shipped in Screenplain, on a trimmed
python-build-standalone CPython 3.13.16. End users need no system Python.
Decision and limits: [ADR 0036](../../docs/decisions/0036-bundled-pdf-helper.md).

## Build and test

```sh
python3 tools/pdf-helper/build.py             # or: pnpm pdf-helper
python3 tools/pdf-helper/test_helper.py       # or: pnpm test:pdf-helper
python3 tools/pdf-helper/verify_runtime.py target/pdf-helper/runtime --exact
```

`build.py` downloads the artifacts in `pins.json` into
`target/pdf-helper/cache` once (build-time network only; each one is checked by
SHA-256), then assembles `target/pdf-helper/runtime` in about 3 seconds.
`--offline` uses only the cache. `runtime/BUILD.json` lists every file's
SHA-256 and a tree hash; identical pins give an identical tree hash.
`pnpm tauri build` runs the helper build through `beforeBuildCommand`. Plain
`cargo` commands only need the (possibly empty) runtime directory, which
`src-tauri/build.rs` creates.

To test a packaged copy, extract the AppImage and point the self-test at it:

```sh
babel_0.0.1_amd64.AppImage --appimage-extract
BABEL_PDF_HELPER_RUNTIME=squashfs-root/usr/lib/babel/pdf-helper python3 tools/pdf-helper/test_helper.py
python3 tools/pdf-helper/verify_runtime.py squashfs-root/usr/lib/babel/pdf-helper
```

AppImage bundling (linuxdeploy) rewrites the interpreter's loader metadata
(`RUNPATH`). The verifier accepts that only when the `.text`, `.rodata`,
`.data`, `.init` and `.fini` sections still match `BUILD.json`. Every non-ELF
file must be byte-identical.

## Protocol 1

```sh
python3.13 -I -S -B app/babel_pdf_helper.py '{"protocol":1,"profile":"screenplain-baseline","output":"/abs/new.pdf"}' < source.fountain
```

- Invoke with an argument vector, never a shell. Source bytes come on stdin
  (UTF-8, optional BOM, at most 16 MiB).
- `output` must be absolute and must not exist. The helper creates it
  exclusively (`O_EXCL|O_NOFOLLOW`, mode 0600), writes the PDF and fsyncs it.
  It writes nothing else, so HOME, TMPDIR, cwd and the runtime stay untouched.
- stdout is one JSON object. Success gives `pageCount`, `sourceSha256`,
  renderer versions, font hashes, `profile`, `profileFrozen: false`,
  `sourceMap: "unsupported"` and `warnings`. Failure gives
  `{"ok": false, "error": {"code", "message"}}` and exit status 2. Codes:
  `bad-request`, `unsupported-protocol`, `unsupported-profile`,
  `output-invalid`, `output-exists`, `source-too-large`, `invalid-utf8`,
  `font-integrity`, `render-failed`, `internal`. A failed render removes the
  file it created.
- Limits: 60 s CPU, 2 GiB address space, 256 MiB output file, no core dumps.
  The caller (M5-02) owns wall-clock timeouts and cancellation. Socket
  connect/bind/send/resolve are disabled in-process.

`screenplain-baseline` is Screenplain's own layout, not the frozen M5-03
profile. It makes no fidelity claim; Script Check assessment stays unavailable.

## Pillow

ReportLab imports `PIL.Image` when it loads but uses it only for images. The
helper ships a two-file stub (`stubs/PIL`) that refuses any image use. The M1
corpus renders byte-identically with the stub and with real Pillow 12.3.0, so
no imaging library or its vendored native code is bundled.
