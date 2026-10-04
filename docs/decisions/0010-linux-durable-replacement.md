# ADR 0010 — Linux durable replacement adapter plan

AUDIT-SLP-B (2026-10-03) retired superseded proof programs; linked deleted
sources use the last pushed pre-deletion snapshot. Historical observations and
failures below remain unchanged. [Retirement scope](../tasks/AUDIT-SLP-B.md) and ported production
coverage are recorded separately; no new admission claim.

Status: Accepted direction. Date: 2026-09-27. Task: M1-04.
Authority: [SPEC S10/S15](../../SPEC.md#s10), SAVE-01–03, INV-04/05;
[persistence](../persistence-and-recovery.md), [ADR 0005](0005-layered-safety.md).
Evidence: [M1 report](../test-evidence/M1.md),
[disposable harness](https://github.com/phagmaier/Babel/blob/fb7d6bd5bf034458afd950d5f9632382b6d5b99b/prototypes/durable-replacement/README.md).

## Decision and tested boundaries

For the Linux M2 adapter, use exclusive same-directory creation, complete
write handling, `File::sync_all`, verification, `fs::rename` over the current
source, and directory sync before acknowledgement. Commit verified,
independent recovery and previous-generation files and their directory
entries before replacing source. A hard link is insufficient protection
against an external in-place writer; never unlink the current source first.

The dependency-free native proof passes on host Btrfs and tmpfs. It retains
whole old/new sources and safety copies across injected errors and actual
SIGKILL boundaries. Ordinary POSIX 0640 source permissions survive replacement;
copies are 0600 inside a 0700 directory. Read-only, symlink and multiple-link
sources are rejected conservatively. Version 21 and exact installed bytes
are returned only after final directory sync and verification. If rename
succeeds but sync/verification fails, report replaced-but-unconfirmed;
retain both generations and do not issue a success receipt or blindly retry.

Use a stable separate lock inode with explicit release for cooperating
writers. A lock on the replaced source inode loses its meaning after rename.
The first parallel test exposed transient fork-inherited descriptor lifetime
when relying on close alone; explicit unlock fixes that release path.
Never unlink a live lock file. This is not a universal external-editor lock.

## Production prerequisites and limits

M2-01 must validate opaque identities, trusted directory handles, file
identity, ownership and safe no-follow/handle-relative operations. This
path-based proof is deliberately restricted to trusted disposable directories.
M2-02 adds framed, checksummed, versioned recovery and previous-checkpoint
retention; the raw proof copy is not a production checkpoint format.
M2-03 implements per-save exclusive names and serialization, full hashes,
bounds and restart classification; M2-04 validates sessions/stale versions
and distinguishes journal/file acknowledgements. No gate is closed by a
queued write or an old receipt. Production save integration remains absent.

Rechecking inode/content/mode detects tested external changes and retains
local/new/old artifacts. A counterexample also confirms the residual race:
an uncooperative writer can change bytes after the final check and before
rename, and those racing bytes can be lost. Watchers, native identity checks,
pre-replacement copies and conflicts reduce risk but cannot promise universal
atomic compare-and-replace for arbitrary programs (SPEC S10.4).

Ordinary mode preservation is proven; ownership, ACLs, extended attributes,
special mode bits, other platforms, external drives, network filesystems and
sync-folder behavior need separate policy/proof. The prototype is not suitable
for those inputs. No delete-and-rename or in-place overwrite fallback is allowed.

Linux [fsync documentation](https://man7.org/linux/man-pages/man2/fsync.2.html)
requires syncing the containing directory to protect changed directory
entries; [Rust rename](https://doc.rust-lang.org/std/fs/fn.rename.html) is
platform-dependent and cannot cross mount points. [Rust File](https://doc.rust-lang.org/std/fs/struct.File.html)
documents sync and advisory lock behavior. Context7 Rust source lookup plus
these primary references informed the plan; actual APIs compile on pinned
Rust 1.97.1. SIGKILL tests leave OS caches alive; neither those tests nor
successful fsync prove all controller/firmware power-loss behavior. tmpfs
is volatile and proves process-interruption semantics only.

Evidence still needed: M2 full save/recovery/race/restart matrix and secure
path/mode/ownership policy; platform-specific replacement adapters and Tier 1
filesystem/packaging tests; hardware power-cut experiments if stronger
durability claims are required. M1-05 remains independent history proof.
