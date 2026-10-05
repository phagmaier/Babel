# ADR 0042 — Typed-as-other-syntax fallback saves only as Action or in-speech Dialogue

Status: Accepted. Date: 2026-10-05. Task: AUDIT-PARK-H-F4-04. Authority: [SPEC S03/S05](../../SPEC.md#s03). Related: [ADR 0027](0027-uncapturable-draft-preservation.md), [brief](../tasks/AUDIT-PARK-H-F4.md#f4-04-deliverable-and-acceptance).

## Decision

A typed row Fountain reads as another element saves with its exact bytes
plus recovery-only typed-element intent only when those bytes parse as one
editable line of kind Action — or kind Dialogue still inside its speech.
The typed element lives in recovery only; the recovery schema version is
unchanged and `DraftKind` gains `transition`, the one typed element that
never had an intent value. Every such row carries one
advisory Script Check issue naming the row, the typed element and the
element on disk; advisory never gates export.

## Why only Action (or in-speech Dialogue)

Action is the one container that prints the author's exact words without
restructuring anything: no speech is joined or split, no page semantics
change, and no text is hidden from print. Dialogue inside an intact speech
is the same. Every other forced reading misleads without recovery: a cue
rewires the speeches around it, a heading paginates, a section or synopsis
does not print at all, and centered/transition/lyrics change the element a
reader sees. Refusing those with the named-row alert is safer than saving
them somewhere they read as something they are not.

This is why, of the Dialogue forcing markers, only `!` saves: it is the
only marker whose forced element is Action. `@`, `>`, `~`, `# `, `=`, `.x`
and `===` force a cue, transition, lyrics, section, synopsis, heading or
page break, so they stay refused. A `!` that would end a speech mid-list
also stays refused: no context-preserving spelling exists, and rows the
author did not touch are never rewritten to keep one.

## Rejected

Forced-marker respelling (for example `!# x` for a `# x` heading) changes
the author's bytes to buy an element Fountain cannot otherwise hold; S05.5
keeps authored text in the Fountain file, and the marker would still read
as Action. Refusing the keystroke contradicts free typing; extending the
parser to read more syntax breaks Fountain portability. Cascading the
fallback through following speech rows would touch rows the author did not
edit and is deferred, not scheduled here.

## Consequences and evidence still needed

Reopened without recovery the row is Action (or Dialogue), `!`-stripped
where a forcing marker applied; the bytes never change. The print profile
may still gate export where its reading differs (as with F4-03 rows), and
an orphaned cue may warn SC001; both are pinned by tests, not fixed here.
[Evidence](../test-evidence/AUDIT.md#audit-park-h-f4-04--typed-text-fountain-reads-as-other-syntax)
records the red-first suite, the old-against-new differential and the
native phase. Cascade-through-speech and group F shapes remain refused.
