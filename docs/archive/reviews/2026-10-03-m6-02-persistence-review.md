# M6-02 bounded Linux persistence review

Base: `ccf9fb5`, main. [Evidence](../../test-evidence/M6.md#m6-02--persistence-interruption-and-operation-investigation),
[stage matrix](../../test-evidence/M6-02-matrix.md), [follow-up](../tasks/M6-02-R1.md).
This is a separate source/contract review pass by the same editing agent.
M6-02 remains unchecked; no Local v1, cross-platform or shutdown admission.

## Source and contract assessment

The save-request wrapper still checks queue admission, enqueues the exact
identity/version/hash/fingerprint request and consumes that request through the
same source adapter. Its default gate remains a no-op. Restore retains its
checkpoint, live/disk snapshots and history safety revision before the same
save-request path. The private closure only permits existing deterministic test
stages to stop the actual restore child. There is no schema, IPC/environment
runtime hook, native capability, receipt ordering or dependency change.

Actual restore SIGKILL verifies literal original disk, unsaved live and selected
replacement snapshots after restart. Source/recovery child barriers now include
pre-temp/pre-publication and pre-replacement stages. Whole literal bytes and
verified fingerprints supplement the existing partial-write/sync/ENOSPC,
unknown-schema, pending/corrupt material, version/ownership and history failures.
Injected ENOSPC/sync and real process kill remain different evidence classes.

Save As error reporting identifies adoption versus old-registration release and
keeps the underlying bounded cause; it does not advance receipts. Mocked errors
and the real editor rollback regression verify immutable original source,
identity, selection and Undo; a later Save binds to the restored identity. Native
success must save a later edit to the copy and Undo it with the divergent
original unchanged. A standalone copy is never adoption success. Readiness
snapshots capture Save/editability, current outline/filter and trusted events;
no stale readiness predicate is weakened and composition is never synthesized.

Native path-loss and shared-store two-app controls use only synthetic owned
roots/apps. The former refuses missing/renamed/unavailable paths and verifies
recovery, emergency close and copy adoption. The latter parks the first writer,
refuses second-app edits, closes it normally and proves the first still saves.
The independent auditor exposed and prompted correction of an initially
ambiguous recovery-identity lookup; its final lookup is document-bound. The
secondary ordinary-exit observer now reads the same tracked stderr inode.
All earlier failed runs remain failed with their artifacts intact.

## Retained findings and stopping

The distinct-store diagnostic actually opens a writable second editor; this
matches the explicitly recorded shared-store cooperating-lease limit in
[ADR 0012](../../decisions/0012-native-document-identity.md). No source edit was
performed in that second app. It is not normal shared-store ownership proof or
permission to expand the ownership policy. A future independent-root lock
strategy requires a bounded policy/adapter brief rather than an implicit fix.

The untouched M6-01 Save As refusal and IME readiness stalls did not reproduce
in the clean stronger-oracle samples. No functional cause or fix is established.
[M6-02-R1](../tasks/M6-02-R1.md) records the dependency-ordered investigation
before the M6-02 checkbox or M6-03. The new diagnostic messages are useful on
a future refusal, not retrospective proof of which stage failed historically.

A fresh Btrfs parent-kill/restart sample recorded owned WebKitWebProcess SIGABRT
with `corrupted double-linked list` before stale-session deletion. Exact source,
copy and acknowledged recovery heads survive, but that strict case fails; its
compressed core and provenance remain under `target/m6-02/`. Later clean restart
or ordinary-close samples do not resolve C1/F2, and no crash has been filtered.

Parent rename simulates path loss; real unmount, physical power loss,
storage/controller/antivirus/sync-product and non-Linux semantics are untested.
No installed/package, full S13, screenreader, owner-pilot or migration claim.
Bounded hardening/checks are recorded; retained operation disposition and
C1/F2/Local v1 gates remain open. Stop before M6-03, tags and pushes.
