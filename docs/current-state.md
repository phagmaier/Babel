# Current state — AUDIT-D03 complete (D03A + D03B)

Date: 2026-10-04. Application: **babel**. Main; local commits only, no push.
M0–M5 and bounded M6-01 work remain recorded complete. **M6-02, C1/F2 and
Local v1 admission remain open.**

## Task and work

**AUDIT-D03B complete**, base `21a6180`: layout shell, second slice of D-03.
[Brief](tasks/AUDIT-D03.md),
[evidence](test-evidence/AUDIT.md#audit-d03b--writing-layout-shell).
Windows at least 1100px wide get three columns under the sticky header: pinned
navigator (Characters, Outline), script column, and a tools drawer (Spellcheck,
Script Check, Find, Title page) that exists only while a tool is open. The
window still scrolls the script. DOM/keyboard order is unchanged and the editor
host is never remounted; narrower windows keep the single-column stack. Status,
alerts and Save details share one header row so the in-memory alert no longer
changes header height on a wide window. No schema, capture, command, IPC or
persistence change; no native drill file changed.
Paths: [view](../src/app/WritingView.tsx), [styles](../src/app/writing.css),
[shell check](../tests/browser/shell-layout.mjs), [UX](ux.md#writing-layout-shell-audit-d03b).

Tier 2: frontend **886/886**; Chromium shell and element geometry pass; Rust
**273/273** one filesystem; format/lint/typecheck/build, clippy and default
embedded release pass. Native WebKit **20/22 content, 19/22 strict** over
presentation, outline, scene-moves, find, replace, script-check, spellcheck,
title-page, characters, commands and editor-exit on tmpfs/Btrfs.
Artifacts: `target/audit-d03/`.

**AUDIT-D03A complete** (`21a6180`): EDIT-07 per-element indentation in a
proportional 60-character column, CSS only;
[evidence](test-evidence/AUDIT.md#audit-d03a--on-screen-screenplay-element-styling).

**Findings from D03 (open, no cause claimed):**

- Script Check drill fails on both filesystems at `'Export support assessed'`
  (panel shows `Export assessment unavailable`); the unchanged D03A binary fails
  identically. Later Script Check native steps are unverified under the shell.
- Btrfs presentation Find-viewport failure on the D02/D03A binaries no longer
  occurs with the shell (2 runs). Consistent with the header-growth lead, but
  the cause was not isolated.
- Owned WebKit SIGABRT `free(): corrupted unsorted chunks`: **477772/start
  4562349** (Btrfs forced teardown of a failed first candidate) and
  **501063/start 4636728** (tmpfs editor-exit, content pass/strict fail). Cores
  retained; same family as the M4 heap aborts.
- The actions/picker block above the editor is still tall (about 480px).

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

D03 work, evidence and handoff are committed locally on main; no push.
**Stopped after D-03.** Remaining accepted DESIGN items without a brief: D-04
(non-blocking export summary, inline-note `raw` fix), D-05 cheap variant, D-07
oracle and D-09 page count. Suggested next: D-04, starting by reproducing the
Script Check `Export assessment unavailable` failure, which sits on the same
assessment path. Preserve the row schema/deferred rewrite, native crash findings
and initial assessment failure. Never substitute injected composition for
genuine IME. Unset `FORCE_COLOR` for `pnpm test:browser`. No full
native/a11y/keyboard, SELinux, M6-02, C1/F2 or Local v1 admission closure.

[M6-02-R1](tasks/M6-02-R1.md) and supported-runtime
[M6-01-R1](tasks/M6-01-R1.md) remain separate. Crash follow-up starts from retained
owned ledgers/cores and matched controls; C stays open before M6-14/16. Full S13,
security/notices, target-native/screenreader/installed/manual update, backup/
migration/owner pilot and Local v1 remain later gates. DEV-02 is owner-only.
No M7, private-engine shipping, personal manuscript/credentials/upload work.
