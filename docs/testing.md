# Test strategy and coverage

Status: M0/M1 proofs, M2-01–06 bounded Linux headless gates, and M3-04–07 editor foundation, structural keys, picker/shortcuts and local completion recorded. M2 headless exit does not establish Local v1. [SPEC S15/S20](../SPEC.md#s15); QA-01–03, INV-18.

## Test layers

| Layer          | Command                           | What it proves                                              |
| -------------- | --------------------------------- | ----------------------------------------------------------- |
| Unit/UI        | `pnpm test`                       | Vitest/JSDOM with injected ports; visible shell status      |
| Browser smoke  | `pnpm test:browser`               | System Chromium + Playwright; same in real browser          |
| Rust core      | `cargo test -p screenwriter-core` | Headless value, no WebView                                  |
| Rust workspace | `cargo test --workspace`          | Includes host command wiring                                |
| Native smoke   | `pnpm tauri dev`                  | Real Tauri/WebKit; mocked/browser results cannot substitute |

Browser preview deliberately reports native IPC unavailable. A native smoke must actually start Tauri and observe the app-info response in WebKit.

## Mandatory save faults (SPEC S15.2)

Crash before/after temporary write and replacement, partial write, sync failure, disk full, corrupt journal tail, out-of-order acknowledgements, external edit, second instance, history failure, and interrupted restore/remote adoption. Every failure must preserve known good generations and report truthful status. Real filesystem process-termination tests complement, but do not universally prove, mock fault tests.

## Evidence conventions

One compact report per milestone at `docs/test-evidence/M*.md`. Keep large logs outside routinely loaded docs and reference them by path. For each task, record exact command, host, outcome, skipped checks, and evidence. A source-only unit pass does not close a native packaging gate. Local-v1 adoption additionally needs an installed offline app, disposable writing/recovery/backup drills, migration review, and owner-reviewed pilot per SPEC S15.5.

Test on synthetic files only. Expected outputs need independent review; never generate goldens from the implementation and accept them automatically.

## Coverage summaries

Detailed per-task coverage lives in [development](development.md) (commands) and `docs/test-evidence/M*.md` (results). Key coverage areas:

- **M1 proofs**: Fountain round-trip, native editor input, PDF renderer, durable replacement, history store, bounded composition
- **M2 headless**: Safe open, recovery checkpoints, serialized source replacement, versioned IPC, startup review, recovery choices, snapshots, protected close, curated history
- **M3 codec/editor**: Independent conformance corpus, production primary codec, complex Fountain regions, editor state/source captures, structural keys, picker/shortcut routing/remapping, local completion source/caret/ranking/key/pointer acceptance and undo; M3-08 clipboard/emphasis/protected import tests and native row/latency proxies with blocked full real IME/cancellation gates

Each area's exact commands, host, outcomes, and limitations are recorded in the linked evidence files.
