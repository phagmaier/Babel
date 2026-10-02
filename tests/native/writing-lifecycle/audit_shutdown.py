"""Read-only phase and frozen-byte audit, including strict crash-failed roots.

Roots whose drill died before any shutdown phase (no shutdown-phases.json) are
reported as drill-failed with zero audited exits and no byte-oracle claim;
they are never relabelled successful."""
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
        phases_path = root / 'shutdown-phases.json'
        if not phases_path.exists():
            # Drill died before shutdown (no phases recorded, no byte claim).
            # The strict verdict already failed; report it, don't crash on it.
            assert run['shutdownPhases'] == [], root
            assert not run['phaseAuditPassed'], root
            assert run['matrixExitCode'] != 0, root
            reports.append({'root': str(root), 'mode': run['shutdownMode'],
                            'filesystem': run['filesystem'], 'exitCode': run['exitCode'],
                            'runtimeCrashLines': run['runtimeCrashLines'],
                        'journalCrashEvents': run.get('journalCrashEvents', []), 'auditedExits': 0,
                            'completeExitSequences': False, 'shutdownReached': False,
                            'note': 'drill failed before shutdown; bytes not audited'})
            continue
        phases = json.loads(phases_path.read_text())
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
        expected_exits = 2 if run.get('presentationRestart', True) else 1
        assert len(phases) <= expected_exits, root
        complete = len(phases) == expected_exits and all(p['phases'][-1]['name'] == 'complete' for p in phases)
        assert complete == run['phaseAuditPassed']
        if run['matrixExitCode'] == 0:
            assert complete, root
        journals = [frames(p) for p in (root / 'data/app.babel.screenwriter/recovery').glob('*.journal')]
        receipts = [frames(p) for p in (root / 'data/app.babel.screenwriter/source-save').glob('*/confirmed')]
        control = run.get('presentationControl', 'baseline')
        assert control in ['baseline', 'preedit-disabled', 'no-ime', 'typical-only', 'no-zoom', 'cleanup-probes'], control
        workloads = ['typical'] if control == 'typical-only' else ['typical', 'stress']
        for name in workloads:
            length, copy_hash, source_hash = ORACLES[name]
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
                        'runtimeCrashLines': run['runtimeCrashLines'],
                        'journalCrashEvents': run.get('journalCrashEvents', []), 'auditedExits': len(phases),
                        'completeExitSequences': complete, 'shutdownReached': True,
                        'presentationControl': control, 'auditedWorkloads': workloads})
    args.output.write_text(json.dumps(reports, indent=2) + '\n')
    print(json.dumps({'auditedRoots': len(reports), 'auditedExits': sum(r['auditedExits'] for r in reports),
                      'crashRoots': sum(bool(r['runtimeCrashLines'] or r['journalCrashEvents']) for r in reports),
                      'drillFailedRoots': sum(not r['shutdownReached'] for r in reports)}))


if __name__ == '__main__':
    main()
