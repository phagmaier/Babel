"""Sequential M4-15 default-release regression matrix on disposable roots.
Each scenario owns a fresh profile/driver; no concurrent compositor input.
"""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

from process_watch import ProcessWatch, journal_scan

MODES = ['daily-session', 'home', 'recents', 'outline', 'workflow-protection',
         'scene-moves', 'title-page', 'find', 'find-timing', 'replace', 'script-check',
         'presentation', 'spellcheck', 'characters', 'commands', 'editor-exit',
         'audit-fixes', 'capture-review', 'latency-review']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('roots', nargs='+', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--modes', nargs='+', choices=MODES + ['recovery-reopen', 'external-reload', 'publication-exit', 'pdf-export', 'typed-export', 'local-pilot', 'picker-start', 'spellcheck-unavailable', 'empty-heading', 'recovery-shutdown', 'persistence-paths', 'persistence-two-instances', 'persistence-two-instances-shared'], default=MODES)
    parser.add_argument('--presentation-no-restart', action='store_true',
                        help='diagnostic only: skip presentation preference restart')
    parser.add_argument('--presentation-control', choices=['baseline', 'preedit-disabled', 'no-ime', 'typical-only', 'no-zoom', 'cleanup-probes'], default='baseline', help='diagnostic workload control; never integrated acceptance')
    args = parser.parse_args()
    if args.presentation_control != 'baseline' and args.modes != ['presentation']:
        parser.error('--presentation-control requires --modes presentation alone')
    if args.presentation_no_restart and args.modes != ['presentation']:
        parser.error('--presentation-no-restart requires --modes presentation alone')
    args.output.mkdir(parents=True, exist_ok=False)
    env = os.environ.copy()
    env['PATH'] = '/tmp:' + env.get('PATH', '')
    reports = []
    driver = Path(__file__).with_name('drill.py')
    for root in args.roots:
        root = root.resolve(strict=True)
        filesystem = subprocess.check_output(['stat', '-f', '-c', '%T', str(root)], text=True).strip()
        for mode in args.modes:
            label = f'{len(reports):02d}-{filesystem}-{mode}'
            log = args.output / (label + '.log')
            cmd = [sys.executable, str(driver), str(root)]
            if mode != 'recovery-shutdown':
                cmd.append('--' + mode)
            if mode == 'presentation':
                cmd.extend(['--presentation-control', args.presentation_control])
            if mode == 'presentation' and args.presentation_no_restart:
                cmd.append('--presentation-no-restart')
            devices = [line.split(':')[0].strip() for line in Path('/proc/self/net/dev').read_text().splitlines()[2:]]
            if mode == 'spellcheck' and devices != ['lo']:
                # Existing offline production spelling gate: only loopback. The
                # packaged runner already supplies that namespace with a normal
                # user; nesting a root-mapped one there breaks the package's GTK.
                cmd = ['unshare', '--user', '--map-root-user', '--net', '/bin/sh', '-c',
                       'ip link set lo up && exec "$@"', 'm4-offline', *cmd]
            started = time.monotonic()
            watch_path = args.output / (label + '-processes.json')
            journal_path = args.output / (label + '-journal.json')
            # Every mode keeps an owned-process ledger and bounded crash journal:
            # journal-only web-process crashes and surviving apps after forced
            # WebDriver teardown leave no stderr line.
            with log.open('w') as stream:
                with subprocess.Popen(cmd, env=env, stdout=stream, stderr=subprocess.STDOUT) as result:
                    watch = ProcessWatch(result.pid, watch_path)
                    while result.poll() is None:
                        watch.sample()
                        time.sleep(.05)
                    # Continue watching known orphans during bounded journal delivery.
                    until = time.monotonic() + 5
                    while time.monotonic() < until:
                        watch.sample()
                        time.sleep(.05)
                    ledger = watch.save()
                scan = journal_scan(ledger, journal_path)
            content = log.read_text()
            artifacts = re.findall(r'(?:ROOT|ARTIFACTS) ([^\s]+)', content)
            artifact = Path(artifacts[-1]) if artifacts else None
            native_log = artifact / 'webdriver.log' if artifact else None
            crash_lines = []
            if native_log and native_log.exists():
                crash_lines = [line for line in native_log.read_text(errors='replace').splitlines()
                               if re.search(r'corrupt|double free|segfault|segmentation fault|SIGABRT|core dumped', line, re.I)]
            report = {'mode': mode, 'root': str(root), 'filesystem': filesystem,
                      'command': cmd, 'exitCode': result.returncode,
                      'seconds': round(time.monotonic() - started, 2), 'log': str(log),
                      'artifacts': str(artifact) if artifact else None,
                      'runtimeCrashLines': crash_lines,
                      'presentationRestart': not args.presentation_no_restart if mode == 'presentation' else None,
                      'presentationControl': args.presentation_control if mode == 'presentation' else None,
                      'intentionalKillScenario': mode in ['editor-exit', 'audit-fixes', 'recovery-shutdown', 'recovery-reopen', 'empty-heading']}
            live_native = [p for p in ledger['processes'] if
                           not p.get('firstMissing') and p['state'] != 'Z' and
                           re.search(r'WebKit|babel-desktop', p['name'])]
            report.update(processLedger=str(watch_path), crashJournal=str(journal_path),
                          journalCrashEvents=scan['events'], liveNativeProcesses=live_native,
                          crashAuditPassed=scan['readPassed'] and not scan['events'] and not live_native)
            reports.append(report)
            (args.output / 'results.json').write_text(json.dumps(reports, indent=2) + '\n')
            print(json.dumps(report), flush=True)
    failed = [r for r in reports if r['exitCode'] or
              r['runtimeCrashLines'] or not r.get('crashAuditPassed', True)]
    gate = ('AUDIT-D08A' if args.modes == ['external-reload'] else
            'M5-07' if args.modes == ['publication-exit'] else
            'AUDIT-D07-N' if args.modes == ['typed-export'] else
            'AUDIT-PARK-H' if args.modes == ['empty-heading'] else
            'M6-01' if args.modes == ['recovery-shutdown'] else 'M4-15')
    print(f'{gate} MATRIX: {len(reports)-len(failed)}/{len(reports)} successful; crash lines require source review', flush=True)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
