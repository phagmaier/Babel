"""M3-07 real popup keys, segments, focus, undo and explicitly synthetic mouse/IME."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time

log = Path(sys.argv[1])
title = 'babel M3-07 synthetic completion'
original = b'\n@MAYA (V.O.)\nSignal.\n\n@MARY\nHello.\n\n.INT. LAB - NIGHT\n\n@MA (O.S.)\n\n.INT. LA - DAY\n\n.EXT. LAB - NI\n\n.IN\n'

def reports():
    return [json.loads(line.split(' ', 1)[1]) for line in log.read_text().splitlines()
            if line.startswith('M1_COMPOSITION_PROOF ')]

def focus():
    clients = [c for c in json.loads(subprocess.check_output(['hyprctl', '-j', 'clients']))
               if c.get('title') == title and c.get('class') == 'babel-desktop']
    assert len(clients) == 1, 'Exactly one owned synthetic window required'
    target = clients[0]['address']
    assert target.startswith('0x') and all(c in '0123456789abcdef' for c in target[2:])
    subprocess.run(['hyprctl', 'dispatch', 'hl.dsp.focus({ window = "address:' + target + '" })'], check=True, stdout=subprocess.DEVNULL)
    active = json.loads(subprocess.check_output(['hyprctl', '-j', 'activewindow']))
    assert active.get('title') == title and active.get('class') == 'babel-desktop'

def key(*args):
    focus()
    previous = len(reports())
    subprocess.run(['wtype', '-d', '80', *args], check=True)
    time.sleep(.3)
    focus()
    subprocess.run(['wtype', '-k', 'F8'], check=True)
    until = time.monotonic() + 10
    while time.monotonic() < until:
        new = [item for item in reports()[previous:] if item.get('task') == 'M3-07']
        for item in new:
            assert item.get('event') != 'error', item
        ready = [item for item in new if item.get('event') == 'F8']
        if ready:
            item = ready[-1]
            assert item['nativeHost'] and 'AppleWebKit' in item['userAgent']
            assert hashlib.sha256(bytes(item['source'])).hexdigest() == item['sha256']
            return item
        time.sleep(.1)
    raise AssertionError('No native report')

assert bytes(key('-k', 'F1')['source']) == original
opened = key('-k', 'F7')
assert opened['popup'] and opened['segment'] == 'character' and opened['items'] == ['MARY', 'MAYA'], opened
assert bytes(opened['source']) == original and opened['focus']
selected = key('-k', 'Down')
assert selected['selected'] == 1
accepted = key('-k', 'Return')
assert bytes(accepted['source']) == original.replace(b'@MA (O.S.)', b'@MAYA (O.S.)'), accepted
assert accepted['selection']['head']['utf16Offset'] == 4 and not accepted['popup'] and accepted['focus']
undone = key('-M', 'ctrl', '-k', 'z', '-m', 'ctrl')
assert bytes(undone['source']) == original and undone['selection']['head']['utf16Offset'] == 2
assert not key('-k', 'Escape')['popup']
key('-k', 'F1')
key('-k', 'F7')
by_tab = key('-k', 'Tab')
assert bytes(by_tab['source']) == original.replace(b'@MA (O.S.)', b'@MARY (O.S.)') and by_tab['kind'] == 'character'
# Heading completion and the smart transition are checked separately below.
key('-k', 'F1')
key('-k', 'F7')
typed = key('Y')
assert bytes(typed['source']) == original.replace(b'@MA (O.S.)', b'@MAY (O.S.)') and typed['items'][0] == 'MAYA'
typed_completion = key('-k', 'Return')
assert bytes(typed_completion['source']) == original.replace(b'@MA (O.S.)', b'@MAYA (O.S.)')
assert bytes(key('-M', 'ctrl', '-k', 'z', '-m', 'ctrl')['source']) == original.replace(b'@MA (O.S.)', b'@MAY (O.S.)')
assert bytes(key('-M', 'ctrl', '-k', 'z', '-m', 'ctrl')['source']) == original
key('-k', 'F1')
location = key('-k', 'F9')
assert location['items'][0] == 'LAB' and location['segment'] == 'location'
location = key('-k', 'Return')
assert bytes(location['source']) == original.replace(b'.INT. LA - DAY', b'.INT. LAB - DAY')
key('-k', 'F1')
assert key('-k', 'F10')['segment'] == 'time'
time_result = key('-k', 'Tab')
assert bytes(time_result['source']) == original.replace(b'.EXT. LAB - NI', b'.EXT. LAB - NIGHT')
key('-k', 'F1')
assert key('-k', 'F11')['segment'] == 'prefix'
prefix = key('-k', 'Return')
assert bytes(prefix['source']) == original.replace(b'.IN\n', b'.INT. \n')
# Accepted prefix consumed Enter; another Enter moves to Action exactly once.
next_line = key('-k', 'Return')
assert next_line['kind'] == 'action' and not next_line['popup']
key('-k', 'F1')
key('-k', 'F7')
mouse = key('-k', 'F2')
assert mouse['focus'] and bytes(mouse['source']) == original.replace(b'@MA (O.S.)', b'@MAYA (O.S.)')
key('-k', 'F1')
key('-k', 'F7')
composition = key('-k', 'F3')
assert bytes(composition['source']) == original and not composition['popup']
key('-k', 'F1')
key('-k', 'F7')
assert not key('-k', 'F6')['popup']
print('PASS: real WebKit popup navigation, Enter/Tab, source/hash/caret/undo, segmented headings, second Enter and F6; synthetic mouse and composition sequence passed.', flush=True)

if len(sys.argv) == 4 and sys.argv[2] == '--pointer':
    helper = Path(sys.argv[3]).resolve(strict=True)
    assert helper == Path('/tmp/babel-m3-07-pointer'), 'Use only the documented disposable helper'
    key('-k', 'F1')
    opened = key('-k', 'F7')
    focus()
    client = [c for c in json.loads(subprocess.check_output(['hyprctl', '-j', 'clients']))
              if c.get('title') == title and c.get('class') == 'babel-desktop'][0]
    monitors = json.loads(subprocess.check_output(['hyprctl', '-j', 'monitors']))
    assert len(monitors) == 1 and monitors[0]['x'] == monitors[0]['y'] == 0
    monitor = monitors[0]
    chosen = next(o for o in opened['options'] if o['text'] == 'MAYA')
    option = chosen['bounds']
    x = option['x'] + option['width'] / 2
    y = option['y'] + option['height'] / 2
    assert 0 < x + 1 < client['size'][0] and 0 < y < client['size'][1], 'Pointer target must lie inside owned app'
    subprocess.run(['grim', '-g', f"{client['at'][0]},{client['at'][1]} {client['size'][0]}x{client['size'][1]}", '/tmp/babel-m3-07-popup.png'], check=True)
    subprocess.run([str(helper), str(round(client['at'][0] + x)), str(round(client['at'][1] + y)),
                    str(round(monitor['width']/monitor['scale'])), str(round(monitor['height']/monitor['scale']))], check=True)
    clicked = key('-s', '300')
    assert clicked['focus'] and bytes(clicked['source']) == original.replace(b'@MA (O.S.)', b'@MAYA (O.S.)'), clicked
    assert clicked['selection']['head']['utf16Offset'] == 4 and not clicked['popup']
    assert any(e['kind'] == 'mousedown' and e['trusted'] and e['target'] == chosen['id'] for e in clicked['pointerEvents']), 'Require trusted native mouse dispatch on the displayed option'
    undone = key('-M', 'ctrl', '-k', 'z', '-m', 'ctrl')
    assert bytes(undone['source']) == original and undone['selection']['head']['utf16Offset'] == 2
    print('PASS: actual Wayland pointer click accepted MAYA, retained native writing focus/caret and one-step undo. App-only screenshot recorded.', flush=True)
