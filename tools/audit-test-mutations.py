#!/usr/bin/env python3
"""Prove AUDIT-TEST regressions detect faults using an in-memory Vite transform.

Usage: python3 tools/audit-test-mutations.py <new-output-directory>
Run with pnpm dependencies installed. An unmodified focused control must pass
before any mutant runs. Production files are never written. Each independent mutant gets a fresh Vitest process, JSON report,
raw log and a transform-loaded marker; a nonzero test assertion failure is the
expected result. Import/compile failures and surviving mutants fail this runner.
"""

import json
import re
import subprocess
import sys
import time
from pathlib import Path

SESSION = "src/application/writingSession.ts"
CONTROLLER = "src/application/persistenceController.ts"
SESSION_TEST = "tests/contract/writing-session.test.ts"
CONTROLLER_TEST = "tests/contract/persistence-controller.test.ts"
VIEW_TEST = "tests/ui/WritingView.test.tsx"


def without_throw(message):
    return (r"throw new Error\(\s*" + re.escape("'" + message + "'")
            + r",?\s*\);", "void 0;")


def cases():
    # Exact named guards from T-04 (including the prepared-adoption predecessor).
    guards = [
        ("save-as", "Save As registration does not match published bytes", "refuses mismatched Save As"),
        ("export-copy", "Export copy receipt does not match latest version", "refuses mismatched export-copy"),
        ("prepared-adoption", "Prepared replacement does not match the receipt", "refuses a mismatched prepared adoption"),
        ("applied-adoption", "Adopted bytes did not land as the acknowledged live version", "refuses an editor that applies"),
        ("pre-destructive", "Latest editor draft was not protected; replacement stopped", "pre-destructive protection before"),
        ("pdf-capture", "PDF capture does not match the protected version", "refuses a mismatched protected PDF"),
        ("recovery-identity", "Recovery identity does not match the selected document", "rejects foreign recovery inspection"),
        ("resolve-identity", "Resolution identity does not match the active session", "rejects foreign resolution identity"),
    ]
    for label, message, test in guards:
        yield label, SESSION, SESSION_TEST, test, without_throw(message)
    yield "live-capture", SESSION, SESSION_TEST, "refuses a stale .* capture before export", (
        re.escape("throw new Error(`Editor changed during ${action}`);"), "void 0;")
    for label, message, test in [
        ("resolved-baseline", "Invalid resolved baseline receipt", "refuses .* resolved baseline"),
        ("adoption-snapshot", "Snapshot does not match current document version", "mismatch in an adoption snapshot"),
        ("pending-adoption", "Persistence operations still pending", "while a native save is pending"),
    ]:
        yield label, CONTROLLER, CONTROLLER_TEST, test, without_throw(message)
    yield "queue-bytes", CONTROLLER, CONTROLLER_TEST, "bounds queued bytes independently", (
        re.escape("if (this.bytes + cost > 32 * 1024 * 1024)"), "if (false)")
    yield "stale-submit", CONTROLLER, CONTROLLER_TEST, "stale submissions without dispatch", (
        r"return Promise.reject\(\s*new Error\('Snapshot does not match current document version'\),?\s*\);", "void 0;")
    for label, pattern in [
        ("paste-prefix", re.escape("if (prefix.size) rows.unshift(first.copy(prefix));")),
        ("paste-suffix", r"if \(suffix.size\)\s*rows.push\([\s\S]*?\n\s*\);"),
    ]:
        yield label, "src/editor/clipboard.ts", "tests/contract/editor-input.test.ts", "AUDIT-TEST structured paste", (pattern, "void 0;")
    for label, mapping, test in [
        ("sc002", "malformed-parenthetical", "AUDIT-TEST maps an unclosed parenthetical"),
        ("sc004", "invalid-utf8", "AUDIT-TEST maps preserved invalid UTF-8"),
    ]:
        yield label, "src/domain/scriptCheck.ts", "tests/contract/script-check.test.ts", test, (re.escape("case '" + mapping + "':"), "case 'disabled-audit-mapping':")
    yield "restore-adoption", SESSION, VIEW_TEST, "AUDIT-TEST WritingView prepared Restore", (
        re.escape("await this.adoptExternalBytes(result.source, result.receipt, prepared);"), "void prepared;")
    yield "resolve-adoption", SESSION, VIEW_TEST, "AUDIT-TEST WritingView resolves exact", (
        re.escape("if (result.completed) await this.adoptNativeReceipt(result.completed);"), "void 0;")
    for label, scope in [("replace-one", "{ one: editIndex }"), ("replace-all", "{ all: true }")]:
        yield label, "src/app/findSession.ts", VIEW_TEST, "AUDIT-TEST WritingView replace-one", (
            re.escape("dispatchReplacement(plan, " + scope + ")"), "false")
    yield "check-navigation", "src/app/checkSession.ts", VIEW_TEST, "AUDIT-TEST WritingView Check script", (
        re.escape("if (!navigateCheckIssue(view, projection, issue))"), "if (true)")
    yield "resume-button", "src/app/RecoveryReview.tsx", "tests/ui/RecoveryReview.test.tsx", "AUDIT-TEST resumes the exact", (
        re.escape("onClick={() => onResume({ ...candidate.selection })}"), "onClick={() => undefined}")
    yield "home-resume", "src/app/Home.tsx", "tests/ui/Home.test.tsx", "AUDIT-TEST Home routes Resume", (
        re.escape("(selection) => onOpen({ kind: 'recovered', selection })"), "(_selection) => undefined")


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    repo = Path(__file__).resolve().parent.parent
    output = Path(sys.argv[1]).resolve()
    output.mkdir(parents=True, exist_ok=False)
    baseline = sorted({case[2] for case in cases()})
    control_command = ["pnpm", "exec", "vitest", "run", *baseline,
                       "--reporter=json", "--outputFile", str(output / "control.json")]
    start = time.monotonic()
    with (output / "control.log").open("w") as log:
        control = subprocess.run(control_command, cwd=repo, stdout=log, stderr=subprocess.STDOUT)
    control_result = {"command": control_command, "exitCode": control.returncode,
                      "seconds": round(time.monotonic() - start, 3)}
    (output / "control-result.json").write_text(json.dumps(control_result, indent=2) + "\n")
    print(f"unmodified control: exit={control.returncode} ({control_result['seconds']}s)", flush=True)
    if control.returncode:
        return 1
    results = []
    for label, source_path, test_path, test_name, (pattern, replacement) in cases():
        source_file = repo / source_path
        original = source_file.read_text()
        mutant, hits = re.subn(pattern, lambda _: replacement, original)
        if hits != 1:
            raise ValueError(f"{label}: expected one mutation site, got {hits}")
        case_dir = output / label
        case_dir.mkdir()
        loaded = case_dir / "loaded.json"
        config = case_dir / "config.ts"
        config.write_text(
            "import { writeFileSync } from 'node:fs';\n"
            f"import base from {json.dumps(str(repo / 'vite.config.ts'))};\n"
            "export default { ...base, "
            f"root: {json.dumps(str(repo))}, "
            "plugins: [...(base.plugins ?? []), { name: 'audit-mutation', enforce: 'pre', "
            "transform(code, id) { "
            f"if (id.split('?')[0] !== {json.dumps(str(source_file))}) return null; "
            f"writeFileSync({json.dumps(str(loaded))}, JSON.stringify({{ loaded: id }})); "
            f"return {{ code: {json.dumps(mutant)}, map: null }}; "
            "} }] };\n"
        )
        report_path = case_dir / "vitest.json"
        command = ["pnpm", "exec", "vitest", "run", test_path, "-t", test_name,
                   "--config", str(config), "--reporter=json", "--outputFile", str(report_path)]
        start = time.monotonic()
        with (case_dir / "run.log").open("w") as log:
            run = subprocess.run(command, cwd=repo, stdout=log, stderr=subprocess.STDOUT)
        report = json.loads(report_path.read_text()) if report_path.exists() else {}
        assertions = [test for suite in report.get("testResults", [])
                      for test in suite.get("assertionResults", []) if test.get("status") == "failed"]
        killed = (run.returncode == 1 and loaded.exists() and bool(assertions)
                  and report.get("numRuntimeErrorTestSuites", 0) == 0)
        if source_file.read_text() != original:
            raise RuntimeError(f"{source_path} changed during mutation run")
        results.append({"mutant": label, "source": source_path, "command": command,
                        "seconds": round(time.monotonic() - start, 3),
                        "exitCode": run.returncode, "detected": killed,
                        "failedTests": [test.get("fullName") for test in assertions]})
        (output / "results.json").write_text(json.dumps(results, indent=2) + "\n")
        print(f"{label}: {'detected' if killed else 'FAILED'} ({results[-1]['seconds']}s)", flush=True)
        if not killed:
            return 1
    print(f"mutation proof: {len(results)}/{len(results)} detected; production files untouched")
    return 0


if __name__ == "__main__":
    sys.exit(main())
