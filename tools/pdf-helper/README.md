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
Bytecode is forcibly compiled with the fixed `/babel-pdf-helper` source prefix,
so checkout locations and upstream bytecode caches cannot change that identity.
`python3 tools/pdf-helper/test_build.py` verifies two different build paths
against the same offline inputs and compares their complete manifests.
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
  renderer versions, font hashes, `profile`, `profileFrozen` (true for the frozen profile),
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

## Frozen draft profile (M5-03)

`us-letter-draft-v1` is the default native/frontend profile, with
`profileFrozen: true`. The baseline stays available for M1/M5-01 regressions.
[ADR 0037](../../docs/decisions/0037-us-letter-draft-profile.md) freezes geometry,
continuation, grouping, title numbering, the bounded patch boundary and declared
unsupported cases. Complete SC005/SC008 assessment remains M5-04.

The [synthetic corpus and reviewed goldens](../../fixtures/publication/REVIEW.md)
use an inspection-only pypdf dependency plus Poppler, never a runtime dependency:

```sh
python3 -m venv /tmp/babel-profile-inspect
/tmp/babel-profile-inspect/bin/pip install -r tools/pdf-helper/requirements-test.txt
/tmp/babel-profile-inspect/bin/python tools/pdf-helper/test_profile.py --output target/profile-check-new
```

Choose a fresh output directory; `--candidates` cannot update accepted goldens.
Set `BABEL_PDF_HELPER_RUNTIME` to verify the same corpus against a packaged copy.

## Pillow

ReportLab imports `PIL.Image` when it loads but uses it only for images. The
helper ships a two-file stub (`stubs/PIL`) that refuses any image use. The M1
corpus renders byte-identically with the stub and with real Pillow 12.3.0, so
no imaging library or its vendored native code is bundled.

## Native caller (M5-02)

`src-tauri/src/publication_host.rs` resolves the bundled resource and dispatches
captured source bytes through protocol 1. `render_publication` admits only an
owned document/session, positive exact version/request ID, SHA-256, `us-letter-draft-v1`
profile, `courier-prime-screenplain-0.12.0` and empty options. Native and frontend
checks reject stale versions and conflicting hashes. `cancel_publication` takes
only identity/request ID; an old cancel cannot delete a newer artifact.

The native service owns output paths in its private leased app cache. IPC
returns an opaque `render-…` handle, actual count, exact capture identity,
renderer/font identities and warnings, with `profileFrozen: true` and
`sourceMap: unsupported`. It supplies no fidelity or Script Check assessment.
One helper plus one replaceable pending capture share bounded admission; stdin
has its own thread, stdout is capped at 64 KiB and wall time at 70 s. Typed
failures include unavailable renderer, queue full, invalid capture/identity,
stale version, cancellation, timeout, helper kill/crash, invalid response,
cache failure and each protocol error code. No source is logged.

[ADR 0036](../../docs/decisions/0036-bundled-pdf-helper.md#m5-02-caller-integrity-and-lifecycle-policy)
records the inexpensive manifest/executable check, process-group cleanup and
cache lease/bounds. Native synthetic smoke:
`python3 tests/native/writing-lifecycle/publication_smoke.py /tmp` (repeat with
`target/` on Btrfs, with GUI environment/access); it exercises the default
release's real WebView IPC without editor/persistence/export UI changes.
