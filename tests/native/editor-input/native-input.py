"""Actual owned-window Wayland clipboard/keys; dead keys are NOT full IME proof."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time
log=Path(sys.argv[1]); title='babel M3-08 synthetic input'
original=b'\n@MAYA\nHello world.\n'

def reports():
    return [json.loads(line.split(' ',1)[1]) for line in log.read_text().splitlines() if line.startswith('M1_COMPOSITION_PROOF ')]
def focus():
    clients=[c for c in json.loads(subprocess.check_output(['hyprctl','-j','clients'])) if c.get('title')==title and c.get('class')=='babel-desktop']
    assert len(clients)==1,'Exactly one owned synthetic window required'
    target=clients[0]['address']; assert target.startswith('0x') and all(c in '0123456789abcdef' for c in target[2:])
    subprocess.run(['hyprctl','dispatch','hl.dsp.focus({ window = "address:'+target+'" })'],check=True,stdout=subprocess.DEVNULL)
    active=json.loads(subprocess.check_output(['hyprctl','-j','activewindow'])); assert active.get('title')==title and active.get('class')=='babel-desktop'
def key(*args):
    focus(); previous=len(reports());
    if args in [('-M','ctrl','-k',k,'-m','ctrl') for k in ['c','v','x']]:subprocess.run(['/tmp/babel-m3-08-keyboard',args[3]],check=True)
    elif args==('-k','BackSpace'):subprocess.run(['/tmp/babel-m3-08-keyboard','backspace'],check=True)
    elif args==('shift-home',):subprocess.run(['/tmp/babel-m3-08-keyboard','shift-home'],check=True)
    elif args==('-k','Escape'):subprocess.run(['/tmp/babel-m3-08-keyboard','escape'],check=True)
    elif args==('-k','Return'):subprocess.run(['/tmp/babel-m3-08-keyboard','return'],check=True)
    elif args==('-k','dead_acute','-k','Escape'):
        subprocess.run(['wtype','-k','dead_acute'],check=True);subprocess.run(['/tmp/babel-m3-08-keyboard','escape'],check=True)
    else:subprocess.run(['wtype','-d','30',*args],check=True)
    time.sleep(.15);return await_report(previous)
def await_report(previous):
    focus(); subprocess.run(['wtype','-k','F8'],check=True)
    until=time.monotonic()+30
    while time.monotonic()<until:
        ready=[r for r in reports()[previous:] if r.get('task')=='M3-08']
        assert not any(r.get('event')=='error' for r in ready),ready
        ready=[r for r in ready if r.get('event')=='F8']
        if ready:
            item=ready[-1];assert item['nativeHost'] and 'AppleWebKit' in item['userAgent']
            if 'source' in item:assert hashlib.sha256(bytes(item['source'])).hexdigest()==item['sha256']
            return item
        time.sleep(.1)
    raise AssertionError('No native report')
def src(item):return bytes(item['source'])
def undo():return key('-M','ctrl','-k','z','-m','ctrl')
def redo():return key('-M','ctrl','-M','shift','-k','z','-m','shift','-m','ctrl')

def paste(text,mime='text/plain;charset=utf-8'):
    # Clipboard ownership is synthetic and held by a disposable helper process for this drill.
    p=subprocess.Popen(['wl-copy','--foreground','--type',mime],stdin=subprocess.PIPE)
    p.stdin.write(text.encode());p.stdin.close();time.sleep(.1)
    try:return key('-M','ctrl','-k','v','-m','ctrl')
    finally:p.terminate();p.wait(timeout=5)

def native_selection():
    key('-k','F1')
    selected=key('shift-home')
    assert selected['selection']['anchor']['utf16Offset']==12 and selected['selection']['head']['utf16Offset']==0,selected
    typed=key('Replacement שלום')
    assert src(typed)=='\n@MAYA\nReplacement שלום\n'.encode(),typed
    restored=undo();assert src(restored)==original and restored['selection']==selected['selection'],restored
    formatted=key('-M','ctrl','-k','b','-m','ctrl');assert src(formatted)==b'\n@MAYA\n**Hello world.**\n',formatted
    restored=undo();assert src(restored)==original and restored['selection']==selected['selection'],restored
    print('Native physical Shift+Home backward selection, Unicode replacement, formatting and exact selection/source undo passed.',flush=True)
def native_import():
    key('-k','F1');protected=key('-k','F4')
    assert any(e.get('key')=='F4' and e['trusted'] for e in protected['inputEvents']),protected
    imported=b'\xef\xbb\xbfTitle: Imported\r\n\r\n!New screenplay\r\n/* retained unknown */\r\n'
    assert protected['imported']['status']=='imported' and src(protected)==imported,protected
    receipt=protected['imported']['protection'];assert receipt['checkpoint']['sourceSha256']==hashlib.sha256(original).hexdigest()
    assert receipt['revision']['safetyRef']=='refs/safety/'+receipt['revision']['commitId']
    assert src(undo())==original;assert src(redo())==imported
    print('PASS native coordinated import / exact checkpoint / safety ref / BOM-CRLF / Undo-Redo', flush=True)

if '--import-only' in sys.argv:
    native_import();sys.exit(0)
if '--selection-only' in sys.argv:
    native_selection();sys.exit(0)
native_selection()

assert src(key('-k','F1'))==original
key('-k','F2')
text='INT. LAB - NIGHT\nمرحبا שלום 👩🏽‍🚀 é'
pasted=paste(text)
expected=('\n@MAYA\nHello '+text+'.\n').encode()
assert src(pasted)==expected and pasted['kind']=='dialogue',pasted
assert any(e['kind']=='paste' and e['trusted'] for e in pasted['inputEvents']),pasted
assert any(e.get('key')=='v' and e.get('code')=='KeyV' and e['trusted'] for e in pasted['inputEvents']),pasted
assert src(undo())==original
assert src(redo())==expected
key('-k','F1');key('-k','F2')
html='<p onclick="globalThis.owned=1">safe<img src="https://invalid.example/pixel" onerror="owned=2"></p><script>owned=3</script>'
html_paste=paste(html,'text/html');assert not html_paste['unsafeDom'];assert src(html_paste)==('\n@MAYA\nHello '+html+'.\n').encode(),html_paste # GTK also advertises raw HTML as plain text; plain precedence is intentional
assert src(undo())==original
key('-k','F2'); marked=key('-M','ctrl','-k','b','-m','ctrl');assert src(marked)==b'\n@MAYA\nHello **world**.\n'
cut=key('-M','ctrl','-k','x','-m','ctrl');assert src(cut)==b'\n@MAYA\nHello .\n'
assert src(undo())==src(marked);assert src(undo())==original
# Actual internal structured MIME survives native copy/paste (GTK clipboard).
key('-k','F1');key('-k','F5');key('-M','ctrl','-k','c','-m','ctrl');key('-k','F7')
structured=key('-M','ctrl','-k','v','-m','ctrl');assert src(structured)==b'@MAYA\nHello world.\n',structured
assert src(undo())==b'!target\n'
# A complete copied Dialogue paragraph pastes inline into the existing target cue.
key('-k','F1');key('-k','F3');key('-M','ctrl','-k','c','-m','ctrl');key('-k','F1');key('-k','F2')
inline=key('-M','ctrl','-k','v','-m','ctrl');assert src(inline)==b'\n@MAYA\nHello Hello world..\n',inline
assert src(undo())==original
# Actual Unicode selection and replacement, combining cluster, RTL and deletion.
key('-k','F1');key('-k','F2')
assert src(key('שלום é 👩🏽‍🚀'))=='\n@MAYA\nHello שלום é 👩🏽‍🚀.\n'.encode()
time.sleep(.65) # Separate deletion from ordinary typing's natural history group.
removed=key('-k','BackSpace');assert src(removed)=='\n@MAYA\nHello שלום é .\n'.encode(),removed
assert src(undo())=='\n@MAYA\nHello שלום é 👩🏽‍🚀.\n'.encode()
# Native GTK dead-key commit and cancel, followed by Enter. Record trusted composition.
key('-k','F1')
committed=key('-k','dead_acute','e');assert src(committed)=='\n@MAYA\nHello world.é\n'.encode(),committed
assert committed['composition'] and all(e['trusted'] for e in committed['composition']),committed
key('-k','F1');cancelled=key('-k','dead_acute','-k','Escape')
cancel_passed=src(cancelled)==original
if not cancel_passed:
    assert src(cancelled)=='\n@MAYA\nHello world.´\n'.encode(),cancelled
    print('NOTED: GTK dead-key Escape commits spacing acute; exact source retained and Undo checked. Real IME cancellation is covered separately below.',flush=True)
    assert src(undo())==original
key('-k','F1')
key('-k','dead_acute','e')
first=key('-k','Return');assert first['kind']=='action' and src(first)=='\n@MAYA\nHello world.é\n\n'.encode(),first
# Real IME commit/cancel/Enter through live fcitx5 engines (M3-08 acceptance).
# The drill switches the session input method; keyboard-us is restored after.
# A mid-section abort leaves the switched method active; restore it with
# `fcitx5-remote -s keyboard-us`.
def ime_switch(name):
    focus()
    subprocess.run(['fcitx5-remote','-s',name],check=True);time.sleep(.5)
    current=subprocess.check_output(['fcitx5-remote','-n'],text=True).strip()
    assert current==name,(current,name)
def ime_type(text):
    focus();subprocess.run(['wtype','-d','80',text],check=True);time.sleep(1.0)
key('-k','F1');ime_switch('pinyin')
previous=len(reports());ime_type('nihao')
focus();subprocess.run(['wtype','-k','space'],check=True);time.sleep(.8)
pinyin_committed=await_report(previous)
assert pinyin_committed['composition'] and all(e['trusted'] for e in pinyin_committed['composition']),pinyin_committed
assert src(pinyin_committed)=='\n@MAYA\nHello world.你好\n'.encode(),pinyin_committed
assert src(undo())==original
key('-k','F1');ime_switch('pinyin')
previous=len(reports());ime_type('nihao')
focus();subprocess.run(['/tmp/babel-m3-08-keyboard','escape'],check=True);time.sleep(.8)
pinyin_cancelled=await_report(previous)
assert src(pinyin_cancelled)==original,pinyin_cancelled
assert src(undo())==original
key('-k','F1');ime_switch('mozc')
previous=len(reports());ime_type('ai')
focus();subprocess.run(['/tmp/babel-m3-08-keyboard','return'],check=True);time.sleep(.8)
mozc_committed=await_report(previous)
assert mozc_committed['composition'] and all(e['trusted'] for e in mozc_committed['composition']),mozc_committed
assert src(mozc_committed)=='\n@MAYA\nHello world.あい\n'.encode(),mozc_committed
assert src(undo())==original
ime_switch('keyboard-us')
print('Real pinyin commit/cancel and mozc commit with trusted composition and exact undo passed.',flush=True)
# Exact native protection before whole-source import, followed by source-origin undo/redo.
native_import()
# Synthetic large-row workloads, not guessed screenplay page counts. Real ASCII typing.
metrics=[]
for function,count in [('F9',2400),('F10',6000),('F11',12000)]:
    key('-k',function)
    result=key('x'*120)
    source=''.join(f'!Synthetic row {i}: A quiet signal crosses the room beside Zoë and her notebook.\n' for i in range(count))
    source=source[:-1]+'x'*120+'\n'
    assert result['sha256']==hashlib.sha256(source.encode()).hexdigest(),result
    assert len(result['keyRafMs'])==120 and len(result['transactionMs'])>=120,result
    def stats(values):
        values=sorted(values);return {'n':len(values),'p95':values[int(.95*(len(values)-1))],'max':values[-1]}
    item={'rows':count,'bytes':result['byteLength'],'sha256':result['sha256'],'transactionMs':stats(result['transactionMs']),'keyToRafProxyMs':stats(result['keyRafMs'])}
    metrics.append(item);print(json.dumps(item),flush=True)
for function,count in [('F9',2400),('F10',6000),('F11',12000)]:
    key('-M','shift','-k',function,'-m','shift')
    result=key('x'*120)
    cycle=['!Action beside Zoë and her notebook.', '', '@MAYA', 'A quiet signal.', '(softly)', 'Hello שלום é.', '', '/*', 'Synthetic omitted note.', '*/', '!Action resumes.']
    source=''.join('\n'.join('!'+'Long synthetic paragraph. '*320 if at==0 and index%50==0 else line for at,line in enumerate(cycle))+'\n' for index in range((count-1)//len(cycle)))+'!Final action.'+'x'*120+'\n'
    assert result['sha256']==hashlib.sha256(source.encode()).hexdigest(),result
    assert len(result['keyRafMs'])==120 and len(result['transactionMs'])>=120,result
    item={'workload':'mixed-long-notes','rows':result['rows'],'bytes':result['byteLength'],'sha256':result['sha256'],'transactionMs':stats(result['transactionMs']),'keyToRafProxyMs':stats(result['keyRafMs'])}
    metrics.append(item);print(json.dumps(item),flush=True)
Path('/tmp/babel-m3-08-latency.json').write_text(json.dumps(metrics,indent=2)+'\n')
print('M3-08 native clipboard, formatting, Unicode/grapheme/RTL, trusted dead-key commit/separate Enter, real pinyin commit/cancel, real mozc commit, protected import/undo and row workload checks passed. Remaining opens: actual compositor paint and page-calibrated S13 metrics (later gates).',flush=True)
sys.exit(0)
