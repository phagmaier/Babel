# ADR 0036: Bundle the PDF renderer as a standalone-CPython helper

Status: **Accepted direction**
Date: 2026-10-02. Task: [M5-01](../archive/tasks/M5-01.md).
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
before distribution (M6); other platforms' interpreters/installers and
installed/offline verification. M5-02 caller evidence is
[recorded separately](../test-evidence/M5.md#m5-02--native-render-service-and-adapter-contract).

## M5-02 caller integrity and lifecycle policy

The native caller resolves `pdf-helper/` using Tauri's resource resolver. Each
render reads at most 1 MiB of `BUILD.json`, requires protocol 1 and the pinned
tree identity, checks the interpreter is a regular executable and that the
helper script exists. It does **not** rehash the 60 MB runtime per render.
Build/package verification owns whole-tree integrity; the helper verifies font
bytes each invocation. This is a bundled-resource policy, not authentication
of a hostile mutable installation; distribution hardening remains M6.

One drain worker runs one isolated helper process group, with one replaceable
pending capture. Admission shares the native eight-job/32 MiB payload budget.
The caller writes stdin on a separate thread, caps stdout at 64 KiB, enforces
70 s wall time (helper CPU limit 60 s), kills/reaps the group on cancellation,
timeout or exit, and checks exact source/profile/renderer/font results.
Linux/Unix process-group termination and the private cache lease promote the
already-locked `libc` 0.2.189 (MIT OR Apache-2.0) to a direct pinned dependency;
there is no dependency version change.

The private app-cache `publication/` directory is exclusively leased with a
native nonblocking lock. A second instance refuses cache initialization rather
than removing the active instance's files. Under that lease, startup removes
abandoned regular `render-*.pdf` files and refuses unexpected entries. One
artifact/output is retained, bounded to 256 MiB by the pinned helper's output
limit and native result checks. Supersede, cancel and registration/window close
remove artifacts. A cleanup failure disables further cache admission. Handles
are opaque; no frontend path, shell, filesystem permission or save receipt is
introduced. Only `screenplain-baseline`, empty options and its pinned font set
are admitted; `profileFrozen: false` and `sourceMap: unsupported` remain visible.

M5-03 changes native admission to frozen `us-letter-draft-v1` and
`profileFrozen: true`; [ADR 0037](0037-us-letter-draft-profile.md) records the
profile and additional small patch-boundary checks. The native tree pin updates
to include that patch/profile. Cache/process ownership is unchanged.
