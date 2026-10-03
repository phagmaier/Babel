"""M5-07 integrated default/package publication gate on synthetic content."""
import hashlib
import json
import shutil
import subprocess
import time


def run(d):
    started = time.monotonic()
    source = (d.REPO / 'fixtures/publication/elements.fountain').read_bytes()
    target = d.ROOT / 'files/integrated.fountain'
    target.write_bytes(source)
    d.click('Open Fountain', actions=True)
    d.picker(target)
    d.wait(lambda: d.script("return document.querySelector('#writing-preview')?.disabled===false;"), 'Integrated preview enabled', timeout=60)
    editor = d.editor()
    d.script("""window.integratedRenders=[];window.integratedExports=[];
      const callbacks=window.__TAURI_INTERNALS__.callbacks;
      window.integratedSet=callbacks.set;
      callbacks.set=function(id,callback){return window.integratedSet.call(this,id,data=>{
        if(data?.artifact&&data?.pageCount)window.integratedRenders.push(data);
        if(data?.publication&&data?.result)window.integratedExports.push(data);
        callback(data);});};""")

    def status():
        return d.script("return document.querySelector('[aria-label=\"Publication page count\"]').textContent;")

    d.click('PDF preview', actions=True)
    d.wait(lambda: 'pages · preview version' in status(), 'Integrated current preview', timeout=90)
    preview = d.script('return window.integratedRenders.at(-1);')
    preview_path = d.ROOT / 'cache/app.babel.screenwriter/publication' / (preview['artifact'] + '.pdf')
    retained = d.ROOT / 'preview-captured.pdf'
    shutil.copyfile(preview_path, retained)
    # Actual viewer text/ink and source isolation, before export retires the cache.
    assert d.script("return document.querySelector('.publication-preview pre')?.textContent.includes('THE SIGNAL');")
    d.screenshot('integrated-preview')
    d.click('Export PDF', actions=True)
    d.wait(lambda: 'Review captured version' in d.script("return document.querySelector('.export-pdf-panel')?.textContent||'';"), 'Integrated captured review', timeout=60)
    assert 'stale' in status(), status()
    captured = max(metadata['version'] for metadata, content in d.journal_records() if content == source)
    assert preview['version'] == captured, (preview, captured)
    # Supported corpus has no blocking publication limitation. Structural advice
    # may still require the ordinary explicit review acknowledgment.
    if d.script("return !!document.querySelector('.export-pdf-panel input[type=checkbox]');"):
        checkbox = d.find('//section[@aria-label="PDF export"]//input[@type="checkbox"]')
        d.command('POST', '/element/' + checkbox + '/click', {})
    d.click('Choose PDF destination')
    destination = d.ROOT / 'files/Integrated.pdf'
    d.picker(destination)
    d.wait(lambda: 'Exported Integrated.pdf' in d.script("return document.querySelector('.export-pdf-panel')?.textContent||'';"), 'Integrated verified export', timeout=90)
    receipt = d.script('return window.integratedExports.at(-1);')
    result = receipt['result']
    for field in ['identity', 'version', 'sourceSha256', 'sourceBytes', 'pageCount', 'profile', 'fontSet', 'fonts', 'renderer', 'profileFrozen', 'sourceMap']:
        assert preview[field] == result[field], (field, preview, result)
    assert result['sourceSha256'] == hashlib.sha256(source).hexdigest()
    assert receipt['publication']['pdfSha256'] == hashlib.sha256(destination.read_bytes()).hexdigest()
    # Compare independent layout/text/boxes and rendered pages, not PDF metadata.
    from xml.etree import ElementTree as ET
    layouts = []
    for name, path in [('preview', retained), ('export', destination)]:
        bbox = subprocess.check_output(['pdftotext', '-bbox-layout', str(path), '-'])
        layouts.append(ET.tostring(ET.fromstring(bbox).find('{http://www.w3.org/1999/xhtml}body')))
        subprocess.run(['pdftoppm', '-r', '72', '-png', str(path), str(d.ROOT / name)], check=True, capture_output=True)
    assert layouts[0] == layouts[1], 'Same-capture preview/export layout differs'
    images = sorted(d.ROOT.glob('preview-[0-9]*.png'))
    assert len(images) == result['pageCount'] == 2
    for image in images:
        assert image.read_bytes() == (d.ROOT / image.name.replace('preview-', 'export-', 1)).read_bytes()
    d.wait(lambda: f"preview version {captured}" in status(), 'Same-version preview resumes', timeout=90)
    d.click('Save', actions=True)
    d.audit(target, source)
    assert d.editor() == editor
    d.screenshot('integrated-export')
    d.close_session()
    d.script('window.__TAURI_INTERNALS__.callbacks.set=window.integratedSet;')
    agreement = {'preview': preview, 'export': receipt, 'sourceSha256': hashlib.sha256(source).hexdigest(),
                 'pages': len(images), 'layoutAndRasterAgree': True, 'elapsedSeconds': round(time.monotonic() - started, 3)}
    (d.ROOT / 'publication-exit.json').write_text(json.dumps(agreement, indent=2) + '\n')
    # Keep existing native refusal/cancel/replacement/typing-Save and stale-preview
    # oracles, including the unchanged bounded preview-open typing measurement.
    from pdf_export import run as run_export
    from publication_preview import run as run_preview
    run_export(d)
    run_preview(d)
    print('PASS integrated same-capture preview/export layout/raster, native failures and stale races', flush=True)
