# ADR 0021 — Production editor source captures

Status: Accepted direction. Date: 2026-09-29. Task: M3-04. Authority: [SPEC S04/S05.4/S06.3/S07/S10.2](../../SPEC.md#s04), EDIT-01/05, DOC-01–04, SAVE-02, INV-03/05/11/12/14. Context: [ADR 0003](0003-editor-and-native-ownership.md), [0007](0007-source-aware-fountain-contract.md), [0008](0008-native-editor-input.md), [0015](0015-versioned-persistence-ipc.md). Evidence: [M3-04](../test-evidence/M3.md#m3-04--sole-editor-authority-and-source-bridge).

## Decision

Use one ProseMirror EditorState with typed physical source-row nodes, inline marks and a private source-origin plugin. The plugin retains the immutable original codec document, a session reference and monotonically increasing version. Current text/styles come only from the editor document. Source derivation occurs at explicit deferred capture, never inside synchronous transaction filtering. There is no independently mutable Fountain peer or source result that writes back into the editor. Physical rows preserve source blanks and break relationships; visual wrapping does not add rows.

Ordinary text/mark changes retain node IDs/type/origin fields. The initial bridge refuses structural/type/identity/protected-region transformations until their explicit owned-context commands are implemented. DOM reparsing retains owned origin attributes and whitespace; transaction guards validate them against the existing state and reject foreign mark types. Paste/drop remain refused until M3-08's input policies. Undo restores source spelling and selection while advancing versions; history does not roll back the version counter.

M3-05 supplies the explicit structural command path while keeping that single-state/capture boundary. New row IDs advance in the state plugin across undo, and codec captures retain requested IDs while refusing neighbor drift. Complete standalone Note edits use whole-region concrete source ownership; other hidden/raw regions retain the protected boundary. [M3-05 evidence](../test-evidence/M3.md#m3-05--smart-keys-joins-and-structural-undo) records the bounded key/native gate.

Empty source has one virtual Action with the codec's first prospective ID, but no portable source row. First typing creates ordinary LF action; undo restores zero bytes. Invalid encoding remains view-only with exact byte copies and no invented Unicode anchors. Caret derivatives bind live IDs and source-row indices to UTF-16, UTF-8 and grapheme coordinates, including an intra-grapheme offset rather than rounding combining text away.

Captures carry owned source bytes, exact version, hash, ranges and selection. The application capture boundary defers serialization/hashing, admits at most two active requests and checks existing native source/metadata bounds. Results are current only for their originating boundary, editor session and version; consumers recheck before applying derived results. An old capture may be retained as historical protection, but cannot label newer editor edits saved. Production cadence/receipt integration remains M3-10.

The producer's `babel-editor-capture-v1` JSON metadata is a sparse, hash-bound derivative: selection anchors, virtual-placeholder flag and line-indexed incomplete intent/Shot. It excludes the full source inventory and IDs do not become Fountain syntax. Native framing/admission remains unchanged; restoring this producer metadata from native recovery requires M3-10 integration and validation. Domain recovery inventory schema 1 remains available for exact-source state construction; this task does not claim native restoration of the new projection.

If a live draft cannot serialize faithfully, capture refuses and the editor retains it. `copyEditorDraft` provides complete current rows/styles and an exact original source copy for review/recovery. That bundle is not a successful portable Fountain save or a saved receipt. Later persistence workflows must protect/refuse visibly, never substitute the original source as if it represented the latest draft.

## Consequences and alternatives

Synchronous whole-source grammar filtering would put parsing/encoding on typing. A mutable serialized cache could disagree with nodes or resurrect old hash results. Rebuilding the editor from every capture would lose caret/history and create races. Those alternatives are rejected. Full source derivation is deferred but still runs on the frontend; actual large-script capture latency/worker need must be measured in M3-08/10. Foundation tests do not claim a typing/paint budget pass.

Promote the already pinned model/state/history/view packages to runtime; keep proof-only commands/keymap/schema-basic in dev dependencies. [Exact editor notices](../third-party/editor-runtime.md) record direct/transitive licenses. Default app activation, native picker, smart keys, real IME, save cadence and installed packaging remain separate gates.

Evidence still needed: M3-05–08 structural commands and full native input/undo matrix; M3-10 recovery projection restoration and measured capture/cadence integration; M3-12/13 production lifecycle and native writing; M6 complete distribution/offline/adoption review.
