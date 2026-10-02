# Current state — M5-06 complete

Date: 2026-10-02. Application: **babel**. Admission `e6e6f1d` on clean main.
Work directly on main; no push. M5-05 remains complete at `e6e6f1d`.

## Task and work

**M5-06 Export PDF workflow — complete, bounded Linux gate.** Export PDF now
uses the shared palette/native menu/remappable command registry. A brief freeze
protects an exact source capture in recovery and mints a native capture token.
Review reports that version, structural warnings and verified SC005/SC008 targets.
Explicit acknowledgment permits known omissions; unavailable/truncated assessment
and actual glyph/shaping/layout refusal cannot earn success. Typing and Save
continue while review/rendering use immutable captured bytes.

Preview and export share one request sequence, native queue and pinned pipeline.
Preview is explicitly stale during export and resumes the latest projection
afterward. Late render/picker/cancel replies cannot authorize publication.
Cleanup completes before another export may start. Native destination selection
returns a separate single-use token; no frontend path/output-byte authority.
Source/app-data/history/open-document aliases, unsafe metadata and changed
directory/destination generations are refused. Atomic NOREPLACE/EXCHANGE follows
verified candidate and prior-PDF protection; exact read-back receipts report
captured version/hash, actual pages, PDF hash and destination filename.
Uncertain rollback retains generations and reports attention. Cancel writes
nothing before publication; the final atomic phase explicitly disables Cancel.

Paths: core `documents/pdf*`, native `pdf_export_host.rs` and artifact registry,
`exportPdf.ts`, shared publication/preview/session controllers, export panel,
command/native ports and writing wiring; contract/UI/native filesystem/GTK drills.
[Brief](tasks/M5-06.md), [ADR 0039](decisions/0039-pdf-export-publication.md),
[contract](pdf-and-formatting.md#captured-pdf-export-m5-06),
[evidence](test-evidence/M5.md#m5-06--captured-pdf-export).

## Checks and limits

`pnpm check` passes 765 frontend tests and formatting/lint/typecheck/build.
Rust fmt/clippy and all 257 workspace tests pass on tmpfs and Btrfs. Chromium
smoke uses real frozen-helper bytes/local PDF.js worker. Default-release native
WebKit/GTK/Poppler drills pass on both filesystems: palette/toolbar export,
informed omissions, strict glyph refusal, cancellation, capture during typing/
Save, fresh preview resumption, previous PDF retention, source/app-data refusal,
permission failure, exact BOM/CRLF Save and protected close. Actual PDF body and
review screenshots visually checked. Logs/timings/roots in `target/m5-06/` and
the linked evidence; initial failed gates and corrections are retained honestly.

Owner initially prohibited desktop takeover, then explicitly resumed testing.
All interactive drills started after that authorization. Python notifications
were intentional SIGABRT from a synthetic helper-crash test. Only that child
now disables dump generation; real crash/error coverage still passes. No system
notification/core policy or production-helper setting changed, no new Python
core journal records after correction. No user manuscript or credentials used.

Previous PDFs/crash candidates are retained, never auto-promoted/pruned. No
new dependencies, renderer/font/profile change, source-file/Undo/history mutation
or upload. Other-platform, integrated/offline-package/two-viewer, full compositor/
long-session, license/adoption and broader retention/power-loss work remain open.
M5-05 host timing variability and existing M4/M6 limits remain unchanged.

## Next action

**M5-07 Integrated publication exit and separate review** is dependency-ready.
Read its brief before work; perform the full integrated/offline-package and
independent review gates. Stop after M5-06. No push is authorized.
