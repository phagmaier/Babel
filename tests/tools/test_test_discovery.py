"""Compare actual Vitest discovery with the independent tracked test inventory."""
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEST = re.compile(r'\.(test|spec)\.[cm]?[jt]sx?$')


class DiscoveryTest(unittest.TestCase):
    def test_all_current_tests_and_no_archive(self):
        tracked = subprocess.check_output(['git', 'ls-files', 'tests/contract', 'tests/ui'],
                                          cwd=ROOT, text=True).splitlines()
        expected = {path for path in tracked if TEST.search(path)}
        self.assertGreater(len(expected), 0)
        (ROOT / 'target').mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='discovery-control-', dir=ROOT / 'target') as d:
            (Path(d) / 'archived.test.ts').write_text('throw new Error("archive must not be discovered");\n')
            output = subprocess.check_output(['pnpm', 'exec', 'vitest', 'list', '--filesOnly'],
                                             cwd=ROOT, text=True, stderr=subprocess.PIPE, timeout=120)
        actual = {line.strip() for line in output.splitlines() if TEST.search(line.strip())}
        self.assertEqual(actual, expected)
