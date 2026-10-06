"""D-06 real close-request routing on disposable content, no mocked native port."""
import json
import re
import subprocess

from shutdown_lifecycle import processes
from shutdown_observer import ExitObserver


def request_window_close(d):
    clients = [c for c in d.owned_clients() if c.get('class') == 'babel-desktop']
    assert len(clients) == 1, clients
    client = clients[0]
    assert re.fullmatch(r'0x[0-9a-f]+', client['address']), client
    subprocess.run(['hyprctl', 'dispatch',
                    'hl.dsp.window.close({ window = "address:' + client['address'] + '" })'],
                   check=True, stdout=subprocess.DEVNULL)
    return client


def run(d):
    d.click('New screenplay', actions=True)
    d.wait(lambda: d.script("return document.querySelector('#writing-save')?.disabled === false;"), 'Untitled draft ready')
    # New screenplays start on a Scene Heading row; this drill writes Action (Mod+2).
    d.script("document.querySelector('.ProseMirror').focus();")
    d.command('POST', '/actions', {'actions': [{'type': 'key', 'id': 'writing-keyboard', 'actions': [{'type': 'keyDown', 'value': '\ue009'}, {'type': 'keyDown', 'value': '2'}, {'type': 'keyUp', 'value': '2'}, {'type': 'keyUp', 'value': '\ue009'}]}]})
    d.type_text('D06 native draft.')
    draft = b'!D06 native draft.\n'
    d.wait(lambda: any(s == draft for _, s in d.journal_records()), 'Independent exact untitled recovery bytes')
    request_window_close(d)
    d.wait(lambda: 'This draft has no Fountain file' in d.body(), 'Native untitled window close prompts')
    d.wait(lambda: d.script("return document.activeElement?.textContent;") == 'Close and keep recovery', 'Exact untitled choice receives focus after native window request')
    assert 'Saved locally' not in d.body()
    d.click('Keep writing')
    d.wait(lambda: d.script("return !document.querySelector('#close-heading') && document.activeElement?.classList.contains('ProseMirror');"), 'Cancel keeps the owned editor focused')
    assert d.editor_text() == 'D06 native draft.'
    d.close_session()
    assert any(s == draft for _, s in d.journal_records())

    source = b'\xef\xbb\xbf!D06 saved source.\r\n'
    path = d.ROOT / 'files' / 'd06-window.fountain'
    path.write_bytes(source)
    d.click('Open Fountain', actions=True); d.picker(path)
    d.wait(lambda: d.script("return document.querySelector('#writing-save')?.disabled === false;"), 'File-backed session ready')
    d.click('Save', actions=True)
    d.wait(lambda: d.script("return document.querySelector('[aria-label=\"Protection status\"] [role=status]')?.textContent.trim() === 'Saved locally';"), 'Plain exact source status')
    assert d.script("return document.querySelector('[aria-label=\"Protection status\"] details')?.open;") is False
    assert d.script("return document.querySelector('[aria-label=\"Protection status\"] details')?.textContent.includes('Recovery: journaled version');")
    d.audit(path, source)
    inventory = processes()
    clients = [c for c in d.owned_clients() if c.get('class') == 'babel-desktop']
    assert len(clients) == 1, clients
    owned = {clients[0]['pid']}
    while True:
        children = {pid for pid, p in inventory.items() if p['parent'] in owned}
        if children <= owned:
            break
        owned |= children
    observed = [inventory[pid] for pid in sorted(owned)]
    assert any(p['name'] == 'WebKitWebProces' for p in observed)
    with ExitObserver(observed, d.ROOT / 'webdriver.log', d.ROOT / 'd06-window-exit.json'):
        request_window_close(d)

        def exited():
            current = processes()
            return all(p['pid'] not in current or current[p['pid']]['start'] != p['start']
                       or current[p['pid']]['state'] == 'Z' for p in observed)

        d.wait(exited, 'File-backed native window exits after protected close', timeout=30)
    d.audit(path, source)
    # Only stale automation bookkeeping remains after the observed ordinary exit.
    try:
        d.command('DELETE', '')
    except Exception:
        pass
    d.SESSION = None
    d.new_session()
    d.click('Open Fountain', actions=True); d.picker(path)
    d.wait(lambda: d.script("return document.querySelector('#writing-save')?.disabled === false;"), 'Native lease released; same file reopens writable')
    d.assert_identical_reopen()
    d.close_session()
    d.audit(path, source)
    (d.ROOT / 'd06-status-close.json').write_text(json.dumps({
        'untitledWindowPrompt': True, 'cancelRetainsEditor': True,
        'windowDestinationCleared': True, 'plainStatus': 'Saved locally',
        'detailsInitiallyClosed': True, 'fileWindowClose': 'ordinary',
        'writableReopen': True, 'sourceHex': source.hex(),
        'draftHex': draft.hex(), 'ownedExitProcesses': observed,
    }, indent=2) + '\n')
    print('PASS D06 native untitled window prompt / Keep writing / recovery-only close / plain status / automatic file window exit / writable reopen / exact BOM-CRLF bytes', flush=True)
