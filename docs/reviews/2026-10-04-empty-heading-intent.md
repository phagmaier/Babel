# AUDIT-PARK-H-F2 — empty-heading intent reach

Investigation before product edits, base `fc43779`, 2026-10-04.
[Task](../tasks/AUDIT-PARK-H-F2.md).

The owner delegated implementation decisions for this continuation. Choose a
repair rather than leave unrelated authored text unjournaled behind an empty
heading. This fits the existing SPEC S05.5 recovery-only empty-block contract
and ADR 0002; it requires no new source syntax or native storage decision.

| Boundary               | Existing behavior and proposed reach                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codec                  | `DraftKind`, `compatibleDraft` and `draftIntent` accept character/dialogue/parenthetical intent. Empty headings generate `.` and fail the checked round-trip. Add heading intent only for an actually empty physical blank; complete headings keep their existing spelling.                                                                                                            |
| SourceBridge           | `editForNode` already submits the live row kind/text to checked `replaceLines`; matching/recovered rows already use `intendedKind`. No bridge bypass or parser classification change is needed.                                                                                                                                                                                        |
| Capture                | `EditorCaptureBoundary.captureState` already emits sparse `{index, intendedKind}` entries with source SHA-256, bounded metadata and current selection. No full editor mirror or schema change is needed.                                                                                                                                                                               |
| Native checkpoint/save | `recovery.rs` frames, bounds and checksums opaque JSON with exact source bytes; `recovery_store.rs` compares exact-version source and metadata. Native code does not enumerate draft kinds. Existing transport needs no change.                                                                                                                                                        |
| Explicit recovery      | `startup_reader.rs::resume_local_recovery` returns full revalidated source plus unchanged metadata under a fresh identity, preserving the original checkpoint. `WritingSession` verifies the producer schema/source hash; `editorRecovery` additionally validates indexes/kinds and the codec checks exact inventory and compatible content. Extend only that frontend kind allowlist. |
| Ordinary source reopen | The Fountain file contains a blank, so opening the source without selected recovery metadata shows Action/blank. Safe identical-source reconciliation does not automatically adopt editor metadata. Do not change this admission policy.                                                                                                                                               |

The selected representation is `sourceText: ''`, `kind: blank`,
`intendedKind: sceneHeading`. Existing authored blank bytes stay untouched;
new physical rows inherit the checked transaction's local newline. Completing
the heading drops sparse intent and uses ordinary forced/natural heading
syntax. Undo/Redo must capture every intermediate state with current intent.

Preserve these limits: no metadata can reinterpret nonempty, malformed,
protected, numbered or foreign source as an empty heading; stale hashes and
incompatible inventory remain rejected. An empty replacement that would erase
an unterminated physical EOF remains refused. A zero-byte virtual placeholder
has no physical row and retains the existing behavior; persisting its picker
choice is outside this task. Other uncapturable drafts still use the verified
emergency bundle route from ADR 0027.

Source inspection is not native proof. Run focused red/green capture and
metadata tests, then the brief's shared/browser/release gates and native
save/journal/owned-kill/explicit-resume checks on both filesystems. Historical
PARK-H data-loss and F1 harness failures stay in the append-only evidence.
