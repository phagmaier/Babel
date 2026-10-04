# Current state — AUDIT-SIMP-F complete

Date: 2026-10-03. Application: **babel**. Main; local commit only, no push.
M0–M5 and bounded M6-01 investigation remain recorded complete. **M6-02 stays
unchecked; operation findings, C1/F2 and Local v1 admission remain open.**

## Task and work

**AUDIT-SIMP-F complete**, base `ef0ff02`. [Brief](tasks/AUDIT-SIMP-F.md).
Cleanup/three throwing locks shared; 13 editor-state/9 stamp guards and six
constructions share doc-first isCurrent/stampOf/sameStamp. One 31-code const
owns the TS type/runtime list with Rust parity. Native table has 22 uniform modes;
four special branches, partial guards and all original assertions retained.
No DEV-03 fold-back, optional scroll/toolbar/refs work or native helper sharing.

Tier 2: frontend **867/867**, focused **64/64**, Rust **264/264** on tmpfs;
static/browser/default embedded release and AST dispatch tests pass. All 22 native
modes rerun: selected **21/22 successful**, **22/22 owned crash audits clean**.
Commands/F6 failure reproduces on frozen `ef0ff02` frontend/native control.
Initial daily assessment assertion failed, baseline/fresh candidate passed;
cause unresolved. Missing pointer/wtype prerequisites rebuilt; failed runs kept.
Title read-only inspection uses forced teardown, distinct from ordinary quit.
Independent artifact audit passes; failed commands root excluded by its policy.
[Evidence/failures/limits](test-evidence/AUDIT.md#audit-simp-f--frontend-guard-and-native-dispatch-simplification)
owns 27 candidate attempts, controls, bytes/head audits, commands/timing and
input bootstrap. No full native/a11y/IME, SELinux, C1/F2 or admission closure.
All 661 retained files, explicit partial guards and native assertions intact.

**AUDIT-SIMP-N complete** (`ef0ff02`, local; base `653f037`).
[Brief](tasks/AUDIT-SIMP-N.md), [evidence/failures](test-evidence/AUDIT.md#audit-simp-n--shared-native-workers-and-storagetest-primitives).
Shared workers/handler list/test roots/storage primitives; original policies and
write order retained. Tier 3: workspace 264/264 +feature 65/65 each, native 4/4.

**AUDIT-SLP-C complete** (`653f037`, local; base `186ea59`).
[Brief](tasks/AUDIT-SLP-C.md), [evidence](test-evidence/AUDIT.md#audit-slp-c--unused-complex-codec-edit-apis).
Unused inline/hidden/conversion APIs and bypasses removed; guarded live editor
coverage, Undo/Redo, baseline 112-success/16-refusal control and parser/protection
oracles retained. Tier 2: frontend 863/863, Rust 261/261; no native admission.

**AUDIT-SLP-B complete** (`186ea59`, local; base `d463656`).
[Brief](tasks/AUDIT-SLP-B.md), [evidence/failures](test-evidence/AUDIT.md#audit-slp-b--retired-prototype-proofs-with-production-coverage).
Superseded proofs retired after production coverage ports. Retained owned Btrfs
WebKit SIGSEGV at parent-kill/restart: PID `69485`, start `1517917`, raw core/ledger
intact. Later strict controls 2/2 do not resolve it; M6-03 copy/prune gap remains.

**AUDIT-SLP-A complete** (`d463656`, local), **AUDIT-TEST complete** (`09d496f`, local).
[SLP-A brief](tasks/AUDIT-SLP-A.md), [evidence](test-evidence/AUDIT.md#audit-slp-a--unused-import-read-relink-and-status-paths);
[TEST brief](tasks/AUDIT-TEST.md), [evidence](test-evidence/AUDIT.md#audit-test--wave-2-regression-gaps).
Legacy import/read/relink/status removed; test gaps covered. Native gates unchanged.

## Prior audit execution (`AUDIT.md` frozen)

Tracker: `TODO.md` Audit execution; [audit evidence](test-evidence/AUDIT.md).

- [AUDIT-C356](tasks/AUDIT-C356.md) done (`614cb8d`, `fb7d6bd`, pushed; both CI passed): literal escapes, exact SELinux xattr exemption, independent highlights. [Evidence](test-evidence/AUDIT.md#audit-c356--literal-escapes-selinux-metadata-and-advisory-highlights); enforcing Fedora and native highlight input unverified.
- [AUDIT-W0-R1](tasks/AUDIT-W0-R1.md) done (`7d45253`, groff prerequisite `49129df`): Enchant >=2.4, pinned CI/Hunspell, empty personal wordlist isolation. [Implementation CI passed](https://github.com/phagmaier/Babel/actions/runs/37157598075); `08986eb` [documentation CI passed](https://github.com/phagmaier/Babel/actions/runs/37158997960). [Failures/evidence](test-evidence/AUDIT.md#audit-w0-r1--enchant-ci-abi-prerequisite).
- [AUDIT-W0](tasks/AUDIT-W0.md) done (`004bd6d`): CI/helper, rlib-only desktop, dead symbols. First pushed D08A CI exposed Enchant 2.3.3; W0-R1 owns correction.
- [AUDIT-C01](tasks/AUDIT-C01.md) done (`fe103bf`): capture/split/join/edge spaces; mocked/JSDOM. D01 covers mid-speech Enter; arbitrary protected shapes and draft-bundle fallback remain outside that fix.
- [AUDIT-C04](tasks/AUDIT-C04.md) done (`bc1476e`): no-replace identical-byte save, Tier 3. [Evidence](test-evidence/AUDIT.md#audit-c04--a-caret-move-no-longer-rewrites-the-manuscript) retains one unreproduced Btrfs publication-cache CacheUnavailable failure; cause unknown, no end-to-end WebView click claim.
- [AUDIT-D01](tasks/AUDIT-D01.md) done (`2bc2311`): portable Enter/speech continuation/Shift+Enter/dual capture, SPEC/tests together. [Evidence](test-evidence/AUDIT.md#audit-d01--portable-enter-separators-and-explicit-speechbreak-authoring): mocked/JSDOM + browser; other protected shapes/schema deferred.
- [AUDIT-D08A](tasks/AUDIT-D08A.md) done: external checks, metadata re-anchor, protected one-Undo Reload/copy. Exact retries retain immutable recovery base. [ADR 0041](decisions/0041-protected-external-reload.md), [evidence/failures](test-evidence/AUDIT.md#audit-d08a--protected-external-reload); clean native samples do not close C1/F2.

## M6 findings and blockers

Prior bounded Linux hardening: stage-qualified Save As refusal/identity and Undo
rollback, child-kill source/recovery/local-restore, path-loss/shared-store drills,
independent literal/head audit. No cause/correction for untouched M6-01 operations.
[Brief](tasks/M6-02.md), [S15.2 matrix](test-evidence/M6-02-matrix.md),
[review](reviews/2026-10-03-m6-02-persistence-review.md),
[checks/failures/artifacts](test-evidence/M6.md#m6-02--persistence-interruption-and-operation-investigation).

Retained M6-02 failures: separate-store read-only expectation conflicts with
ADR 0012's shared-store lease scope. Btrfs restart passed content but recorded
owned WebKit SIGABRT after parent SIGKILL: PID `274428`/start `2737907`, cores
and provenance under `target/m6-02/`. Harness-log-path failures/corrected reruns
and M6-01 failed roots/binaries/cores remain intact. Intact bytes and later clean
samples do not close C1/F2. Rename path-loss is not unmount/power/controller/
antivirus/sync-product acceptance. Stronger Save As/IME samples did not reproduce
M6-01 symptoms; causes remain open. M6-03 independent copy/prune has not started.

## Next action and stopping point

Completed AUDIT-SIMP-F/Wave 3; stopped before further DESIGN implementation.
Next continuation: draft the bounded **D-06** plain-status/failure-only-close
brief (C-04 dependency complete), preserving receipt/protection/close safety.
Native commands/F6 and the initial daily assessment observation need separate
reproduction/disposition; do not weaken their native assertions to mark green.
Capture-failure draft-bundle fallback requires an owner decision/ADR + Tier 3.
[M6-02-R1](tasks/M6-02-R1.md) remains separate; C1/F2 unchanged.

[Supported-runtime M6-01-R1](tasks/M6-01-R1.md) needs an available identified
supported correction. C stays open before M6-14/16. Real storage interruption,
full S13, security/notices, target-native/screenreader/installed/manual update,
backup/migration/owner pilot and Local v1 admission remain later gates. DEV-02
is owner-only. No M7, private-engine shipping, personal manuscript/credential/upload work.
