# Current state — M4-15 native prerequisite restored; runtime exit open

Date: 2026-10-01 PDT. Application: **babel**. Main, continuation from clean
`e8c2304`; one editing agent, no push or M4 verified tag.

## Task and work

**M4-15** remains open. Restored the missing Fcitx/Mozc prerequisite through
nine signed test-only packages in a disposable prefix, read-only system overlay
and private profile. No privileged installation/global input settings changed.
The wrapper refuses existing input-service ownership and stops only its namespace.

**M4-15-R1:** pinned Wry disabled client preedit. Linux startup now enables the
existing WebKit input context through Tauri's main-thread callback, using the
already locked binding version. The five native input modes require genuine
trusted start/end events; editor-exit checks each pinyin/Mozc case independently.
Exact source/form/query/cancellation/Undo oracles remain. Native input correction
is verified; integrated runtime acceptance remains open.

Harness corrections wait for exact recovery UUID/generation, native title input,
Save/thaw and Focus adoption, and observed cold Mozc selection. Separate GTK
Unicode modes use the actual built-in context ID. Outline visibility allows one
CSS pixel for integer-scroll rounding while preserving exact row/offset/timing.
Failed attempts remain retained. Active sessions and forced deletions are logged;
crash detection is unchanged.

M4-08-R1 replacement-emphasis correction remains complete; M4-01–14 bounded
Linux dependencies are accepted. Stop at M4; no M5 implementation.

## Paths and checks

- Product: `src-tauri/{Cargo.toml,src/lib.rs}`, `Cargo.lock`; [M4-15-R1](tasks/M4-15-R1.md), [ADR 0034](decisions/0034-linux-client-preedit.md), native input contract.
- Native harness: `tests/native/writing-lifecycle/{isolated_ime,drill,editor_exit,outline_workflows,title_page,find_workflows,presentation_workflows,home_workflows}.py` and guide.
- [Continuation evidence](test-evidence/M4.md#continuation-from-e8c2304--isolated-ime-and-m4-15-r1) owns exact commands/versions/hashes/manifests/failed attempts; [separate same-agent review](reviews/2026-10-01-m4-15-review.md) owns findings/limits. No second-reviewer/human sign-off claim.
- Focused **90 tests/5 files**; shared **694/56**, formatting/lint/typecheck/build, browser smoke; Rust fmt/clippy and **237 tests each on tmpfs/Btrfs** passed. Full default embedded release/AppImage built; no installed/offline certification.
- Fresh full 19-mode matrix: **32/38 successful** on the current binary. Four harness failures corrected; both presentation cases completed functional assertions but emitted heap aborts. Corrective reruns pass **5/5 tmpfs + 2/2 Btrfs**; latest same-binary case inventory is **38/38**, not a clean full run or crash resolution. Independent retained audit passed; exact counts in evidence. Original failures remain gate evidence.

## Blocker and next action

Intermittent presentation-restart `corrupted double-linked list` observations
keep M4-15/full M4 open. Btrfs phase log places one after forced WebDriver session
deletion; owned core shows allocator abort through Gallium/GBM/WebKit and `exit`.
This supports a teardown association, not the corruption origin or ordinary
application-quit safety. Earlier unphased observation also remains unresolved;
clean reruns do not establish a fix or close retained C1.

Next **M4-15** action: isolate ordinary app quit from forced WebDriver deletion
with disposable profiles, exact source/checkpoint audits and phase logs; dispose
of the runtime finding before accepting/tagging the gate. No crash-line filtering,
dependency-stack upgrade or M6 implementation was included here.

SC005/SC008 assessment stays unavailable until M5. Screenreader/other platforms,
installed/offline packaging, full S13/long-session, dependency hardening,
migration/backups and Local v1 adoption remain open. Nothing pushed.
