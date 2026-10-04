"""Default-app presentation subset through AT-SPI/physical input, no WebDriver.

Same frozen manuscripts and source/Undo/Save As protection. This is a diagnostic
control, not the full presentation geometry/completion/IME acceptance scenario.
Only disposable files and owned application windows are operated on.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import sys
import threading
import time
import traceback

from audit_retained import frames
from audit_shutdown import ORACLES
from owned_accessibility import Accessibility
from process_watch import ProcessWatch, journal_scan
from shutdown_lifecycle import processes
from shutdown_observer import ExitObserver


def wait(check, message, timeout=45):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = check()
        if result:
            return result
        time.sleep(.1)
    raise AssertionError(message)


def fixture(scenes):
    text = '\ufeffTitle: Synthetic presentation\r\n\r\n# Act\r\n' + ''.join(
        f'.INT. ROOM {i} - DAY\r\n!Zoë reads the sign.  \r\n!A lamp flickers.\r\n\r\n@MAYA\r\nThe door is open.\r\nCome inside.\r\nWe have time.\r\n\r\n@NOAH\r\nI saw the signal.\r\nWe should leave.\r\nWait here.\r\n\r\n!They cross in silence.\r\n!A bell rings.\r\n!A long line ' + 'wraps across the screen with Unicode é🚀. ' * 8 + '\r\n!Tail.\r\n'
        for i in range(scenes))
    return text.encode()


def picker(a, path, title):
    wait(lambda: any(c.get('title') == title for c in a.clients()), 'Owned picker appears')
    a.focus_window(title)
    for key in ['l', 'a']:
        a.assert_focus()
        subprocess.run(['/tmp/babel-m3-08-keyboard', key], check=True)
        time.sleep(.15)
    a.keys('-d', '2', str(path))
    a.assert_focus()
    subprocess.run(['/tmp/babel-m3-08-keyboard', 'return'], check=True)
    wait(lambda: not any(c.get('title') == title for c in a.clients()), 'Owned picker closes once')


def audit(path, expected):
    wait(lambda: path.exists() and path.read_bytes() == expected, 'Exact bytes at ' + str(path))
    return {'path': str(path), 'bytes': len(expected), 'sha256': hashlib.sha256(expected).hexdigest()}


def workload(a, root, names):
    report = []
    assert a.choose('Theme', 2, 'Dark') == 'Dark'
    for name in names:
        source = fixture(150 if name == 'typical' else 1500)
        length, digest, _ = ORACLES[name]
        assert len(source) == length and hashlib.sha256(source).hexdigest() == digest
        path = root / 'files' / ('presentation-' + name + '.fountain')
        copy = root / 'copies' / path.name
        path.write_bytes(source)
        print('OPEN', name, flush=True)
        a.act('Open Fountain'); picker(a, path, 'Open Fountain screenplay')
        editor = a.find('Screenplay text', 79, timeout=90)
        a.act('Save'); audit(path, source)
        for index, label in [(0, '75%'), (7, '200%'), (5, '150%')]:
            assert a.choose('Writing zoom', index, label) == label
        assert a.choose('Theme', 1, 'Light') == 'Light'
        a.act('Focus mode', 62)
        toggle = a.find('Typewriter scroll', 7)
        if not a.call(toggle['bus'], toggle['path'], 'Accessible', 'GetState')[0][0] & (1 << 4):
            a.act('Typewriter scroll', 7)
        a.focus_window(); a.focus(editor)
        # AT-SPI positions the caret in exposed text; wtype supplies real input.
        # This avoids assuming visual Down keys correspond to logical rows.
        exposed = a.call(editor['bus'], editor['path'], 'Text', 'GetText', 'ii', '0', '180')[0]
        offset = exposed.index('Zoë reads the sign.')
        a.validate(editor)
        assert a.call(editor['bus'], editor['path'], 'Text', 'SetCaretOffset', 'i', str(offset)) == [True]
        a.keys('X'); a.act('Save')
        audit(path, source.replace('!Zoë reads'.encode(), '!XZoë reads'.encode(), 1))
        a.focus_window(); a.focus(editor); a.keys('-M', 'ctrl', '-k', 'z', '-m', 'ctrl')
        a.act('Save'); audit(path, source)
        # Exercise long-document scrolling and render at the bottom/top.
        a.focus_window(); a.focus(editor)
        a.keys('-M', 'ctrl', '-k', 'End', '-m', 'ctrl'); time.sleep(.2)
        a.keys('-M', 'ctrl', '-k', 'Home', '-m', 'ctrl')
        a.act('Exit focus mode', 62)
        a.act('Save As'); picker(a, copy, 'Save screenplay as'); audit(copy, source)
        # A fresh edit must target the adopted copy, not the retained original.
        adopted = a.find('Screenplay text', 79)
        a.focus_window(); a.focus(adopted)
        exposed = a.call(adopted['bus'], adopted['path'], 'Text', 'GetText', 'ii', '0', '180')[0]
        offset = exposed.index('Zoë reads the sign.')
        a.validate(adopted)
        assert a.call(adopted['bus'], adopted['path'], 'Text', 'SetCaretOffset', 'i', str(offset)) == [True]
        a.keys('Y'); a.act('Save')
        audit(copy, source.replace('!Zoë reads'.encode(), '!YZoë reads'.encode(), 1))
        audit(path, source)
        a.focus_window(); a.focus(adopted); a.keys('-M', 'ctrl', '-k', 'z', '-m', 'ctrl')
        a.act('Save'); audit(copy, source); audit(path, source)
        assert a.choose('Theme', 2, 'Dark') == 'Dark'
        assert a.choose('Writing zoom', 2, '100%') == '100%'
        a.act('Close session')
        a.find('Start writing', 83)
        report.append({'workload': name, 'source': audit(path, source), 'copy': audit(copy, source)})
        print('WORKLOAD COMPLETE', name, flush=True)
    # Native confirmed/recovery frame checks are independent of UI reports.
    for item in report:
        digest = item['source']['sha256']
        for paths in [(root / 'data/app.babel.screenwriter/recovery').glob('*.journal'),
                      (root / 'data/app.babel.screenwriter/source-save').glob('*/confirmed')]:
            assert any(any(f['sha256'] == digest and f['bytes'] == item['source']['bytes']
                           for f in frames(p)) for p in paths), ('Checkpoint absent', item)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('roots', nargs='+', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--repeats', type=int, default=2)
    parser.add_argument('--workloads', nargs='+', choices=['typical', 'stress'], default=['typical', 'stress'])
    args = parser.parse_args()
    assert args.repeats > 0
    args.output.mkdir(parents=True, exist_ok=False)
    binary = Path(os.environ.get('BABEL_NATIVE_BINARY', str(Path(__file__).resolve().parents[3] / 'target/release/babel-desktop'))).resolve(strict=True)
    digest = hashlib.sha256(binary.read_bytes()).hexdigest()
    tooling = [Path(__file__), *[Path(__file__).with_name(n + '.py') for n in
               ['owned_accessibility', 'process_watch', 'shutdown_lifecycle', 'shutdown_observer', 'audit_retained', 'audit_shutdown']]]
    hashes = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in tooling}
    reports = []
    for base in args.roots:
        for repetition in range(args.repeats):
            root = Path(tempfile.mkdtemp(prefix='babel-plain-presentation-', dir=base.resolve(strict=True)))
            for folder in ['files', 'copies']:
                (root / folder).mkdir(mode=0o700)
            env = os.environ.copy(); env.pop('TAURI_WEBVIEW_AUTOMATION', None)
            env.update(XDG_DATA_HOME=str(root / 'data'), XDG_CONFIG_HOME=str(root / 'config'),
                       XDG_CACHE_HOME=str(root / 'cache'), GSETTINGS_BACKEND='memory')
            assert hashlib.sha256(binary.read_bytes()).hexdigest() == digest
            report = {'root': str(root), 'binary': str(binary), 'sha256': digest,
                      'filesystem': subprocess.check_output(['stat', '-f', '-c', '%T', str(root)], text=True).strip(),
                      'started': time.time(), 'automation': False, 'input': 'AT-SPI and wtype',
                      'automationScope': 'No WebDriver; OS accessibility/keyboard automation retained',
                      'command': sys.argv, 'toolingHashes': hashes,
                      'workloads': args.workloads, 'repetition': repetition, 'error': None,
                      'omissions': ['IME', 'completion popup', 'Find', 'external divergence',
                                    'geometry assertions', 'preference restart']}
            stop = threading.Event(); watch_errors = []
            with (root / 'native.log').open('w') as log:
                app = subprocess.Popen([str(binary)], env=env, stdout=log, stderr=log)
                watch = ProcessWatch(app.pid, root / 'processes.json')
                def observe():
                    try:
                        while not stop.wait(.05):
                            watch.sample()
                    except Exception:
                        watch_errors.append(traceback.format_exc())
                observer = threading.Thread(target=observe, daemon=True); observer.start()
                a = None
                try:
                    a = Accessibility(app.pid)
                    environment = (Path('/proc') / str(app.pid) / 'environ').read_bytes().split(b'\0')
                    assert not any(e.startswith(b'TAURI_WEBVIEW_AUTOMATION=') for e in environment)
                    report['automationEnvironmentAbsent'] = True
                    a.find('Open Fountain', 43)
                    report['checks'] = workload(a, root, args.workloads)
                    report['workloadCompleted'] = True
                    client = a.focus_window()
                    report['closeRequested'] = time.time()
                    with ExitObserver(list(watch.records.values()), root / 'native.log', root / 'shutdown-observations.json'):
                        subprocess.run(['hyprctl', 'dispatch', 'hl.dsp.window.close({ window = "address:' + client['address'] + '" })'], check=True, stdout=subprocess.DEVNULL)
                        app.wait(timeout=30)
                        def gone():
                            current = processes()
                            return all(p['pid'] not in current or current[p['pid']]['start'] != p['start']
                                       or current[p['pid']]['state'] == 'Z' for p in list(watch.records.values()))
                        wait(gone, 'Owned descendants exit')
                    report['closeCompleted'] = time.time()
                except Exception:
                    report['error'] = traceback.format_exc()
                    if a:
                        (root / 'last-tree.json').write_text(json.dumps(a.last_tree, indent=2) + '\n')
                    print(report['error'], flush=True)
                finally:
                    if app.poll() is None:
                        report['failedProbeForcedCleanup'] = True
                        app.kill(); app.wait()
                    # Retain failed cases, but let their owned core-dump exits
                    # settle before starting another case's journal window.
                    deadline = time.monotonic() + 45
                    while time.monotonic() < deadline:
                        current = processes()
                        live = [p for p in list(watch.records.values()) if p['pid'] in current
                                and current[p['pid']]['start'] == p['start'] and current[p['pid']]['state'] != 'Z']
                        if not live:
                            break
                        time.sleep(.1)
                    time.sleep(3)
                    stop.set(); observer.join(timeout=5)
                    assert not observer.is_alive()
                    watch.sample(); ledger = watch.save()
            report.update(appExitCode=app.returncode, watchErrors=watch_errors, ended=time.time())
            scan = journal_scan(ledger, root / 'journal.json')
            report['journal'] = scan
            report['runtimeCrashLines'] = [line for line in (root / 'native.log').read_text(errors='replace').splitlines()
                if re.search(r'corrupted|double free|SIGABRT|segmentation fault|core dumped', line, re.I)]
            report['liveNative'] = [p for p in ledger['processes'] if 'firstMissing' not in p and p['state'] != 'Z']
            report['toolingUnchanged'] = all(hashlib.sha256(p.read_bytes()).hexdigest() == hashes[str(p)] for p in tooling)
            report['strictPassed'] = (report['toolingUnchanged'] and not report['error'] and app.returncode == 0 and not watch_errors
                and not report['runtimeCrashLines'] and scan['readPassed'] and not scan['events'] and not report['liveNative'])
            reports.append(report)
            (args.output / 'results.json').write_text(json.dumps(reports, indent=2) + '\n')
            print(json.dumps(report), flush=True)
    return int(not all(r['strictPassed'] for r in reports))


if __name__ == '__main__':
    raise SystemExit(main())
