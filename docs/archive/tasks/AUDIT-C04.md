# AUDIT-C04 — a caret move no longer rewrites the manuscript

Status: **done 2026-10-03; second Wave 1 brief** ([evidence](../../test-evidence/AUDIT.md#audit-c04--a-caret-move-no-longer-rewrites-the-manuscript))
Dependencies: AUDIT-W0 (done). Unblocks D-06 (plain status), which is hard-ordered after this.
Requirements: `SPEC.md:379` (S06.1 no-op fidelity: "prefer not writing at all for a no-op"), `SPEC.md:638` (retained previous generation), INV-05/INV-10 (file-saved credit only from an exact native receipt). M3-10 acceptance "unchanged source avoids replacement".

Covers [C-04](../AUDIT.md#c-04--clicking-or-moving-the-caret-rewrites-the-manuscript-file-with-identical-bytes-medium-m-tier-3). Selection changes deliberately advance the editor version (ADR 0021: draft metadata carries selection anchors), so each caret pause requests a source save of identical bytes. Today that runs the full replacement: new inode and mtime, three manuscript-sized writes, and `previous` overwritten with bytes identical to current.

## Fix — native no-replace acknowledgement

`crates/screenwriter-core/src/documents/source_store.rs`, `save_next_with`: after the recovery checkpoint and the baseline check, when the bytes read from the source equal the request's bytes:

1. Flush the source file and its parent directory and re-validate ownership, exactly as the same-version duplicate branch does.
2. Return a `SaveReceipt` for the request's version with the unchanged baseline fingerprint, the hash of the bytes read from disk, and the fresh recovery receipt.
3. Record it as `last_save` so an exact retry of that version takes the duplicate branch.
4. Write nothing else: no intent, candidate, `previous`, `confirmed`, lease or recents change.

The recovery checkpoint for the new version still happens first, so caret/selection metadata stays journaled. The frontend is unchanged: it already accepts a save receipt whose fingerprint did not change (`src/application/persistenceState.ts`), and file-saved credit still comes only from a native receipt.

## Tests

- `source_store_tests.rs`: a later version with identical bytes keeps inode, mtime and bytes, leaves `previous`/`confirmed`/`intent` exactly as they were (both with no prior transaction and after a real save), journals the new version, and makes an exact retry return the same receipt; an external edit before a same-bytes request still fails `SourceChanged` and changes nothing; a later real edit still replaces and publishes the correct `previous`.
- `src-tauri/src/document_ipc_tests.rs`: the same through the generated `save_document` handler (MockRuntime, real files).

## Do NOT do

Carry the saved version forward in the frontend without a native receipt ([refuted](../AUDIT.md#dropped-or-refuted): mints file-saved credit, breaks INV-05/INV-10). Stop selection changes from advancing the version (ADR 0021). Change `prime()`'s dirty clock, the status wording or the close panel (D-06, after this). Dedupe by hash in `saveCadence.ts`. Any receipt/schema/IPC shape change.

## Checks and stopping

Tier 3 (touches `source_store.rs`, a filesystem-matrix path): focused `cargo test -p screenwriter-core source_store` and `cargo test -p babel-desktop document_ipc`; then Tier 2 shared gates (`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `cargo fmt --check`, `cargo clippy --workspace --all-targets -- -D warnings`); the tmpfs/Btrfs matrix `python3 tools/run-workspace-matrix.py <tmpfs-root> <btrfs-root>`; `pnpm test:browser`; `pnpm tauri build --no-bundle`; and the ordinary save path of the [production lifecycle drill](../../../tests/native/writing-lifecycle/README.md) if the host prerequisites are present — otherwise record it as not run, never as passed. Plus `prettier --check`, `python3 tools/check-links.py`, `git diff --check`. One line per check in `docs/test-evidence/AUDIT.md`, labelled native vs mocked. Update `docs/persistence-and-recovery.md` for the no-replace acknowledgement. Stop at this brief.
