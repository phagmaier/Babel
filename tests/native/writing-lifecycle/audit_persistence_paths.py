"""Independent literal-byte/head audit; functional and crash verdicts stay separate."""
import argparse
import hashlib
import json
from pathlib import Path

from audit_retained import frames


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    reports = []
    for run in json.loads(args.manifest.read_text()):
        if run['mode'] not in ['persistence-paths', 'persistence-two-instances-shared', 'recovery-shutdown', 'audit-fixes']:
            continue
        root = Path(run['artifacts'])
        checked = []

        def exact(path, literal):
            assert path.read_bytes() == literal, path
            checked.append({'path': str(path), 'bytes': len(literal), 'sha256': hashlib.sha256(literal).hexdigest()})

        journals = [p for p in root.rglob('*.journal') if p.parent.name == 'recovery']
        heads = [f[-1] for p in journals if (f := frames(p))]
        if run['mode'] == 'persistence-paths':
            original = b'!Original path-loss source.\r\n'
            live = b'!Live.Original path-loss source.\r\n'
            copied = b'!Copy.Live.Original path-loss source.\r\n'
            for case in ['deleted', 'renamed', 'parent-unavailable']:
                assert not (root / 'files' / case / 'source.fountain').exists()
            exact(root / 'files/renamed/moved.fountain', original)
            exact(root / 'files/removed-drive-simulation/source.fountain', original)
            exact(root / 'copies/renamed.fountain', copied)
            exact(root / 'copies/parent-unavailable.fountain', copied)
            emergency = [p for p in (root / 'copies').iterdir() if p.is_file() and p.read_bytes() == live]
            assert len(emergency) == 1
            exact(emergency[0], live)
            report = json.loads((root / 'persistence-paths.json').read_text())
            assert len(report) == 3
            for case in report:
                journal = root / 'data/app.babel.screenwriter/recovery' / (case['documentId'] + '.journal')
                last = frames(journal)[-1]
                assert last['version'] >= case['acknowledgedVersion']
                assert last['sha256'] == hashlib.sha256(live).hexdigest() and last['bytes'] == len(live)
            assert any(h['sha256'] == hashlib.sha256(copied).hexdigest() and h['bytes'] == len(copied) for h in heads)
        elif run['mode'] == 'persistence-two-instances-shared':
            literal = b'!Still owned.One writer.\r\n'
            exact(root / 'files/two-instances.fountain', literal)
            ownership = json.loads((root / 'second-instance/ownership.json').read_text())
            assert ownership['sharedPersistenceRoot'] and ownership['readOnly'] == 'true' and ownership['saveDisabled']
            assert any(h['sha256'] == hashlib.sha256(literal).hexdigest() and h['bytes'] == len(literal) for h in heads)
        elif run['mode'] == 'recovery-shutdown':
            exact(root / 'files/script.fountain', b'!Independent external version.\n')
            live = b'!Despite history Local Recovered  Later.Mist curls. More.\n'
            copies = [p for p in (root / 'copies').iterdir() if p.is_file() and p.read_bytes() == live]
            assert len(copies) == 1
            exact(copies[0], live)
            assert any(h['sha256'] == hashlib.sha256(live).hexdigest() and h['bytes'] == len(live) for h in heads)
        else:
            literal = b'!Read-only source.\r\n'
            exact(root / 'files/read-only.fountain', literal)
            exact(root / 'files/read-only-copy.fountain', literal)
            assert (root / 'files/read-only.fountain').stat().st_mode & 0o777 == 0o444
            resumed = b'!Unsaved checkpoint survives.\n'
            exact(root / 'files/resumed.fountain', resumed)
            managed = b'!Again.New.Managed original.\n'
            exact(root / 'files/managed/script.fountain', managed)
            for literal in [resumed, managed]:
                assert any(h['sha256'] == hashlib.sha256(literal).hexdigest() and h['bytes'] == len(literal) for h in heads)
        reports.append({'root': str(root), 'mode': run['mode'], 'files': checked, 'headCount': len(heads), 'functionalExitCode': run['exitCode'], 'crashAuditPassed': run['crashAuditPassed']})
    args.output.write_text(json.dumps(reports, indent=2) + '\n')
    print(json.dumps({'auditedRoots': len(reports), 'literalFiles': sum(len(r['files']) for r in reports)}))


if __name__ == '__main__':
    main()
