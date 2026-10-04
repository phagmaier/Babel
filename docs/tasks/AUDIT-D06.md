# AUDIT-D06 — plain status and failure-only close prompts

Status: **done 2026-10-03**; base `200e375`. [Evidence and native limits](../test-evidence/AUDIT.md#audit-d06--plain-status-and-failure-only-close-prompts).
Dependencies: AUDIT-C04 complete; Wave 3 complete. DESIGN triage accepted D-06.
Requirements: SPEC S08.2/S08.6/S10.3, INV-05/INV-10; existing exact receipt,
freeze/capture, release, copy and explicit-risk contracts remain authoritative.

Covers [D-06](../../AUDIT.md#d-06--replace-the-evidence-style-status-string-and-the-always-shown-close-panel-with-a-plain-status-and-failure-only-prompts-impact-medium-high-m).
The frozen audit and [refuted proposals](../../AUDIT.md#dropped-or-refuted) remain read-only.

## Deliverable and acceptance

- Show the existing receipt-derived status (including `Saved locally`) in the
  header, retaining the editor-ahead override. Version/recovery/source/snapshot
  facts remain inspectable in a closed-by-default Save details disclosure.
  Snapshot attention and changes only in memory remain separate visible alerts.
- Close session, Home/Open and the native window close request share one entry.
  File-backed/read-only sessions automatically attempt the existing protected
  close; wait for exact protection and successful native release. Pending close
  disables conflicting actions and rejects duplicate requests. No risk acceptance
  or source credit is inferred from recovery or a copy.
- Untitled drafts still prompt before checkpoint-only close, with explicit
  recovery wording. Failures retain the editor and persistent retry/copy/risk
  choices. Keep writing dismisses the prompt and clears the pending destination;
  risk acknowledgement remains version-bound and resets on changed protection.
- Preserve title-input, composition and PDF-export guards. Keep Protect draft
  as recovery-only; no misleading Save label. Update only affected native close
  and readiness expectations, preserving byte/head/caret/Undo/failure assertions.

## Do NOT do

Change native filesystem/IPC algorithms, cadence/version/receipt policy, emergency
bundle policy, journal reconciliation, snapshots/history, other DESIGN items,
fixtures or dependency pins. Do not weaken the baseline commands/F6 assertion or
discard the retained daily-assessment failure. No SELinux, C1/F2, M6-02 or Local
v1 closure; no push.

## Checks and stopping

Record red mounted tests before production edits: automatic exact-receipt/release
wait, failure retention, untitled choice, cancellation, duplicate requests and
plain status/alerts/details. Focused WritingView, ProtectedClosePanel, protected
close, writing session, persistence state/controller and cadence tests; full
`pnpm check`, Rust fmt/clippy/workspace tests; browser smoke, default embedded
release, Python syntax/lint and changed-link/diff checks. Tier 2: frontend routing
and presentation only; native adapters/publication/identity/lease behavior is
unchanged, so no repeated Rust filesystem matrix. Native lifecycle samples on
tmpfs/Btrfs plus affected Home, characters, editor-exit, commands,
persistence-paths, capture-review and plain-presentation modes; use owned shutdown attribution
and independent retained-artifact audit. Keep failed attempts, distinguish
ordinary quit from forced teardown, and record baseline failures honestly.

Update the owning UX/persistence wording, TODO and current-state; link evidence
in `docs/test-evidence/AUDIT.md`. Commit locally on main and stop before D-02 or
other DESIGN implementation.
