# Current state — AUDIT-SLP-C complete; stopped

Date: 2026-10-03. Application: **babel**. Main; local commit only, no push.
M0–M5 and bounded M6-01 investigation remain recorded complete. **M6-02 stays
unchecked; operation findings, C1/F2 and Local v1 admission remain open.**

## Task and work

**AUDIT-SLP-C complete**, base `186ea59`, main. [Brief](tasks/AUDIT-SLP-C.md).
Deleted unused inline/hidden edit APIs, conversion proposal/acceptance/type/error
and conversion/mixed-hidden bypass flags. Ported supported edits to guarded live
EditorState/capture, title action and complete known context; retained independent
parser samples and raw/mixed/malformed protection tests. Added exact Undo/Redo
checks and pinned the rich sample's 112 successes/16 round-trip refusals; baseline
codec replay confirms unchanged live behavior. D01 keep-set and 168 retained files
byte-identical. Tier 2: frontend 863/863, focused 275/275,
Rust workspace 261/261 (tmpfs), baseline-live 49/49; renderer/browser/static pass.
[Audit evidence](test-evidence/AUDIT.md#audit-slp-c--unused-complex-codec-edit-apis)
owns exploratory assertion failures, commands/timing and injected/JSDOM limits.
No new native/IME/package/SELinux/C1/F2/admission claim. Local commit only;
stopped before AUDIT-SIMP-N.

**AUDIT-SLP-B complete** (`186ea59`, local; base `d463656`).
[Brief](tasks/AUDIT-SLP-B.md), [evidence/failures](test-evidence/AUDIT.md#audit-slp-b--retired-prototype-proofs-with-production-coverage).
Retired superseded composition/native/PDF/snapshot/codec/replacement proofs after
production coverage ports; retained fixtures/backend/renderer/history-store.
Frontend 862/862, workspace 261/261 each tmpfs/Btrfs; five faults detected.
Initial strict native 1/2: owned Btrfs WebKit SIGSEGV (PID `69485`, start `1517917`)
at parent-kill/restart, raw core/ledger retained. Content 2/2, fresh control/replay
strict 2/2 and feature input/protection pass; clean samples do not resolve the
runtime finding or C1/F2. M6-03 independent snapshot copy/prune gap remains.

**AUDIT-SLP-A complete** (`d463656`, local; base `09d496f`).
[Brief](tasks/AUDIT-SLP-A.md), [evidence/failures](test-evidence/AUDIT.md#audit-slp-a--unused-import-read-relink-and-status-paths).
Removed legacy import/read/relink/status surfaces, ported live tests/native
fixture; frontend 919/919, workspace 273/273 each, seven faults detected,
default workflow 2/2 and feature import pass. Native admission unchanged.

**AUDIT-TEST complete** (`09d496f`, local; base `fb7d6bd`).
[Brief](tasks/AUDIT-TEST.md), [evidence/failures](test-evidence/AUDIT.md#audit-test--wave-2-regression-gaps).
66 regressions, cancellation/error preservation; frontend 914/914, 25/25 faults
and workspace 277/277. Injected/JSDOM; native admission unchanged.

**AUDIT-C356 complete** (`614cb8d`, `fb7d6bd`, pushed; both CI runs passed).
[Brief](tasks/AUDIT-C356.md), [checks/failures/limits](test-evidence/AUDIT.md#audit-c356--literal-escapes-selinux-metadata-and-advisory-highlights).
Literal escapes, exact SELinux xattr exemption and independent highlights;
frontend 848/848, matrix 277/277 each, helper 13/13, package escapes 2/2 and
22 unchanged golden pages. Injected SELinux only; enforcing Fedora and native
highlight input remain unverified. Wave 1 boundary respected.

**AUDIT-W0-R1 done** (`7d45253`, groff prerequisite `49129df`): Enchant >=2.4,
pinned 2.8.21/Hunspell CI prefix and empty personal-wordlist isolation, native
spellcheck harness final protected close. [Implementation CI passed](https://github.com/phagmaier/Babel/actions/runs/37157598075);
owner documentation completion `08986eb` [CI passed](https://github.com/phagmaier/Babel/actions/runs/37158997960).
[Brief](tasks/AUDIT-W0-R1.md), [checks/retained failures](test-evidence/AUDIT.md#audit-w0-r1--enchant-ci-abi-prerequisite).

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

## Audit execution (2026-10-03, `AUDIT.md` frozen)

Tracker: `TODO.md` `## Audit execution`; [audit evidence](test-evidence/AUDIT.md).

[AUDIT-W0](tasks/AUDIT-W0.md) done (`004bd6d`): CI dependencies/helper, rlib-only desktop and S-13 cleanup. Original local Tier 2 pass; first pushed D08A CI fails on Ubuntu's Enchant 2.3.3 missing empty-PWL symbol. W0-R1 above owns correction and actual workflow verification.

[AUDIT-C01](tasks/AUDIT-C01.md) done (`fe103bf`): unforced-neighbour capture, split/join refusals and edge-space emphasis. Tier 2, mocked/JSDOM only. D01 now covers its mid-speech Enter exclusion; arbitrary dual regroup/protected-neighbour shapes and the draft-bundle fallback remain outside that fix.

[AUDIT-C04](tasks/AUDIT-C04.md) done (`bc1476e`): identical-byte source save acknowledges without replacement. Tier 3 matrix 268/268 each and lifecycle drill 7/7 each tmpfs/Btrfs. Retained: one Btrfs publication-cache `CacheUnavailable` failure, not reproduced in 7 reruns, cause unknown; no native drill asserts WebView click end to end.

[AUDIT-D01](tasks/AUDIT-D01.md) done (`2bc2311`): portable Enter separators,
speech continuation, Shift+Enter/dual capture and boundary Undo. SPEC S07.2/tests
updated together; other protected shapes/schema deferred.
[Evidence](test-evidence/AUDIT.md#audit-d01--portable-enter-separators-and-explicit-speechbreak-authoring):
focused 262/262, frontend 835/835, Rust 268/268; mocked/JSDOM + browser,
not native editor or independent scene/PDF evidence. Failures retained.

[AUDIT-D08A](tasks/AUDIT-D08A.md) done (base `2bc2311`): handle-only external
checks, receipt-free metadata re-anchoring, protected one-Undo Reload and separate
copy routes. Failed Reload protects the retained draft with a newer version;
exact retries retain the immutable original recovery base. [ADR 0041](decisions/0041-protected-external-reload.md).
Workspace 275/275 each, native Reload 2/2 and crash replay 2/2;
[checks/retained failures](test-evidence/AUDIT.md#audit-d08a--protected-external-reload).
Clean samples do not close C1/F2 or universal storage/sync-folder acceptance.

## Next action and blockers

Completed `AUDIT-SLP-C`; stopped before `AUDIT-SIMP-N`. Next continuation:
draft SIMP-N's bounded brief for X-01 worker helpers, X-05 handler-list dedup,
X-02 test fixtures and the accepted X-03 private-file/directory primitives;
keep audit-refuted shared-save-worker/write-verified proposals out. Tier 3.
SIMP-F and D-06 remain later separate briefs. Capture-failure draft-bundle
fallback remains an owner decision (ADR + Tier 3). [M6-02-R1](tasks/M6-02-R1.md)
remains separate; C1/F2 unchanged.

[Supported-runtime M6-01-R1](tasks/M6-01-R1.md) remains gated by an available
identified supported correction. C1/F2 release gate C remains open before
M6-14/16. Real storage interruption limits, full S13, security/notices,
target-native/screenreader/installed/manual update, backup/migration/owner pilot
and Local v1 admission remain later gates. DEV-02 is owner-only. No M7,
private-engine shipping, personal manuscript/credential/upload work.
