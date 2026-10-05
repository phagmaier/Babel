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

**AUDIT-D07-N — done.** [Brief](tasks/AUDIT-D07-N.md);
[evidence](test-evidence/AUDIT.md#audit-d07-n--native-typed-export-drill).

- New native mode `drill.py --typed-export`, also a mode of
  `integrated_exit.py`: types `fixtures/assessment/typed-scene.json` into the
  real app from an empty document, saves, exports and checks `pdftotext`.
- tmpfs and Btrfs **2/2**, crash audits clean; saved bytes equal the fixture
  (`ecb508da…`); 2 pages; 4/4 injected fixture faults detected. No product
  source change; same binary `3578c0b8…`.

**AUDIT-PARK-H — done; findings open.** [Brief](tasks/AUDIT-PARK-H.md);
[evidence](test-evidence/AUDIT.md#audit-park-h--empty-scene-heading-capture).

- The parked observation is **confirmed** in the mounted editor and the real
  app. While an empty Scene Heading row sits after text, capture stops: nothing
  typed elsewhere is saved or journaled and an owned SIGKILL loses it. Close
  refuses and the draft-bundle copy preserves it; one character resumes.
- **Found while confirming (H1, serious):** in a screenplay opened from a
  file, a new Note or Omitted material row is never captured, even with text.
  Nothing typed after it is saved or journaled; only Undo back past it resumes.
- Pinned as found: `tests/contract/empty-row-capture.test.ts`, two
  `WritingView` tests, native mode `--empty-heading` (tmpfs and Btrfs 2/2).
  No product source change: the cause is in editor capture, which decides the
  saved bytes. Tracked as **AUDIT-PARK-H-F**.

Final tree: `pnpm check` pass, tracked frontend **1100/1100**, helper
**16/16**, browser pass, Rust gates pass (see evidence). Native typed-export
and empty-heading rerun together: **4/4**, crash audits clean.

## Still unverified

- Undo/Redo of the typed scene in the native app (JSDOM oracle only).
- H1 for an Omitted material row in the native app (JSDOM only; the Note row
  is native-confirmed).
- Existing limitations beside a boneyard over-report with their old wording
  (not removed in R3).
- `pnpm test` on this host also runs 61 archived test copies under
  `target/audit-simp-f/baseline-source`; use `--exclude 'target/**'` for the
  tracked count.

## Open — owner decisions or briefs

- **AUDIT-PARK-H-F** (new): H1 new Note/Omitted material row stops all saving
  in an opened screenplay; H2 empty Scene Heading row; H3 alert wording.
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

Owner: decide AUDIT-PARK-H-F first (H1 loses work in ordinary use), then the
other open items. Agent: the queue is finished; D-05 cheap variant and D-09
wait on those decisions.
Work on `main`; no push without authorization. Never substitute injected
composition for genuine IME; unset `FORCE_COLOR` for `pnpm test:browser`. No
full native/a11y/keyboard, SELinux, M6-02, C1/F2 or Local v1 closure;
[M6-02-R1](tasks/M6-02-R1.md) and [M6-01-R1](tasks/M6-01-R1.md) remain
separate; DEV-02 is owner-only. No M6/M7 work, private-engine shipping,
personal manuscript/credentials/upload work.
