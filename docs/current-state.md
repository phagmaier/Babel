# Current state — AUDIT-SLP-A complete; stopped

Date: 2026-10-03. Application: **babel**. Main; local commit only, no push.
Current task base `09d496f`, clean main, one local commit ahead at claim. M0–M5 and bounded M6-01
investigation remain recorded complete. **M6-02 stays unchecked; retained
operation findings, C1/F2 and Local v1 admission remain open.**

## Task and work

**AUDIT-SLP-A complete**, base `09d496f`, main. [Brief](tasks/AUDIT-SLP-A.md).
S-06 requires the frozen workflow coordinator and removes the legacy adapter,
receipt/command/core wrapper. S-07 removes readInitial/read IPC/host workers;
entry/release dispatch and internal registration checks retain coverage. S-09
removes the approved native-only relink capability; M4-01 locate/confirm remains.
S-10 removes unmounted SaveStatus and checks mounted WritingView facts instead.
Paths: application/view/native/core surfaces, ported tests, native input/workflow
harnesses, tracked mutation runner --slp-a, affected owning docs/ADRs/map.
Tier 3: frontend 919/919; workspace 273/273 each tmpfs/Btrfs; focused 84/84 then
final 60/60 mutation control; 7/7 selected faults detected; shared static/build,
default release/helper, browser, Python, links/diff pass. Default native workflow
2/2, migrated feature import fixture 1/1; bounded native vs injected/JSDOM claims
and retained failures are in [audit evidence](test-evidence/AUDIT.md#audit-slp-a--unused-import-read-relink-and-status-paths).
Native workflow initially omitted its final protected session close; corrected
reruns have ordinary-close attribution. Feature fixture SIGTERM is forced
teardown. No new package/IME/S13/CI, C1/F2, SELinux or admission claim.
Committed locally; stopped before AUDIT-SLP-B.

**AUDIT-TEST complete** (`09d496f`, local; base `fb7d6bd`). [Brief](tasks/AUDIT-TEST.md).
66 regressions and frontend resume cancellation/error preservation; frontend
914/914, focused/control 188/188, 25/25 faults detected, workspace 277/277 and
shared checks passed. Injected-port/JSDOM; no native cleanup/IME/package claim.
[Checks and retained failures](test-evidence/AUDIT.md#audit-test--wave-2-regression-gaps).
Native release retries/duplicate persisted drafts remain separate; Wave 2
boundary preceded SLP-A. No new push/CI claim.

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

## Docs maintenance (2026-10-03, Tier 1, no behavior change)

Owner-authorized Tier 1 debloat (`433c150`): tracker collapse, index stub, stale S-14 refs and tracked link/matrix tools; frozen audit/evidence retained. Formatting, 172 changed links, Python compilation and diff passed; five frozen M4 links remain intentionally untouched. Details are committed; no behavior gate credited.

## Audit execution (2026-10-03, `AUDIT.md` frozen)

Tracker: `TODO.md` `## Audit execution`; [audit evidence](test-evidence/AUDIT.md).

[AUDIT-W0](tasks/AUDIT-W0.md) done (`004bd6d`): CI dependencies/helper, rlib-only desktop and S-13 cleanup. Original local Tier 2 pass; first pushed D08A CI fails on Ubuntu's Enchant 2.3.3 missing empty-PWL symbol. W0-R1 above owns correction and actual workflow verification.

[AUDIT-C01](tasks/AUDIT-C01.md) done (`fe103bf`): unforced-neighbour capture, split/join refusals and edge-space emphasis. Tier 2, mocked/JSDOM only. D01 now covers its mid-speech Enter exclusion; arbitrary dual regroup/protected-neighbour shapes and the draft-bundle fallback remain outside that fix.

[AUDIT-C04](tasks/AUDIT-C04.md) done (`bc1476e`): identical-byte source save acknowledges without replacement. Tier 3 matrix 268/268 each and lifecycle drill 7/7 each tmpfs/Btrfs. Retained: one Btrfs publication-cache `CacheUnavailable` failure, not reproduced in 7 reruns, cause unknown; no native drill asserts WebView click end to end.

[AUDIT-D01](tasks/AUDIT-D01.md) done (`2bc2311`): portable Enter separators and attached continuing speech, Shift+Enter/dual deferred codec capture, empty virtual cues, boundary Undo; SPEC S07.2 and tests updated together. C01 speech exclusion removed; other protected/dual shapes and schema rewrite remain deferred. [Evidence](test-evidence/AUDIT.md#audit-d01--portable-enter-separators-and-explicit-speechbreak-authoring): focused 262/262, frontend 835/835, Rust 268/268, shared static/build/browser checks pass. Editor evidence remains mocked/JSDOM, generic Chromium smoke; no native editor/independent scene/PDF oracle or frontend-only Tier 3 matrix. Failures/reruns retained in evidence.

[AUDIT-D08A](tasks/AUDIT-D08A.md) done (base `2bc2311`): handle-only external
checks, receipt-free metadata re-anchoring, protected one-Undo Reload and separate
copy routes. Failed Reload protects the retained draft with a newer version;
exact retries retain the immutable original recovery base. [ADR 0041](decisions/0041-protected-external-reload.md).
Workspace 275/275 each, native Reload 2/2 and crash replay 2/2;
[checks/retained failures](test-evidence/AUDIT.md#audit-d08a--protected-external-reload).
Clean samples do not close C1/F2 or universal storage/sync-folder acceptance.

## Next action and blockers

Completed `AUDIT-SLP-A`; stopped before `AUDIT-SLP-B`. Draft its bounded brief on a later continuation: S-02 before S-01, S-03/S-04 with S-02, S-11 only after porting candidate-tamper coverage; keep history-store. D-06 remains a later separate brief. Capture-failure draft-bundle fallback remains an owner decision (ADR + Tier 3). [M6-02-R1](tasks/M6-02-R1.md) remains a separate follow-up; C1/F2 unchanged.

[Supported-runtime M6-01-R1](tasks/M6-01-R1.md) remains gated by an available
identified supported correction. C1/F2 release gate C remains open before
M6-14/16. Real storage interruption limits, full S13, security/notices,
target-native/screenreader/installed/manual update, backup/migration/owner pilot
and Local v1 admission remain later gates. DEV-02 is owner-only. No M7,
private-engine shipping, personal manuscript/credential/upload work.
