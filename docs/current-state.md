# Current state — M1-06 bounded composition proof passed

Date: 2026-09-28 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [proof plan](editor-composition-proof.md), [M1-06 evidence](test-evidence/M1.md#m1-06--bounded-codeceditornative-composition-proof).

## Completed task and trust boundary

**M1-06 completed its bounded investigation on main: the declared text-edit subset passes on the reference Linux/WebKit host.** Implementation base `d64f3ab` contains owner-accepted writer `5e84879`; starting tree was clean with no prior dirty paths. M0, bounded M1-01–05 and M2-01–04/05A/B retain their recorded completion. Parent M2-05/full M2 exit remain open; no Local v1 requirement completion is claimed.

The [diagnostic](../prototypes/editor-composition/README.md) composes typed heading/action/cue/dialogue nodes, immutable original source data inside one EditorState and the existing native controller/writer. Real WebKit input proves Unicode typing, same-line selection replacement, undo/redo with restored content/selection and newer versions, exact native checkpoint/source receipts, safe save and native reopen. Literal LF/BOM-CRLF/no-final-newline oracles, current ranges and Unicode anchors were independently audited. Native external-change refusal preserves external source and independently checksum-verified local recovery on tmpfs/Btrfs.

The default product remains a disabled writing shell with read-only startup recovery inspection and an uninitialized production picker/writer. Editing, source-save/reopen UI, Save As, retention/protected close, history and remote operations remain unavailable. **Do not use important manuscripts.**

## Paths and ownership

- `prototypes/editor-composition/`: bounded model/page, literal fixtures, synthetic seed and native input/matrix/independent audit scripts.
- `tests/contract/editor-composition.test.ts`: 12 source/editor conformance checks.
- Proof-only `src-tauri/src/editor_composition_proof.rs` and `src-tauri/tauri.editor-composition-proof.conf.json`; narrowly gated lib/feature registration. Fixed fixture IDs map to native filenames beneath an explicitly marked private synthetic root; no frontend path/shell endpoint.
- `package.json`/`pnpm-lock.yaml`: pinned direct dev exposure of already locked MIT `prosemirror-model` 1.25.12; no runtime promotion or new Rust dependency.
- Coordinator docs: TODO, current-state/index/requirements, proof plan, document-model/editor-behavior, architecture/testing/development and the single M1 evidence section.
- Existing codec, core writer, native input prototype, root fixtures, production frontend/config/capabilities and Cargo.lock preserved. Synthetic Btrfs roots were archived outside the repo and removed after owned processes ended.

## Checks and limits

Exact commands, host, logs, fixture hashes, observations and reviewed conclusion are recorded once in [M1-06 evidence](test-evidence/M1.md#m1-06--bounded-codeceditornative-composition-proof). This handoff's final checks are recorded there.

Passing implementation checks: 12 source/editor entries; 21 composition-feature desktop entries with MockRuntime/native files, four proof entries repeated on Btrfs; real WebKit roundtrips for all three newline fixtures and external-change refusal on both filesystems; independent native byte/semantics/range/anchor/receipt audit; 141 host workspace entries; default/feature/combined Clippy and proof/default builds. The initial sandbox workspace ACL fixture was blocked by its single-UID mapping; the approved actual-host run passed without disabling a check. One proof producer duplicate-version capture bug was fixed before any native write; no native crash/source loss was observed in completed cases.

The proof's synchronous grammar filter is bounded to 32 lines/4 KiB. Timing observations are tiny-fixture frame proxies, not a production performance pass. Full Fountain/renderer conformance, structural editing/undo, IME, transient empty drafting intent, large-document responsiveness, reopen selection restoration, power loss, other platforms and installed-package adoption remain open. Earlier-session recovery adoption is not bypassed. Same-disk copies are not disaster backups; advisory checks cannot exclude arbitrary external writers.

## Next safe action

Review this bounded conclusion/checkpoint and select subsequent work explicitly. **M2-05C was not started and remains outside the owner's requested scope.** Production M3 still requires full M2 exit/decomposition. Work on main with task IDs in commit messages; do not push without human review and explicit authorization.
