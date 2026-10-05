# Current state — dev review session 2026-10-04 (owner host)

Date: 2026-10-04. Application: **babel**. The four cloud-session commits
`30f05d8`..`a22f01f` and the review commit `08e4b82` were fast-forwarded from
`dev` into `main` and `main` was pushed on the owner's instruction. M0–M5 and
bounded M6-01 work remain recorded complete. **M6-02, C1/F2 and Local v1
admission remain open.**

## This session — AUDIT-DEV-REVIEW (review of `dev` before merge)

[Evidence](test-evidence/AUDIT.md#audit-dev-review--dev-branch-review-before-merge).
Host: owner laptop, uid 1000, Hyprland display, Btrfs repo, tmpfs `/tmp`.

- **As pulled:** every shared gate passes — frontend 999/999 tracked tests,
  helper 15/15, browser, `cargo fmt`/`clippy`, Rust **273/273 as non-root**.
  The two edited pre-existing tests are not weakened; no Rust, IPC, helper,
  profile, font or pin change.
- **Differential probe** (30,000 generated sources against the pinned
  renderer): `dev` gates nothing that `main` read correctly, and cuts
  clean-but-different sources from 3,753 to 357.
- **Fixed in review, red first** (`src/domain/exportAssessment.ts`, assessment
  only): cues ending in a tab, a lone `>`, spaced empty `@` cues, and an
  indented `Key: value` after a valued title key. Corpus 76 → 83; 115 left.
  Two limitation messages corrected against the renderer. 7/7 faults detected.
- **Final:** `pnpm check` pass, frontend **1007/1007** tracked, helper
  **15/15**, browser pass.
- **Native, binary in place** (`aefcae53…`, built from the reviewed tree):
  `integrated_exit.py --modes pdf-export script-check publication-exit
title-page` on tmpfs and Btrfs — **8/8 content, 8/8 owned crash audits
  clean**, 470s (`target/audit-dev-review/native`).

Cloud-session tasks, unchanged and covered by the gates above:
[AUDIT-D07](tasks/AUDIT-D07.md) typed-scene oracle,
[AUDIT-D04-R2](tasks/AUDIT-D04-R2.md) renderer/codec sweep,
[AUDIT-PARK](tasks/AUDIT-PARK.md) parking verdicts and
[AUDIT-D04-R1](tasks/AUDIT-D04-R1.md) all-empty `Key:` block is body text.

## Still unverified

- D-07 typed-export case in the native app: no drill mode exists (type the
  fixture scene, Export PDF, `pdftotext`). JSDOM and helper proof only.
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
  because the editor shows them as typed and the PDF prints capitals. Showing
  them in capitals in the editor would let the guard go; one guard to remove.
- **AUDIT-D04-R3**: five remaining renderer/codec classes (whitespace-only
  separators, unclosed parentheticals, spaced scene numbers, bare heading
  prefix, boneyard-only lines). All predate this branch.
- Parked, unverified: an empty Scene Heading row after text cannot be captured
  until a character is typed (JSDOM, same on `main`).
- Replace-All test failure under load (1/10 in the cloud, D02's retained
  failure): not reproduced here in four full runs; cause still unknown.

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

Owner: decide the open items above. Agent, in order: AUDIT-D04-R3 brief and
sweep, a native typed-export drill mode for D-07, a native reproduction of the
parked empty Scene Heading capture, then the accepted DESIGN items without a
brief (D-05 cheap variant with AUDIT-PARK-T facts, D-09 page count). Work on
`main`; no push without authorization. Never substitute injected composition for genuine IME; unset
`FORCE_COLOR` for `pnpm test:browser`. No full native/a11y/keyboard, SELinux,
M6-02, C1/F2 or Local v1 closure; [M6-02-R1](tasks/M6-02-R1.md) and
[M6-01-R1](tasks/M6-01-R1.md) remain separate; DEV-02 is owner-only. No M6/M7
work, private-engine shipping, personal manuscript/credentials/upload work.
