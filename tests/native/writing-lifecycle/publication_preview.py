"""M5-05 real default-release WebKit pages/count/Save plus delayed transport race.
Only synthetic fixtures and this driver's owned process/files are touched.
"""
import hashlib
import json
import subprocess
import time


def run(d):
    source = b'\xef\xbb\xbfTitle: Offline preview\r\n\r\nINT. ROOM - DAY\r\n\r\n!A lamp glows.\r\n'
    target = d.ROOT / 'files/preview.fountain'
    target.write_bytes(source)
    d.click('Open Fountain', actions=True); d.picker(target)
    d.wait(lambda: d.script("return document.querySelector('#writing-preview')?.disabled===false;"), 'Preview enabled', timeout=60)
    editor = d.editor()
    # Observe actual Worker creation; no fake parsing fallback may earn display credit.
    d.script("""window.previewWorkers=[];const OriginalWorker=window.Worker;window.Worker=class extends OriginalWorker {
      constructor(url,options){super(url,options);window.previewWorkers.push(String(url));}
    };window.previewEvents=[];const callbacks=window.__TAURI_INTERNALS__.callbacks;
    window.originalCallbackSet=callbacks.set;
    callbacks.set=function(id,callback){return window.originalCallbackSet.call(this,id,data=>{
      if(data?.protection==='sourceFile'&&window.holdPreviewSave){window.holdPreviewSave=false;window.releasePreviewSave=()=>callback(data);return;}
      if(data?.artifact&&data?.pageCount){window.previewEvents.push(data);
        if(window.holdPreview){window.holdPreview=false;window.releasePreview=()=>callback(data);return;}}
      callback(data);});};""")
    def status():
        return d.script("return document.querySelector('[aria-label=\"Publication page count\"]').textContent;")
    def fresh():
        d.wait(lambda: 'pages · preview version' in status() or 'page · preview version' in status(), 'Current authoritative PDF/count', timeout=90)
        return status()
    def artifact():
        result = d.script('return window.previewEvents.at(-1);')
        path = d.ROOT / 'cache/app.babel.screenwriter/publication' / (result['artifact'] + '.pdf')
        info = subprocess.check_output(['pdfinfo', str(path)], text=True)
        pages = int(next(line.split(':', 1)[1] for line in info.splitlines() if line.startswith('Pages:')))
        assert pages == result['pageCount']
        assert f"{pages} " in status() and f"version {result['version']}" in status()
        return result, path
    d.click('PDF preview', actions=True)
    d.wait(lambda: d.script("return document.activeElement?.textContent==='Close PDF preview';"), 'Initial preview keyboard focus')
    initial = fresh(); result, path = artifact()
    assert result['pageCount'] == 2
    assert d.script("return window.previewWorkers.length===1 && window.previewWorkers[0].includes('/assets/pdf.worker-');"), 'Bundled real worker required'
    assert d.script("return !!document.querySelector('.pdf-page canvas') && !document.querySelector('.publication-preview [contenteditable]');")
    assert d.editor() == editor and target.read_bytes() == source
    d.click('Next PDF page')
    d.wait(lambda: d.script("return document.querySelector('.publication-preview pre')?.textContent.includes('A lamp glows.');"), 'PDF extracted/selectable body text')
    # Canvas must contain ink, not only a blank success placeholder.
    assert d.script("""const c=document.querySelector('.pdf-page canvas'),data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      let ink=0;for(let i=0;i<data.length;i+=4)if(data[i]<100&&data[i+1]<100&&data[i+2]<100)ink++;return ink>100;""")
    zoom = d.find('//label[contains(.,"PDF zoom")]/select')
    d.command('POST', '/element/'+zoom+'/click', {})
    d.command('POST', '/actions', {'actions':[{'type':'key','id':'pdf-zoom','actions':[
        {'type':'keyDown','value':'\ue015'},{'type':'keyUp','value':'\ue015'},
        {'type':'keyDown','value':'\ue007'},{'type':'keyUp','value':'\ue007'}]}]})
    d.wait(lambda: d.script("return document.querySelector('.pdf-page canvas')?.width===765;"), '125% PDF zoom')
    assert d.script('return window.previewEvents.length;') == 1, 'View zoom must not rerender screenplay'
    # Theme affects the app chrome, never printed paper or PDF typography.
    theme = d.find('//select[@aria-label="Theme"]/option[@value="dark"]')
    d.command('POST', '/element/'+theme+'/click', {})
    d.wait(lambda: d.script("return document.documentElement.dataset.theme==='dark';"), 'Dark preview chrome')
    assert d.script("return getComputedStyle(document.querySelector('.pdf-page canvas')).backgroundColor;") == 'rgb(255, 255, 255)'
    assert d.script('return window.previewEvents.length;') == 1
    d.script("const page=document.querySelector('.pdf-page');page.scrollIntoView({block:'center'});page.scrollTop=0;")
    d.screenshot('pdf-preview-body')
    # Hold one *real* native result at the transport boundary. Edit while it is
    # held, let a newer native job display, then release the older response.
    d.script('window.holdPreview=true;')
    d.click('Refresh PDF preview')
    d.wait(lambda: d.script("return typeof window.releasePreview==='function';"), 'Captured real result held')
    heading = d.find("//div[contains(@class,'ProseMirror')]/p[@data-kind='action' and normalize-space(.)='A lamp glows.']")
    d.command('POST', '/element/'+heading+'/click', {})
    d.type_text('\ue011X')
    assert 'Updating' in status(), status()
    current = fresh(); newer, new_path = artifact()
    d.script('window.releasePreview();')
    time.sleep(.5)
    assert status() == current and newer['requestId'] > result['requestId'], 'Stale response changed current display'
    d.script('window.holdPreviewSave=true;')
    d.click('Save', actions=True)
    d.wait(lambda: d.script("return typeof window.releasePreviewSave==='function';"), 'Actual Save receipt held for preview-close race', timeout=60)
    expected = source.replace(b'A lamp', b'XA lamp')
    d.audit(target, expected)
    assert d.editor() == editor
    # Close returns focus to the actual toolbar; open/close does not destroy editor.
    d.click('Close PDF preview')
    assert d.script("return !document.querySelector('.publication-preview') && document.querySelector('#writing-preview').disabled;")
    d.script('window.releasePreviewSave();')
    d.wait(lambda: d.script("return !document.querySelector('.publication-preview') && document.activeElement?.id==='writing-preview';"), 'Close restores toolbar focus')
    assert status() == 'Pages: open PDF preview'
    assert d.editor() == editor
    d.click('PDF preview', actions=True)
    d.wait(lambda: d.script("return document.activeElement?.textContent==='Close PDF preview';"), 'Reopened preview keyboard focus')
    d.command('POST', '/actions', {'actions':[{'type':'key','id':'preview-escape','actions':[
      {'type':'keyDown','value':'\ue00c'},{'type':'keyUp','value':'\ue00c'}]}]})
    d.wait(lambda: d.script("return !document.querySelector('.publication-preview') && document.activeElement?.id==='writing-preview';"), 'Native Escape closes to toolbar')
    assert d.editor() == editor and target.read_bytes() == expected
    d.close_session()
    # Actual renderer refusal for unavailable glyphs; exact-source Save survives.
    unsupported = 'INT. ROOM - DAY\n\nA lamp 😀 glows.\n'.encode()
    refused = d.ROOT / 'files/refused-preview.fountain'; refused.write_bytes(unsupported)
    d.click('Open Fountain', actions=True); d.picker(refused)
    d.wait(lambda: d.script("return document.querySelector('#writing-preview')?.disabled===false;"), 'Unsupported draft opens')
    d.click('PDF preview', actions=True)
    d.wait(lambda: 'PDF preview failed.' in status(), 'Actual native helper failure is visible', timeout=90)
    assert not d.script("return !!document.querySelector('.pdf-page canvas');")
    d.click('Save', actions=True); d.audit(refused, unsupported)
    d.close_session()
    report = {'initialStatus':initial, 'finalStatus':current, 'initialResult':result, 'currentResult':newer,
              'sourceSha256':hashlib.sha256(source).hexdigest(), 'savedSha256':hashlib.sha256(expected).hexdigest(),
              'coverage':'real native WebKit worker/canvas/text/count/zoom/focus/helper-refusal/Save; stale race uses delayed real IPC response'}
    (d.ROOT / 'publication-preview.json').write_text(json.dumps(report,indent=2)+'\n')
    # Exact M4 2400-row/120-key workload with preview open. Existing drill audits
    # every key and source byte; recorded rAF is explicitly not compositor paint.
    d.script('window.__TAURI_INTERNALS__.callbacks.set=window.originalCallbackSet;')
    from editor_exit import review_latency
    review_latency(d, preview=True)
    print('PASS authoritative offline PDF preview/count and failure/source isolation', flush=True)
