# babel

babel is an offline desktop screenwriting app for Linux. It edits ordinary
[Fountain](https://fountain.io) files with screenplay formatting, and exports
industry-standard PDFs (US Letter, Courier Prime 12 pt, standard element
indents) without any network access.

What works today: scene headings, action, character cues, parentheticals,
dialogue, transitions and other Fountain elements with smart Enter/Tab and
autocomplete; title page; Find/Replace; outline and scene moves; Script Check;
spellcheck; continuous saving with crash recovery; named and automatic
snapshots ("versions") with restore; outside-change detection with Reload;
Save As, Fountain copies and PDF export.

**Status:** pre-release. The packaged app has passed an agent-run synthetic
writing and backup-restore pilot on the development laptop
([evidence](docs/test-evidence/M6-16-2026-10-06.md)), but the
full release checklist is not finished. Until it is, keep your current
software and a separate backup of any script you try here; do not make babel
the only home of an important manuscript.

## Build and run (Linux x86_64)

Prerequisites: Node 26, pnpm 11, Rust (see `rust-toolchain.toml`), Python 3,
and the WebKitGTK/GTK development packages listed in
[development](docs/development.md).

```sh
pnpm install --frozen-lockfile
pnpm pdf-helper          # builds the bundled offline PDF renderer (once)
pnpm tauri build         # produces the AppImage
./target/release/bundle/appimage/babel_0.0.1_amd64.AppImage
```

For development, `pnpm tauri dev` runs the app with live reload; `pnpm dev`
is a browser-only preview without saving or PDF.

## Try it safely

Work on a **copy** of a script. Files stay plain Fountain, so any Fountain app
can open them. Recovery and snapshots live on the same disk as your script;
use "Select copy destination" to keep a copy on another drive.

## Checks

| Purpose                                                      | Command                                                                                                         |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Frontend: guidance, links, format, lint, types, tests, build | `pnpm check`                                                                                                    |
| Capture/renderer differential gate                           | `pnpm test:differential`                                                                                        |
| Browser layout geometry                                      | `pnpm test:layout`                                                                                              |
| Rust format, lint, tests                                     | `cargo fmt --all -- --check`; `cargo clippy --workspace --all-targets -- -D warnings`; `cargo test --workspace` |

## For contributors and agents

[AGENTS.md](AGENTS.md) holds the working rules (agents make every decision),
[current state](docs/current-state.md) holds what to do next, `SPEC.md` is the
product contract and [map.md](map.md) is the repository guide. The npm package
is `babel-screenwriter`; the Rust core keeps the technical name
`screenwriter-core`. No application-code license has been chosen yet.
