"""M6-02 default release path loss; disposable files, real UI and exact bytes.

Parent rename simulates an unavailable drive path; it is not mount removal.
"""
import json
import subprocess


def two_instances(d, *, shared_data=False):
    target = d.ROOT / 'files' / 'two-instances.fountain'
    original = b'!One writer.\r\n'
    target.write_bytes(original)
    d.click('Open Fountain', actions=True); d.picker(target)
    d.wait(lambda: d.script("return document.querySelector('#writing-save')?.disabled===false;"), 'First app owns writer')
    d.click('Save', actions=True); d.audit(target, original)
    d.wait(lambda: d.script("return document.querySelector('#writing-save')?.disabled===false;"), 'First app idle')
    names = ['ROOT', 'PORT', 'DRIVER', 'SESSION', 'SESSION_STARTED']
    primary = {name: getattr(d, name) for name in names}
    secondary_root = d.ROOT / 'second-instance'
    secondary_root.mkdir(mode=0o700)
    # ExitObserver reads the active profile's log path. Both owned drivers
    # write one tracked log, so expose that same inode in the secondary root.
    (secondary_root / 'webdriver.log').hardlink_to(primary['ROOT'] / 'webdriver.log')
    env = dict(d.ENV)
    env.update(XDG_DATA_HOME=str(primary['ROOT'] / 'data' if shared_data else secondary_root / 'data'), XDG_CONFIG_HOME=str(secondary_root / 'config'), XDG_CACHE_HOME=str(secondary_root / 'cache'))
    d.DRIVER_LOG.flush()
    driver = subprocess.Popen(['WebKitWebDriver', '--port=4448'], env=env, stdout=d.DRIVER_LOG, stderr=d.DRIVER_LOG)
    d.ROOT, d.PORT, d.DRIVER, d.SESSION, d.SESSION_STARTED = secondary_root, 4448, driver, None, None
    try:
        d.wait(lambda: d.request('GET', '/status'), 'Second owned driver starts')
        d.new_session()
        d.click('Open Fountain', actions=True); d.picker(target)
        d.wait(lambda: d.script("return !!document.querySelector('.ProseMirror');"), 'Second native editor mounted')
        facts = d.script("return {readOnly:document.querySelector('.ProseMirror')?.getAttribute('aria-readonly'),editable:document.querySelector('.ProseMirror')?.contentEditable,saveDisabled:document.querySelector('#writing-save')?.disabled,protection:document.querySelector('section[aria-label=\"Protection status\"]')?.innerText,alerts:[...document.querySelectorAll('[role=alert]')].map(e=>e.innerText)};")
        facts['sharedPersistenceRoot'] = shared_data
        (secondary_root / 'ownership.json').write_text(json.dumps(facts, indent=2) + '\n')
        print('SECOND APP OWNERSHIP', json.dumps(facts), flush=True)
        d.wait(lambda: d.script("return document.querySelector('.ProseMirror')?.getAttribute('aria-readonly')==='true';"), 'Second native app is read-only')
        assert d.script("return document.querySelector('#writing-save')?.disabled;") is True
        d.type_text('Forbidden edit.')
        assert d.editor_text() == 'One writer.'
        d.audit(target, original)
        d.close_session(); d.release_session()
    except Exception:
        if d.SESSION:
            try:
                d.screenshot('second-instance-failure')
                (secondary_root / 'failure-ui.txt').write_text(d.body())
            except (RuntimeError, OSError):
                pass
        raise
    finally:
        if d.SESSION:
            # Failed secondary setup never earns ordinary-close credit. The
            # enclosing process/journal audit also owns this fallback's risks.
            d.DRIVER_LOG.write('HARNESS failed second-instance forced teardown begins\n')
            d.DRIVER_LOG.flush()
            try:
                d.command('DELETE', '')
            except RuntimeError:
                pass
        driver.terminate(); driver.wait(timeout=10)
        for name, value in primary.items():
            setattr(d, name, value)
    d.editor_home(); d.type_text('Still owned.')
    d.click('Save', actions=True)
    expected = b'!Still owned.One writer.\r\n'
    d.audit(target, expected); d.close_session(); d.audit(target, expected)
    print('PASS two real native apps / second read-only and no edit / normal close / first writer retained and saved', flush=True)
    print('ARTIFACTS', d.ROOT, flush=True)


def run(d):
    reports = []

    def ready():
        d.wait(lambda: d.script("return document.querySelector('#writing-save')?.disabled===false;"), 'Writable session ready')

    for case in ['deleted', 'renamed', 'parent-unavailable']:
        known_documents = {m['documentId'] for m, _ in d.journal_records()}
        parent = d.ROOT / 'files' / case
        parent.mkdir(mode=0o700)
        target = parent / 'source.fountain'
        original = b'!Original path-loss source.\r\n'
        live = b'!Live.Original path-loss source.\r\n'
        target.write_bytes(original)
        d.click('Open Fountain', actions=True); d.picker(target); ready()
        d.click('Save', actions=True); d.audit(target, original); ready()
        baseline = d.wait(lambda: next((m for m, s in d.journal_records() if s == original and m['documentId'] not in known_documents), None), 'Exact new document checkpoint identity')
        # Remove the selected path before input, so autosave cannot race the
        # test's independent original-generation oracle.
        retained = None
        if case == 'deleted':
            target.unlink()
        elif case == 'renamed':
            retained = parent / 'moved.fountain'
            target.rename(retained)
        else:
            moved = d.ROOT / 'files' / 'removed-drive-simulation'
            parent.rename(moved)
            retained = moved / target.name
        d.editor_home(); d.type_text('Live.')
        head = d.wait(lambda: next((m for m, s in d.journal_records() if s == live and m['documentId'] == baseline['documentId']), None), 'Exact path-loss recovery acknowledged')
        ready(); d.click('Save', actions=True)
        d.wait(lambda: 'Save failed' in d.body() or 'External change detected' in d.body(), 'Path loss visibly refuses source save')
        assert not target.exists(), 'Save recreated the unavailable source path'
        if retained:
            d.audit(retained, original)
        assert d.editor_text() == 'Live.Original path-loss source.'
        if case == 'deleted':
            d.click('Close session', actions=True); d.click('Retry save and close')
            d.wait(lambda: 'Close stopped.' in d.body(), 'Path-loss close retry remains stopped')
            d.click('Select copy destination', actions=True); d.picker(d.ROOT / 'copies')
            d.wait(lambda: d.script("return [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save Emergency Copy and close')?.disabled===false;"), 'Emergency destination selected')
            d.click('Save Emergency Copy and close')
            d.wait(lambda: 'Start writing' in d.body(), 'Exact emergency copy permits close')
            copies = [p for p in (d.ROOT / 'copies').iterdir() if p.is_file() and p.read_bytes() == live]
            assert len(copies) == 1, copies
            d.audit(copies[0], live)
        else:
            copy = d.ROOT / 'copies' / (case + '.fountain')
            d.click('Save As', actions=True); d.picker(copy); d.audit(copy, live); ready()
            assert 'stands alone' not in d.body(), 'Save As adoption refused'
            d.editor_home(); d.type_text('Copy.')
            changed = b'!Copy.Live.Original path-loss source.\r\n'
            d.click('Save', actions=True); d.audit(copy, changed); ready()
            d.close_session(); d.audit(copy, changed); d.audit(retained, original)
        assert not target.exists()
        assert any(m['documentId'] == head['documentId'] and s == live for m, s in d.journal_records())
        reports.append({'case': case, 'acknowledgedVersion': head['version'], 'documentId': head['documentId'], 'driveRemoval': 'parent rename simulation' if case == 'parent-unavailable' else None})
    (d.ROOT / 'persistence-paths.json').write_text(json.dumps(reports, indent=2) + '\n')
    print('PASS native missing/renamed/unavailable-parent path / refusal / recovery / emergency close / Save As adoption and later edit', flush=True)
    print('ARTIFACTS', d.ROOT, flush=True)
