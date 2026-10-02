"""Independent frozen-byte and exact-window crash replay for plain presentation.

Audit success never turns a crash into a pass. Incomplete workloads have no full
byte claim. Replay keeps read failures and unattributed crashes as strict failures.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path

from audit_retained import frames
from audit_shutdown import ORACLES
from process_watch import journal_scan


def audit(run, replay_path):
    root = Path(run['root']).resolve(strict=True)
    assert root.name.startswith('babel-plain-presentation-')
    ledger = json.loads((root / 'processes.json').read_text())
    assert any(p['name'] == 'WebKitWebProces' for p in ledger['processes'])
    assert not any(p['name'] == 'WebKitWebDriver' for p in ledger['processes'])
    original = json.loads((root / 'journal.json').read_text())
    assert original == run['journal']
    assert not run['automation'] and run['automationEnvironmentAbsent']
    complete = run.get('workloadCompleted', False)
    if complete:
        assert len(run['checks']) == len(run['workloads'])
        for name in run['workloads']:
            length, digest, _ = ORACLES[name]
            for folder in ['files', 'copies']:
                data = (root / folder / ('presentation-' + name + '.fountain')).read_bytes()
                assert (len(data), hashlib.sha256(data).hexdigest()) == (length, digest)
            for paths in [(root / 'data/app.babel.screenwriter/recovery').glob('*.journal'),
                          (root / 'data/app.babel.screenwriter/source-save').glob('*/confirmed')]:
                assert any(any(f['sha256'] == digest and f['bytes'] == length for f in frames(p)) for p in paths)
        # Every final identity must agree, not just an earlier matching frame.
        expected_heads = Counter({(ORACLES[name][0], ORACLES[name][1]): 2 for name in run['workloads']})
        for paths in [(root / 'data/app.babel.screenwriter/recovery').glob('*.journal'),
                      (root / 'data/app.babel.screenwriter/source-save').glob('*/confirmed')]:
            heads = Counter((f[-1]['bytes'], f[-1]['sha256']) for p in paths if (f := frames(p)))
            assert heads == expected_heads, ('Final original/copy identity heads differ', heads)
        if 'closeCompleted' in run:
            assert run['started'] <= run['closeRequested'] <= run['closeCompleted'] <= run['ended']
        else:
            assert run['error'] and not run['strictPassed']
    else:
        assert run['error'] and not run['strictPassed']
    replay = journal_scan(ledger, replay_path, ended=original['ended'])
    assert replay['started'] == original['started']
    assert replay['events'] == original['events'], 'Retained-window journal evidence changed'
    strict = (run.get('toolingUnchanged', True) and complete and 'closeCompleted' in run and not run['error'] and run['appExitCode'] == 0 and not run['watchErrors']
              and not run['runtimeCrashLines'] and replay['readPassed'] and not replay['events']
              and not run['liveNative'] and not run.get('failedProbeForcedCleanup'))
    assert strict == run['strictPassed']
    return {'root': str(root), 'bytesAudited': complete, 'strictPassed': strict,
            'crashEvents': len(replay['events']), 'runtimeCrashLines': run['runtimeCrashLines']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=False)
    results = [audit(run, args.output / f'{i:02d}-journal.json')
               for i, run in enumerate(json.loads(args.manifest.read_text()))]
    (args.output / 'results.json').write_text(json.dumps(results, indent=2) + '\n')
    print(json.dumps({'auditedRoots': len(results), 'bytesAudited': sum(r['bytesAudited'] for r in results),
                      'strictPassed': sum(r['strictPassed'] for r in results)}))


if __name__ == '__main__':
    main()
