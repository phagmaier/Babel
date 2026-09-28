# AGENTS.md

## Mission and scope

Build the local-first screenwriting application defined in `SPEC.md`. Protect author content before adding features. The repository, not chat history, is project memory.

**Fresh repository:** if only the starter files exist, follow `BOOTSTRAP_PROMPT.md`, complete only milestone M0, and stop. Do not implement the editor, persistence engine, PDF system, Git history, or remote transfer during bootstrap.

## Start every session

1. Read this file and applicable local instructions. Inspect `git status` and existing changes; preserve work you did not create.
2. Read `docs/index.md`, `docs/current-state.md`, and the relevant `TODO.md` entries when they exist. Missing files are expected before bootstrap.
3. Select one ready, bounded task with satisfied dependencies, unless the user explicitly assigns another scope. `M*-G` groups are not ready until decomposed into `M*-NN` tasks with an updated requirement trace. State the task ID and deliverable.
4. Read its referenced specification sections, subsystem docs, code, and tests. Read the entire `SPEC.md` during bootstrap, not repeatedly for routine tasks.
5. Identify required checks and safety implications before changing code. A task blocked by its dependencies is not ready.

## Where to read

| Work | Required context |
| --- | --- |
| Scope, tradeoffs, architecture | `SPEC.md` S02-S04/S16; `docs/architecture.md`; relevant `docs/decisions/` |
| Source/model/import/export | `SPEC.md` S05-S06; `docs/document-model.md` |
| Editor, keys, completion, selection | `SPEC.md` S07; `docs/editor-behavior.md`; document-model contract |
| Home, sidebar, find/replace, accessibility | `SPEC.md` S08/S14; `docs/ux.md` |
| Script Check | `SPEC.md` S09; `docs/screenplay-validation.md` |
| Saving, recovery, snapshots | `SPEC.md` S10; `docs/persistence-and-recovery.md` |
| Revisions, remote operations | `SPEC.md` S11; `docs/sync-and-versioning.md`; persistence contract |
| PDF, pagination, fonts | `SPEC.md` S12; `docs/pdf-and-formatting.md` |
| Build, tests, performance | `SPEC.md` S13-S15; `docs/development.md`; `docs/testing.md` |
| Task/handoff conventions | `SPEC.md` S17-S20; `docs/index.md`; `docs/requirements.md` |

These docs are generated during bootstrap. Consult relevant nested `AGENTS.md` files explicitly if introduced; do not assume every harness loads every nested file automatically.

## Authority and non-negotiable rules

`SPEC.md` owns product requirements/invariants. Accepted ADRs document implementation choices within them. Subsystem docs explain contracts; TODO/current-state report progress. Do not silently resolve contradictions or weaken a requirement. Update the specification and related ADR/tests together for an approved contract change. ADRs live in `docs/decisions/NNNN-slug.md` with status Accepted direction, Pending proof, Deferred, or Superseded and an explicit Evidence still needed line.

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

Keep changes task-scoped and maintain module boundaries. Prefer existing, verified libraries over new frameworks. Pin dependencies and record license/packaging implications; do not add redundant engines or paid features.

Implement tests with behavior, including failure paths and undo where relevant. Use synthetic fixtures, temporary directories, and disposable remotes. Never test on the owner's only manuscript or auto-discover/use personal credentials.

Use the actual commands in `docs/development.md`. During bootstrap, establish those commands instead of inventing successful results. Required checks normally include formatting, lint, typecheck, focused and shared tests, relevant builds, and native/UI checks appropriate to the task. Record platform-dependent blockers separately. Never disable a check or broaden permissions just to get green output.

Preserve fixture bytes: formatters and Git newline conversion must not rewrite intentional Fountain whitespace, CRLF/BOM, or malformed fixtures. Do not regenerate expected results from the implementation and accept them without independent review.

## Context efficiency and handoffs

Use targeted searches and bounded file ranges. Do not dump the whole repository, lockfiles, generated output, full logs, or this entire specification for a small task. Save verbose logs locally and summarize exact failures. Do not install plugins/MCP servers or change global Codex settings to compensate for poor context use.

Before stopping or handing off, update `docs/current-state.md` with active task, completed work, touched paths, exact checks/results, blockers, and next safe action. Keep it roughly under 120 lines; archive detail in the owning docs/evidence. Record exact command, host, result, and `docs/test-evidence/M*.md` path for each check. Keep this root file roughly under 8 KiB.

Only mark TODO items done after acceptance evidence exists. Update relevant docs and the requirement trace when behavior changes. If interrupted, leave honest in-progress state and recovery instructions, not a false completion checkmark.

Parallel agents need explicit file ownership and bounded tasks. One coordinator owns shared task/status files, dependencies, and integration. Claim the task in `docs/current-state.md` and use one branch per task (`M1-01-<slug>`); never push to main without human review. Prefer isolated worktrees when appropriate. Subagents return concise evidence summaries; avoid recursive delegation and overlapping edits.

## Permissions and stopping

Proceed on reversible, in-scope defaults. Do not delete unrelated files, overwrite existing work, force-reset Git, commit/push/publish without authorization, create cloud resources, spend money, change global settings, or install privileged system packages. Initializing a local source repository during the requested bootstrap is allowed if none exists.

If a prerequisite is missing, document the exact failed command and next safe step. Continue independent work where useful, but leave the affected gate blocked. Escalate genuine privacy/destructive/cost decisions rather than guessing; do not ask again for information already recorded.

At completion report: task IDs, concise changes, exact checks with passed/failed/blocked status, remaining risks, and next task. Stop at the requested milestone boundary.

## Code review priorities

Review for silent data loss, stale version races, lossy serialization, unsafe native privileges, content/credential egress, unsupported pagination claims, incomplete input/undo behavior, missing failure tests, and contract drift. Never weaken persistence for a prettier interface.
