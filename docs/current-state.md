# Current state — M4-11 complete

Date: 2026-09-30 PDT. Application: **babel**. Authority: [SPEC](../SPEC.md), [TODO](../TODO.md).

## Task and work

**M4-11 complete — bounded isolated Linux offline spellcheck proof.** One editing agent on main from clean `e76cacc`; declared M4-00/M3 native input dependencies satisfied. No push authorized.

[ADR 0032](decisions/0032-linux-native-spellcheck.md) selects the existing WebKitGTK 4.1 / Enchant / Hunspell path. The [synthetic probe](../tests/native/spellcheck/README.md) mounts the existing sole editor in a native GTK host, uses compiled local assets with a fixed URI scheme, private Enchant/XDG profiles and network namespaces with only loopback. Physical native suggestions/correction/Undo, source/marks/origin metadata, effective language/missing-dictionary behavior, Ignore/Learn/restart, ASCII/Unicode/uppercase names, view-only established-name suppression and trusted pinyin commit/cancel/Undo passed. A fresh profile does not inherit learned names.

Changed paths: isolated `tests/native/spellcheck/` C host/TypeScript entry/Python runner/README; four `spellcheck-probe` JSDOM contracts; optional right button in existing test-only pointer helper; ADR/UX/development/task/TODO/affected UX-02 trace/evidence. No production source, native capability/command, runtime dependency/resource, author-content store or fixture changed. No fallback engine or cloud service added; production activation remains M4-12.

## Verification

[M4-11 evidence](test-evidence/M4.md#m4-11--offline-spellcheck-proof) owns exact commands, host/dependency/resource/license inventory, failures/corrections and artifacts. **4 focused JSDOM tests**, **647 frontend tests / 49 files**, shared formatting/lint/typecheck/build, browser smoke, Rust fmt/clippy and **226 host Rust tests** passed. First shared recovery-button wait timed out; unchanged focused recheck and idle full rerun passed, with the failure retained. No dictionary publication adapter added; no repeated Btrfs matrix required for this proof.

Final real native isolated proof passed in three private network namespace hosts; all **nine** observed requests were local compiled resources. Artifacts `/tmp/babel-m4-11-76l3bves`, independent **130-byte** source oracle and hashes, exact dictionary/capture/selection audits; three screenshots visually inspected. Default embedded release build and latest real WebKit/GTK **2× presentation/IME/Undo/protection/restart** regression also passed, artifacts `/tmp/babel-writing-rphzbitk`. Isolated dictionary proof and default production regression are distinct evidence; no shipped spellcheck claim.

Older default-app `--find` drill failed at Whole word checkbox `element not interactable`, with Find controls below the current viewport; failure/screenshot retained. No product/old-drill change or passed Find regression claim here. Native control reachability and integrated drill review remain M4-14/15 concerns.

## Remaining concerns and next action

**Next: [M4-12 production spellcheck](tasks/M4-12.md), dependency-ready.** English `en_US`/`en_US-large` verified using the same host base dictionary; French is unavailable and other languages/platforms untested. Native language choice is process/application-wide; Ignore requires word selection and lasts for the dictionary/session, Learn persists locally. Continuous-check Off alone retains native menu suggestions. Production must provide scoped preferences/resource reporting, version-bound name suppression and guarded corrections, explicit dictionary write-failure handling (native Learn has no durability receipt), keyboard-accessible actions and default-release resources. Installed/offline packages and complete third-party distribution notices remain open.

M4-12–15 remain open; M4-15 requires all implementation tasks and a separate safety review. No full M4/Local v1 claim or milestone tag. Prior stress layout/Undo/long-session performance limits remain open; this tiny proof certifies no S13 budget. Broader accessibility, other platforms/scales/filesystems, C1 WebKit/dependency hardening, disk-full/hardware power loss, backup/migration and owner adoption remain carried concerns. M5 owns SC005/SC008/PDF; M6 history/hardening; M7 explicit remote transfer. Nothing pushed/published.
