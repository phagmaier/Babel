# AUDIT-PARK-H-F4-REVIEW — group closure review

2026-10-05; clean base `ceca040c769d4156a6b3198fd73021d46b4cc7e9` on `main`,
13 local-only commits ahead of published `f2ba0c5` before this task.
[Brief](../tasks/AUDIT-PARK-H-F4-REVIEW.md). Tier 1 documentation/artifact
review, with existing-case JSDOM confirmation; no new build or native trial.
Logs/manifests: `target/audit-park-h-f4-review/`.

## Disposition

**F4-01–05 remain complete; the whole F4 group remains open.** Completing its
five scheduled slices is insufficient for closure: group F was explicitly
unscheduled, and accepted ordinary drafts still stop source capture. Retirement
would discard a live protection obligation without repair or explicit acceptance.
Neither closure, retirement nor acceptance is performed here.

The tracker previously said to close once all five sub-tasks were done, while
the group brief retained group F. Its examples also still described the repaired
closed-parenthesis Dialogue and guarded heading-formatting command. The tracker
now names residual triggers and links this ledger; the original probe's
**229/848** is historical, not a current refusal count. No probe is regenerated.

## Completed slice evidence

These are historical results at the named commits, not fresh native verification
of `ceca040`. Review compared the original deliverables with the retained reports
and current tests; the fresh existing-case run below also passes all five slices.

| Slice / completed commit | Accepted scope and retained evidence                                                                                                                                                                                                             | Reach that does not expand                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F4-01 / `5c91657`        | Formatting/conversion refuse unsafe commands without document/selection/Undo changes; 27,069-command comparison preserved previously saving cases. [Evidence](AUDIT.md#audit-park-h-f4-01--commands-refuse-instead-of-creating-a-refused-draft). | Typed drafts and dual-pair transformations were excluded; the proposed Parenthetical Enter refusal was withdrawn to preserve the pinned contract.                                |
| F4-02 / `15d5da8`        | Emptied speech rows retain the two-space Fountain spelling and recovery intent; 31,440-capture comparison; mounted save/journal and native phase F. [Evidence](AUDIT.md#audit-park-h-f4-02--emptied-speech-rows-keep-their-speech).              | Other unwritable rows and protected neighbors can still stop the whole draft.                                                                                                    |
| F4-03 / `3d55fca`        | Closed-parenthesis speech becomes editable/savable; exact recovery intent; 27,260-capture comparison; native phase G. [Evidence](AUDIT.md#audit-park-h-f4-03--speech-that-opens-with-a-parenthesis).                                             | Prefix text before `(` stays refused. New-intent recovered reopen is contract level; unclosed imported parentheses stay protected.                                               |
| F4-04 / `409d3f3`        | Exact editable-Action fallback plus advisory SC009; 690-capture comparison, 28 newly saving shapes; native phase H. [Evidence](AUDIT.md#audit-park-h-f4-04--typed-text-fountain-reads-as-other-syntax).                                          | Native phase H covers Dialogue only. Heading/Character/Transition intent and recovered reopen remain contract-level; restructuring markers and speech-breaking `!` still refuse. |
| F4-05 / `8084690`        | Local ending retains an emptied unterminated physical row; 13,792-edit comparison, 176 newly saving shapes; literal native phase-I byte audit. [Evidence](AUDIT.md#audit-park-h-f4-05--emptied-unterminated-last-rows).                          | Numbered headings stay refused with authored numbers intact. CR/mixed endings and phase-I recovered reopen remain contract-level. Historical PARK-H-F2 SIGABRT remains open.     |

## Residual ledger

None of these rows is an accepted limitation or newly selected implementation.
Existing emergency copying preserves a frozen draft only when explicitly invoked;
it grants no Fountain-save or recovery-journal credit
([ADR 0027](../decisions/0027-uncapturable-draft-preservation.md)).

| Residual trigger                                                                                                                          | Existing evidence and current confirmation                                                                                                                                                                       | Protection / visibility                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Group F: Parenthetical text before `(`, e.g. `x (beat)`                                                                                   | `speech-parenthesis.test.ts`, `capture-refusal.test.ts`, and the F3 case in `WritingView.test.tsx` pass fresh.                                                                                                   | Named-row alert says saving/recovery paused. Injected UI confirms later text in another row reaches neither save nor journal, status stays Changes pending, explicit Save repeats the refusal, and repairing the row saves/journals all pending text. |
| Group F: Enter inside a Parenthetical                                                                                                     | `editor-keys.test.ts` case “middle Character and Parenthetical splits” passes fresh; [editor contract](../editor-behavior.md#m3-05-structural-commands-and-safe-source-boundaries) explicitly retains the split. | Both rows retain every character in EditorState; capture refuses. `copyEditorDraft` retains both rows and original source, and Undo restores exact original bytes. This case tests the draft bundle, not native emergency publication.                |
| Group F: leading-space Section/Synopsis text                                                                                              | Existing `other-syntax-fallback.test.ts` rows `section: ' Act'` / `synopsis: ' Sum'` pass fresh, pinning `round-trip` and edit offset.                                                                           | Codec refuses; no new saving spelling is established. No mounted or native case for these two shapes was run here.                                                                                                                                    |
| Group F: typing in the blank between paired cues or converting within a dual pair                                                         | Original retained `probe-matrix.out` (“dual blank typed”) and `probe-commands.out` (“convert left dual dialogue -> action”) plus the F4-01 differential's 330 dual conversions.                                  | Historical refusal requires explicit owned group intent; current codec still guards relationship drift. These exact residuals were not rerun. Existing dual-toggle acceptance is a different operation and does not close them.                       |
| Other pinned exclusions: emptied numbered heading, protected-neighbor drift, restructuring markers/hidden/raw shapes, speech-breaking `!` | Current `empty-eof-row`, `capture-refusal`, `speech-parenthesis` and `other-syntax-fallback` suites pass the existing refusal assertions.                                                                        | Authored numbers, protected source and untouched following speech remain guarded. Their preservation is evidence of the guard, not evidence that every ordinary accepted draft is automatically protected.                                            |

## Concrete narrowed follow-up

An eligible future brief can investigate **only Parenthetical prefix text**:
start with the existing `x (beat)` codec and mounted refusal cases, compare the
exact same authored bytes under source-only reading versus existing
`parenthetical` recovery intent, and determine whether capture can preserve both
without parser/schema/neighbor changes. Acceptance for that investigation would
be a literal source/row/intent result, unchanged success/refusal boundaries, and
an explicit feasible-or-blocked mechanism report. It must not implement a spelling
or saved-format change, cover Enter splitting/dual/Section/Synopsis, or run native.
Select and write that brief separately; this review does not start it.

## Checks

The exact focused command and six editable Markdown paths are in the
[brief](../tasks/AUDIT-PARK-H-F4-REVIEW.md#checks-and-stop); pnpm uses pinned
`mise exec node@26.7.0 pnpm@11.22.0 --`. Focused test filter:
`AUDIT-PARK-H|middle Character and Parenthetical splits`; task-local `TMPDIR`.

| Command                                                                    | Kind                                   | Result                                  | Elapsed          | Skip / limit                                                                                                                                              |
| -------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Named eight-file `pnpm exec vitest run ... -t ...` from brief              | JSDOM contract / injected UI           | **188 passed, 99 skipped**, eight files | 24.80 s          | Filter skips unrelated cases; no fresh native evidence. Exact argv/env in `focused-result.json`, log `focused.log`.                                       |
| `pnpm exec prettier --check` on six editable paths                         | Static                                 | Pass                                    | 0.90 s           | Touched documentation only.                                                                                                                               |
| `python3 tools/check-links.py` on six editable paths                       | Static                                 | Pass; 211 links                         | 0.25 s           | Explicit scope includes new documents.                                                                                                                    |
| `pnpm check:guidance`; `git diff --check`                                  | Static                                 | Pass; zero problems                     | 0.59 s / <0.01 s | No budget exception.                                                                                                                                      |
| `python3 target/audit-park-h-f4-review/verify_preservation.py`             | Filesystem byte comparison, not native | Pass; zero changed/missing files        | 0.75 s           | 776 protected tracked files, 11,754 retained F4 files; no missing F4 root. Frozen `base/` source checkouts and symlinks excluded from artifact inventory. |
| Build/lint/typecheck, browser, helper/corpus, Rust/matrix and native modes | Not run                                | Skipped                                 | —                | Docs-only review changes no executable boundary. Historical slice results retain their original reach and failures.                                       |

Protected tracked manifest includes product/tests, fixtures, fixed corpus
inventories/hashes, SPEC/ADRs, frozen root AUDIT.md, all prior evidence and the
native register. The original failure logs and completed evidence are untouched.
Initial static checks passed format, 211 links and diff; guidance correctly
rejected the draft handoff at 121 lines. Compacting the session summary restores
the 120-line budget without removing safety obligations; initial logs retained.
M6-02 stays unchecked; M6-03/C1/F2/Local v1 and owner S15.5 disposition stay
blocked. No register change, crash closure, risk acceptance, pruning or remote
operation. Stop after the local task-ID commit.
