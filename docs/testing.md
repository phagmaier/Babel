# Test layers and gates

Status: M0/M1 proofs and M2-01–06 bounded Linux headless gates recorded; M2-05D additionally has native WebKit diagnostic evidence. M2 headless exit does not establish Local v1. [SPEC S15/S20](../SPEC.md#s15); QA-01–03, INV-18.

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

The [M2-05B independent review](reviews/2026-09-28-m2-05b-review.md) found two cases absent from those suites: finalization interrupted before source-directory sync and relinking from a view-only caller. [M2-05B-R1](test-evidence/M2.md#m2-05b-r1--correct-finalize-durability-and-relink-ownership) implements the corrections with pre-directory-sync/retry/restart/already-confirmed finalize coverage, sync-failure no-receipt coverage and view-only/invalidated-lease relink refusal with byte-identical disk checks; the owner [accepted R1](test-evidence/M2.md#r1-owner-acceptance-and-m1-06-claim) at `5e84879` on 2026-09-28, closing M2-05B acceptance within that recorded coverage. M1-06 separately owns native codec/editor/save composition.

## M1-06 composition coverage

The [composition proof](../prototypes/editor-composition/README.md) has source/editor conformance tests and feature-only native guard/dispatch checks. Real WebKit runs exercise LF, BOM/CRLF and no-final-newline typing, selection replacement, undo/redo, save and reopen. Python audits compare literal oracles, source ranges/Unicode anchors, exact native receipts and disk bytes; external divergence retains independently checksum-verified recovery and external bytes on tmpfs/Btrfs. MockRuntime checks remain labeled separately. [M1 evidence](test-evidence/M1.md#m1-06--bounded-codeceditornative-composition-proof) records commands and limits; this closes the bounded investigation without asserting full editor/IME or Local v1 adoption.

## M2-05C snapshot and copy coverage

Native synthetic-file tests verify exact BOM/CRLF/raw bytes, restart, dedup,
five-minute admission, hourly/daily retention, clock rollback, protected versions,
record/byte caps, stale/future/damaged/unsafe inventories, managed/unsaved anchors,
view-only/cross-session refusal, live/disk protection on restore, blocked restore
with current recovery retained, native destination permissions/removal/substitution
and backup failure isolation from ordinary saves. Seven injected snapshot stages,
four prune stages and three copy stages retain valid protections and return no
receipt on error. Seven actual SIGKILL publication/prune barriers preserve valid
paths after restart. Injected ENOSPC is simulated, not a physically filled disk;
SIGKILL is not power loss. The changed choice adoption is repeated on Btrfs.

Generated MockRuntime dispatch exercises all six path-free commands over real
files and malformed/uninitialized envelopes. Injected UI/adapter tests verify
literal names, exact receipt checks, attention/cap actions, independent copy status
and ignored old-session restore completions. Real WebKit uses the fixed synthetic
destination diagnostic; a separate Python audit verifies literal source bytes,
metadata/blob/recovery checksums, previous source and exact receipts on tmpfs and
Btrfs. [M2 evidence](test-evidence/M2.md#m2-05c--rolling-snapshots-and-backup-copies)
owns exact commands, host, logs and omissions. Default product picking/cadence,
protected close, curated safety revisions, installed-package/other-platform and
physical-disk/power-loss guarantees are not claimed.

## M2-06 history and headless exit coverage

The native Linux history tests use private disposable bare repositories and
exact synthetic Fountain bytes. They verify curated trees/manifest hashes,
profile-change revisions, dedup, first-parent and safety refs, interrupted
object/main/safety publication with retry, corrupt ref preservation, and
restart attention. Recovery-choice tests prove a safety revision before source
replacement and refusal on corrupt history while ordinary save/recovery remain
available. The combined M2 exit test opens, saves, reopens, inspects an exact
newer acknowledged checkpoint and adopts it with previous source/history
preserved. All shared native tests and prior fault/SIGKILL matrices run on
tmpfs and Btrfs; a no-Git-PATH test verifies no external Git executable is
needed. [M2-06 evidence](test-evidence/M2.md#m2-06--small-history-primitives-and-safety-gate)
owns the exact commands/results. Git ref/object power-loss durability,
installed/offline package use, a production editor/picker/cadence, Save As and
Local-v1 adoption remain open.

## M3-01 corpus and renderer scope

The [oracle guide](../fixtures/expected/README.md) defines literal bytes, ordered semantic atoms, edited-context expectations and independently authored renderer projections. The [test harness](../prototypes/fountain-conformance/README.md) checks every physical byte/span/line ending plus malformed-input preservation and conservative refusals. The separate Screenplain comparison uses actual AST and bare HTML output; it is neither a browser mock nor native desktop/PDF verification. Named gaps in whitespace, title presentation, hidden/raw/lyric content, editable marks and incomplete drafting stay separate from source-byte fidelity. No expected file is generated by the codec or renderer; later production adapters must satisfy the required semantics without silently inheriting proof limitations. Evidence lives in [M3](test-evidence/M3.md#m3-01--independent-conformance-corpus-and-oracle).

## M3-02 primary codec acceptance

The [production contract suite](../tests/contract/production-fountain.test.ts) imports the independent M3-01 corpus data without invoking the proof parser or generating expectations. It asserts every source byte/physical span and complete before/after semantic inventory. Additional hand-authored examples cover standard forced primary types, explicit fields, indentation, Shot metadata, atomic owned-context edits, neighbor drift, insertion/deletion ID relationships, exact EOF/newline behavior, empty/incomplete drafting and matching/stale/malformed recovery metadata. It tests UTF-8 read-only preservation, raw/title/hidden/malformed conversion refusal, frozen snapshot/input/output isolation, 512 deterministic malformed-byte mutations and 128 action-text mutations with full success/reparse or explicit refusal assertions. Complex editing and production editor undo/native input remain their separate M3-03–08 gates. [M3-02 evidence](test-evidence/M3.md#m3-02--production-source-aware-codec-foundation) owns observed counts/commands; native/installed-app acceptance is not inferred from codec tests.
