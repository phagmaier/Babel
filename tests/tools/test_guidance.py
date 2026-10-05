"""Behavior checks for failure detection, using a disposable instruction tree."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('guidance', ROOT / 'tools/check-guidance.py')
guidance = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(guidance)


class GuidanceTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        files = {'AGENTS.md': 'rules', 'map.md': 'current-state',
                 'TODO.md': 'current-state', 'docs/index.md': 'current-state',
                 'docs/current-state.md': '## Next action\nStop.',
                 'docs/tasks/AUDIT-TRACKER.md': 'current-state',
                 'docs/decisions/0001-example.md': 'Status: Accepted direction; proof open.',
                 'tools/guidance-exceptions.json': '{}'}
        for name, value in files.items():
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(value)

    def test_valid_guidance_and_historical_qualifier(self):
        self.assertEqual(guidance.check(self.root), [])

    def test_duplicate_pointer_and_bad_status_are_rejected(self):
        (self.root / 'map.md').write_text('current-state\nNext bounded continuation is SLP-C.')
        (self.root / 'docs/decisions/0001-example.md').write_text('Status: Accepted.')
        errors = guidance.check(self.root)
        self.assertTrue(any('duplicated' in x for x in errors))
        self.assertTrue(any('status' in x for x in errors))

    def test_budget_needs_documented_review(self):
        (self.root / 'AGENTS.md').write_text('x' * 8193)
        self.assertTrue(guidance.check(self.root))
        (self.root / 'tools/guidance-exceptions.json').write_text(json.dumps({
            'AGENTS.md': {'reason': 'retained safety obligation',
                          'reviewed_by': 'owner', 'date': '2026-10-05'}}))
        self.assertEqual(guidance.check(self.root), [])

    def test_empty_exception_and_missing_next_action_fail(self):
        (self.root / 'tools/guidance-exceptions.json').write_text('{"AGENTS.md": {}}')
        (self.root / 'docs/current-state.md').write_text('No section.')
        errors = guidance.check(self.root)
        self.assertTrue(any('exception' in x for x in errors))
        self.assertTrue(any('Next action' in x for x in errors))
