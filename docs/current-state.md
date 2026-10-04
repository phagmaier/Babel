# Current state — AUDIT-D04 complete

Date: 2026-10-04. Application: **babel**. Main; local commits only, no push.
M0–M5 and bounded M6-01 work remain recorded complete. **M6-02, C1/F2 and
Local v1 admission remain open.**

## Task and work

**AUDIT-D04 complete**, base `02dc86c`.
[Brief](tasks/AUDIT-D04.md),
[evidence](test-evidence/AUDIT.md#audit-d04--non-blocking-omissions-and-inline-note-assessment).
Closed, unambiguous notes and boneyards, section headings and synopses are one
non-blocking summary instead of SC005 issues. For assessment only, a line with
closed single-line hidden spans after visible text keeps its role, so it no
longer yields raw SC005/SC004 or a false SC001. A capture with no blocking
issue and no warning goes straight to the destination picker; review and
acknowledgement are otherwise unchanged. The summary is guarded where the
pinned renderer and codec disagree: misplaced sections/synopses, `#`/`=`-led
text the renderer drops, backslash-escaped hidden markers and title-line
boneyards stay or become blocking. Codec, editor protection, source bytes,
Rust, IPC, helper and pins are unchanged. SPEC S09.2 and ADR 0039 amended.
Paths: [assessment](../src/domain/exportAssessment.ts), [corpus](../fixtures/assessment/oracle.json),
[contract](screenplay-validation.md#audit-d04-omission-summary-and-inline-hidden-text).

Tier 2: frontend **927/927**; 27-case corpus agrees on the renderer side (PDF
text) and the assessment side; six injected faults detected; helper **14/14**;
Rust **273/273** one filesystem; browser and default embedded release pass.
Native WebKit **6/6 strict** pdf-export/script-check/publication-exit and
**4/4 strict** daily-session/commands on tmpfs/Btrfs. Artifacts: `target/audit-d04/`.

**Harness fact found here:** a copied binary finds `pdf-helper` only in a folder
ending `target/release` that holds `.cargo-lock`
([README](../tests/native/writing-lifecycle/README.md)). Helper-less frozen
copies made Script Check report "unavailable"; that was the D03B script-check
failure and the SIMP-F daily-assessment finding. The daily-session drill's
stale "unavailable" expectation is corrected.

**AUDIT-D03 complete** (`21a6180`, `02dc86c`): EDIT-07 element indentation and
the three-column writing shell;
[evidence A](test-evidence/AUDIT.md#audit-d03a--on-screen-screenplay-element-styling),
[evidence B](test-evidence/AUDIT.md#audit-d03b--writing-layout-shell). Open
from D03: owned WebKit SIGABRT `free(): corrupted unsorted chunks`
**477772/start 4562349** and **501063/start 4636728** (cores retained, no
cause); Btrfs presentation Find-viewport failure no longer occurs with the
shell, cause not isolated; the actions block above the editor is still tall.

## Retained findings and limits

**AUDIT-D02 complete** (`ffede1d`): strict identical-latest reopen, hash-bound
explicit Keep, plain review before editing; no source receipt inferred and no
journal automatically adopted, retired or deleted.
[Brief](tasks/AUDIT-D02.md),
[evidence](test-evidence/AUDIT.md#audit-d02--safe-reopen-reconciliation-and-recovery-choice).
Final native 20/20 content, 19/20 strict; artifacts `target/audit-d02/`.

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
Its initial daily-assessment failure is explained by helper resolution (D-04 evidence).
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

D04 work, evidence and handoff are committed locally on main; no push.
**Stopped after D-04.** Open follow-up: AUDIT-D04-R1 (`FADE IN:` first line
classified as a title field; needs a codec decision). Remaining accepted DESIGN
items without a brief: D-05 cheap variant, D-07 oracle and D-09 page count.
Run publication-dependent native modes with `target/release` in place or a
helper-capable frozen layout. Preserve the row schema/deferred rewrite and
native crash findings. Never substitute injected composition for genuine IME.
Unset `FORCE_COLOR` for `pnpm test:browser`. No full native/a11y/keyboard,
SELinux, M6-02, C1/F2 or Local v1 admission closure.

[M6-02-R1](tasks/M6-02-R1.md) and supported-runtime
[M6-01-R1](tasks/M6-01-R1.md) remain separate. Crash follow-up starts from retained
owned ledgers/cores and matched controls; C stays open before M6-14/16. Full S13,
security/notices, target-native/screenreader/installed/manual update, backup/
migration/owner pilot and Local v1 remain later gates. DEV-02 is owner-only.
No M7, private-engine shipping, personal manuscript/credentials/upload work.
