# AGENTS.md

## Mission and scope

Build the local-first screenwriting application in `SPEC.md`. Protect author content first. The repository is project memory.

## Start every session

1. Read applicable instructions; inspect `git status` and preserve existing work.
2. Read `docs/current-state.md` and the selected tracker entry. `TODO.md` links audit status; skip `docs/index.md`.
3. Unless the user assigns work, select only `docs/current-state.md#next-action`. Tracker checkboxes report status, not authorization; fix conflicting pointers. Respect dependencies and stops. Choose one bounded task; decompose `M*-G` groups and update the trace. State task ID/deliverable.
4. Read its brief and files you will edit. Read SPEC/ADRs/subsystem detail only when referenced and needed.
5. Identify checks and safety impact before editing. Unsatisfied dependencies block implementation.

**Fast path:** For a known-contract docs/comment/UI-wording change with no behavior, filesystem or native impact, steps 2–4 may be skipped if the estimated and final tracked diff is at most 50 added/deleted lines, including tests/docs and excluding generated output. Run required checks; exceeding this scope restores the normal protocol.

## Where to read

Read only context needed by the selected brief. [map.md](map.md) owns static repository navigation.

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

Read nested `AGENTS.md` instructions if present; do not assume the harness loads them.

## Authority and non-negotiable rules

SPEC owns requirements/invariants; ADRs own choices; subsystem docs explain contracts; trackers/current-state report progress. Record and resolve contradictions. Approved contract changes update SPEC and related ADR/tests together. ADRs are for lasting ownership, format, durability, platform or dependency choices, with canonical status and `Evidence still needed`; routine details belong in code/owning docs.

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

Keep task/module scope. Pin verified libraries and record licenses/packaging. No redundant engines or paid features.

Test behavior, failure and Undo with synthetic fixtures, temporary directories and disposable remotes. Never use the owner's only manuscript or personal credentials.

Before implementation, name acceptance, the lowest tier, exact focused/native commands and skips. `docs/development.md` owns local and CI/release checks; it supersedes old routine checklists, not acceptance or safety/fault cases. Run focused checks while iterating and local checks on final code. Capture/codec/bridge and renderer/assessment changes follow `docs/testing.md#differential-regression-gates`.

Tier 3 covers persistence, IPC, interruption, leases, native paths and packaging. Run affected real-filesystem checks on tmpfs/Btrfs and named native modes; broad matrices belong to integration/release or demonstrated cross-boundary regressions. Pure codec/state tests need no second filesystem. Never disable safety checks or broaden permissions for green output.

Evidence uses one compact check table: command, kind, result, elapsed/unknown and skips; add failure/disposition detail only when needed. Trackers/handoffs link it. Keep full logs/inventories outside hot docs; retain irreplaceable failure provenance. Preserve fixture whitespace, CRLF/BOM and malformed bytes. Expectations need independent review. Findings follow `docs/testing.md#finding-disposition`; corpus discovery alone selects no work.

## Context efficiency and handoffs

Use targeted searches and bounded reads. Keep logs outside hot docs; read anchored evidence/audit sections, never whole reports. Do not dump repositories, lockfiles or generated output, change global settings or install plugins to compensate for context use.

Before stopping, update current-state with task, paths, results, blockers and next action, linking evidence. Budgets: AGENTS/map 8 KiB, current-state 120 lines/8 KiB, TODO 12 KiB. `pnpm check:guidance` enforces them; a dated, owner-reviewed exception in `tools/guidance-exceptions.json` may retain necessary safety detail. Do not delete safety obligations to meet a budget.

If another coordinator owns shared docs, leave them untouched and write a task-local report with base, paths, checks and next action. Mark tasks done only after acceptance evidence exists. Keep completed tracker entries short: status/outcome and brief/evidence links. Open safety obligations may use explicit detail. Preserve historical evidence.

Update current-state and owning tracker. Change subsystem docs/trace/ADRs only for changed behavior, safety, mappings or decisions; keep unaffected rows. Record honest progress if interrupted.

Claim work in current-state. Work/commit on main by default, with task IDs in commit messages. Explicit owner-approved isolated workers may use branches/worktrees. Never amend a published commit; follow-up corrections are new commits. Tag verified milestone gates. Push only after review and explicit owner authorization.

## Permissions and stopping

Proceed on reversible in-scope defaults. No unrelated deletion/overwrite, force-reset, unauthorized push/publish, cloud resources, spending, global settings or privileged packages. Routine hygiene: `sh tools/clean.sh --apply`; evidence/dev pruning requires owner approval.

Record missing prerequisites and continue independent authorized work. Escalate privacy/destructive/cost decisions. Native findings follow `docs/native-findings.md#disposition-and-escalation`: content loss and ordinary-operation crashes block affected work; forced/runtime findings need resolution or explicit reviewed residual-risk acceptance before release. Independent feature work may proceed within recorded reachability limits. Passing controls never erase failures; no deadline grants acceptance.

Report task, changes, checks/status, risks and next action. Stop at the requested boundary.

## Code review priorities

Review data loss, stale races, lossy serialization, native privileges, content/credential egress, unsupported pagination, incomplete input/Undo, failure tests and contract drift. Never weaken persistence for a prettier interface.
