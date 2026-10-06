# AUDIT-PARK-H-F4-PREFIX — Parenthetical prefix mechanism

2026-10-05; clean base `18c4314090f363cf7df1784c221d0c4e2e558876` on `main`,
**15** local-only commits ahead of published `f2ba0c5` before this task (the
owner's prompt said 14; Git verified 15). [Brief](../tasks/AUDIT-PARK-H-F4-PREFIX.md).
Logs, exact argv/env/results and preservation manifest:
`target/audit-park-h-f4-prefix/`. No product or native change.

## Disposition

**The current mechanism cannot capture/recover prefixed Parenthetical intent.**
The literal bytes fit existing editable Dialogue inside the same speech without
neighbor drift, and both recovery schemas already represent `parenthetical`.
However, matching hashes and schema membership do not admit that intent: current
serialization and compatibility rules deliberately reject it.

An unchanged-parser/schema correction is a **plausible bounded extension**, not a
proven repair: it must change three codec gates consistently, preserve the exact
text and pass new acceptance evidence. No such extension is implemented or
selected here. F4/group F remains open; no retirement or limitation acceptance.
The [review's residual ledger](AUDIT-PARK-H-F4-REVIEW.md#residual-ledger) remains
historical and unchanged.

## Literal control and recovery results

[Named reproducer](../../tests/investigation/f4-prefix.test.ts) contains two
handwritten sources, not a generated corpus. Their complete escaped literals,
byte lengths and independently computed SHA-256 values are retained in
`literal-sources.json`; LF is 25→27 bytes, BOM/CRLF is 58→60 bytes.

| Observation                              | LF                                                                                  | BOM/CRLF with unknown region                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Source spelling                          | `@BOB\nx (beat)\nHi.\n\n!After.\n`                                                  | `\ufeff@BOB\r\nx (beat)\r\nHi.\r\n\r\nopaque [[unknown]] tail\r\n!After.\r\n` |
| Explicit Dialogue edit control           | Exact literal bytes; row 2 is editable Dialogue `x (beat)`                          | Exact literal bytes, including BOM, CRLF and protected raw row                |
| Cue / following row                      | Both edited row and `Hi.` belong to unchanged cue `b0`                              | Same                                                                          |
| Unaffected rows                          | All line fields/IDs equal; source offsets after row 2 increase by exactly two bytes | Same; raw region remains protected and verbatim                               |
| Source-only reopen                       | Dialogue `x (beat)`; no-op capture keeps exact bytes                                | Same                                                                          |
| Hash-bound `parenthetical` envelope      | Hash verifies; sparse entry expands into recovery `intendedKind: parenthetical`     | Same                                                                          |
| Codec recovery / editor reopen           | `recovery-mismatch`; intent ignored, exact text opens as Dialogue                   | Same                                                                          |
| Metadata with original unprefixed source | Rejected by hash verification                                                       | Same                                                                          |

The Dialogue edit is a control with an explicit type choice; it does not save an
actual prefixed Parenthetical draft. Accepted typing keeps that editor row as
Parenthetical and capture still throws `invalid-edit`, message
`Parenthetical must begin with an opening parenthesis`, naming row 2 and its exact
text. Refusal preserves the state/selection; Undo restores the original bytes,
and Redo restores the same refused Parenthetical. No silent conversion occurs.

The same sparse metadata shape on supported `(beat) x` passes compatibility,
restores a Parenthetical editor row and captures the exact bytes. This control
isolates a text-shape restriction rather than a missing schema value. Recovery
entry injection is test-only; it is not native journal publication or adoption.

Fresh existing-case confirmation also covers `x (beat)` / ` (beat)` refusal and
the mounted F3 workflow: other-row edits reach neither injected save nor journal,
status stays Changes pending, explicit Save repeats the named refusal, and
removing the prefix resumes both with all pending text. This preserves the open
ordinary-writing protection gap rather than accepting emergency copying as closure.

## Gates and one narrowed follow-up

Static inspection of [fountainCodec.ts](../../src/domain/fountainCodec.ts):

1. `sourceFor` rejects nonempty Parenthetical text not starting with `(` before
   any source transaction. Removing only this refusal is insufficient.
2. `draftIntent` emits nonempty Parenthetical intent only for text starting with
   `(` and not forming one wrapped pair. Prefix text would still carry no intent,
   so `replaceSpelled` would reject the parsed Dialogue/Parenthetical mismatch.
3. `typedInSpeech`, used by `compatibleDraft` and `draftText`, also requires the
   literal source to start with `(`. It rejects the injected prefix intent in
   `applyRecovery`; incompatible entries invalidate the recovery inventory.
   Merely recognizing the intent in metadata verification cannot restore it.

`DraftKind`, the strict sparse metadata parser and both schema versions already
carry `parenthetical`; no new value is needed. The existing transaction validates
the edited row and guards every untouched neighbor. The Dialogue control proves
the exact canonical source does not require neighbor rewriting or parser changes.
It does not prove every prefix/mark/context shares that property.

The next useful task, **if separately selected**, is a cue-contained prefix repair:
define a narrow editable, marker-free speech eligibility rule; coordinate these
three gates so exact source plus existing intent restores the Parenthetical;
retain protected/unclosed/raw/hidden/restructuring and neighbor guards. Require
red-before-fix literal tests, stepwise prefix typing, sparse recovery/repeated
capture, source-only reopen, selection and Undo/Redo, injected save/checkpoint,
and the fixed capture differential. Review/update owning contracts for expanded
admission. No changed successful bytes or new refusal is acceptable.

Untested here: repaired capture/adoption, prefix text outside a cue, marked or
restructuring prefix shapes, native save/reopen, all mid-row splits, Section/
Synopsis and dual-pair residuals. Native work remains owner-only and requires
separate selection; no automatic trial or retirement follows this report.

## Checks

PnPM commands use pinned `mise exec node@26.7.0 pnpm@11.22.0 --`; both focused
commands are written verbatim in the brief. Task-local `TMPDIR`; timings below
are command durations, not summed task wall time.

| Command                                                                    | Kind                                          | Result                     | Elapsed       | Skip / limit                                             |
| -------------------------------------------------------------------------- | --------------------------------------------- | -------------------------- | ------------- | -------------------------------------------------------- |
| Named prefix investigation                                                 | JSDOM contract / test-only metadata injection | 7/7 pass                   | 1.64 s        | Characterizes refusal; no product repair                 |
| Named three-file existing-case command                                     | JSDOM contract / injected UI                  | 40 pass, 71 skipped        | 10.39 s       | Filter excludes unrelated cases; no native credit        |
| `pnpm lint`; `pnpm typecheck`                                              | Static                                        | Pass                       | 4.87 / 8.10 s | Investigation TS included                                |
| Touched-file Prettier; six-path link check; guidance; diff check           | Static                                        | Pass                       | Unknown       | 214 links; exact timings in result JSON                  |
| `python3 target/audit-park-h-f4-prefix/verify_preservation.py`             | Filesystem byte comparison, not native        | Pass; zero changed/missing | 2.53 s        | 778 protected tracked / 11,754 retained files            |
| Product builds, corpus/helper/renderer gates, browser, Rust/matrix, native | Not run                                       | Skipped                    | —             | No executable product boundary changed; no release claim |

Initial investigation assertions failed 7/7 because typed-array equality crossed
JSDOM realms and an omitted property was compared with an explicitly undefined
property. Replacing those assertions with exact byte-array comparisons and an
explicit absent-intent assertion fixes the test harness; no product source changed.
Original `investigation.log` / result remain retained alongside the final pass.
This is not red-before-fix product evidence.

Initial guidance rejected the 122-line handoff. Compacting historical summaries
preserves safety obligations and restores the budget at 119 lines, below 8 KiB;
the original guidance failure is retained. Preservation has no missing F4 root;
frozen `base/` source checkouts and symlinks retain the prior manifest's exclusions.

All owner-only blocks remain: push/tag/amend; native trial/retirement/crash closure;
separate M6-02-R6 S15.5 R4 forced-restart/C1 parent-loss/F2 readiness disposition;
M6-03+/C1/F2/Local-v1 admission (M6-02 + gate P); DEV-02 second host; PARK-T and
D07-F fixes. No native register, prior evidence, corpus, snapshot or product guard
changes. Stop after the report/handoff and one local task-ID commit.
