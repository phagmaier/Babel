"""M5-06 actual default-release WebKit/GTK export on disposable author content."""
import hashlib
import json
import subprocess
import time


def run(d):
    report = []
    existing_pdfs = {p.name: p.read_bytes() for p in (d.ROOT/'files').glob('*.pdf')}
    source = b'\xef\xbb\xbfTitle: Export study\r\n\r\nINT. ROOM - DAY\r\n\r\n!A lamp glows.\r\n'
    target = d.ROOT / 'files/export.fountain'; target.write_bytes(source)
    d.click('Open Fountain', actions=True); d.picker(target)

    def panel():
        return d.script("return document.querySelector('.export-pdf-panel')?.textContent || '';")

    def ready():
        d.wait(lambda: d.script("return [...document.querySelectorAll('[aria-label=\"Screenplay actions\"] button')].some(b=>b.textContent==='Export PDF'&&!b.disabled);"), 'Native Export PDF command enabled', timeout=60)

    def start(palette=False):
        ready()
        if palette:
            d.click('Command Palette')
            query=d.find('//input[@id="palette-query"]');d.command('POST','/element/'+query+'/value',{'text':'Export PDF'})
            item=d.wait(lambda:d.find('//li[@role="option"][starts-with(normalize-space(.),"Export PDF")]'),'Native palette export command')
            d.command('POST','/element/'+item+'/click',{})
        else: d.click('Export PDF', actions=True)

    def review(palette=False):
        # A capture with a warning or limitation stops for an informed decision.
        start(palette)
        d.wait(lambda: 'Review captured version' in panel(), 'Exact protected capture review', timeout=60)

    def direct(palette=False):
        # AUDIT-D04: nothing to review, so the protected capture goes straight
        # to the native destination picker; no review step or checkbox exists.
        start(palette)
        d.wait(lambda: 'Choose a destination for version' in panel(), 'Clean capture goes straight to the destination picker', timeout=60)
        assert 'Review captured version' not in panel()
        assert not d.script("return !!document.querySelector('.export-pdf-panel input[type=checkbox]') || [...document.querySelectorAll('.export-pdf-panel button')].some(b=>b.textContent==='Choose PDF destination');")

    def success(name):
        d.wait(lambda: 'Exported '+name in panel(), 'Verified native PDF receipt', timeout=90)

    def acknowledge():
        element = d.find('//section[@aria-label="PDF export"]//input[@type="checkbox"]')
        d.command('POST', '/element/'+element+'/click', {})

    # Observe actual IPC replies. Delay one real result to exercise editing/Save
    # after capture and before publication; no renderer or destination is mocked.
    d.script("""window.exportEvents=[];const callbacks=window.__TAURI_INTERNALS__.callbacks;
      window.exportOriginalSet=callbacks.set;callbacks.set=function(id,callback){return window.exportOriginalSet.call(this,id,data=>{
        if(data?.artifact&&data?.pageCount&&window.holdExport){window.holdExport=false;window.releaseExport=()=>callback(data);return;}
        if(data?.publication&&data?.result)window.exportEvents.push(data);callback(data);});};""")
    ready(); editor = d.editor()
    d.click('PDF preview', actions=True)
    d.wait(lambda: 'preview version' in d.script("return document.querySelector('[aria-label=\"Publication page count\"]').textContent;"), 'Authoritative preview before export', timeout=90)
    direct(palette=True)
    d.screenshot('export-direct')
    d.picker()
    d.wait(lambda: 'cancelled' in panel(), 'GTK picker cancellation writes nothing')
    ready()
    assert {p.name: p.read_bytes() for p in (d.ROOT/'files').glob('*.pdf')} == existing_pdfs
    d.script('window.holdExport=true;'); direct()
    capture_version=max(metadata['version'] for metadata,content in d.journal_records() if content == source)
    destination = d.ROOT/'files/Captured.pdf'; d.picker(destination)
    d.wait(lambda: d.script("return typeof window.releaseExport==='function';"), 'Actual native export result held', timeout=90)
    assert not destination.exists()
    action = d.find("//div[contains(@class,'ProseMirror')]/p[@data-kind='action' and normalize-space(.)='A lamp glows.']")
    d.command('POST', '/element/'+action+'/click', {}); d.type_text('\ue011X')
    later = source.replace(b'A lamp',b'XA lamp')
    d.click('Save', actions=True); d.audit(target,later)
    assert d.editor() == editor
    assert d.script("return [...document.querySelectorAll('[aria-label=\"Screenplay actions\"] button')].find(b=>b.textContent==='Close session').disabled;")
    d.script('window.releaseExport();'); success('Captured.pdf')
    receipt = d.script('return window.exportEvents.at(-1);')
    assert receipt['result']['version'] == capture_version and receipt['result']['sourceSha256'] == hashlib.sha256(source).hexdigest(), receipt
    text = subprocess.check_output(['pdftotext',str(destination),'-'],text=True)
    assert 'A lamp glows.' in text and 'XA lamp' not in text
    pages = int(next(line.split(':',1)[1] for line in subprocess.check_output(['pdfinfo',str(destination)],text=True).splitlines() if line.startswith('Pages:')))
    assert pages == receipt['result']['pageCount'] == 2
    assert hashlib.sha256(destination.read_bytes()).hexdigest() == receipt['publication']['pdfSha256']
    saved_version = max(metadata['version'] for metadata,content in d.journal_records() if content == later)
    d.wait(lambda: f'preview version {saved_version}' in d.script("return document.querySelector('[aria-label=\"Publication page count\"]').textContent;"), 'Preview resumes with later protected version', timeout=90)
    report.append({'captureWhileTyping':receipt,'actualPages':pages})
    # Actual destination replacement retains independently readable previous PDF.
    previous = destination.read_bytes(); direct(); d.picker(destination,overwrite=True); success('Captured.pdf')
    receipt = d.script('return window.exportEvents.at(-1);')
    assert receipt['result']['version'] >= saved_version and receipt['result']['sourceSha256'] == hashlib.sha256(later).hexdigest() and receipt['publication']['previousFileName']
    assert (destination.parent/receipt['publication']['previousFileName']).read_bytes() == previous
    assert 'XA lamp glows.' in subprocess.check_output(['pdftotext',str(destination),'-'],text=True)
    report.append({'atomicReplacement':receipt})
    # Native refusal paths use the real picker, with no caller path authority.
    for refused in [target,d.ROOT/'data/app.babel.screenwriter/Refused.pdf']:
        before = target.read_bytes(); direct();d.picker(refused,overwrite=refused.exists())
        d.wait(lambda: 'needs attention' in panel(), 'Protected native destination refusal', timeout=60)
        assert target.read_bytes() == before
        if refused != target: assert not refused.exists()
    # Permission changed after native selection, before publish; old PDF intact.
    d.script('window.holdExport=true;delete window.releaseExport;'); direct();d.picker(destination,overwrite=True)
    d.wait(lambda: d.script("return typeof window.releaseExport==='function';"), 'Real result held before permission fault', timeout=90)
    old = destination.read_bytes(); destination.parent.chmod(0o500)
    try:
        d.script('window.releaseExport();');d.wait(lambda: 'needs attention' in panel(), 'Actual destination permission refusal', timeout=60)
        assert destination.read_bytes() == old and target.read_bytes() == later
    finally: destination.parent.chmod(0o700)
    d.click('Save',actions=True);d.audit(target,later)
    d.screenshot('export-status')
    d.close_session()
    # AUDIT-D04: a closed note is summarised and needs no decision. Text the
    # renderer would drop still needs an unchecked decision; glyph refusal stays.
    file = d.ROOT/'files/omissions.fountain';manuscript = b'INT. ROOM - DAY\n\nA lamp glows.\n\n[[Private omitted note]]\n'
    file.write_bytes(manuscript);d.click('Open Fountain',actions=True);d.picker(file);direct()
    assert 'Not printed by this profile: 1 note (1 line).' in panel() and 'SC005' not in panel(), panel()
    d.screenshot('export-omissions-direct')
    pdf=d.ROOT/'files/omissions.pdf';d.picker(pdf);success('omissions.pdf')
    exported = subprocess.check_output(['pdftotext',str(pdf),'-'],text=True)
    assert 'A lamp glows.' in exported and 'Private omitted' not in exported
    d.click('Save',actions=True);d.audit(file,manuscript);d.close_session()
    for name,manuscript,code,should_render in [('dropped',b'INT. ROOM - DAY\n\nA lamp glows.\n\n#1 DAD mug sits on the desk.\n','SC005',True),('glyphs','INT. ROOM - DAY\n\nA lamp 😀 glows.\n'.encode(),'SC008',False)]:
        file = d.ROOT/'files'/f'{name}.fountain';file.write_bytes(manuscript)
        d.click('Open Fountain',actions=True);d.picker(file);review()
        assert code in panel()
        assert not d.script("return document.querySelector('.export-pdf-panel input').checked;")
        assert d.script("return [...document.querySelectorAll('.export-pdf-panel button')].find(b=>b.textContent==='Choose PDF destination').disabled;")
        # Cancelling the review writes nothing; the next export recaptures.
        d.click('Cancel export'); ready()
        assert 'cancelled' in panel() and not (d.ROOT/'files'/f'{name}.pdf').exists()
        review()
        acknowledge();d.screenshot('export-'+name+'-review')
        d.click('Choose PDF destination');pdf=d.ROOT/'files'/f'{name}.pdf';d.picker(pdf)
        if should_render:
            success(name+'.pdf');exported = subprocess.check_output(['pdftotext',str(pdf),'-'],text=True)
            # The acknowledged limitation is real: the pinned renderer drops this line.
            assert 'A lamp glows.' in exported and 'DAD mug' not in exported
        else:
            d.wait(lambda: 'needs attention' in panel(), 'Actual glyph renderer refusal',timeout=90);assert not pdf.exists()
        d.click('Save',actions=True);d.audit(file,manuscript);d.close_session()
    d.script('window.__TAURI_INTERNALS__.callbacks.set=window.exportOriginalSet;')
    (d.ROOT/'pdf-export.json').write_text(json.dumps(report,indent=2)+'\n')
    print('PASS native PDF export direct capture/GTK cancel/replacement/protected-path/failure/omission summary/gated review+cancel/glyph refusal/source isolation',flush=True)
