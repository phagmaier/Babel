# ADR 0031 — Exact-source outline move transactions

Status: Accepted direction. Date: 2026-09-30. Task: M4-05.
Authority: [SPEC S05.4/S06.3/S07.7/S08.3](../../SPEC.md#s08), NAV-01, DOC-02/03/04, EDIT-05; [ADR 0029](0029-versioned-manuscript-index.md), [ADR 0030](0030-version-bound-workflow-protection.md).

## Decision

Move complete physical source spans using a codec-document-branded index and an immutable, branded exact-byte permutation plan. Preserve the BOM at the prefix and every existing row's content/ending; no separator repair or marker conversion. Reparse with reordered recovery IDs and validate all row meanings/owners and outline relationships. Keep literal preceding synopsis/note/blank ownership and display ambiguous candidates as moves/stays before explicit Apply. Scenes stop at every heading and may transfer beside another section's scene. Sections include their entire subtree and require a destination at the same parent/authored level. Original/candidate copies survive refusal; an unterminated EOF moved into another row is refused.

Prepare outside the typing/dispatch path and bind the immutable live state/session/version. Rebase source origin through a specifically authorized transaction, retaining IDs/content/marks and refreshing source-dependent metadata against the verified candidate. This permits complete protected spans to move without allowing ordinary edits to their content. Undo/Redo restores exact origin, document and selection as one isolated event; versions keep advancing. A selection fully inside the moved span follows row IDs/offsets; otherwise the caret follows the moved heading. Dispatch rechecks the original frame, composition and actual acceptance. Both pointer and keyboard controls use the same plan; cross-panel/stale drops refuse. A coalesced re-capture of the identical session/version/document does not invalidate an in-progress drag. Outline handles use panel-owned pointer capture with a six-pixel gesture threshold, cancellation and same-panel hit testing; foreign HTML drops are inert. The reference GTK/WebKit host completed native HTML drags without delivering a drop even after trusted target dragover, so no OS data-transfer negotiation authorizes the manuscript operation.

Large moves use the existing native recovery/safety receipt and frozen session guard. No new filesystem privilege, native parsing, dependency, independently mutable source authority or history engine is added. Ordinary Save remains independent of history failure.

## Alternatives and consequences

Rewriting moved rows through the ordinary line-edit serializer could change endings/forcing markers and cannot safely permute protected regions. Importing the whole candidate through the existing import command would allocate fresh IDs and lose move identity. Automatically adding an EOF separator would change authored bytes. The selected explicit origin rebase instead validates exact bytes before authorizing one editor history event, with review/refusal when a faithful permutation is unavailable. Section reparenting/level conversion is a separate explicit authored change, outside this move command.

## Evidence still needed

[M4-05 evidence](../test-evidence/M4.md#m4-05--reversible-scene-and-section-moves) records focused/shared/native byte/selection/protection checks and retained failed attempts. M4-15 owns broader workflow integration and separate safety review; M6 owns full performance, other platforms, installed/offline and adoption gates. No full milestone or Local v1 claim.
