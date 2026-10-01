"""M4-07 production logical find/navigation; synthetic sources and owned WebKit only."""
import hashlib
import json
import subprocess
import time


def run(d):
    report = []

    def ready():
        d.wait(lambda: d.script("return !!document.querySelector('.outline-target:not(:disabled)') && !document.querySelector('#writing-save')?.disabled;"), 'Current projection', timeout=60)

    def open_source(name, source):
        target = d.ROOT / 'files' / (name + '.fountain')
        target.write_bytes(source)
        d.click('Open Fountain', actions=True)
        d.picker(target)
        ready()
        return target

    def chord(key, shift=False):
        keys = ['\ue009'] + (['\ue008'] if shift else []) + [key]
        d.command('POST', '/actions', {'actions': [{'type': 'key', 'id': 'find-chord', 'actions': [{'type': 'keyDown', 'value': k} for k in keys] + [{'type': 'keyUp', 'value': k} for k in reversed(keys)]}]})

    def query(text, count):
        d.set_input('Find text', text)
        d.wait(lambda: f'{count} matches' in d.script("return document.querySelector('.find-panel [role=status]').textContent;"), 'Exact current match count', timeout=30)

    def next_match(row, via='button', previous=False):
        d.wait(lambda: d.script("return document.querySelector('.find-panel button').disabled===false;"), 'Current navigation')
        if via == 'shortcut':
            chord('g', previous)
        else:
            d.click('Previous match' if previous else 'Next match')
        d.wait(lambda: d.script("return document.activeElement?.classList.contains('ProseMirror');"), 'Returned editor focus')
        d.wait(lambda: d.script("return document.querySelector('.find-panel button').disabled===false;"), 'Rebound current selection')
        selection = d.wait(lambda: d.script("const s=getSelection();const p=(s.focusNode?.nodeType===1?s.focusNode:s.focusNode?.parentElement)?.closest('.ProseMirror > p');const r=p.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight ? {row:[...document.querySelectorAll('.ProseMirror > p')].indexOf(p),text:s.toString(),visible:true} : null;"), 'Selected result visible after panel refresh')
        assert selection['row'] == row and selection['visible'], selection
        assert selection['text'].lower() == 'moon', selection
        d.wait(lambda: d.script("return document.querySelector('.find-panel button').disabled===false;"), 'Rebound current selection')
        return selection

    def journals():
        return {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in (d.ROOT/'data').rglob('*') if p.is_file() and p.suffix in ['.journal', '.previous']}

    source = '\ufeffTitle: **moon**\r\n\r\n.INT. LAB é🚀 - DAY\r\n!A **moon** shines.\r\n[[moon]]\n/*moon*/\n!moon [[tail]]\n# Boundary\n!moon\n.INT. TWO - DAY\n!MOON'.encode()
    target = open_source('find-hidden', source)
    original_editor = d.editor()
    d.click('Save', actions=True); d.audit(target, source)
    d.wait(lambda: 'Saved locally' in d.body(), 'Baseline source receipt before no-write audit')
    before = journals()
    # Trusted registry shortcut opens search and focuses its local input.
    d.script("document.querySelector('.ProseMirror').focus();")
    chord('f')
    d.wait(lambda: d.script("return document.activeElement?.type==='search' && !!document.activeElement.closest('.find-panel');"), 'Find input focus')
    query('absent', 0)
    query('moon', 7)
    whole = d.find('//label[contains(.,"Whole word")]/input')
    d.command('POST', '/element/' + whole + '/click', {})
    d.wait(lambda: '7 matches' in d.script("return document.querySelector('.find-panel [role=status]').textContent;"), 'Whole-word controls retain exact authored words')
    for i, row in enumerate([0, 3, 4, 5, 6, 8, 10]):
        next_match(row, 'shortcut' if i % 2 else 'button')
    next_match(0, 'shortcut')
    assert 'Wrapped to the other end.' in d.body()
    next_match(10, 'shortcut', True)
    assert d.editor() == original_editor
    assert target.read_bytes() == source
    time.sleep(1.2)
    assert journals() == before, 'Find alone must not publish recovery'
    d.screenshot('find-hidden-reveal')
    d.script("document.querySelector('.find-panel').scrollIntoView({block:'start'});")
    d.screenshot('find-controls')
    # Scope/filter/case controls operate without changing bytes.
    d.click('Find', actions=True)
    for label in ['Include title fields', 'Include notes', 'Include omitted material', 'Include protected raw text']:
        e = d.find('//label[contains(.,' + json.dumps(label) + ')]/input')
        d.command('POST', '/element/' + e + '/click', {})
    d.wait(lambda: '3 matches' in d.script("return document.querySelector('.find-panel [role=status]').textContent;"), 'Visible-only filtering')
    e = d.find('//label[contains(.,"Case sensitive")]/input')
    d.command('POST', '/element/' + e + '/click', {})
    d.wait(lambda: '2 matches' in d.script("return document.querySelector('.find-panel [role=status]').textContent;"), 'Case-sensitive count')
    # Current scene follows the retained editor caret, with no section absorption.
    select = d.find('//label[contains(.,"Search scope")]/select')
    d.command('POST', '/element/' + select + '/value', {'text': '\ue015'})
    d.wait(lambda: d.script("return document.querySelector('.find-panel select').value==='scene';"), 'Current scene scope selected')
    d.wait(lambda: '0 matches' in d.script("return document.querySelector('.find-panel [role=status]').textContent;"), 'Case-sensitive last scene has no lowercase moon')
    d.command('POST', '/element/' + e + '/click', {})
    d.wait(lambda: '1 matches' in d.script("return document.querySelector('.find-panel [role=status]').textContent;"), 'Scene-only count')
    next_match(10)
    select = d.find('//label[contains(.,"Search scope")]/select')
    d.command('POST', '/element/' + select + '/value', {'text': '\ue013'})
    d.wait(lambda: d.script("return document.querySelector('.find-panel select').value==='script';"), 'Full script scope restored')
    # Escape closes without restoring an earlier caret.
    d.click('Find', actions=True)
    d.command('POST', '/actions', {'actions': [{'type': 'key', 'id': 'find-escape', 'actions': [{'type': 'keyDown', 'value': '\ue00c'}, {'type': 'keyUp', 'value': '\ue00c'}]}]})
    assert d.script("return !document.querySelector('.find-panel') && document.activeElement?.classList.contains('ProseMirror');")
    assert target.read_bytes() == source
    d.close_session(); d.audit(target, source)
    print('PASS native find shortcuts / exact hidden-title-raw selection / wrap / filters / focus / no writes', flush=True)

    # Find navigation is isolated from authored Undo and counts refresh after edits.
    source = b'.INT. UNDO - DAY\n!moon\n[[moon]]\n'
    target = open_source('find-undo', source)
    d.click('Find', actions=True); query('moon', 2)
    next_match(1)
    d.type_text('sun')
    d.wait(lambda: '1 matches' in d.script("return document.querySelector('.find-panel [role=status]').textContent;"), 'Authored edit invalidates and refreshes find')
    next_match(2)
    d.type_text('\ue009z\ue000')
    d.wait(lambda: '2 matches' in d.script("return document.querySelector('.find-panel [role=status]').textContent;"), 'Undo restores count without consuming navigation')
    d.click('Close find'); d.click('Save', actions=True); d.audit(target, source)
    d.wait(lambda: 'Saved locally' in d.body(), 'Exact source receipt')
    d.close_session(); d.audit(target, source)
    print('PASS native authored Undo across hidden navigation / fresh counts / exact Save', flush=True)

    # Actual pinyin composition in the local find query; no author edit is committed.
    source = b'.INT. IME - DAY\n!moon\n'
    target = open_source('find-ime', source)
    d.click('Find', actions=True)
    d.script("window.findIme=[];for(const kind of ['compositionstart','compositionend'])document.querySelector('.find-panel input[type=search]').addEventListener(kind,e=>window.findIme.push({kind,trusted:e.isTrusted}));")
    previous = subprocess.check_output(['fcitx5-remote', '-n'], text=True).strip()
    try:
        clients = [c for c in d.owned_clients() if c.get('class') == 'babel-desktop']
        assert len(clients) == 1
        address = clients[0]['address']
        assert address.startswith('0x') and all(c in '0123456789abcdef' for c in address[2:])
        subprocess.run(['hyprctl', 'dispatch', 'hl.dsp.focus({ window = "address:' + address + '" })'], check=True, stdout=subprocess.DEVNULL)
        subprocess.run(['fcitx5-remote', '-s', 'pinyin'], check=True); time.sleep(.5)
        subprocess.run(['wtype', '-d', '80', 'nihao'], check=True); time.sleep(.5)
        subprocess.run(['wtype', '-k', 'space'], check=True); time.sleep(.5)
        assert d.script("return document.querySelector('.find-panel input[type=search]').value;") == '你好'
        assert d.script("return document.activeElement?.type==='search';")
        subprocess.run(['wtype', '-d', '80', 'nihao'], check=True); time.sleep(.5)
        subprocess.run(['/tmp/babel-m3-08-keyboard', 'escape'], check=True); time.sleep(.5)
        assert d.script("return !!document.querySelector('.find-panel');"), 'Preedit Escape must remain local'
    finally:
        subprocess.run(['fcitx5-remote', '-s', previous], check=True)
    events = d.script('return window.findIme;')
    assert sum(e['kind'] == 'compositionend' and e['trusted'] for e in events) >= 2, events
    d.click('Close find'); d.close_session(); d.audit(target, source)
    print('PASS native pinyin query commit/cancel / author bytes retained', flush=True)

    measure(d, open_source, query, report)


def measure(d, open_source, query, report):
    for name, scenes in [('typical', 150), ('stress', 1500)]:
        text = 'Title: Synthetic find workload\n\n# Act\n' + ''.join(f'.INT. ROOM {at} - DAY #{at%7}#\n= Arrival {at}\n= Conflict unfolds\n!Zoë arrives with a worn notebook and reads the sign.\n!A lamp flickers above the doorway.\n\n@MAYA\nThe door is open.\nCome inside.\nWe have time.\n\n@NOAH\nI saw the signal.\nWe should leave.\nWait here.\n\n!They cross the room in silence.\n!A bell rings outside.\n' for at in range(scenes))
        source = text.encode()
        target = open_source('find-' + name, source)
        d.click('Find', actions=True)
        # Start on trusted input; observe ready count and two rAFs from MutationObserver.
        d.script("window.findTiming=null;let start;const input=document.querySelector('.find-panel input[type=search]');input.addEventListener('input',e=>{if(e.isTrusted)start=performance.now();});const observer=new MutationObserver(()=>{const status=document.querySelector('.find-panel [role=status]');if(start!==undefined&&input.value===arguments[0]&&status.textContent.startsWith('1 matches')){const initial=start;observer.disconnect();requestAnimationFrame(()=>requestAnimationFrame(()=>window.findTiming=performance.now()-initial));}});observer.observe(document.querySelector('.find-panel'),{subtree:true,childList:true,characterData:true});", [f'ROOM {scenes-1} -'])
        query(f'ROOM {scenes-1} -', 1)
        duration = d.wait(lambda: d.script('return window.findTiming;'), 'Visible search frame observation', timeout=30)
        d.script("window.findNavigationTiming=null;window.findStages={};const row=arguments[0];const b=[...document.querySelectorAll('.find-panel button')].find(b=>b.textContent==='Next match');b.addEventListener('click',()=>{const start=performance.now();document.addEventListener('click',()=>window.findStages.handlerMs=performance.now()-start,{once:true});const check=()=>{const s=getSelection();const p=(s.focusNode?.nodeType===1?s.focusNode:s.focusNode?.parentElement)?.closest('.ProseMirror > p');const r=p?.getBoundingClientRect();if(!b.disabled&&document.querySelector('.find-reveal')&&!window.findStages.readyMs)window.findStages.readyMs=performance.now()-start;if(p&&[...document.querySelectorAll('.ProseMirror > p')].indexOf(p)===row&&r.top>=0&&r.bottom<=innerHeight&&!b.disabled)requestAnimationFrame(()=>requestAnimationFrame(()=>window.findNavigationTiming=performance.now()-start));else requestAnimationFrame(check);};requestAnimationFrame(check);},{once:true});", [3+(scenes-1)*18])
        d.click('Next match')
        try:
            navigation = d.wait(lambda: d.script('return window.findNavigationTiming;'), 'Navigation frame observation')
        except AssertionError:
            print('NAV DEBUG', d.script("const s=getSelection();const p=(s.focusNode?.nodeType===1?s.focusNode:s.focusNode?.parentElement)?.closest('.ProseMirror > p');const r=p?.getBoundingClientRect();return {row:[...document.querySelectorAll('.ProseMirror > p')].indexOf(p),text:s.toString(),top:r?.top,bottom:r?.bottom,height:innerHeight,active:document.activeElement?.className,disabled:document.querySelector('.find-panel button').disabled};"), flush=True)
            raise
        row = d.script("const s=getSelection();const p=(s.focusNode?.nodeType===1?s.focusNode:s.focusNode?.parentElement)?.closest('.ProseMirror > p');const r=p.getBoundingClientRect();return {row:[...document.querySelectorAll('.ProseMirror > p')].indexOf(p),visible:r.top>=0&&r.bottom<=innerHeight};")
        assert row['row'] == 3 + (scenes-1)*18 and row['visible'], row
        if name == 'typical': assert duration < 200 and navigation < 200, (duration, navigation, d.script('return window.findStages;'))
        report.append({'name': name, 'scenes': scenes, 'lines': 3+scenes*18, 'bytes': len(source), 'sha256': hashlib.sha256(source).hexdigest(), 'trustedLastInputToCountAndTwoFramesMs': duration, 'clickToSelectionAndTwoFramesMs': navigation})
        d.screenshot('find-' + name)
        d.click('Close find'); d.close_session(); d.audit(target, source)
    (d.ROOT/'find-measurements.json').write_text(json.dumps(report, indent=2) + '\n')
    print('MEASUREMENTS', json.dumps(report), flush=True)
    print('PASS default-release typical/stress find + last-heading navigation / exact bytes', flush=True)
    print('ARTIFACTS', d.ROOT, flush=True)


def run_timing(d):
    """Independent current timing path; full run's IME prerequisite remains required."""
    def open_source(name, source):
        target = d.ROOT / 'files' / (name + '.fountain')
        target.write_bytes(source)
        d.click('Open Fountain', actions=True); d.picker(target)
        d.wait(lambda:d.script("return !!document.querySelector('.outline-target:not(:disabled)') && document.querySelector('#writing-save')?.disabled===false;"), 'Timing projection current', timeout=90)
        return target
    def query(text, count):
        d.set_input('Find text', text)
        d.wait(lambda:f'{count} matches' in d.script("return document.querySelector('.find-panel [role=status]').textContent;"), 'Exact timing query count', timeout=60)
    measure(d, open_source, query, [])
