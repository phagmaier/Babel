# Test layers and gates

Status: M0 unit/UI/browser scaffolding plus Rust tests; M1-01 source contract, M1-02 isolated native input, M1-03 isolated PDF renderer, M1-04 native replacement, and M1-05 native history proofs recorded, plus M2-01–04 headless, M2-05A startup-review and M2-05B choice suites. Later (M2-05C–D, M2-06+) suites are planned. [SPEC S15/S20](../SPEC.md#s15); QA-01–03, INV-18.

`pnpm test` is Vitest/JSDOM with an injected typed app-info port; it verifies visible shell status and disabled future actions. `pnpm test:browser` starts Vite and uses system Chromium to verify the same in a real browser. Browser preview deliberately reports native IPC unavailable. `cargo test -p screenwriter-core` tests the headless value, and `cargo test --workspace` also tests host command wiring. A native smoke must actually start Tauri and observe the app-info response in WebKit; mocked/browser results cannot substitute. [M0 evidence](test-evidence/M0.md) records what ran.

Future tests add byte-preserving and semantic Fountain fixtures, editor caret/IME/undo interaction, versioned cross-boundary contracts, native temporary-directory fault injection, crash/restart drills, PDF structure/visual goldens, disposable local remotes, accessibility, and long-session performance. Test on synthetic files only. Expected outputs need independent review; never generate goldens from the implementation and accept them automatically.

Mandatory save faults from [SPEC S15.2](../SPEC.md#s15): crash before/after temporary write and replacement, partial write, sync failure, disk full, corrupt journal tail, out-of-order acknowledgements, external edit, second instance, history failure, and interrupted restore/remote adoption. Every failure must preserve known good generations and report truthful status. Real filesystem process-termination tests complement, but do not universally prove, mock fault tests.

For each task, record exact command, host, outcome, skipped checks, and evidence. A source-only unit pass does not close a native packaging gate. Local-v1 adoption additionally needs an installed offline app, disposable writing/recovery/backup drills, migration review, and owner-reviewed pilot per [SPEC S15.5](../SPEC.md#s15).

Evidence convention: one compact report per milestone at `docs/test-evidence/M*.md` (`M0.md` exists; add `M1.md`, `M2.md`, …). Keep large logs outside routinely loaded docs and reference them by path.

M1-04 adds a Linux-only, dependency-free Rust workspace proof under
`prototypes/durable-replacement/`. Its tests perform actual native file
operations and pipe-barrier SIGKILL drills on disposable synthetic data.
Injected I/O/ENOSPC errors are simulation, while permission/rename/lock and
process-interruption results are native evidence. Neither proves power loss;
non-Linux tests are cfg-excluded and are not platform passes.

M1-05 runs native git2/libgit2 operations against synthetic bare repositories
and local bare peers, without invoking Git. Btrfs/tmpfs and no-Git-PATH runs
exercise byte fidelity, curated-tree validation, restore ancestry, concurrent
CAS/ref failures, divergent non-force push, corrupted history and source/
recovery isolation. Local transport does not close M7 authenticated transport,
server race, cancellation or privacy gates; no Git power-loss claim is made.
The [M1 gate review](m1-gate-review.md) carries unverified product/platform
contracts into their owning M2–M7 tasks.

M2-01 adds production headless Linux safe-open tests on owned synthetic tmpfs
and Btrfs directories. They cover exact source bytes/fingerprints, malformed
UTF-8 and metadata, native path/mode/ownership validation, stable identities,
external divergence, opaque session validation and an execed second-process
lease check without Git. Tauri MockRuntime tests exercise generated command
dispatch; TypeScript tests mock invoke. Neither is native WebView E2E. The
shell remains disabled for manuscripts; no save/recovery/close protection or
M2 safety exit is asserted. [M2 evidence](test-evidence/M2.md) records commands,
failed development checks, final results and excluded platforms/semantics.

M2-02 tests every second-frame truncation and one-byte mutation, malformed
buffers and bounded headers/schema/version/hash/draft metadata. Native tests
cover exact recovery-only receipts, no source write, named/unsaved/managed
restart lookup, source divergence independent of recovery, duplicates/stale
versions/session isolation, tail quarantine, predecessor fallback, unknown
schemas, oversized files and unsafe paths. The 15-stage injected failure
matrix and simulated ENOSPC are simulations; six pipe-barrier SIGKILL stages
exercise native process interruption. SIGKILL leaves kernel caches alive and
does not prove power-loss behavior. The 600-workload stress fixture uses the
independently recorded M1-02 byte count/hash and measures 32 checkpoints;
format, growth and debug/release timings are recorded in [M2 evidence](test-evidence/M2.md#m2-02--recovery-checkpoint-format).
No native WebView checkpoint or startup-choice UI is claimed.

M2-03 adds production native save API/FIFO and transaction tests on synthetic
sources. They cover exact no-op bytes, mode/group and inode lease transitions,
immutable initial snapshots, queue count/byte/version/session bounds, duplicate
flush, stale/conflicting requests, managed/loose storage, external edit/delete/
rename/permission changes, ACL/xattr refusal and recovery failure. Twenty
injected source stages, simulated ENOSPC, transaction-directory substitution,
pre/post-replacement external edits and eight SIGKILL barriers preserve valid
source/previous/recovery generations and classify uncertainty honestly. Fixed
pending/intent artifacts block accumulation and remain read-only on inspection.
The hooks compile only into unit tests; no production fault environment or save
IPC existed in that task. [M2 evidence](test-evidence/M2.md#m2-03--serialized-source-replacement)
records tmpfs/Btrfs and full shared-check results; M2-05/06 and visible UI gates stay open.

M2-04 adds pure state tests for exact v21/v22 protection, all 24 result-delivery
permutations, session token isolation, stale failures, receipt-schema/hash/length
validation and separate journal/source states. Injected controller ports test
immutable captures, bounded serial dispatch, causal fingerprint advancement,
fresh duplicate flush calls, native failure propagation and unknown-result
source blocking with continued raw recovery. Mocked invoke checks exact command
names/envelopes; these frontend tests perform no native I/O.

Generated Tauri MockRuntime dispatch tests use the real Linux service and owned
synthetic files: checkpoint/source receipt separation, duplicate flush/stale
rejection, strict path-free requests, cross-session/hash/version rejection,
external divergence with recovery retained, malformed raw unsaved recovery and
uninitialized host failures. Worker tests exercise job/byte budgets, mutex wait
off the caller, abandoned response with native completion, stale frontend
fingerprint recovery, poisoned mutex uncertainty and isolation from an existing
native queue. The poisoned-mutex test deliberately catches a panic; it is not
an application crash. Filesystem/worker operations are native evidence on the
recorded host; MockRuntime dispatch is not native WebView E2E. No cadence,
latency, power-loss, startup UI or other-platform claim is made.
See [M2 evidence](test-evidence/M2.md#m2-04--versioned-acknowledgements-and-ipc).

M2-05A tests read-only restart discovery/raw metadata fidelity, missing-directory
no-create, damaged-tail predecessor inspection, stale and metadata-only changed
selection rejection, pending/future/quarantined/conflicting generation exposure,
unsafe symlink/store substitution and scan/document limits. Generated MockRuntime
commands perform real synthetic native reads, strict path-free/stale checks and
confirm the writer host stays uninitialized. UI contracts exercise literal HTML
text, malformed bytes as hex, stale/deferred responses, damaged/incomplete lists,
fixed errors/retry and bounded Unicode preview. Native window smoke is distinct
from these injected-port/MockRuntime tests. [M2 evidence](test-evidence/M2.md#m2-05a--read-only-startup-recovery-review)
records scope and limits; adoption/retention/close remain separate gates.

M2-05B adds native choice tests over synthetic loose/managed sources:
identical/diverged/missing comparison, stale/foreign/malformed selection
rejection without disk writes, protected adoption with previous-copy and
restart evidence, older-session blocking until explicit recover/keep,
stale/diverged/unsupported-encoding/view-only adoption refusal, disk-identical
keep, sibling and emergency copies, second-instance compare-only, loose-move
and managed-rename relinking with unrelated/read-only rejection, and
no-transaction finalize. In-crate fault-gate tests complete
replaced-but-unconfirmed saves and leave prepared/diverged states untouched.
Generated MockRuntime dispatch tests exercise the five path-free commands,
strict envelopes, stale/foreign rejection and uninitialized-host failures.
Injected-port UI tests cover comparison display, explicit versioned recovery,
keep/copy/resolve flows, divergence blocking and substituted-generation
rejection. [M2 evidence](test-evidence/M2.md#m2-05b--explicit-recovery-choices-and-external-changes)
records scope and limits; retention/backup/close remain separate gates.
