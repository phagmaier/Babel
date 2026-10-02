# Current state — M5-04 complete

Date: 2026-10-02. Application: **babel**. Base `88fbfb7` on clean main at
admission. Owner requested continuation of M5-04.

## Task and work

**M5-04 production SC005/SC008 assessment — complete, bounded Linux gate.**
Script Check maps primary-codec omissions, raw/unverified regions and renderer
paragraph incompatibilities to blocking export limitations. Four-face coverage
is generated from verified pinned font tables during helper builds and reviewed
against Fontconfig/FreeType; accents pass, missing CJK/emoji and declared
RTL/complex shaping limitations are explicit. Unicode/source bytes stay intact.

A narrow read-only native command verifies actual profile/font/helper/upstream
identities and probes codec-selected dual/cue/parenthetical/numbered-heading
constructs in memory through the frozen pipeline. No caller-selected paths,
disk output, network or page-count guess. Results carry provenance, captured
version/hash and exact source targets. Missing/mismatched resources fail closed;
stale/superseded/disposed replies cannot publish current results. Blocking
limitations reserve display slots before structural warnings, remain visible through
filters and cannot be dismissed. Save,
selection and Undo remain independent. Async Refresh retains keyboard focus
and refuses repeat activation; native Escape regression is corrected.

Paths: `src/domain/exportAssessment.ts`, `publicationCoverage.json`, Script Check
domain/application/panel and native adapter/writing wiring;
`src-tauri/src/publication_assessment.rs`, embedded `assessment_probe.py`, command
registration; helper coverage generation/build guard; contract/UI/native tests
and owning docs. [Brief](tasks/M5-04.md),
[contract](screenplay-validation.md#m5-04-publication-assessment),
[evidence](test-evidence/M5.md#m5-04--production-sc005sc008-assessment).
Logs/timings/matrix script: `target/m5-04/`; retained GUI roots in evidence.

## Checks and limits

Final `pnpm check` passes: 727 frontend/JSDOM tests, formatting/lint/typecheck/build.
Rust fmt/clippy and all 247 workspace tests pass on tmpfs and Btrfs; focused
publication tests cover real in-memory layout and missing/corrupt resources.
Browser smoke passes. Independent Fontconfig inventory, offline helper build
and exact runtime verifier pass; frozen helper identity, profile and goldens
remain unchanged. Default embedded release passes real WebKit Script Check,
GTK picker, filtering/dismissal, cue/title navigation, Refresh/Escape and exact
Save/protected-close checks on both filesystems, with no PDF publication.

Initial harness/fixture mistakes and the real async native focus regression
are recorded with passing corrections in evidence. No new AppImage/installed,
full M4 IME/performance, milestone/adoption or other-platform claim. Assessment
is bounded to 1,000 findings/probes and a 70-second native deadline; unavailable
or truncated results cannot earn export success. Existing M4 shutdown, platform,
performance and M6 hardening/license/adoption limits remain open. DEV-01 laptop
setup remains ready; `/tmp` native helpers must be rebuilt after reboot.

## Next action

**M5-05 authoritative preview and page-count freshness** is dependency-ready.
Read its brief and choose the viewer boundary/ADR before implementation.
Stop after M5-04; M5-06 export decisions and M5-07 integration remain open.
No push is authorized.
