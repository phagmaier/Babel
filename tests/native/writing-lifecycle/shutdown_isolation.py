"""Paired default-binary workload exits; retain failures and exact provenance.

--modes selects the integrated_exit scenario (default presentation). Home mode
isolates automation presence from presentation workload content; presentation
byte oracles do not apply to other modes."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('roots', nargs='+', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--repeats', type=int, default=2)
    parser.add_argument('--modes', nargs='+', default=['presentation'],
                        help='integrated_exit scenario names (default: presentation)')
    parser.add_argument('--presentation-no-restart', action='store_true',
                        help='diagnostic only: retain presentation workload, skip preference restart')
    args = parser.parse_args()
    if args.presentation_no_restart and args.modes != ['presentation']:
        parser.error('--presentation-no-restart requires --modes presentation alone')
    if args.repeats < 1:
        parser.error('--repeats must be positive')
    args.output.mkdir(parents=True, exist_ok=False)
    binary = Path(os.environ.get('BABEL_NATIVE_BINARY',
        str(Path(__file__).resolve().parents[3] / 'target/release/babel-desktop'))).resolve(strict=True)
    digest = hashlib.sha256(binary.read_bytes()).hexdigest()
    (args.output / 'binary.json').write_text(json.dumps({
        'path': str(binary), 'sha256': digest, 'repeats': args.repeats,
        'automation': True, 'ordinaryEntry': 'Hyprland graceful window close from Home',
        'scenarioModes': args.modes, 'presentationRestart': not args.presentation_no_restart,
    }, indent=2) + '\n')
    reports = []
    matrix = Path(__file__).with_name('integrated_exit.py')
    for root in args.roots:
        for repetition in range(args.repeats):
            # Alternate arm order; each case still has a fresh private profile.
            for mode in (['ordinary', 'forced'] if repetition % 2 == 0 else ['forced', 'ordinary']):
                assert hashlib.sha256(binary.read_bytes()).hexdigest() == digest, 'Binary changed during paired probe'
                output = args.output / f'{len(reports):02d}-{mode}'
                env = os.environ.copy()
                env.update(BABEL_SHUTDOWN_MODE=mode, BABEL_NATIVE_BINARY=str(binary))
                cmd = [sys.executable, str(matrix), str(root), '--modes', *args.modes, '--output', str(output)]
                if args.presentation_no_restart:
                    cmd.append('--presentation-no-restart')
                with (args.output / (output.name + '.log')).open('w') as log:
                    result = subprocess.run(cmd, env=env, stdout=log, stderr=subprocess.STDOUT)
                entries = json.loads((output / 'results.json').read_text())
                assert len(entries) == 1
                entry = entries[0]
                entry.update(shutdownMode=mode, repetition=repetition, binarySha256=digest,
                             matrixExitCode=result.returncode)
                artifact = Path(entry['artifacts']) if entry['artifacts'] else None
                phases = artifact / 'shutdown-phases.json' if artifact else None
                entry['shutdownPhases'] = json.loads(phases.read_text()) if phases and phases.exists() else []
                # Drill exit code already gates functionality; the phase audit
                # verifies every recorded exit completed. Single-exit scenarios
                # (for example home) record one sequence, presentation two.
                entry['phaseAuditPassed'] = (len(entry['shutdownPhases']) >= 1 and
                    all(p['mode'] == mode and p['phases'][-1]['name'] == 'complete'
                        for p in entry['shutdownPhases']))
                reports.append(entry)
                (args.output / 'results.json').write_text(json.dumps(reports, indent=2) + '\n')
                print(json.dumps(entry), flush=True)
    failed = [r for r in reports if r['matrixExitCode'] or not r['phaseAuditPassed']]
    print(f'SHUTDOWN ISOLATION: {len(reports)-len(failed)}/{len(reports)} strict cases passed', flush=True)
    return int(bool(failed))


if __name__ == '__main__':
    sys.exit(main())
