"""Default release Enchant commands/editor transactions; synthetic UI only.
Run inside a fresh user/network namespace with loopback enabled. No native invoke,
editor-state hooks, personal dictionary or external endpoint is used.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time

SOURCE = ('\ufeff!Zoë reads ***helllo*** beside 👩🏽‍🚀 é and שלום.  \r\n\r\n'
          '@ZORVEXIA (V.O.)\r\nZorvexia meets Quorvexia and Zøëvexia.\r\n\r\n'
          '[[helllo]]\r\n/* helllo */\r\n').encode()


def run(d):
    report = []
    devices = Path('/proc/self/net/dev').read_text()
    assert [line.split(':')[0].strip() for line in devices.splitlines()[2:]] == ['lo'], devices
    network_namespace = os.readlink('/proc/self/ns/net')
    target = d.ROOT / 'files' / 'spellcheck.fountain'; target.write_bytes(SOURCE)

    def ready():
        d.wait(lambda: d.script("return document.querySelector('#writing-save')?.disabled===false && !!document.querySelector('.ProseMirror');"), 'Writable default editor')

    def click(label):
        element = d.wait(lambda: d.find('//button[normalize-space(.)=' + json.dumps(label, ensure_ascii=False) + ' and not(@disabled)]'), 'Enabled '+label)
        d.script("arguments[0].scrollIntoView({block:'center'});", [{d.ELEMENT: element}])
        d.command('POST', '/element/' + element + '/click', {})

    def panel_text():
        return d.script("return document.querySelector('.spellcheck-panel')?.innerText;") or ''

    def toggle_enabled():
        element = d.wait(lambda: d.find('//input[@aria-label="Enable spellcheck" and not(@disabled)]'), 'Enabled toggle')
        d.script("arguments[0].scrollIntoView({block:'center'});", [{d.ELEMENT: element}])
        d.command('POST', '/element/' + element + '/click', {})

    def choose_language(value):
        element = d.wait(lambda: d.find('//select[@aria-label="Spelling language" and not(@disabled)]'), 'Enabled language')
        d.script("arguments[0].scrollIntoView({block:'center'});", [{d.ELEMENT: element}])
        option = d.find('//select[@aria-label="Spelling language"]/option[@value=' + json.dumps(value) + ']')
        d.command('POST', '/element/' + element + '/click', {})
        d.command('POST', '/element/' + option + '/click', {})

    def open_panel():
        def opened():
            if d.script("return !!document.querySelector('.spellcheck-panel');"): return True
            click('Spellcheck')
            return d.script("return !!document.querySelector('.spellcheck-panel');")
        d.wait(opened, 'Spellcheck panel available after lifecycle guard', timeout=30)
        d.wait(lambda: 'installed offline dictionaries' in panel_text(), 'Actual native language/resource status')
        assert d.script("return document.querySelector('.ProseMirror').getAttribute('spellcheck');") == 'false'

    def check():
        click('Check spelling')
        d.wait(lambda: 'possible spelling issues' in panel_text(), 'Current spelling results')

    def review(word):
        button = d.wait(lambda: d.script("return [...document.querySelectorAll('.spellcheck-panel button')].find(b=>b.textContent.startsWith('Review '+arguments[0]+' (row ')&&!b.disabled)?.textContent;", [word]), 'Review '+word)
        click(button)
        d.wait(lambda: d.script("return document.querySelector('.spellcheck-panel [aria-label=\"Spelling suggestions\"]')?.textContent.includes(arguments[0]);", [word]), 'Suggestions for '+word)
        d.wait(lambda: d.script("return [...document.querySelectorAll('.spellcheck-panel button')].some(b=>b.textContent==='Ignore this session'&&!b.disabled);"), 'Spelling request settled')

    def has_issue(word):
        return d.script("return [...document.querySelectorAll('.spellcheck-panel li button')].some(b=>b.textContent.startsWith('Review '+arguments[0]+' (row '));", [word])

    def save(expected):
        ready(); click('Save'); d.audit(target, expected)
        d.wait(lambda: 'Saved locally' in d.body(), 'Exact native save receipt'); ready()

    def select(row, offset):
        d.script("const p=document.querySelectorAll('.ProseMirror > p')[arguments[0]],root=p.closest('.ProseMirror');root.focus();const w=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);let n,left=arguments[1];while(n=w.nextNode()){if(left<=n.length){getSelection().setBaseAndExtent(n,left,n,left);return;}left-=n.length;}throw Error('Offset');", [row, offset])
        time.sleep(.3)

    def selection():
        return d.script("const s=getSelection(),p=(s.focusNode?.nodeType===1?s.focusNode:s.focusNode?.parentElement)?.closest('.ProseMirror > p');return {row:[...document.querySelectorAll('.ProseMirror > p')].indexOf(p),anchor:s.anchorOffset,head:s.focusOffset,text:s.toString()};")

    def own_focus():
        apps = [c for c in d.owned_clients() if c.get('class') == 'babel-desktop']; assert len(apps) == 1
        address = apps[0]['address']; assert address.startswith('0x') and all(c in '0123456789abcdef' for c in address[2:])
        subprocess.run(['hyprctl','dispatch','hl.dsp.focus({ window = "address:'+address+'" })'],check=True,stdout=subprocess.DEVNULL)

    def physical(action):
        own_focus(); subprocess.run(['/tmp/babel-m3-08-keyboard',action],check=True)

    def restart():
        # Restart only after the existing protected-close workflow confirms
        # the exact latest source. Crash publication belongs to native fault tests.
        d.close_session()
        d.command('DELETE',''); d.SESSION = None
        d.new_session(); d.click('Open Fountain',actions=True); d.picker(target); ready()
        d.wait(lambda: 'Both generations hold identical content.' in d.body(), 'Reopened recovery comparison settled', timeout=60)
        if 'Recovery choice' in d.body():
            assert target.read_bytes() == SOURCE
            click('Keep Current File')
            d.wait(lambda:'The current file was kept.' in d.body(),'Explicit reviewed recovery choice')
            d.wait(lambda:'Comparing recovery against' not in d.body(), 'Reopened comparisons settled', timeout=60)
            if 'A confirmed replacement matches the file' in d.body():
                click('Resolve Interrupted Save')
                d.wait(lambda:'An interrupted save was confirmed' in d.body() or 'No interrupted' in d.body(),'Confirmed-save reconciliation')
        ready(); open_panel()

    d.click('Open Fountain',actions=True); d.picker(target); ready(); save(SOURCE)
    select(0, 3); before = selection(); editor_id = d.editor()
    open_panel(); check()
    assert has_issue('helllo') and has_issue('Quorvexia') and has_issue('Zøëvexia')
    assert not has_issue('ZORVEXIA') and not has_issue('Zorvexia')
    assert d.script("return [...document.querySelectorAll('.ProseMirror .spelling-issue')].filter(n=>n.textContent==='helllo').length;") == 1
    review('helllo'); d.wait(lambda: 'Use hello' in panel_text(), 'Actual Hunspell hello suggestion')
    # Trusted keyboard activation of the explicit correction.
    button = d.find('//button[normalize-space(.)="Use hello"]')
    d.script("arguments[0].focus();", [{d.ELEMENT:button}])
    d.command('POST','/actions',{'actions':[{'type':'key','id':'spell-activate','actions':[{'type':'keyDown','value':'\ue007'},{'type':'keyUp','value':'\ue007'}]}]})
    d.wait(lambda: 'Correction applied' in panel_text(), 'Explicit keyboard correction')
    assert d.script("return document.querySelector('.ProseMirror em').textContent;") == 'hello'
    save(SOURCE.replace(b'helllo',b'hello',1)); d.type_text('\ue009z\ue000'); save(SOURCE)
    assert selection() == before, (selection(),before); assert d.editor() == editor_id
    check(); review('Quorvexia'); click('Ignore this session'); check(); assert not has_issue('Quorvexia')
    review('Zøëvexia'); click('Add to local dictionary')
    d.wait(lambda: 'Confirmed durable storage' in panel_text(), 'Durable Add receipt'); check(); assert not has_issue('Zøëvexia')
    # App-owned generations, exact UTF-8 Unicode and no native personal writes.
    app = d.ROOT / 'data' / 'app.babel.screenwriter'
    slots = [json.loads(p.read_bytes()) for p in app.glob('spellcheck-[01].json')]
    assert slots and max(slots,key=lambda g:g['generation'])['settings']['added'] == [{'language':'en_US','word':'Zøëvexia'}]
    assert not list((d.ROOT/'config').rglob('*.dic'))
    d.screenshot('spellcheck-native-source-marks'); report.append('language/suggestions/keyboard correction/exact marks/Undo/names/Ignore/Add')
    # Off persists and does not consume author-content Undo.
    toggle_enabled()
    d.wait(lambda: 'Spellcheck is Off' in panel_text(), 'Off saved'); save(SOURCE)
    # Inspect the real native popup while Off. Attribute policy must suppress
    # native Learn/suggestions, preserving ordinary local clipboard actions.
    click('Close spellcheck'); d.script("document.querySelector('.ProseMirror > p').scrollIntoView({block:'center'});"); select(0,13); own_focus()
    coords = d.script("const s=getSelection(),r=document.createRange();r.setStart(s.anchorNode,s.anchorOffset);r.setEnd(s.anchorNode,s.anchorOffset+1);const b=r.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2,w:innerWidth,h:innerHeight};")
    client = [c for c in d.owned_clients() if c.get('class') == 'babel-desktop'][0]
    monitors = json.loads(subprocess.check_output(['hyprctl','-j','monitors'])); assert len(monitors) == 1
    monitor = monitors[0]; assert monitor['x'] == monitor['y'] == 0
    x = client['at'][0] + coords['x'] * client['size'][0] / coords['w']; y = client['at'][1] + (client['size'][1] - coords['h']) + coords['y']
    subprocess.run(['/tmp/babel-m3-07-pointer',str(round(x)),str(round(y)),str(round(monitor['width']/monitor['scale'])),str(round(monitor['height']/monitor['scale'])),'right'],check=True)
    time.sleep(.3); cx,cy = client['at']; width,height = client['size']
    subprocess.run(['grim','-g',f'{cx},{cy} {width}x{height}',str(d.ROOT/'spellcheck-off-native-menu.png')],check=True)
    physical('escape'); open_panel()
    toggle_enabled()
    d.wait(lambda: 'Spelling preferences saved' in panel_text(), 'On saved')
    # Actual GTK built-in simple IME: Ctrl+Shift+U, Unicode hex, commit/cancel.
    click('Close spellcheck'); select(0,3); own_focus()
    d.script("window.spellingComposition=[];const e=document.querySelector('.ProseMirror');for(const kind of ['compositionstart','compositionend'])e.addEventListener(kind,event=>window.spellingComposition.push({kind,trusted:event.isTrusted}));")
    physical('unicode-start')
    for action in ['hex-4','hex-f','hex-6','hex-0']: physical(action)
    physical('return')
    d.wait(lambda: '你' in d.editor_text(), 'GTK simple IME commit'); d.type_text('\ue009z\ue000'); save(SOURCE)
    select(0,3); physical('unicode-start'); physical('hex-4'); physical('escape'); save(SOURCE)
    events = d.script('return window.spellingComposition;')
    assert len(events) >= 4 and all(e['trusted'] for e in events), events
    report.append({'gtkSimpleImeCommitCancelUndo':events})
    open_panel(); save(SOURCE); restart(); check()
    assert has_issue('Quorvexia') and not has_issue('Zøëvexia'); report.append('restart clears Ignore and retains local Unicode Add')
    # Missing-resource state in the default app: publish an independently
    # checksummed synthetic settings generation, then restore via visible UI.
    slots = [json.loads(p.read_bytes()) for p in app.glob('spellcheck-[01].json')]
    latest = max(slots, key=lambda g:g['generation'])
    settings = dict(latest['settings']); settings['language'] = 'zz_ZZ'
    encoded = json.dumps(settings, separators=(',', ':'), ensure_ascii=False).encode()
    generation = latest['generation'] + 1
    missing = {'schemaVersion':1, 'generation':generation, 'settings':settings, 'sha256':hashlib.sha256(encoded).hexdigest()}
    missing_path = app / f'spellcheck-{generation % 2}.json'
    missing_path.write_text(json.dumps(missing, separators=(',', ':'), ensure_ascii=False)); missing_path.chmod(0o600)
    click('Reload dictionaries'); d.wait(lambda:'No offline dictionary for zz_ZZ' in panel_text(),'Missing dictionary resource visible')
    assert d.script("return [...document.querySelectorAll('.spellcheck-panel button')].find(b=>b.textContent==='Check spelling').disabled;")
    save(SOURCE)
    choose_language('en_US-large')
    d.wait(lambda:'Effective spelling language: en_US-large (available)' in panel_text(),'Installed alternate language selected')
    check(); assert has_issue('Zøëvexia'), 'Add is scoped to en_US, even when base dictionaries alias'
    choose_language('en_US')
    d.wait(lambda:'Effective spelling language: en_US (available)' in panel_text(),'Original language restored')
    check(); assert not has_issue('Zøëvexia'); report.append('default missing-resource fallback / native language selection / vocabulary scope')
    # Fault only dictionary metadata; source and recovery remain healthy.
    review('Quorvexia'); pending = app/'spellcheck.pending'; pending.write_bytes(b'synthetic interrupted dictionary write'); pending.chmod(0o600)
    click('Add to local dictionary'); d.wait(lambda:'could not be confirmed' in panel_text(),'Add failure visible')
    save(SOURCE); assert d.editor() != ''
    click('Reload dictionaries'); d.wait(lambda:'Local dictionary needs attention' in panel_text(),'Prior valid dictionary health visible')
    assert pending.read_bytes() == b'synthetic interrupted dictionary write'; report.append('dictionary-only fault retained / prior vocabulary / Save independent')
    d.screenshot('spellcheck-dictionary-failure')
    urls = d.script("return [...new Set([...performance.getEntriesByType('resource').map(e=>e.name),...document.scripts].map(e=>typeof e==='string'?e:e.src).concat([...document.querySelectorAll('link[rel=stylesheet]')].map(e=>e.href)))].filter(Boolean);")
    assert len(urls) >= 2 and any('/assets/' in url and url.endswith('.js') for url in urls) and any('/assets/' in url and url.endswith('.css') for url in urls), urls
    assert all(url.startswith(('http://tauri.localhost/','https://tauri.localhost/','tauri://','http://ipc.localhost/')) for url in urls), urls
    # Ordinary process exit starts only after the protected document close.
    d.close_session(); d.audit(target, SOURCE)
    assert pending.read_bytes() == b'synthetic interrupted dictionary write'
    result = {'checks':report,'bytes':len(SOURCE),'sha256':hashlib.sha256(SOURCE).hexdigest(),'resources':urls,'networkNamespace':network_namespace,'networkDevices':devices}
    (d.ROOT/'spellcheck-result.json').write_text(json.dumps(result,indent=2))
    print('PASS production offline spellcheck',json.dumps(result),flush=True); print('ARTIFACTS',d.ROOT,flush=True)
