# AUDIT-PARK-H-F3 — actionable capture-refusal wording

Status: **done 2026-10-04**; base `5a707b8`.
[Evidence](../../test-evidence/AUDIT.md#audit-park-h-f3--actionable-capture-refusal-wording).
The drafts listed below stay refused and are tracked as AUDIT-PARK-H-F4.
Dependencies: AUDIT-PARK-H finding H3 (both alerts are internal codec
messages; neither names the row that stops saving nor says how to resume), F1
and F2 complete. The owner delegated wording and implementation decisions on
2026-10-04. Push authorization is unchanged.
Requirements: SPEC S03 (saving, recovery and close are distinct and none may
silently lose work), S07.2, EDIT-02, INV-01/04;
[editor behavior](../../editor-behavior.md#m3-05-structural-commands-and-safe-source-boundaries).

## Remaining unsupported drafts (probed before edits, base `5a707b8`)

Accepted by the editor, refused by deferred capture, so nothing typed anywhere
afterwards is saved or journaled until the row changes:

- Parenthetical with text outside its parentheses (`(beat) x`, `x(beat)`), or
  split mid-row.
- Scene Heading whose typed text is a leading space, a leading `.`, or a
  `#number#` suffix; a numbered heading with its text deleted; a heading
  emptied at an unterminated end of file.
- Transition ending in `<`; Section starting with a space; Character ending
  in ` ^`.
- First Dialogue row of a speech emptied, or converted to another element,
  while Dialogue remains below it.
- Typing on the blank row between dual-dialogue cues.

Not reproduced: edits beside protected rows, recorded as refused under
AUDIT-C01, captured in all thirteen cases this probe tried.

This task does not make any of them capturable. Where an edit strands a
neighbour, the codec names the stranded row (the Dialogue below an emptied or
converted first line, the dual cue beside a typed blank), not the row typed in.

## Deliverable and acceptance

1. The capture alert, and the same failure after an explicit Save, state in
   author language that saving and recovery are paused, which row cannot be
   written (`Row N`, element label, quoted excerpt, or "an empty …"), how to
   resume (change that row or Undo), and that Close session offers an
   emergency copy. No internal codec phrase reaches the author.
2. The row comes from the codec, not a guess: a per-edit refusal carries the
   offset of the submitted edit, and the source bridge records the live row it
   belongs to. When the codec names no single edit, the wording names no row.
3. Error codes, messages, the accepted/refused set and every captured byte
   are unchanged. The alert still retires itself once capture resumes.
4. Red tests before the fix: codec offset, bridge row (single-row and
   multi-row changed ranges, no row when none is named), exact wording, and a
   mounted WritingView case showing the alert, no save or checkpoint while
   refused, and resumption carrying text typed elsewhere meanwhile.
5. Native: one new phase in the `empty-heading` drill shows the alert in the
   real app, the unchanged file, and resumption, on tmpfs and Btrfs.

## Do NOT do

Make any refused draft capturable or change what the editor accepts; change
native save/recovery/journal/lease/IPC code, parser classification, codec
error codes or messages; add row navigation or highlighting; reword command
refusals, close-panel or status copy; rewrite fixtures or frozen root
AUDIT.md; implement other parked findings; push.

## Checks and stopping

Tier 2 frontend (codec error metadata, bridge, UI text): focused red then
green, `pnpm check`, tracked frontend count, helper, browser smoke, Rust
format/clippy/workspace on one filesystem (no native change), fresh release
build. Native: the named `empty-heading` mode only, tmpfs and Btrfs, with the
task-owned Btrfs IME-wrapper root; the other five capture modes are omitted
because no capture success path or byte changes. Update editor-behavior,
TODO/current-state and append-only audit evidence. One F3 task-ID commit on
main; finish `git diff --check` and stop.
