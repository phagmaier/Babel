# AUDIT-C356 — Literal escapes, SELinux metadata and advisory highlights

Status: **complete**, 2026-10-03, base `08986eb`, clean main at claim.
Acceptance evidence: [AUDIT-C356 results](../test-evidence/AUDIT.md#audit-c356--literal-escapes-selinux-metadata-and-advisory-highlights).
Dependencies: none; AUDIT-D08A and AUDIT-W0-R1 complete. Documentation-base CI
[passed](https://github.com/phagmaier/Babel/actions/runs/37158997960).
Requirements: portable source/no-op bytes, shared preview/export fidelity,
metadata-safe native replacement and advisory-only editor decorations.

Covers frozen [C-03](../../AUDIT.md#c-03--typed---_-and--are-saved-as-backslash-escapes-that-the-pdf-prints-literally-medium-s-for-the-encoder-m-for-the-renderer-side),
[C-05](../../AUDIT.md#c-05--on-selinux-labelled-filesystems-every-save-save-as-pdf-export-and-snapshot-would-fail-medium-s-code-m-with-a-fedora-check)
and [C-06](../../AUDIT.md#c-06--in-ordinary-find-use-every-nextprevious-match-or-caret-move-wipes-all-find-highlights-medium-s).
Read their [dropped/refuted limits](../../AUDIT.md#dropped-or-refuted).

## Acceptance

1. Edited ordinary single brackets and backslashes before ordinary text retain
   literal spelling; ambiguous paired brackets/backslashes remain safely escaped.
   Stars/underscores retain explicit escaping and round-trip styles. Untouched
   bytes, CRLF/BOM, note syntax and neighboring rows remain intact.
2. The pinned frozen PDF helper prints escaped stars, underscores, brackets and
   backslashes literally without accidental underline/note interpretation.
   Rich styles remain intact. Update renderer identity through its existing
   build manifest; existing accepted layout/visual goldens must still pass.
   Verify actual PDF text with independent Poppler assertions.
3. Native metadata reads the bounded, NUL-separated descriptor xattr-name list.
   Only exact `security.selinux` is exempt: the kernel labels new inodes; Babel
   does not copy labels. ACLs, user/unknown names, malformed/failed reads refuse
   before replacement. A single bounded syscall avoids size/read races. Test injected names separately from actual host syscalls;
   preserve real ACL/user-xattr rejection, source bytes and recovery protection.
   Update ADR 0014; do not claim enforcing Fedora acceptance on this Arch host.
4. Find and Script Check own separate stamped plugin decoration sets. Clearing,
   navigation or caret republishing in either cannot erase the other's highlights.
   Closed Script Check reports must not repaint. Stale/composing/frozen guards,
   editor-state identity, source, versions and Undo remain protected.

## Tests first and checks

Add focused red regressions before behavior edits: codec literal spelling,
actual frozen-helper escape PDF output, metadata name classification and mounted
Find/check coexistence plus Next/Previous/caret updates with retained reports.
Record the red commands/failures; deliberate encoder expectation changes require
independent literal review, never regenerated fixture bytes.

Tier 3 for native metadata: focused frontend contracts/UI and core metadata/save
tests; helper build/tests/profile goldens; full `pnpm check`, Rust fmt/clippy,
canonical workspace tmpfs/Btrfs matrix in fresh roots, browser smoke and default
`pnpm tauri build`, extracted-package integrity and focused offline escape tests. Generated-runtime builds and workspace matrix run sequentially.
No frontend/native IPC change: actual descriptor/file tests on both filesystems
are the named native metadata drill; no shared-keyboard GUI drill is required.
If a GUI drill becomes necessary, coordinate owner idle time first. Check changed
links and `git diff --check`; record elapsed native/matrix/shared check times.
Evidence goes in [audit evidence](../test-evidence/AUDIT.md), one labeled line per
check; retain every failed run/root/log and distinguish mocked names/JSDOM,
actual native filesystem, actual helper and browser coverage.

## Do NOT do and stopping

Do not modify frozen `AUDIT.md`, permit unknown metadata/ACLs, copy SELinux
labels, relax group-write policy, add dependencies, claim browser-download xattrs
(refuted), rewrite unedited Fountain, change layout policy or tackle Wave 2.
C1/F2, M6-02 disposition and Local v1 admission remain open. Preserve prior
failed artifacts/cores. Commit completed work directly on main; owner permits a
warranted push to existing origin/main and actual CI status must be checked.
Update tracker/handoff only after acceptance. Stop after AUDIT-C356.
