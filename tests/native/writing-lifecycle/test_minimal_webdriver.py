"""Synthetic refusal checks; these do not verify native shutdown."""
from copy import deepcopy
from pathlib import Path
import signal
import tempfile
import unittest
from unittest.mock import patch

from minimal_webdriver import alive, installed_library_paths, main, signal_owned, strict_pass


def complete_report():
    return {
        'workloadCompleted': True, 'ordinaryExitCompleted': True,
        'observerPassed': True, 'watchPassed': True,
        'installedLibrariesObserved': True, 'driverAliveBeforeCleanup': True,
        'driverExitCode': -signal.SIGTERM, 'hostExitMarker': True,
        'observedCrashes': [], 'observerReadErrors': [],
        'survivors': [], 'fallbackSignals': [], 'crashLines': [],
        'journal': {'readPassed': True, 'events': []},
        'phases': [{'name': n} for n in ['ordinary-close-request',
                    'owned-descendants-exited', 'driver-cleanup']],
    }


class MinimalTests(unittest.TestCase):
    def test_installed_automation_bundle_is_retained_without_accepting_private_libs(self):
        libraries = ['/usr/lib/libwebkit2gtk-4.1.so.0.21.10',
                     '/usr/lib/libjavascriptcoregtk-4.1.so.0.10.14']
        bundle = '/usr/lib/webkit2gtk-4.1/injected-bundle/libwebkit2gtkinjectedbundle.so'
        self.assertTrue(installed_library_paths(libraries))
        self.assertTrue(installed_library_paths(libraries + [bundle]))
        for paths in [[], libraries[:1], libraries + [libraries[0]],
                      [libraries[0], '/tmp/private/libjavascriptcoregtk-4.1.so.0'],
                      libraries + ['/tmp/private/libwebkit2gtkinjectedbundle.so'],
                      libraries + ['/usr/lib/unknown-libwebkit2gtk.so']]:
            self.assertFalse(installed_library_paths(paths))

    def test_crash_evidence_always_refuses_clean_summary(self):
        good = complete_report()
        self.assertTrue(strict_pass(good))
        changes = [
            {'crashLines': ['free(): corrupted double-linked list']},
            {'journal': {'readPassed': True, 'events': [{'signal': '6', 'message': None}]}},
            {'observedCrashes': [{'coreDumping': '1'}]},
            {'observerReadErrors': [{'readError': 'Permission denied'}]},
            {'observerReadErrors': [{'identity': 'reused'}]},
            {'journal': {'readPassed': False, 'events': []}},
        ]
        for change in changes:
            with self.subTest(change=change):
                report = deepcopy(good)
                report.update(change)
                self.assertFalse(strict_pass(report))

    def test_incomplete_and_forced_exits_cannot_pass(self):
        good = complete_report()
        for key, value in [
            ('workloadCompleted', False), ('ordinaryExitCompleted', False),
            ('hostExitMarker', False), ('driverAliveBeforeCleanup', False),
            ('driverExitCode', -signal.SIGABRT), ('watchPassed', False),
            ('installedLibrariesObserved', False), ('observerPassed', False),
            ('survivors', [{'pid': 1}]), ('fallbackSignals', [{'signal': 'SIGKILL'}]),
            ('error', 'Undo mismatch'),
        ]:
            with self.subTest(key=key):
                self.assertFalse(strict_pass({**good, key: value}))
        for key in ['observedCrashes', 'observerReadErrors', 'journal']:
            report = deepcopy(good)
            del report[key]
            self.assertFalse(strict_pass(report))
        report = deepcopy(good)
        report['phases'].reverse()
        self.assertFalse(strict_pass(report))

    def test_pid_reuse_or_zombie_refuses_cleanup_signal(self):
        token = {'pid': 12, 'start': '456'}
        for current in [{}, {12: {**token, 'start': '789', 'state': 'S'}},
                        {12: {**token, 'state': 'Z'}}]:
            self.assertFalse(alive(token, current))
            with patch('minimal_webdriver.os.pidfd_open', return_value=42), \
                 patch('minimal_webdriver.os.close') as close, \
                 patch('minimal_webdriver.processes', return_value=current), \
                 patch('minimal_webdriver.signal.pidfd_send_signal') as send:
                self.assertFalse(signal_owned(token, signal.SIGKILL))
                send.assert_not_called()
                close.assert_called_once_with(42)

    def test_cleanup_signal_uses_pinned_fd_and_closes_on_exit_race(self):
        token = {'pid': 12, 'start': '456'}
        for error in [None, ProcessLookupError()]:
            with patch('minimal_webdriver.os.pidfd_open', return_value=42), \
                 patch('minimal_webdriver.os.close') as close, \
                 patch('minimal_webdriver.processes', return_value={12: {**token, 'state': 'S'}}), \
                 patch('minimal_webdriver.signal.pidfd_send_signal', side_effect=error) as send:
                self.assertEqual(signal_owned(token, signal.SIGKILL), error is None)
                send.assert_called_once_with(42, signal.SIGKILL)
                close.assert_called_once_with(42)

    def test_existing_evidence_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            marker = root / 'result.json'
            marker.write_bytes(b'failed evidence\r\n')
            with patch('sys.argv', ['minimal_webdriver.py', '--output', directory]), \
                 patch('minimal_webdriver.subprocess.run') as run:
                with self.assertRaises(FileExistsError):
                    main()
                run.assert_not_called()
            self.assertEqual(marker.read_bytes(), b'failed evidence\r\n')


if __name__ == '__main__':
    unittest.main()
