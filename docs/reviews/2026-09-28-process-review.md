# PROCESS-01 — Independent process and bloat review

Date: 2026-09-28. Base: `de8b86b51f3b2bc3eef2825adfa9a41d9caae328`, clean tree. Branch: `PROCESS-01-independent-process-review`. Owned paths: `AGENTS.md`, this report. The owner assigned this review independently of the milestone queue and prohibited edits to M2-05B's coordinator-owned files. This report is its handoff; it does not change task status or requirements.

## Measurements and method

Counted tracked files at the base commit, including blank/comment lines, using newline counts equivalent to `wc -l`. Excluded generated files, dependencies and prototypes from production/test totals. Counts describe source size, not implemented requirements or code quality.

| Measure                                                                     | Verified count | Interpretation                                    |
| --------------------------------------------------------------------------- | -------------: | ------------------------------------------------- |
| Rust production source paths, excluding `build.rs` and dedicated test files |          4,535 | Includes 302 lines in terminal test modules       |
| Rust dedicated test files/integration tests                                 |          5,041 | Matches critique                                  |
| Frontend `src/` TS/TSX                                                      |          1,732 | CSS is a separate 154 lines                       |
| Frontend `tests/` TS/TSX/MJS                                                |          1,677 | Includes browser smoke and test fixture helper    |
| Production by critique's classification                                     |          6,421 | 4,535 + 1,732 + 154; includes embedded Rust tests |
| Tests by critique's classification                                          |          6,718 | 5,041 + 1,677                                     |
| Production after moving terminal Rust test modules to tests                 |          6,119 | Includes CSS; excludes 3-line build script        |
| Tests after moving terminal Rust test modules                               |          7,020 | Still exceeds production                          |
| All tracked Markdown                                                        |          4,674 | 48 files; 72.8% of critique-classified production |
| `SPEC.md`                                                                   |          1,299 | Matches critique                                  |
| Numbered ADRs                                                               |            852 | 17 decisions, not 18                              |
| ADR directory including README                                              |            866 | 18 Markdown files                                 |
| Milestone evidence                                                          |          1,112 | Three files; not 975                              |
| Visible frontend TSX + CSS                                                  |            836 | 672 `src/app/*.tsx` + 10 `src/main.tsx` + 154 CSS |

The terminal-module adjustment is not a compiler-derived count: test-only hooks elsewhere in source files remain in the source-path total. No conclusion depends on treating this as an exact runtime-code measurement. Prototypes add another 2,256 Rust/TS lines and are intentionally outside these totals.

Reproduction of the critique's classifications and document counts:

```python
from pathlib import Path
import subprocess

base = 'de8b86b51f3b2bc3eef2825adfa9a41d9caae328'
paths = [Path(p) for p in subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', base], text=True).splitlines()]
count = lambda p: subprocess.check_output(['git', 'show', f'{base}:{p}']).count(b'\n')
rust = [p for p in paths if p.suffix == '.rs' and str(p).startswith(('crates/', 'src-tauri/')) and p.name != 'build.rs']
tests = [p for p in rust if '/tests/' in str(p) or p.name.endswith('_tests.rs')]
print('Rust source/test paths:', sum(count(p) for p in rust if p not in tests), sum(map(count, tests)))
for root, suffixes in [('src/', ('.ts', '.tsx')), ('src/', ('.css',)), ('tests/', ('.ts', '.tsx', '.mjs'))]:
    print(root, suffixes, sum(count(p) for p in paths if str(p).startswith(root) and p.suffix in suffixes))
markdown = [p for p in paths if p.suffix == '.md']
print('Markdown:', len(markdown), sum(map(count, markdown)))
for root in ['docs/decisions/', 'docs/test-evidence/']:
    print(root, sum(count(p) for p in markdown if str(p).startswith(root)))
```

These measurements precede this report and the instruction edits. `wc -l src/app/*.tsx src/main.tsx src/styles.css` independently returned 836. Terminal `mod tests` blocks account for 66 lines in core persistence, 12 in core lib, 27 in desktop lib and 197 in persistence host.

## Verdicts

1. **Partly.** The critique's 6,421/6,718 totals reproduce exactly under its path classification. Calling all 1,886 frontend lines TypeScript includes CSS; calling all 4,535 Rust source-path lines production includes test modules. Tests do exceed production after correcting both categories. That is not evidence of excess tests: the source-save, recovery and choice suites enumerate distinct failure boundaries and preservation behavior. No tests should be removed based on their line ratio.

2. **Partly.** SPEC and ADR-directory line counts match, but there are 17 ADRs plus an index, and current Markdown/evidence counts are 4,674/1,112. The ratio alone cannot establish bloat: SPEC includes future product scope while implemented code is still a safety foundation. There is avoidable repeated narration, e.g. M2-05B commands/counts in [current state](../current-state.md) and [M2 evidence](../test-evidence/M2.md). Keep historical evidence; future handoffs can link the canonical command results.

3. **Agree on the count.** [App](../../src/app/App.tsx), [recovery review](../../src/app/RecoveryReview.tsx), [choices](../../src/app/RecoveryChoicePanel.tsx), entrypoint and styles total 836. This measures the visible shell/recovery UI, not the native services or a complete writing application. The mismatch between visible UI size and safety code size follows the explicit headless M2 milestone; it does not justify removing safety behavior.

4. **Partly.** There are six `BABEL_*_TEST_ROOT` selectors (OPEN, RECOVERY, SAVE, IPC, STARTUP, CHOICES), plus `BABEL_PROOF_ROOT` and `BABEL_HISTORY_PROOF_ROOT`: eight filesystem selectors, not seven under a consistent scope. Test-child root variables are process plumbing, not additional user selectors. Consolidation would improve usability, but requires a coordinated test-fixture migration; merely setting a new variable would falsely imply all suites moved filesystems. No selector is renamed here.

   Blanket repetitions of pure state/envelope tests add no filesystem evidence. However, open is not purely read-only: [the adapter](../../crates/screenwriter-core/src/documents/linux.rs) durably publishes identity records and acquires inode/document leases. [Safe-open tests](../../crates/screenwriter-core/tests/safe_open.rs) exercise metadata, replacement, symlinks, permissions and an execed second owner. Retain native filesystem coverage of those operations. Neither the spec nor existing instructions mandate every suite on both filesystems; the evidence records historical runs. The corrected rule routes repetitions by semantics without erasing those runs.

5. **Partly; reject guard removal.** [Source replacement](../../crates/screenwriter-core/src/documents/source_store.rs) explains `flistxattr`: replacement must not silently discard ACLs/extended attributes the adapter cannot preserve. [The source-save test](../../crates/screenwriter-core/tests/source_save.rs) constructs both ACL and user-xattr cases. `fchown` passes no new owner and preserves the existing group; removing it could change ordinary file access. Special-bit refusal avoids applying unsupported permission semantics. Hard-link checks avoid silently breaking aliases when rename replaces just one directory entry. These are filesystem/content safety policies, not assumptions of multiple authors or malicious attackers.

   [DiskFingerprint](../../crates/screenwriter-core/src/documents/mod.rs) has **11 fields**, including hash/length and separate seconds/nanos. Device/inode detect same-byte replacement and support leases; mode/owner/links detect changed eligibility; ctime supplements mtime during capture/revalidation. [External-change tests](../../crates/screenwriter-core/tests/safe_open.rs) cover same-content replacement and permission change. It is structured Unix metadata exposed on IPC, and that is a real future portability cost. Prefer evaluating an opaque native revision token/platform-neutral receipt at the platform-adapter gate, with compatibility and race tests. Do not redesign the wire/recovery contract during this process review. Whether every timestamp field is essential remains unproven; that does not justify removal without equivalent safety evidence.

6. **Agree with the limitation; disagree that it is hidden.** [The input prototype](https://github.com/phagmaier/Babel/blob/fb7d6bd5bf034458afd950d5f9632382b6d5b99b/prototypes/native-editor/main.ts) uses `prosemirror-schema-basic`, ordinary paragraphs and base history/keymaps. It has no Fountain codec or production plugins/save cadence. Its timing cannot certify M3. [ADR 0008](../decisions/0008-native-editor-input.md), [the harness README](https://github.com/phagmaier/Babel/blob/fb7d6bd5bf034458afd950d5f9632382b6d5b99b/prototypes/native-editor/README.md) and [M1 evidence](../test-evidence/M1.md) already call the key-to-frame measure a proxy, identify its scope, and require remeasurement after schema/plugins. Preserve the baseline and its caveats; no convention change is needed.

7. **Partly.** The later ADRs contain considerable implementation detail, but their decisions are not merely adapter trivia. [0012](../decisions/0012-native-document-identity.md) chooses stable identity versus content/path exposure; [0013](../decisions/0013-recovery-checkpoint-journal.md) chooses a durable framing/rotation protocol; [0014](../decisions/0014-serialized-source-replacement.md) defines replacement/uncertainty boundaries; [0015](../decisions/0015-versioned-persistence-ipc.md) chooses versioned receipt authority. Those have lasting alternatives and consequences. Keep all ADRs. Enforce [SPEC S17.3/S19](../../SPEC.md#s17)'s existing meaningful-choice threshold prospectively; routine details go in owning docs/code, and task completion does not automatically require another ADR.

8. **Partly.** Broad read lists and duplicated command tables can consume context. Yet existing instructions already say to use bounded ranges and update the trace **when behavior changes**, not rewrite it every task. SPEC S18 requires task/read/acceptance evidence, not a prescribed per-task table. Keep dependency/contract reads and verifiable results. Clarify that Read lists route to relevant sections, evidence is recorded once then linked, unchanged trace rows need no rewrite, and docs-only checks need no executable test/build suite unless commands/configuration change. Actual wall-clock savings were not measured.

9. **Agree on the gap; partly on the proposed interruption.** [The codec](https://github.com/phagmaier/Babel/blob/fb7d6bd5bf034458afd950d5f9632382b6d5b99b/prototypes/fountain/codec.ts) exports a source-aware line model; the input prototype instead builds generic paragraph nodes directly from fixture text. Neither composes source spans with structured transactions, undo and selection. This is the clearest unvalidated editor assumption, though incomplete persistence/close safety remains a separate serious risk. [SPEC S16](../../SPEC.md#s16) calls for source/model/ProseMirror integration in M1; the historical M1 proofs did not fully answer it. Their limits are honest, but the completed bounded M1 label should not be read as composition evidence.

   A disposable synthetic proof is worth doing before new 05C/05D/06 implementation. Finish M2-05B's review first and have its coordinator register separate ownership/dependencies; this review cannot alter those shared files. Treat it as closing the missing M1 investigation under SPEC S19.2, with production M3 still gated by the full M2 exit. It should use real native UI/IPC and the existing safe writer rather than a browser-only mock or temporary unsafe save path. Nothing here claims that spike was implemented or verified.

## Bounded changes and retained rules

Implemented only `AGENTS.md` operating-rule changes:

- Route reads to relevant sections and distinguish docs-only checks from code/shared/milestone gates.
- Route filesystem repetitions to operations whose semantics depend on the filesystem, explicitly including identity publication and leases.
- Record command/host/result/evidence once; link it from summaries; allow compact lists.
- Change only affected trace rows; use an ADR only for meaningful lasting choices.
- Permit a task-local handoff when the owner prohibits editing another coordinator's shared files. Shorten redundant prose to keep instructions within the approximate 8 KiB budget.

Kept both anti-false-claim sentences intact, all SPEC invariants, acceptance evidence, failure tests, native-versus-mocked labels, safety/milestone gates, historical ADRs/evidence, metadata guards and IPC shapes. No selector migration, code change, dependency update or milestone reorder is implemented. No coordinator-owned file is edited, and no commit/push is authorized by this review.

## Proposed spike, not executed

One isolated branch with explicit ownership of a new prototype page/config, proof-only host wiring and its evidence; no production route, shared task/status file or existing M2-05B edit without coordinator assignment. Timebox the first investigation to one working day, then record pass, counterexample or blocker without widening scope. Stop after one reference-host proof; no smart keys, completion, PDF, history UX, retention or production editor rollout.

Use only an explicitly created synthetic disposable directory. Exercise supported action/heading/dialogue plus BOM/CRLF, raw untouched regions and Unicode. Open through a fixed proof-only native selection boundary; deserialize with the codec into typed editor nodes; type and replace a selection; undo/redo and compare source plus caret anchors; save an immutable capture through the actual native writer; reopen and check independent expected bytes/semantics. Include a no-op identity assertion and a refused external-change save retaining both drafts. Bound the subset and report rejected unsupported edits explicitly.

A successful plain-paragraph text save would not answer the composition question. The proof needs agreement among editor transactions, preserved source ranges, selection mapping and serialization. No second mutable manuscript buffer or frontend filesystem/shell endpoint. Native picker/host initialization and codec context-spanning edits are real work/blocker candidates; do not hide them behind mock results. A failed proof is useful evidence and must not lead to a new unsafe persistence engine.

## Validation and handoff

This is a documentation/process review. Existing test bodies were inspected; the application suites were not rerun and their historical results are not new verification. Host: `uname -srmo` returned Linux 7.2.5-3-omarchy x86_64 GNU/Linux. Checks:

- `git switch -c PROCESS-01-independent-process-review`: initially blocked because sandbox `.git` is read-only; the same command passed with owner-approved escalation. No commit/push.
- `wc -l src/app/*.tsx src/main.tsx src/styles.css`: passed, 836 total. Baseline counts reproduced with the Python snippet above.
- `pnpm exec prettier --write AGENTS.md docs/reviews/2026-09-28-process-review.md`, then `pnpm exec prettier --check AGENTS.md docs/reviews/2026-09-28-process-review.md`: passed for the matched review report. `AGENTS.md` is excluded by the existing `.prettierignore`; its whitespace/newline and instruction preservation were checked separately. No formatter configuration change.
- `python3 /tmp/babel-process-review-audit.py`: passed, 22 local links/anchors resolved; all 152 other baseline files byte-identical; every original invariant bullet and both anti-false-claim sentences preserved; changed files have no trailing whitespace and end in a newline; `AGENTS.md` is 7,964 bytes, below 8 KiB. The audit also executed the reproduction snippet and confirmed the baseline totals. Audit script is local supporting evidence; count method and results are retained here.
- `git diff --check`: passed. Rust/frontend/native/browser suites: not run, because no code, executable command definitions or configuration changed. No application verification is claimed.

Next safe action: finish the M2-05B owner/coordinator review, then register the bounded composition proof before selecting 05C. A common filesystem-root selector can be considered separately when its fixture paths are owned and checked; current documented variables remain valid. This process branch remains uncommitted for review.
