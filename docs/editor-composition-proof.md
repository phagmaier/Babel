# M1-06 — Bounded codec/editor/native composition proof

Status: **bounded investigation passed on the reference Linux/WebKit host**, with [evidence and reviewed conclusion](test-evidence/M1.md#m1-06--bounded-codeceditornative-composition-proof) and a [runnable diagnostic](../prototypes/editor-composition/README.md). Implementation base `d64f3ab` contains the owner-accepted writer `5e84879`; starting tree was clean. This resolves the declared subset of the M1 composition question under [SPEC S16/S19.2](../SPEC.md#s16). Full grammar, structural editing, IME and production M2/M3 exit remain open.

## Question and ownership

Can one structured editor transaction state preserve the codec's source ranges while selection, undo/redo, serialization and the real native writer agree through open → edit → save → reopen?

Claim M1-06 in current-state and work on main with the task ID in the commit message. Use a short-lived worktree branch only for concurrent editing. Own only `prototypes/editor-composition/`, dedicated synthetic fixtures beneath that directory, `tests/contract/editor-composition.test.ts`, proof-only `src-tauri/src/editor_composition_proof.rs`, `src-tauri/tauri.editor-composition-proof.conf.json`, and narrowly gated registration in `src-tauri/src/lib.rs`/`src-tauri/Cargo.toml`. `package.json`/`pnpm-lock.yaml` may add a proof script or pinned dev dependency if the existing packages cannot expose the needed types. No runtime dependency promotion. The coordinator owns task/trace/current-state/evidence changes. Start from the corrected, reviewed writer commit and record exact base/prior dirty paths. Production route/writer initialization and native capabilities stay unchanged.

Read the relevant source-fidelity and editor contracts in SPEC S05–S07, success boundary S10.4 and proof rules S19.2; `docs/document-model.md`, `docs/editor-behavior.md`, ADRs 0003/0007/0008/0014/0015, the codec/input prototypes and existing writer/controller APIs. Fetch current library documentation via Context7 when implementing library-specific APIs. Do not reread the whole specification or historical milestone transcripts.

## Boundaries

- One reference Linux/WebKit host and a declared supported subset: heading, action, cue/dialogue, preserved blank lines, Unicode and untouched raw regions. Include BOM/CRLF and a final-newline variant.
- A real native proof page with typed editor nodes, not generic paragraph text joined into a new file. Editor state is the sole mutable authoring authority; source snapshots/ranges are immutable transaction data, not a competing buffer.
- Create a disposable synthetic root explicitly. Proof-only native opening accepts a fixed fixture identifier inside that root, never a frontend path or shell command. Refuse unmarked/non-synthetic destinations. Reopen the same fixture via native code.
- Use existing real native checkpoint/save commands and serialized writer. Save immutable version/hash/fingerprint captures off the key handler; report exact acknowledgements. No temporary unsafe save engine, history/remote operations or personal manuscripts.
- Do not add smart keys, autocomplete, PDF, retention, production picker or writing UI. Unsupported transformations are explicitly refused while preserving bytes.
- Timebox the first investigation to one working day. Stop at a pass, reproducible counterexample or specific blocker; record the next bounded action rather than widening the prototype.

## Acceptance and evidence

1. No-op open/serialize/save/reopen preserves independent expected bytes, BOM, CRLF, whitespace and unknown regions; do not generate the expected oracle from the serializer.
2. Type and replace a selection in supported typed nodes. Assert expected edited source/semantics, unchanged source regions and caret/source anchors. Undo and redo agree on content plus selection; restored content creates a newer persistence version.
3. Through the real native WebView, open → type → save → reopen the synthetic source. Inspect actual input/selection; independently verify reopened bytes and the exact source receipt. A browser/MockRuntime pass cannot close this step.
4. An external edit before save refuses replacement and retains both external source and local recovery. Unexpected failures never produce a success claim.
5. Record commands, host, fixture hashes/byte counts, selection/undo observations, native-versus-mocked results, supported/refused cases and latency observations in a single M1 evidence section. M1-02 timing is a comparison baseline, not a transferred budget pass.
6. End with a reviewed conclusion: proven subset, independently reproduced composition failure, or actionable host/prerequisite blocker. Leave unresolved acceptance steps explicit. A successful diagnostic outcome does not mark any Local v1 requirement implemented.

Checks: focused codec/editor contracts, required shared frontend/native checks for changed boundaries, proof-feature build and native interaction, relevant source/recovery faults and final formatting/link/`git diff --check`. Repeat filesystem-dependent write/fault behavior where required; do not rerun pure editor/state assertions just to change the disk fixture root.

## Stop and resume

The bounded investigation stopped at a passing subset and reviewed conclusion. The owner excluded M2-05C from this task, so it was not started. Review this checkpoint before selecting subsequent work; 05D/06 retain their safety dependencies, and production M3 remains behind full M2 exit/decomposition. An inconclusive or failed proof must name the remaining composition gate and next action; no placeholder or mock result is promoted to a native pass.
