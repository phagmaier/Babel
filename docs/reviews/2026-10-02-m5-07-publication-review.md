# M5-07 integrated publication separate safety review

Date: 2026-10-02 PDT. Base `be92b96`, main. One editing agent performed this
separate source/contract pass and independent viewer inspection. This is
**not a second-reviewer or human sign-off claim**.
[Task](../tasks/M5-07.md), [evidence](../test-evidence/M5.md#m5-07--integrated-publication-exit-and-separate-review),
[profile](../decisions/0037-us-letter-draft-profile.md),
[preview](../decisions/0038-offline-pdf-viewer.md),
[export](../decisions/0039-pdf-export-publication.md).

Decision: **M5-07 and M5 accepted for the bounded Linux publication gate.** F1
is corrected and final extracted-AppRun offline/native tmpfs/Btrfs scenarios
pass with both functional and bounded crash audits. Shared gates and unchanged
corpus/two-viewer evidence pass. Initial failures/crashes remain recorded; no
required failure remains unresolved within this scope.

## Findings

- **F1 — focus return during Save:** the preview could close while Save disabled
  its toolbar button. Immediate `focus()` was ignored and later enabling did not
  restore focus. `WritingView` now waits for the enabled DOM commit and respects
  a newer writer focus choice. The regression failed before correction and both
  focus-return/newer-choice branches pass after it. The native oracle holds an
  actual Save acknowledgment, closes preview while the toolbar is disabled, then
  releases it and requires focus return. No persistence/content/Undo change.
- **H1 — invalid package isolation:** initial controls exposed a missing mount
  destination, read-only device/proc setup, separated driver/app network, UID 0
  authentication mismatch and inherited namespace capabilities. They retain a
  real JSC startup SIGSEGV and GTK SVG-loader SIGABRTs, timeout/survivor evidence
  and all crash scans. A nested-bubblewrap control independently reproduced
  `setting up uid map: Read-only file system`; a proper proc mount passes it.
  Final isolation preserves UID 1000, enables only loopback then drops namespace
  capabilities, exposes normal devices/proc and masks development runtimes only
  in the app. No Glycin/WebKit sandbox, product security check or crash oracle
  was disabled. The non-isolated packaged control passed the full scenario.

## Separate source and contract pass

- **Author content and protected replacement:** `writingSession.captureForPdf`
  freezes only capture/checkpoint protection, validates exact identity/version/
  source hash, then thaws. It credits recovery, never source saving. The export
  service retains immutable checkpoint bytes through later typing/Save.
  `pdf_store.rs` rejects protected source/app-data/history paths and inode aliases,
  unsafe metadata and changed parent/destination generations. Single-use native
  target authority is spent on failure too. Verified/synced candidate and prior
  copy precede NOREPLACE/EXCHANGE; post-install read-back binds bytes and inode.
  Guarded rollback refuses to overwrite unrelated concurrent generations, retains
  uncertain candidates and reports attention. Previous PDFs are never pruned.
- **Stale versions and races:** export serial/liveness checks cover late capture,
  assessment, picker and render replies. Cleanup finishes before re-entry.
  `publicationPreview.ts` invalidates render/read/display separately, checks
  current manuscript stamp, and confirms parsed count before declaring freshness.
  Preview/export share one request sequence/queue. Native artifact registry binds
  capture token, identity, request, exact source and output hash; admission/cancel
  cannot replace the artifact while the final native publication lock is held.
  That brief final phase is explicitly non-cancellable. No guessed count.
- **Helper privilege and egress:** interpreter/script/output paths are native
  resource/cache paths, source travels on stdin, execution uses an argument vector
  and isolated process group. No caller path, shell command or arbitrary PDF bytes
  enter export IPC. Strict envelopes/bounds, 70-second deadline, stdout cap,
  resource/font/profile provenance and private artifact-read checks remain.
  The assessment probe denies writes, sockets and subprocesses; the renderer
  denies socket operations and bounds CPU/memory/output. Release CSP and local
  PDF.js worker permit no upload or remote font/worker dependency. The helper
  runs as the user; Python guards are not an OS sandbox. Package isolation is
  test evidence, not a newly claimed production security boundary.
- **Lossy rendering and unsupported cases:** the primary codec reports SC005
  omissions and SC008 glyph/shaping/layout limitations for the captured version.
  Missing/mismatched/truncated assessment refuses progress. Review acknowledgment
  can permit declared omissions; actual glyph/layout refusal still cannot publish.
  Source bytes and Save remain intact. Frozen corpus assertions cover literal text
  order, Letter geometry, selected word/text coordinates, bounds, continuation,
  title numbering, emphasis and intended embedded faces. Both Poppler and
  Ghostscript pages were visually inspected; no clipped/overlapped content,
  stranded cues, lost supported rows or marker leaks were found. No golden changed.
- **Failure coverage and contract drift:** shared contracts retain stale
  render/read/display, incorrect receipts, unavailable assessment and cancellation
  at each pre-publication phase. Native fault groups cover six publication stages,
  concurrent changes, protected/unsafe paths, renamed parents, token ownership,
  cancel and replay. The integrated native scenario adds same-capture layout/raster
  agreement and composes real GTK/helper refusal/cancel/replacement plus typing/
  Save and delayed actual replies, including F1. Its cancellation oracle now independently
  preserves pre-existing PDFs instead of assuming an empty folder. SPEC S12.5/6,
  M5 exit and ADR 0039 agree; no contract or production privilege was weakened.

## Retained limits

The gate covers the reference Linux package and frozen US Letter corpus, with
explicitly acknowledged omissions and strict unsupported-case refusals. A4,
editor page markers, other-platform installation and Tier 1 declaration remain
outside M5. Extracted AppRun export does not establish FUSE launch/desktop
registration or owner adoption. The full compositor/page-calibrated/long-session
S13 gate remains open; rAF observations are bounded proxies. Existing M4 C1/F2
forced-kill/automation shutdown and transitive dependency/license hardening,
signed package/runtime trust, retention UX, broader interruption/power loss,
backup/migration and Local v1 adoption remain M6 obligations. No push/upload.
