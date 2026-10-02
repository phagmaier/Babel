"""Installed-stack GTK/WebKit stress control, with no Babel application code.

Requires the existing desktop/Hyprland and system GTK3/WebKitGTK development
packages. Outputs are exclusive, profiles disposable, mutations owned by PID/start.
Polling and bounded journal delivery limits from ProcessWatch still apply.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import signal
import socket
import subprocess
import threading
import time
import urllib.error
import urllib.request

from process_watch import ProcessWatch, journal_scan
from shutdown_lifecycle import processes
from shutdown_observer import ExitObserver

ELEMENT = 'element-6066-11e4-a52e-4f735466cecf'
LINE = 'A synthetic line with Unicode é and 🚀. The door is open. We have time.'
CRASH = re.compile(r'corrupt|double.free|segmentation fault|SIGABRT|SIGSEGV|'
                   r'assertion.*failed|fatal|dumped core|free\(\):', re.I)


def write(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def alive(token, current):
    p = current.get(token['pid'])
    return bool(p and p['start'] == token['start'] and p['state'] != 'Z')


def signal_owned(token, sig):
    """Pin the process before rechecking start time; refuse reused PIDs."""
    try:
        fd = os.pidfd_open(token['pid'])
    except ProcessLookupError:
        return False
    try:
        if not alive(token, processes()):
            return False
        signal.pidfd_send_signal(fd, sig)
        return True
    except ProcessLookupError:
        return False
    finally:
        os.close(fd)


def installed_library_paths(paths):
    required = ('/usr/lib/libwebkit2gtk-4.1.so.', '/usr/lib/libjavascriptcoregtk-4.1.so.')
    bundle = '/usr/lib/webkit2gtk-4.1/injected-bundle/libwebkit2gtkinjectedbundle.so'
    return (all(sum(p.startswith(prefix) for p in paths) == 1 for prefix in required)
            and all(p == bundle or re.fullmatch(
                r'/usr/lib/lib(?:webkit2gtk|javascriptcoregtk)-4\.1\.so(?:\.\d+)+', p)
                for p in paths))


def strict_pass(report):
    return (report.get('workloadCompleted') is True
            and report.get('ordinaryExitCompleted') is True
            and report.get('observerPassed') is True
            and report.get('watchPassed') is True
            and report.get('installedLibrariesObserved') is True
            and report.get('driverAliveBeforeCleanup') is True
            and report.get('driverExitCode') in (0, -signal.SIGTERM)
            and report.get('hostExitMarker') is True
            and [p['name'] for p in report.get('phases', [])] == [
                'ordinary-close-request', 'owned-descendants-exited', 'driver-cleanup']
            and report.get('observedCrashes') == []
            and report.get('observerReadErrors') == []
            and report.get('survivors') == []
            and report.get('fallbackSignals') == []
            and report.get('crashLines') == []
            and report.get('journal', {}).get('readPassed') is True
            and report.get('journal', {}).get('events') == []
            and 'error' not in report)


class Driver:
    def __init__(self, port, output):
        self.port, self.output, self.session = port, output, None
        self.trace = []

    def request(self, method, path, payload=None):
        data = None if payload is None else json.dumps(payload).encode()
        entry = {'method': method, 'path': path, 'started': time.time(),
                 'payloadSha256': hashlib.sha256(data).hexdigest() if data else None}
        self.trace.append(entry)
        try:
            req = urllib.request.Request(f'http://127.0.0.1:{self.port}' + path,
                method=method, data=data, headers={'Content-Type': 'application/json'})
            # Full 27,003-row relayout can exceed 30s on the reference host.
            # Retain request spans; this is a bounded stress control, not S13.
            with urllib.request.urlopen(req, timeout=120) as response:
                return json.load(response)['value']
        except urllib.error.HTTPError as error:
            entry['error'] = error.read().decode()
            raise RuntimeError(entry['error']) from error
        finally:
            entry['ended'] = time.time()
            write(self.output, self.trace)

    def command(self, method, path, payload=None):
        return self.request(method, '/session/' + self.session + path, payload)

    def script(self, code, args=None):
        return self.command('POST', '/execute/sync', {'script': code, 'args': args or []})

    def frames(self):
        self.command('POST', '/execute/async', {'script':
            'const done=arguments[arguments.length-1];requestAnimationFrame(()=>'
            'requestAnimationFrame(()=>done(true)));', 'args': []})


def workload(d, root, rows, report, edit_text='X', undo_method='dom', composited=False,
             keep_focus=False):
    report['pages'] = []
    for count in rows:
        d.script(r"""
            document.head.innerHTML='<meta http-equiv="Content-Security-Policy" '
              +'content="default-src \'none\'; style-src \'unsafe-inline\'">'
              +'<style>body{background:#ddd}#editor{white-space:pre-wrap;'
              +'font:16px/1.5 monospace;margin:auto;width:650px;background:white;'
              +'}p{margin:0}</style>';
            document.body.innerHTML='<div id="editor" contenteditable="true"></div>';
            const e=document.getElementById('editor'), f=document.createDocumentFragment();
            for(let i=0;i<arguments[0];i++){
              const p=document.createElement('p');p.textContent=i+': '+arguments[1];f.append(p);
            }e.append(f);
            if(arguments[2])e.style.transform='translateZ(0)';
            window.editEvents=[];
            for(const type of ['keydown','keyup','beforeinput','input'])
              e.addEventListener(type,event=>window.editEvents.push({type:event.type,
                key:event.key,ctrl:event.ctrlKey,inputType:event.inputType,
                trusted:event.isTrusted,data:event.data}));
        """, [count, LINE, composited])
        d.frames()
        expected = '\n'.join(f'{i}: {LINE}' for i in range(count))
        text = d.script("return [...document.querySelectorAll('#editor p')].map(p=>p.textContent).join('\\n');")
        assert text == expected, 'Initial synthetic text mismatch'
        # Serialize all nodes through the remote element store, retaining IDs
        # past DOM removal. This is a stress control, not a Babel reference claim.
        refs = d.command('POST', '/elements', {'using': 'css selector', 'value': '#editor p'})
        assert len(refs) == count and all(ELEMENT in e for e in refs)
        write(root / f'elements-{count}.json', refs)
        d.script("const e=document.getElementById('editor');e.focus();"
                 "const s=getSelection();s.collapse(e.firstChild.firstChild,0);")
        editor = d.command('POST', '/element', {'using': 'css selector', 'value': '#editor'})[ELEMENT]
        # Native contenteditable Undo grouping is not Babel's ProseMirror
        # history contract. The default single character avoids word grouping.
        edit = {'text': edit_text, 'undoMethod': undo_method, 'beforeFirstRow': '0: ' + LINE}
        edit_path = root / f'edit-{count}.json'
        d.command('POST', '/element/' + editor + '/value', {'text': edit_text, 'value': list(edit_text)})
        edit['afterTyping'] = d.script("return document.querySelector('#editor p').textContent;")
        write(edit_path, edit)
        assert edit['afterTyping'] == edit_text + edit['beforeFirstRow'], 'Typing mismatch'
        if undo_method == 'keys':
            d.command('POST', '/actions', {'actions': [{'type': 'key', 'id': 'keyboard', 'actions': [
                {'type': 'keyDown', 'value': '\ue009'}, {'type': 'keyDown', 'value': 'z'},
                {'type': 'keyUp', 'value': 'z'}, {'type': 'keyUp', 'value': '\ue009'}]}]})
        else:
            # Explicit WebCore native editing history, no Babel history or
            # simulated source restoration. Shortcut delivery is a separate
            # diagnostic: WebDriver events did not invoke Undo on this host.
            edit['commandReturned'] = d.script("return document.execCommand('undo');")
        restored = d.script("return [...document.querySelectorAll('#editor p')].map(p=>p.textContent).join('\\n');")
        edit['afterUndoFirstRow'] = restored.split('\n', 1)[0]
        edit['afterUndoSha256'] = hashlib.sha256(restored.encode()).hexdigest()
        edit['undoPassed'] = restored == expected
        edit['events'] = d.script('return window.editEvents;')
        write(edit_path, edit)
        assert edit['undoPassed'], 'Undo mismatch; see ' + str(edit_path)
        if not keep_focus:
            d.script("document.getElementById('editor').blur();")
        geometries = []
        for step, zoom in enumerate([.75, 1.5, 2, 1] * 3):
            index = (step * 1499) % count
            geometry = d.script("""
                const e=document.getElementById('editor');e.style.fontSize=(16*arguments[0])+'px';
                document.body.style.background=arguments[2]%2?'#333':'#ddd';
                const p=e.children[arguments[1]];p.scrollIntoView({block:'center'});
                const r=p.getBoundingClientRect();return {width:r.width,height:r.height,y:r.y};
            """, [zoom, index, step])
            assert geometry['width'] > 0 and geometry['height'] > 0
            geometries.append(geometry)
            d.frames()
            if step < 4:
                png = base64.b64decode(d.command('GET', '/screenshot'))
                assert png.startswith(b'\x89PNG\r\n\x1a\n')
                (root / f'page-{count}-{step}.png').write_bytes(png)
        final_text = d.script("return [...document.querySelectorAll('#editor p')].map(p=>p.textContent).join('\\n');")
        assert final_text == expected
        report['pages'].append({'rows': count, 'textSha256': hashlib.sha256(expected.encode()).hexdigest(),
                                'finalTextSha256': hashlib.sha256(final_text.encode()).hexdigest(),
                                'retainedElements': len(refs), 'geometry': geometries, 'undoPassed': True})


def run_case(root, binary, rows, leave_editor, edit_text, undo_method, composited, keep_focus):
    started = time.monotonic()
    root.mkdir()
    env = os.environ.copy()
    env.pop('TAURI_WEBVIEW_AUTOMATION', None)
    env.pop('LD_LIBRARY_PATH', None)
    env.pop('LD_PRELOAD', None)
    env.update(XDG_CONFIG_HOME=str(root / 'config'), XDG_DATA_HOME=str(root / 'data'),
               XDG_CACHE_HOME=str(root / 'cache'), GSETTINGS_BACKEND='memory',
               GTK_IM_MODULE='gtk-im-context-simple')
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    logpath = root / 'webdriver.log'
    log = logpath.open('w')
    driver = subprocess.Popen(['WebKitWebDriver', f'--port={port}', '--host=127.0.0.1'],
                              env=env, stdout=log, stderr=log)
    try:
        watch = ProcessWatch(driver.pid, root / 'process-ledger.json')
    except Exception:
        driver.terminate()
        driver.wait(timeout=10)
        log.close()
        raise
    stop, lock = threading.Event(), threading.Lock()
    watch_errors = []

    def poll():
        try:
            while not stop.wait(.05):
                with lock:
                    watch.sample()
        except Exception as error:
            watch_errors.append(repr(error))

    thread = threading.Thread(target=poll, daemon=True)
    thread.start()

    def tokens():
        with lock:
            return [dict(p) for p in watch.records.values()]

    report = {'started': time.time(), 'rows': rows, 'leaveEditor': leave_editor, 'editText': edit_text,
              'undoMethod': undo_method,
              'composited': composited,
              'keepEditorFocus': keep_focus,
              'fallbackSignals': [], 'phases': [], 'driverCommand': driver.args}
    d = Driver(port, root / 'requests.json')

    def phase(name):
        report['phases'].append({'name': name, 'wallTime': time.time()})
        write(root / 'result.json', report)

    try:
        until = time.monotonic() + 10
        while True:
            assert driver.poll() is None, 'WebDriver exited during startup'
            try:
                d.request('GET', '/status')
                break
            except OSError:
                if time.monotonic() >= until:
                    raise
                time.sleep(.1)
        session = d.request('POST', '/session', {'capabilities': {'alwaysMatch': {
            'browserName': 'WebKitMiniHost',
            'webkitgtk:browserOptions': {'binary': str(binary), 'args': []}}}})
        d.session = session['sessionId']
        write(root / 'session.json', session)
        workload(d, root, rows, report, edit_text, undo_method, composited, keep_focus)
        if not leave_editor:
            d.script("document.body.innerHTML='<h1>Home</h1>';document.head.innerHTML='';")
            d.frames()
            assert d.script('return document.body.innerText;') == 'Home'
        report['workloadCompleted'] = True
        owned = tokens()
        current = processes()
        hosts = [p for p in owned if p['name'] == 'WebKitMiniHost' and alive(p, current)]
        assert len(hosts) == 1 and any(p['name'] == 'WebKitWebProces' and alive(p, current) for p in owned)
        host = hosts[0]
        report['hostToken'] = host
        assert Path(f'/proc/{host["pid"]}/exe').resolve() == binary
        libraries = {}
        for p in owned:
            if p['name'] not in ('WebKitMiniHost', 'WebKitWebProces') or not alive(p, current):
                continue
            maps = Path(f'/proc/{p["pid"]}/maps').read_text()
            assert alive(p, processes()), 'Library mapping process identity changed'
            (root / f'maps-{p["pid"]}.txt').write_text(maps)
            libraries[str(p['pid'])] = sorted(set(re.findall(r'/[^\n ]*lib(?:webkit2gtk|javascriptcoregtk)[^\n ]*', maps)))
        report['libraries'] = {pid: {path: sha(Path(path)) for path in paths} for pid, paths in libraries.items()}
        report['installedLibrariesObserved'] = bool(libraries) and all(
            installed_library_paths(paths) for paths in libraries.values())
        clients = json.loads(subprocess.check_output(['hyprctl', '-j', 'clients']))
        clients = [c for c in clients if c['pid'] == host['pid']]
        assert len(clients) == 1
        address = clients[0]['address']
        report['windowAddress'] = address
        assert re.fullmatch(r'0x[0-9a-f]+', address)
        assert alive(host, processes()), 'Host identity changed before close'
        with ExitObserver([p for p in owned if p['pid'] != driver.pid], logpath,
                          root / 'exit-observations.json') as observer:
            phase('ordinary-close-request')
            subprocess.run(['hyprctl', 'dispatch',
                'hl.dsp.window.close({ window = "address:' + address + '" })'],
                check=True, stdout=subprocess.DEVNULL, timeout=10)
            until = time.monotonic() + 40
            while True:
                current = processes()
                if not any(alive(p, current) for p in tokens() if p['pid'] != driver.pid):
                    break
                assert time.monotonic() < until, 'Owned descendants did not exit'
                time.sleep(.05)
            phase('owned-descendants-exited')
            report['ordinaryExitCompleted'] = True
        report['observerPassed'] = observer.report.get('observerStopped') is True and 'error' not in observer.report
    except Exception as error:
        report['error'] = repr(error)
    finally:
        if 'observer' in locals():
            observations = observer.report['observations']
            report['observedCrashes'] = [o for o in observations
                if any(p.get('coreDumping') == '1' for p in o['processes'])]
            report['observerReadErrors'] = [p for o in observations for p in o['processes']
                if 'readError' in p or p.get('identity') == 'reused']
        phase('driver-cleanup')
        if d.session:
            try:
                d.command('DELETE', '')
            except Exception as error:
                report['deleteResult'] = repr(error)  # Stale DELETE after exit is expected.
        report['driverAliveBeforeCleanup'] = driver.poll() is None
        driver.terminate()
        try:
            driver.wait(timeout=10)
        except subprocess.TimeoutExpired:
            report['fallbackSignals'].append({'pid': driver.pid, 'signal': 'SIGKILL'})
            driver.kill()
            driver.wait(timeout=5)
        report['driverExitCode'] = driver.returncode
        # Failed cases retain failure and exact fallback identities. Never kill
        # a PID that has been reused since continuous observation.
        for p in tokens():
            if alive(p, processes()):
                report['fallbackSignals'].append({'pid': p['pid'], 'start': p['start'], 'signal': 'SIGKILL'})
                signal_owned(p, signal.SIGKILL)
        time.sleep(5)
        stop.set()
        thread.join(timeout=5)
        with lock:
            watch.sample()
            ledger = watch.save()
        report['watchPassed'] = not thread.is_alive() and not watch_errors
        report['watchErrors'] = watch_errors
        report['survivors'] = [p for p in tokens() if alive(p, processes())]
        log.close()
        report['hostExitMarker'] = 'MINIMAL main-loop-exit ' in logpath.read_text()
        report['crashLines'] = [line for line in logpath.read_text().splitlines() if CRASH.search(line)]
        report['journal'] = journal_scan(ledger, root / 'crash-journal.json')
        report['ended'] = time.time()
        report['elapsedSeconds'] = round(time.monotonic() - started, 3)
        report['strictPassed'] = strict_pass(report)
        write(root / 'result.json', report)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--repeats', type=int, default=4)
    parser.add_argument('--rows', type=int, nargs='+', default=[2703, 27003])
    parser.add_argument('--leave-editor', action='store_true')
    parser.add_argument('--edit-text', default='X', help='Diagnostic typing text; default one Undo unit')
    parser.add_argument('--undo-method', choices=['dom', 'keys'], default='dom',
                        help='WebCore Undo command (default) or diagnostic WebDriver Ctrl+Z')
    parser.add_argument('--composited', action='store_true',
                        help='Force the draft translateZ(0) layer; Babel does not use this editor style')
    parser.add_argument('--keep-editor-focus', action='store_true',
                        help='Keep the native caret during presentation changes (draft control)')
    args = parser.parse_args()
    assert args.repeats > 0 and all(n > 0 for n in args.rows) and args.edit_text
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    source = Path(__file__).with_name('minimal_webkit.c')
    binary = output / 'WebKitMiniHost'
    flags = shlex.split(subprocess.check_output(['pkg-config', '--cflags', '--libs',
                                                'gtk+-3.0', 'webkit2gtk-4.1'], text=True))
    command = ['cc', '-Wall', '-Wextra', '-Werror', str(source), *flags, '-o', str(binary)]
    result = subprocess.run(command, text=True, capture_output=True)
    write(output / 'build.json', {'command': command, 'returncode': result.returncode,
                                 'stdout': result.stdout, 'stderr': result.stderr})
    result.check_returncode()
    provenance = {'binarySha256': sha(binary), 'driver': shutil.which('WebKitWebDriver'),
                  'sources': {str(p): sha(p) for p in [source, Path(__file__),
                    *[source.with_name(n) for n in ['process_watch.py', 'shutdown_lifecycle.py', 'shutdown_observer.py']]]},
                  'versions': subprocess.check_output(['pkg-config', '--modversion', 'gtk+-3.0', 'webkit2gtk-4.1'], text=True),
                  'inheritedTuning': {k: v for k, v in os.environ.items() if k.startswith(('WEBKIT_', 'JSC_', 'GDK_'))}}
    provenance['driverSha256'] = sha(Path(provenance['driver']))
    write(output / 'provenance.json', provenance)
    snapshot = output / 'source-snapshot'
    snapshot.mkdir()
    for path in provenance['sources']:
        shutil.copyfile(path, snapshot / Path(path).name)
    reports = []
    for i in range(args.repeats):
        root = output / f'case-{i + 1:02}'
        report = run_case(root, binary, args.rows, args.leave_editor, args.edit_text,
                          args.undo_method, args.composited, args.keep_editor_focus)
        reports.append({'root': str(root), **report})
        write(output / 'results.json', reports)
        print(json.dumps({'case': i + 1, 'strictPassed': report['strictPassed'],
                          'error': report.get('error'), 'crashes': report['crashLines']}), flush=True)
    unchanged = {path: sha(Path(path)) == expected for path, expected in provenance['sources'].items()}
    unchanged[str(binary)] = sha(binary) == provenance['binarySha256']
    unchanged[provenance['driver']] = sha(Path(provenance['driver'])) == provenance['driverSha256']
    write(output / 'provenance-check.json', unchanged)
    return 0 if all(unchanged.values()) and all(r['strictPassed'] for r in reports) else 1


if __name__ == '__main__':
    raise SystemExit(main())
