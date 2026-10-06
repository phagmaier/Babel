"""Previous-package writers and next-package readers in one synthetic profile.

Trusted UI controls mutate the app; scripts only observe DOM/localStorage or
place focus. Fixture/schema mutations are explicit filesystem test inputs.
"""
import hashlib
import json
from pathlib import Path

SOURCE = ('\ufeffTitle: Update drill\r\nX-Private: retain  \r\n\r\n'
          '!Zoë reads Zøëvexia and helllo.  \r\n\r\n'
          '[[Unknown note stays.]]\r\n/* Retained omission. */\r\n').encode()
CURRENT = SOURCE.replace('!Zoë'.encode(), '!Updated Zoë'.encode())
DRAFT = b'!Unfinished update draft.\n'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def ready(d):
    d.wait(lambda: d.script("return document.querySelector('#writing-save')?.disabled===false && !!document.querySelector('.ProseMirror');"),
           'Writable update screenplay', timeout=60)


def activate(d, xpath):
    element = d.wait(lambda: d.find(xpath), 'Update control: ' + xpath)
    d.script("arguments[0].scrollIntoView({block:'center'});", [{d.ELEMENT: element}])
    d.command('POST', f'/element/{element}/click', {})


def save(d, path, expected):
    ready(d); d.click('Save', actions=True); d.audit(path, expected)
    d.wait(lambda: 'Saved locally' in d.body(), 'Exact update Save receipt')
    d.wait(lambda: any(source == expected for _, source in d.journal_records()), 'Exact update recovery bytes')
    ready(d)


def open_source(d, path):
    d.click('Open Fountain', actions=True); d.picker(path)
    ready(d); d.assert_identical_reopen()


def restore(d, path, expected):
    activate(d, '//li[contains(.,"Before package update")]//button[normalize-space(.)="Restore previous version"]')
    d.wait(lambda: 'Restored as new version' in d.body(), 'Old snapshot restored', timeout=60)
    save(d, path, expected)


def prepare(d):
    report = {'checks': [], 'dictionaryProvenance': 'Seeded fixture; old package UI reads and republishes it'}
    target = d.ROOT / 'files/update.fountain'
    seed = d.ROOT / 'files/seed.fountain'; seed.write_bytes(SOURCE)
    open_source(d, seed)
    d.click('Save As', actions=True); d.picker(target); save(d, target, SOURCE)
    d.set_input('Snapshot name', 'Before package update'); d.click('Keep named snapshot')
    d.wait(lambda: 'Named snapshot protected' in d.body(), 'Previous package named snapshot')
    d.script("const p=[...document.querySelectorAll('.ProseMirror > p[data-kind=action]')].find(p=>p.textContent.startsWith('Zoë reads'));p.closest('.ProseMirror').focus();const w=document.createTreeWalker(p,NodeFilter.SHOW_TEXT),n=w.nextNode();getSelection().setBaseAndExtent(n,0,n,0);")
    d.type_text('Updated '); save(d, target, CURRENT)
    # Native restore also creates the old package's safety/history material.
    restore(d, target, SOURCE); d.type_text('\ue009z\ue000'); save(d, target, CURRENT)
    report['checks'].append('Old package Save As/edit/named snapshot/restore/Undo; exact BOM/CRLF/unknown material')
    for label, value in [('Theme', 'dark'), ('Writing zoom', '125')]:
        activate(d, '//select[@aria-label=' + json.dumps(label) + ']/option[@value=' + json.dumps(value) + ']')
    activate(d, '//label[contains(.,"Typewriter scroll")]/input')
    report['preferences'] = d.script("return JSON.parse(localStorage.getItem('babel.view.v1'));")
    d.click('Spellcheck', actions=True)
    d.wait(lambda: '1 added' in d.body(), 'Previous package reads local word')
    for expected in [False, True]:
        activate(d, '//input[@aria-label="Enable spellcheck" and not(@disabled)]')
        d.wait(lambda: d.script("return document.querySelector('[aria-label=\"Enable spellcheck\"]')?.checked;") is expected,
               'Old package spelling preference updated')
        d.wait(lambda: latest_dictionary(d)['settings']['enabled'] is expected,
               'Old package durable spelling generation')
    report['dictionary'] = latest_dictionary(d)
    assert report['dictionary']['generation'] >= 3
    assert report['dictionary']['settings']['added'] == [{'language': 'en_US', 'word': 'Zøëvexia'}]
    d.click('Close spellcheck'); d.close_session()
    d.click('New screenplay', actions=True)
    d.wait(lambda: 'Protect draft' in d.body(), 'New recovery draft')
    d.script("document.querySelector('.ProseMirror').focus();")
    d.command('POST', '/actions', {'actions': [{'type': 'key', 'id': 'update-action', 'actions': [
        {'type': 'keyDown', 'value': '\ue009'}, {'type': 'keyDown', 'value': '2'},
        {'type': 'keyUp', 'value': '2'}, {'type': 'keyUp', 'value': '\ue009'}]}]})
    d.type_text('Unfinished update draft.'); d.click('Protect draft', actions=True)
    d.wait(lambda: any(s == DRAFT for _, s in d.journal_records()), 'Previous package unsaved recovery')
    d.close_session()
    record = [(m, s) for m, s in d.journal_records() if s == DRAFT][-1][0]
    report['draft'] = record
    app = d.ROOT / 'data/app.babel.screenwriter'
    journal = app / 'recovery' / (record['documentId'] + '.journal')
    assert journal.is_file()
    report['draftJournal'] = {'path': str(journal), 'sha256': digest(journal)}
    report['snapshotFiles'] = {str(p): digest(p) for p in (app / 'snapshots').rglob('*') if p.is_file()}
    assert report['snapshotFiles'] and any(p.read_bytes() == SOURCE for p in (app / 'snapshots').rglob('*') if p.is_file())
    report['historyFiles'] = {str(p): digest(p) for p in (app / 'history').rglob('*') if p.is_file()}
    assert report['historyFiles'], 'Previous native safety history required'
    d.screenshot('update-prepared')
    (d.ROOT / 'update-prepared.json').write_text(json.dumps(report, indent=2) + '\n')
    print('PASS previous package prepared source/snapshot/history/recovery/preferences/dictionary', flush=True)


def latest_dictionary(d):
    slots = [json.loads(p.read_bytes()) for p in (d.ROOT / 'data/app.babel.screenwriter').glob('spellcheck-[01].json')]
    return max(slots, key=lambda g: g['generation'])


def verify(d):
    prepared = json.loads((d.ROOT / 'update-prepared.json').read_text())
    report = {'checks': []}
    output = d.ROOT / 'update-verified.json'

    def record(check):
        report['checks'].append(check)
        output.write_text(json.dumps(report, indent=2) + '\n')
        print('UPDATE', check, flush=True)

    target = d.ROOT / 'files/update.fountain'
    assert target.read_bytes() == CURRENT
    assert all(digest(Path(p)) == sha for p, sha in prepared['snapshotFiles'].items())
    assert all(digest(Path(p)) == sha for p, sha in prepared['historyFiles'].items())
    assert digest(Path(prepared['draftJournal']['path'])) == prepared['draftJournal']['sha256']
    assert latest_dictionary(d) == prepared['dictionary']
    assert d.script("return JSON.parse(localStorage.getItem('babel.view.v1'));") == prepared['preferences']
    record('New package reads old preferences; source, snapshots, history, unsaved journal and dictionary intact before writing')
    open_source(d, target); save(d, target, CURRENT)
    d.click('Spellcheck', actions=True)
    d.wait(lambda: 'en_US (available)' in d.body() and '1 added' in d.body(), 'New packaged provider with retained word')
    d.click('Check spelling')
    d.wait(lambda: 'possible spelling issues' in d.body(), 'Packaged spelling results')
    issues = d.script("return [...document.querySelectorAll('.spellcheck-panel li button')].map(b=>b.textContent);")
    assert any('helllo' in s for s in issues) and not any('Zøëvexia' in s for s in issues), issues
    d.click('Close spellcheck')
    record('Old local word remains effective in new package; deliberate misspelling detected; source unchanged')
    restore(d, target, SOURCE)
    d.type_text('\ue009z\ue000'); save(d, target, CURRENT)
    # Trusted Redo, then Undo back to the current manuscript.
    d.script("document.querySelector('.ProseMirror').focus();")
    d.command('POST', '/actions', {'actions': [{'type': 'key', 'id': 'update-redo', 'actions': [
        {'type': 'keyDown', 'value': '\ue009'}, {'type': 'keyDown', 'value': '\ue008'},
        {'type': 'keyDown', 'value': 'z'}, {'type': 'keyUp', 'value': 'z'},
        {'type': 'keyUp', 'value': '\ue008'}, {'type': 'keyUp', 'value': '\ue009'}]}]})
    save(d, target, SOURCE); d.type_text('\ue009z\ue000'); save(d, target, CURRENT)
    d.close_session()
    record('Old named snapshot restored by new native reader; Save/Undo/Redo preserve literal bytes and current draft')
    meta = prepared['draft']
    candidate = '//li[h3[normalize-space(.)="Draft ' + meta['documentId'] + '"]]/ul/li[p[contains(.,"generation ' + str(meta['generation']) + ' ·")]]//button[normalize-space(.)="Resume as new draft"]'
    activate(d, candidate)
    d.wait(lambda: d.editor_text() == 'Unfinished update draft.', 'Old full draft resumed')
    ready(d)
    recovered = d.ROOT / 'files/recovered.fountain'
    activate(d, '//div[@aria-label="Screenplay actions"]//button[normalize-space(.)="Save As" and not(@disabled)]')
    d.picker(recovered); save(d, recovered, DRAFT)
    assert digest(Path(prepared['draftJournal']['path'])) == prepared['draftJournal']['sha256']
    d.close_session()
    record('Old unsaved checkpoint resumed and saved exactly; original checkpoint remains byte-identical')
    # Unknown future project schema: read-only and safe copy, no repair/delete.
    folder = d.ROOT / 'files/future é'; folder.mkdir(mode=0o700)
    future_source = folder / 'future.fountain'; future_source.write_bytes(SOURCE)
    aux = folder / '.screenwriter'; aux.mkdir(mode=0o700)
    metadata = aux / 'project.json'
    future = b'{"schemaVersion":999,"projectId":"11111111-1111-4111-8111-111111111111","sourceFilename":"future.fountain","pdfProfile":"future","unknown":{"keep":true}}\n'
    metadata.write_bytes(future); metadata.chmod(0o600)
    d.click('Open Fountain', actions=True); d.picker(future_source)
    d.wait(lambda: d.script("return document.querySelector('.ProseMirror')?.getAttribute('contenteditable')==='false';"), 'Unknown future schema view-only')
    assert d.script("return document.querySelector('#writing-save')?.disabled;")
    report['futureSchemaUI'] = d.body()
    d.screenshot('update-future-schema')
    copy = d.ROOT / 'files/future-safe-copy.fountain'
    activate(d, '//div[@aria-label="Screenplay actions"]//button[normalize-space(.)="Save As" and not(@disabled)]')
    d.picker(copy); save(d, copy, SOURCE)
    assert future_source.read_bytes() == SOURCE and metadata.read_bytes() == future
    d.close_session()
    record('Unknown future project opens view-only; Save disabled; safe Save As exact; original source/metadata untouched')
    open_source(d, target); save(d, target, CURRENT); d.close_session()
    assert latest_dictionary(d) == prepared['dictionary']
    assert all(digest(Path(p)) == sha for p, sha in prepared['snapshotFiles'].items())
    assert all(digest(Path(p)) == sha for p, sha in prepared['historyFiles'].items()
               if '/objects/' in p or '/refs/safety/' in p)
    record('Updated source reopens writable after restores/refusal; dictionary generations unchanged')
    print('PASS M6-14 previous-to-next packaged update/readback/refusal', flush=True)
