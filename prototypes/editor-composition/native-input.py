"""Real Wayland keyboard input into the owned WebKit proof; logs and files are checked independently."""
import json
from pathlib import Path
import subprocess
import sys
import time

log = Path(sys.argv[1])
root = Path(sys.argv[2])
fixture = sys.argv[3] if len(sys.argv) > 3 else 'lf'

def reports():
    return [json.loads(line.split(' ', 1)[1]) for line in log.read_text().splitlines()
            if line.startswith('M1_COMPOSITION_PROOF ')]

def wait(event, previous):
    end = time.monotonic() + 10
    while time.monotonic() < end:
        for report in reports()[previous:]:
            if report['event'] == event:
                assert report['nativeHost']
                assert 'AppleWebKit' in report['userAgent']
                return report
        time.sleep(0.1)
    raise AssertionError(f'Timed out waiting for native {event}')

def key(*args, event='observed'):
    active = json.loads(subprocess.check_output(['hyprctl', '-j', 'activewindow']))
    assert active['title'] == 'babel M1-06 synthetic composition proof', 'Proof window must own focus'
    before = len(reports())
    subprocess.run(['wtype', *args], check=True)
    if event == 'observed':
        time.sleep(0.3)
        subprocess.run(['wtype', '-k', 'F8'], check=True)
    return wait(event, before)

def source(report): return bytes(report['snapshot']['source'])
def summary(phase, report):
    print(json.dumps({'phase': phase, 'fixture': report['fixture'], 'version': report['snapshot']['version'],
          'sha256': report['snapshot']['sha256'], 'selection': report['snapshot']['selection'],
          'domSelection': report['domSelection'], 'events': report['events'][-15:]}, ensure_ascii=False), flush=True)

original = (Path(__file__).parent / 'fixtures' / f'{fixture}.fountain').read_bytes()
expected = (Path(__file__).parent / 'fixtures' / f'{fixture}-edited.fountain').read_bytes()
# Caller opens the chosen fixture first; every no-op save uses the real native commands.
saved = key('-k', 'F2', event='saved')
assert (root / f'{fixture}.fountain').read_bytes() == original
assert saved['detail']['sourceSha256'] == saved['snapshot']['sha256']
summary('no-op-save', saved)
before = key('-k', 'F7')
summary('caret-before', before)
typed = key('-d', '90', ' é🚀')
assert source(typed) == expected
assert typed['snapshot']['selection']['head']['utf16Offset'] == 28
assert any(e.startswith('beforeinput:insertText') for e in typed['events'])
summary('typed-unicode', typed)
undone = key('-M', 'ctrl', '-k', 'z', '-m', 'ctrl')
assert source(undone) == original
assert undone['snapshot']['selection'] == before['snapshot']['selection']
assert undone['snapshot']['version'] > typed['snapshot']['version']
summary('undo-typing', undone)
redone = key('-M', 'ctrl', '-M', 'shift', '-k', 'z', '-m', 'shift', '-m', 'ctrl')
assert source(redone) == expected
assert redone['snapshot']['selection'] == typed['snapshot']['selection']
summary('redo-typing', redone)
selected = key('-k', 'F6')
assert selected['domSelection']['text'] == 'lamp'
summary('selected-lamp', selected)
replaced = key('-d', '90', 'beacon')
assert b'!A beacon glows beside' in source(replaced)
summary('replace-selection', replaced)
restored = key('-M', 'ctrl', '-k', 'z', '-m', 'ctrl')
assert source(restored) == expected
assert restored['snapshot']['selection'] == selected['snapshot']['selection']
assert restored['domSelection']['text'] == 'lamp'
summary('undo-replacement', restored)
key('-k', 'F7')
saved = key('-k', 'F2', event='saved')
assert (root / f'{fixture}.fountain').read_bytes() == expected
assert saved['detail']['version'] == saved['snapshot']['version']
assert saved['detail']['sourceSha256'] == saved['snapshot']['sha256']
assert saved['detail']['recovery']['version'] == saved['detail']['version']
summary('edited-native-save', saved)
reopened = key('-k', 'F3', event='reopened')
assert source(reopened) == expected
assert bytes(reopened['detail']['nativeSource']) == expected
assert reopened['detail']['fingerprint']['sha256'] == saved['detail']['sourceSha256']
assert (root / f'{fixture}.fountain').read_bytes() == expected
summary('native-reopen', reopened)
