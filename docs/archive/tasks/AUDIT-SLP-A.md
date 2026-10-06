# AUDIT-SLP-A — Remove unused import, read, relink and status paths

Status: **complete; stopped before AUDIT-SLP-B**. Base `09d496f`, main, 2026-10-03.
Dependencies: AUDIT-TEST complete; Wave 3 approved in TODO. Requirements: QA-01,
INV-03/05/07, existing import/source/recovery/status contracts.

## Scope and acceptance

- S-06: require WritingView workflows, remove the legacy import port/branch,
  adapter, IPC registrations, host wrapper and core wrapper/receipt. Import
  always runs the frozen session coordinator; preserve its existing refusal
  messages (including Error.message), staged content, exact protection and Undo.
  Port legacy tests to this live coordinator, retaining stale, composition,
  concurrency, wrong receipt and history-failure coverage. Repoint the three
  core import tests to protect_editor_workflow. Migrate the native input fixture
  to the same coordinator; no compatibility command remains.
- S-07: remove readInitial, read_open_document and host reader/worker. Repoint
  dispatch-level path/session/release-revocation coverage to live native
  commands, retaining raw-byte entry evidence and structured failure checks.
  Keep core read_initial where native code needs it.
- S-09: delete relink_selected/note_recent_relink and tests specific to the
  removed native-only capability, per the recorded owner decision. Preserve
  production M4-01 locate/confirm_recent_location coverage, identity checks,
  moved-file recovery and ownership refusals. No live re-anchoring replacement.
- S-10: delete unmounted SaveStatus and port its assertions to the mounted
  WritingView Protection status: exact live/recovery/file/rolling versions,
  snapshot attention, only-in-memory warning, Save failed and External change.
  Preserve current UI wording; D-06 remains separate.

## Tests first and checks

Record a red removed-IPC surface check before production edits. The tracked
`python3 tools/audit-test-mutations.py <new-output-directory> --slp-a` runner
checks the removed surfaces and detects seven in-memory import/status faults;
its original AUDIT-TEST suite stays the default. Port behavior
assertions before removing their old implementations; no weaker oracle. Tier 3:
focused frontend/core/desktop tests, full pnpm check, Rust fmt/Clippy, full
workspace matrix tmpfs/Btrfs, browser smoke, default release build and native
workflow-protection drills on both filesystems. Run the migrated feature-only
native input/protection fixture on disposable data; retain unavailable or failed
trusted-input gates honestly. Changed local links and git diff --check finish.
Commands/results/timing and failed artifacts belong in
[audit evidence](../../test-evidence/AUDIT.md).

## Do NOT do / stopping point

Keep AUDIT.md frozen, fixture bytes and prior failure evidence intact. Do not
start SLP-B/C, SIMP-N/F, D-06, schema work, draft-bundle fallback, relink lease
repair/exposure, recovery retirement/auto-adoption, dependency changes or gate
closure. Update affected owning docs/ADRs for removed surfaces, tracker,
handoff/evidence; commit on main and stop after AUDIT-SLP-A. No push. SELinux,
C1/F2, M6-02 and Local v1 admission remain open.

Acceptance/checks/failures: [AUDIT-SLP-A evidence](../../test-evidence/AUDIT.md#audit-slp-a--unused-import-read-relink-and-status-paths).
