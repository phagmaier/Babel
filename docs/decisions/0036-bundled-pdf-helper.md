# ADR 0036: Bundle the PDF renderer as a standalone-CPython helper

Status: **Accepted direction**
Date: 2026-10-02. Task: [M5-01](../tasks/M5-01.md).
Sources: SPEC S01 (no assumed end-user Python/Node), S12.1–2; [ADR 0009](0009-pdf-renderer-baseline.md).

## Context

ADR 0009 kept Screenplain + ReportLab + Courier Prime as the M5 baseline, on the
condition that end users never need a system Python. The owner delegated the
packaging choice. The helper must run offline, take no shell or path authority
beyond its output file, and be reproducible from pinned inputs.

## Decision

Ship a helper directory as a Tauri resource (`pdf-helper/`), built by
`tools/pdf-helper/build.py` from SHA-256-pinned inputs:

- **Interpreter:** python-build-standalone CPython 3.13.16 (release 20261001),
  `install_only_stripped`. Its executable is statically linked against only
  glibc. The build keeps `bin/python3.13` and a trimmed stdlib, and drops
  `libpython`, Tcl/Tk, headers, terminfo, pip and dev/GUI/test modules.
- **Libraries:** pure wheels unzipped directly (no pip, no compilation):
  Screenplain 0.12.0 with its Courier Prime fonts, ReportLab 4.4.7,
  charset-normalizer 3.5.1. Bytecode is precompiled by the bundled interpreter
  as unchecked-hash `.pyc`, so runtime `-B` writes nothing.
- **Pillow:** replaced by a refusing two-file stub. ReportLab imports it but
  never uses it for text, and the M1 corpus renders byte-identically either way.
- **Execution:** `python3.13 -I -S -B babel_pdf_helper.py <request-json>` with
  source bytes on stdin. The output is created exclusively, there are rlimits
  (CPU, memory, file size, no core), sockets are disabled in-process, and
  results and errors come back as typed JSON. ReportLab invariant mode makes
  identical inputs give identical bytes.
- **Integration:** `bundle.resources` maps `target/pdf-helper/runtime/`.
  `src-tauri/build.rs` creates that directory, so plain `cargo` checks work
  without the helper: an empty directory is skipped, and the app must then
  report the renderer unavailable. `beforeBuildCommand` builds the helper for
  every packaged or release build.

## Alternatives

- **PyInstaller onefile/onedir:** the output depends on the build host's
  Python. Onefile extracts to `/tmp` at runtime, and its bootloader adds a
  license and a packaging layer. Not needed with a relocatable interpreter.
- **Nuitka/compiled Python:** heavier toolchain and build time for no
  functional gain.
- **System Python:** violates SPEC S01.
- **pdf-lib fallback (ADR 0009):** needs a from-scratch paginator. Not
  revived, because the bundle passed its platform, license and conformance gates.

## Consequences

- AppImage grows from 99.44 to 118.94 MiB (+19.5 MiB); the runtime is 60.6 MB
  uncompressed in 1,473 files.
- Builds need `python3` (3.12 or newer, for `tarfile` data filters) and
  network access once to fill the artifact cache.
- linuxdeploy rewrites loader metadata of ELF files under `usr/lib`. Only the
  interpreter is affected. `verify_runtime.py` accepts that only when its code
  and data sections match `BUILD.json`.
- OpenSSL and other components are statically linked into the interpreter, so
  they cannot be trimmed. The readline backend is editline (BSD); no GPL
  component was found. The inventory lists the expected licenses.

Evidence: [M5 evidence](../test-evidence/M5.md#m5-01--bundled-offline-renderer-helper).
Evidence still needed: full license texts for the statically linked components
before distribution (M6); other platforms' interpreters and installers; the
runtime locating, wall-clock timeout and integrity checks in M5-02.
