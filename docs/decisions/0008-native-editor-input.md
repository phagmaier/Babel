# ADR 0008 — Native ProseMirror input proof

Status: Accepted direction. Date: 2026-09-27. Task: M1-02. Sources: [SPEC S04/S07/S13–S15](../../SPEC.md#s07), EDIT-01/02/06, QA-02, INV-12/14; [ProseMirror guide](https://prosemirror.net/docs/guide/), [Tauri configuration](https://v2.tauri.app/develop/configuration-files/). Evidence: [M1 report](../test-evidence/M1.md), [proof harness](../../prototypes/native-editor/README.md).

## Decision

Proceed with ProseMirror as the preferred M3 structured editor on the reference Linux/WebKit host. The isolated M1-02 proof loaded deterministic 2,400/6,000/12,000-block workloads in a real Tauri WebView and observed native caret/selection, typing, history undo/redo, clipboard paste/undo, dead-key composition, and bounded key/transaction timing. The production app still has no editor. The proof uses pinned MIT-licensed ProseMirror packages in dev dependencies; M3 will move the chosen packages to runtime dependencies when the editor is integrated.

The proof does not change the [SPEC Enter table](../../SPEC.md#s07). It exposes a host event-ordering constraint: pressing Return during a dead-key composition ended composition before WebKit delivered `keydown:Enter` with `isComposing=false`, and the base editor inserted a paragraph. M3's smart Enter transaction must detect composition commitment across this event sequence and avoid an unintended structural transition. A test using a real IME and an undo assertion is required before shipping that behavior. Treat `event.isComposing` as one signal, not the whole composition guard.

## Consequences and alternative

The M3 editor can start with an ordinary unvirtualized ProseMirror DOM and a single live EditorState. Keep expensive source serialization, validation, and publication work off the input path. M1 keydown-to-next-frame values are a timing proxy, not actual compositor paint; the 139-sample p95 values were 16/19/34 ms at the three workload scales, with document-changing transaction p95 values 1/2/3 ms. Recheck against the S13 budget after schema/plugins and on Tier 1 platforms.

The reference Fcitx profile has only `keyboard-us`; a dead-key sequence proves WebKit composition events but not CJK/RTL IME correctness. If a target host fails the full M3 input matrix, provide an explicit source-preserving plain-text editing fallback or revisit the editor adapter while retaining one live authority. Do not silently corrupt or drop text, or promote a browser-only/mocked observation as native evidence. No second editor engine is added by this decision.

Evidence still needed: M3 screenplay schema/codec integration, real IME/Unicode/paste/caret/structural undo tests on declared Tier 1 hosts, composition-Enter guard verification, longer-session memory and actual paint measurements, and production packaging/adoption checks.
