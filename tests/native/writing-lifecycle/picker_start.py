"""M6-14: a native Save As given only a filename saves into the writer's home.

An AppImage runs with its working directory inside the read-only package
mount, where GTK would otherwise open the save picker. HOME is this drill's
own disposable folder; expected bytes are authored here.
"""
import hashlib
import json
import os
from pathlib import Path

NAME = 'picker-start.fountain'
EXPECTED = b'!Rain on the pier.\n'


def run(d):
    home = Path(d.ENV['HOME'])
    assert home == d.ROOT / 'home' and home.is_dir() and not list(home.iterdir()), home
    client = next(c for c in d.owned_clients() if c.get('class') == 'babel-desktop')
    working = Path(os.readlink(f'/proc/{client["pid"]}/cwd'))
    report = {'home': str(home), 'workingDirectory': str(working),
              'executable': os.readlink(f'/proc/{client["pid"]}/exe')}
    d.click('New screenplay', actions=True)
    d.wait(lambda: 'Protect draft' in d.body(), 'New draft opens')
    d.script("document.querySelector('.ProseMirror').focus();")
    d.command('POST', '/actions', {'actions': [{'type': 'key', 'id': 'writing-keyboard', 'actions': [
        {'type': 'keyDown', 'value': '\ue009'}, {'type': 'keyDown', 'value': '2'},
        {'type': 'keyUp', 'value': '2'}, {'type': 'keyUp', 'value': '\ue009'}]}]})
    d.type_text('Rain on the pier.')
    d.wait(lambda: d.editor_text() == 'Rain on the pier.', 'Typed action visible')
    d.click('Save As', actions=True)
    # A relative name: the picker's own starting folder decides the destination.
    d.picker(Path(NAME))
    report['afterPicker'] = d.script("return document.querySelector('[aria-label=\"Protection status\"]')?.innerText ?? '';")
    (d.ROOT / 'picker-start.json').write_text(json.dumps(report, indent=2) + '\n')
    d.audit(home / NAME, EXPECTED)
    d.wait(lambda: 'Saved locally' in d.body(), 'Save As adopted and saved')
    assert [p.name for p in home.iterdir()] == [NAME], list(home.iterdir())
    assert not (working / NAME).exists()
    d.close_session()
    d.audit(home / NAME, EXPECTED)
    report.update(saved=str(home / NAME), sha256=hashlib.sha256(EXPECTED).hexdigest())
    (d.ROOT / 'picker-start.json').write_text(json.dumps(report, indent=2) + '\n')
    print('PASS bare-filename Save As lands in the home folder', json.dumps(report), flush=True)
    print('ARTIFACTS', d.ROOT, flush=True)
