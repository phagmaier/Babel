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

Keep task scope and module boundaries. Prefer verified, pinned libraries; record license/packaging. No redundant engines or paid features.

Test behavior and relevant failure/Undo paths with synthetic fixtures, temporary directories and disposable remotes. Never use the owner's only manuscript or personal credentials.

Before claiming implementation, the brief names its tier, exact focused commands, executable native drill modes and skip reasons. Shared checks may use an anchored reference to a named section; proposed drills are not executable checks. Complete missing details before coding. Run focused checks while iterating and the full required tier once before commit, using `docs/development.md`. Focused tests never replace shared/milestone gates. Capture/codec/bridge and renderer/assessment changes also follow `docs/testing.md#differential-regression-gates`.

Tier 3 filesystem triggers live in development: save/replacement/recovery/journal/history/identity publication, sync/interruption, leases and native metadata/path behavior. Pure codec/envelope/state tests need no second filesystem. Record coverage/omissions; never disable checks or broaden permissions for green output.

Evidence owns exact command/result/failures, host, native/browser/mocked labels and skip rationale: one line per check. Task/trace/handoff docs link evidence instead of repeating results. Preserve fixture bytes; formatters/Git must not rewrite Fountain whitespace, CRLF/BOM or malformed inputs. Implementation-generated expectations require independent review.

## Context efficiency and handoffs

Use targeted searches and bounded reads. Keep logs outside routinely loaded docs. Never read evidence or frozen `AUDIT.md` wholesale; read anchored task sections. Do not dump repositories, lockfiles or generated output, change global settings or install plugins to compensate for context use.

Before stopping, update current-state with task, paths, results, blockers and next action, linking evidence. Budgets: AGENTS/map 8 KiB, current-state 120 lines/8 KiB, TODO 12 KiB. `pnpm check:guidance` enforces them; a dated, owner-reviewed exception in `tools/guidance-exceptions.json` may retain necessary safety detail. Do not delete safety obligations to meet a budget.

If another coordinator owns shared docs, leave them untouched and write a task-local report with base, paths, checks and next action. Mark tasks done only after acceptance evidence exists. Keep completed tracker entries short: status/outcome and brief/evidence links. Open safety obligations may use explicit detail. Preserve historical evidence.

Default updates: current-state and owning tracker only. Update subsystem docs/trace/ADRs when behavior, safety, mapping or decisions change; do not rewrite unaffected rows or create routine ADRs. Record honest progress if interrupted.

Claim work in current-state. Work/commit on main by default, with task IDs in commit messages. Explicit owner-approved isolated workers may use branches/worktrees. Never amend a published commit; follow-up corrections are new commits. Tag verified milestone gates. Push only after review and explicit owner authorization.

## Permissions and stopping

Proceed on reversible in-scope defaults. No unrelated deletion/overwrite, force-reset, unauthorized push/publish, cloud resources, spending, global settings or privileged packages. Routine hygiene: `sh tools/clean.sh --apply`; evidence/dev pruning requires owner approval.

Record missing-prerequisite commands and safe next steps; continue independent authorized work with affected gates blocked. Escalate privacy/destructive/cost decisions. Index native crashes in `docs/native-findings.md`; active-writing/data-loss failures block affected feature work pending disposition. Forced-teardown/runtime findings keep release gates blocked; narrowly scoped safety investigations may proceed. Passing controls never close retained crashes.

Report task, changes, checks/status, risks and next action. Stop at the requested boundary.

## Code review priorities

Review data loss, stale races, lossy serialization, native privileges, content/credential egress, unsupported pagination, incomplete input/Undo, failure tests and contract drift. Never weaken persistence for a prettier interface.
