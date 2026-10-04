#!/usr/bin/env python3
"""run-workspace-matrix.py — canonical Tier 3 Rust workspace matrix.

Runs `cargo test --workspace --locked` twice: once with every
filesystem-root selector pointed at a tmpfs root, once at a Btrfs root.
This is the tracked version of the untracked `target/m6-*/run-workspace*.py`
orchestrators cited in docs/test-evidence/M6.md (see AUDIT.md T-08): those
scripts live outside git, so the matrix was not reproducible from the repo.

The selector list covers all `*_TEST_ROOT` / proof-root variables read by
the workspace test suites, including `BABEL_OPEN_TEST_ROOT` and
`BABEL_M2_EXIT_TEST_ROOT` (omitted by the M6 runners; without them those
suites fall back to the default temp dir). Child-process barrier/stage
variables (`BABEL_*_CHILD_*`, `BABEL_*_BARRIER`) are drill-scoped and are
NOT set here.

Usage: python3 tools/run-workspace-matrix.py <tmpfs-root> <btrfs-root>
       [--output <dir>] [-- cargo test --workspace --locked]
Writes <output>/workspace-{tmpfs,btrfs}.{json,log}. Exit non-zero when
either pass fails; the first failure stops the run.
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path

SELECTORS = [
    "BABEL_HISTORY_PROOF_ROOT",
    "BABEL_SAVE_TEST_ROOT",
    "BABEL_RECOVERY_TEST_ROOT",
    "BABEL_STARTUP_TEST_ROOT",
    "BABEL_CHOICES_TEST_ROOT",
    "BABEL_SNAPSHOT_TEST_ROOT",
    "BABEL_HISTORY_TEST_ROOT",
    "BABEL_IPC_TEST_ROOT",
    "BABEL_APP_DIR_TEST_ROOT",
    "BABEL_RECENT_TEST_ROOT",
    "BABEL_SPELLCHECK_TEST_ROOT",
    "BABEL_PUBLICATION_TEST_ROOT",
    "BABEL_PDF_TEST_ROOT",
    "BABEL_OPEN_TEST_ROOT",
    "BABEL_M2_EXIT_TEST_ROOT",
]

DEFAULT_COMMAND = ["cargo", "test", "--workspace", "--locked"]


def main() -> int:
    args = [a for a in sys.argv[1:] if a != "--"]
    if len(args) < 2 or args[0].startswith("-"):
        print(__doc__.strip().splitlines()[-2])
        print("Usage: python3 tools/run-workspace-matrix.py <tmpfs-root> <btrfs-root>"
              " [--output <dir>] [-- <command...>]")
        return 2
    roots = {"tmpfs": args[0], "btrfs": args[1]}
    rest = args[2:]
    output = Path("target/workspace-matrix")
    command = list(DEFAULT_COMMAND)
    i = 0
    while i < len(rest):
        if rest[i] == "--output" and i + 1 < len(rest):
            output = Path(rest[i + 1])
            i += 2
        else:
            command = rest[i:]
            break
    output.mkdir(parents=True, exist_ok=True)
    for label, base in roots.items():
        env = {**os.environ, **dict.fromkeys(SELECTORS, base)}
        log_path = output / f"workspace-{label}.log"
        print(f"matrix: {label} root={base} log={log_path}", flush=True)
        start = time.monotonic()
        with log_path.open("w") as log:
            result = subprocess.run(command, env=env, stdout=log,
                                    stderr=subprocess.STDOUT)
        report = {
            "command": command,
            "root": base,
            "selectors": SELECTORS,
            "exitCode": result.returncode,
            "seconds": round(time.monotonic() - start, 3),
        }
        (output / f"workspace-{label}.json").write_text(
            json.dumps(report, indent=2))
        print(f"matrix: {label} exit={result.returncode} "
              f"seconds={report['seconds']}", flush=True)
        if result.returncode != 0:
            return result.returncode
    print("matrix: both filesystems passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
