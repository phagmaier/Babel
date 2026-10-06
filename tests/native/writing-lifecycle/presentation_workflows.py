"""M4-10 default release presentation, owned input and synthetic files only.
DOM probes record selection/geometry/events; no native invoke/editor-state hook.
"""
import hashlib
import json
import subprocess
import time


OBSERVE = """
const s=getSelection();
const p=(s?.focusNode?.nodeType===1?s.focusNode:s?.focusNode?.parentElement)?.closest('.ProseMirror > p');
const save=document.querySelector('#writing-save');
const outline=document.querySelector('.manuscript-outline');
const enabled=document.querySelectorAll('.outline-target:not(:disabled)').length;
const editable=document.querySelector('.ProseMirror')?.contentEditable;
const protection=document.querySelector('section[aria-label="Protection status"]');
const events=window.presentationEvents??[];
return {
    browserTime:performance.now(), browserTimeOrigin:performance.timeOrigin,
    predicates:{savePresent:!!save, saveEnabled:save?.disabled===false,
        enabledOutlinePresent:enabled>0, editable:editable==='true',
        outlineCurrent:outline?.innerText.includes('Outline is current.')===true,
        savedStatus:protection?.querySelector('p[role="status"]')?.textContent==='Saved locally'},
    saveDisabled:save?.disabled,
    actions:[...document.querySelectorAll('.actions button')].map(b=>({text:b.textContent.trim(),disabled:b.disabled,title:b.title})),
    outlineCount:document.querySelectorAll('.outline-target').length, outlineEnabled:enabled,
    filter:outline?.querySelector('input')?.value, outlineStatus:outline?.innerText.slice(0,800),
    protection:protection?.innerText, saveDetails:protection?.querySelector('details')?.textContent,
    compositionStarts:events.filter(e=>e.trusted&&e.kind==='compositionstart').length,
    compositionEnds:events.filter(e=>e.trusted&&e.kind==='compositionend').length,
    events, active:document.activeElement?.id, editable,
    selection:{row:[...document.querySelectorAll('.ProseMirror > p')].indexOf(p),anchor:s?.anchorOffset,head:s?.focusOffset,text:s?.toString()}
};
"""


def run(d, *, restart=True, control="baseline"):
    assert control in ["baseline", "preedit-disabled", "no-ime", "typical-only", "no-zoom", "cleanup-probes"]
    report = []
    workload = 'home'
    stage = 'open'

    def observe(reason):
        # DOM-only observations survive a failed workload and precede teardown.
        # Disabled controls are facts, not inferred internal action/composition state.
        facts = d.script(OBSERVE)
        with (d.ROOT / 'presentation-stages.jsonl').open('a') as log:
            log.write(json.dumps({'wallTime': time.time(), 'monotonicTime': time.monotonic(), 'workload': workload,
                                  'stage': stage, 'reason': reason, **facts}) + '\n')
        return facts

    d.presentation_observe = observe

    def ready():
        def check():
            predicates = observe('readiness-poll')['predicates']
            # Preserve the original oracle. Editability and other facts are
            # independent observations, never extra admission or waived guards.
            return predicates['enabledOutlinePresent'] and predicates['saveEnabled']
        try:
            d.wait(check, 'Ready current screenplay', timeout=90)
        except AssertionError:
            facts = observe('readiness-failure')
            (d.ROOT / 'presentation-readiness-failure.json').write_text(json.dumps(facts, indent=2) + '\n')
            print('READINESS FAILURE', json.dumps(facts), flush=True)
            raise
        observe('ready')

    def choose(label, value):
        if control == 'no-zoom' and label == 'Writing zoom':
            value = 100
        element = d.find('//select[@aria-label=' + json.dumps(label) + ']')
        d.command('POST', '/element/' + element + '/click', {})
        option = d.find('//select[@aria-label=' + json.dumps(label) + ']/option[@value=' + json.dumps(str(value)) + ']')
        d.command('POST', '/element/' + option + '/click', {})
        d.wait(lambda: str(d.command('GET', '/element/' + element + '/property/value')) == str(value), 'Selected ' + label)

    def key(value):
        d.command('POST', '/actions', {'actions': [{'type': 'key', 'id': 'presentation-key', 'actions': [{'type': 'keyDown', 'value': value}, {'type': 'keyUp', 'value': value}]}]})

    def select(row, offset):
        d.script("const p=document.querySelectorAll('.ProseMirror > p')[arguments[0]];const root=p.closest('.ProseMirror');root.focus();const w=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);let n,left=arguments[1];while(n=w.nextNode()){if(left<=n.length){getSelection().setBaseAndExtent(n,left,n,left);return;}left-=n.length;}throw Error('Offset');", [row, offset])
        time.sleep(.2)

    def selection():
        return d.script("const s=getSelection();const p=(s.focusNode?.nodeType===1?s.focusNode:s.focusNode?.parentElement)?.closest('.ProseMirror > p');return {row:[...document.querySelectorAll('.ProseMirror > p')].indexOf(p),anchor:s.anchorOffset,head:s.focusOffset,text:s.toString()};")

    def save(target, source):
        ready(); observe('before-save'); d.click('Save', actions=True); d.audit(target, source)
        d.wait(lambda: 'Saved locally' in d.body(), 'Exact source receipt')
        observe('source-receipt')
        ready()  # Publication receipt can precede the native operation's thaw.

    def owned_focus():
        clients = [c for c in d.owned_clients() if c.get('class') == 'babel-desktop']
        assert len(clients) == 1
        address = clients[0]['address']
        assert address.startswith('0x') and all(c in '0123456789abcdef' for c in address[2:])
        subprocess.run(['hyprctl', 'dispatch', 'hl.dsp.focus({ window = "address:' + address + '" })'], check=True, stdout=subprocess.DEVNULL)

    def row_center():
        return d.script("const s=getSelection(),r=document.createRange();r.setStart(s.focusNode,s.focusOffset);r.collapse(true);const c=r.getBoundingClientRect();return {center:(c.top+c.bottom)/2,viewport:innerHeight,scroll:scrollY,header:document.querySelector('.writing-presentation').getBoundingClientRect().bottom};")

    choose('Theme', 'dark')
    assert d.script("return document.documentElement.dataset.theme;") == 'dark'
    d.screenshot('presentation-home-dark')
    workloads = [('typical', 150)] if control == 'typical-only' else [('typical', 150), ('stress', 1500)]
    for name, scenes in workloads:
        workload = name
        stage = 'open'
        text = '\ufeffTitle: Synthetic presentation\r\n\r\n# Act\r\n' + ''.join(
            f'.INT. ROOM {i} - DAY\r\n!Zoë reads the sign.  \r\n!A lamp flickers.\r\n\r\n@MAYA\r\nThe door is open.\r\nCome inside.\r\nWe have time.\r\n\r\n@NOAH\r\nI saw the signal.\r\nWe should leave.\r\nWait here.\r\n\r\n!They cross in silence.\r\n!A bell rings.\r\n!A long line ' + 'wraps across the screen with Unicode é🚀. ' * 8 + '\r\n!Tail.\r\n'
            for i in range(scenes))
        source = text.encode(); target = d.ROOT / 'files' / ('presentation-' + name + '.fountain'); target.write_bytes(source)
        d.click('Open Fountain', actions=True); d.picker(target); ready(); save(target, source)
        editor = d.editor()
        select(4, 3); before = selection()
        probe = "window.presentationEvents=[];window.presentationSync=[];window.presentationFrames=[];const root=document.querySelector('.ProseMirror');for(const kind of ['keydown','beforeinput','input']){let start;root.addEventListener(kind,e=>{if(e.isTrusted)start=performance.now();},true);document.addEventListener(kind,e=>{if(root.contains(e.target)&&e.isTrusted&&start!==undefined){window.presentationSync.push({kind,ms:performance.now()-start});if(kind==='input')requestAnimationFrame(()=>window.presentationFrames.push(performance.now()-start));}});}for(const kind of ['compositionstart','compositionend'])root.addEventListener(kind,e=>window.presentationEvents.push({kind,trusted:e.isTrusted,scroll:scrollY,browserTime:performance.now(),wallTime:Date.now()}));window.presentationToggles=[];window.presentationToggleSync=[];let toggleStart;document.addEventListener('change',e=>{if(root.closest('main')?.querySelector('.presentation')?.contains(e.target)&&toggleStart!==undefined)window.presentationToggleSync.push(performance.now()-toggleStart);});document.querySelector('.presentation').addEventListener('change',e=>{const start=performance.now();toggleStart=start;requestAnimationFrame(()=>requestAnimationFrame(()=>window.presentationToggles.push({control:e.target.getAttribute('aria-label')||e.target.type,ms:performance.now()-start})));},true);"
        if control == 'cleanup-probes':
            probe = ("const listeners=[],frames=new Set();"
                "const listen=(target,kind,handler,capture=false)=>{target.addEventListener(kind,handler,capture);listeners.push(()=>target.removeEventListener(kind,handler,capture));};"
                "const frame=callback=>{const id=requestAnimationFrame(t=>{frames.delete(id);callback(t);});frames.add(id);return id;};"
                "window.disposePresentationProbe=()=>{for(const remove of listeners)remove();for(const id of frames)cancelAnimationFrame(id);delete window.disposePresentationProbe;};"
                + probe.replace("root.addEventListener(", "listen(root,")
                    .replace("document.addEventListener(", "listen(document,")
                    .replace("document.querySelector('.presentation').addEventListener(", "listen(document.querySelector('.presentation'),")
                    .replace("requestAnimationFrame(", "frame("))
        d.script(probe)
        choose('Writing zoom', 75); choose('Writing zoom', 200); choose('Writing zoom', 150); choose('Theme', 'light')
        assert selection() == before, (before, selection())
        assert d.editor() == editor
        assert d.script("return getComputedStyle(document.querySelector('.ProseMirror')).fontSize;") == ('16px' if control == 'no-zoom' else '24px')
        d.click('Focus mode')
        assert d.script("return getComputedStyle(document.querySelector('.manuscript-outline')).display;") == 'none'
        assert d.script("return document.querySelector('#writing-save').getBoundingClientRect().height>0 && document.querySelector('#writing-focus').textContent.includes('Exit');")
        element = d.find('//label[contains(.,"Typewriter scroll")]/input')
        if not d.command('GET', '/element/' + element + '/property/checked'):
            d.command('POST', '/element/' + element + '/click', {})
        select(3 + 18 * (scenes - 1) + 17, 5)
        d.type_text('x')
        d.wait(lambda: abs(row_center()['center'] - row_center()['viewport'] / 2) < 6, 'Typewriter caret centered after intended input', timeout=30)
        centered = row_center(); assert centered['center'] > centered['header']
        # Manual wheel gesture; follow stays quiet without more editing.
        d.command('POST', '/actions', {'actions': [{'type': 'wheel', 'id': 'manual-scroll', 'actions': [{'type': 'scroll', 'x': 500, 'y': 400, 'deltaX': 0, 'deltaY': -220, 'duration': 100}]}]})
        manual = row_center()['scroll']; time.sleep(.6); assert abs(row_center()['scroll'] - manual) < 2
        d.screenshot('presentation-' + name + '-focus-150')
        # Escape exits focus, does not edit or move the logical caret.
        before = selection(); key('\ue00c'); d.wait(lambda: not d.script("return document.querySelector('main').classList.contains('writing-focus');"), 'Escape exits focus')
        assert selection() == before
        # Undo must contain only the authored input, not presentation changes.
        d.script("document.querySelector('.ProseMirror').focus();")
        d.type_text('\ue009z\ue000'); save(target, source)
        # Outline jump with typewriter enabled stays visible, without recentering.
        d.set_input('Filter outline', 'ROOM 0 -')
        d.wait(lambda: d.script("return [...document.querySelectorAll('.outline-target:not(:disabled)')].some(b=>b.getAttribute('aria-label')==='Go to Scene 1: INT. ROOM 0 - DAY');"), 'Filtered navigation enabled')
        button = d.find('//button[@aria-label="Go to Scene 1: INT. ROOM 0 - DAY"]')
        d.script("arguments[0].scrollIntoView({block:'center'});", [{d.ELEMENT: button}])
        d.command('POST', '/element/' + button + '/click', {})
        d.wait(lambda: selection()['row'] == 3, 'Outline targets first scene')
        time.sleep(.4); caret = row_center(); assert caret['header'] <= caret['center'] <= caret['viewport'], caret
        # Find selection owns navigation while typewriter is enabled.
        d.click('Find', actions=True); d.set_input('Find text', 'ROOM 0 - DAY')
        d.wait(lambda: d.script("return [...document.querySelectorAll('.find-panel button')].some(b=>b.textContent.trim()==='Next match'&&!b.disabled);"), 'Current Find match')
        d.click('Next match'); d.wait(lambda: selection()['row'] == 3 and selection()['text'] == 'ROOM 0 - DAY', 'Exact Find selection')
        time.sleep(.3); found = row_center(); assert found['header'] <= found['center'] <= found['viewport'], found
        time.sleep(.3); assert abs(row_center()['scroll'] - found['scroll']) < 2
        d.screenshot('presentation-' + name + '-find-150'); d.click('Close find')
        # Established duplicate cue offers local completion at its segment end.
        d.click('Focus mode'); choose('Writing zoom', 200)
        d.script("document.querySelectorAll('.ProseMirror > p')[7].scrollIntoView({block:'center'});"); select(7, 4)
        d.wait(lambda: d.script("return document.querySelector('.completion-popup')?.hidden===false;"), 'Zoomed completion offer')
        geometry = d.script("const s=getSelection(),r=document.createRange();r.setStart(s.focusNode,s.focusOffset);r.collapse(true);const c=r.getBoundingClientRect(),p=document.querySelector('.completion-popup').getBoundingClientRect();return {caret:{left:c.left,top:c.top,bottom:c.bottom},popup:{left:p.left,top:p.top,bottom:p.bottom},width:innerWidth,height:innerHeight};")
        assert abs(geometry['popup']['left'] - max(8, min(geometry['caret']['left'], geometry['width'] - 280))) < 3, geometry
        assert geometry['popup']['top'] >= 0 and geometry['popup']['bottom'] <= geometry['height'], geometry
        d.screenshot('presentation-' + name + '-popup-200')
        key('\ue00c'); assert d.script("return document.querySelector('main').classList.contains('writing-focus') && document.querySelector('.completion-popup').hidden;")
        key('\ue00c'); assert not d.script("return document.querySelector('main').classList.contains('writing-focus');")
        choose('Writing zoom', 150)
        if control != 'no-ime':
            stage = 'ime-commit'
            # Actual composition with zoom and typewriter enabled, commit + cancel.
            d.script("document.querySelectorAll('.ProseMirror > p')[4].scrollIntoView({block:'center'});"); select(4, 3); owned_focus()
            previous = subprocess.check_output(['fcitx5-remote', '-n'], text=True).strip()
            try:
                subprocess.run(['fcitx5-remote', '-s', 'pinyin'], check=True); time.sleep(.5)
                subprocess.run(['wtype', '-d', '80', 'nihao'], check=True); time.sleep(.6)
                preedit_scroll = row_center()['scroll']; d.screenshot('presentation-' + name + '-ime-150'); time.sleep(.3); assert abs(row_center()['scroll'] - preedit_scroll) < 2
                subprocess.run(['wtype', '-k', 'space'], check=True); time.sleep(.5)
                save(target, source.replace('!Zoë reads'.encode(), '!Zoë你好 reads'.encode(), 1))
                stage = 'ime-committed-text-undo'
                d.script("document.querySelector('.ProseMirror').focus();"); d.type_text('\ue009z\ue000'); save(target, source)
                stage = 'ime-cancel'
                select(4, 3); owned_focus(); subprocess.run(['wtype', '-d', '80', 'nihao'], check=True); time.sleep(.6)
                subprocess.run(['/tmp/babel-m3-08-keyboard', 'escape'], check=True); time.sleep(.4); save(target, source)
            finally:
                subprocess.run(['fcitx5-remote', '-s', previous], check=True)
            events = d.script('return window.presentationEvents;')
            if control == 'preedit-disabled':
                assert not any(e['kind'] == 'compositionstart' and e['trusted'] for e in events), events
            else:
                assert sum(e['kind'] == 'compositionstart' and e['trusted'] for e in events) >= 2, events
                assert sum(e['kind'] == 'compositionend' and e['trusted'] for e in events) >= 2, events
        # Save divergence remains visible in focus with a discoverable exit.
        stage = 'divergent-original'
        target.write_bytes(source + b'!External.\r\n'); d.click('Focus mode')
        d.wait(lambda:d.script("return document.querySelector('main').classList.contains('writing-focus');"), 'Focus mode adopted before Find')
        d.script("document.querySelector('.ProseMirror').focus();"); d.command('POST', '/actions', {'actions': [{'type': 'key', 'id': 'focus-find-chord', 'actions': [{'type': 'keyDown', 'value': '\ue009'}, {'type': 'keyDown', 'value': 'f'}, {'type': 'keyUp', 'value': 'f'}, {'type': 'keyUp', 'value': '\ue009'}]}]})
        d.wait(lambda: d.script("return !!document.querySelector('.find-panel');"), 'Find opens in focus')
        d.script("document.querySelector('#writing-focus').focus();")
        print('PRESENTATION BEFORE ESCAPE', d.script("return {focus:document.querySelector('main').classList.contains('writing-focus'),panel:!!document.querySelector('.find-panel'),active:document.activeElement?.id};"),flush=True)
        key('\ue00c')
        assert d.script("return document.querySelector('main').classList.contains('writing-focus') && !!document.querySelector('.find-panel');")
        d.click('Close find')
        d.script("document.querySelector('.ProseMirror').focus();"); key('\ue036')
        assert d.script("return document.activeElement.id;") == 'writing-save'
        key('\ue007')
        d.wait(lambda: 'External change detected' in d.body(), 'Persistent source failure')
        d.script("window.scrollBy(0,500);")
        assert d.script("const p=document.querySelector('section[aria-label=\"Protection status\"]');const r=p.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&p.innerText.includes('External change');")
        d.screenshot('presentation-' + name + '-failure')
        d.click('Exit focus mode'); copy = d.ROOT / 'copies' / ('presentation-' + name + '.fountain')
        assert d.editor() == editor  # Presentation never rebuilt the editor; Save As may adopt a native session.
        before_copy = d.script("return [...document.querySelectorAll('.ProseMirror > p')].map(p=>p.textContent);")
        old_heads = [m for m, s in d.journal_records() if s == source]
        assert old_heads, 'Old draft has no independently inspected checkpoint'
        stage = 'save-as'
        observe('before-picker')
        d.click('Save As', actions=True); d.picker(copy); d.audit(copy, source); ready()
        # A standalone copy does not prove adoption. Subsequent Save must target
        # the copy; Undo restores its independent literal source oracle.
        if 'stands alone' in d.body():
            d.audit(target, source + b'!External.\r\n'); d.audit(copy, source)
            assert d.script("return [...document.querySelectorAll('.ProseMirror > p')].map(p=>p.textContent);") == before_copy, 'Refusal changed the old editor content'
            assert any(m['documentId'] == old_heads[-1]['documentId'] and s == source for m, s in d.journal_records()), 'Refusal lost the old recovery identity'
            (d.ROOT / 'presentation-save-as-refusal.json').write_text(json.dumps({'workload': name, 'protection': d.script("return document.querySelector('section[aria-label=\"Protection status\"]')?.innerText;"), 'oldDocumentId': old_heads[-1]['documentId'], 'copySha256': hashlib.sha256(source).hexdigest(), 'oldEditorAndRecoveryPreserved': True}, indent=2) + '\n')
            raise AssertionError('Save As refused adoption; old editor/recovery and standalone copy preserved')
        stage = 'adopted-copy-edit'
        select(4, 3); d.type_text('x')
        edited = source.replace('!Zoë reads'.encode(), '!Zoëx reads'.encode(), 1)
        save(copy, edited); d.audit(target, source + b'!External.\r\n')
        stage = 'adopted-copy-undo'
        d.script("document.querySelector('.ProseMirror').focus();")
        d.type_text('\ue009z\ue000'); save(copy, source)
        choose('Theme', 'dark'); choose('Writing zoom', 100)
        metrics = d.script('return {events:window.presentationEvents,sync:window.presentationSync,frames:window.presentationFrames,toggles:window.presentationToggles,toggleSync:window.presentationToggleSync,devicePixelRatio};')
        report.append({'control': control, 'workload': name, 'scenes': scenes, 'rows': 3 + 18 * scenes, 'bytes': len(source), 'sha256': hashlib.sha256(source).hexdigest(), 'centered': centered, 'popupGeometry': geometry, **metrics})
        if control == 'cleanup-probes':
            d.script('window.disposePresentationProbe();')
        stage = 'protected-close'
        observe('before-close')
        d.close_session(); d.audit(target, source + b'!External.\r\n'); d.audit(copy, source)
        assert d.script("return document.documentElement.dataset.theme;") == 'dark'
    # Same private profile restart reads preferences; UI-only key has no manuscript.
    if restart:
        d.release_session(); d.new_session()
    assert d.script("return document.documentElement.dataset.theme;") == 'dark'
    settings = d.script("return JSON.parse(localStorage.getItem('babel.view.v1'));")
    assert settings == {'version': 1, 'settings': {'theme': 'dark', 'zoom': 100, 'focus': False, 'typewriter': True}}, settings
    (d.ROOT / 'presentation-measurements.json').write_text(json.dumps(report, indent=2) + '\n')
    print('PRESENTATION CONTROL', control, '— diagnostic omissions are not acceptance', flush=True)
    print(('PASS native presentation / caret+manual scroll+outline / pinyin commit+cancel / Undo / visible failure / exact bytes / ' if control == 'baseline' else 'PASS diagnostic presentation control=' + control + ' / exercised oracles only / ') + ('restart' if restart else 'restart omitted (diagnostic)'), flush=True)
    print('ARTIFACTS', d.ROOT, flush=True)
