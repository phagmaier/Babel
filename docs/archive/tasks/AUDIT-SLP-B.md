# AUDIT-SLP-B — Retire superseded prototype proofs

Status: **complete; stopped before AUDIT-SLP-C**. Base `d463656`, clean main, 2026-10-03.
Dependencies: AUDIT-SLP-A complete; Wave 3 approved in TODO.
Requirements: QA-01, INV-02/03/05/07; existing codec and source-save contracts.

## Scope and acceptance

- S-02 first: delete the composition prototype page/model/drivers and its
  model-only contract suite. Keep exact fixtures, seed.py, fixture .gitignore,
  Rust editor-composition-proof backend/feature and its production native callers.
- S-03/S-04 with S-02: remove native-editor-proof feature/command/page/config,
  PDF proof programs, snapshot proof page/config/destination command, and only
  pdf-lib/prosemirror-commands/keymap/schema-basic dev dependencies. Keep PDF
  requirements, corpus/coverage and independent conformance renderer. Keep the
  existing separate default/retained-feature handler lists; SIMP-N is later.
- S-01 after S-02: port the codec-independent corrupt-oracle/path/topic guards
  and the three orphaned fixture no-op byte assertions to production tests.
  Retype corpus.ts to FountainKind, remove proof-only projections, then delete
  the M1 codec, prototype-only tests and old comparison script. Preserve every
  independent literal/hash/oracle and the production comparison tool.
- S-11: port changed and silently truncated candidate refusal to production
  source_store_tests before removing durable-replacement/workspace membership.
  Assert unchanged source/previous, exact recovery, retained transaction and no
  receipt. Keep history-store membership, tests and all its acceptance claims.
- Repair affected owning docs/ADR links with historical Git references where
  appropriate. Retain prior evidence and explicitly carry snapshot copy/prune
  native independent-audit gap in M6-03; no new snapshot acceptance claim.

## Tests first and checks

Record a red removed-surface check before implementation. Port assertions before
deleting proofs, run production frontend/source-save focused controls, and prove
the new candidate tests detect bypassed byte verification in an isolated copy.
Tier 3: full pnpm check, frozen dependency installation, Rust fmt/Clippy, workspace
matrix tmpfs/Btrfs, default and retained-feature builds/tests, browser smoke,
`BABEL_SHUTDOWN_MODE=ordinary GTK_IM_MODULE=gtk-im-context-simple python3
tests/native/writing-lifecycle/integrated_exit.py /tmp "$PWD/target" --modes
recovery-shutdown --output <new-directory>` (runner alias for the full default
lifecycle, with owned-process/crash attribution), plus the retained feature
input fixture's `--import-only` and independent protection audit. No new IME, package, S13 or snapshot gate credit. Compare retained
fixture/oracle/proof bytes against base. Changed links and git diff --check finish.
One line per check with commands/timing/failures and native vs injected labels in
[audit evidence](../../test-evidence/AUDIT.md).

## Do NOT do / stopping point

Keep AUDIT.md frozen; preserve fixture bytes, renderer pins, history-store and
prior failures. No SLP-C, SIMP-N/F, D-06, schema changes, persistence behavior
changes, new dependencies, proof-backend deletion or gate closure. Commit this
bounded task on main and stop before AUDIT-SLP-C. No push. SELinux, C1/F2,
M6-02 and Local v1 admission remain open.

Acceptance/checks/failures: [AUDIT-SLP-B evidence](../../test-evidence/AUDIT.md#audit-slp-b--retired-prototype-proofs-with-production-coverage).

Retained runtime finding: initial Btrfs native content passed but strict crash
audit failed with an owned WebKit SIGSEGV at parent-kill/restart. Fresh strict
control/replay passed 2/2; raw failure remains and C1/F2 is not resolved.
