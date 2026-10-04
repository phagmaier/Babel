# ADR 0007 — Source-aware Fountain contract after M1-01

AUDIT-SLP-B (2026-10-03) retired superseded proof programs; linked deleted
sources use the last pushed pre-deletion snapshot. Historical observations and
failures below remain unchanged. [Retirement scope](../tasks/AUDIT-SLP-B.md) and ported production
coverage are recorded separately; no new admission claim.

Status: Accepted direction. Date: 2026-09-27. Task: M1-01. Sources: [SPEC S05–S07](../../SPEC.md#s05), [official Fountain syntax](https://fountain.io/syntax/), DOC-01–04, EDIT-01, INV-02/03/11. Evidence: [M1 report](../test-evidence/M1.md), [fixtures](../../fixtures/fountain/README.md), [disposable prototype](https://github.com/phagmaier/Babel/blob/fb7d6bd5bf034458afd950d5f9632382b6d5b99b/prototypes/fountain/codec.ts).

## Context and decision

The author needs a structured editor while ordinary Fountain remains the portable content. M1-01 proves a small immutable, source-aware line model: each parsed line has a byte span, interpreted type, and relevant fields. A no-op returns exact source bytes. A selected edit replaces only its line, retains the existing newline and every other byte, reparses, and rejects the operation if the requested type/text or any neighboring interpretation changes. Explicit type changes use standard Fountain forcing markers. Invalid UTF-8 opens read-only with an exact byte copy; an unknown region remains raw and cannot be converted by this proof.

For M3, the editor transaction state is the **sole live authoring authority**. The codec is a deterministic boundary from an immutable source snapshot to editor nodes and back; React views and native services receive versioned derived/saved snapshots, not writable peer copies. Stable editor IDs are transaction metadata, not inserted Fountain syntax. A single edit transaction owns its changed source range and its neighboring grammar validation. The M1 prototype stays isolated from app code until the M3 codec/editor conformance suite is designed.

## Alternatives and consequences

A generic Markdown AST would reinterpret Fountain markers and whitespace. A wholesale pretty-printer would lose no-op bytes and obscure local edits. A second mutable raw buffer would permit disagreement with the structured editor. The selected boundary keeps original source material and makes uncertain conversions explicit. It may need larger grammar-context replacements for edits spanning lines; those must be proved before M3 integration.

## Known exceptions and next proof

- The prototype is deliberately a subset, not a complete Fountain parser. It preserves inline emphasis and escaped literal markers as text but does not expose editable inline marks. Standalone multiline notes, boneyards, title fields, and raw extensions are preserved but structured editing inside them is outside this proof.
- An incomplete forced character cue remains in source with a diagnostic; another Fountain application may read it as action. Empty character/dialogue intent and selection require recovery metadata. The proof does not claim external semantic equivalence for those states.
- Two spaces on a dialogue separator are preserved as a dialogue line. Other unusual whitespace, multiple title layouts, malformed or nested markers, hard breaks, and full context-spanning edits still need independent conformance fixtures. The current prototype rejects a local edit when its reparse changes neighboring semantics; it does not invent a conversion.
- M1-02 must prove native selection, IME, and undo. M3 must implement the complete loss-aware codec and editor integration, with an independent Fountain renderer comparison, source byte/semantic fixture corpus, selection/undo tests, and source-preserving fallback for unsupported input. No production editor or save path is certified by M1-01.

M3-02/03 implement the production immutable codec and bounded complex context edits under this direction. The [current model contract](../document-model.md#m3-03-complex-source-structures-and-editing) defines title/hidden/dual/inline/break structures and protected unknown source. [AUDIT-SLP-C](../tasks/AUDIT-SLP-C.md) retires the unused inline/hidden helpers and conversion proposals; independent original/edited fixture bytes remain parser evidence, and current editor paths retain supported edits. M3-03 conversion checks remain historical evidence. [M3-03 evidence](../test-evidence/M3.md#m3-03--complex-fountain-regions-and-inline-semantics) records production byte/semantic/renderer checks with explicit gaps; the prototype exceptions above remain historical proof limits.

M3-04 passes bounded production text/mark/source/caret/undo and native WebKit capture checks under [ADR 0021](0021-production-editor-source-captures.md). See [M3 evidence](../test-evidence/M3.md#m3-04--sole-editor-authority-and-source-bridge); structural commands and default-app activation remain open.

Evidence still needed: M3 structural source/undo and full native input/persistence integration; complete interoperability beyond the declared renderer subset, including later PDF gaps. Existing native observations remain bounded and do not certify full production adoption.
