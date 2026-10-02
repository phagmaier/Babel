"""Verify offline helper identity across different checkout/staging paths."""
import json
import tempfile
import unittest
from pathlib import Path

import build
import verify_runtime


class BuildTest(unittest.TestCase):
    def test_offline_build_identity_is_independent_of_work_path(self):
        original = build.WORK, build.RUNTIME
        try:
            with tempfile.TemporaryDirectory(prefix='build-path-', dir=build.WORK) as tmp:
                manifests = []
                for name in ['checkout-one', 'different checkout/two']:
                    build.WORK = Path(tmp) / name
                    build.RUNTIME = build.WORK / 'runtime'
                    build.build(offline=True)
                    manifests.append(json.loads((build.RUNTIME / 'BUILD.json').read_text()))
                    self.assertEqual(verify_runtime.verify(build.RUNTIME, exact=True)['problems'], [])
                self.assertEqual(manifests[0], manifests[1])
        finally:
            build.WORK, build.RUNTIME = original


if __name__ == '__main__':
    unittest.main()
