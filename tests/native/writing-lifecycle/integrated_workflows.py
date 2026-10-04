"""M4-15 continuous default-app session, independent literal byte/mark oracles.
Only production controls, DOM selection and trusted WebDriver keys are used.
"""
import hashlib
import json
import subprocess


def run(d):
    checks = []
    source = ('\ufeffTitle: Night signal\r\nX-Private: retain  \r\n\r\n'
              '# Act One\r\n.INT. LAB - DAY\r\n!A **moon** above café. 🚀\r\n!**mo**on stays.\r\n'
              '[[moon note]]\r\n/* moon omitted */\r\n\r\n'
              '@ÉVA\r\nHello there.\r\n\r\n.EXT. HILL - NIGHT\r\n'
              '!The moon rises.\r\n\r\n# Act Two\r\n.INT. HOME - NIGHT\r\n'
              '@ALICE\r\n(quietly)\r\n').encode()
    target = d.ROOT / 'files' / 'daily-session.fountain'
    target.write_bytes(source)
    expected = source
    original_click = d.click

    def click(label, actions=False):
        prefix = "//div[@aria-label='Screenplay actions']" if actions else ''
        e = d.find(prefix + '//button[normalize-space(.)=' + json.dumps(label) + ']')
        d.script("arguments[0].scrollIntoView({block:'center'});", [{d.ELEMENT: e}])
        original_click(label, actions)
    d.click = click

    def activate(e):
        d.script("arguments[0].scrollIntoView({block:'center'});", [{d.ELEMENT: e}])
        d.command('POST', '/element/' + e + '/click', {})

    def ready():
        d.wait(lambda: d.script("return document.querySelector('#writing-save')?.disabled===false && !!document.querySelector('.outline-target:not(:disabled)');"), 'Current integrated session', timeout=60)

    def save():
        ready(); click('Save', True); d.audit(target, expected)
        d.wait(lambda: 'Saved locally' in d.body(), 'Exact integrated Save receipt')
        d.wait(lambda: any(raw == expected for _, raw in d.journal_records()), 'Matching independent checkpoint bytes')
        ready()

    def chord(key, shift=False):
        d.script("document.querySelector('.ProseMirror').focus();")
        keys = ['\ue009'] + (['\ue008'] if shift else []) + [key]
        d.command('POST', '/actions', {'actions': [{'type': 'key', 'id': 'daily-keys', 'actions':
            [{'type': 'keyDown', 'value': k} for k in keys] +
            [{'type': 'keyUp', 'value': k} for k in reversed(keys)]}]})
        ready()

    click('Open Fountain', True); d.picker(target); ready(); save()
    d.set_input('Snapshot name', 'Daily original'); click('Keep named snapshot')
    d.wait(lambda: 'Named snapshot protected' in d.body(), 'Explicit original retained snapshot')
    click('Title page', True)
    e = d.find('//button[@aria-label="Edit field 1: Title"]')
    activate(e)
    e = d.find('//section[@aria-label="Title page"]//textarea')
    d.command('POST', '/element/' + e + '/clear', {})
    d.command('POST', '/element/' + e + '/value', {'text': 'Morning signal'})
    click('Apply title input'); ready()
    expected = source.replace(b'Title: Night signal', b'Title: Morning signal')
    save(); click('Close title page')
    chord('z'); expected = source; save()
    chord('z', True); expected = source.replace(b'Title: Night signal', b'Title: Morning signal'); save()
    checks.append('title edit / immediate Save / one Undo / Redo; BOM/CRLF/unknown field retained')

    click('Find', True); d.set_input('Find text', 'moon')
    d.wait(lambda: '5 matches' in d.script("return document.querySelector('.find-panel [role=status]').textContent;"), 'Five visible/hidden matches')
    d.set_input('Replace with', 'sun')
    d.wait(lambda: '3 replaceable · 2 excluded' in d.script("return document.querySelector('.find-panel').textContent;"), 'Current three-match preview/protected omission/mixed emphasis')
    click('Replace all')
    d.wait(lambda: 'Replaced 3 matches in one step' in d.body(), 'One replace-all transaction')
    title_source = expected; expected = title_source.replace(b'moon', b'sun').replace(b'/* sun omitted */', b'/* moon omitted */'); save()
    assert d.script("return [...document.querySelectorAll('.ProseMirror strong')].map(e=>e.textContent);") == ['sun', 'mo']
    chord('z'); expected = title_source; save()
    assert d.script("return [...document.querySelectorAll('.ProseMirror strong')].map(e=>e.textContent);") == ['moon', 'mo']
    chord('z', True); expected = title_source.replace(b'moon', b'sun').replace(b'/* sun omitted */', b'/* moon omitted */'); save()
    click('Close find')
    checks.append('hidden note + visible replace-all / protected omission/mixed emphasis excluded / Save / Undo / Redo, exact marks and bytes')

    # Real dead-key commit on the transformed source, then one authored Undo.
    d.script("const p=[...document.querySelectorAll('.ProseMirror > p')].find(p=>p.textContent==='A sun above café. 🚀');p.closest('.ProseMirror').focus();getSelection().setBaseAndExtent(p.firstChild,0,p.firstChild,0);window.dailyComposition=[];for(const kind of ['compositionstart','compositionend'])p.parentElement.addEventListener(kind,e=>window.dailyComposition.push({kind,trusted:e.isTrusted}));")
    client = next(c for c in d.owned_clients() if c.get('class') == 'babel-desktop')
    address = client['address']; assert address.startswith('0x') and all(c in '0123456789abcdef' for c in address[2:])
    subprocess.run(['hyprctl', 'dispatch', 'hl.dsp.focus({ window = "address:' + address + '" })'], check=True, stdout=subprocess.DEVNULL)
    subprocess.run(['wtype', '-k', 'dead_acute', 'e'], check=True)
    before_dead = expected; expected = expected.replace(b'!A **sun**', '!éA **sun**'.encode()); save()
    chord('z'); expected = before_dead; save()
    events = d.script('return window.dailyComposition;')
    assert len(events) >= 2 and all(e['trusted'] for e in events), events
    checks.append({'actualDeadKeyCommitUndo': events})

    click('Script Check', True)
    d.wait(lambda: 'SC001' in d.body() and 'SC002' in d.body(), 'Incomplete speech warnings')
    assert 'Export assessment unavailable' in d.body() and 'SC005' in d.body() and 'SC008' in d.body()
    click('Go to issue')
    d.wait(lambda: d.script("return getSelection().toString()==='ALICE' && document.activeElement?.classList.contains('ProseMirror');"), 'Exact warning selection')
    click('Close Script Check'); save()
    checks.append('warning navigation selects ALICE; warnings preserve Save; M5 assessment unavailable')

    for label, value in [('Theme', 'dark'), ('Writing zoom', '150')]:
        e = d.find('//select[@aria-label=' + json.dumps(label) + ']/option[@value=' + json.dumps(value) + ']')
        activate(e)
    e = d.find('//label[contains(.,"Typewriter scroll")]/input')
    activate(e)
    click('Focus mode'); click('Exit focus mode')
    e = d.find('//select[@aria-label="Character focus"]/option[@value="ÉVA"]')
    activate(e)
    click('Next character cue')
    d.wait(lambda: d.script("return getSelection().focusNode?.textContent==='ÉVA';"), 'Character navigation after transformations')
    click('Spellcheck', True)
    d.wait(lambda: 'installed offline dictionaries' in d.body(), 'Offline spelling service')
    click('Close spellcheck'); save()
    d.script("[...document.querySelectorAll('.ProseMirror > p')].find(p=>p.textContent==='A sun above café. 🚀').scrollIntoView({block:'center'});")
    d.screenshot('daily-integrated')
    checks.append('theme/zoom/focus/typewriter + current character/counts/navigation/spelling retain transformed source')

    # Reopen in a new process/profile lifetime, then explicitly reconcile recovery.
    d.close_session(); d.command('DELETE', ''); d.SESSION = None; d.new_session()
    click('Open daily-session.fountain'); ready()
    d.assert_identical_reopen()
    save()
    assert d.script("return [...document.querySelectorAll('.ProseMirror strong')].map(e=>e.textContent);") == ['sun', 'mo']
    assert 'Morning signal' in d.body() and '3 scenes' in d.body() and '2 characters' in d.body()
    d.screenshot('daily-reopened'); d.close_session(); d.audit(target, expected)
    records = d.journal_records()
    assert any(raw == expected for _, raw in records)
    snapshots = d.ROOT / 'data' / 'app.babel.screenwriter' / 'snapshots'
    assert any(p.is_file() and p.read_bytes() == source for p in snapshots.rglob('*')), 'Named original source retained independently'
    checks.append('native process restart / Recent reopen / explicit recovery / exact title/marks/counts/source; named original retained')
    report = {'initialBytes': len(source), 'initialSha256': hashlib.sha256(source).hexdigest(),
              'finalBytes': len(expected), 'finalSha256': hashlib.sha256(expected).hexdigest(), 'checks': checks}
    (d.ROOT / 'daily-result.json').write_text(json.dumps(report, indent=2) + '\n')
    print('M4-15 CONTINUOUS SESSION PASSED', d.ROOT, json.dumps(report), flush=True)
