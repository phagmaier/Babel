# Architecture and ownership

Status: M0 shell only. [SPEC S03-S04](../SPEC.md#s03), [S17](../SPEC.md#s17); APP-01, DOC-01, SAVE-01, SEC-01, QA-01.

Current paths: `src/app/App.tsx` owns the visible placeholder; `src/application/appInfo.ts` defines the typed boundary; `src/infrastructure/nativeAppInfo.ts` invokes the sole Tauri command, while `browserAppInfo.ts` declares browser-only unavailability. `src-tauri/src/lib.rs` has thin command wiring. `crates/screenwriter-core/src/lib.rs` owns the testable app-info value. There is one frontend package and one Rust workspace; no manuscript authority exists yet.

## Naming map

SPEC S17 uses `screenwriter/` as an illustrative root. Actual names in this
repository are authoritative for paths and artifacts:

| Name                 | Meaning                                                                           |
| -------------------- | --------------------------------------------------------------------------------- |
| `babel`              | Owner-selected application/product name; desktop binary and package identity      |
| `babel-screenwriter` | Frontend npm package name in `package.json`                                       |
| `screenwriter-core`  | Headless Rust crate in `crates/screenwriter-core/` (technical name, retained)     |
| `Screenwriter`       | Placeholder label used by the starter spec; do not use for new paths or artifacts |

Future flow is UI -> application commands -> domain contracts/platform ports, and Tauri commands -> headless native services -> tested adapters. The structured editor alone will own live edits; React will render surrounding UI and derived views. The TypeScript domain codec will own Fountain interpretation and source-aware serialization without filesystem access. Rust will accept immutable, versioned source snapshots and own disk durability, history, PDF orchestration, and eventually remote credentials. No arbitrary path or shell IPC is allowed. Current capability permissions are empty; the custom app-info command is harmless and needs no file permission.

Real IPC envelopes will be specified before M2: opaque document handle, project/session identity, monotonically increasing version, source hash, bounded payload, typed error/recovery action. Planned operations include open, checkpoint/save, close, history, render/cancel, and explicit remote transfer. None is implemented at M0. Derived results carry a version/hash; stale work cannot mutate the editor. Expensive filesystem, PDF, and remote work stays off key handlers.

See [ADR 0001](decisions/0001-local-first-stack.md), [0003](decisions/0003-editor-and-native-ownership.md), and [SPEC S04](../SPEC.md#s04) for authority and unresolved proofs.
