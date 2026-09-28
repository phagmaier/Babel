# ADR 0011 — Vendored git2 history-store direction

Status: Accepted direction. Date: 2026-09-27. Task: M1-05.
Authority: [SPEC S11/S16/S19](../../SPEC.md#s11), HIST-01/02, INV-07/08;
[history contract](../sync-and-versioning.md), [ADR 0005](0005-layered-safety.md).
Evidence: [M1 report](../test-evidence/M1.md),
[native proof](../../prototypes/history-store/README.md), [M1 gate review](../m1-gate-review.md).

## Decision

Use pinned `git2 0.21.0` with vendored libgit2 as the leading M2 local
`HistoryStore` adapter. The proof resolves libgit2-sys `0.18.8+1.9.7`,
libgit2 1.9.7 and libz-sys 1.1.29. HTTPS/SSH/credential features stay off
for local v1. The desktop has no new runtime dependency until M2-06 promotes
the tested primitives behind its native service. No shell Git or uncontrolled
checkout is part of that contract.

Thirteen native tests pass on Linux tmpfs and Btrfs: curated byte-exact blobs,
portable manifest identities/hashes, changed-profile revisions, dedup,
restore as a new revision, CAS/ref-lock failure, ancestry classification,
conflict/safety refs, corruption isolation, incoming validation and a
two-client local bare-remote fetch/push round-trip. Non-fast-forward push is
rejected; an explicitly selected two-parent resolution preserves both parents
and can be published normally. This tests primitives, not a remote product.

The standalone release probe and all tests pass with `PATH=/nonexistent`.
Runtime reports vendored libgit2 1.9.7; `ldd` shows host zlib/libc/libgcc and
no system libgit2, OpenSSL or libssh2. The 2,042,304-byte host release binary
is a packaging experiment, not an installed-app or other-platform pass.
The crates.io libgit2-sys archive includes the C sources; development needs
a compiler/build prerequisites, not end-user Git. A vendoring override can
alter builds, so shipping checks must assert the actual vendored version.

## Boundaries, licenses and alternative

Objects are prepared separately from ref publication. The native coordinator
must hold document/history ownership, preserve source/recovery/snapshots,
validate expected refs, and reconcile interrupted operations before reporting
restore/adoption complete. Git refs/objects are not a recovery journal or a
source-save durability receipt. Multi-ref crash atomicity, fsync policy,
retention/GC and pack resource bounds remain unproved. No pruning is permitted
for unresolved safety/conflict refs. Dedup and incoming-ref identities need
coordinator serialization; CAS alone does not make every operation atomic.

Use explicit app-local signatures, curated trees and owned config; do not
discover personal identity/credentials or run hooks/config from remote data.
The proof isolates process-local config search paths before Git use and
attaches only local synthetic config. M7 must restrict protocols, validate
host/auth/privacy, protect local work before fetch and verify publication.
No real destination or upload is authorized by this ADR.

[git2's pinned manifest](https://github.com/rust-lang/git2-rs/blob/git2-0.21.0/Cargo.toml)
declares MIT OR Apache-2.0; the Rust sys wrappers use the same expression.
The vendored C [libgit2 COPYING](https://github.com/libgit2/libgit2/blob/main/COPYING)
is GPL v2 with its linking exception, not plain MIT; the exact locked archive
COPYING was inspected. zlib carries its zlib license. These facts are a license
inventory, not completed distribution review: collect exact C bundled-source,
Rust transitive, native-library notices and applicable source obligations
before release. Application licensing remains owner-unselected.

A pure-Rust gix adapter is the motivated fallback if C packaging/license
constraints or required transport gates fail. It is not installed or claimed
verified. The working leading candidate closes the bounded M1 question; do
not introduce a competing engine or a Git helper without new evidence.

Evidence still needed: M2-06 integration/failure and interrupted-ref drills;
M6 installed/offline packaging, notices and declared Tier 1 platforms;
M7 authenticated transport, limits/cancellation/concurrent-server race tests
and explicit destination/privacy approval. Local proof transport does not
verify SSH/HTTPS or any provider.
