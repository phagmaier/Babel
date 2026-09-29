"""Native Wayland input and independent literal assertions; no source writes or real manuscripts."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time

log = Path(sys.argv[1])
fixture_root = Path(__file__).resolve().parents[3] / 'prototypes/editor-composition/fixtures'

def reports():
    return [value for line in log.read_text().splitlines()
            if line.startswith('M1_COMPOSITION_PROOF ')
            for value in [json.loads(line.split(' ', 1)[1])]]

def wait(event, previous):
    end = time.monotonic() + 10
    while time.monotonic() < end:
        for value in reports()[previous:]:
            if value.get('task') == 'M3-04' and value['event'] == 'error':
                raise AssertionError(value['error'])
            if value.get('task') == 'M3-04' and value['event'] == event:
                assert value['nativeHost'] and 'AppleWebKit' in value['userAgent']
                assert hashlib.sha256(bytes(value['snapshot']['source'])).hexdigest() == value['snapshot']['sha256']
                return value
        time.sleep(0.1)
    raise AssertionError(f'No native report: {event}')

def key(*args, event='observed'):
    active = json.loads(subprocess.check_output(['hyprctl', '-j', 'activewindow']))
    if active.get('title') != 'babel M3-04 synthetic editor bridge' or active.get('class') != 'babel-desktop':
        candidates = [item for item in json.loads(subprocess.check_output(['hyprctl', '-j', 'clients']))
                      if item.get('title') == 'babel M3-04 synthetic editor bridge' and item.get('class') == 'babel-desktop']
        assert len(candidates) == 1, 'Exactly one owned synthetic window required'
        address = candidates[0]['address']
        assert address.startswith('0x') and all(char in '0123456789abcdef' for char in address[2:])
        subprocess.run(['hyprctl', 'dispatch', 'hl.dsp.focus({ window = "address:' + address + '" })'], check=True, stdout=subprocess.DEVNULL)
        active = json.loads(subprocess.check_output(['hyprctl', '-j', 'activewindow']))
    assert active['title'] == 'babel M3-04 synthetic editor bridge' and active.get('class') == 'babel-desktop', 'Synthetic window must own focus'
    previous = len(reports())
    subprocess.run(['wtype', *args], check=True)
    if event == 'observed':
        time.sleep(0.3)
        subprocess.run(['wtype', '-k', 'F8'], check=True)
    return wait(event, previous)

def source(report): return bytes(report['snapshot']['source'])
def summary(phase, report):
    print(json.dumps({'phase': phase, 'fixture': report['fixture'], 'version': report['snapshot']['version'],
                      'liveVersion': report['liveVersion'], 'status': report['status'],
                      'selection': report['snapshot']['selection'], 'transactionMs': report['transactionMs']}, ensure_ascii=False), flush=True)

for fixture in ['lf', 'crlf', 'no-final-newline']:
    opened = key('-k', 'F1', event='opened') if fixture == 'lf' else key('-k', 'F4', event='opened')
    assert opened['fixture'] == fixture
    original = (fixture_root / f'{fixture}.fountain').read_bytes()
    expected = (fixture_root / f'{fixture}-edited.fountain').read_bytes()
    assert source(opened) == original
    before = key('-k', 'F7', event='caret-end')
    typed = key('-d', '80', ' é🚀')
    assert source(typed) == expected
    assert typed['snapshot']['selection']['head']['utf16Offset'] == 28
    assert typed['snapshot']['selection']['head']['byteOffset'] == expected.index(' é🚀'.encode()) + len(' é🚀'.encode())
    assert any(event == 'beforeinput:insertText' for event in typed['events'])
    undone = key('-M', 'ctrl', '-k', 'z', '-m', 'ctrl')
    assert source(undone) == original
    assert undone['snapshot']['selection'] == before['snapshot']['selection']
    assert undone['snapshot']['version'] > typed['snapshot']['version']
    redone = key('-M', 'ctrl', '-M', 'shift', '-k', 'z', '-m', 'shift', '-m', 'ctrl')
    assert source(redone) == expected
    assert redone['snapshot']['selection'] == typed['snapshot']['selection']
    selected = key('-k', 'F6', event='selected')
    assert selected['domSelection'] == 'lamp'
    replaced = key('-d', '80', 'beacon')
    assert b'!A beacon glows beside' in source(replaced)
    restored = key('-M', 'ctrl', '-k', 'z', '-m', 'ctrl')
    assert source(restored) == expected
    assert restored['snapshot']['selection'] == selected['snapshot']['selection']
    assert restored['domSelection'] == 'lamp'
    protected = key('-k', 'F9', event='protected-selected')
    attempted = key('-d', '80', 'Y')
    assert source(attempted) == source(protected), 'Protected selection must not redirect or accept typing'
    before = key('-k', 'F7', event='caret-end')
    held = key('-k', 'F5', event='capture-held')
    newer = key('-d', '80', 'X')
    released = key('-k', 'F10', event='released')
    assert released['status'] == 'stale'
    assert source(released) == source(held)
    assert released['liveVersion'] == newer['liveVersion'] > released['snapshot']['version']
    current = key('-k', 'F8')
    assert source(current) == source(newer)
    assert [row['id'] for row in current['snapshot']['ranges']] == [row['id'] for row in opened['snapshot']['ranges']]
    for report in [typed, redone, restored, current]:
        assert report['status'] == 'current'
        assert report['snapshot']['ranges'][-1]['to'] == len(source(report))
    summary('native-edit-undo-selection-stale-capture', current)
print('PASS: three literal byte/Unicode/selection/undo/redo/stale-capture native WebKit cases; no source save.', flush=True)
