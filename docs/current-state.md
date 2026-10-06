# Current state — 2026-10-06

Application: **babel**, local-first Linux screenwriting (Tauri/React/Rust).
Agents decide under [ADR 0043](decisions/0043-agent-decision-authority.md).
Branch: `main`. The package now installs per user, starts from its desktop
entry and has working spellcheck. Local v1 admission remains open.

## This session

**M6-14 install and packaged spellcheck** ([brief](tasks/M6-14.md),
[evidence](test-evidence/M6-14-2026-10-06.md),
[ADR 0045](decisions/0045-user-install-and-packaged-spelling.md)).

- **Defect fixed: packaged spellcheck never worked.** Enchant finds provider
  modules beside its own library and the bundle had none, so the package
  showed every language unavailable on any host. Earlier passes used the
  unbundled release binary. The build now stages the Hunspell provider and
  library into the AppImage (`tools/stage-spellcheck-provider.py`); CI runs
  `tools/check-package-spellcheck.py` after the package build. That guard's
  first CI run caught a second case: CI's source-built Enchant was not
  relocatable, so its package used the build prefix. CI now builds it
  `--enable-relocatable` and staging refuses a non-relocatable Enchant.
- **Defect fixed: save pickers opened in the read-only package folder.** The
  package's working directory is its mount (its WebKit needs that), so a
  bare-filename Save As was refused. All four native pickers now start in the
  home folder. A/B: same drill fails on the old package, passes on the new.
- **New: `tools/install-desktop.py`** (`install`, `status`, `uninstall`).
  Per-user copy plus one launcher entry; no root or system setting; every
  package keeps its own file; uninstall removes only unchanged files it
  recorded and never app data. Refuses a path containing `%` (GLib rejects it).
- Desktop-entry launch verified: fresh profile with spaces/non-ASCII paths,
  entry validated, started by name through GIO, FUSE self-mount, window class
  matches the entry, Home rendered with the native host connected, no
  internet sockets, ordinary close, mount released, clean uninstall.
- Installed final package, development toolchains/caches/sources/interpreters
  hidden from the app, loopback only: `picker-start`, `typed-export`,
  `recovery-shutdown`, `local-pilot` and `publication-exit` pass in one run
  and `spellcheck` in two separate runs, all with clean process and crash
  audits. The running app loaded Enchant, provider and Hunspell only from
  its own mount.
- Host dictionaries hidden: the app states "en_US (unavailable)", disables
  Check, marks nothing and still saves exact bytes.

Final package: AppImage `fc187bea…f999b`, packaged executable `9937166d…`.
The M6-16 pilot ran the previous package (`6eabb82a…`); five of its modes were
rerun on the final one here.

## Checks

| Command                                                        | Result                                             |
| -------------------------------------------------------------- | -------------------------------------------------- |
| `pnpm check`                                                   | Pass; 78 files, 1504 tests; links, guidance, build |
| `cargo fmt --all -- --check`; Clippy `-p babel-desktop`        | Pass                                               |
| `cargo test -p babel-desktop --locked`                         | 62 pass                                            |
| `python3 -m unittest discover -s tests/tools -p 'test_*.py'`   | 10 pass (5 new installer tests)                    |
| `sh tools/lint-py.sh`                                          | Pass                                               |
| `tools/check-package-spellcheck.py <AppDir>`                   | Fails before the fix, passes after                 |
| Staging vs host, relocatable and default upstream Enchant      | Pass, pass, refused as intended                    |
| CI on `a6cbfc0`                                                | Existing steps pass; new guard failed, then fixed  |
| `installed_launch.py` on the final package                     | Pass                                               |
| Packaged runner, six modes, development hidden                 | 5/6; spellcheck entry hit a drill bug, since fixed |
| Packaged runner, `spellcheck`, development hidden              | 1/1 in two separate runs                           |
| Packaged runner, dictionaries masked, `spellcheck-unavailable` | 1/1                                                |
| Release binary `integrated_exit.py --modes spellcheck`         | 1/1                                                |

Not run: `pnpm test:differential`, workspace filesystem matrix, full native
matrix (no capture, codec, persistence or frontend change). Failed and
harness-fault runs are retained and listed in the evidence.

## Known limitations

- **Not installed in the owner's own profile**: agents do not change the
  owner's launcher. `python3 tools/install-desktop.py install` does it.
- Manual update with real app data, unknown-newer refusal and licence
  notices for bundled libraries are open (M6-14, M6-10).
- One host and distribution; only `en_US`. The no-dictionary case hides the
  folder rather than using a host without spelling packages. The
  desktop-entry run is not network-isolated (FUSE cannot mount in the
  unprivileged namespace); offline evidence is the mounted runner's.
- Pickers start in the home folder, not the current script's folder. No file
  association: the app takes no file argument.
- Backup is a separate filesystem on the same laptop, not an independent
  disk. Real-software migration and second-host bootstrap are deferred; keep
  independent backups and the old writing workflow.
- Full S13/long session, broader IME/keyboard/a11y, enforcing SELinux and the
  retained Replace-All load flake remain outside these checks.
- Historical [native findings](native-findings.md) remain accepted under ADR
  0043 with original strict failures; no new crash event this session.
- M6-02 Save As/IME readiness lag (~117 ms, content saved), shared-store
  lease limit, and capture refusals naming no row remain known limitations.

## Next action

1. **M6-14 manual update drill**: with the retained previous package create
   source, snapshot, recovery, preferences and a dictionary word; install the
   next package; verify each reads back exactly; add an unknown-newer-schema
   refusal case. [Brief](tasks/M6-14.md#done-and-remaining).
2. **M6-03 remainder**: native interruption/low-space retention drill.
   [Brief](tasks/M6-03.md).
3. **M6-16 admission review**, after M6-14/M6-03: refresh requirement
   evidence against the final package and resolve release gaps.
   [Brief](tasks/M6-16.md).
4. **Capture**: recovery copy for refusals naming no row.
5. **D-05 remainder**: protected workflows take a PreDestructive snapshot and
   treat Git history failure as a warning ([ADR 0030](decisions/0030-version-bound-workflow-protection.md)).
6. Later, not V1 blockers: pickers start in the current script's folder;
   M6-04, M6-10–13, M6-15, DEV-02, M6-05–09, AUDIT-PARK-T (2) failed-resume
   duplicate Home entry, M7, M8.

Native drills: check `df -i /tmp`, use fresh output paths and absolute
filesystem roots; follow [development](development.md) and the
[native guide](../tests/native/writing-lifecycle/README.md#m6-14-installed-package).
A packaging, spelling or picker change needs the packaged modes: the release
binary does not exercise them.
