# Current state — M3-08 implementation, native gate blocked

Date: 2026-09-29 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [M3-08 evidence](test-evidence/M3.md#m3-08--paste-formatting-and-native-input).

## Task and work

**M3-08** was claimed on main at clean `5518522`, one editing agent, no prior dirty paths. Bounded clipboard, emphasis and protected Fountain import are implemented; the TODO stays unchecked because full native acceptance is blocked/unverified.

External paste retains the target type and literal whitespace; Dialogue does not infer Fountain. Internal copy preserves supported marks/complete groups with fresh IDs, and single speech paragraphs can paste inline into the target cue. HTML becomes inert plain text with no adopted scripts/resources/attributes. Protected/hidden/invalid/ambiguous clipboard edits refuse atomically. Copy/cut/paste and emphasis have selection/source undo tests; Mod+B/I/U join the shared remapping registry. Parenthetical punctuation stays outside emphasis. Drop still refuses.

Explicit Fountain import stages whole-screenplay replacement, captures the exact current draft and waits for an owned native checkpoint plus curated safety revision. Stale editor/view/composition, history failures or wrong receipts refuse. Native source files are unchanged. One isolated undo/redo restores exact immutable source origins, including BOM/CRLF, unknown/protected, empty and invalid UTF-8 bytes, without rolling back versions/ID allocation. [ADR 0023](decisions/0023-protected-fountain-import.md) owns the provenance/safety choice.

## Paths and checks

- `src/editor/{clipboard,formatting,state,schema,view,shortcuts}.ts`, `src/application/{shortcuts,fountainImport}.ts`, `src/infrastructure/nativeFountainImport.ts`, `src/app/FountainImportPanel.ts`; narrow core history/host protection endpoint. Tests: `tests/contract/editor-input.test.ts`, `tests/ui/EditorInput.test.ts`, source bridge guard, `tests/native/editor-input/`.
- [Evidence](test-evidence/M3.md#m3-08--paste-formatting-and-native-input) owns exact commands/host/logs. Focused/shared frontend, Rust workspace/feature/format/clippy, default browser/release build, Chromium resource interception and native tmpfs/Btrfs protection tests passed. Available real WebKit clipboard/marks/Unicode/grapheme/RTL/dead-key commit/separate Enter, protected import/source undo and physical selection checks passed. The native task drill exits **2**, explicitly preserving blocked full IME/cancellation acceptance.
- Native safety refs were independently inspected for exact live-draft bytes; original synthetic source files stayed byte-identical. Six synthetic Action/mixed speech/notes/long-paragraph row workloads recorded transaction and key-to-animation-frame measurements; these are bare-editor proxies, not compositor paint/page-count claims.
- Default route, dependency manifests/locks, existing codec/oracles, tracked Fountain fixture bytes and native capabilities stay unchanged. Diagnostics remain feature-only/dev-served. No upload, source publication, global settings or package installation. Owned diagnostics are stopped.

## Blockers and next action

Full CJK/RTL IME is absent: Fcitx reports `keyboard-us`; Chinese/Japanese/IBus packages are not installed. GTK dead-key Escape committed spacing acute rather than cancelling; cancellation is **unverified**, with exact content/Undo recorded. Do not substitute these observations or synthetic DOM composition for real IME commit/cancel/Enter acceptance. Complete S13 actual paint, page-equivalent calibration and integrated completion/cadence measurements remain open; M3-13 owns integration and M5 the pinned production page pipeline.

**Next independently ready task: M3-09 native source/destination picker and recoverable drafts.** Read [brief](tasks/M3-09.md), TODO dependency/read/acceptance and persistence/path contracts. To close M3-08, use an explicitly prepared full IME host and complete the remaining declared input matrix, retaining the recorded limits on later full-performance gates; do not install privileged packages or change global settings automatically. M3-12 still depends on accepted M3-08.

M3-06 Space-opened picker automation remains unverified; native type-ahead passed. M3-10 cadence/restoration, M3-11 Save As, M3-12 production writing and M3-13 integrated safety remain open. Default desktop cannot create/open/edit/save a screenplay. Tier 1, screenreader, touch, installed/offline, long-session/adoption and true power-loss/disk-full/physical-disk independence remain later gates. No Local v1 completion is claimed.

Stop this bounded task with honest open gates. Continue on main with task IDs in commits; never push without human review and explicit authorization.
