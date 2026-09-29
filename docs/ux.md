# UX and accessibility

Status: M0 shell plus M2-05A read-only local startup recovery review and M2-05B headless recovery-choice contracts. [SPEC S08/S14](../SPEC.md#s08); APP-02, NAV-01–03, UX-01–03, SEC-01, INV-10.

M0 presents an application heading, explicit development status, and disabled New/Open actions. It has no recent registry, recovery list, manuscript status, or editor. The future home screen must make New, Open Fountain, recent/missing files, and recovery distinct. Remove from Recents cannot delete source. Project creation asks for a destination or explicitly creates a recoverable unsaved draft.

The future writing view is continuous, with title, optional scene/section outline, element picker, writing area, and status. Status must distinguish live dirty version, recovery protection, source-file saved version, page-count freshness, and remote last-check state. Never infer "saved" or "up to date" from a queued job or old check. Search includes hidden author text with explicit filters; replace-all and scene moves are reversible, have keyboard equivalents, and preserve structure. Script Check is a separate, non-destructive panel. Read-only PDF preview is the printed-page authority.

Local v1 includes light/dark, focus, zoom, typewriter scroll, offline spellcheck, character focus/list, title-page UI, counts with inclusion rules, recent position, and a command palette. Use semantic controls, focus visibility, sufficient contrast, reduced-motion behavior, keyboard reachability, and native tests for IME, dead keys, scaling, clipboard, and close flows. M0 visual inspection is recorded in [evidence](test-evidence/M0.md); it cannot establish the future UX contract.

M2-05A adds startup checkpoint summaries, damaged/pending/conflicting material
notices, text/hex previews, Refresh and Inspect Later. Content is rendered as
literal text, with truncated display explicitly labeled. Failure never exposes
arbitrary transport text or claims an empty successful scan. Deferral does not
resolve/delete the case, and previews do not restore/save a screenplay. Explain
that these local checkpoints are not a separate disk backup.

M2-05B adds the headless choice contracts and a `RecoveryChoicePanel` with
comparison facts, fixed transaction/source wording, an explicit new-version
input and Recover/Keep/Copy/Resolve actions guarded against stale results;
adoption stays disabled on divergence, stale comparisons or stuck
transactions, with only the emergency copy available then. No source is
natively selected in this build, so New/Open remain disabled and the startup
review says so explicitly. [ADR 0017](decisions/0017-explicit-recovery-choices.md).
Production picker wiring and managed-project discovery remain later tasks.
New/Open remain disabled. [ADR 0016](decisions/0016-read-only-startup-recovery-review.md).

M2-05C provides a `SnapshotPanel` for a natively opened registration. It shows
named versions, the retention/cap policy and interrupted-material notices.
Actions require a name for an explicit snapshot and a strictly newer version for restore.
Native restore protects current live/disk bytes before replacement. Snapshot,
copy and source receipts have distinct wording; stale results cannot publish a
restore after the document or destination changes. Failed transport text stays
hidden behind fixed messages. Names render as literal text, with keyboard labels
and visible focus on inputs. Low-space/cap/attention failures retain protected
versions and ordinary source/recovery status.

Copies require an explicit native-selected destination token. Same-filesystem
wording states that losing the backing disk loses the copy; different-filesystem
wording says the physical disk is unverified. No automatic backup success or
alternate location is inferred. The native picker/controller is still absent in
the production shell; this panel is mounted only by the marked synthetic native
[diagnostic](../prototypes/snapshot-review/README.md) or injected tests. M2-06 owns
curated history protection.

M2-05D adds an injected `ProtectedClosePanel` and a synthetic native editor
close flow. Close failure remains visible with Retry, Save Emergency Copy and
explicit risk. When both normal and recovery storage fail, it states that newer
changes exist only in memory. An unsaved draft closes after a fresh recovery
receipt with recovery-only wording. The source is never labeled saved from a
checkpoint or backup copy. Production editor/picker wiring and full keyboard,
screenreader and installed-app close review remain open.

M3-06 adds reusable semantic [writing controls](../src/app/EditorControls.tsx): a caret/Mixed Element select, contextual Tab guidance with an F6 escape, a command/help list, and local shortcut settings. Menu/help labels and availability come from one registry. Settings support remap, unassign and restore defaults, show duplicate/reserved/storage failures, and report local preference success only after storing it. Commands awaiting later milestones stay disabled with an explicit explanation. The controls are mounted only in the synthetic native diagnostic until M3-12 activates production writing. Native keyboard/type-ahead, source/undo, remap/reload and focus evidence is in [M3-06](test-evidence/M3.md#m3-06--element-picker-and-configurable-shortcut-registry); screenreader and full platform coverage remain open.
