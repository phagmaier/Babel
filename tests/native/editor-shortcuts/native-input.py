"""M3-06 real keys, native select, focus, undo and remap on one owned window."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time

log = Path(sys.argv[1])
title = 'babel M3-06 synthetic shortcuts'
original = b'\n@MAYA\n(quietly)\nSignal.\n\n!A bell.\n'

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
        new = [item for item in reports()[previous:] if item.get('task') == 'M3-06']
        for item in new:
            assert item.get('event') != 'error', item
        if new:
            item = new[-1]
            assert item['nativeHost'] and 'AppleWebKit' in item['userAgent']
            assert hashlib.sha256(bytes(item['source'])).hexdigest() == item['sha256']
            return item
        time.sleep(.1)
    raise AssertionError('No native report')

if len(sys.argv) > 2 and sys.argv[2] == '--reload-only':
    assert bytes(key('-k', 'F1')['source']) == original
    key('-k', 'F7')
    assert key('-M', 'ctrl', '-k', 'k', '-m', 'ctrl')['element'] == 'sceneHeading'
    key('-M', 'ctrl', '-k', '2', '-m', 'ctrl')
    unchanged = key('-M', 'ctrl', '-k', '1', '-m', 'ctrl')
    assert unchanged['element'] == 'action' and bytes(unchanged['source']) == original
    print('PASS: persisted remap loaded after native process restart in the same private profile.', flush=True)
    sys.exit(0)

# Synthetic private profile starts with defaults.
assert bytes(key('-k','Escape','-s','500','-k','F1')['source']) == original
before = key('-k','F7')
converted = key('-M','ctrl','-k','1','-m','ctrl')
assert converted['element'] == converted['picker'] == 'sceneHeading'
assert bytes(converted['source']) == original.replace(b'!A bell.', b'.A bell.')
assert converted['selection']['head']['utf16Offset'] == 7
assert bytes(key('-M','ctrl','-k','z','-m','ctrl')['source']) == original
shot = key('-M','ctrl','-k','7','-m','ctrl')
assert shot['element'] == 'shot' and bytes(shot['source']) == original
assert key('-M','ctrl','-k','2','-m','ctrl')['element'] == 'action'
assert key('-k','Tab')['element'] == 'character'
assert key('-k','Tab')['element'] == 'sceneHeading'
assert key('-M','shift','-k','Tab','-m','shift')['element'] == 'character'
key('-M','ctrl','-k','2','-m','ctrl')
assert key('-k','F6')['focus'] == 'screenplay-element'
# Native select: open, choose Lyrics with the first-letter key, commit.
picked = key('l')
assert picked['element'] == picked['picker'] == 'lyrics', picked
assert bytes(picked['source']) == original.replace(b'!A bell.',b'~A bell.')
key('-k','F6')
outside = key('-k','Tab')
assert outside['focus'] != 'screenplay-element' and outside['element'] == 'lyrics'
key('-k','F7')
assert 'M3-10' in key('-M','ctrl','-k','s','-m','ctrl')['refusal']
# The remap form defaults to Scene Heading. Real text input submits Mod+K.
key('-k','F2')
saved = key('-M','ctrl','-k','a','-m','ctrl','Mod+K','-k','Return')
assert saved['preferenceNotice'] == 'Shortcuts saved locally.', saved
key('-k','F12')
key('-k','F7')
# Remapped command works after recreating registry from actual WebKit localStorage.
remapped = key('-M','ctrl','-k','k','-m','ctrl')
assert remapped['element'] == 'sceneHeading', remapped
key('-M','ctrl','-k','2','-m','ctrl')
unbound = key('-M','ctrl','-k','1','-m','ctrl')
assert unbound['element'] == 'action' and bytes(unbound['source']) == original
# An actual non-ASCII logical key must not match a physical numeric binding.
layout = key('-M','ctrl','é','-m','ctrl')
assert layout['element'] == 'action' and bytes(layout['source']) == original
print('PASS: real WebKit Ctrl+1/2/7, contextual Tab/reverse, F6 escape, native Lyrics picker, outside Tab, disabled Save, remap/reload and Unicode logical-key nonmatch.', flush=True)
