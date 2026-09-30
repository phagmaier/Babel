# Test strategy and coverage

Status: M0/M1 proofs, M2-01–06 bounded Linux headless gates, and the corrected M3-01–13 bounded Linux core-editor exit recorded. The [fresh M3-13 gate](test-evidence/M3.md#m3-13--corrected-integrated-exit-re-review) includes full default-app input/IME and a separate source re-review. Local v1 and full performance/platform/adoption gates remain open. [SPEC S15/S20](../SPEC.md#s15); QA-01–03, INV-18.

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
- **M3 codec/editor**: Independent conformance corpus, production primary codec, complex Fountain regions, editor state/source captures, structural keys, picker/shortcut routing/remapping, local completion source/caret/ranking/key/pointer acceptance and undo; M3-08 clipboard/emphasis/protected import and real IME commit/cancel/Enter; corrected M3-13 default-app corpus/input/lifecycle matrix and separate safety re-review passed on tmpfs/Btrfs

Each area's exact commands, host, outcomes, and limitations are recorded in the linked evidence files.

- **M4-03 advisory navigation**: independent boundary/attachment/Unicode/newline/protected text tests, capture coalescing/session/version/hash/Undo/import/restore rejection, read-only/frozen/composition selection guards and visible display bounds. Default-app outline/IME/scaling and isolated index measurements are task-scoped; second-filesystem projection tests are unnecessary. Full paint/page/long-session/accessibility remain open; [M4 evidence](test-evidence/M4.md) owns results and limits.

- **M4-04 workflow protection**: frontend/session stale document/selection/identity/composition/cancel/receipt and unavailable-source guards; read-only/frozen owned-dispatch import/Undo/cadence integration; strict MockRuntime envelopes over real native stores; native operation/byte/label/ref/recovery/source isolation and existing interruption/lease matrix on tmpfs/Btrfs. Default release import/cancel/history-failure uses the shared guard with visible controls. Moves remain M4-05; [M4 evidence](test-evidence/M4.md) distinguishes native headless, MockRuntime and WebKit observations.
