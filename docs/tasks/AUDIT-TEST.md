# AUDIT-TEST — Wave 2 regression gaps

Status: **complete; stopped before Wave 3**. Base `fb7d6bd`, main, 2026-10-03.
Dependencies: Wave 1 complete (AUDIT-C356). Requirements: QA-01; existing
editor/source, exact receipt, recovery and advisory Script Check contracts.

## Scope and acceptance

Cover frozen [audit Tests](../../AUDIT.md#tests) in tracker dependency order:

- T-03: resumed version-1 checkpoint opens at version 2 under its fresh identity;
  flush failure abandons safely, cleanup failure preserves the protection error,
  disposed resume releases its returned registration without mounting/flushing.
  RecoveryReview/Home routes the exact selection; WritingView opens recovered.
- T-04: exercise all eight named WritingSession guards, including mismatched
  Save As/copy, stale capture, prepared/applied adoption, pre-destructive record,
  PDF capture and recovery identity. Refusal preserves bytes/identity, prevents
  downstream calls, and thaws where applicable. Also resolve identity refusal.
- T-05: reject invalid resolved-baseline receipts (foreign, malformed, read-only,
  pending, too new/old), invalid adoption snapshots and in-flight adoption,
  oversized queues and stale submissions without saved credit/state mutation.
- T-09: structured paste retains prefix/suffix at mid-row, row start and partial
  cross-row selections; exact source, selection Undo and Redo assertions.
- T-06: drive real WritingView replace-one/all and Script Check navigation;
  source/Undo assertions, fresh projection and conservative input refusals.
- T-07: drive prepared snapshot Restore and Resolve through WritingView;
  verify protection order, baseline/next Save, one-step Undo, competing-action
  refusal and post-native adoption failure retains the old editor.
- T-10: malformed parenthetical SC002 and invalid UTF-8 SC004 mappings preserve
  original bytes and advisory/no-fix semantics. Defensive SC003 stays intact.
- T-08: cite the already completed tracked runner's full-selector Tier 3 run
  (AUDIT-C356); no new matrix claim or retrospective repair of older evidence.

## Tests first and checks

Add coverage before production edits. Reproduce parked resume observations with
expected red tests; only a directly reproduced frontend lifecycle defect may be
corrected here. For correctly working paths, use a disposable, restored mutation
of each named guard/mapping and paste prefix/suffix, and removed view wiring to
prove the added tests fail. Retain original logs and restore production bytes.
No weakened assertions or changed acceptance oracle.

Tier 2: focused Vitest files, full `pnpm check`, Rust format/clippy and workspace
suite, Chromium browser smoke, changed local links and `git diff --check`.
Record elapsed times and each pass/fail in [audit evidence](../test-evidence/AUDIT.md).
Native ports are injected/JSDOM. The tracked `python3 tools/audit-test-mutations.py <new-output-directory>` runner
requires a passing unmodified focused control and transforms each mutant in
memory; it never writes production files. No disk/IPC/packaging implementation changes;
no second-filesystem run, package rebuild or native GUI drill required. Existing
native restore/resume evidence is not relabeled as evidence for this checkout.

## Do NOT do / stopping point

Keep `AUDIT.md` frozen and obey its [dropped/refuted list](../../AUDIT.md#dropped-or-refuted).
Do not start Wave 3, D-06, schema redesign, draft-bundle fallback, SC003 removal,
recovery retirement/auto-adoption or native filesystem changes. Do not delete
failed artifacts, normalize fixtures, change dependencies or weaken tests.
Duplicate persisted recovery entries and native release retries are outside
this frontend-only task. C1/F2, enforcing SELinux, M6-02 and Local v1 stay open.
Update tracker/handoff/evidence, commit completed AUDIT-TEST on main, and stop.
