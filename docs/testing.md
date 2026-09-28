# Test layers and gates

Status: M0 unit/UI/browser scaffolding plus Rust tests; M1-01 source contract, M1-02 isolated native input, M1-03 isolated PDF renderer, M1-04 native replacement, and M1-05 native history proofs recorded. Later suites are planned. [SPEC S15/S20](../SPEC.md#s15); QA-01–03, INV-18.

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
