"""M4-05 default embedded WebKit moves, visible/trusted controls only.
Independent byte/selection and safety-blob oracles, disposable profile/source.
"""
import hashlib
import json
import subprocess
import time


def run(d):
    report=[]
    def ready():
        d.wait(lambda:d.script("return !!document.querySelector('.outline-target:not(:disabled)') && document.querySelector('#writing-save')?.disabled===false;"),'Move-ready current outline',timeout=60)
    def open_source(name,source):
        target=d.ROOT/'files'/(name+'.fountain');target.write_bytes(source)
        d.click('Open Fountain',actions=True);d.picker(target);ready()
        return target
    def aria_button(label):
        return d.find('//nav[@aria-label="Manuscript outline"]//button[@aria-label='+json.dumps(label)+']')
    def press(element):
        d.script('arguments[0].focus();',[{d.ELEMENT:element}])
        d.command('POST','/actions',{'actions':[{'type':'key','id':'move-enter','actions':[{'type':'keyDown','value':'\ue007'},{'type':'keyUp','value':'\ue007'}]}]})
    def preview(label):
        ready();press(aria_button(label))
        d.wait(lambda:d.script("return document.querySelector('section[aria-label=\"Move preview\"]')!==null;"),'Keyboard move preview')
    def apply():
        d.click('Apply move')
        d.wait(lambda:d.script("return !document.querySelector('section[aria-label=\"Move preview\"]');"),'Move applied',timeout=60)
        ready()
    def save(target,expected):
        d.click('Save',actions=True);d.audit(target,expected)
        d.wait(lambda:'Saved locally' in d.body(),'Exact Save receipt')
        ready()
        report.append({'path':str(target),'bytes':len(expected),'sha256':hashlib.sha256(expected).hexdigest()})
    def selection():
        return d.script("const s=getSelection();const p=(s.focusNode?.nodeType===1?s.focusNode:s.focusNode?.parentElement)?.closest('.ProseMirror > p');return {id:p?.dataset.id,offset:s.focusOffset,text:p?.textContent,anchorOffset:s.anchorOffset};")
    def undo():
        d.script("document.querySelector('.ProseMirror').focus();")
        d.command('POST','/actions',{'actions':[{'type':'key','id':'move-undo','actions':[{'type':'keyDown','value':'\ue009'},{'type':'keyDown','value':'z'},{'type':'keyUp','value':'z'},{'type':'keyUp','value':'\ue009'}]}]})
        ready()
    def reopen(target,expected):
        ready();d.close_session();d.click('Open Fountain',actions=True);d.picker(target)
        d.wait(lambda:'Recovery choice' in d.body(),'Reopened synthetic recovery comparison',timeout=60)
        d.wait(lambda:d.script("return [...document.querySelectorAll('button')].some(b=>b.textContent==='Keep Current File'&&!b.disabled);"),'Explicit reviewed Keep is available',timeout=60)
        d.audit(target,expected)
        d.click('Keep Current File')
        d.wait(lambda:'The current file was kept.' in d.body(),'Reviewed reopened source retains recovery',timeout=60)
        if 'A confirmed replacement matches the file' in d.body():
            d.click('Resolve Interrupted Save')
            d.wait(lambda:'An interrupted save was confirmed' in d.body() or 'No interrupted' in d.body(),'Explicit confirmed-save reconciliation',timeout=60)
        ready();d.audit(target,expected)
    def safety(source):
        repos=list((d.ROOT/'data'/'app.babel.screenwriter'/'history').glob('*.git'))
        hits=[]
        for repo in repos:
            refs=subprocess.check_output(['git','--git-dir='+str(repo),'for-each-ref','--format=%(refname)','refs/safety/'],text=True).splitlines()
            for ref in refs:
                raw=subprocess.check_output(['git','--git-dir='+str(repo),'show',ref+':screenplay.fountain'])
                if raw==source:hits.append((repo,ref))
        assert hits,'Exact pre-move bytes in native safety revision'
        assert any(raw==source for _,raw in d.journal_records())
        return hits

    source='\ufeffTitle: Move test\r\n\r\n# Act\r\n.INT. A #7#\r\n= Arrival\r\n!**Alpha🚀**.\r\n[[Attached note]]\r\n  \r\n.INT. B #7#\r\n!Beta.\r\n\r\n# End\r\n!Final.'.encode()
    expected='\ufeffTitle: Move test\r\n\r\n# Act\r\n.INT. B #7#\r\n!Beta.\r\n\r\n.INT. A #7#\r\n= Arrival\r\n!**Alpha🚀**.\r\n[[Attached note]]\r\n  \r\n# End\r\n!Final.'.encode()
    target=open_source('moves-small',source)
    # Observe trusted source events; set a backward Unicode/rich selection as
    # an explicit DOM setup, separately from actual move keyboard/pointer input.
    d.script("const p=document.querySelectorAll('.ProseMirror > p')[5];p.closest('.ProseMirror').focus();const n=p.querySelector('strong').firstChild;getSelection().setBaseAndExtent(n,5,n,2);window.moveEvents=[];document.addEventListener('click',e=>{if(e.target.textContent==='Apply move')window.moveEvents.push({kind:'apply',trusted:e.isTrusted});});for (const kind of ['pointerdown','pointerup']) document.addEventListener(kind,e=>{if(e.target.closest('.outline-drag')) window.moveEvents.push({kind,trusted:e.isTrusted,label:e.target.closest('.outline-drag').getAttribute('aria-label')});},true);document.addEventListener('drop',e=>window.moveEvents.push({kind:'drop',trusted:e.isTrusted,types:[...e.dataTransfer.types],custom:e.dataTransfer.getData('application/x-babel-outline-move'),plain:e.dataTransfer.getData('text/plain')}),true);document.addEventListener('dragend',e=>window.moveEvents.push({kind:'dragend',trusted:e.isTrusted,effect:e.dataTransfer.dropEffect}));document.addEventListener('mouseup',e=>window.moveEvents.push({kind:'mouseup',trusted:e.isTrusted}));document.addEventListener('dragover',e=>{window.moveEvents.push({kind:'dragover',trusted:e.isTrusted,prevented:e.defaultPrevented,effect:e.dataTransfer.dropEffect,allowed:e.dataTransfer.effectAllowed,label:e.target.closest('.outline-row')?.querySelector('.outline-target')?.getAttribute('aria-label')});});")
    time.sleep(.2);before=selection()
    preview('Move Scene 1: INT. A down')
    assert d.script("return document.querySelector('textarea[aria-label=\"Exact moved source\"]').value;")=='.INT. A #7#\n= Arrival\n!**Alpha🚀**.\n[[Attached note]]\n  \n' # textarea API normalizes endings; independent Save is the byte oracle
    apply();after=selection()
    assert after==before,(before,after)
    save(target,expected)
    undo();assert selection()==before
    save(target,source)
    # Real native pointer drag B before A produces the same request/order as
    # keyboard B-up; no synthetic DragEvent or app-state hook.
    first=aria_button('Go to Scene 1: INT. A');second=aria_button('Drag Scene 2: INT. B to preview move')
    d.script("arguments[0].scrollIntoView({block:'center'});",[{d.ELEMENT:second}])
    clients=[c for c in d.owned_clients() if c.get('class')=='babel-desktop']
    assert len(clients)==1,'Exactly one owned app for compositor drag'
    client=clients[0];address=client['address']
    assert address.startswith('0x') and all(c in '0123456789abcdef' for c in address[2:])
    subprocess.run(['hyprctl','dispatch','hl.dsp.focus({ window = "address:'+address+'" })'],check=True,stdout=subprocess.DEVNULL)
    monitors=json.loads(subprocess.check_output(['hyprctl','-j','monitors']))
    assert len(monitors)==1 and monitors[0]['x']==monitors[0]['y']==0
    monitor=monitors[0]
    def point(element):
        r=d.script('const r=arguments[0].getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};',[{d.ELEMENT:element}])
        assert 0<r['x']+1<client['size'][0] and 0<r['y']<client['size'][1],'Only owned app pointer coordinates'
        return round(client['at'][0]+r['x']),round(client['at'][1]+r['y'])
    start=point(second);end=point(first)
    subprocess.run(['/tmp/babel-m3-07-pointer',str(start[0]),str(start[1]),str(round(monitor['width']/monitor['scale'])),str(round(monitor['height']/monitor['scale'])),str(end[0]),str(end[1])],check=True)
    print('DRAG OBSERVATION',d.script("return {events:window.moveEvents,headings:[...document.querySelectorAll('.outline-target')].map(b=>({label:b.getAttribute('aria-label'),draggable:b.draggable,disabled:b.disabled})),preview:!!document.querySelector('.move-preview')};"),flush=True)
    d.wait(lambda:d.script("return document.querySelector('section[aria-label=\"Move preview\"]')!==null;"),'Trusted native drag preview')
    assert d.script("return document.querySelector('textarea[aria-label=\"Exact moved source\"]').value;")=='.INT. B #7#\n!Beta.\n\n'
    apply();save(target,expected)
    events=d.script('return window.moveEvents;')
    assert any(e['kind']=='pointerdown' and e['trusted'] and e['label']=='Drag Scene 2: INT. B to preview move' for e in events),events
    assert any(e['kind']=='pointerup' and e['trusted'] and e['label']=='Drag Scene 2: INT. B to preview move' for e in events),events
    d.screenshot('move-small-drag')
    reopen(target,expected)
    assert d.script("return document.querySelectorAll('.outline-target')[1].textContent.includes('INT. B');")
    d.close_session()

    # An inclusive 50-row scene requires exact recovery and safety publication.
    source=b'.INT. A\n'+b'!Large.\n'*48+b'\n.INT. B\n!B.\n\n'
    expected=b'.INT. B\n!B.\n\n.INT. A\n'+b'!Large.\n'*48+b'\n'
    target=open_source('moves-large',source)
    preview('Move Scene 1: INT. A down')
    assert '50 rows' in d.body() and 'safety revision' in d.body()
    apply();hits=safety(source);save(target,expected)
    undo();save(target,source)
    # Failure affects only disposable history; failed move leaves preview and
    # current rows available, and ordinary source saving still succeeds.
    repo,ref=hits[0];(repo/'refs'/'heads'/'main').write_text('bad-ref\n')
    original_rows=d.script("return [...document.querySelectorAll('.ProseMirror > p')].map(p=>p.textContent);")
    preview('Move Scene 1: INT. A down');d.click('Apply move')
    d.wait(lambda:'history needs attention' in d.body(),'Large-move history failure',timeout=60)
    assert d.script("return [...document.querySelectorAll('.ProseMirror > p')].map(p=>p.textContent);")==original_rows
    assert target.read_bytes()==source
    assert d.script("return document.querySelector('section[aria-label=\"Move preview\"]')!==null;")
    assert any(raw==source for _,raw in d.journal_records())
    d.screenshot('move-history-refusal');d.click('Cancel move preview');save(target,source)
    assert subprocess.check_output(['git','--git-dir='+str(repo),'show',ref+':screenplay.fountain'])==source
    # Restore only the synthetic bad ref from the independently verified ref,
    # so a new large section operation can exercise the success path.
    (repo/'refs'/'heads'/'main').write_text(ref.rsplit('/',1)[1]+'\n')
    d.close_session()

    a=b'# A\n## Nested\n.INT. A\n'+b'!Inside.\n'*47+b'\n'
    b=b'# B\n.INT. B\n!B.\n\n'
    target=open_source('moves-sections',a+b)
    preview('Move Section: A down');apply();safety(a+b);save(target,b+a)
    undo();save(target,a+b)
    reopen(target,a+b);d.close_session()

    eof=b'.INT. A\n!A.\n\n.INT. B\n!EOF'
    target=open_source('moves-eof',eof)
    preview('Move Scene 2: INT. B up')
    assert 'unterminated EOF' in d.body()
    assert d.script("return [...document.querySelectorAll('button')].find(b=>b.textContent==='Apply move').disabled;")
    assert d.script("return document.querySelectorAll('.move-preview details textarea').length;")>=2
    assert target.read_bytes()==eof
    d.screenshot('move-eof-review');d.click('Cancel move preview');save(target,eof);d.close_session()
    (d.ROOT/'moves-report.json').write_text(json.dumps({'audits':report,'trustedEvents':events,'selectionBefore':before,'selectionAfter':after,'safetyRefs':[str(repo)+':'+ref for repo,ref in hits]},indent=2))
    print('PASS native scene/section moves / trusted keyboard+drag / backward selection / exact Save+Undo+reopen / protected large move+failure / EOF review copies',flush=True)
