# ADR 0039 — Captured PDF export and protected replacement

Status: Accepted; bounded Linux implementation and native gate passed.
Date: 2026-10-02. [M5-06](../tasks/M5-06.md), PDF-01/02/04, INV-03/06/10/14.

Export first checkpoints a frozen exact capture and receives a native opaque
capture token. Editing then resumes while assessment, informed review and
rendering operate on those captured bytes. Review always names the captured
version and includes structural warnings and SC005/SC008 limitations. Missing,
incomplete or unverified assessments refuse export. Explicit acknowledgement
permits known renderer omissions; the frozen renderer still refuses unsupported
glyphs/shaping/layout. Save and raw source preservation remain independent.

Preview and export share the existing PublicationController request sequence,
native render queue and pinned pipeline. Preview work is suspended during export;
typing invalidates preview freshness without cancelling the captured export.
Native artifacts bind the export capture token. Cancellation retires capture
and destination tokens; late picker/render replies cannot authorize publication.
The final atomic publication phase is non-cancellable and is labelled accordingly.

A separate single-use native PDF destination token holds a no-symlink directory
anchor and the selected destination generation. Only `.pdf` names and existing
regular owned PDFs are eligible. App-data, `.screenwriter`, reserved `.babel-`
names, any registered source path/inode, symlinks, hardlinks and unusual metadata
are refused. Native publication rechecks identity, directory, generation and
protected paths; frontend paths and arbitrary output bytes are never accepted.

A verified 0600 same-directory candidate is synced before installation. New
paths use NOREPLACE; existing paths use atomic EXCHANGE, retaining the displaced
file. Before replacement an independently verified/synced `.previous.pdf` copy
protects the old PDF. Post-install failures attempt guarded rollback; uncertain
rollback preserves all candidates and reports attention, never success. Verified
publication receipts name captured source version/hash, actual pages and PDF hash.
Prior PDF copies and crash candidates are not auto-pruned or auto-promoted.
This Linux policy adds no source identity, source-file/history mutation or upload;
the initial safe checkpoint protects recovery independently of PDF publication.

Alternatives: exclusive-only publication cannot replace a selected PDF; plain
rename discards the prior generation; a separate renderer risks preview/export
drift. Other-platform publication and cleanup/retention UX remain later work.

Evidence: [M5-06](../test-evidence/M5.md#m5-06--captured-pdf-export) passes headless
fault/matrix/contracts and default-release native picker/review/cancel/failure
drills on tmpfs/Btrfs. The owner resumed desktop testing before those drills.
[M5-07](../test-evidence/M5.md#m5-07--integrated-publication-exit-and-separate-review)
passes integrated/offline extracted-AppRun native tmpfs/Btrfs publication gates.
Evidence still needed: other platforms and installed adoption; retention/cleanup
UX and broader interruption/power-loss hardening remain later work.
