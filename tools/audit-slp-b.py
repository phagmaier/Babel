#!/usr/bin/env python3
"""Check the frozen SLP-B deletion/retention boundary, not runtime behavior."""

import json
import re
import subprocess
import os
import shutil
import sys
import time
from pathlib import Path

BASE = "d463656"
REMOVED = [
    "prototypes/fountain/codec.ts",
    "prototypes/fountain-conformance/compare.ts",
    "prototypes/editor-composition/main.ts",
    "prototypes/editor-composition/model.ts",
    "prototypes/editor-composition/index.html",
    "prototypes/editor-composition/style.css",
    "prototypes/editor-composition/native-input.py",
    "prototypes/editor-composition/native-matrix.py",
    "prototypes/editor-composition/audit.py",
    "prototypes/pdf/render.py",
    "prototypes/pdf/inspect_pdf.py",
    "prototypes/pdf/fallback.mjs",
    "src-tauri/tauri.editor-composition-proof.conf.json",
    "src-tauri/tauri.native-proof.conf.json",
    "src-tauri/tauri.snapshot-proof.conf.json",
    "tests/contract/fountain.test.ts",
    "tests/contract/fountain-conformance.test.ts",
    "tests/contract/editor-composition.test.ts",
]
PACKAGES = ["pdf-lib", "prosemirror-commands", "prosemirror-keymap",
            "prosemirror-schema-basic"]


def main():
    failures = []
    for name in REMOVED:
        if Path(name).exists():
            failures.append(f"still present: {name}")
    for name in ["prototypes/native-editor", "prototypes/snapshot-review",
                 "prototypes/durable-replacement"]:
        if any(path.suffix in {".ts", ".tsx", ".rs", ".py", ".html"}
               for path in Path(name).rglob("*")):
            failures.append(f"still present: {name}")
    manifest = json.loads(Path("package.json").read_text())
    for package in PACKAGES:
        if package in manifest["devDependencies"]:
            failures.append(f"proof-only package: {package}")
    for name, tokens in {
        "src-tauri/Cargo.toml": ["native-editor-proof"],
        "src-tauri/src/lib.rs": ["native-editor-proof", "record_native_editor_proof",
                                 "select_snapshot_proof_destination"],
        "src-tauri/src/editor_composition_proof.rs": ["select_snapshot_proof_destination"],
        "prototypes/fountain-conformance/corpus.ts": ["../fountain/codec", "proofAtoms(", "sharedAtoms("],
        "Cargo.toml": ["prototypes/durable-replacement"],
        "Cargo.lock": ['name = "durable-replacement-proof"'],
    }.items():
        content = Path(name).read_text()
        for token in tokens:
            if token in content:
                failures.append(f"removed surface {token}: {name}")
    if '"prototypes/history-store"' not in Path("Cargo.toml").read_text():
        failures.append("history-store workspace membership missing")
    if "editor-composition-proof = []" not in Path("src-tauri/Cargo.toml").read_text():
        failures.append("retained native feature missing")
    # Every tracked fixture/oracle plus the retained proof and renderer inputs
    # must remain byte-identical. No implementation-generated expectations.
    names = subprocess.check_output(["git", "ls-tree", "-r", "--name-only", BASE], text=True).splitlines()
    retained = [name for name in names if name.startswith((
        "fixtures/expected/", "prototypes/history-store/")) or name.endswith(".fountain")
        or name in ["AUDIT.md", "prototypes/editor-composition/seed.py",
                    "prototypes/editor-composition/.gitignore",
                    "prototypes/pdf/requirements.txt", "prototypes/pdf/COVERAGE.md",
                    "prototypes/fountain-conformance/renderer.py"]]
    for name in retained:
        expected = subprocess.check_output(["git", "show", f"{BASE}:{name}"])
        if not Path(name).is_file() or Path(name).read_bytes() != expected:
            failures.append(f"retained bytes changed: {name}")
    # Match the handler array terminator, not a nested cfg attribute's ].
    def handlers(text):
        return [re.findall(r"^[ \t]*([a-z_][a-z_0-9]*),?[ \t]*$", body, re.M)
                for body in re.findall(r"generate_handler!\[(.*?)\n    \]\);", text, re.S)]
    old = handlers(subprocess.check_output(
        ["git", "show", f"{BASE}:src-tauri/src/lib.rs"], text=True))
    current = handlers(Path("src-tauri/src/lib.rs").read_text())
    removed = {"select_snapshot_proof_destination", "record_native_editor_proof"}
    if (len(old) != 3 or len(current) != 2 or old[1] != current[0]
            or [name for name in old[2] if name not in removed] != current[1]):
        failures.append("default/retained-feature command parity changed")
    print(json.dumps({"base": BASE, "retained_files": len(retained),
                      "handler_commands": [len(names) for names in current],
                      "failures": failures}, indent=2))
    return bool(failures)


def candidate_mutations(output):
    """Real IO control and two bypass faults, in a copied core with fresh roots.

    Usage: audit-slp-b.py --candidate-mutations <new-output-directory>
    Production files never change. Compiler/import failures do not kill mutants.
    """
    repo = Path(__file__).resolve().parent.parent
    output = Path(output).resolve()
    output.mkdir(parents=True, exist_ok=False)
    copied = output / "isolated"
    (copied / "crates").mkdir(parents=True)
    shutil.copytree(repo / "crates/screenwriter-core", copied / "crates/screenwriter-core")
    shutil.copyfile(repo / "Cargo.lock", copied / "Cargo.lock")
    (copied / "Cargo.toml").write_text(
        '[workspace]\nmembers = ["crates/screenwriter-core"]\nresolver = "2"\n'
        '[workspace.package]\nedition = "2024"\nrust-version = "1.97.1"\n')
    source = copied / "crates/screenwriter-core/src/documents/source_store.rs"
    original = source.read_text()
    production = (repo / "crates/screenwriter-core/src/documents/source_store.rs").read_bytes()
    before_sync = "if read_optional(dir, name, MAX_FRAME_BYTES)?.as_deref() != Some(bytes) {"
    before_replace = "if candidate_bytes != request.source"
    cases = [("control", None),
             ("candidate-write-verification", (before_sync, "if false {")),
             ("candidate-replace-verification", (before_replace, "if false"))]
    results = []
    env = {**os.environ, "CARGO_TARGET_DIR": str(repo / "target"),
           "RUSTUP_TOOLCHAIN": "1.97.1"}
    for label, mutation in cases:
        text = original
        if mutation:
            old, replacement = mutation
            if text.count(old) != 1:
                raise ValueError(f"{label}: expected exactly one mutation site")
            text = text.replace(old, replacement)
        source.write_text(text)
        root = output / label
        root.mkdir()
        env["BABEL_SAVE_TEST_ROOT"] = str(root)
        command = ["cargo", "test", "-p", "screenwriter-core", "--lib",
                   "candidate_tamper_and_silent_truncation", "--offline"]
        if mutation:
            command.append("--locked")
        start = time.monotonic()
        log = root / "run.log"
        with log.open("w") as stream:
            run = subprocess.run(command, cwd=copied, env=env,
                                 stdout=stream, stderr=subprocess.STDOUT)
        transcript = log.read_text()
        passed = run.returncode == 0 if not mutation else (
            run.returncode == 101 and "panicked at" in transcript
            and "test result: FAILED. 0 passed; 1 failed;" in transcript
            and "could not compile" not in transcript)
        results.append({"case": label, "command": command, "exitCode": run.returncode,
                        "seconds": round(time.monotonic() - start, 3), "passed": passed})
        (output / "results.json").write_text(json.dumps(results, indent=2) + "\n")
        print(f"{label}: {'pass' if passed else 'FAIL'}", flush=True)
        if not passed:
            return 1
    assert (repo / "crates/screenwriter-core/src/documents/source_store.rs").read_bytes() == production
    print("candidate mutation proof: 2/2 detected; production bytes untouched")
    return 0


if __name__ == "__main__":
    if len(sys.argv) == 1:
        raise SystemExit(main())
    if len(sys.argv) == 3 and sys.argv[1] == "--candidate-mutations":
        raise SystemExit(candidate_mutations(sys.argv[2]))
    raise SystemExit("Usage: audit-slp-b.py [--candidate-mutations <new-output-directory>]")
