# Current state — AUDIT-W0-R1 in progress; D08A done

Date: 2026-10-03. Application: **babel**. Main; owner authorized warranted push.
Current task base `e284a33`, clean main/origin at claim. M0–M5 and bounded M6-01
investigation remain recorded complete. **M6-02 stays unchecked; retained
operation findings, C1/F2 and Local v1 admission remain open.**

## Task and work

**AUDIT-W0-R1 claimed** at clean `e284a33`, owner continuation after the pushed
D08A CI failure. [Brief](tasks/AUDIT-W0-R1.md). Deliverable: require Enchant >=2.4,
provision pinned 2.8.21/Hunspell in CI's temporary prefix, preserve explicit empty
PWL isolation, and verify the actual workflow. Build script/manifests, CI script
and workflow, existing ADR/development prerequisites; no application ABI fallback.
Checks: old 2.3.3 metadata refusal, real contaminated-profile/empty-PWL controls,
focused native spelling 3/3 and clippy/fmt pass; frontend full rerun 844/844,
browser pass; workspace 275/275 each tmpfs/Btrfs. Initial frontend focus failure
retained, focused rerun 4/4. Default release/package and named offline spelling
drill 2/2 strict pass; actual pushed CI pending. Native harness now performs the
missing final protected document close; failed launches/manual-input-era
attempt/Home teardown failures remain in evidence and raw artifacts. No native
assertion relaxed. Implementation `7d45253` pushed; first corrected CI finds missing
groff HTML device files during Enchant's manual build. Add the full runner `groff`
package and verify the next actual run; no app source changed by that follow-up.
[Evidence](test-evidence/AUDIT.md#audit-w0-r1--enchant-ci-abi-prerequisite).
Stop at W0-R1; C356 remains unstarted.

Prior M6-02 bounded Linux hardening: stage-qualified Save As refusal/identity and
Undo rollback; extended real child-kill source/recovery/local-restore boundaries;
actual path-loss/shared-store two-app drills and independent literal/head auditor.
No demonstrated cause/correction for untouched M6-01 operations is claimed.
[Brief](tasks/M6-02.md), [S15.2 matrix](test-evidence/M6-02-matrix.md),
[review](reviews/2026-10-03-m6-02-persistence-review.md),
[checks/failures/artifacts](test-evidence/M6.md#m6-02--persistence-interruption-and-operation-investigation).

Retained M6-02 failures: separate-store read-only expectations conflict with
ADR 0012's cooperating shared-store lease scope; a Btrfs restart completed
content checks but recorded an owned WebKit SIGABRT following parent SIGKILL.
PID `274428`/start `2737907` and cores/provenance remain under `target/m6-02/`.
Harness-log-path errors and named corrected reruns are preserved in evidence.
Neither intact bytes nor later clean samples closes C1/F2. Rename path-loss is
not actual unmount/power/controller/antivirus/sync-product acceptance. M6-01
failed roots/binaries/cores remain untouched; stronger Save As/IME samples did
not reproduce their symptoms, so causes stay open.

## Docs maintenance (2026-10-03, Tier 1, no behavior change)

Owner-authorized Tier 1 debloat (`433c150`): tracker collapse, index stub, stale S-14 refs and tracked link/matrix tools; frozen audit/evidence retained. Formatting, 172 changed links, Python compilation and diff passed; five frozen M4 links remain intentionally untouched. Details are committed; no behavior gate credited.

## Audit execution (2026-10-03, `AUDIT.md` frozen)

Tracker: `TODO.md` `## Audit execution`; [audit evidence](test-evidence/AUDIT.md).

[AUDIT-W0](tasks/AUDIT-W0.md) done (`004bd6d`): CI dependencies/helper, rlib-only desktop and S-13 cleanup. Original local Tier 2 pass; first pushed D08A CI fails on Ubuntu's Enchant 2.3.3 missing empty-PWL symbol. W0-R1 above owns correction and actual workflow verification.

[AUDIT-C01](tasks/AUDIT-C01.md) done (`fe103bf`): unforced-neighbour capture, split/join refusals and edge-space emphasis. Tier 2, mocked/JSDOM only. D01 now covers its mid-speech Enter exclusion; arbitrary dual regroup/protected-neighbour shapes and the draft-bundle fallback remain outside that fix.

[AUDIT-C04](tasks/AUDIT-C04.md) done (`bc1476e`): identical-byte source save acknowledges without replacement. Tier 3 matrix 268/268 each and lifecycle drill 7/7 each tmpfs/Btrfs. Retained: one Btrfs publication-cache `CacheUnavailable` failure, not reproduced in 7 reruns, cause unknown; no native drill asserts WebView click end to end.

[AUDIT-D01](tasks/AUDIT-D01.md) done (`2bc2311`): portable Enter separators and attached continuing speech, Shift+Enter/dual deferred codec capture, empty virtual cues, boundary Undo; SPEC S07.2 and tests updated together. C01 speech exclusion removed; other protected/dual shapes and schema rewrite remain deferred. [Evidence](test-evidence/AUDIT.md#audit-d01--portable-enter-separators-and-explicit-speechbreak-authoring): focused 262/262, frontend 835/835, Rust 268/268, shared static/build/browser checks pass. Editor evidence remains mocked/JSDOM, generic Chromium smoke; no native editor/independent scene/PDF oracle or frontend-only Tier 3 matrix. Failures/reruns retained in evidence.

[AUDIT-D08A](tasks/AUDIT-D08A.md) done (base `2bc2311`, main): native focus/five-second source checks, receipt-free identical-byte metadata re-anchoring, lazy draft/disk comparison, Keep editing and separate-copy routes, explicit protected Reload as one Undo-able import. Native handle-only adoption protects the old draft in checkpoint/snapshot/safety revision, journals the adopted version and syncs/rechecks disk without replacing it. Failed Reload skips its reserved version and independently protects the retained draft; exact-version retries retain their immutable recovery base. [ADR 0041](decisions/0041-protected-external-reload.md).

Paths: `reload.rs`/`reload_store.rs`, source/recovery retry base helper, `reload_host.rs`, session/controller, native adapter, WritingView/SourceComparison, commands and tests; focused production `external_reload.py` mode. Tier 3: final workspace 275/275 each tmpfs/Btrfs; actual default-WebKit Reload 2/2 strict plus exact journal-window crash replay 2/2. Clean/dirty adoption, literal safety copies/revisions, disk inode, Undo/later Save, Keep editing and protected close verified. Shared frontend/static/default release/browser checks and failures are linked in [audit evidence](test-evidence/AUDIT.md#audit-d08a--protected-external-reload). First native recovery-base bug and hidden-Undo harness failure retained; build/matrix helper-runtime overlap failure retained. These clean samples do not close prior C1/F2 or universal target/storage/sync-folder acceptance.

## Next action and blockers

Current task: `AUDIT-W0-R1`, then stop. Next Wave 1 cluster remains `AUDIT-C356` (draft brief first). D-06 remains a later separate brief. Owner permits a warranted push to existing origin/main so CI can run; CI status must be read from its pushed run, never inferred from local results. Capture-failure draft-bundle fallback remains an owner decision (ADR + Tier 3). [M6-02-R1](tasks/M6-02-R1.md) remains behind audit Waves 0–1; C1/F2 unchanged.

[Supported-runtime M6-01-R1](tasks/M6-01-R1.md) remains gated by an available
identified supported correction. C1/F2 release gate C remains open before
M6-14/16. Real storage interruption limits, full S13, security/notices,
target-native/screenreader/installed/manual update, backup/migration/owner pilot
and Local v1 admission remain later gates. DEV-02 is owner-only. No M7,
private-engine shipping, personal manuscript/credential/upload work.
