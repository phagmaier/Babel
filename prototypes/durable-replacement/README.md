# M1-04 durable replacement proof

Disposable Linux-only Rust workspace member, not linked into the desktop
application. No dependency, IPC, live editor, or production save API is added.
Authority: SPEC S10/S15, TODO M1-04; decision: [ADR 0010](../../docs/decisions/0010-linux-durable-replacement.md).

Run as an unprivileged user (the native permission test deliberately fails
when root bypasses permissions):

```sh
CARGO_HOME=/tmp/babel-cargo cargo test -p durable-replacement-proof --locked
BABEL_PROOF_ROOT=$PWD CARGO_HOME=/tmp/babel-cargo cargo test -p durable-replacement-proof --locked
```

The first command uses `/tmp` (tmpfs on the recorded host); the second uses
the workspace (Btrfs). `BABEL_PROOF_ROOT` must name an existing writable
directory. Each test exclusively creates its own random 0700 subdirectory,
initializes only synthetic bytes, and removes only that subdirectory when
the parent test ends. Sources use `.src` so the ordinary Fountain ignore
rules remain intact. The worker binary is internal to these tests; do not
point it at an existing directory or use it for manuscript saving.

The one-shot protocol holds a separate stable advisory lock; verifies old
bytes, device/inode and mode; exclusively creates independent 0600 new
recovery and old generation copies; syncs/verifies both and their directory;
then creates a same-directory 0600 candidate. It handles short writes,
preserves ordinary source permissions, syncs/verifies the candidate,
rechecks source identity/bytes/mode, renames without unlinking the source,
syncs the directory again, and verifies the installed generation. Only
then does it return the exact version and bytes. A failure reports its
stage and whether replacement already occurred. Artifacts are never
promoted or deleted by the replacement routine after failure.

Tests cover 30 injected I/O failures across 15 boundaries, three simulated
ENOSPC storage-layer failures, short/partial writes, silent truncation,
corruption, actual permission/rename errors, exclusive-create collisions
including symlinks, unsafe source types, changed content/inode/mode,
move/removal, cooperating processes, success receipts, and 15 SIGKILL
barriers. A pipe handshake lets the parent kill a worker before the named
operation without child cleanup. Fresh reads inspect all surviving
generations; no recovery engine or journal replay is claimed.

The counterexample test deliberately demonstrates the final check/rename
race with a noncooperating writer. This proof assumes a trusted parent
directory and uses fixed artifact names inside an exclusive random sandbox.
Production needs opaque handles, secure handle-relative/no-follow path
operations, per-save unique names, stronger ownership checks, bounds,
session/version/hash validation, and framed recovery. POSIX mode bits are
tested; ACLs, xattrs, ownership, special modes, other OSes, network/sync
filesystems, controller caches and power failures remain unverified.
tmpfs is volatile. SIGKILL preserves kernel caches and is not a power cut.

Results and exact check commands: [M1 evidence](../../docs/test-evidence/M1.md).
