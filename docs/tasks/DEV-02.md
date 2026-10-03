# DEV-02 — second-machine smoothness

Status: in progress (tooling slice landed; second-host bootstrap run still open).
Dependencies: DEV-01, M5-07. No milestone feature work.

Owner develops on two Linux/Hyprland machines and switching is painful.
Make a fresh checkout productive with one command and make local-state costs
visible, without touching app behavior or milestone gates.

## Landed slices

Tooling (committed): `tools/doctor.sh`, `tools/check-host.sh`,
`tools/bootstrap.sh`, `tools/clean.sh`, `VITEST_WORKERS`,
`CARGO_TARGET_DIR`-aware `build.rs` placeholder, `.env.example`.

Absolute-path sweep (this change): all 41 hardcoded
`/home/phagmaier/Code/babel` and `/home/phagmaier/Code/Babel` occurrences in
live instruction docs (`docs/development.md`, the writing-lifecycle drill
guide, three proof READMEs) now read `$PWD` (commands run from the checkout
root). Historical `docs/test-evidence/` command logs are intentionally
untouched — they record what was actually run.

### Tooling detail

- `tools/doctor.sh` — asserts the toolchain pins agree (`mise.toml` vs
  `rust-toolchain.toml` vs `.node-version` vs `package.json`) and that the
  resolved `node`/`pnpm`/`rustc` match. Read-only.
- `tools/check-host.sh` — probes native prerequisites (WebKitGTK 4.1, GTK3,
  librsvg, OpenSSL, Enchant 2, Chromium/WebKitWebDriver, Poppler, Ghostscript,
  Hunspell, wtype/grim/wl-clipboard, python3 >= 3.12) and prints the missing
  `pacman`/`apt-get` line. Read-only.
- `tools/bootstrap.sh` — one-command setup: `mise trust`, `mise install`,
  `pnpm install --frozen-lockfile`, `pnpm pdf-helper`. `--dry-run` prints,
  `--skip-helper` skips the renderer (plain cargo works without it).
- `tools/clean.sh` — dry-run by default; `--apply` deletes only run roots
  and output dirs NOT named anywhere under `docs/` (linked evidence stays).
  `--include-evidence` / `--include-dev` unlock the evidence dirs and the
  inspection venv. `target/pdf-helper`, `target/debug`, `target/release`
  are never candidates; read-only drill leftovers are re-owned before
  removal and one failure no longer aborts the rest.
- `vite.config.ts` — `maxWorkers` honors `VITEST_WORKERS` (default 2, raise on
  many-core desktops). Test-only; no app behavior change.
- `src-tauri/build.rs` — pdf-helper placeholder dir respects absolute
  `CARGO_TARGET_DIR` instead of assuming `../target`.
- `.env.example` — documents optional `VITEST_WORKERS`/`CARGO_TARGET_DIR`
  (the `.gitignore` `!.env.example` negation previously pointed at a file
  that did not exist).

Checks: `bash -n` + `shellcheck` on all four scripts, `doctor.sh` (pins agree),
`check-host.sh` (green on dev host), `clean.sh` dry run, `bootstrap.sh
--dry-run`, `cargo fmt -p babel-desktop`, `cargo check -p babel-desktop
--locked --offline`, `tsc --noEmit`, one `vitest` file (config load),
`prettier --check vite.config.ts`, `git diff --check`. Tier 1 scope:
no app/Rust behavior change; full `pnpm check`/workspace gates unchanged
and still required for behavior work.

Evidence: [M5](../test-evidence/M5.md#dev-02--second-machine-smoothness-tooling-slice).

## Still open (later slices, in priority order)

1. Second-host acceptance: run `bootstrap.sh` + `doctor.sh` + `check-host.sh`
   on machine 2 and record it. Nothing here is accepted until then.
2. Workspace exclusion for `prototypes/durable-replacement` and
   `prototypes/history-store` (still built by every `--workspace` gate).
3. `src/` layer duplication audit (9 duplicate basenames across
   domain/application/editor/infrastructure) and `WritingView.tsx` split.
4. Native harness packaging (`tests/native/writing-lifecycle`, ~50 modules)
   - Python lint gate; `development.md` split.

Retention policy is decided and executed: any run root named in `docs/`
is linked evidence and kept (16 such roots plus all `m*-evidence` dirs);
162 unreferenced `babel-writing-*` roots (~1 GiB) pruned with `--apply`.
`target/` is 31 → 30 GiB; the rest is evidence + build caches by design.

## Excludes

No app behavior, persistence, IPC, PDF pipeline, history or remote change.
No push. Owner `mise.toml`/`docs/development.md` edits stay uncommitted.
