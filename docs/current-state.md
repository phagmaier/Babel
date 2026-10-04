# Current state — AUDIT-D02 complete

Date: 2026-10-04. Application: **babel**. Main; local commit only, no push.
M0–M5 and bounded M6-01 work remain recorded complete. **M6-02, C1/F2 and
Local v1 admission remain open.**

## Task and work

**AUDIT-D02 complete**, base `e595393`: accepted rules 1+3.
[Brief](tasks/AUDIT-D02.md),
[evidence](test-evidence/AUDIT.md#audit-d02--safe-reopen-reconciliation-and-recovery-choice).
Native open admits only a clean latest identical journal under strict source/
transaction/ownership checks, or an exact hash-bound persisted explicit Keep.
Prior confirmed-source divergence permits reviewed Keep only without an unresolved
intent/candidate. Current-session checkpoints require no older-session choice.
No source receipt is inferred; no journal is automatically adopted, retired or deleted.
Paths: [native admission](../crates/screenwriter-core/src/documents/reconciliation_store.rs),
[writing gate](../src/app/WritingView.tsx), [choice panel](../src/app/RecoveryChoicePanel.tsx).

The editor waits for discovery. Unresolved recovery gets a plain primary choice
before typing; Inspect later stays read-only. Failed choices/discovery retain
review/copy/Home. Exporting a copy does not unlock review; successful Save As
adoption switches to a fresh identity. Native New-with-destination regression
and failed-A-save/Save-As-B/reopen-A protection have dedicated checks.

Tier 3: current frontend **885/885**, Rust **273/273 each tmpfs/Btrfs**;
shared format/lint/typecheck/build, clippy, browser and default embedded release
pass. Final native **20/20 content, 19/20 strict** across ten affected modes on
both filesystems, including genuine editor/IME and character/focus checks.
Earlier failures and the interrupted sample remain retained.
Artifacts: `target/audit-d02/`, including frozen candidates, ledgers/journals,
raw owned cores, original roots and checksummed tmpfs mirrors. Tests use synthetic
files/private IME; fixtures, locks/pins, frozen AUDIT and prior evidence stay intact.

## Retained findings and limits

D02's first broad candidate found and corrected the fresh-New review gate.
Native character external-source review and title-page read-only predicates were
updated for accepted behavior without dropping input/byte/Undo assertions.
Corrected broad run: 18/20 content, 17/20 strict; missing caret after Keep exposed
a focus regression on both filesystems. Owned-view focus, auxiliary authorship
gates and own-session unresolved-transaction admission now have red/green tests.
Its owned Btrfs WebKit SIGSEGV **335923/start 3571811**, 08:41:17 UTC, and the
corrected tmpfs recovery-shutdown SIGSEGV **353321/start 3701248**, 09:02:47 UTC,
coincide with parent disappearance during existing forced restart. Final Btrfs
editor content passed but strict audit failed: owned WebKit **SIGABRT 413296/start
3989180**, parent 413264/start 3989166, coarse core time 09:53:07 UTC in the same
second as forced parent disappearance. Raw cores/PID/start/journal retained;
no cause, correction or C1/F2 disposition. Clean reruns do not clear findings.

**AUDIT-NATIVE-R1 complete** (`e595393`): Save-first F6, canonical read-only
Mozc bind and observed owned GTK menu traversal.
[Brief](tasks/AUDIT-NATIVE-R1.md),
[evidence](test-evidence/AUDIT.md#audit-native-r1--f6-focus-and-private-mozc).
Commands 2/2 strict; editor 2/2 content, 1/2 strict. Earlier owned Btrfs WebKit
SIGSEGV **251383/start 3043549** remains retained. Broader read-only F6 and full
native keyboard/a11y/IME remain unverified; clean controls cannot dispose crashes.

**AUDIT-D06 complete** (`fcfade8`), receipt-derived plain status and protected
file/read-only close; [brief](tasks/AUDIT-D06.md) and
[evidence](test-evidence/AUDIT.md#audit-d06--plain-status-and-failure-only-close-prompts).
Earlier native 10/14 and baseline F6/Mozc failures remain historical evidence.
**AUDIT-SIMP-F complete** (`200e375`); [brief](tasks/AUDIT-SIMP-F.md),
[evidence](test-evidence/AUDIT.md#audit-simp-f--frontend-guard-and-native-dispatch-simplification).
Its initial daily-assessment failure stays unresolved despite clean later runs.
D02 also retains a combined frontend Replace-All assertion failure: unchanged
isolated/current/complete reruns passed, without a cause/correction claim. An
initial browser page-load timeout during matrix work passed on idle retry; no
timeout/assertion/config change or cause claim.
Wave 0–3 closures and failures remain in TODO and linked audit evidence, including
SLP-B's owned WebKit crash. `AUDIT.md` stays frozen. C356 enforcing SELinux/native
highlight input is unverified; C04's unreproduced cache failure remains retained.

[M6-02](tasks/M6-02.md), [matrix](test-evidence/M6-02-matrix.md),
[review](reviews/2026-10-03-m6-02-persistence-review.md) and
[evidence](test-evidence/M6.md#m6-02--persistence-interruption-and-operation-investigation)
retain original Save As/IME findings, shared-store lease scope and owned Btrfs
SIGABRT after parent SIGKILL. Intact bytes/clean reruns do not close C1/F2.
Path-loss is not unmount/power/controller/antivirus/sync acceptance. M6-03 independent
copy/prune and capture-failure bundle policy remain separate open work.

## Next action and stopping point

D02 work, evidence and handoff are committed locally on main; no push.
**Stopped after D-02 before D-03.** The next fresh agent should read this handoff,
TODO's accepted D-03 row and prepare a bounded brief for screenplay styling and
layout slices before pilot. Preserve the row schema/deferred rewrite, native
crash findings and initial assessment failure. Never substitute injected
composition for genuine IME. No full native/a11y/keyboard, SELinux, M6-02, C1/F2
or Local v1 admission closure.

[M6-02-R1](tasks/M6-02-R1.md) and supported-runtime
[M6-01-R1](tasks/M6-01-R1.md) remain separate. Crash follow-up starts from retained
owned ledgers/cores and matched controls; C stays open before M6-14/16. Full S13,
security/notices, target-native/screenreader/installed/manual update, backup/
migration/owner pilot and Local v1 remain later gates. DEV-02 is owner-only.
No M7, private-engine shipping, personal manuscript/credentials/upload work.
