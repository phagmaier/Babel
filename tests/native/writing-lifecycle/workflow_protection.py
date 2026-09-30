"""Default native protected import exercises the same session guard future moves use.
Only visible controls/trusted input and read-only DOM observations; no native invokes.
"""
import hashlib
import json
import subprocess
import time


def run(d):
    def ready():
        d.wait(lambda: d.script("return document.querySelector('.ProseMirror')?.getAttribute('contenteditable')==='true' && document.querySelector('#writing-save')?.disabled===false;"),'Ready writable editor',timeout=60)

    def stage(text):
        area=d.find('//textarea[@aria-label="Fountain screenplay to import"]')
        d.command('POST','/element/'+area+'/click',{})
        d.command('POST','/element/'+area+'/clear',{})
        d.command('POST','/element/'+area+'/value',{'text':text})

    def key(value):
        d.command('POST','/actions',{'actions':[{'type':'key','id':'workflow-key','actions':[{'type':'keyDown','value':value},{'type':'keyUp','value':value}]}]})

    def undo():
        d.script("document.querySelector('.ProseMirror').focus();")
        d.command('POST','/actions',{'actions':[{'type':'key','id':'workflow-undo','actions':[{'type':'keyDown','value':'\ue009'},{'type':'keyDown','value':'z'},{'type':'keyUp','value':'z'},{'type':'keyUp','value':'\ue009'}]}]})

    target=d.ROOT/'files'/'workflow.fountain'
    source='\ufeff!Original é🚀.\r\n'.encode()
    target.write_bytes(source)
    d.click('Open Fountain',actions=True);d.picker(target);ready()
    original=d.editor_text()
    stage('!Replacement.')
    # One trusted WebDriver keyboard sequence reaches the newly visible cancel
    # control during the bounded deferred capture. No synthetic click/state hook.
    import_button=d.find('//button[normalize-space(.)="Import Fountain as screenplay"]')
    d.script("arguments[0].focus();document.addEventListener('click',e=>{if(e.target.textContent==='Cancel import protection')window.workflowCancelObservation={trusted:e.isTrusted,frozen:document.querySelector('.ProseMirror').getAttribute('contenteditable')==='false'};});",[{'element-6066-11e4-a52e-4f735466cecf':import_button}])
    d.command('POST','/actions',{'actions':[{'type':'key','id':'workflow-cancel','actions':[
        {'type':'keyDown','value':'\ue007'},{'type':'keyUp','value':'\ue007'},
        {'type':'keyDown','value':'\ue004'},{'type':'keyUp','value':'\ue004'},
        {'type':'keyDown','value':'\ue007'},{'type':'keyUp','value':'\ue007'}]}]})
    d.wait(lambda:'Operation cancelled' in d.body(),'Native cancellation blocks import')
    assert d.script('return window.workflowCancelObservation;')=={'trusted':True,'frozen':True}
    assert d.editor_text()==original and target.read_bytes()==source
    assert d.script('return document.querySelector("textarea").value;')=='!Replacement.'
    ready();d.script("document.querySelector('section[aria-label=\"Import Fountain\"]').scrollIntoView({block:'center'});");d.screenshot('workflow-cancelled')
    # Retry succeeds only after exact checkpoint + native fixed-label safety ref.
    d.click('Import Fountain as screenplay')
    d.wait(lambda:'Imported. Previous draft protected' in d.body(),'Protected import succeeds')
    assert d.editor_text()=='Replacement.'
    records=d.journal_records();assert any(raw==source for _,raw in records)
    history=d.ROOT/'data'/'app.babel.screenwriter'/'history'
    repos=list(history.glob('*.git'));assert len(repos)==1
    repo=repos[0]
    refs=subprocess.check_output(['git','--git-dir='+str(repo),'for-each-ref','--format=%(refname)','refs/safety/'],text=True).splitlines()
    assert refs
    matching=[]
    for ref in refs:
        raw=subprocess.check_output(['git','--git-dir='+str(repo),'show',ref+':screenplay.fountain'])
        if raw==source:matching.append(ref)
    assert matching,'Exact original bytes in verified safety refs'
    assert target.read_bytes() in [source,b'!Replacement.'] # independent source cadence may run after thaw
    undo();d.wait(lambda:d.editor_text()==original,'One-step import Undo restores original')
    d.click('Save',actions=True);d.audit(target,source)
    # Corrupt only the disposable history metadata. Refusal leaves the live and
    # staged drafts intact, while a completed exact checkpoint stays inspectable.
    (repo/'refs'/'heads'/'main').write_text('bad-ref\n')
    stage('!Never replace this way.')
    d.click('Import Fountain as screenplay')
    d.wait(lambda:'history needs attention' in d.body(),'History failure refuses import')
    assert d.editor_text()==original and target.read_bytes()==source
    assert any(raw==source for _,raw in d.journal_records())
    assert d.script('return document.querySelector("textarea").value;')=='!Never replace this way.'
    ready();d.script("document.querySelector('section[aria-label=\"Import Fountain\"]').scrollIntoView({block:'center'});");d.screenshot('workflow-history-failure')
    d.script("const p=document.querySelector('.ProseMirror > p');p.closest('.ProseMirror').focus();const n=p.firstChild;getSelection().setBaseAndExtent(n,0,n,0);")
    time.sleep(.15);d.type_text('Later ')
    expected='\ufeff!Later Original é🚀.\r\n'.encode()
    d.click('Save',actions=True);d.audit(target,expected)
    d.wait(lambda:'Saved locally' in d.body(),'Source Save independent of failed history')
    assert any(raw==expected for _,raw in d.journal_records())
    for ref in matching:
        assert subprocess.check_output(['git','--git-dir='+str(repo),'show',ref+':screenplay.fountain'])==source
    (d.ROOT/'workflow-report.json').write_text(json.dumps({'sourceLength':len(source),'sourceSha256':hashlib.sha256(source).hexdigest(),'savedLength':len(expected),'savedSha256':hashlib.sha256(expected).hexdigest(),'safetyRefs':matching,'cancel':d.script('return window.workflowCancelObservation;')},indent=2))
    d.close_session()
    uncapturable=b'.INT. WAIT - DAY\n\n@MAYA\n(softly)\nHello.\n'
    draft=d.ROOT/'files'/'workflow-uncapturable.fountain';draft.write_bytes(uncapturable)
    d.click('Open Fountain',actions=True);d.picker(draft);ready()
    d.script("const p=document.querySelectorAll('.ProseMirror > p')[3];p.closest('.ProseMirror').focus();getSelection().setBaseAndExtent(p.firstChild,4,p.firstChild,4);")
    time.sleep(.15);key('\ue007')
    d.wait(lambda:'Outline is unavailable for the current draft' in d.body(),'Accepted uncapturable draft')
    rows=['INT. WAIT - DAY','','MAYA','(sof','tly)','Hello.']
    assert d.script("return [...document.querySelectorAll('.ProseMirror > p')].map(p=>p.textContent);")==rows
    stage('!Do not discard the split draft.')
    d.click('Import Fountain as screenplay')
    d.wait(lambda:d.script("const s=document.querySelector('section[aria-label=\"Import Fountain\"] [role=status]');return s?.textContent && !s.textContent.startsWith('Protecting');"),'Uncapturable import refuses')
    assert 'Imported. Previous draft protected' not in d.body()
    assert d.script("return [...document.querySelectorAll('.ProseMirror > p')].map(p=>p.textContent);")==rows
    assert draft.read_bytes()==uncapturable
    assert d.script('return document.querySelector("textarea").value;')=='!Do not discard the split draft.'
    ready();d.script("document.querySelector('section[aria-label=\"Import Fountain\"]').scrollIntoView({block:'center'});");d.screenshot('workflow-uncapturable');undo();ready()
    d.click('Save',actions=True);d.audit(draft,uncapturable)
    print('PASS native uncapturable import refusal retains accepted live split draft / source / staged input / Undo',flush=True)
    print('PASS default native exact protection / frozen trusted cancel / verified safety bytes / Undo / history failure / independent Save',flush=True)
