# Current state — M6-02 hardening recorded; disposition open

Date: 2026-10-03. Application: **babel**. Main; no push/tag/branch.
Base `ccf9fb5`, clean main/19 ahead at claim. M0–M5 and bounded M6-01
investigation remain recorded complete. **M6-02 stays unchecked; retained
operation findings, C1/F2 and Local v1 admission remain open.**

## Task and work

Owner continuation authorized M6-02 on current Linux x86_64 host, with future
portability retained. No additional target/installed promise; M6-13/14 still
need exact release-target confirmation. [ADR 0040](decisions/0040-local-v1-platform-scope.md).

Added stage-qualified Save As refusal and identity/source/selection/Undo rollback
regressions. Successful native Save As now proves adoption through later copied-
file edits and Undo, while the divergent original stays intact. Readiness/refusal
snapshots preserve trusted composition, Save/editability and outline facts.
No demonstrated cause/correction for the untouched M6-01 operations is claimed.

Extended real source/recovery child-kill boundaries; added actual local-restore
child SIGKILL after live/disk protection, before replacement and after replacement.
Private existing stage closure passes through request/restore with production
no-op. No receipt/schema/capability/dependency/ownership-policy change. New
opt-in native path-loss and two-app drills plus independent literal/head auditor;
initial harness identity/log-path errors corrected with failures retained.

Paths: `writingSession.ts`, source/recovery/snapshot stores/tests, existing native
writing-lifecycle runners/new `persistence_paths.py`/`audit_persistence_paths.py`.
[Brief](tasks/M6-02.md), [S15.2 matrix](test-evidence/M6-02-matrix.md),
[review](reviews/2026-10-03-m6-02-persistence-review.md),
[exact commands/artifacts/failures](test-evidence/M6.md#m6-02--persistence-interruption-and-operation-investigation).

## Checks and retained failures

Shared frontend 774/774, lint/typecheck/build; Chromium smoke; final Rust fmt/
clippy and workspace 265/265 each tmpfs/Btrfs; default release build pass.
Mocked editor/session focused 62/62; actual restore child-kill checks pass.
Final corrected native path-loss/shared-store two-app 4/4 strict; ordinary
restart/read-only controls 4/4; final real-IME presentation 2/2. Independent
literal/source/copy/journal-head and crash-verdict audits are in M6 evidence.
These are bounded Linux groups, not universal durability or full admission.

First default-teardown matrix was 5/8 strict: two unrelated-store read-only
expectations fail under ADR 0012's pre-existing shared-store lease limit; one
Btrfs restart root completes content checks but records owned WebKit SIGABRT
following parent SIGKILL before stale-session DELETE. PID `274428`/start `2737907`,
compressed core/provenance/logs retained under `target/m6-02/`; no event filtered.
First ordinary replay 7/8 due to a secondary-log-path harness error; corrected
named reruns pass. Neither later clean samples nor intact bytes resolves C1/F2.

The separate-store diagnostic actually shows writable second-app state, source
unchanged; normal shared-store control passes. [ADR 0012](decisions/0012-native-document-identity.md)
still scopes cooperating advisory leases. Parent rename is path-loss simulation,
not actual unmount/power/controller/antivirus/sync-product acceptance.
All M6-01 failed roots/binaries/cores remain untouched. Save As refusal and stress
IME readiness were not reproduced in stronger-oracle samples; causes stay open.

## Docs maintenance (2026-10-03, Tier 1, no behavior change)

Owner-authorized repo-debloat pass; `AUDIT.md` untouched. `TODO.md` 167→~60 lines (completed M0–M6-01 frozen to summary, all evidence links kept; open M6-02–16/M6-G/DEV-02/M7-G/M8 intact). `docs/index.md` demoted to stub pointing at `map.md`. Applied AUDIT S-14 stale one-liners (README status, `BOOTSTRAP_PROMPT.md` refs in AGENTS/SPEC S17.1/`.prettierignore`, `index.html` title, development/testing status to M6, `map.md` prototypes row, `.env.example` load note). Tracked `tools/check-links.py` (changed-scope link gate) and `tools/run-workspace-matrix.py` (16-selector canonical matrix, incl. `BABEL_OPEN/M2_EXIT_TEST_ROOT`); `tools/clean.sh --apply` pruned unreferenced run roots (target 31→30 GiB, evidence/caches kept).

Checks (Tier 1; docs-only, no Tier 2/3 matrix): `prettier --check` touched files pass; `python3 tools/check-links.py` 172/172 changed links pass (`--all` shows only 5 known frozen M4.md `../src/...` links, intentionally untouched); `git diff --check` pass; `sh tools/lint-py.sh` 78 files compile. Next agent-executable task unchanged: [M6-02-R1](tasks/M6-02-R1.md).

## Audit execution layer (2026-10-03, Tier 1, `AUDIT.md` frozen)

Owner-authorized setup for audit implementation. Added `## Audit execution` tracker to `TODO.md` (all 48 findings mapped to ~12 proposed cluster briefs in Waves 0–3 + DESIGN triage table with recommendations, decisions blank for owner + confirm-first parking list). New [AUDIT-W0 brief](tasks/AUDIT-W0.md): T-02 (CI `libenchant-2-dev` + helper ordering), S-15 (`crate-type → rlib`), S-13 (verified delete table with 3 reclassifications: `navigateLogicalText`, `unavailablePublication`, `inspect_local_recovery`); Tier 2 gate, `docs/test-evidence/AUDIT.md` as the shared evidence file. Hardened `tools/check-links.py` (GitHub-accurate slugs incl. em-dash `--`, cross-file anchor checks, explicit-path mode) and restored collapsed-section anchors in TODO via `<a id>` tags — `--all` sweep now shows only the 5 known frozen M4.md links.

Checks (Tier 1; docs/tooling only, no behavior change): `prettier --check` TODO/AUDIT-W0 pass; `check-links` changed-scope 56/56 pass; `--all` 1379 links with only the 5 frozen M4.md `../src/...` items (intentionally untouched); `git diff --check` pass. Pending: owner DESIGN triage votes + approval of proposed Wave 1–3 cluster titles before those briefs are written; AUDIT-W0 is ready to execute.

## Next action and blockers

Next agent-executable task: [M6-02-R1](tasks/M6-02-R1.md), retained operation
investigation/disposition before checking M6-02 or starting M6-03. Use the new
stage/readiness evidence on a fresh reproduced failure; no guard/receipt weakening
or speculative editor/index/global-lock change. Stop at this task-scoped commit.

[Supported-runtime M6-01-R1](tasks/M6-01-R1.md) remains gated by an available
identified supported correction. C1/F2 release gate C remains open before
M6-14/16. Real storage interruption limits, full S13, security/notices,
target-native/screenreader/installed/manual update, backup/migration/owner pilot
and Local v1 admission remain later gates. DEV-02 is owner-only. No M7,
private-engine shipping, personal manuscript/credential/upload work.
