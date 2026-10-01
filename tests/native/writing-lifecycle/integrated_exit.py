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

MODES = ['daily-session', 'home', 'recents', 'outline', 'workflow-protection',
         'scene-moves', 'title-page', 'find', 'find-timing', 'replace', 'script-check',
         'presentation', 'spellcheck', 'characters', 'commands', 'editor-exit',
         'audit-fixes', 'capture-review', 'latency-review']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('roots', nargs='+', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--modes', nargs='+', choices=MODES, default=MODES)
    args = parser.parse_args()
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
            cmd = [sys.executable, str(driver), str(root), '--' + mode]
            if mode == 'spellcheck':
                # Existing offline production spelling gate: only loopback.
                cmd = ['unshare', '--user', '--map-root-user', '--net', '/bin/sh', '-c',
                       'ip link set lo up && exec "$@"', 'm4-offline', *cmd]
            started = time.monotonic()
            with log.open('w') as stream:
                result = subprocess.run(cmd, env=env, stdout=stream, stderr=subprocess.STDOUT)
            content = log.read_text()
            artifacts = re.findall(r'(?:ROOT|ARTIFACTS) ([^\s]+)', content)
            artifact = Path(artifacts[-1]) if artifacts else None
            native_log = artifact / 'webdriver.log' if artifact else None
            crash_lines = []
            if native_log and native_log.exists():
                crash_lines = [line for line in native_log.read_text(errors='replace').splitlines()
                               if re.search(r'corrupted|double free|SIGABRT|segmentation fault|core dumped', line, re.I)]
            report = {'mode': mode, 'root': str(root), 'filesystem': filesystem,
                      'command': cmd, 'exitCode': result.returncode,
                      'seconds': round(time.monotonic() - started, 2), 'log': str(log),
                      'artifacts': str(artifact) if artifact else None,
                      'runtimeCrashLines': crash_lines,
                      'intentionalKillScenario': mode in ['editor-exit', 'audit-fixes']}
            reports.append(report)
            (args.output / 'results.json').write_text(json.dumps(reports, indent=2) + '\n')
            print(json.dumps(report), flush=True)
    failed = [r for r in reports if r['exitCode'] or
              r['runtimeCrashLines']]
    print(f'M4-15 MATRIX: {len(reports)-len(failed)}/{len(reports)} successful; crash lines require source review', flush=True)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
