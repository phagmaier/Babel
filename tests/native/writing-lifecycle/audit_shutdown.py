"""Read-only phase and frozen-byte audit, including strict crash-failed roots."""
import argparse
import hashlib
import json
from pathlib import Path

from audit_retained import frames

# Independently checked against retained pre-isolation presentation artifacts.
# No production parser or scenario fixture generator supplies these oracles.
ORACLES = {
    'typical': (90983, 'ca9eac8e32839182654582ce2160acf85df3a13c541409b71329844726030c3d',
                'cfeb6a48ac147025c04819e445692d57f8eaacac43a9a42c89387ef3998b60be'),
    'stress': (910933, '09e7d8973ff1e952ae165b7d3038c2d92d8224914992b0429188ecf1ba9da60e',
               'e0c2892ca35273b978cb71771cd55a48c5982589e61b2ebe13de4df52f478b26'),
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    reports = []
    for run in json.loads(args.manifest.read_text()):
        root = Path(run['artifacts']).resolve(strict=True)
        assert root.name.startswith('babel-writing-'), root
        phases = json.loads((root / 'shutdown-phases.json').read_text())
        assert phases == run['shutdownPhases'] and 0 < len(phases) <= 2, root
        expected = ['request', 'owned-processes-exited']
        if run['shutdownMode'] == 'ordinary':
            expected += ['delete-stale-session-after-exit']
        expected += ['complete']
        for phase in phases:
            assert phase['mode'] == run['shutdownMode']
            names = [p['name'] for p in phase['phases']]
            assert names == expected[:len(names)]
            times = [p['wallTime'] for p in phase['phases']]
            assert times == sorted(times)
            assert any(p['name'] == 'WebKitWebProces' for p in phase['processes'])
        complete = len(phases) == 2 and all(p['phases'][-1]['name'] == 'complete' for p in phases)
        assert complete == run['phaseAuditPassed']
        if run['matrixExitCode'] == 0:
            assert complete, root
        journals = [frames(p) for p in (root / 'data/app.babel.screenwriter/recovery').glob('*.journal')]
        receipts = [frames(p) for p in (root / 'data/app.babel.screenwriter/source-save').glob('*/confirmed')]
        for name, (length, copy_hash, source_hash) in ORACLES.items():
            for folder, size, digest in [('copies', length, copy_hash), ('files', length + 12, source_hash)]:
                path = root / folder / f'presentation-{name}.fountain'
                data = path.read_bytes()
                assert len(data) == size and hashlib.sha256(data).hexdigest() == digest, path
            for inventory in [journals, receipts]:
                assert any(f and f[-1]['sha256'] == copy_hash and f[-1]['bytes'] == length
                           for f in inventory), (root, name)
        # Evidence audit success never changes the strict native crash verdict.
        reports.append({'root': str(root), 'mode': run['shutdownMode'],
                        'filesystem': run['filesystem'], 'exitCode': run['exitCode'],
                        'runtimeCrashLines': run['runtimeCrashLines'], 'auditedExits': len(phases),
                        'completeExitSequences': complete})
    args.output.write_text(json.dumps(reports, indent=2) + '\n')
    print(json.dumps({'auditedRoots': len(reports), 'auditedExits': sum(r['auditedExits'] for r in reports),
                      'crashRoots': sum(bool(r['runtimeCrashLines']) for r in reports)}))


if __name__ == '__main__':
    main()
