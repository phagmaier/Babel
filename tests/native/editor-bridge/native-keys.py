"""M3-05 real Wayland/WebKit keys on an owned synthetic window only."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time

log = Path(sys.argv[1])
title = 'babel M3-04 synthetic editor bridge'
original = b'\n@MAYA\nSignal.\n\n!A bell.\n'

def reports():
    return [json.loads(line.split(' ', 1)[1]) for line in log.read_text().splitlines()
            if line.startswith('M1_COMPOSITION_PROOF ')]

def wait(event, previous):
    until = time.monotonic() + 10
    while time.monotonic() < until:
        for item in reports()[previous:]:
            if item.get('task') == 'M3-05' and item['event'] == 'error':
                raise AssertionError(item['error'])
            if item.get('task') == 'M3-05' and item['event'] == event:
                assert item['nativeHost'] and 'AppleWebKit' in item['userAgent']
                source = bytes(item['snapshot']['source'])
                assert hashlib.sha256(source).hexdigest() == item['snapshot']['sha256']
                assert item['status'] == 'current'
                return item
        time.sleep(0.1)
    raise AssertionError(f'No M3-05 report: {event}')

def focus():
    clients = [item for item in json.loads(subprocess.check_output(['hyprctl', '-j', 'clients']))
               if item.get('title') == title and item.get('class') == 'babel-desktop']
    assert len(clients) == 1, 'Exactly one owned synthetic window required'
    target = clients[0]['address']
    assert target.startswith('0x') and all(c in '0123456789abcdef' for c in target[2:])
    subprocess.run(['hyprctl', 'dispatch', 'hl.dsp.focus({ window = "address:' + target + '" })'],
                   check=True, stdout=subprocess.DEVNULL)
    active = json.loads(subprocess.check_output(['hyprctl', '-j', 'activewindow']))
    assert active.get('title') == title and active.get('class') == 'babel-desktop'

def key(*args, event='observed'):
    focus()
    previous = len(reports())
    subprocess.run(['wtype', *args], check=True)
    if event == 'observed':
        time.sleep(0.3)
        subprocess.run(['wtype', '-k', 'F8'], check=True)
    return wait(event, previous)

opened = key('-k', 'F2', event='opened')
assert bytes(opened['snapshot']['source']) == original
before = key('-k', 'F11', event='action-end')
entered = key('-k', 'Return')
assert bytes(entered['snapshot']['source']) == b'\n@MAYA\nSignal.\n\n!A bell.\n\n'
assert entered['snapshot']['selection']['head']['sourceIndex'] == 5
assert entered['snapshot']['selection']['head']['utf16Offset'] == 0
assert entered['snapshot']['version'] > before['snapshot']['version']
undone = key('-M', 'ctrl', '-k', 'z', '-m', 'ctrl')
assert bytes(undone['snapshot']['source']) == original
assert undone['snapshot']['selection'] == before['snapshot']['selection']
redone = key('-M', 'ctrl', '-M', 'shift', '-k', 'z', '-m', 'shift', '-m', 'ctrl')
assert bytes(redone['snapshot']['source']) == bytes(entered['snapshot']['source'])
assert redone['snapshot']['selection'] == entered['snapshot']['selection']

opened = key('-k', 'F2', event='opened')
start = key('-k', 'F12', event='action-start')
joined = key('-k', 'BackSpace')
assert bytes(joined['snapshot']['source']) == b'\n@MAYA\nSignal.\n!A bell.\n'
assert joined['snapshot']['selection']['head']['sourceIndex'] == 3
restored = key('-M', 'ctrl', '-k', 'z', '-m', 'ctrl')
assert bytes(restored['snapshot']['source']) == original
assert restored['snapshot']['selection'] == start['snapshot']['selection']

opened = key('-k', 'F2', event='opened')
before = key('-k', 'F11', event='action-end')
guarded = key('-k', 'F3', event='composition-enter')
assert bytes(guarded['snapshot']['source']) == original
assert guarded['snapshot']['version'] == before['snapshot']['version']
assert 'compositionstart' in guarded['events'] and 'compositionend' in guarded['events']

note = key('-k', 'F14', event='opened')
assert bytes(note['snapshot']['source']) == '\ufeff\r\n[[A quiet note]]\r\n'.encode()
before = key('-k', 'F15', event='note-middle')
split = key('-k', 'Return')
assert bytes(split['snapshot']['source']) == '\ufeff\r\n[[A qui\r\net note]]\r\n'.encode()
assert split['snapshot']['selection']['head']['sourceIndex'] == 2
restored = key('-M', 'ctrl', '-k', 'z', '-m', 'ctrl')
assert bytes(restored['snapshot']['source']) == bytes(note['snapshot']['source'])
assert restored['snapshot']['selection'] == before['snapshot']['selection']
print('PASS: real WebKit Enter, Backspace, note split, undo/redo, source/hash/caret; synthetic composition event sequence.', flush=True)
