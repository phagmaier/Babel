# Current state — M3-08 real IME passed, M3-12 unblocked

Date: 2026-09-29 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md), [M3-08 evidence](test-evidence/M3.md#m3-08--paste-formatting-and-native-input).

## Task and work

**M3-08** was completed on main from clean `6eb6125`, one editing agent, no prior dirty paths. The missing-prerequisite blocker is resolved: the owner installed host IME engines (fcitx5-chinese-addons, mozc, anthy) and the session group `Default` now holds keyboard-us/pinyin/mozc with keyboard-us default. The native driver switches explicitly and restores keyboard-us; no app dependency, manifest, lockfile or capability changed.

Real pinyin `nihao` + Space commits `你好`, pinyin `nihao` + physical Escape cancels byte-identical, mozc `ai` + physical Enter commits `あい` — each with trusted composition events, exact source bytes/hash and Ctrl+Z undo. GTK dead-key Escape still commits a spacing acute (retained observation, superseded by the real-IME cancel case). Driver exits 0. TODO is checked with bounded evidence.

## Paths and checks

- `tests/native/editor-input/native-input.py` (shared `await_report`, three real-IME cases, exit 0); docs: M3 evidence, M3-08 brief, TODO, requirements, index, development, current-state.
- [Evidence](test-evidence/M3.md#m3-08--paste-formatting-and-native-input) owns exact commands/host/logs. Focused 306, `pnpm check` (446 tests, 29 files), browser smoke, Rust fmt/clippy, workspace 188 (Btrfs `BABEL_SAVE_TEST_ROOT`), core editor_import tmpfs/Btrfs, feature-proof 32, selection-only, verify-protection (safety ref, live draft hash, sources unchanged), Chromium zero-request, release build passed.
- Session IM verified back on keyboard-us; owned diagnostic stopped. Fixture bytes, default route, manifests/locks, capabilities unchanged. `git diff --check` clean.

## Blockers and next action

M3-08's dependency is satisfied, so **M3-12 is unblocked and ready**: deps M3-08 (accepted), M3-10, M3-11, M2-05D. Read [brief](tasks/M3-12.md), TODO dependency/read/acceptance and lifecycle contracts.

Full S13 paint/page-equivalent, candidate-window navigation beyond first-candidate commit, other platforms, screenreader/touch, installed/offline, remote transfer and M3-13 integrated safety remain later gates. Default desktop cannot create/open/edit/save a screenplay through UI yet. No Local v1 completion is claimed.

Stop this bounded task with honest open gates. Continue on main with task IDs in commits; never push without human review and explicit authorization.
