"""Replay exact retained journal windows without overwriting native evidence."""
import argparse
import json
from pathlib import Path
import sys

from process_watch import journal_scan


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=False)
    reports = []
    for i, run in enumerate(json.loads(args.manifest.read_text())):
        ledger = json.loads(Path(run['processLedger']).read_text())
        previous = json.loads(Path(run['crashJournal']).read_text())
        assert ledger['started'] == previous['started']
        output = args.output / f'{i:02d}-journal.json'
        scan = journal_scan(ledger, output, ended=previous['ended'])
        assert scan['command'] == previous['command']
        audited = {**run, 'crashJournalReplay': str(output),
                   'journalCrashEvents': scan['events'],
                   'crashAuditPassed': scan['readPassed'] and
                       not scan['events'] and not run['liveNativeProcesses']}
        audited['replayStrictPassed'] = (not run['exitCode'] and not run['runtimeCrashLines'] and
            not run.get('matrixExitCode', 0) and run.get('phaseAuditPassed', True) and
            audited['crashAuditPassed'])
        reports.append(audited)
    (args.output / 'results.json').write_text(json.dumps(reports, indent=2) + '\n')
    passed = sum(r['replayStrictPassed'] for r in reports)
    print(json.dumps({'strictPassed': passed, 'cases': len(reports),
                      'events': sum(len(r['journalCrashEvents']) for r in reports)}))
    return int(passed != len(reports))


if __name__ == '__main__':
    sys.exit(main())
