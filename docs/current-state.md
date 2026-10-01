# Current state — M4-12 complete

Date: 2026-09-30 PDT. Application: **babel**.

## Completed task

**M4-12 production offline spellcheck** completed by one editing agent on main
from clean `ddf81f2`. Selected Enchant/Hunspell now runs through narrow bounded
native commands. The panel supports explicit checks, language/Off, suggestions,
session Ignore and durable application-only Add. Character cue vocabulary is
view-only; corrections preserve source/marks/caret in one Undo step. Stale,
composition, read-only and protected workflows retain existing guards.

Dictionary settings use the private native store's identity/lease/publication
primitives with two checksummed generations and retained interruption artifacts.
Dictionary worker/queue is separate from manuscript persistence; failure leaves
writing/saving available. Native personal dictionaries and Learn are disabled.
[ADR 0033](decisions/0033-production-spellcheck-boundary.md) owns the explicit
PWL/direct system ABI refinement and resource/license obligations.

## Paths and acceptance

- Native: `crates/screenwriter-core/src/documents/spellcheck*.rs`, `src-tauri/src/enchant.rs`, `src-tauri/src/spellcheck_host*.rs`, native startup/handler wiring.
- Application/editor/UI: `src/application/spellcheck.ts`, `src/editor/spellcheck.ts`, `src/app/SpellcheckPanel.tsx`, `src/infrastructure/nativeSpellcheck.ts`, writing/editor/style integration.
- Focused contract/UI tests and `tests/native/writing-lifecycle/spellcheck_workflows.py`; existing keyboard helper adds GTK simple Unicode IME actions.

[Exact M4-12 evidence](test-evidence/M4.md#m4-12--production-offline-spellcheck):
`pnpm check` passed **660 tests**, browser smoke passed; Rust fmt/clippy and
workspace passed **234 tests** on tmpfs and Btrfs; focused native publication/
backend tests passed both filesystems. Production AppImage built. Default-release
native keyboard/pointer/Undo/GTK simple-IME/Ignore/Add/restart/language/failure
and offline namespace drills passed both filesystems. Final screenshots confirm
correct language controls and source-save independence during dictionary failure.

## Limits and next action

No M4-12 blocker. Host resources are English aliases; missing languages are
visible and usable for continued writing. Broader language/platform/IME,
installed package/offline adoption, full dependency notices and S13 remain open.
Forced-crash recovery/teardown attempts were not accepted as passing; evidence
retains failures and scopes restart to confirmed protected close/fresh process.
Broader integration remains M4-15/M6.

Next: **M4-13 characters/counts/recent position**, dependencies M4-01/03/06/10
satisfied. Read [its brief](tasks/M4-13.md), claim one bounded task and preserve
shared editor/lifecycle ownership. M4-13–15 remain open; no full M4/Local v1
claim. Continue on main; no push.
