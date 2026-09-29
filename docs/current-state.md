# Current state — M3-06 picker and shortcuts complete

Date: 2026-09-29 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [M3 evidence](test-evidence/M3.md#m3-06--element-picker-and-configurable-shortcut-registry).

## Completed task and trust boundary

**M3-06 Element picker and configurable shortcut registry** passed its bounded production-component and real WebKit contract on main, starting at clean `cdc0739`. EditorState remains the sole live text/type/selection authority. The picker reflects caret or Mixed; explicit conversions retain text/IDs/marks/full selection and one-step undo. All 14 authoring choices have direct commands, with explicit refusals for unsafe speech/hidden/page-break conversions. Shot metadata is captured and Action clears it.

The shared local registry drives commands, help and displayed shortcuts, includes S07.4 workflow actions with truthful disabled availability, and persists versioned remapping preferences without manuscript data. IME/completion/explicit/smart priorities are tested; M3-07 supplies real completion. Contextual Tab has an F6 escape to Element and outside Tab remains native navigation. [ADR 0022](decisions/0022-local-shortcut-preferences.md) owns the preference/platform policy.

The default desktop still cannot create/open/edit/save a screenplay. Native source/destination selection, completion, full IME/paste/formatting, recovery/source cadence, Save As, production activation and Local v1 adoption remain open. The latest native persistence milestone is still the [M2 headless Linux exit](test-evidence/M2-06.md).

## Paths and checks

- `src/application/shortcuts.ts`, `src/editor/{commands,shortcuts,view,sourceBridge}.ts` and `src/app/EditorControls.tsx`/CSS implement the registry, routing, selection/capture and controls. Tests: `tests/contract/editor-shortcuts.test.ts`, `tests/ui/EditorControls.test.tsx` and `tests/native/editor-shortcuts/`. Task/trace/index/owning contracts and ADR were updated.
- [M3-06 evidence](test-evidence/M3.md#m3-06--element-picker-and-configurable-shortcut-registry) owns exact commands, host/results/logs and omissions. Focused/shared frontend, Rust workspace/feature/format/lint, browser and default release build gates passed. The Rust ACL fixture again required the unsandboxed disposable Btrfs root. Native shortcuts, undo/source/hash/caret, Tab/reverse, F6/outside focus, Lyrics type-ahead, remap/reload/process-restart retention and Ctrl+é nonmatch passed.
- Default app routing, native permissions, source/import oracles and tracked Fountain fixture bytes remain unchanged. No native filesystem publication/identity/lease/metadata contract changed; no second filesystem matrix was needed.

## Limits and next action

**Next ready task: M3-07 Local character and heading completion.** Read [brief](tasks/M3-07.md), TODO entry, SPEC S07.6, docs/editor-behavior.md and the M3-06 registry. M3-09 is also dependency-ready; other tasks wait for predecessors.

Space-opened GTK picker-popup automation timed out; direct native type-ahead succeeded. Full alternate-layout/OS/menu/screenreader coverage remains open. Existing hidden-wrapper removal, styled/delimiter-bearing hidden conversion, unsafe speech reclassification and nonempty Page Break conversion refuse without dropping author text. Shift+Enter remains visibly refused until a proven per-context source round trip exists. The composition-sequence test remains synthetic, not a full real IME claim.

M3-08 owns full input/formatting; M3-10 cadence/restoration; M3-11 Save As; M3-12 default writing activation; M3-13 integrated native safety exit. M4 workflows/title-page UI, M5 PDF and M6 history UX/backup/installed-offline/migration/owner pilot remain separate gates. Declare Tier 1 targets before M6. Power-loss durability, actual disk full, physical-disk independence and other OS adapters remain unverified.

Stop after M3-06. Continue on main with task IDs in commits; never push without human review and explicit authorization.
