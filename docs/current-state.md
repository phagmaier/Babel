# Current state — 2026-10-06

Application: **babel**, local-first Linux screenwriting (Tauri/React/Rust).
Agents decide under [ADR 0043](decisions/0043-agent-decision-authority.md).
Branch: `main`. M6-14 complete including bundled-library notices.
Local v1 admission remains open.

## This session

**M6-14 notices** ([brief](tasks/M6-14.md),
[evidence](test-evidence/M6-14-notices-2026-10-06.md),
[ADR 0046](decisions/0046-package-notice-file.md)), with M6-10.
Exact licence texts and provenance for every library the AppImage actually
bundles, derived from the artifact via `--appimage-extract`:

- 141 inventory entries, 138 verbatim texts under `docs/third-party/`
  (`package-libraries.md` table, `package-inventory.json`,
  `package-licenses/`, generated `NOTICES.md`). No text written from
  memory: installed packages, pinned inputs, node_modules or SHA-256-pinned
  upstream fetches; L1/L2/L3 limitations recorded.
- In-package notice `usr/lib/babel/THIRD-PARTY-NOTICES.md` (Tauri resource,
  byte-identical to the committed source) plus read-only surfacing: narrow
  `third_party_notices` IPC command, `Tools → Third-party notices` catalog
  entry (palette + native menu), lazy dialog from Home and the writing view.
- `tools/check-package-notices.py` CI gate (coverage/presence, host
  independent) wired after the spellcheck check; dictionary bundling is
  mechanically unblocked but declined — dictionaries stay host-provided.
- Final artifact `babel_0.0.1_amd64.AppImage`:
  SHA-256 `38710fb1cba4622bc0b744ed8891a2d23f3e6045322279cac3feaa30759a805e`;
  fresh extraction is byte-identical to the build AppDir.

## Checks

| Command                                                             | Result                                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------ |
| `build-package-notices.py`                                          | 141 entries, 138 texts                                       |
| `check-package-notices.py` (AppDir + extract)                       | Pass, 0 failures, 0 warnings                                 |
| `check-package-spellcheck.py` (new AppDir)                          | Pass: bundled provider, `en_US` true                         |
| `installed_launch.py` on final artifact                             | Pass: FUSE, ordinary exit, no crashes, clean uninstall       |
| `cargo test -p babel-desktop --lib`                                 | 63 pass, incl. new notices test                              |
| `cargo clippy` (babel-desktop) + `cargo fmt`                        | Clean                                                        |
| `pnpm test` (full Vitest)                                           | 1510 pass, incl. new dialog/dispatch/invoke tests            |
| `pnpm lint`, `pnpm typecheck`                                       | Clean                                                        |
| `pnpm format:check`, links (2009+227), guidance, `git diff --check` | Clean                                                        |
| `unittest discover -s tests/tools`                                  | 10 pass (1 pre-commit discovery artifact on untracked files) |

Skipped: full workspace matrix, differential, browser smoke, CI run —
frontend/Rust deltas covered above; packaging delta covered by packaged
checks; CI runs the rest on push.

## Known limitations

- L1/L2/L3 notice limitations: canonical SPDX texts where Arch ships no
  file (upstream COPYING verified locally only for Enchant/Hunspell/libltdl);
  transitive Rust-crate and transitive npm texts remain M6-10 work.
- Regenerating notices needs the Arch build host (pacman provenance).
- Prior M6-14/M6-16 limitations carry over: one host/distribution, `en_US`,
  backups on the same laptop, no second-host/real-migration evidence.
- Full S13/long session, wider IME/keyboard/a11y, enforcing SELinux and the
  retained Replace-All load flake remain outside these checks.
- Historical [native findings](native-findings.md) retain their strict
  failures and ADR 0043 disposition. No new crash event in the passing runs.
  M6-02 Save As/IME readiness lag, shared-store lease limit and capture
  refusals naming no row remain known limitations.

## Next action

1. **M6-03 remainder**: native interruption/low-space retention drill.
   [Brief](tasks/M6-03.md).
2. **M6-16 admission review**, after M6-03: refresh requirement
   evidence against the final package and resolve release gaps.
   [Brief](tasks/M6-16.md).
3. **Capture**: recovery copy for refusals naming no row.
4. **D-05 remainder**: protected workflows take a PreDestructive snapshot and
   treat Git history failure as a warning ([ADR 0030](decisions/0030-version-bound-workflow-protection.md)).
5. Later, not V1 blockers: current-script picker folder; M6-04, M6-10–13
   beyond release notices, M6-15, DEV-02, M6-05–09, AUDIT-PARK-T (2), M7, M8.

Native drills: check `df -i /tmp`, use fresh outputs and absolute roots;
follow [development](development.md) and the
[native guide](../tests/native/writing-lifecycle/README.md#m6-14-installed-package).
A packaging, spelling or picker change needs the packaged modes.
