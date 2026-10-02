"""Synthetic negative audit cases; native evidence remains separate."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from audit_plain_presentation import audit
from audit_shutdown import ORACLES
from plain_presentation import fixture


class AuditTests(unittest.TestCase):
    def fixture(self, root):
        for folder in ['files', 'copies']:
            (root / folder).mkdir()
            (root / folder / 'presentation-typical.fountain').write_bytes(fixture(150))
        for suffix in ['recovery/a.journal', 'recovery/b.journal',
                       'source-save/a/confirmed', 'source-save/b/confirmed']:
            p = root / 'data/app.babel.screenwriter' / suffix
            p.parent.mkdir(parents=True, exist_ok=True); p.touch()
        journal = {'started': 0, 'ended': 3, 'events': [], 'readPassed': True}
        (root / 'journal.json').write_text(json.dumps(journal))
        (root / 'processes.json').write_text(json.dumps({'started': 0, 'processes': [{'name': 'WebKitWebProces'}]}))
        return {'root': str(root), 'journal': journal, 'automation': False,
                'automationEnvironmentAbsent': True, 'workloadCompleted': True,
                'checks': [{}], 'workloads': ['typical'], 'started': 0, 'closeRequested': 1,
                'closeCompleted': 2, 'ended': 3, 'error': None, 'appExitCode': 0,
                'watchErrors': [], 'runtimeCrashLines': [], 'liveNative': [], 'strictPassed': True}

    def test_earlier_matching_frame_cannot_hide_an_edited_final_head(self):
        with tempfile.TemporaryDirectory(prefix='babel-plain-presentation-') as folder:
            root = Path(folder); run = self.fixture(root)
            size, digest, _ = ORACLES['typical']
            good = {'bytes': size, 'sha256': digest}
            def records(path):
                return [good, {'bytes': size + 1, 'sha256': 'a' * 64}] if path.name == 'a.journal' else [good]
            with patch('audit_plain_presentation.frames', side_effect=records), patch('audit_plain_presentation.journal_scan', return_value=run['journal']):
                with self.assertRaisesRegex(AssertionError, 'Final original/copy identity heads differ'):
                    audit(run, root / 'replay.json')

    def test_crash_cannot_be_relabelled_passed_by_clean_bytes(self):
        with tempfile.TemporaryDirectory(prefix='babel-plain-presentation-') as folder:
            root = Path(folder); run = self.fixture(root)
            size, digest, _ = ORACLES['typical']
            run['runtimeCrashLines'] = ['corrupted double-linked list']
            with patch('audit_plain_presentation.frames', return_value=[{'bytes': size, 'sha256': digest}]), patch('audit_plain_presentation.journal_scan', return_value=run['journal']):
                with self.assertRaises(AssertionError):
                    audit(run, root / 'replay.json')
                run['strictPassed'] = False
                result = audit(run, root / 'replay.json')
                self.assertTrue(result['bytesAudited'])
                self.assertFalse(result['strictPassed'])
                self.assertEqual(result['runtimeCrashLines'], run['runtimeCrashLines'])


if __name__ == '__main__':
    unittest.main()
