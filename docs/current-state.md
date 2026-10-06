# Current state — 2026-10-06

Application: **babel**, local-first Linux screenwriting (Tauri/React/Rust).
Agents decide under [ADR 0043](decisions/0043-agent-decision-authority.md).
Branch: `main`. Installed package update now passes on tmpfs and Btrfs.
Local v1 admission remains open.

## This session

**M6-14 manual update** ([brief](tasks/M6-14.md),
[update evidence](test-evidence/M6-14-update-2026-10-06.md)). No production
code or package change. Added `tools/run-package-update.py` and two opt-in
native modes; reused the desktop-entry launch observer. Fixed native result
parsing to retain complete artifact paths containing spaces.

- Actual previous `6eabb82a…` and next `fc187bea…` AppImages installed into
  one disposable profile per filesystem, with spaces/non-ASCII in paths.
  Both desktop entries start by name through GIO, self-mount with FUSE,
  start the package recorded as current, close ordinarily and release mounts.
- Previous package creates source, named/safety snapshots, safety history,
  recovery and preferences through normal UI. The next package reads them
  back, restores the old snapshot with Save/Undo/Redo, resumes the old
  unsaved checkpoint and reopens the final source writable. Literal BOM,
  CRLF, whitespace, unknown title key, note and omission stay exact.
- Previous package cannot Add a word because its provider is absent. A
  labelled dictionary fixture is seeded, then read and durably republished
  by its own preferences UI. New package reads that same generation and
  honors the word while detecting a deliberate misspelling.
- Writing phases use the installed files through the loopback-only FUSE
  runner with development tools/sources/caches/interpreters hidden. Four
  native phases and four desktop launches have clean process/crash audits.
- Update changes no source/native app-data/config bytes and keeps the old
  package. Future project metadata opens view-only with Save disabled and
  exact separate Save As; original metadata/source remain unchanged.
  Future install records refuse install/status/uninstall without mutation.
  Uninstall removes only its packages/entry and preserves app data.
- Fresh artifact roots retain pre-update backups, hashes, native/desktop
  logs, screenshots, per-phase raw observations and five setup failures.

Previous [install evidence](test-evidence/M6-14-2026-10-06.md) and
[ADR 0045](decisions/0045-user-install-and-packaged-spelling.md) cover the
packaged-provider and read-only-picker fixes, no-dictionary simulation and
writing/PDF/restore pilot. Verified package remains at
`target/release/bundle/appimage/babel_0.0.1_amd64.AppImage`:
SHA-256 `fc187bea26ff1928faae3c8ad7c2c0fa06cb87aff7fb833ec78cb3dfa99f999b`.

## Checks

| Command                                       | Result                                                    |
| --------------------------------------------- | --------------------------------------------------------- |
| `run-package-update.py` on Btrfs (`btrfs-06`) | Pass: two desktops, two writing phases, strict audits     |
| Same on tmpfs (`tmpfs-01`)                    | Pass: two desktops, two writing phases, strict audits     |
| `installed_launch.py` regression              | Pass: ordinary close, uninstall and owner entry unchanged |
| Python tooling unit/syntax                    | 10 tests pass; 104 files compile                          |
| Touched docs format; links/guidance; diff     | Pass; 2006 links resolve; guidance has no problems        |
| CI on base `332116d`, run 37473317474         | Both jobs succeeded; checked this session                 |

No local package rebuild, frontend/Rust/differential/full workspace matrix:
only Python harnesses/docs changed; candidate package bytes are unchanged.

## Known limitations

- M6-14 bundled-library licence notices remain open, with M6-10.
- This is agent-driven UI automation with synthetic app-generated data.
  Both packages use schema 1; no new format migration. Future-schema cases
  cover project metadata and installer records. Word creation is a labelled
  fixture plus old-native republish, not an old-package Add pass.
- One host/distribution and `en_US`; dictionary absence was simulated.
  Desktop-entry launch is not network-isolated; writing phases are.
  The owner's launcher remains untouched. No file association; native
  pickers start in home rather than the current script's folder.
- Backups use another filesystem on the same laptop, not an independent
  disk. Real-software migration and second-host bootstrap remain deferred.
- Full S13/long session, wider IME/keyboard/a11y, enforcing SELinux and the
  retained Replace-All load flake remain outside these checks.
- Historical [native findings](native-findings.md) retain their strict
  failures and ADR 0043 disposition. No new crash event in the passing runs.
  M6-02 Save As/IME readiness lag, shared-store lease limit and capture
  refusals naming no row remain known limitations.

## Next action

1. **M6-14 notices**, with M6-10: exact licence texts and provenance for the
   bundled libraries. [Brief](tasks/M6-14.md#done-and-remaining).
2. **M6-03 remainder**: native interruption/low-space retention drill.
   [Brief](tasks/M6-03.md).
3. **M6-16 admission review**, after M6-14/M6-03: refresh requirement
   evidence against the final package and resolve release gaps.
   [Brief](tasks/M6-16.md).
4. **Capture**: recovery copy for refusals naming no row.
5. **D-05 remainder**: protected workflows take a PreDestructive snapshot and
   treat Git history failure as a warning ([ADR 0030](decisions/0030-version-bound-workflow-protection.md)).
6. Later, not V1 blockers: current-script picker folder; M6-04, M6-10–13
   beyond release notices, M6-15, DEV-02, M6-05–09, AUDIT-PARK-T (2), M7, M8.

Native drills: check `df -i /tmp`, use fresh outputs and absolute roots;
follow [development](development.md) and the
[native guide](../tests/native/writing-lifecycle/README.md#m6-14-installed-package).
A packaging, spelling or picker change needs the packaged modes.
