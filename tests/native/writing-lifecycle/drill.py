"""Production release UI/IPC drill on disposable Linux files; no mocked ports.
WebKitWebDriver drives the real WebView; wtype drives the real GTK pickers.
Only descendants of this owned driver may receive compositor keyboard input.
"""
import hashlib
import importlib
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

MODES = (
    (
        ('--external-reload', 'external_reload', 'run'),
        ('--recovery-reopen', 'recovery_reopen', 'run'),
        ('--persistence-paths', 'persistence_paths', 'run'),
    ),
    (
        ('--daily-session', 'integrated_workflows', 'run'),
        ('--spellcheck', 'spellcheck_workflows', 'run'),
        ('--home', 'home_workflows', 'run'),
        ('--find-timing', 'find_workflows', 'run_timing'),
        ('--find', 'find_workflows', 'run'),
        ('--replace', 'replace_workflows', 'run'),
        ('--replace-smoke', 'replace_workflows', 'run_smoke'),
        ('--commands', 'command_workflows', 'run'),
        ('--characters', 'character_workflows', 'run'),
    ),
    (
        ('--publication-preview', 'publication_preview', 'run'),
        ('--publication-exit', 'publication_exit', 'run'),
        ('--pdf-export', 'pdf_export', 'run'),
        ('--typed-export', 'typed_export', 'run'),
        ('--empty-heading', 'empty_heading', 'run'),
        ('--script-check', 'scriptcheck_workflows', 'run'),
        ('--title-page', 'title_page', 'run'),
        ('--scene-moves', 'scene_moves', 'run'),
        ('--workflow-protection', 'workflow_protection', 'run'),
        ('--outline', 'outline_workflows', 'run'),
        ('--recents', 'recent_projects', 'run'),
    ),
    (
        ('--latency-review', 'editor_exit', 'review_latency'),
        ('--capture-review', 'editor_exit', 'review_capture'),
    ),
)


def assert_identical_reopen():
    from recovery_reopen import assert_identical_reopen as verify
    verify(sys.modules[__name__])


def dispatch_modes(modes):
    for flag, module, function in modes:
        if flag in sys.argv:
            runner = getattr(importlib.import_module(module), function)
            runner(sys.modules[__name__])
            sys.exit(0)


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
if any(mode in sys.argv for mode in ['--spellcheck', '--characters', '--commands']):
    # GTK's built-in context ID bypasses an inherited Fcitx wildcard cache.
    ENV['GTK_IM_MODULE'] = 'gtk-im-context-simple'
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
    if method == 'DELETE' and path == '':
        DRIVER_LOG.write(f'HARNESS forced WebDriver session delete {SESSION}\n')
        DRIVER_LOG.flush()
    if method == 'POST' and path.startswith('/element/') and path.rsplit('/', 1)[-1] in ['click', 'clear', 'value']:
        element_id = path.split('/')[2]
        request('POST', f'/session/{SESSION}/execute/sync', {
            'script': "const e=arguments[0];(e.tagName==='OPTION'?e.parentElement:e).scrollIntoView({block:'center'});",
            'args': [{ELEMENT: element_id}]})
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
    script("arguments[0].scrollIntoView({block:'center'});", [{ELEMENT: element}])
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


def editor_home():
    # Trusted re-entry gives WebKit an owned visible selection after toolbar
    # actions/recovery; DOM focus alone can retain the old selection offset.
    command('POST', '/element/' + editor() + '/click', {})
    command('POST', '/actions', {'actions': [{'type': 'key', 'id': 'source-home', 'actions': [
        {'type': 'keyDown', 'value': '\ue009'}, {'type': 'keyDown', 'value': '\ue011'},
        {'type': 'keyUp', 'value': '\ue011'}, {'type': 'keyUp', 'value': '\ue009'}]}]})
    wait(lambda: script("const s=getSelection(), root=document.querySelector('.ProseMirror');const p=(s.focusNode?.nodeType===1?s.focusNode:s.focusNode?.parentElement)?.closest('.ProseMirror > p');return (p===root.firstElementChild || s.focusNode===root) && s.focusOffset===0;"), 'Trusted Home caret at first row start')


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


def picker(path=None, overwrite=False):
    dialogs = {'Save screenplay as', 'Open Fountain screenplay', 'Choose destination folder', 'Export PDF'}
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
    if overwrite:
        from owned_accessibility import Accessibility
        app = next(c for c in owned_clients() if c.get('class') == 'babel-desktop')
        accessibility = Accessibility(app['pid'])
        nodes = wait(lambda: [n for n in accessibility.tree() if n['role'] == 43 and n['name'].replace('_', '') == 'Replace'], 'Owned GTK overwrite confirmation')
        assert len(nodes) == 1, nodes
        node = nodes[0]; accessibility.validate(node)
        assert accessibility.call(node['bus'], node['path'], 'Action', 'DoAction', 'i', '0') == [True]
    if not folder:
        # Every file destination needs one confirmation. A
        # compositor-title check followed by a second Return can race dialog
        # teardown and deliver authored input to the newly focused editor.
        wait(lambda: not any(c.get('title') in dialogs for c in owned_clients()),
             'Owned file picker closed after one confirmation', timeout=30)
        return
    # Folder location entry navigates before acceptance. Invoke the exact owned
    # native button; a stale/disposed target fails without authoring Return.
    if any(c.get('title') == 'Choose destination folder' for c in owned_clients()):
        from picker_accessibility import accept_folder
        accept_folder(sys.modules[__name__])
    wait(lambda: not any(c.get('title') in dialogs for c in owned_clients()),
         'Owned folder picker closed after scoped native acceptance', timeout=30)



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


def recovery_ready():
    return script("return /Recovery: journaled version [1-9][0-9]*\\./.test(document.querySelector('[aria-label=\"Protection status\"] details')?.textContent ?? '');")


def close_session():
    wait(lambda: script("return [...document.querySelectorAll('[aria-label=\"Screenplay actions\"] button')].some(b=>b.textContent==='Close session'&&!b.disabled);"), 'Adopted session ready for protected close', timeout=60)
    untitled = script("return document.querySelector('#writing-save')?.textContent === 'Protect draft' && document.querySelector('.ProseMirror')?.getAttribute('aria-readonly') !== 'true';")
    script("window.closePromptSeen=false;window.closeObserver=new MutationObserver(()=>{if(document.querySelector('#close-heading'))window.closePromptSeen=true;});window.closeObserver.observe(document.body,{childList:true,subtree:true});")
    click('Close session', actions=True)
    if untitled:
        wait(lambda: 'Close document safely' in body(), 'Untitled close choice')
        assert script("return document.activeElement?.innerText;") == 'Close and keep recovery'
        assert 'This draft has no Fountain file' in body()
        click('Close and keep recovery')
    wait(lambda: 'Start writing' in body(), 'Protected close completes')
    seen = script("window.closeObserver.disconnect();return window.closePromptSeen;")
    assert seen == untitled, 'Only untitled drafts prompt on successful close'


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
    DRIVER_LOG.write(f'HARNESS native session active {SESSION}\n')
    DRIVER_LOG.flush()
    print('SESSION', SESSION, 'ROOT', ROOT, flush=True)
    assert created['capabilities']['browserName'] == 'wry', created
    wait(lambda: 'Start writing' in body(), 'Real production app starts')
    assert script("return '__TAURI_INTERNALS__' in window && navigator.userAgent.includes('AppleWebKit');")
    assert script("return location.protocol !== 'http:' || location.host === 'tauri.localhost';")


def release_session():
    global SESSION
    mode = os.environ.get('BABEL_SHUTDOWN_MODE')
    if mode:
        from shutdown_lifecycle import release
        release(sys.modules[__name__], mode)
    else:
        command('DELETE', '')
    SESSION = None



try:
    wait(lambda: request('GET', '/status'), 'WebDriver starts')
    new_session()
    script("""window.auditBlocked=[];document.addEventListener('securitypolicyviolation',e=>window.auditBlocked.push({uri:e.blockedURI,directive:e.effectiveDirective}));
      fetch('http://localhost:5173/__babel_audit_probe').catch(()=>{});""")
    wait(lambda:script("return window.auditBlocked.some(e=>e.uri.startsWith('http://localhost:5173') && e.directive==='connect-src');"),'Release CSP blocks development-server connections')
    print('PASS native release CSP excludes the development server',flush=True)
    dispatch_modes(MODES[0])
    if '--persistence-two-instances' in sys.argv or '--persistence-two-instances-shared' in sys.argv:
        from persistence_paths import two_instances
        two_instances(sys.modules[__name__], shared_data='--persistence-two-instances-shared' in sys.argv)
        sys.exit(0)
    dispatch_modes(MODES[1])
    if '--presentation' in sys.argv:
        from presentation_workflows import run as run_presentation
        control = sys.argv[sys.argv.index('--presentation-control') + 1] if '--presentation-control' in sys.argv else 'baseline'
        run_presentation(sys.modules[__name__], restart='--presentation-no-restart' not in sys.argv, control=control)
        sys.exit(0)
    dispatch_modes(MODES[2])
    if '--audit-fixes' in sys.argv:
        from editor_exit import audit_fixes
        audit_fixes(sys.modules[__name__])
    dispatch_modes(MODES[3])
    if '--editor-exit' in sys.argv:
        from editor_exit import run
        run(sys.modules[__name__])
    from status_close import run as run_status_close
    run_status_close(sys.modules[__name__])
    click('New screenplay', actions=True)
    wait(lambda: 'Protect draft' in body(), 'New draft opens')
    type_text('Mist curls.')
    wait(lambda: editor_text() == 'Mist curls.', 'New text visible')
    click('Protect draft', actions=True)
    wait(recovery_ready, 'Exact positive draft checkpoint acknowledged in Save details')
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
    assert_identical_reopen()
    assert any(source == b'!Mist curls. More.\n' for _, source in journal_records())
    # A named snapshot protects exactly the selected version, and a restore
    # protects the newer live editor before replacing disk. Undo re-saves it.
    set_input('Snapshot name', 'First retained draft')
    click('Keep named snapshot')
    wait(lambda: 'Named snapshot protected' in body(), 'Named snapshot acknowledged')
    editor_home()
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
    assert_identical_reopen()
    (ROOT / 'files').chmod(0o500)
    editor_home()
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
    button = wait(lambda: find(f"//section[.//h2[normalize-space(.)='Recovery choice']][.//p[contains(.,'Recovery version {latest},')]]//button[normalize-space(.)='Restore recovered draft']"), "Latest recovery comparison loaded")
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
    editor_home()
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
    shutdown_error = None
    if SESSION and os.environ.get('BABEL_SHUTDOWN_MODE'):
        try:
            release_session()
        except Exception as error:
            DRIVER_LOG.write(f'HARNESS shutdown isolation failed: {error}\n')
            DRIVER_LOG.flush()
            # Keep failed normal-close attempts distinct from fallback cleanup.
            shutdown_error = error
    # Distinguish forced automation teardown from ordinary protected UI close.
    DRIVER_LOG.write('HARNESS forced WebDriver teardown begins\n')
    DRIVER_LOG.flush()
    if SESSION:
        try:
            command('DELETE', '')
        except Exception:
            pass
    DRIVER.terminate()
    DRIVER.wait(timeout=10)
    DRIVER_LOG.close()
    if shutdown_error:
        raise shutdown_error
