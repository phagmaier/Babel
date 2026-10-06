"""M6-14: the package on a host without spelling resources says so and keeps writing.

The packaged runner hides the system Enchant provider and/or Hunspell
dictionaries from the app only. No fallback engine, crash or false clean
result is acceptable; Save must stay exact.
"""
import hashlib
import json
import os
from pathlib import Path

SOURCE = b'!Helllo from the pier.\n'


def run(d):
    target = d.ROOT / 'files' / 'unavailable.fountain'
    target.write_bytes(SOURCE)
    d.click('Open Fountain', actions=True); d.picker(target)
    d.wait(lambda: d.script("return document.querySelector('#writing-save')?.disabled===false && !!document.querySelector('.ProseMirror');"), 'Writable editor')
    client = next(c for c in d.owned_clients() if c.get('class') == 'babel-desktop')
    hidden = [path for path in os.environ['BABEL_MASKED_DIRECTORIES'].split(os.pathsep) if 'enchant' in path or 'spell' in path]
    assert hidden, 'Run through the packaged runner with spelling resources masked'
    # Witness the mask inside the app's own mount namespace.
    for path in hidden:
        assert not list(Path(f'/proc/{client["pid"]}/root{path}').iterdir()), path

    def panel():
        return d.script("return document.querySelector('.spellcheck-panel')?.innerText;") or ''

    d.click('Spellcheck')
    d.wait(lambda: 'No offline dictionary for en_US' in panel(), 'Unavailable dictionary stated', timeout=30)
    text = panel()
    assert 'Effective spelling language: en_US (unavailable)' in text, text
    assert 'No installed offline dictionary for en_US. Writing and saving remain available.' in text, text
    assert d.script("return [...document.querySelectorAll('.spellcheck-panel button')].find(b=>b.textContent==='Check spelling').disabled;")
    assert d.script("return [...document.querySelectorAll('select[aria-label=\"Spelling language\"] option')].map(o=>o.textContent);") == ['en_US (unavailable)']
    assert not d.script("return document.querySelectorAll('.ProseMirror .spelling-issue').length;")
    d.screenshot('spellcheck-unavailable')
    # Writing and exact saving do not depend on spelling.
    d.click('Close spellcheck')
    d.script("document.querySelector('.ProseMirror').focus();")
    d.command('POST', '/actions', {'actions': [{'type': 'key', 'id': 'writing-keyboard', 'actions': [
        {'type': 'keyDown', 'value': '\ue009'}, {'type': 'keyDown', 'value': '\ue010'},
        {'type': 'keyUp', 'value': '\ue010'}, {'type': 'keyUp', 'value': '\ue009'}]}]})
    d.type_text(' Still writing.')
    expected = b'!Helllo from the pier. Still writing.\n'
    d.audit(target, expected)
    d.wait(lambda: 'Saved locally' in d.body(), 'Exact save without spelling resources')
    d.close_session(); d.audit(target, expected)
    mapped = sorted({line.split(None, 5)[5].strip() for line in Path(f'/proc/{client["pid"]}/maps').read_text().splitlines()
                     if len(line.split(None, 5)) == 6 and ('enchant' in line or 'hunspell' in line)})
    report = {'hiddenFromApp': hidden, 'panel': text, 'mappedSpellingLibraries': mapped,
              'bytes': len(expected), 'sha256': hashlib.sha256(expected).hexdigest()}
    (d.ROOT / 'spellcheck-unavailable.json').write_text(json.dumps(report, indent=2) + '\n')
    print('PASS missing spelling resources are visible; writing and Save unaffected', json.dumps(report), flush=True)
    print('ARTIFACTS', d.ROOT, flush=True)
