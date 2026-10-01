"""M4-13 default WebKit UI/IPC drill. Disposable source and UI hints only."""
import hashlib
import json
import subprocess
import time


def run(d):
    report = []
    source = ('\ufeffTitle: Position Study\r\n\r\n' + ''.join(
        '.INT. LAB ' + str(i) + ' - DAY\r\n!A **bright** café. 🚀\r\n\r\n@Zøë (V.O.)\r\n(two words)\r\nHello there.\r\n\r\n@ÉVA\r\nOther speech.\r\n\r\n'
        for i in range(30)) + '[[private note]]\r\n\r\n/*omitted words*/\r\n').encode()
    target = d.ROOT/'files'/'characters.fountain'; target.write_bytes(source)
    sha = hashlib.sha256(source).hexdigest()

    def ready():
        d.wait(lambda: d.script("return document.querySelector('[aria-label=\"Character focus\"]')?.disabled===false && document.querySelector('#writing-save')?.disabled===false;"), 'Current characters/counts', timeout=90)

    def selection():
        return d.script("const s=getSelection();const p=(s.focusNode?.nodeType===1?s.focusNode:s.focusNode?.parentElement)?.closest('.ProseMirror > p');return {row:[...document.querySelectorAll('.ProseMirror > p')].indexOf(p),offset:s.focusOffset};")

    def select(row, offset):
        d.script("const p=document.querySelectorAll('.ProseMirror > p')[arguments[0]];p.closest('.ProseMirror').focus();const w=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);let n,left=arguments[1];while(n=w.nextNode()){if(left<=n.length){getSelection().setBaseAndExtent(n,left,n,left);return;}left-=n.length;}throw Error('Offset');", [row,offset])
        d.wait(lambda: selection()=={'row':row,'offset':offset}, 'Exact Unicode selection')
        ready()

    def save():
        d.click('Save',actions=True); d.audit(target,source)
        d.wait(lambda:'Saved locally' in d.body(),'Exact source save'); ready()

    def settle_recovery():
        d.wait(lambda:'Comparing recovery against' not in d.body(),'Native source comparisons settled',timeout=60)
        if 'Recovery choice' not in d.body(): return
        d.wait(lambda:d.script("return [...document.querySelectorAll('button')].some(b=>b.textContent==='Keep Current File'&&!b.disabled);"),'Reviewed Keep current enabled',timeout=60)
        d.click('Keep Current File');d.wait(lambda:'The current file was kept.' in d.body(),'Explicit current file review')
        d.wait(lambda:'Comparing recovery against' not in d.body(),'All recovery comparisons settled',timeout=60)
        if 'A confirmed replacement matches the file' in d.body():
            d.wait(lambda:d.script("return [...document.querySelectorAll('button')].some(b=>b.textContent==='Resolve Interrupted Save'&&!b.disabled);"),'Enabled confirmed-save reconciliation')
            button=d.find('//section[.//p[contains(.,"A confirmed replacement matches the file")]]//button[normalize-space(.)="Resolve Interrupted Save" and not(@disabled)]');d.script("arguments[0].scrollIntoView({block:'center'});",[{d.ELEMENT:button}]);d.command('POST','/element/'+button+'/click',{})
            d.wait(lambda:'An interrupted save was confirmed' in d.body() or 'No interrupted' in d.body(),'Confirmed-save reconciliation')
        ready()

    def open_file(path, review=True):
        d.click('Open Fountain',actions=True); d.picker(path); ready()
        if review: settle_recovery()

    def restart():
        # Programmatic production close activation avoids WebDriver scrolling
        # the offscreen Close session button before viewport capture.
        d.script("[...document.querySelectorAll('[aria-label=\"Screenplay actions\"] button')].find(b=>b.textContent==='Close session').click();")
        d.wait(lambda:'Close document safely' in d.body(),'Protection panel');d.click('Retry save and close');d.wait(lambda:'Start writing' in d.body(),'Protected close completed')
        print('CLOSE HINTS',stored(),flush=True)
        d.command('DELETE',''); d.SESSION=None; d.new_session(); d.script("window.positionScrolls=[];const base=window.scrollBy.bind(window);window.scrollBy=(...args)=>{window.positionScrolls.push({args,header:document.querySelector('.writing-presentation')?.getBoundingClientRect().bottom,scroll:scrollY,row:document.querySelectorAll('.ProseMirror > p')[184]?.getBoundingClientRect().top});return base(...args);};"); open_file(target,False)

    def stored():
        return d.script("return JSON.parse(localStorage.getItem('babel.positions.v1'))?.positions ?? [];")

    open_file(target); save()
    assert '480 script words · 30 scenes · 2 characters' in d.body(), d.body()
    assert 'Title: 2; notes: 2; omissions: 2; raw: 0; outline: 0 words' in d.body()
    # Real native select and checkbox controls; rendering is independently inspected.
    option=d.find('//select[@aria-label="Character focus"]/option[@value="Zøë"]'); d.command('POST','/element/'+option+'/click',{})
    check=d.find('//label[contains(.,"Highlight dialogue")]/input');d.command('POST','/element/'+check+'/click',{})
    d.wait(lambda: d.script("return document.querySelectorAll('.character-highlight').length===60;"),'Dialogue and parenthetical highlights')
    before=d.editor(); d.click('Next character cue'); ready()
    assert selection()=={'row':5,'offset':0}, selection()
    assert d.editor()==before
    d.click('Next character cue'); ready(); assert selection()=={'row':15,'offset':0},selection()
    # Return focus is real, and authored Undo contains only the trusted input.
    d.type_text('x'); d.wait(lambda:'xZøë' in d.editor_text(),'Native typing after character navigation')
    d.type_text('\ue009z\ue000'); save(); assert d.editor()==before
    d.screenshot('characters-highlights')
    report.append('native character controls/navigation/focus/highlights/typing/one Undo/exact source')
    # Actual GTK simple IME commit/cancel, with view-only highlights active.
    select(3,2)
    clients=[c for c in d.owned_clients() if c.get('class')=='babel-desktop']; assert len(clients)==1
    address=clients[0]['address'];assert address.startswith('0x') and all(c in '0123456789abcdef' for c in address[2:])
    subprocess.run(['hyprctl','dispatch','hl.dsp.focus({ window = "address:'+address+'" })'],check=True,stdout=subprocess.DEVNULL)
    d.script("window.characterIme=[];for(const kind of ['compositionstart','compositionend'])document.querySelector('.ProseMirror').addEventListener(kind,e=>window.characterIme.push({kind,trusted:e.isTrusted}));")
    def physical(action): subprocess.run(['/tmp/babel-m3-08-keyboard',action],check=True)
    physical('unicode-start')
    for action in ['hex-4','hex-f','hex-6','hex-0']:physical(action)
    physical('return');d.wait(lambda:'你' in d.editor_text(),'Actual IME committed');d.type_text('\ue009z\ue000');save()
    select(3,2);physical('unicode-start');physical('hex-4');physical('escape');save()
    events=d.script('return window.characterIme;');assert len(events)>=4 and all(e['trusted'] for e in events),events
    report.append({'gtkSimpleIme':events})
    # Theme/zoom/typewriter; manual viewport deliberately differs from the caret.
    zoom=d.find('//select[@aria-label="Writing zoom"]/option[@value="150"]'); d.command('POST','/element/'+zoom+'/click',{})
    theme=d.find('//select[@aria-label="Theme"]/option[@value="dark"]');d.command('POST','/element/'+theme+'/click',{})
    typewriter=d.find('//label[contains(.,"Typewriter scroll")]/input');d.command('POST','/element/'+typewriter+'/click',{})
    select(245,1)
    d.script("document.querySelectorAll('.ProseMirror > p')[185].scrollIntoView({block:'start'});")
    d.wait(lambda: any(p['head']=={'row':245,'offset':1} and p['sourceSha256']==sha for p in stored()),'Position hint captured')
    time.sleep(.4); original=next(p for p in stored() if p['sourceSha256']==sha)
    assert original['viewport'] and original['viewport']['row'] < 245, original
    print('ORIGINAL HINT',original,d.script("const p=document.querySelectorAll('.ProseMirror > p')[arguments[0]],r=p.getBoundingClientRect();return {top:r.top,height:r.height,header:document.querySelector('.writing-presentation').getBoundingClientRect().bottom,scroll:scrollY};",[original['viewport']['row']]),flush=True)
    original_bytes=target.read_bytes(); restart();
    print('RESTART OBSERVATION', selection(), d.script("const s=getSelection();return {active:document.activeElement?.outerHTML.slice(0,240),focusText:s.focusNode?.textContent?.slice(0,80),anchor:s.anchorOffset,focus:s.focusOffset};"), stored(),flush=True)
    d.wait(lambda:selection()=={'row':245,'offset':1},'Caret restored across native restart')
    time.sleep(.4)
    print('SCROLL CALLS',d.script('return window.positionScrolls;'),flush=True)
    print('RESTORED GEOMETRY',d.script("const p=document.querySelectorAll('.ProseMirror > p')[arguments[0]],r=p.getBoundingClientRect();return {top:r.top,height:r.height,header:document.querySelector('.writing-presentation').getBoundingClientRect().bottom,scroll:scrollY};",[original['viewport']['row']]),flush=True)
    d.wait(lambda:d.script("const p=document.querySelectorAll('.ProseMirror > p')[arguments[0]],r=p.getBoundingClientRect(),h=document.querySelector('.writing-presentation').getBoundingClientRect().bottom;return Math.abs(r.top+r.height*arguments[1]-h)<3;",[original['viewport']['row'],original['viewport']['fraction']]),'Manual viewport anchor restored')
    assert target.read_bytes()==original_bytes
    d.screenshot('characters-position-restart');report.append({'restartHint':original})
    settle_recovery()
    # Native Save As must keep current selection but use a fresh native identity.
    select(35,2);save();time.sleep(.4)
    old_id=next(p['documentId'] for p in stored() if p['sourceSha256']==sha)
    copy=d.ROOT/'copies'/'character-copy.fountain'
    d.click('Save As',actions=True);d.picker(copy);d.wait(lambda:copy.exists() and copy.read_bytes()==source,'Exact Save As source publication',timeout=60);ready()
    assert copy.read_bytes()==source and target.read_bytes()==source
    d.script("document.querySelector('.ProseMirror').focus();");d.wait(lambda:selection()=={'row':35,'offset':2},'Owned caret retained on editor refocus')
    d.wait(lambda:len([p for p in stored() if p['sourceSha256']==sha])==2,'Separate identity hints after Save As')
    ids=[p['documentId'] for p in stored() if p['sourceSha256']==sha];assert len(set(ids))==2 and old_id in ids
    copy_id=next(value for value in ids if value!=old_id)
    report.append('Save As keeps current caret on refocus; fresh durable identity gets its own hint; both sources intact')
    d.close_session();open_file(target);ready()
    d.script("document.querySelector('.ProseMirror').focus();");d.wait(lambda:selection()=={'row':35,'offset':2},'Owned caret retained on editor refocus')
    d.close_session()
    # Retain old hint bytes while source changes externally, then use safe default.
    changed=source.replace(b'A **bright**',b'A **different**',1);target.write_bytes(changed)
    open_file(target);d.script("document.querySelector('.ProseMirror').focus();");print('CHANGED SOURCE SELECTION',selection(),d.script("const s=getSelection();return {node:s.focusNode?.nodeName,text:s.focusNode?.textContent?.slice(0,80),parent:s.focusNode?.parentElement?.outerHTML.slice(0,350),offset:s.focusOffset};"),flush=True);d.wait(lambda:selection()=={'row':1,'offset':0},'Changed source uses first editable source row')
    assert target.read_bytes()==changed; report.append('changed native source hash refuses prior offsets')
    # Corrupt only UI hints; actual source protection, saving and close still work.
    d.script("localStorage.setItem('babel.positions.v1','synthetic corrupt hints');")
    d.close_session();open_file(target)
    d.wait(lambda:any(message in d.body() for message in ['Recent positions could not be read','Recent position could not be stored']),'Corrupt position failure visible')
    d.click('Save',actions=True);d.audit(target,changed)
    d.wait(lambda:'Saved locally' in d.body(),'Exact source receipt despite corrupt auxiliary hints');ready()
    d.close_session(); assert d.script("return localStorage.getItem('babel.positions.v1');")=='synthetic corrupt hints'
    report.append('corrupt hints retained; native source Save/protected close remain independent')
    # Checkpoint selection precedence: resume the exact retained source checkpoint
    # under a new draft identity while a deliberately contradictory hint exists.
    records=[(m,s) for m,s in d.journal_records() if s==source and m['documentId']==copy_id]
    metadata,_=max(records,key=lambda item:(item[0]['version'],item[0]['generation']))
    expected=metadata['draftMetadata']['selection']['head']
    assert expected['sourceIndex']==35 and expected['utf16Offset']==2,expected
    d.script("localStorage.setItem('babel.positions.v1',JSON.stringify({version:1,positions:[{documentId:arguments[0],sourceSha256:arguments[1],anchor:{row:0,offset:0},head:{row:0,offset:0},viewport:null}]}));",[copy_id,sha])
    d.wait(lambda:'Checking local recovery' not in d.body(),'Recovery catalog settled')
    xpath='//li[h3[normalize-space(.)='+json.dumps('Draft '+copy_id)+']]//li[p[contains(.,'+json.dumps('generation '+str(metadata['generation'])+' ·',ensure_ascii=False)+')]]//button[normalize-space(.)="Resume as new draft"]'
    d.wait(lambda:d.script("return !!document.evaluate(arguments[0],document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue;",[xpath]),'Exact checkpoint Resume available',timeout=60)
    button=d.find(xpath);d.script("arguments[0].scrollIntoView({block:'center'});",[{d.ELEMENT:button}])
    d.command('POST','/element/'+button+'/click',{});ready()
    d.script("document.querySelector('.ProseMirror').focus();");d.wait(lambda:selection()=={'row':35,'offset':2},'Owned caret retained on editor refocus')
    assert d.editor_text().startswith('Position Study'),d.editor_text()[:80]
    report.append('native retained checkpoint selection outranks contradictory recent hint on Resume')
    d.close_session()
    result={'checks':report,'bytes':len(source),'sha256':sha}
    (d.ROOT/'characters-result.json').write_text(json.dumps(result,indent=2));print('PASS M4-13 native characters/counts/positions',json.dumps(result),flush=True);print('ARTIFACTS',d.ROOT,flush=True)
