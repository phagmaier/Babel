"""D-02 production reopen admission; exact-byte audits remain in callers."""


def assert_identical_reopen(d):
    d.wait(lambda: d.script("return document.querySelector('.ProseMirror')?.getAttribute('contenteditable') === 'true' && document.querySelector('#writing-save')?.disabled === false;"),
           'Identical latest recovery reconciles natively before editing', timeout=60)
    assert 'Choose which draft to use before editing.' not in d.body()
    assert 'Keep saved file' not in d.body(), 'No visible ritual for identical recovery'


def run(d):
    import json
    target = d.ROOT / 'files/d02-reopen.fountain'
    original = b'!Saved draft.\r\n'
    target.write_bytes(original)
    d.click('Open Fountain', actions=True)
    d.picker(target)
    assert_identical_reopen(d)
    d.click('Save', actions=True)
    d.audit(target, original)
    d.close_session()
    d.click('Open Fountain', actions=True)
    d.picker(target)
    assert_identical_reopen(d)
    d.audit(target, original)
    # A path-bound source refusal leaves a different exact recovery generation.
    target.parent.chmod(0o500)
    d.editor_home()
    d.type_text('Recovered ')
    recovered = b'!Recovered Saved draft.\r\n'
    d.wait(lambda: any(s == recovered for _, s in d.journal_records()), 'Divergent draft durably journaled')
    d.wait(lambda: 'Save failed' in d.body() or 'External change detected' in d.body(), 'Source refusal visible')
    assert target.read_bytes() == original
    d.click('Close session', actions=True)
    d.wait(lambda: 'Close with this risk' in d.body(), 'Explicit risk close preserves divergent recovery')
    checkbox = d.find("//section[.//button[normalize-space(.)='Close with this risk']]//input[@type='checkbox']")
    d.command('POST', f'/element/{checkbox}/click', {})
    d.click('Close with this risk')
    d.wait(lambda: 'Open Fountain' in d.body(), 'Risk close returned Home')
    target.parent.chmod(0o700)
    d.click('Open Fountain', actions=True)
    d.picker(target)
    d.wait(lambda: 'Keep saved file' in d.body(), 'Plain divergent recovery choice')
    assert d.script("return document.querySelector('.ProseMirror').getAttribute('contenteditable');") == 'false'
    assert target.read_bytes() == original
    d.click('Inspect later')
    assert d.script("return document.querySelector('.ProseMirror').getAttribute('contenteditable');") == 'false'
    d.click('Title page', actions=True)
    d.wait(lambda: d.script("return [...document.querySelectorAll('.title-page-panel button')].some(b=>b.textContent.trim()==='Add field'&&b.disabled);"), 'Recovery review blocks title authorship')
    assert target.read_bytes() == original
    assert 'Import Fountain as screenplay' not in d.body()
    d.click('Close title page')
    d.click('Keep saved file')
    d.wait(lambda: 'The current file was kept.' in d.body(), 'Explicit Keep marker acknowledged')
    markers = list(d.ROOT.rglob('*.keep'))
    assert len(markers) == 1, markers
    marker = markers[0]
    decision = json.loads(marker.read_text())
    import hashlib
    assert decision['sourceSha256'] == hashlib.sha256(original).hexdigest()
    assert any(s == recovered for _, s in d.journal_records())
    d.screenshot('d02-keep')
    # Preserve the exact reviewed generation across an owned process restart.
    import os
    import signal
    import time
    apps = [c for c in d.owned_clients() if c.get('class') == 'babel-desktop']
    assert len(apps) == 1, apps
    pid = apps[0]['pid']
    from pathlib import Path
    assert Path(f'/proc/{pid}/comm').read_text().strip() == 'babel-desktop'
    retained_marker = marker.read_bytes()
    os.kill(pid, signal.SIGKILL)
    time.sleep(.4)
    try:
        d.command('DELETE', '')
    except RuntimeError:
        pass
    d.SESSION = None
    d.new_session()
    d.click('Open Fountain', actions=True)
    d.picker(target)
    assert_identical_reopen(d)
    assert marker.read_bytes() == retained_marker
    assert target.read_bytes() == original
    assert any(s == recovered for _, s in d.journal_records())
    d.editor_home()
    d.type_text('Later ')
    later = b'!Later Saved draft.\r\n'
    d.audit(target, later)
    d.type_text('\ue009z\ue000')
    d.audit(target, original)
    d.close_session()
    d.click('Open Fountain', actions=True)
    d.picker(target)
    assert_identical_reopen(d)
    d.audit(target, original)
    d.close_session()
    print('PASS D02 native identical reopen / divergent choice / Inspect later / persisted Keep restart / later Save / Undo / exact CRLF bytes', flush=True)
