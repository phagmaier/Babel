# Babel repository guide

Static navigation only. [AGENTS](AGENTS.md) owns operating rules;
[SPEC](SPEC.md#s00) owns product requirements and invariants.
[Current-state Next action](docs/current-state.md#next-action) is the sole
continuation pointer. [TODO](TODO.md) and the [audit tracker](docs/tasks/AUDIT-TRACKER.md)
record status and prerequisites. Read the selected brief, then its named files.

## Code and test roots

| Root                                                 | Responsibility                                            |
| ---------------------------------------------------- | --------------------------------------------------------- |
| [src/domain](src/domain)                             | Pure source/model, assessment and derived logic           |
| [src/editor](src/editor)                             | Sole live ProseMirror state, capture, keys and selection  |
| [src/application](src/application)                   | Versioned use cases and narrow native ports               |
| [src/app](src/app)                                   | React views and panels                                    |
| [src/infrastructure](src/infrastructure)             | Native/browser adapters                                   |
| [crates/screenwriter-core](crates/screenwriter-core) | Native identity, save, recovery, snapshots and history    |
| [src-tauri](src-tauri)                               | Desktop shell and narrow host commands                    |
| [tools/pdf-helper](tools/pdf-helper)                 | Pinned offline renderer/runtime                           |
| [tests](tests)                                       | Contract, UI, browser, native and differential gates      |
| [fixtures](fixtures/README.md)                       | Synthetic byte-sensitive fixtures and independent oracles |
| [tools](tools)                                       | Build, guidance/link checks and filesystem/native helpers |

## Owning documents

Use [AGENTS routing](AGENTS.md#where-to-read) for subsystem contracts.
[Development](docs/development.md#commands) owns commands, pins and check tiers;
[testing](docs/testing.md) owns coverage policy. [Requirements](docs/requirements.md)
maps requirement IDs to tasks. [ADRs](docs/decisions/README.md) own lasting decisions;
[task briefs](docs/tasks) own scope and acceptance. [Evidence](docs/test-evidence)
owns exact results and limitations; [native findings](docs/native-findings.md)
indexes retained crashes. Historical evidence applies only to its recorded build.
[docs/archive](docs/archive) holds finished briefs, reviews, handoffs and the
frozen audit; read it only when a current document links there.

Concrete paths here are Markdown links checked by `pnpm check:links`.
Do not duplicate current tasks, milestone snapshots or handoff results here.
The [naming map](docs/architecture.md) distinguishes the product
name from retained technical names.
