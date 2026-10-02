# Current state — M5-05 complete

Date: 2026-10-02. Application: **babel**. Admission base `666c168` on clean main.
Owner requested M5-05 continuation; completed directly on main, no push.

## Task and work

**M5-05 authoritative preview and page-count freshness — complete, bounded Linux gate.**
Writing now offers read-only PDF preview and versioned page-count status. Pinned
PDF.js 6.3.289 loads lazily with an explicit bundled local worker; it displays
actual native renderer bytes and checks parsed count against that exact receipt
before announcing freshness. One page canvas, selectable extracted page text,
keyboard Previous/Next/Close/Escape, independent zoom and white printed paper
in light/dark chrome. Renderer limitations remain visible.

A narrow binary IPC read accepts only identity/request/opaque artifact IDs,
checks the current native registry under its publication lock and bounds reads
to 32 MiB. No caller filesystem path, arbitrary imported PDF, URL or upload.
Existing deferred captures feed a 750 ms quiet-period job while preview is open.
Editor version changes, Undo/source/session replacement invalidate immediately;
late/superseded render/read/display callbacks cannot earn freshness. Old pages
stay explicitly stale. Closing clears count/cancels work/destroys workers.
Failures keep editing, Save, source bytes and Undo independently owned.

Paths: `src/application/publicationPreview.ts`, `src/app/PublicationPreview.tsx`,
`src/infrastructure/localPdfViewer.ts`, native adapter and writing wiring;
`src-tauri/src/publication_host.rs`, registration/CSP; focused/UI/native/browser
checks, direct viewer license and owning docs.
[Brief](tasks/M5-05.md), [ADR 0038](decisions/0038-offline-pdf-viewer.md),
[contract](pdf-and-formatting.md#authoritative-preview-m5-05),
[evidence](test-evidence/M5.md#m5-05--authoritative-preview-and-page-count-freshness).
Logs/timings/host/matrix: `target/m5-05/`; GUI roots/retained failures in evidence.

## Checks and limits

Final `pnpm check` passes 745 frontend/JSDOM tests, formatting/lint/typecheck/build;
18 focused freshness/viewer tests pass. Rust fmt/clippy and all 248 workspace
tests pass on tmpfs and Btrfs. Chromium smoke displays a real frozen-helper PDF
in a local worker. Default embedded release passes actual WebKit worker/canvas/
text/native/Poppler count agreement, theme/zoom/keyboard focus, delayed real IPC
stale reply, actual glyph renderer refusal and exact BOM/CRLF/Save/protected-close
checks on both filesystems. Both actual page screenshots visually reviewed.
Helper/profile/font identity remains unchanged; no export publication.

Unchanged M4 2,400-row/120-key source/control audits pass, with preview refreshed
to 89 actual pages at version 122. Key-to-rAF p95/max: preview-open tmpfs 79/85 ms,
Btrfs 17/41 ms; contemporary closed tmpfs control 94/199 ms (six >100 ms).
Compared with M4 49/59 and 56/61 ms, host/run variability prevents a causal
regression or full S13 claim. rAF is not compositor paint. Existing full latency,
long-session, IME/platform, M6 hardening/license/adoption limits stay open.

Initial type/API/lint and native harness failures are retained with passing
corrections. No new AppImage/installation/offline-package, broad M4 matrix,
other-platform, integrated preview/export or Local v1 claim. DEV-01 setup
remains ready; `/tmp` native input helpers must be rebuilt after reboot.

## Next action

**M5-06 Export PDF workflow** is dependency-ready. Read its brief before work:
explicit support decisions, native destination token, atomic publication and
exact exported version. M5-07 owns integrated publication/offline-package exit.
Stop after M5-05. No push is authorized.
