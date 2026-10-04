#!/usr/bin/env python3
"""Check S-08 removal and the frozen retained source/fixture boundary."""

import json
import re
import subprocess
from pathlib import Path

BASE = "186ea59"
REMOVED = ["replaceInline", "replaceHiddenContent", "proposeSourceConversion",
           "acceptSourceConversion", "ConversionProposal", "stale-conversion"]


def main():
    failures = []
    for directory in ["src", "tests"]:
        for path in Path(directory).rglob("*.ts"):
            for token in REMOVED:
                if token in path.read_text():
                    failures.append(f"removed surface {token}: {path}")
    codec = Path("src/domain/fountainCodec.ts").read_text()
    for token in ["const proposals", "conversion =", "mixedHidden"]:
        if token in codec:
            failures.append(f"removed bypass {token}")
    names = subprocess.check_output(
        ["git", "ls-tree", "-r", "--name-only", BASE], text=True).splitlines()
    retained = [name for name in names if name.startswith((
        "fixtures/", "crates/", "src-tauri/")) or name in [
            "AUDIT.md", "src/editor/sourceBridge.ts", "src/editor/commands.ts",
            "src/domain/fountainInline.ts", "package.json", "pnpm-lock.yaml",
            "Cargo.lock", "prototypes/fountain-conformance/renderer.py"]]
    for name in retained:
        old = subprocess.check_output(["git", "show", f"{BASE}:{name}"])
        if not Path(name).is_file() or Path(name).read_bytes() != old:
            failures.append(f"retained bytes changed: {name}")
    old_codec = subprocess.check_output(
        ["git", "show", f"{BASE}:src/domain/fountainCodec.ts"], text=True)
    for name in ["existingSource", "setDualDialogue", "replaceLineWithBreaks"]:
        pattern = rf"(?:export )?function {name}\([\s\S]*?\n\}}"
        before = re.search(pattern, old_codec)
        after = re.search(pattern, codec)
        if not before or not after or before[0] != after[0]:
            failures.append(f"retained operation changed: {name}")
    print(json.dumps({"base": BASE, "retained_files": len(retained),
                      "failures": failures}, indent=2))
    return bool(failures)


if __name__ == "__main__":
    raise SystemExit(main())
