# AGENTS.md

## Mission

Build the local-first screenwriting app in `SPEC.md` until the owner can write in it instead of paid software. Protect author content first. Ship working software; documentation serves the code, not the reverse.

## You make the decisions

The owner built this project entirely with agents and is **never** a blocker ([ADR 0043](docs/decisions/0043-agent-decision-authority.md)). Do not ask the owner to choose, approve, review or accept anything; do not end with "owner decision needed".

- Decide what is best, record the reason in the commit message (an ADR only for lasting format/durability/platform/dependency choices), and continue.
- Older docs that say "owner decision", "owner-only" or "owner review" now mean "agent decision recorded in the repo".
- Safe defaults replace questions: anything that would spend money, create cloud resources, upload or publish author content, use personal credentials or the owner's manuscripts, or change global settings is a **no**. Take the free, local, synthetic alternative and note any limitation.
- Known limitations are recorded and work moves on. Only reproducible content loss, a false "saved" status, or a crash during ordinary writing/save/close blocks related work, and then fixing it is the next task.
- An investigation gets at most one follow-up. After that, fix it, record it as a limitation, or defer it. No R7-style chains.
- You may reverse an earlier agent decision; say why.

## Start every session

1. Inspect `git status`; preserve existing work.
2. Read `docs/current-state.md`. Unless the user assigned work, take the **first unblocked item** in its Next action list. If it is blocked, note why in one line and take the next. If the list is empty, add the next item that moves toward the writing pilot (`TODO.md`, SPEC S16) and take it. Never stop with nothing selected.
3. Read only the brief, contracts and files the task needs (table below). State the task and deliverable.

## Where to read

[map.md](map.md) owns navigation. Read the subsystem doc only when the task touches it.

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

## Product rules that never bend

SPEC S03 owns the full list. In short:

- Fountain holds portable author content. Preserve unknown regions, meaningful whitespace and no-op bytes; never silently normalize a manuscript on save.
- One live editor authority; native code owns disk, history and remote operations. No arbitrary filesystem or shell endpoint in the frontend.
- Serialize native saves, keep the previous valid generation, acknowledge exact versions. Old acknowledgements never mark newer edits saved.
- Recovery, source saving, Undo, history and backups are independent; a failure in one must not stop or destroy the others.
- Script Check reports; it never silently fixes. Incomplete drafting is not automatically invalid.
- Remote Get Latest protects local work first; never force-push, auto-merge or pick a winner by timestamp. The app asks the *writer* before any upload. No telemetry or runtime network dependency.
- PDF preview and export share one pinned pipeline; no guessed page counts. Expensive work stays off the typing path.

## Implementation and checks

- Keep scope to the task. Pin verified dependencies and record licenses. No redundant engines or paid features.
- Test behavior, failure and Undo with synthetic fixtures and temporary directories. Never use real manuscripts or credentials.
- Use the lowest check tier in `docs/development.md` that covers the change; persistence/native changes add the real-filesystem checks there. Capture/codec/renderer changes also run `pnpm test:differential` (needs `pnpm pdf-helper` once).
- Never call a mock native verification, an unrun command passed, or a placeholder implemented. Never disable or weaken a test to get green. If a check cannot run here (no desktop/WebDriver host, missing hardware), say so in the report and continue.
- A test that pins a known bug is temporary: when you fix the bug, change the test to pin the fix.

## Docs and handoff

- Before stopping, **overwrite** `docs/current-state.md`: what changed, check results, known limitations, and the ordered Next action list. It is a snapshot, not a log; history lives in git.
- Evidence: a compact check table (command, result, skips) in the commit message. Add `docs/test-evidence/<TASK>.md` only for persistence, native or release work.
- Update a subsystem doc or ADR only when its contract changes. Do not create new docs for routine tasks; merging or deleting stale docs is fine (git keeps history).
- `pnpm check:guidance` enforces budgets: AGENTS/map 8 KiB, current-state 120 lines/8 KiB, TODO 12 KiB.

## Git

Work on the branch you were given (default `main`). Commit with the task ID in the message. Push your branch once checks pass. Never force-push, amend or rewrite published history; never delete unrelated files. Routine cleanup: `sh tools/clean.sh --apply`.

## Code review priorities

Data loss, stale races, lossy serialization, native privileges, content/credential egress, unsupported pagination, incomplete input/Undo, missing failure tests, contract drift. Never weaken persistence for a prettier interface.
