"""Synthetic tests only; real shutdown attribution requires native observations."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from shutdown_observer import observe_process, ExitObserver


class ObserverTests(unittest.TestCase):
    def test_dumping_process_and_wait_channels(self):
        with tempfile.TemporaryDirectory() as folder:
            proc = Path(folder); p = proc / '12'; (p / 'task/13').mkdir(parents=True)
            fields = ['D'] + ['0'] * 18 + ['456']
            (p / 'stat').write_text('12 (WebKitWebProces) ' + ' '.join(fields))
            (p / 'status').write_text('CoreDumping:\t1\nShdPnd:\t0000000000000020\n')
            (p / 'task/13/comm').write_text('render\n')
            (p / 'task/13/wchan').write_text('futex_wait_queue')
            observed = observe_process({'pid': 12, 'start': '456'}, proc)
            self.assertEqual(observed['coreDumping'], '1')
            self.assertEqual(observed['pendingSignals'], '0000000000000020')
            self.assertEqual(observed['threads'][0]['waitChannel'], 'futex_wait_queue')
            self.assertEqual(observe_process({'pid': 12, 'start': '999'}, proc),
                             {'pid': 12, 'identity': 'reused'})
            self.assertEqual(observe_process({'pid': 14, 'start': '456'}, proc),
                             {'pid': 14, 'identity': 'gone'})

    def test_observations_preserve_new_stderr_and_stop_on_error_path(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); log = root / 'stderr'; log.write_text('old error\n')
            output = root / 'observations.json'
            observer = ExitObserver([{'pid': 12, 'start': '456'}], log, output)
            log.write_text('old error\nfree(): corrupted unsorted chunks\n')
            with patch('shutdown_observer.observe_process', return_value={'pid': 12, 'coreDumping': '1'}):
                with self.assertRaises(RuntimeError):
                    with observer:
                        raise RuntimeError('close failed')
            report = json.loads(output.read_text())
            self.assertTrue(report['observerStopped'])
            self.assertEqual(report['observations'][0]['newStderr'], 'free(): corrupted unsorted chunks\n')
            self.assertEqual(report['observations'][0]['processes'][0]['coreDumping'], '1')

    def test_read_failure_is_explicit(self):
        with patch('shutdown_observer.Path.read_text', side_effect=PermissionError('denied')):
            self.assertIn('denied', observe_process({'pid': 12, 'start': '456'})['readError'])


if __name__ == '__main__':
    unittest.main()
