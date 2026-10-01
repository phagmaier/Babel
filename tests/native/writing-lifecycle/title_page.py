"""M4-06 real default WebKit title form, independent literal bytes, trusted input.
Disposable files/profiles only; no editor-state or native-invoke hooks.
"""
import hashlib
import json
import subprocess
import time


def run(d):
    report=[]
    def ready():
        d.wait(lambda:d.script("return !!document.querySelector('.ProseMirror') && document.querySelector('#writing-save')?.disabled===false && !document.querySelector('.manuscript-outline button[disabled].outline-target');"),'Current writable screenplay',timeout=60)
        d.wait(lambda:'Preparing outline' not in d.body(),'Capture completes',timeout=60)
    def field_button(label):
        return d.find('//section[@aria-label="Title page"]//button[@aria-label='+json.dumps(label)+']')
    def press(element):
        d.script('arguments[0].focus();',[{d.ELEMENT:element}])
        keys([('keyDown','\ue007'),('keyUp','\ue007')])
    def keys(actions):
        d.command('POST','/actions',{'actions':[{'type':'key','id':'title-keyboard','actions':[{'type':kind,'value':value} for kind,value in actions]}]})
    def open_source(name,source):
        target=d.ROOT/'files'/(name+'.fountain');target.write_bytes(source)
        d.click('Open Fountain',actions=True);d.picker(target);ready()
        return target
    def panel():
        d.click('Title page',actions=True)
        d.wait(lambda:d.script("return !!document.querySelector('.title-page-panel');"),'Title form opens')
        d.wait(lambda:d.script("return !!document.querySelector('.title-page-panel ol');"),'Current title fields',timeout=60)
        assert d.script('return document.activeElement?.textContent;')=='Close title page'
    def edit(label='Edit field 1: Title'):
        d.wait(lambda:not d.command('GET',f'/element/{field_button(label)}/property/disabled'),'Field edit enabled',timeout=60)
        press(field_button(label))
        d.wait(lambda:d.script("return document.activeElement?.closest('label')?.textContent==='Field key';"),'Keyboard field focus')
    def fill(value):
        element=d.find('//section[@aria-label="Title page"]//textarea')
        d.command('POST',f'/element/{element}/click',{})
        keys([('keyDown','\ue009'),('keyDown','a'),('keyUp','a'),('keyUp','\ue009')])
        keys([('keyDown','\ue003'),('keyUp','\ue003')])
        for i,line in enumerate(value.split('\n')):
            if i: keys([('keyDown','\ue007'),('keyUp','\ue007')])
            if line: d.command('POST',f'/element/{element}/value',{'text':line})
        d.wait(lambda:d.command('GET',f'/element/{element}/property/value')==value,
               'Trusted title text delivered through native input method')
    def apply():
        d.click('Apply title input')
        d.wait(lambda:d.script("return !document.querySelector('.title-page-panel textarea');"),'Title edit applied',timeout=60)
        ready()
    def save(target,expected):
        d.click('Save',actions=True);d.audit(target,expected)
        d.wait(lambda:'Saved locally' in d.body(),'Current Save receipt',timeout=60)
        ready()
        report.append({'path':str(target),'bytes':len(expected),'sha256':hashlib.sha256(expected).hexdigest()})
    def undo():
        d.type_text('\ue009z\ue000');ready()
    def reopen(target,expected):
        d.close_session();d.click('Open Fountain',actions=True);d.picker(target)
        d.wait(lambda:'Recovery choice' in d.body(),'Reopen recovery comparison',timeout=60)
        d.wait(lambda:d.script("return [...document.querySelectorAll('button')].some(b=>b.textContent==='Keep Current File'&&!b.disabled);"),'Reviewed Keep enabled',timeout=60)
        d.click('Keep Current File')
        d.wait(lambda:'The current file was kept.' in d.body(),'Keep current file review',timeout=60)
        if 'A confirmed replacement matches the file' in d.body():
            d.click('Resolve Interrupted Save')
            d.wait(lambda:'An interrupted save was confirmed' in d.body() or 'No interrupted' in d.body(),'Confirmed-save reconciliation',timeout=60)
        ready();d.audit(target,expected)
    def owned_focus():
        clients=[c for c in d.owned_clients() if c.get('class')=='babel-desktop']
        assert len(clients)==1
        address=clients[0]['address']
        assert address.startswith('0x') and all(c in '0123456789abcdef' for c in address[2:])
        subprocess.run(['hyprctl','dispatch','hl.dsp.focus({ window = "address:'+address+'" })'],check=True,stdout=subprocess.DEVNULL)

    source='\ufeffTitle:\t**Film**\r\n\t  Subtitle\r\nAuthor: Ann\nX-Private: retain  \r\nAuthor: Bob\r\n\r\n.INT. ROOM\r\n!Body *untouched*.  '.encode()
    target=open_source('title-mixed',source);panel();d.click('Close title page')
    d.wait(lambda:d.script("return document.activeElement?.id==='writing-title';"),'Close title form restores toolbar focus')
    save(target,source)
    panel();edit();fill('**New**\nSecond\nThird')
    assert 'Uncommitted title input' in d.body()
    d.click('Save',actions=True);d.click('Home',actions=True)
    assert 'Close document safely' not in d.body() and target.read_bytes()==source
    # Escape refuses dirty panel close; native form shortcuts remain local.
    textarea=d.find('//section[@aria-label="Title page"]//textarea')
    d.script('arguments[0].focus();',[{d.ELEMENT:textarea}])
    keys([('keyDown','\ue00c'),('keyUp','\ue00c')])
    assert d.script("return !!document.querySelector('.title-page-panel textarea');")
    keys([('keyDown','\ue009'),('keyDown','o'),('keyUp','o'),('keyUp','\ue009')])
    assert 'Close document safely' not in d.body()
    d.screenshot('title-uncommitted-block')
    apply();edited=source.replace(b'**Film**\r\n\t  Subtitle\r\n',b'**New**\r\n\t  Second\r\n    Third\r\n')
    save(target,edited);assert any(raw==edited for _,raw in d.journal_records())
    undo();save(target,source)
    # Explicit reorder, duplicate-specific removal, empty add, and key editing.
    press(field_button('Move field 3: X-Private up'));ready()
    reordered=source.replace(b'Author: Ann\nX-Private: retain  \r\n',b'X-Private: retain  \r\nAuthor: Ann\n')
    save(target,reordered);undo();save(target,source)
    press(field_button('Remove field 3: X-Private'));ready();save(target,source.replace(b'X-Private: retain  \r\n',b''));undo();save(target,source)
    d.click('Add field');d.set_input('Field key','Contact');apply()
    added=source.replace(b'Author: Bob\r\n\r\n',b'Author: Bob\r\nContact: \r\n\r\n');save(target,added);undo();save(target,source)
    edit();fill('Invalid\n');d.click('Apply title input')
    d.wait(lambda:d.script("return !!document.querySelector('.title-page-panel [role=alert]');"),'Unrepresentable continuation visibly refused')
    assert target.read_bytes()==source and d.script("return document.querySelector('.title-page-panel textarea').value;")=='Invalid\n'
    d.click('Discard title input');d.click('Close title page');save(target,source)
    # Native real pinyin composition commits and cancels in the form, not editor.
    panel();edit();fill('IME ')
    d.script("window.titleIme=[];for(const kind of ['compositionstart','compositionend','input']) document.querySelector('.title-page-panel').addEventListener(kind,e=>window.titleIme.push({kind,trusted:e.isTrusted,data:e.data}));")
    previous=subprocess.check_output(['fcitx5-remote','-n'],text=True).strip()
    try:
        owned_focus();subprocess.run(['fcitx5-remote','-s','pinyin'],check=True);time.sleep(.5)
        subprocess.run(['wtype','-d','80','nihao'],check=True);time.sleep(.6)
        assert d.script("return !!document.querySelector('.title-page-panel textarea');")
        subprocess.run(['wtype','-k','space'],check=True);time.sleep(.5)
        assert d.script("return document.querySelector('.title-page-panel textarea').value;")=='IME 你好'
        apply();ime_source=source.replace(b'**Film**\r\n\t  Subtitle\r\n', 'IME 你好\r\n'.encode())
        save(target,ime_source);undo();save(target,source)
        # Baseline form text is literal setup, then the real engine owns preedit.
        subprocess.run(['fcitx5-remote','-s','keyboard-us'],check=True);time.sleep(.5)
        edit();fill('Cancel ');owned_focus()
        subprocess.run(['fcitx5-remote','-s','pinyin'],check=True);time.sleep(.5)
        subprocess.run(['wtype','-d','80','nihao'],check=True);time.sleep(.6)
        subprocess.run(['/tmp/babel-m3-08-keyboard','escape'],check=True);time.sleep(.4)
        assert d.script("return document.querySelector('.title-page-panel textarea').value;")=='Cancel '
        d.click('Discard title input')
    finally:
        subprocess.run(['fcitx5-remote','-s',previous],check=True)
    events=d.script('return window.titleIme;')
    assert sum(e['kind'] == 'compositionstart' and e['trusted'] for e in events) >= 2, events
    assert sum(e['kind']=='compositionend' and e['trusted'] for e in events)>=2, events
    (d.ROOT/'title-ime.json').write_text(json.dumps(events,indent=2))
    # Preserve a named exact title source, restore it through native safety path.
    d.set_input('Snapshot name','Title retained');d.click('Keep named snapshot')
    d.wait(lambda:'Named snapshot protected' in d.body(),'Named title snapshot',timeout=60)
    edit();fill('Restored later');apply();changed=source.replace(b'**Film**\r\n\t  Subtitle\r\n',b'Restored later\r\n');save(target,changed)
    edit();fill('Staged across restore')
    restore=d.find('//li[contains(.,"Title retained")]//button[normalize-space(.)="Restore previous version"]')
    d.command('POST',f'/element/{restore}/click',{})
    d.wait(lambda:'Protection failed' in d.body(),'Staged title blocks restore')
    assert target.read_bytes()==changed and d.script("return document.querySelector('.title-page-panel textarea').value;")=='Staged across restore'
    d.click('Discard title input');d.command('POST',f'/element/{restore}/click',{})
    d.wait(lambda:'Restored as new version' in d.body(),'Native exact title restore',timeout=60)
    d.audit(target,source);ready();d.click('Close title page');reopen(target,source)
    panel();d.screenshot('title-reopened');d.click('Close title page');d.close_session()
    print('PASS native title no-op / edit+Undo+Save / add+remove+reorder / staged switch+restore guard / actual pinyin commit+cancel / exact restore+reopen',flush=True)

    # Native failure: divergence preserves external source and recovery of edited title.
    original=b'Title: Failure\n\n!Body.\n';target=open_source('title-failure',original);panel();edit();fill('Protected draft');apply()
    edited=b'Title: Protected draft\n\n!Body.\n';external=b'Title: External\n\n!External body.\n';target.write_bytes(external)
    d.click('Save',actions=True)
    d.wait(lambda:'External change detected' in d.body(),'External source refuses title Save',timeout=60)
    assert target.read_bytes()==external
    assert any(raw==edited for _,raw in d.journal_records())
    assert 'Protected draft' in d.editor_text()
    d.screenshot('title-source-failure');d.click('Save As',actions=True);copy=d.ROOT/'copies'/'title-rescued.fountain';d.picker(copy)
    d.wait(lambda:copy.exists(),'Save As title copy',timeout=60);d.audit(copy,edited);ready();d.click('Close title page');d.close_session()
    # Unsupported encoding keeps form inspectable but actions disabled.
    target=d.ROOT/'files'/'title-readonly.fountain';target.write_bytes(b'\xffTitle: invalid\n')
    d.click('Open Fountain',actions=True);d.picker(target)
    d.wait(lambda:'Source file: Read-only' in d.body(),'Read-only source opened',timeout=60)
    d.click('Title page',actions=True)
    assert d.script("return document.querySelector('.title-page-panel').innerText.includes('read-only') && [...document.querySelectorAll('.title-page-panel button')].find(b=>b.textContent==='Add field').disabled;")
    assert target.read_bytes()==b'\xffTitle: invalid\n'
    d.screenshot('title-readonly');d.click('Close title page')
    # Invalid UTF-8 is inspection-only and has no faithful editor capture.
    # Dispose this owned unedited test process through the runner finally path.
    (d.ROOT/'title-report.json').write_text(json.dumps(report,indent=2))
    print('PASS native title source-failure+recovery+Save As / read-only exact bytes',flush=True)
