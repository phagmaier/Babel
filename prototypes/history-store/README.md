# M1-05 disposable Git history proof

Rust workspace member, isolated from the desktop. Uses `git2 = 0.21.0`
with `default-features = false` and `vendored-libgit2`, plus existing pinned
serde/serde_json/sha2 versions. Cargo.lock resolves libgit2-sys
`0.18.8+1.9.7` and libz-sys `1.1.29`. No history UI, production source
saving, account, credential, real remote, or cloud operation is connected.

```sh
CARGO_HOME=/tmp/babel-cargo cargo test -p history-store-proof --locked
BABEL_HISTORY_PROOF_ROOT=/home/phagmaier/Code/babel CARGO_HOME=/tmp/babel-cargo cargo test -p history-store-proof --locked
CARGO_HOME=/tmp/babel-cargo cargo build -p history-store-proof --release --locked
env PATH=/nonexistent ./target/release/history-store-proof
ldd target/release/history-store-proof
```

The first test command uses tmpfs on this host; the second uses Btrfs.
Each test or smoke run creates a private random 0700 directory containing
only synthetic bare repositories and deletes that owned directory on exit.
One empty private configuration-search directory per process remains in
`/tmp` to isolate libgit2 global/system/XDG discovery for the process lifetime.
No user configuration file is changed. Repository config is attached locally;
external templates are disabled; signatures use `proof@localhost.invalid`.
HTTPS/SSH/credential features are absent. This does not mean libgit2 has no
other network-capable transport: the proof exposes only local repository
handles and constructs no network URL. Production must enforce schemes too.

Curated trees contain only raw `screenplay.fountain` bytes and `manifest.json`
(schema, synthetic project ID, source SHA-256, synthetic profile identity/hash).
No index, checkout, filter, shell, default Git author or hook is used.
Fixed BOM/CRLF/space fixtures prove byte identity; malformed trees, unexpected
paths/modes, symlinks/submodules, foreign identities and unsupported manifests
are rejected before adoption. The 1MiB source bound is proof-only. Bounds apply to decoded source and manifest;
pack/decompression resource bounds and validation of all reachable ancestor
trees remain unproven.

Snapshots create immutable objects separately from a main-ref update. Existing
head updates use expected-OID compare-and-swap; the initial ref is exclusive.
Unchanged source/profile snapshots deduplicate. Restore creates a new child
of current history, with explicit safety refs; it never rewrites a manuscript
or resets away later history. Conflict refs preserve both heads; ancestry and
content equality are reported separately, independent of timestamps.

Local fetches go into separate per-operation incoming refs without changing
main. Captured push refs are immutable and refspecs never contain force `+`.
Push checks both call result and per-ref status, then verifies the local bare
remote head. Tests show stale/divergent pushes rejected and an explicitly
selected two-parent resolution published normally. This is local transport
evidence, not an authenticated-network/provider test. Operations assume a
single trusted coordinator; incoming-ref reservations and dedup concurrency
need M2/M7 locking, not a path precheck alone.

Thirteen tests also cover source bounds, native ref-lock failure, corrupt loose
objects, missing remotes, executable hook non-execution, and unchanged source/
recovery copies on history failure. The corruption fixture changes permissions
only on its own read-only synthetic object. No history power-loss guarantee,
multi-ref transaction atomicity, garbage collection or retention is claimed.

On the host, the release executable reports `vendored=true`, libgit2 1.9.7,
passes with Git absent from PATH, and links zlib/libc/libgcc (not system
libgit2, OpenSSL or libssh2). End-user compiler/Git installs are unnecessary
for the tested runtime; full app packaging and other platforms remain open.
Licenses and release obligations: [ADR 0011](../../docs/decisions/0011-git2-history-store.md).
Checks: [M1 evidence](../../docs/test-evidence/M1.md).
M1 exit and M2 contract review: [gate review](../../docs/m1-gate-review.md).
