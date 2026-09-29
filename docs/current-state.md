# Current state — M3-07 local completion complete

Date: 2026-09-29 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [M3 evidence](test-evidence/M3.md#m3-07--local-character-and-heading-completion).

## Completed task and trust boundary

**M3-07 Local character and heading completion** passed its bounded production-component and real WebKit acceptance on main, starting at clean `3c1e5ac`. One editing agent; no prior dirty paths. EditorState remains the sole live author-content/selection authority. Deferred local indexes derive cue names and heading segments from current editable rows; extensions stay separate, exact spelling is retained and similar names remain distinct. Ranking uses exact/prefix/subsequence, frequency and session-local recent use; the active row cannot suggest itself.

The compact popup anchors to the writing caret. Up/Down navigate, Enter/Tab accept, Escape dismisses and mouse acceptance keeps focus. Prefix/location/time replacement retains other segments, scene numbers and cue extensions. Completion has an isolated undo boundary before/after typing, and a second Enter performs smart editing. Offers bind the exact immutable document, session, version, range and caret; stale index/option/selection/session results refuse. IME/dead keys/paste/hidden/raw contexts suppress suggestions. No insertion happens by timing, and no source parse/capture/hash/index rebuild runs on an acceptance key.

The default desktop still cannot create/open/edit/save a screenplay. Native source/destination selection, full IME/paste/formatting, recovery/source cadence, Save As, production activation and Local v1 adoption remain open. The latest native persistence milestone remains the [M2 headless Linux exit](test-evidence/M2-06.md).

## Paths and checks

- `src/domain/completion.ts`, `src/editor/completion.ts`, `src/editor/view.ts`, `src/app/CompletionPopup.ts`/CSS implement the derived vocabulary, version-checked acceptance, input priority and popup. Tests: `tests/contract/editor-completion.test.ts`, `tests/ui/CompletionPopup.test.ts` and `tests/native/editor-completion/`. Owning contracts/task/trace/index/evidence are updated.
- [M3-07 evidence](test-evidence/M3.md#m3-07--local-character-and-heading-completion) owns exact commands, host/results/logs and omissions. Focused/shared frontend, Rust workspace/feature/format/lint, browser and default release build gates passed. Native keys/actual typing, segments, second Enter, Escape/F6, exact source/hash/caret/undo and trusted actual pointer dispatch on the displayed option passed. The app-only popup screenshot was visually inspected. DOM composition remains synthetic, distinct from actual pointer/keyboard input.
- The disposable pointer helper uses installed Wayland tools and a pinned/hash-checked MIT development protocol; it is not an app dependency or bundled runtime. Same-coordinate pointer-focus automation was corrected with a one-pixel motion inside the owned option; no compositor settings changed.
- Default app routing/native capabilities, existing codec/oracles and tracked Fountain fixture bytes remain unchanged. No writer/recovery/history/identity/lease/native metadata contract changed; no second filesystem matrix was needed. No source publication, runtime network service or upload was added.

## Limits and next action

**Next ready task: M3-08 Paste, inline formatting and native input matrix.** Read [brief](tasks/M3-08.md), TODO entry, SPEC S07.3/S07.7/S13–S15, editor/testing contracts, ADR 0008 and M1-02 limits. M3-09 is also dependency-ready; other tasks wait for predecessors. Missing real IME prerequisites must be recorded as blocked, never replaced with a dead-key or synthetic composition claim.

Completion operates at segment ends with an empty selection; it does not overwrite mid-segment suffix text or complete inside cue extensions. Persistent custom vocabulary/spellcheck remains M4. Full screenreader/touch/other-OS and large-document/native latency coverage remains open. M3-06's Space-opened GTK picker-popup automation remains unverified; native type-ahead passed. Existing ambiguous hidden/speech/page-break conversions and unproven Shift+Enter hard breaks still refuse visibly without dropping text.

M3-10 owns cadence/restoration; M3-11 Save As; M3-12 default writing activation; M3-13 integrated native safety exit. M4 workflows/title-page UI, M5 PDF and M6 history UX/backup/installed-offline/migration/owner pilot remain separate gates. Declare Tier 1 targets before M6. Power-loss durability, actual disk full, physical-disk independence and other OS adapters remain unverified.

Stop after M3-07. Continue on main with task IDs in commits; never push without human review and explicit authorization.
