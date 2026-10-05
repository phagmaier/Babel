# Current state — audit queue session 2026-10-04 (owner host)

Date: 2026-10-04. Application: **babel**. Work is on `main` over `bb0fd45`;
nothing from this session is pushed. M0–M5 and bounded M6-01 work remain
recorded complete. **M6-02, C1/F2 and Local v1 admission remain open.**
Host: owner laptop, uid 1000, Hyprland display, Btrfs repo, tmpfs `/tmp`.

## This session

**AUDIT-D04-R3 — done.** [Brief](tasks/AUDIT-D04-R3.md);
[evidence](test-evidence/AUDIT.md#audit-d04-r3--remaining-renderercodec-reading-differences).

- The export check no longer passes sources the PDF prints in another role:
  the five queued classes and seven more the probes found. Assessment only;
  codec classification, Rust, IPC, helper, profile and pins unchanged.
- `src/domain/rendererReading.ts` mirrors the pinned parser;
  `src/domain/exportAssessment.ts` reports each line whose printed role or
  scene number differs. Corpus 83 → 117; helper checks text and paragraph
  classes.
- Differential probe on 70,000 generated sources: clean-but-different
  2,495 → 0; none of the 14,146 clean-and-equal sources newly gated; mirror
  equal to the parser on all. 16/16 injected faults detected.
- `pnpm check` pass, tracked frontend **1080/1080**, helper **16/16**, browser
  pass. Native binary `3578c0b8…` in place: pdf-export, script-check,
  publication-exit, title-page on tmpfs and Btrfs — **8/8 content, 8/8 crash
  audits clean**.

**Queued next, in order:** AUDIT-D07-N native typed-export drill; AUDIT-PARK-H
empty Scene Heading capture, confirm first.

## Still unverified

- D-07 typed-export case in the native app (AUDIT-D07-N, in progress).
- Existing limitations beside a boneyard over-report with their old wording
  (not removed in R3).
- `pnpm test` on this host also runs 61 archived test copies under
  `target/audit-simp-f/baseline-source`; use `--exclude 'target/**'` for the
  tracked count.

## Open — owner decisions or briefs

- **AUDIT-D07-F**: F1 empty Dialogue/Lyrics exit without separator, F2 no
  keyboard exit from a note at document end, F3 Page Break caret before `===`,
  F4 empty-cue suggestions capture the element-cycle Tab.
- **AUDIT-PARK-T**: D-05 replace-all protection and snapshot cap; duplicate
  draft after a failed resume.
- **Capitals guard**: lowercase headings and forced transitions block export
  because the editor shows them as typed and the PDF prints capitals. Keep,
  drop, or show capitals in the editor and then drop.
- D-05 cheap variant and D-09 page count wait on the decisions above.
- Replace-All test failure under load (1/10 in the cloud, D02's retained
  failure): not reproduced on this host; cause still unknown.

## Retained findings and limits (detail in linked evidence)

**AUDIT-D04** (`718c6e8`): native 6/6 strict pdf-export/script-check/
publication-exit there. A copied binary finds `pdf-helper` only in a folder
ending `target/release` that holds `.cargo-lock`
([README](../tests/native/writing-lifecycle/README.md)).
**AUDIT-D03** (`21a6180`, `02dc86c`): owned WebKit SIGABRT
**477772/start 4562349** and **501063/start 4636728** (cores retained, no
cause); the actions block above the editor is still tall.
**AUDIT-D02** (`ffede1d`): retained owned WebKit crashes Btrfs SIGSEGV
**335923/start 3571811**, tmpfs SIGSEGV **353321/start 3701248**, Btrfs SIGABRT
**413296/start 3989180**; no cause or C1/F2 disposition.
**AUDIT-NATIVE-R1** (`e595393`): owned Btrfs SIGSEGV **251383/start 3043549**;
full native keyboard/a11y/IME unverified. **AUDIT-D06**/**SIMP-F** complete;
earlier native failures stay historical evidence. `AUDIT.md` stays frozen.
C356 enforcing SELinux/native highlight input is unverified; C04's
unreproduced cache failure remains retained.
[M6-02](tasks/M6-02.md), [matrix](test-evidence/M6-02-matrix.md),
[review](reviews/2026-10-03-m6-02-persistence-review.md) and
[evidence](test-evidence/M6.md#m6-02--persistence-interruption-and-operation-investigation)
retain Save As/IME findings, shared-store lease scope and owned Btrfs SIGABRT
after parent SIGKILL. M6-03 copy/prune and capture-failure bundle policy open.

## Next action

Agent: AUDIT-D07-N, then AUDIT-PARK-H. Owner: decide the open items above.
Work on `main`; no push without authorization. Never substitute injected
composition for genuine IME; unset `FORCE_COLOR` for `pnpm test:browser`. No
full native/a11y/keyboard, SELinux, M6-02, C1/F2 or Local v1 closure;
[M6-02-R1](tasks/M6-02-R1.md) and [M6-01-R1](tasks/M6-01-R1.md) remain
separate; DEV-02 is owner-only. No M6/M7 work, private-engine shipping,
personal manuscript/credentials/upload work.
