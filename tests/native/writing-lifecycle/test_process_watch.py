"""Synthetic process/journal regressions; these do not verify native crashes."""
import json
from pathlib import Path
import tempfile
import subprocess
import unittest
from unittest.mock import patch

from process_watch import ProcessWatch, journal_scan


def proc(pid, parent, start='1', name='helper'):
    return {'pid': pid, 'parent': parent, 'start': start, 'state': 'S', 'name': name}


class WatchTests(unittest.TestCase):
    def test_exec_rename_updates_current_name_without_changing_identity(self):
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / 'ledger.json'
            with patch('process_watch.processes', return_value={10: proc(10, 1)}):
                watch = ProcessWatch(10, output)
            with patch('process_watch.processes', return_value={
                10: proc(10, 1), 11: proc(11, 10, name='helper')}):
                watch.sample()
            with patch('process_watch.processes', return_value={
                10: proc(10, 1), 11: proc(11, 10, name='WebKitWebProces')}):
                watch.sample()
            child = watch.records[(11, '1')]
            self.assertEqual(child['firstName'], 'helper')
            self.assertEqual(child['name'], 'WebKitWebProces')
            self.assertEqual((child['parent'], child['parentStart']), (10, '1'))

    def test_siblings_orphans_and_reused_parent(self):
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / 'ledger.json'
            with patch('process_watch.processes', return_value={10: proc(10, 1)}):
                watch = ProcessWatch(10, output)
            with patch('process_watch.processes', return_value={
                10: proc(10, 1), 11: proc(11, 10), 12: proc(12, 10)}):
                watch.sample()
            with patch('process_watch.processes', return_value={
                10: proc(10, 1, '2'), 11: proc(11, 1), 12: proc(12, 1),
                13: proc(13, 12), 14: proc(14, 10)}):
                watch.sample()
            ledger = watch.save()
            self.assertEqual({p['pid'] for p in ledger['processes']}, {10, 11, 12, 13})
            sibling = next(p for p in ledger['processes'] if p['pid'] == 12)
            self.assertEqual((sibling['parent'], sibling['parentStart']), (10, '1'))
            self.assertIn('firstMissing', watch.records[(10, '1')])

    def test_owned_sibling_and_unattributed_journal_crashes(self):
        events = [
            {'__REALTIME_TIMESTAMP': '12000000', 'MESSAGE': 'WebKitWebProces[12]: segfault at 0'},
            {'__REALTIME_TIMESTAMP': '13000000', 'MESSAGE': 'WebKitWebProces[99]: segfault at 0'},
            {'__REALTIME_TIMESTAMP': '14000000', 'MESSAGE': 'Unrelated[55]: segfault at 0'},
            {'__REALTIME_TIMESTAMP': '15000000', 'COREDUMP_PID': '12',
             'COREDUMP_COMM': 'WebKitWebProces', 'COREDUMP_TIMESTAMP': '12000000',
             'COREDUMP_SIGNAL': '6', 'MESSAGE': 'Process 12 dumped core.\nprivate stack omitted'},
            {'__REALTIME_TIMESTAMP': '15500000', 'COREDUMP_PID': '12',
             'COREDUMP_COMM': 'WebKitWebProces', 'COREDUMP_TIMESTAMP': '12000000',
             'COREDUMP_SIGNAL': '6', 'MESSAGE': None},
            {'__REALTIME_TIMESTAMP': '16000000', 'MESSAGE': 'WebKitWebProces[12]: segfault at 0'},
        ]
        ledger = {'started': 10, 'ended': 17, 'processes': [
            {**proc(12, 10), 'firstSeen': 11, 'lastSeen': 13, 'firstMissing': 14}]}
        with tempfile.TemporaryDirectory() as folder:
            with patch('process_watch.subprocess.run') as run, patch('process_watch.time.time', return_value=18):
                run.return_value.returncode = 0
                run.return_value.stderr = ''
                run.return_value.stdout = '\n'.join(json.dumps(e) for e in events)
                report = journal_scan(ledger, Path(folder) / 'journal.json')
            self.assertEqual([e['attribution'] for e in report['events']],
                             ['owned', 'unattributed', 'owned', 'owned', 'unattributed'])
            self.assertEqual(report['command'][-3:], ['_TRANSPORT=kernel', '+', 'SYSLOG_IDENTIFIER=systemd-coredump'])
            self.assertNotIn('private stack', json.dumps(report))

    def test_journal_failure_is_reported(self):
        with tempfile.TemporaryDirectory() as folder, patch('process_watch.subprocess.run') as run:
            run.return_value.returncode = 1
            run.return_value.stderr = 'journal unavailable'
            run.return_value.stdout = ''
            report = journal_scan({'started': 1, 'ended': 2, 'processes': []}, Path(folder) / 'journal.json')
            self.assertEqual(report['exitCode'], 1)
            self.assertEqual(report['stderr'], 'journal unavailable')
            self.assertFalse(report['readPassed'])

    def test_journal_warning_prevents_complete_claim(self):
        with tempfile.TemporaryDirectory() as folder, patch('process_watch.subprocess.run') as run:
            run.return_value.returncode = 0
            run.return_value.stderr = 'No journal files were found.'
            run.return_value.stdout = ''
            report = journal_scan({'started': 1, 'ended': 2, 'processes': []}, Path(folder) / 'journal.json')
            self.assertFalse(report['readPassed'])

    def test_journal_timeout_is_failure(self):
        with tempfile.TemporaryDirectory() as folder, patch('process_watch.subprocess.run') as run:
            run.side_effect = subprocess.TimeoutExpired('journalctl', 30)
            report = journal_scan({'started': 1, 'ended': 2, 'processes': []}, Path(folder) / 'journal.json')
            self.assertEqual(report['exitCode'], 1)
            self.assertIn('timed out', report['stderr'])


if __name__ == '__main__':
    unittest.main()
