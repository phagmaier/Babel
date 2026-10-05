# Current state — emptied EOF rows 2026-10-05 (owner host)

Date: 2026-10-05. Application: **babel**. Work on `main` over `409d3f3`.
The initial tree was clean. Local `origin/main` is now `beac0fc`, an alternate
F4-04 commit whose difference from `409d3f3` is docs only; the supplied
handoff's remote-ref count is stale. No integration or push authorized.
Owner reviews first. M0–M5 and bounded M6-01 remain recorded complete.
**M6-02, C1/F2 and Local v1 admission remain open.** Host: owner laptop,
uid 1000, Hyprland display, Btrfs repo, tmpfs `/tmp`.

## This session

**AUDIT-PARK-H-F4-05 done**, owner decided 2026-10-04.
[Deliverable](tasks/AUDIT-PARK-H-F4.md#f4-05-deliverable-and-acceptance)
written before code; [evidence](test-evidence/AUDIT.md#audit-park-h-f4-05--emptied-unterminated-last-rows).

- Codec adds one local/file-convention ending when an emptied unterminated
  physical row would disappear. Existing recovery-only intent retains its
  element. An emptied numbered heading stays refused, number intact.
- Product path: `src/domain/fountainCodec.ts` only. New
  `tests/contract/empty-eof-row.test.ts` (35 cases), mounted mocked-port case,
  and native `empty-heading` phase I (Heading/Dialogue/Parenthetical).
  Exact-shape incumbent assertions updated; parser/commands/schema/native
  product code unchanged. Owning docs and native guide updated.
- Red **27 fail / 16 pass**. Corrected final focused **188/188 pass**.
  Differential **13,792 edits**: 0 new refusals, 0 changed successful bytes
  or line facts; 176 emptied unterminated rows now save. All raw results
  retained in `target/audit-park-h-f4-05/`.
- Shared gates pass: tracked **1319/1319**, aggregate **2182/2182** in
  135 files (74 tracked plus 61 currently retained archive files), helper
  **16/16**, Rust **273/273**, fmt/Clippy, browser and fresh release. Earlier
  test/setup/cache failures retained and explained in evidence. Native
  `empty-heading` including phase I **2/2 content and strict** on tmpfs/Btrfs;
  all 12 new phase-I source/reopened files match independent literal bytes.
  Five Btrfs capture/export regression modes **5/5 content and strict** pass.
- Phase-I recovered reopen is contract-level only; CR and mixed endings are
  contract only. F4-05 does not dispose historical F2 WebKit crashes.

## Queue and boundaries

- F4-01 through F4-04 complete; [brief](tasks/AUDIT-PARK-H-F4.md).
  [F4-04 evidence](test-evidence/AUDIT.md#audit-park-h-f4-04--typed-text-fountain-reads-as-other-syntax)
  retains exact Action fallbacks, advisory SC009, refused marker shapes and
  speech-breaking `!`. Its native phase H covers Dialogue only; Heading,
  Character and Transition fallback intents have contract/mocked-journal
  coverage. A native Transition follow-up is separately scoped.
- F1/F2/F3 complete; [F2](tasks/AUDIT-PARK-H-F2.md) retains owned Btrfs
  **WebKit SIGABRT 1134510/start 10372570** with no cause/disposition.
- **Group F stays unscheduled**. No adjacent implementation this session.
  The F3 alert still names rows that remain refused.
- D-07-F, PARK-T, capitals, D-05 cheap variant and D-09 page count remain
  separately scoped with pinned reproductions authoritative; boneyard
  cleanup needs its own brief and helper proof. D07-N Undo/Redo is JSDOM-only.
- Replace-All load flake remains unreproduced here. `pnpm test` includes 61
  archived copies; tracked count uses `pnpm exec vitest run --exclude 'target/**'`.
  New tests stay outside target archives. Vitest TMPDIR and native IME temp
  root use the Btrfs task folder. No retained artifact pruning authorized.

## Retained findings and limits

[audit evidence](test-evidence/AUDIT.md) retains prior WebKit findings:
D03 SIGABRT **477772/start 4562349**, **501063/start 4636728**; D02 SIGSEGV
**335923/start 3571811**, **353321/start 3701248**, SIGABRT **413296/start 3989180**;
NATIVE-R1 SIGSEGV **251383/start 3043549**; F2 SIGABRT as above.
No cause or C1/F2 disposition. Full native keyboard/a11y/IME, C356 enforcing
SELinux/native highlight input and C04 unreproduced cache failure remain open.
[M6-02](tasks/M6-02.md), [matrix](test-evidence/M6-02-matrix.md),
[review](reviews/2026-10-03-m6-02-persistence-review.md) and
[evidence](test-evidence/M6.md#m6-02--persistence-interruption-and-operation-investigation)
retain Save As/IME, shared-store lease scope and parent-SIGKILL Btrfs abort.
M6-03 copy/prune and capture-failure bundle policy remain open. Copied binaries
must preserve helper-resource layout from the
[native guide](../tests/native/writing-lifecycle/README.md).

## Next action

F4-05 complete; one local `AUDIT-PARK-H-F4-05` commit on main, no push. Stop
at this boundary. Owner: review local commits and resolve the docs-only F4-04
divergence before any push. No next sub-task is scheduled; group F needs its
own scope before implementation. No Local v1/C1/F2/full-platform closure; DEV-02 remains owner-only.
