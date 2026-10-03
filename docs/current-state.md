# Current state — AUDIT-D01 done; M6-02 disposition open

Date: 2026-10-03. Application: **babel**. Main; no push/tag/branch.
Base `ccf9fb5`, clean main/19 ahead at claim. M0–M5 and bounded M6-01
investigation remain recorded complete. **M6-02 stays unchecked; retained
operation findings, C1/F2 and Local v1 admission remain open.**

## Task and work

Owner continuation authorized M6-02 on current Linux x86_64 host, with future
portability retained. No additional target/installed promise; M6-13/14 still
need exact release-target confirmation. [ADR 0040](decisions/0040-local-v1-platform-scope.md).

Added stage-qualified Save As refusal and identity/source/selection/Undo rollback
regressions. Successful native Save As now proves adoption through later copied-
file edits and Undo, while the divergent original stays intact. Readiness/refusal
snapshots preserve trusted composition, Save/editability and outline facts.
No demonstrated cause/correction for the untouched M6-01 operations is claimed.

Extended real source/recovery child-kill boundaries; added actual local-restore
child SIGKILL after live/disk protection, before replacement and after replacement.
Private existing stage closure passes through request/restore with production
no-op. No receipt/schema/capability/dependency/ownership-policy change. New
opt-in native path-loss and two-app drills plus independent literal/head auditor;
initial harness identity/log-path errors corrected with failures retained.

Paths: `writingSession.ts`, source/recovery/snapshot stores/tests, existing native
writing-lifecycle runners/new `persistence_paths.py`/`audit_persistence_paths.py`.
[Brief](tasks/M6-02.md), [S15.2 matrix](test-evidence/M6-02-matrix.md),
[review](reviews/2026-10-03-m6-02-persistence-review.md),
[exact commands/artifacts/failures](test-evidence/M6.md#m6-02--persistence-interruption-and-operation-investigation).

## Checks and retained failures

Shared frontend 774/774, lint/typecheck/build; Chromium smoke; final Rust fmt/
clippy and workspace 265/265 each tmpfs/Btrfs; default release build pass.
Mocked editor/session focused 62/62; actual restore child-kill checks pass.
Final corrected native path-loss/shared-store two-app 4/4 strict; ordinary
restart/read-only controls 4/4; final real-IME presentation 2/2. Independent
literal/source/copy/journal-head and crash-verdict audits are in M6 evidence.
These are bounded Linux groups, not universal durability or full admission.

First default-teardown matrix was 5/8 strict: two unrelated-store read-only
expectations fail under ADR 0012's pre-existing shared-store lease limit; one
Btrfs restart root completes content checks but records owned WebKit SIGABRT
following parent SIGKILL before stale-session DELETE. PID `274428`/start `2737907`,
compressed core/provenance/logs retained under `target/m6-02/`; no event filtered.
First ordinary replay 7/8 due to a secondary-log-path harness error; corrected
named reruns pass. Neither later clean samples nor intact bytes resolves C1/F2.

The separate-store diagnostic actually shows writable second-app state, source
unchanged; normal shared-store control passes. [ADR 0012](decisions/0012-native-document-identity.md)
still scopes cooperating advisory leases. Parent rename is path-loss simulation,
not actual unmount/power/controller/antivirus/sync-product acceptance.
All M6-01 failed roots/binaries/cores remain untouched. Save As refusal and stress
IME readiness were not reproduced in stronger-oracle samples; causes stay open.

## Docs maintenance (2026-10-03, Tier 1, no behavior change)

Owner-authorized Tier 1 debloat (`433c150`): tracker collapse, index stub, stale S-14 refs and tracked link/matrix tools; frozen audit/evidence retained. Formatting, 172 changed links, Python compilation and diff passed; five frozen M4 links remain intentionally untouched. Details are committed; no behavior gate credited.

## Audit execution (2026-10-03, `AUDIT.md` frozen)

Tracker: `TODO.md` `## Audit execution`; [audit evidence](test-evidence/AUDIT.md).

[AUDIT-W0](tasks/AUDIT-W0.md) done (`004bd6d`): CI dependencies/helper, rlib-only desktop and S-13 cleanup. Local Tier 2 pass; **CI unrun**, Hunspell dictionary on runner unverified until owner-authorized push.

[AUDIT-C01](tasks/AUDIT-C01.md) done (`fe103bf`): unforced-neighbour capture, split/join refusals and edge-space emphasis. Tier 2, mocked/JSDOM only. D01 now covers its mid-speech Enter exclusion; arbitrary dual regroup/protected-neighbour shapes and the draft-bundle fallback remain outside that fix.

[AUDIT-C04](tasks/AUDIT-C04.md) done (`bc1476e`): identical-byte source save acknowledges without replacement. Tier 3 matrix 268/268 each and lifecycle drill 7/7 each tmpfs/Btrfs. Retained: one Btrfs publication-cache `CacheUnavailable` failure, not reproduced in 7 reruns, cause unknown; no native drill asserts WebView click end to end.

[AUDIT-D01](tasks/AUDIT-D01.md) done (base `bc1476e`, main, no push): Enter inserts a physical separator when starting Action; within continuing speech it inserts attached Dialogue. Boundary Backspace/Delete reverses empty paragraph creation or joins two Action paragraphs. Shift+Enter splits proven Action/Dialogue rows; explicit remappable Toggle dual dialogue pairs/unpairs adjacent complete speeches. Deferred capture wires `replaceLineWithBreaks` (retained IDs) and `setDualDialogue`; empty virtual cues stay capturable. Existing row schema/native formats unchanged.

Paths: `commands.ts`, `sourceBridge.ts`, `shortcuts.ts`, `fountainCodec.ts`, `commandCatalog.json`, `editor-d01.test.ts` and existing key/unforced/controls tests. SPEC S07.2 clarifies separators and continuing speech, with matching tests; no transition-table kind change. Owning editor doc and scoped requirement mapping updated. Tests written/red before fix; C01 speech exclusion removed. [Checks/failures/expectation reasons](test-evidence/AUDIT.md#audit-d01--portable-enter-separators-and-explicit-speechbreak-authoring): focused 262/262 and frontend 835/835, lint/typecheck/build, Rust fmt/clippy and 268/268 workspace, browser smoke, prettier/links/Python/diff. Sandbox ACL fixture and Vite startup failed; unrestricted reruns pass. **Editor evidence remains mocked/JSDOM; Chromium smoke is generic. No native WebView writing, independent renderer oracle or Tier 3 matrix for this frontend-only task.**

## Next action and blockers

Next agent-executable task: draft and execute `docs/tasks/AUDIT-D08A.md` (external-change Reload, next unchecked Wave 1 box); **stop here at AUDIT-D01**. D-06 remains a later separate brief. Owner actions, non-blocking: review/push so CI runs; decide whether to brief capture-failure draft-bundle fallback (ADR + Tier 3). [M6-02-R1](tasks/M6-02-R1.md) remains behind audit Waves 0–1; C1/F2 unchanged.

[Supported-runtime M6-01-R1](tasks/M6-01-R1.md) remains gated by an available
identified supported correction. C1/F2 release gate C remains open before
M6-14/16. Real storage interruption limits, full S13, security/notices,
target-native/screenreader/installed/manual update, backup/migration/owner pilot
and Local v1 admission remain later gates. DEV-02 is owner-only. No M7,
private-engine shipping, personal manuscript/credential/upload work.
