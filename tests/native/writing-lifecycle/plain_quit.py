"""Non-automation cold Home/window-close control; no authoring/content claim."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time

from shutdown_lifecycle import processes


def wait(check, timeout=30):
    until = time.monotonic() + timeout
    while time.monotonic() < until:
        value = check()
        if value:
            return value
        time.sleep(.1)
    raise AssertionError('Owned native process/window observation timed out')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('roots', nargs='+', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--repeats', type=int, default=4)
    args = parser.parse_args()
    if args.repeats < 1:
        parser.error('--repeats must be positive')
    args.output.mkdir(parents=True, exist_ok=False)
    binary = Path(os.environ.get('BABEL_NATIVE_BINARY',
        str(Path(__file__).resolve().parents[3] / 'target/release/babel-desktop'))).resolve(strict=True)
    digest = hashlib.sha256(binary.read_bytes()).hexdigest()
    reports = []
    for base in args.roots:
        for repetition in range(args.repeats):
            root = Path(tempfile.mkdtemp(prefix='babel-plain-quit-', dir=base.resolve(strict=True)))
            env = os.environ.copy()
            env.pop('TAURI_WEBVIEW_AUTOMATION', None)
            env.update(XDG_DATA_HOME=str(root / 'data'), XDG_CONFIG_HOME=str(root / 'config'),
                       XDG_CACHE_HOME=str(root / 'cache'), GSETTINGS_BACKEND='memory')
            assert hashlib.sha256(binary.read_bytes()).hexdigest() == digest
            record = {'artifacts': str(root), 'repetition': repetition, 'binarySha256': digest,
                      'filesystem': subprocess.check_output(['stat', '-f', '-c', '%T', str(root)], text=True).strip(),
                      'automation': False, 'phases': [], 'error': None}
            def phase(name):
                record['phases'].append({'name': name, 'wallTime': time.time()})
                log.write('HARNESS plain quit ' + name + '\n'); log.flush()
            with (root / 'native.log').open('w') as log:
                app = subprocess.Popen([str(binary)], env=env, stdout=log, stderr=log)
                try:
                    clients = wait(lambda: [c for c in json.loads(subprocess.check_output(['hyprctl', '-j', 'clients']))
                                            if c['pid'] == app.pid and c.get('class') == 'babel-desktop'])
                    assert len(clients) == 1
                    address = clients[0]['address']
                    assert re.fullmatch(r'0x[0-9a-f]+', address)
                    wait(lambda: any(p['name'] == 'WebKitWebProces' and p['parent'] == app.pid for p in processes().values()))
                    # Cold-window control; no claim of a completed drafting workload.
                    time.sleep(1)
                    inventory = processes()
                    owned = {app.pid}
                    while True:
                        children = {pid for pid, p in inventory.items() if p['parent'] in owned}
                        if children <= owned:
                            break
                        owned |= children
                    record['processes'] = [inventory[pid] for pid in sorted(owned)]
                    phase('ordinary-window-close-request')
                    subprocess.run(['hyprctl', 'dispatch',
                        'hl.dsp.window.close({ window = "address:' + address + '" })'],
                        check=True, stdout=subprocess.DEVNULL)
                    record['appExitCode'] = app.wait(timeout=30)
                    def exited():
                        current = processes()
                        return all(pid not in current or current[pid]['start'] != inventory[pid]['start']
                                   or current[pid]['state'] == 'Z' for pid in owned)
                    wait(exited)
                    phase('owned-processes-exited')
                except Exception as error:
                    record['error'] = str(error)
                finally:
                    if app.poll() is None:
                        phase('failed-probe-forced-cleanup')
                        app.kill(); app.wait()
            record['runtimeCrashLines'] = [line for line in (root / 'native.log').read_text(errors='replace').splitlines()
                if re.search(r'corrupted|double free|SIGABRT|segmentation fault|core dumped', line, re.I)]
            reports.append(record)
            (args.output / 'results.json').write_text(json.dumps(reports, indent=2) + '\n')
            print(json.dumps(record), flush=True)
    return int(any(r['error'] or r.get('appExitCode') != 0 or r['runtimeCrashLines'] for r in reports))


if __name__ == '__main__':
    raise SystemExit(main())
