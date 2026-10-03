# AUDIT-W0-R1 — Enchant ABI prerequisite on CI

Status: **in progress**. Base `e284a33`, main. Owner continuation authorizes
the failed-CI follow-up before AUDIT-C356; no other audit cluster in this task.
Requirements: QA-01; preserve [ADR 0033](../decisions/0033-production-spellcheck-boundary.md).
Dependency: [AUDIT-W0](AUDIT-W0.md); original workflow changes are present.

## Problem and deliverable

[D08A's pushed run](https://github.com/phagmaier/Babel/actions/runs/37124370824)
passes frontend/core but fails to link the desktop test binary: Ubuntu 24.04
installs Enchant 2.3.3, which lacks `enchant_broker_request_dict_with_pwl`.
[Upstream NEWS](https://github.com/rrthomas/enchant/blob/v2.8.21/NEWS) dates the
API to 2.4.0. Never fall back to ordinary personal dictionaries or mutate the
process environment in the application.

1. Make the Linux build require Enchant >=2.4 via pinned existing `pkg-config`
   0.3.34 (MIT/Apache-2.0 build dependency), with an actionable early error.
2. Build SHA-256-pinned upstream Enchant 2.8.21 in a fresh CI temporary prefix,
   using its release tarball's generated C; enable only the verified Hunspell
   provider. Require `libhunspell-dev` to build it and `hunspell-en-us` for the
   actual existing English backend tests. No host-global install or new app engine.
3. Use that prefix for CI link/runtime lookup. Probe the exact ABI and English
   resources before the workspace suite, with a disposable contaminated personal
   dictionary; the explicit `/dev/null` request must ignore it and leave it intact.
4. Clarify build prerequisites in the existing ADR/development docs; retain the
   failed run/log and read the corrected workflow's actual result after push.
5. Repair the named spellcheck drill's missing final protected document close:
   its content checks pass, but ordinary-exit verification requires Home. Preserve
   exact source bytes and the dictionary fault, and keep all exit assertions.

## Checks and stopping

Build/packaging cross-boundary failure: Tier 3. Run the actual source builder/probe,
old-version build refusal, actual focused Rust spellcheck tests, `pnpm check`,
Rust fmt/clippy, tmpfs/Btrfs workspace matrix, default `pnpm tauri build`, browser
smoke, shell syntax, changed-doc formatting/links and `git diff --check`.
The named native drill is the existing `--spellcheck` mode on both filesystems;
run with synthetic profiles and the existing isolated network namespace. Preserve
all failures. No integrated 19-mode rerun; no C1/F2 closure or installed-distribution
support claim. Stop at W0-R1; AUDIT-C356 remains next and unstarted.
