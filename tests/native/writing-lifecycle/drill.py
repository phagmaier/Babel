"""Production release UI/IPC drill on disposable Linux files; no mocked ports.
WebKitWebDriver drives the real WebView; wtype drives the real GTK pickers.
Only descendants of this owned driver may receive compositor keyboard input.
"""
import hashlib
import json
import os
import signal
import struct
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

REPO = Path(__file__).resolve().parents[3]
BASE = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp').resolve()
ROOT = Path(tempfile.mkdtemp(prefix='babel-writing-', dir=BASE))
(ROOT / 'files').mkdir(mode=0o700)
(ROOT / 'copies').mkdir(mode=0o700)
PORT = 4447
ELEMENT = 'element-6066-11e4-a52e-4f735466cecf'
ENV = os.environ.copy()
ENV.update(TAURI_WEBVIEW_AUTOMATION='true', XDG_DATA_HOME=str(ROOT / 'data'),
           XDG_CONFIG_HOME=str(ROOT / 'config'), XDG_CACHE_HOME=str(ROOT / 'cache'),
           GSETTINGS_BACKEND='memory')
DRIVER_LOG = (ROOT / 'webdriver.log').open('w')
DRIVER = subprocess.Popen(['WebKitWebDriver', f'--port={PORT}'], env=ENV,
                          stdout=DRIVER_LOG, stderr=DRIVER_LOG)
SESSION = None
SESSION_STARTED = None


def request(method, path, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(f'http://127.0.0.1:{PORT}' + path, method=method,
                                 data=data, headers={'Content-Type': 'application/json'})
    try:
        return json.load(urllib.request.urlopen(req, timeout=30))['value']
    except urllib.error.HTTPError as error:
        raise RuntimeError(error.read().decode()) from error


def command(method, path, payload=None):
    return request(method, f'/session/{SESSION}' + path, payload)


def script(code, args=None):
    return command('POST', '/execute/sync', {'script': code, 'args': args or []})


def wait(check, description, timeout=15):
    until = time.monotonic() + timeout
    while time.monotonic() < until:
        try:
            result = check()
            if result:
                return result
        except (RuntimeError, ConnectionError, OSError):
            pass
        time.sleep(.1)
    raise AssertionError(description)


def body():
    return script('return document.body.innerText;')


def find(xpath):
    return command('POST', '/element', {'using': 'xpath', 'value': xpath})[ELEMENT]


def click(label, actions=False):
    prefix = "//div[@aria-label='Screenplay actions']" if actions else ''
    print('ACTION', label, flush=True)
    element = find(prefix + f"//button[normalize-space(.)={json.dumps(label)}]")
    command('POST', f'/element/{element}/click', {})


def editor():
    return find("//div[contains(concat(' ',@class,' '),' ProseMirror ')]")


def type_text(text):
    print('TYPE', repr(text), flush=True)
    script("document.querySelector('.ProseMirror').focus();")
    if text == '\ue009z\ue000':
        actions = [{'type':'keyDown','value':'\ue009'}, {'type':'keyDown','value':'z'}, {'type':'keyUp','value':'z'}, {'type':'keyUp','value':'\ue009'}]
    else:
        actions = [action for char in text for action in [{'type':'keyDown','value':char}, {'type':'keyUp','value':char}]]
    command('POST', '/actions', {'actions':[{'type':'key','id':'writing-keyboard','actions':actions}]})


def editor_text():
    return script("return document.querySelector('.ProseMirror')?.textContent;")


def owned_clients():
    # Do not target another babel window or the user's terminal/browser.
    parents = {}
    for line in subprocess.check_output(['ps', '-eo', 'pid,ppid'], text=True).splitlines()[1:]:
        pid, parent = map(int, line.split())
        parents[pid] = parent
    def owned(pid):
        seen = set()
        while pid and pid not in seen:
            if pid == DRIVER.pid:
                return True
            seen.add(pid)
            pid = parents.get(pid, 0)
        return False
    clients = json.loads(subprocess.check_output(['hyprctl', '-j', 'clients']))
    return [client for client in clients if owned(client.get('pid', 0))]


def picker(path=None):
    dialogs = {'Save screenplay as', 'Open Fountain screenplay', 'Choose destination folder'}
    clients = wait(lambda: [c for c in owned_clients() if c.get('title') in dialogs], 'Owned GTK picker appears')
    active = json.loads(subprocess.check_output(['hyprctl', '-j', 'activewindow']))
    if active.get('address') not in [c['address'] for c in clients]:
        target = clients[-1]['address']
        assert target.startswith('0x') and all(c in '0123456789abcdef' for c in target[2:])
        subprocess.run(['hyprctl', 'dispatch', 'hl.dsp.focus({ window = "address:' + target + '" })'], check=True, stdout=subprocess.DEVNULL)
    if path is None:
        subprocess.run(['/tmp/babel-m3-08-keyboard', 'escape'], check=True)
        return
    folder = clients[-1].get('title') == 'Choose destination folder'
    if folder:
        # GTK Recent disables acceptance even with a valid location entry.
        # Leave Recent before entering the explicit disposable destination.
        subprocess.run(['/tmp/babel-m3-08-keyboard', 'alt-home'], check=True)
        time.sleep(.3)
    subprocess.run(['/tmp/babel-m3-08-keyboard', 'l'], check=True)
    time.sleep(.2)
    subprocess.run(['/tmp/babel-m3-08-keyboard', 'a'], check=True)
    subprocess.run(['wtype', '-d', '3', str(path) + ('/' if folder else '')], check=True)
    subprocess.run(['/tmp/babel-m3-08-keyboard', 'return'], check=True)
    time.sleep(.4)
    # GTK folder navigation may need a second confirmation. Never deliver it
    # to the newly focused editor after an open/save dialog already closed.
    active = json.loads(subprocess.check_output(['hyprctl', '-j', 'activewindow']))
    if active.get('title') in dialogs and active.get('address') in [c['address'] for c in owned_clients()]:
        subprocess.run(['/tmp/babel-m3-08-keyboard', 'return'], check=True)


def screenshot(name):
    clients = owned_clients()
    assert clients, 'No owned window for screenshot'
    client = clients[0]
    target = client['address']
    assert target.startswith('0x') and all(c in '0123456789abcdef' for c in target[2:])
    subprocess.run(['hyprctl', 'dispatch', 'hl.dsp.focus({ window = "address:' + target + '" })'], check=True, stdout=subprocess.DEVNULL)
    time.sleep(.3)
    x, y = client['at']; width, height = client['size']
    subprocess.run(['grim', '-g', f'{x},{y} {width}x{height}', str(ROOT / f'{name}.png')], check=True)


def audit(path, expected):
    actual = wait(lambda: path.read_bytes() == expected, f'Exact file bytes: {path}')
    assert actual
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    print(json.dumps({'file': str(path), 'length': len(expected), 'sha256': digest}), flush=True)


def close_session():
    click('Close session', actions=True)
    wait(lambda: 'Close document safely' in body(), 'Close panel')
    assert script("return document.activeElement?.innerText;") == 'Retry save and close'
    click('Retry save and close')
    wait(lambda: 'Start writing' in body(), 'Protected close completes')


def set_input(label, value):
    element = find(f"//label[contains(.,{json.dumps(label)})]/input")
    command('POST', f'/element/{element}/click', {})
    command('POST', f'/element/{element}/clear', {})
    command('POST', f'/element/{element}/value', {'text': value})
    assert command('GET', f'/element/{element}/property/value') == value


def journal_records():
    records = []
    for path in (ROOT / 'data' / 'app.babel.screenwriter' / 'recovery').glob('*'):
        if path.suffix not in ['.journal', '.previous']:
            continue
        data = path.read_bytes()
        offset = 0
        while offset < len(data):
            assert data[offset:offset+8] == b'BBLREC01'
            schema, metadata_length, source_length = struct.unpack_from('<IIQ', data, offset+8)
            assert schema == 1
            end = offset + 24 + metadata_length + source_length
            assert hashlib.sha256(data[offset:end]).digest() == data[end:end+32]
            metadata = json.loads(data[offset+24:offset+24+metadata_length])
            source = data[offset+24+metadata_length:end]
            assert hashlib.sha256(source).hexdigest() == metadata['sourceSha256']
            records.append((metadata, source))
            offset = end + 32
    return records


def new_session():
    global SESSION, SESSION_STARTED
    SESSION_STARTED = time.monotonic()
    created = request('POST', '/session', {'capabilities': {'alwaysMatch': {
        'webkitgtk:browserOptions': {'binary': os.environ.get('BABEL_NATIVE_BINARY', str(REPO / 'target/release/babel-desktop')), 'args': []}}}})
    SESSION = created['sessionId']
    (ROOT / 'session.json').write_text(json.dumps(created))
    print('SESSION', SESSION, 'ROOT', ROOT, flush=True)
    assert created['capabilities']['browserName'] == 'wry', created
    wait(lambda: 'Start writing' in body(), 'Real production app starts')
    assert script("return '__TAURI_INTERNALS__' in window && navigator.userAgent.includes('AppleWebKit');")
    assert script("return location.protocol !== 'http:' || location.host === 'tauri.localhost';")



try:
    wait(lambda: request('GET', '/status'), 'WebDriver starts')
    new_session()
    script("""window.auditBlocked=[];document.addEventListener('securitypolicyviolation',e=>window.auditBlocked.push({uri:e.blockedURI,directive:e.effectiveDirective}));
      fetch('http://localhost:5173/__babel_audit_probe').catch(()=>{});""")
    wait(lambda:script("return window.auditBlocked.some(e=>e.uri.startsWith('http://localhost:5173') && e.directive==='connect-src');"),'Release CSP blocks development-server connections')
    print('PASS native release CSP excludes the development server',flush=True)
    if '--home' in sys.argv:
        from home_workflows import run as run_home
        run_home(sys.modules[__name__])
        sys.exit(0)
    if '--find' in sys.argv:
        from find_workflows import run as run_find
        run_find(sys.modules[__name__])
        sys.exit(0)
    if '--replace' in sys.argv:
        from replace_workflows import run as run_replace
        run_replace(sys.modules[__name__])
        sys.exit(0)
    if '--replace-smoke' in sys.argv:
        from replace_workflows import run_smoke as run_replace_smoke
        run_replace_smoke(sys.modules[__name__])
        sys.exit(0)
    if '--title-page' in sys.argv:
        from title_page import run as run_title
        run_title(sys.modules[__name__])
        sys.exit(0)
    if '--scene-moves' in sys.argv:
        from scene_moves import run as run_moves
        run_moves(sys.modules[__name__])
        sys.exit(0)
    if '--workflow-protection' in sys.argv:
        from workflow_protection import run as run_workflow
        run_workflow(sys.modules[__name__])
        sys.exit(0)
    if '--outline' in sys.argv:
        from outline_workflows import run as run_outline
        run_outline(sys.modules[__name__])
        sys.exit(0)
    if '--recents' in sys.argv:
        from recent_projects import run as run_recents
        run_recents(sys.modules[__name__])
        sys.exit(0)
    if '--audit-fixes' in sys.argv:
        from editor_exit import audit_fixes
        audit_fixes(sys.modules[__name__])
    if '--latency-review' in sys.argv:
        from editor_exit import review_latency
        review_latency(sys.modules[__name__])
        sys.exit(0)
    if '--capture-review' in sys.argv:
        from editor_exit import review_capture
        review_capture(sys.modules[__name__])
        sys.exit(0)
    if '--editor-exit' in sys.argv:
        from editor_exit import run
        run(sys.modules[__name__])
    click('New screenplay', actions=True)
    wait(lambda: 'Protect draft' in body(), 'New draft opens')
    type_text('Mist curls.')
    wait(lambda: editor_text() == 'Mist curls.', 'New text visible')
    click('Protect draft', actions=True)
    wait(lambda: 'Recovery: journaled version 0.' not in body(), 'Draft checkpoint acknowledged')
    screenshot('new-draft')
    click('Save As', actions=True)
    picker()
    wait(lambda: 'The native dialog was cancelled.' in body(), 'Save As cancellation')
    assert editor_text() == 'Mist curls.'
    target = ROOT / 'files' / 'script.fountain'
    click('Save As', actions=True)
    picker(target)
    audit(target, b'!Mist curls.\n')
    wait(lambda: 'Saved locally' in body(), 'Fresh identity adopted and saved')
    assert editor_text() == 'Mist curls.'
    assert any(source == b'!Mist curls.\n' and metadata['draftMetadata']['selection']['head']['utf16Offset'] == len('Mist curls.') for metadata, source in journal_records())
    screenshot('saved')
    type_text(' More.')
    audit(target, b'!Mist curls. More.\n')
    wait(lambda: 'Saved locally' in body(), 'Autosave acknowledgement visible without another click')
    close_session()
    click('Open Fountain', actions=True)
    picker(target)
    wait(lambda: editor_text() == 'Mist curls. More.', 'Native picker reopens saved text')
    screenshot('reopened')
    # Reopening older-session recovery needs an explicit content choice. Keep
    # the byte-identical current source; the monotonically higher live epoch
    # can then checkpoint without erasing any prior recovery material.
    wait(lambda: 'Both generations hold identical content.' in body(), 'Matching previous-session recovery is discoverable')
    same = find("//section[.//h2[normalize-space(.)='Recovery choice']][.//p[normalize-space(.)='Both generations hold identical content.']]//button[normalize-space(.)='Keep Current File']")
    command('POST', f'/element/{same}/click', {})
    wait(lambda: 'The current file was kept.' in body(), 'Explicit Keep Current File reconciles the old session')
    # A named snapshot protects exactly the selected version, and a restore
    # protects the newer live editor before replacing disk. Undo re-saves it.
    set_input('Snapshot name', 'First retained draft')
    click('Keep named snapshot')
    wait(lambda: 'Named snapshot protected' in body(), 'Named snapshot acknowledged')
    type_text(' Later.')
    # Open starts at the beginning of the first row.
    newer = b'! Later.Mist curls. More.\n'
    audit(target, newer)
    button = find("//li[contains(.,'First retained draft')]//button[normalize-space(.)='Restore previous version']")
    command('POST', f'/element/{button}/click', {})
    audit(target, b'!Mist curls. More.\n')
    wait(lambda: editor_text() == 'Mist curls. More.', 'Restored editor matches source')
    click('Save', actions=True)
    wait(lambda: 'Saved locally' in body(), 'Immediate Save after restore accepts the exact replacement metadata')
    audit(target, b'!Mist curls. More.\n')
    type_text('\ue009z\ue000')
    audit(target, newer)
    wait(lambda: editor_text() == ' Later.Mist curls. More.', 'Undo restores the newer live draft')
    print('PASS native named snapshot / protected restore / undo / exact bytes', flush=True)
    close_session()
    # Source failure: the directory is read-only, while source fingerprint and
    # recovery store remain intact. The normal source file is never overwritten.
    click('Open Fountain', actions=True)
    picker(target)
    wait(lambda: editor_text() == ' Later.Mist curls. More.', 'Open before recovery failure')
    wait(lambda: 'Both generations hold identical content.' in body(), 'Source/recovery comparison before fault')
    same = find("//section[.//h2[normalize-space(.)='Recovery choice']][.//p[normalize-space(.)='Both generations hold identical content.']]//button[normalize-space(.)='Keep Current File']")
    command('POST', f'/element/{same}/click', {})
    wait(lambda: 'The current file was kept.' in body(), 'Reconcile before deliberate source failure')
    (ROOT / 'files').chmod(0o500)
    type_text('Recovered ')
    recovered = b'!Recovered  Later.Mist curls. More.\n'
    wait(lambda: any(source == recovered for _, source in journal_records()), 'Latest failing draft durably journaled')
    wait(lambda: any(status in body() for status in ['Save failed', 'External change detected']), 'Source failure visible')
    assert target.read_bytes() == newer
    screenshot('save-failure')
    # Kill only this driver's own app, after independently auditing recovery.
    apps = [c for c in owned_clients() if c.get('class') == 'babel-desktop']
    assert apps
    owned_pid = apps[0]['pid']
    assert Path(f'/proc/{owned_pid}/comm').read_text().strip() == 'babel-desktop'
    os.kill(owned_pid, signal.SIGKILL)
    time.sleep(.4)
    try: command('DELETE', '')
    except RuntimeError: pass
    SESSION = None
    (ROOT / 'files').chmod(0o700)
    new_session()
    wait(lambda: 'Local recovery' in body(), 'Recovery discoverable after restart')
    click('Open Fountain', actions=True)
    picker(target)
    wait(lambda: 'Recovery choice' in body(), 'Recovery connected after native open')
    latest = max(metadata['version'] for metadata, source in journal_records() if source == recovered)
    button = wait(lambda: find(f"//section[.//h2[normalize-space(.)='Recovery choice']][.//p[contains(.,'Recovery version {latest},')]]//button[normalize-space(.)='Recover as Current']"), "Latest recovery comparison loaded")
    command('POST', f'/element/{button}/click', {})
    audit(target, recovered)
    wait(lambda: editor_text() == 'Recovered  Later.Mist curls. More.', 'Recovered bytes adopted into editor')
    screenshot('recovered')
    print('PASS native source-failure / journal audit / owned SIGKILL / restart / recovery adoption', flush=True)
    history = ROOT / 'data' / 'app.babel.screenwriter' / 'history'
    assert history.is_dir(), 'Recovery established native safety history'
    history.chmod(0o500)
    # Recovery now restores its source-bound caret metadata. Establish the
    # independent prefix oracle explicitly before the next trusted input.
    script("document.querySelector('.ProseMirror').focus();")
    command('POST','/actions',{'actions':[{'type':'key','id':'history-home','actions':[
        {'type':'keyDown','value':'\ue009'},{'type':'keyDown','value':'\ue011'},
        {'type':'keyUp','value':'\ue011'},{'type':'keyUp','value':'\ue009'}]}]})
    type_text('Despite history ')
    history_saved = b'!Despite history Recovered  Later.Mist curls. More.\n'
    audit(target, history_saved)
    wait(lambda: 'Saved locally' in body(), 'Normal saving continues with history unavailable')
    print('PASS native history-store refusal does not block normal saving', flush=True)
    # External divergence retains the external file and the live editor; the
    # persistent close panel refuses release until an emergency copy succeeds.
    outside = b'!Independent external version.\n'
    target.write_bytes(outside)
    type_text('Local ')
    diverged = b'!Despite history Local Recovered  Later.Mist curls. More.\n'
    wait(lambda: 'External change detected' in body(), 'External divergence status')
    wait(lambda: any(source == diverged for _, source in journal_records()), 'Diverged live draft retained in recovery')
    assert target.read_bytes() == outside
    click('Close session', actions=True)
    click('Retry save and close')
    wait(lambda: 'Close stopped.' in body(), 'Failed close remains visible')
    assert editor_text() == 'Despite history Local Recovered  Later.Mist curls. More.'
    click('Select copy destination', actions=True)
    picker(ROOT / 'copies')
    wait(lambda: script("return [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save Emergency Copy and close')?.disabled === false;"), 'Native emergency destination selected')
    click('Save Emergency Copy and close')
    wait(lambda: 'Start writing' in body(), 'Exact emergency copy allows close')
    copies = [path for path in (ROOT / 'copies').iterdir() if path.is_file() and path.read_bytes() == diverged]
    assert len(copies) == 1, copies
    audit(copies[0], diverged)
    assert target.read_bytes() == outside
    print('PASS native external divergence / blocked close / native emergency copy / both generations preserved', flush=True)
    print('PASS production native New / edit / Protect / Save As cancel / Save As / autosave / close / picker reopen and safety drills', flush=True)
    urls = script("return performance.getEntriesByType('resource').map(entry => entry.name);")
    assert all(url.startswith(('http://tauri.localhost/', 'https://tauri.localhost/', 'tauri://', 'http://ipc.localhost/')) for url in urls), urls
    print('PASS embedded production resources only', flush=True)
    print('ARTIFACTS', ROOT, flush=True)
except Exception:
    if SESSION:
        try:
            screenshot('failure')
            print('UI', body(), flush=True)
        except Exception:
            pass
    print('ARTIFACTS', ROOT, flush=True)
    raise
finally:
    if SESSION:
        try:
            command('DELETE', '')
        except Exception:
            pass
    DRIVER.terminate()
    DRIVER.wait(timeout=10)
    DRIVER_LOG.close()
