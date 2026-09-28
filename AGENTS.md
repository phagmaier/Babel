# AGENTS.md

## Mission and scope

Build the local-first screenwriting application in `SPEC.md`. Protect author content first. The repository is project memory.

**Fresh repository:** follow `BOOTSTRAP_PROMPT.md`, complete M0 and stop. No editor, persistence engine, PDF, history or remote transfer during bootstrap.

## Start every session

1. Read applicable instructions; inspect `git status` and preserve existing work.
2. Read `docs/index.md`, `docs/current-state.md` and the selected `TODO.md` entry including Dependencies/Read/Acceptance. Files may be absent before bootstrap.
3. Choose one ready, bounded task unless assigned otherwise. `M*-G` groups require `M*-NN` decomposition and an updated trace. State task ID and deliverable.
4. Use the task's Read list and routing table to find the relevant contract sections, code, and tests. Read whole documents only when the scope requires it; read the entire `SPEC.md` during bootstrap.
5. Identify checks/safety impact before editing. Unsatisfied dependencies block implementation.

## Where to read

| Work | Required context |
| --- | --- |
| Architecture | `SPEC.md` S02-S04/S16; `docs/architecture.md`; relevant ADRs |
| Source/model/import/export | `SPEC.md` S05-S06; `docs/document-model.md` |
| Editor, keys, completion, selection | `SPEC.md` S07; `docs/editor-behavior.md`; document-model contract |
| Workflows/accessibility | `SPEC.md` S08/S14; `docs/ux.md` |
| Script Check | `SPEC.md` S09; `docs/screenplay-validation.md` |
| Saving, recovery, snapshots | `SPEC.md` S10; `docs/persistence-and-recovery.md` |
| Revisions, remote operations | `SPEC.md` S11; `docs/sync-and-versioning.md`; persistence contract |
| PDF, pagination, fonts | `SPEC.md` S12; `docs/pdf-and-formatting.md` |
| Build, tests, performance | `SPEC.md` S13-S15; `docs/development.md`; `docs/testing.md` |
| Task/handoff conventions | `SPEC.md` S17-S20; task, state, index and requirement trace |

Consult relevant nested `AGENTS.md` files explicitly; do not assume the harness loads them.

## Authority and non-negotiable rules

`SPEC.md` owns requirements/invariants; ADRs own choices; subsystem docs explain contracts; TODO/current-state report progress. Do not silently resolve contradictions or weaken requirements. Approved contract changes update SPEC and related ADR/tests together. ADRs: `docs/decisions/NNNN-slug.md`, status + Evidence still needed. Create them for lasting choices/tradeoffs in ownership, format, durability, platform policy or dependencies. Routine details belong in code/owning docs; no automatic ADR per task.

- Fountain contains portable author content. Preserve unknown regions, meaningful whitespace, and no-op source bytes. Never silently normalize a manuscript on save.
- One live editor authority; native services own disk/history/remote operations. No arbitrary filesystem or shell endpoint in the frontend.
- Serialize native saves, preserve the previous valid generation, and acknowledge exact versions. Old acknowledgements cannot mark newer edits saved.
- Recovery, source-file saving, editor undo, Git history, and backups are distinct. A failure in one must not silently destroy the others.
- Script Check reports issues; it does not silently fix them. Incomplete drafting and blank lines are not automatically invalid.
- Remote Get Latest protects local work before fetching/applying. Preserve divergence; never force-push, auto-merge, or choose a winner by timestamp.
- Private hosting is not end-to-end encryption. No real upload before explicit destination/privacy approval. No telemetry or runtime network dependency.
- PDF preview/export share one pinned pipeline. No guessed page count or unsupported success. Expensive work stays off the typing path.
- Never call a mock test native verification, an unrun command passed, or a placeholder implemented. See all invariants in `SPEC.md` S03.

## Implementation discipline

Keep changes task-scoped and preserve module boundaries. Prefer verified libraries; pin dependencies and record license/packaging. No redundant engines or paid features.

Implement behavior tests including failures/undo where relevant. Use synthetic fixtures, temporary directories and disposable remotes. Never test on the owner's only manuscript or auto-discover/use personal credentials.

Use `docs/development.md` commands for changed behavior/acceptance gates. Docs-only: formatting, changed local-link checks, `git diff --check`; executable checks if commands/config change. Code: required focused/shared tests, formatting, lint/typecheck, relevant builds and native/UI checks. Focused tests cannot replace required shared/milestone gates.

Filesystem matrix: replacement/recovery/journal/history publication, sync/interruption, identity publication, leases and native metadata/path behavior. Pure codec/envelope/state tests need no second filesystem run. Record coverage/omissions; never disable a check or broaden permissions just to get green output.

Record exact command, host, outcome and evidence path once in `docs/test-evidence/M<milestone>.md`; label native vs mocked/browser and skipped/blocked gates. Task/trace/handoff docs link results instead of duplicating tables. Lists suffice. Bootstrap establishes actual commands; finish with `git diff --check`.

Preserve fixture bytes: formatters/Git must not rewrite Fountain whitespace, CRLF/BOM or malformed fixtures. Expected results generated by the implementation require independent review.

## Context efficiency and handoffs

Use targeted searches and bounded reads. Keep verbose logs outside routinely loaded docs; summarize exact failures. Do not dump repositories, lockfiles or generated output, or change global settings/install plugins to compensate for poor context use.

Before stopping/handoff, update `docs/current-state.md`: task, work, paths, checks/results, blockers, next action; under ~120 lines / 8 KiB, linking commands/host/detail in evidence. If the owner forbids editing another coordinator's files, leave them untouched; record base commit, paths, checks and next action in a task-local report.

Only mark TODO items done after acceptance evidence exists. Update owning docs for substantive behavior changes and affected trace entries when requirement coverage, task mapping, acceptance or evidence status changes. Do not rewrite unchanged trace rows or repeat the handoff in each doc. If interrupted, record honest progress and recovery instructions.

Claim tasks in `docs/current-state.md`. With one editing agent, work on `main` and commit completed work directly there; put task IDs in commit messages, not branch names. Tag verified milestone gates instead of creating milestone branches. Never push without human review and explicit authorization.

Create a short-lived branch, preferably in a Git worktree, only when two or more agents will edit concurrently; delete it after merge. Parallel tasks need bounded scope and file ownership. One coordinator owns shared task/status files, dependencies and integration (`TODO.md`, `docs/requirements.md`, `docs/current-state.md`, `docs/index.md`, ADRs). Preserve prior dirty work and record base commit + dirty paths in the handoff. Task entries name owned paths; subagents return concise summaries. Avoid recursive delegation/overlapping edits.

## Permissions and stopping

Proceed on reversible, in-scope defaults. No unrelated deletion/overwrite, force-reset, unauthorized commit/push/publish, cloud resources, spending, global settings or privileged packages. Local Git initialization is allowed only for requested bootstrap.

For missing prerequisites record failed command and next safe step; continue independent work, leaving affected gates blocked. Escalate privacy/destructive/cost decisions; do not repeat questions already answered.

Report task IDs, changes, exact checks/status, risks and next task. Stop at the requested milestone boundary.

## Code review priorities

Review data loss, stale races, lossy serialization, native privileges, content/credential egress, unsupported pagination, incomplete input/undo, missing failure tests and contract drift. Never weaken persistence for a prettier interface.
