# AGENTS.md

## Mission and scope

Build the local-first screenwriting application in `SPEC.md`. Protect author content first. The repository is project memory.

## Start every session

1. Read applicable instructions; inspect `git status` and preserve existing work.
2. Read `docs/current-state.md` and the selected `TODO.md` entry. Skip `docs/index.md` unless you need to find a specific doc.
3. Choose one ready, bounded task unless assigned otherwise. `M*-G` groups require `M*-NN` decomposition and an updated trace. State task ID and deliverable.
4. Read the task brief (`docs/tasks/M*-NN.md`) and the specific files you will edit. Do NOT re-read SPEC, ADRs, or subsystem docs unless the task brief references them AND you need the detail for this specific change.
5. Identify checks/safety impact before editing. Unsatisfied dependencies block implementation.

**Fast path (small tasks):** If the task is under ~50 lines of change, you already know the relevant contract from prior work, and no filesystem/native behavior changes, skip steps 2-4 and start immediately. Still run the required checks before committing.

## Where to read

Only read these when the task brief references them AND you need the detail for this specific change:

| Work | Context |
| --- | --- |
| Architecture | `docs/architecture.md`; relevant ADRs |
| Source/model/import/export | `docs/document-model.md` |
| Editor, keys, completion, selection | `docs/editor-behavior.md` |
| Workflows/accessibility | `docs/ux.md` |
| Script Check | `docs/screenplay-validation.md` |
| Saving, recovery, snapshots | `docs/persistence-and-recovery.md` |
| Revisions, remote operations | `docs/sync-and-versioning.md` |
| PDF, pagination, fonts | `docs/pdf-and-formatting.md` |
| Build, tests, performance | `docs/development.md`; `docs/testing.md` |

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

Use `docs/development.md` commands and check tiers for changed behavior/acceptance gates. Each task brief states its tier, exact focused commands, named native drill modes (if any), and skips with a one-line rationale. Run focused commands while iterating; run the full tier gate once before commit. Docs-only: formatting, changed local-link checks, `git diff --check`; executable checks if commands/config change. Code: required focused/shared tests, formatting, lint/typecheck, relevant builds and native/UI checks. Focused tests cannot replace required shared/milestone gates for behavior changes; Tier 1 fast-path skips need a one-line rationale in evidence.

Filesystem matrix (Tier 3): replacement/recovery/journal/history publication, sync/interruption, identity publication, leases and native metadata/path behavior; triggers are listed in `docs/development.md`. Pure codec/envelope/state tests need no second filesystem run. Record coverage/omissions; never disable a check or broaden permissions just to get green output.

Record command, result (pass/fail), and any failures in `docs/test-evidence/M<milestone>.md`; label native vs mocked/browser and skipped/blocked gates. One line per check suffices — do not write paragraphs. Task/trace/handoff docs link results instead of duplicating tables. Bootstrap establishes actual commands; finish with `git diff --check`.

Preserve fixture bytes: formatters/Git must not rewrite Fountain whitespace, CRLF/BOM or malformed fixtures. Expected results generated by the implementation require independent review.

## Context efficiency and handoffs

Use targeted searches and bounded reads. Keep verbose logs outside routinely loaded docs; summarize exact failures. Never read `docs/test-evidence/M*.md` or `AUDIT.md` wholesale; open the brief's anchored section only. Do not dump repositories, lockfiles or generated output, or change global settings/install plugins to compensate for poor context use.

Before stopping/handoff, update `docs/current-state.md`: task, work, paths, checks/results, blockers, next action; under ~120 lines / 8 KiB, linking commands/host/detail in evidence. If the owner forbids editing another coordinator's files, leave them untouched; record base commit, paths, checks and next action in a task-local report.

Only mark TODO items done after acceptance evidence exists. Update owning docs for substantive behavior changes and affected trace entries when requirement coverage, task mapping, acceptance or evidence status changes. Do not rewrite unchanged trace rows or repeat the handoff in each doc. If interrupted, record honest progress and recovery instructions.

**Doc update default:** Per task, update only `docs/current-state.md` and `TODO.md`. Skip `docs/index.md`, `docs/requirements.md`, trace rows, and ADRs unless the task changes behavior, adds a decision, or fixes a safety issue. Do not create ADRs for routine implementation choices.

Claim tasks in `docs/current-state.md`. Work on `main` and commit completed work directly there; put task IDs in commit messages, not branch names. Tag verified milestone gates instead of creating milestone branches. Never push without human review and explicit authorization.

## Permissions and stopping

Proceed on reversible, in-scope defaults. No unrelated deletion/overwrite, force-reset, unauthorized commit/push/publish, cloud resources, spending, global settings or privileged packages. Routine disk hygiene is allowed without asking: `sh tools/clean.sh --apply` (safe disposables only); `--include-evidence` and `--include-dev` need owner approval.

For missing prerequisites record failed command and next safe step; continue independent work, leaving affected gates blocked. Escalate privacy/destructive/cost decisions.

Report task IDs, changes, exact checks/status, risks and next task. Stop at the requested milestone boundary.

## Code review priorities

Review data loss, stale races, lossy serialization, native privileges, content/credential egress, unsupported pagination, incomplete input/undo, missing failure tests and contract drift. Never weaken persistence for a prettier interface.
