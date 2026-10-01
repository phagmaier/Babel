"""M4-03 default-release outline checks using visible controls and DOM probes.
No app state hooks or native invoke endpoints; all files/profile are disposable.
"""
import hashlib
import json
import subprocess
import time


def run(d):
    report = []

    def ready():
        d.wait(lambda: d.script("return !!document.querySelector('.outline-target:not(:disabled)') && document.querySelector('#writing-save')?.disabled===false;"), 'Current outline and ready session', timeout=60)

    def open_source(name, source):
        target = d.ROOT / 'files' / (name + '.fountain')
        target.write_bytes(source)
        d.click('Open Fountain', actions=True)
        d.picker(target)
        ready()
        return target

    def button(label):
        return d.find('//nav[@aria-label="Manuscript outline"]//button[@aria-label=' + json.dumps(label,ensure_ascii=False) + ']')

    def navigate(label, keyboard=False):
        ready()
        element = button(label)
        d.script("window.outlineTiming=null;window.outlineHandlerTiming=null;window.outlineFocusTiming=null;window.outlineStart=null;const target=arguments[0];for(const kind of ['click','keydown']) target.addEventListener(kind,e=>{if(e.isTrusted && (kind==='click'||e.key==='Enter')) window.outlineStart=performance.now();},{once:true});document.addEventListener('click',e=>{if(target.contains(e.target)&&window.outlineStart!==null)window.outlineHandlerTiming=performance.now()-window.outlineStart;},{once:true});document.querySelector('.ProseMirror').addEventListener('focus',()=>{if(window.outlineStart!==null){window.outlineFocusTiming=performance.now()-window.outlineStart;requestAnimationFrame(()=>requestAnimationFrame(()=>window.outlineTiming=performance.now()-window.outlineStart));}},{once:true});", [{d.ELEMENT:element}])
        if keyboard:
            # Pointer focuses without navigating: Tab to the next target, Enter
            # activates it. Initial click uses a collapse toggle in callers.
            d.command('POST','/element/'+element+'/value',{'text':'\ue007'})
        else:
            d.command('POST','/element/'+element+'/click',{})
        d.wait(lambda:d.script("return document.activeElement?.classList.contains('ProseMirror');"),'Navigation returns editor focus')
        timing = d.wait(lambda:d.script('return window.outlineTiming;'),'Navigation frame timing')
        # GTK integer scroll offsets can leave a fractional CSS-pixel edge.
        try:
            selection = d.wait(lambda:d.script("const s=getSelection();const p=(s.focusNode?.nodeType===1?s.focusNode:s.focusNode?.parentElement)?.closest('.ProseMirror > p');const r=p.getBoundingClientRect();return r.top>=-1&&r.bottom<=innerHeight+1?{row:[...document.querySelectorAll('.ProseMirror > p')].indexOf(p),offset:s.focusOffset,visible:true}:null;"), 'Outline selection visible after scheduled navigation')
        except AssertionError:
            print('OUTLINE NAVIGATION FAILURE', d.script("const s=getSelection();const e=document.activeElement;const p=(s.focusNode?.nodeType===1?s.focusNode:s.focusNode?.parentElement)?.closest('.ProseMirror > p');return {active:e?.outerHTML.slice(0,200),selection:s?.toString(),node:s?.focusNode?.textContent,offset:s?.focusOffset,row:p?[...document.querySelectorAll('.ProseMirror > p')].indexOf(p):null,rect:p?.getBoundingClientRect().toJSON(),height:innerHeight};"), flush=True)
            d.screenshot('outline-navigation-failure')
            raise
        assert selection['visible'],selection
        report.append({'navigation':label,'keyboard':keyboard,'eventThroughHandlerMs':d.script('return window.outlineHandlerTiming;'),'eventToEditorFocusMs':d.script('return window.outlineFocusTiming;'),'eventToTwoAnimationFramesMs':timing,'selection':selection})
        (d.ROOT/'outline-partial-measurements.json').write_text(json.dumps(report,indent=2)+'\n')
        assert timing < 200, {'navigation':label,'eventToTwoAnimationFramesMs':timing}
        return selection

    def save(target, source):
        d.click('Save', actions=True)
        d.audit(target, source)
        d.wait(lambda:'Saved locally' in d.body(),'Source receipt')

    def select(row, offset):
        d.script("const p=document.querySelectorAll('.ProseMirror > p')[arguments[0]];const root=p.closest('.ProseMirror');root.focus();const w=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);let n,left=arguments[1];while(n=w.nextNode()){if(left<=n.length){getSelection().setBaseAndExtent(n,left,n,left);return;}left-=n.length;}if(left===0)getSelection().setBaseAndExtent(p,0,p,0);else throw Error('Offset');",[row,offset])
        time.sleep(.15)

    def owned_focus():
        clients=[c for c in d.owned_clients() if c.get('class')=='babel-desktop']
        assert len(clients)==1
        address=clients[0]['address']
        assert address.startswith('0x') and all(c in '0123456789abcdef' for c in address[2:])
        subprocess.run(['hyprctl','dispatch','hl.dsp.focus({ window = "address:'+address+'" })'],check=True,stdout=subprocess.DEVNULL)

    source='\ufeffTitle: Title\r\n\r\n# Act\r\n= Overview\r\n## Turn\r\n.INT. LAB é🚀 - DAY #7#\r\n= Secret arrival\r\n!Work.\r\n.INT. ROOF - DAY #7#\r\n!Wait.\r\n# End\r\n.EXT. PARK - NIGHT\r\n!Rest.'.encode()
    target=open_source('outline-unicode',source)
    assert d.script("return document.querySelectorAll('.outline-target').length;")==6
    assert '1. INT. LAB é🚀 - DAY' in d.body() and '2. INT. ROOF - DAY' in d.body()
    assert d.body().count('Authored #7#')==2
    d.command('POST','/element/'+button('Collapse Turn')+'/click',{})
    assert d.script("return document.querySelectorAll('.outline-target').length;")==4
    d.command('POST','/element/'+button('Expand Turn')+'/click',{})
    assert navigate('Go to Scene 1: INT. LAB é🚀 - DAY')['row']==5
    # Trusted WebKit Tab reaches outline controls; Enter activates a heading.
    d.command('POST','/element/'+button('Collapse Turn')+'/click',{})
    d.command('POST','/element/'+button('Expand Turn')+'/click',{})
    d.command('POST','/actions',{'actions':[{'type':'key','id':'outline-tab','actions':[{'type':'keyDown','value':'\ue004'},{'type':'keyUp','value':'\ue004'}]}]})
    assert d.script("return document.activeElement?.getAttribute('aria-label');")=='Go to Section: Turn'
    assert navigate('Go to Section: Turn',keyboard=True)['row']==4
    d.set_input('Filter outline','secret')
    d.wait(lambda:d.script("return document.querySelectorAll('.outline-target').length===3 && !!document.querySelector('.outline-target:not(:disabled)');"),'Synopsis filter keeps ancestors')
    assert navigate('Go to Scene 1: INT. LAB é🚀 - DAY')['row']==5
    filter_input=d.find('//nav[@aria-label="Manuscript outline"]//input[@type="search"]')
    d.command('POST','/element/'+filter_input+'/click',{})
    d.command('POST','/actions',{'actions':[{'type':'key','id':'outline-clear','actions':[
        {'type':'keyDown','value':'\ue009'},{'type':'keyDown','value':'a'},{'type':'keyUp','value':'a'},{'type':'keyUp','value':'\ue009'},
        {'type':'keyDown','value':'\ue003'},{'type':'keyUp','value':'\ue003'}]}]})
    assert d.command('GET','/element/'+filter_input+'/property/value')==''
    d.wait(lambda:d.script("return document.querySelectorAll('.outline-target').length===6 && !!document.querySelector('.outline-target:not(:disabled)');"),'Filter cleared by trusted keys')
    ready()
    d.screenshot('outline-nested-focus')
    assert target.read_bytes()==source
    # An authored edit invalidates old anchors; Undo must rebuild the heading
    # and a navigation must not consume the edit's Undo entry.
    assert navigate('Go to Scene 2: INT. ROOF - DAY')['row']==8
    d.type_text('Changed ')
    d.wait(lambda:'Go to Scene 2: Changed INT. ROOF - DAY' in d.script("return [...document.querySelectorAll('.outline-target')].map(b=>b.getAttribute('aria-label')).join('|');"),'Edited heading projected')
    edited=source.replace(b'.INT. ROOF - DAY',b'.Changed INT. ROOF - DAY')
    save(target,edited)
    navigate('Go to Scene 1: INT. LAB é🚀 - DAY')
    d.type_text('\ue009z\ue000')
    ready()
    d.wait(lambda:d.script("return !![...document.querySelectorAll('.outline-target:not(:disabled)')].find(b=>b.getAttribute('aria-label')==='Go to Scene 2: INT. ROOF - DAY');"),'Undo replaces stale heading')
    save(target,source)
    assert navigate('Go to Scene 2: INT. ROOF - DAY')['row']==8
    # Actual pinyin preedit, commit, cancel, and Undo with the outline mounted.
    select(9,5)
    d.script("window.outlineIme=[];for(const kind of ['compositionstart','compositionend'])document.querySelector('.ProseMirror').addEventListener(kind,e=>window.outlineIme.push({kind,trusted:e.isTrusted}));")
    previous=subprocess.check_output(['fcitx5-remote','-n'],text=True).strip()
    try:
        owned_focus()
        subprocess.run(['fcitx5-remote','-s','pinyin'],check=True);time.sleep(.5)
        subprocess.run(['wtype','-d','80','nihao'],check=True);time.sleep(.6)
        subprocess.run(['wtype','-k','space'],check=True);time.sleep(.5)
        save(target,source.replace(b'!Wait.', '!Wait.你好'.encode()))
        d.type_text('\ue009z\ue000');save(target,source)
        select(9,5);owned_focus()
        subprocess.run(['wtype','-d','80','nihao'],check=True);time.sleep(.6)
        subprocess.run(['/tmp/babel-m3-08-keyboard','escape'],check=True);time.sleep(.4)
        save(target,source)
    finally:
        subprocess.run(['fcitx5-remote','-s',previous],check=True)
    events=d.script('return window.outlineIme;')
    assert sum(e['kind'] == 'compositionstart' and e['trusted'] for e in events) >= 2, events
    assert sum(e['kind']=='compositionend' and e['trusted'] for e in events)>=2, events
    (d.ROOT/'outline-ime.json').write_text(json.dumps(events,indent=2))
    # DOM zoom only changes this disposable app surface, not global desktop settings.
    d.script("document.querySelector('main').style.zoom='1.5';")
    d.script("document.querySelector('.manuscript-outline').scrollIntoView({block:'start'});")
    d.screenshot('outline-scale-150')
    assert navigate('Go to Scene 3: EXT. PARK - NIGHT')['row']==11
    d.script("document.querySelector('main').style.zoom='1';")
    d.close_session();d.audit(target,source)
    print('PASS native nested/collapse/synopsis filter / trusted Tab+Enter/pointer / Unicode caret / Undo / pinyin commit+cancel / 150% app zoom',flush=True)

    unrepresentable=b'.INT. WAIT - DAY\n\n@MAYA\n(softly)\nHello.\n'
    target=open_source('outline-uncapturable',unrepresentable)
    select(3,4)
    d.type_text('\ue007')
    d.wait(lambda:'Outline is unavailable for the current draft' in d.body(),'Uncapturable accepted draft is unavailable')
    assert d.script("return [...document.querySelectorAll('.outline-target')].every(b=>b.disabled);")
    assert d.script("return [...document.querySelectorAll('.ProseMirror > p')].map(p=>p.textContent);")==['INT. WAIT - DAY','','MAYA','(sof','tly)','Hello.']
    assert target.read_bytes()==unrepresentable
    d.type_text('\ue009z\ue000');ready();save(target,unrepresentable)
    d.close_session()
    print('PASS native uncapturable draft retained / stale outline inert / Undo makes projection available',flush=True)

    for name, scenes in [('typical',150),('stress',1500)]:
        text='Title: Synthetic index workload\n\n# Act\n'+''.join(f'.INT. ROOM {at} - DAY #{at%7}#\n= Arrival {at}\n= Conflict unfolds\n!Zoë arrives with a worn notebook and reads the sign.\n!A lamp flickers above the doorway.\n\n@MAYA\nThe door is open.\nCome inside.\nWe have time.\n\n@NOAH\nI saw the signal.\nWe should leave.\nWait here.\n\n!They cross the room in silence.\n!A bell rings outside.\n' for at in range(scenes))
        workload=text.encode()
        started=time.monotonic();target=open_source('outline-'+name,workload)
        report.append({'workload':name,'scenes':scenes,'lines':3+scenes*18,'bytes':len(workload),'sha256':hashlib.sha256(workload).hexdigest(),'pickerThroughCurrentOutlineMs':(time.monotonic()-started)*1000})
        if scenes>1000: assert 'Showing the first 1000' in d.body()
        d.set_input('Filter outline',f'ROOM {scenes-1} -')
        d.wait(lambda:d.script("return document.querySelectorAll('.outline-target').length===2 && !!document.querySelector('.outline-target:not(:disabled)');"),'Full index last heading reachable',timeout=30)
        assert navigate(f'Go to Scene {scenes}: INT. ROOM {scenes-1} - DAY')['row']==3+(scenes-1)*18
        d.screenshot('outline-'+name)
        d.close_session();d.audit(target,workload)
    (d.ROOT/'outline-measurements.json').write_text(json.dumps(report,indent=2)+'\n')
    print('MEASUREMENTS',json.dumps(report),flush=True)
    print('PASS default-release current/stale outline / complete bounded index / typical+stress last-scene navigation / exact bytes',flush=True)
    print('ARTIFACTS',d.ROOT,flush=True)
