"""M3-13 independent default-app editor audits, composed with the safety drill.

Only DOM observations/selections and actual keys/pickers drive authoring. No
EditorView access, IPC injection, test feature, or implementation-generated
expected source. All output remains under the parent's disposable root.
"""
import hashlib
import json
import subprocess
import time


def run(d):
    report = []

    def rows():
        return d.script("""return [...document.querySelectorAll('.ProseMirror > p')].map(p =>
          ({kind:p.dataset.kind, text:p.textContent, attrs:JSON.parse(p.dataset.origin),
            marks:[...p.querySelectorAll('strong,em,u')].map(n=>[n.tagName,n.textContent])}));""")

    def open_source(name, source):
        target = d.ROOT / 'files' / (name + '.fountain')
        target.write_bytes(source)
        d.click('Open Fountain', actions=True)
        d.picker(target)
        d.wait(lambda: d.script("return !!document.querySelector('.ProseMirror');"), 'Editor opens ' + name)
        d.wait(lambda: 'Close session' in d.body(), 'Session ready ' + name)
        return target

    def save(target, expected):
        d.click('Save', actions=True)
        d.audit(target, expected)
        d.wait(lambda: 'Saved locally' in d.body(), 'Exact source receipt visible')

    def select(row, anchor, head=None):
        head = anchor if head is None else head
        d.script("""const p=document.querySelectorAll('.ProseMirror > p')[arguments[0]];
          const root=p.closest('.ProseMirror');root.focus();
          const point=offset=>{const w=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);
            let n;while(n=w.nextNode()){if(offset<=n.length)return [n,offset];offset-=n.length;}
            if(offset===0)return [p,0];throw Error('Selection offset outside row');};
          const a=point(arguments[1]),h=point(arguments[2]);
          window.getSelection().setBaseAndExtent(a[0],a[1],h[0],h[1]);""", [row, anchor, head])
        time.sleep(.15)
        assert selection() == {'row': row, 'anchor': anchor, 'head': head}

    def selection():
        return d.script("""const s=window.getSelection();const ps=[...document.querySelectorAll('.ProseMirror > p')];
          const p=(s.anchorNode?.nodeType===1?s.anchorNode:s.anchorNode?.parentElement)?.closest('p');
          if(!p)return null;const offset=(n,o)=>{const r=document.createRange();r.selectNodeContents(p);r.setEnd(n,o);return r.toString().length;};
          return {row:ps.indexOf(p),anchor:offset(s.anchorNode,s.anchorOffset),head:offset(s.focusNode,s.focusOffset)};""")

    def focus_owned():
        clients = [c for c in d.owned_clients() if c.get('class') == 'babel-desktop']
        assert len(clients) == 1, 'Exactly one owned app receives input'
        address = clients[0]['address']
        assert address.startswith('0x') and all(c in '0123456789abcdef' for c in address[2:])
        subprocess.run(['hyprctl', 'dispatch', 'hl.dsp.focus({ window = "address:' + address + '" })'], check=True, stdout=subprocess.DEVNULL)
        active = json.loads(subprocess.check_output(['hyprctl', '-j', 'activewindow']))
        assert active['address'] == address

    def physical(key):
        focus_owned()
        subprocess.run(['/tmp/babel-m3-08-keyboard', key], check=True)
        time.sleep(.2)

    def chord(key, shift=False):
        d.script("document.querySelector('.ProseMirror').focus();")
        actions = [{'type':'keyDown','value':'\ue009'}]
        if shift:
            actions.append({'type':'keyDown','value':'\ue008'})
        actions += [{'type':'keyDown','value':key}, {'type':'keyUp','value':key}]
        if shift:
            actions.append({'type':'keyUp','value':'\ue008'})
        actions.append({'type':'keyUp','value':'\ue009'})
        d.command('POST', '/actions', {'actions':[{'type':'key','id':'exit-keys','actions':actions}]})
        time.sleep(.15)

    corpus = json.loads((d.REPO / 'fixtures/expected/m3-conformance.json').read_text())
    complex_cases = json.loads((d.REPO / 'fixtures/expected/m3-complex.json').read_text())['cases']
    # Exact source oracles predate this integration. Check their provenance
    # hashes before the app can read them. Every corpus file is a private copy.
    for case in corpus['cases']:
        source = case['sourceLiteral'].encode()
        assert hashlib.sha256(source).hexdigest() == case['sha256']
        assert (d.REPO / 'fixtures/fountain' / case['file']).read_bytes() == source
        target = open_source('corpus-' + case['id'], source)
        before = rows()
        assert before, case['id']
        if case['id'] in ['primary', 'dialogue', 'dual']:
            observed = [{'kind':r['kind'], 'text':r['text']} for r in before if r['text']]
            expected = [{'kind':r['kind'], 'text':r['text']} for r in case['proofAtoms']]
            assert observed == expected, (case['id'], observed, expected)
            for r in before:
                if r['attrs']['sceneNumber']:
                    assert any(a.get('sceneNumber') == r['attrs']['sceneNumber'] and a['text'] == r['text'] for a in case['proofAtoms'])
            if case['id'] == 'dual':
                assert before[3]['attrs']['dualWith'] == before[0]['attrs']['id']
                assert before[1]['attrs']['speechOf'] == before[0]['attrs']['id']
                assert before[4]['attrs']['speechOf'] == before[3]['attrs']['id']
        # Native no-op must retain encoding, unknown regions, spaces and EOF.
        save(target, source)
        edit = case.get('edit')
        if edit and case['id'] != 'emphasis':
            row = edit['line']
            select(row, 0, len(before[row]['text'].encode('utf-16-le')) // 2)
            d.type_text(edit['text'])
            expected = edit['sourceLiteral'].encode()
            assert hashlib.sha256(expected).hexdigest() == edit['sha256']
            save(target, expected)
            assert rows()[row]['text'] == edit['text']
            chord('z')
            save(target, source)
            assert rows()[row]['text'] == before[row]['text']
        d.close_session()
        assert target.read_bytes() == source
        report.append({'case':case['id'], 'noOpSha256':case['sha256'], 'editedAndUndone': bool(edit and case['id'] != 'emphasis')})
    for case in complex_cases:
        source = case['source'].encode()
        assert hashlib.sha256(source).hexdigest() == case['sourceSha256']
        target = open_source('complex-' + case['id'], source)
        before = rows()
        if 'groups' in case['before']:
            for group in case['before']['groups']:
                cue = before[group['cue']]['attrs']['id']
                assert all(before[r]['attrs']['speechOf'] == cue for r in group['speech'])
        if case['id'] == 'nested-inline':
            assert any(r['marks'] for r in before)
        save(target, source)
        d.close_session()
        assert target.read_bytes() == source
        report.append({'case':'complex-' + case['id'], 'noOpSha256':case['sourceSha256']})
    invalid = corpus['invalidUtf8']
    source = bytes.fromhex(invalid['hex'])
    assert hashlib.sha256(source).hexdigest() == invalid['sha256']
    target = open_source('invalid-utf8', source)
    assert d.script("return document.querySelector('.ProseMirror').contentEditable;") == 'false'
    initial = rows()
    d.type_text('must not replace invalid bytes')
    assert rows() == initial
    d.close_session()
    assert target.read_bytes() == source
    report.append({'case':'invalid-utf8', 'readOnlySha256':invalid['sha256']})
    print('PASS independent 21-source native no-op corpus / eight edits / Undo / semantic groups / invalid UTF-8 refusal', flush=True)

    # Trusted physical clipboard, backward selection, emphasis, Unicode and
    # real IME all run with the production cadence/controller mounted.
    original = b'\n@MAYA\nHello world.\n'
    target = open_source('physical-input', original)
    d.script("""window.exitEvents=[];for(const kind of ['paste','copy','cut','compositionstart','compositionend','keydown'])
      document.querySelector('.ProseMirror').addEventListener(kind,e=>window.exitEvents.push({kind,trusted:e.isTrusted,key:e.key,code:e.code}));""")
    select(2, 12)
    physical('shift-home')
    assert selection() == {'row':2, 'anchor':12, 'head':0}
    d.type_text('Replacement שלום')
    save(target, '\n@MAYA\nReplacement שלום\n'.encode())
    chord('z')
    save(target, original)
    assert selection() == {'row':2, 'anchor':12, 'head':0}
    chord('b')
    save(target, b'\n@MAYA\n**Hello world.**\n')
    assert rows()[2]['marks'] == [['STRONG','Hello world.']]
    chord('z')
    save(target, original)
    select(2, 6, 11)
    clip = subprocess.Popen(['wl-copy', '--foreground', '--type', 'text/plain;charset=utf-8'], stdin=subprocess.PIPE)
    paste = 'INT. LAB - NIGHT\nمرحبا שלום 👩🏽‍🚀 é'
    clip.stdin.write(paste.encode()); clip.stdin.close(); time.sleep(.2)
    try:
        physical('v')
        save(target, ('\n@MAYA\nHello ' + paste + '.\n').encode())
        assert all(r['kind'] == 'dialogue' for r in rows()[2:]), rows()
        chord('z')
        save(target, original)
    finally:
        clip.terminate(); clip.wait(timeout=5)
    select(2, 6, 11)
    chord('b')
    physical('c')
    select(2, 12)
    physical('v')
    save(target, b'\n@MAYA\nHello **world**.**world**\n')
    chord('z'); chord('z')
    save(target, original)
    select(2, 12)
    d.type_text('שלום é 👩🏽‍🚀')
    expected = '\n@MAYA\nHello world.שלום é 👩🏽‍🚀\n'.encode()
    save(target, expected)
    time.sleep(.65)
    physical('backspace')
    save(target, '\n@MAYA\nHello world.שלום é \n'.encode())
    chord('z'); save(target, expected)
    chord('z'); save(target, original)

    previous_ime = subprocess.check_output(['fcitx5-remote','-n'], text=True).strip()
    def ime(name, text, finish):
        select(2, 12)
        focus_owned()
        subprocess.run(['fcitx5-remote','-s',name], check=True)
        time.sleep(.5)
        assert subprocess.check_output(['fcitx5-remote','-n'], text=True).strip() == name
        subprocess.run(['wtype','-d','80',text], check=True)
        time.sleep(.8)
        if finish == 'space':
            subprocess.run(['wtype','-k','space'], check=True)
        else:
            physical(finish)
        time.sleep(.5)
    try:
        ime('pinyin','nihao','space')
        save(target, '\n@MAYA\nHello world.你好\n'.encode())
        chord('z'); save(target, original)
        ime('pinyin','nihao','escape')
        save(target, original)
        ime('mozc','ai','return')
        save(target, '\n@MAYA\nHello world.あい\n'.encode())
        assert len(rows()) == 3, 'Committing Enter must not split a row'
        chord('z'); save(target, original)
    finally:
        subprocess.run(['fcitx5-remote','-s',previous_ime], check=True)
    events = d.script('return window.exitEvents;')
    assert any(e['kind'] == 'paste' and e['trusted'] for e in events)
    assert any(e['kind'] == 'copy' and e['trusted'] for e in events)
    assert sum(e['kind'] == 'compositionend' and e['trusted'] for e in events) >= 3
    (d.ROOT / 'trusted-input.json').write_text(json.dumps(events, indent=2) + '\n')
    d.close_session()
    print('PASS default-app trusted clipboard / backward selection / rich paste / Unicode grapheme / pinyin commit+cancel / mozc Enter / Undo', flush=True)

    # A completion acceptance consumes Enter; the next key creates speech.
    original = b'@MAYA\nHello.\n\n@MA\n'
    target = open_source('completion', original)
    select(3, 2)
    d.wait(lambda: d.script("return [...document.querySelectorAll('[role=option]')].some(e=>e.textContent==='MAYA');"), 'Established local speaker suggested')
    physical('return')
    save(target, b'@MAYA\nHello.\n\n@MAYA\n')
    assert selection() == {'row':3, 'anchor':4, 'head':4}
    chord('z'); save(target, original)
    assert selection() == {'row':3, 'anchor':2, 'head':2}
    chord('z', shift=True)
    select(3, 4)
    physical('escape')
    physical('return')
    d.type_text('A new reply.')
    save(target, b'@MAYA\nHello.\n\n@MAYA\nA new reply.\n')
    assert rows()[-1]['kind'] == 'dialogue'
    d.script("document.querySelector('.ProseMirror').focus();")
    physical('f6')
    assert d.script("return document.activeElement?.textContent;") == 'Save'
    d.screenshot('integrated-editor')
    d.close_session()
    report.append({'case':'production-input', 'trustedEvents':len(events), 'ime':['pinyin','mozc']})

    target = open_source('keyboard-matrix', b'!one two\n')
    select(0, 3)
    physical('return')
    save(target, b'!one\n! two\n')
    select(1, 0)
    physical('backspace')
    save(target, b'!one two\n')
    chord('z'); save(target, b'!one\n! two\n')
    select(0, 3)
    d.type_text('\ue017')  # native WebDriver Delete
    save(target, b'!one two\n')
    select(0, 7)
    d.type_text('\ue004')  # contextual Tab -> Character
    save(target, b'@one two\n')
    chord('z'); save(target, b'!one two\n')
    d.close_session()
    print('PASS default-app middle Enter / boundary Backspace+Delete / Tab / Undo', flush=True)

    # Negative review evidence is retained as a finding, never a passed exit.
    target = d.ROOT / 'files/read-only.fountain'
    target.write_bytes(b'!Read-only source.\n'); target.chmod(0o444)
    d.click('Open Fountain', actions=True); d.picker(target)
    d.wait(lambda: 'The source is open read-only.' in d.body(), 'Native permission read-only ownership')
    disabled = d.script("return [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save As')?.disabled;")
    assert disabled is True, 'Update review if read-only Save As is repaired'
    report.append({'finding':'M3-13-R01', 'readOnlySaveAsDisabled':disabled})
    d.screenshot('read-only-save-as-gap'); d.close_session()
    assert target.read_bytes() == b'!Read-only source.\n'
    print('FINDING M3-13-R01: default-app permission-read-only Save As disabled (SPEC S05.2)', flush=True)

    d.click('New screenplay', actions=True)
    d.wait(lambda: 'Protect draft' in d.body(), 'Recoverable unsaved draft')
    d.type_text('Unsaved checkpoint survives.')
    d.click('Protect draft', actions=True)
    expected = b'!Unsaved checkpoint survives.\n'
    record = d.wait(lambda: next((m for m,s in d.journal_records() if s == expected), None), 'Exact unsaved checkpoint')
    app = [c for c in d.owned_clients() if c.get('class') == 'babel-desktop'][0]
    import os
    import signal
    os.kill(app['pid'], signal.SIGKILL); time.sleep(.4)
    try:
        d.command('DELETE', '')
    except RuntimeError:
        pass
    d.SESSION = None; d.new_session()
    d.wait(lambda: record['documentId'] in d.body(), 'Unsaved recovery discovered after restart')
    inspect = d.find(f"//li[./h3[normalize-space(.)='Draft {record['documentId']}']]//button[contains(.,'Inspect published journal')]")
    d.command('POST', f'/element/{inspect}/click', {})
    d.wait(lambda: d.script("return document.querySelector('.recovery-preview pre')?.textContent;") == expected.decode(), 'Exact unsaved preview')
    buttons = d.script("return [...document.querySelectorAll('button')].map(b=>b.textContent.trim());")
    assert not any(label in ['Recover as Current','Save Recovered Copy','Resume draft'] for label in buttons), buttons
    assert any(m['documentId'] == record['documentId'] and s == expected for m,s in d.journal_records())
    report.append({'finding':'M3-13-R02', 'unsavedDocumentId':record['documentId'], 'sha256':hashlib.sha256(expected).hexdigest(), 'homeButtons':buttons})
    d.screenshot('unsaved-recovery-gap')
    print('FINDING M3-13-R02: unsaved checkpoint is preserved/inspectable but has no resume/export action after restart', flush=True)
    (d.ROOT / 'editor-exit.json').write_text(json.dumps(report, indent=2) + '\n')
    print('PASS default-app completion / source+caret Undo / consumed Enter / smart speech / F6 escape', flush=True)


def review_capture(d):
    """Separate native safety review of a documented unrepresentable edit."""
    original = b'@MAYA\n(softly)\nHello.\n'
    target = d.ROOT / 'files/capture-refusal.fountain'
    target.write_bytes(original)
    d.click('Open Fountain', actions=True); d.picker(target)
    d.wait(lambda: d.editor_text() == 'MAYA(softly)Hello.', 'Capture-refusal source opened')
    d.script("""const p=document.querySelectorAll('.ProseMirror > p')[1];
      p.closest('.ProseMirror').focus();window.getSelection().setBaseAndExtent(p.firstChild,4,p.firstChild,4);""")
    time.sleep(.2)
    d.click('Save', actions=True)
    d.wait(lambda: 'Saved locally' in d.body(), 'Known selected old generation saved')
    d.type_text('\ue007')
    d.wait(lambda: len(d.script("return [...document.querySelectorAll('.ProseMirror > p')];")) == 4, 'Middle Parenthetical split retained in editor')
    d.wait(lambda: d.script("return [...document.querySelectorAll('[role=alert]')].some(e=>e.textContent.length>0);"), 'Capture refusal visible')
    facts = d.script("""return {rows:[...document.querySelectorAll('.ProseMirror > p')].map(p=>({kind:p.dataset.kind,text:p.textContent})),
      protection:document.querySelector('[aria-label="Protection status"]').innerText};""")
    assert facts['rows'][1]['text'] == '(sof' and facts['rows'][2]['text'] == 'tly)', facts
    assert 'Saved locally' in facts['protection'], 'Update review if stale status is repaired'
    assert target.read_bytes() == original
    d.click('Close session', actions=True); d.click('Retry save and close')
    d.wait(lambda: 'Close stopped.' in d.body(), 'Uncapturable draft prevents close')
    d.click('Select copy destination', actions=True); d.picker(d.ROOT / 'files')
    d.wait(lambda: d.script("return [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save Emergency Copy and close')?.disabled === false;"), 'Copy destination selected')
    d.click('Save Emergency Copy and close')
    d.wait(lambda: 'Close stopped.' in d.body(), 'Uncapturable draft also prevents emergency copy')
    # No live-draft recovery frame or emergency file was produced; all author
    # fragments remain solely in EditorState. Audit exact old frames as well.
    records = d.journal_records()
    assert records and all(source == original for _,source in records)
    assert list((d.ROOT / 'files').iterdir()) == [target]
    facts['closeUI'] = d.body()
    facts['sourceSha256'] = hashlib.sha256(original).hexdigest()
    (d.ROOT / 'capture-review.json').write_text(json.dumps(facts, indent=2) + '\n')
    d.screenshot('uncapturable-draft-status')
    print('FINDING M3-13-R03: an accepted unrepresentable split retains only live rows, shows stale Saved locally and cannot produce emergency copy', flush=True)
    print('ARTIFACTS', d.ROOT, flush=True)


def review_latency(d):
    """Trusted Ctrl+End establishes the caret before the large-row probe."""
    source = ''.join(f'!Synthetic row {i}: A quiet signal beside Zoë and her notebook.\n' for i in range(2400)).encode()
    target = d.ROOT / 'files/cadence-latency.fountain'
    target.write_bytes(source)
    d.click('Open Fountain', actions=True); d.picker(target)
    opening = time.monotonic()
    d.wait(lambda: d.script("return document.querySelectorAll('.ProseMirror > p').length;") == 2400, 'Large source opens', timeout=90)
    d.wait(lambda: d.script("return document.querySelector('.ProseMirror').isContentEditable && document.querySelector('#writing-save')?.disabled === false;"), 'Large session ready', timeout=90)
    open_ready_ms = (time.monotonic() - opening) * 1000
    app = [c for c in d.owned_clients() if c.get('class') == 'babel-desktop'][0]
    address = app['address']
    assert address.startswith('0x') and all(c in '0123456789abcdef' for c in address[2:])
    subprocess.run(['hyprctl', 'dispatch', 'hl.dsp.focus({ window = "address:' + address + '" })'], check=True, stdout=subprocess.DEVNULL)
    d.script("document.querySelector('.ProseMirror').focus();")
    d.command('POST', '/actions', {'actions':[{'type':'key','id':'latency-end','actions':[
        {'type':'keyDown','value':'\ue009'},{'type':'keyDown','value':'\ue010'},
        {'type':'keyUp','value':'\ue010'},{'type':'keyUp','value':'\ue009'}]}]})
    time.sleep(.5)
    caret = d.script("""const s=window.getSelection();const p=(s.anchorNode?.nodeType===1?s.anchorNode:s.anchorNode?.parentElement)?.closest('p');
      if(!p)return null;const r=document.createRange();r.selectNodeContents(p);r.setEnd(s.anchorNode,s.anchorOffset);
      return {row:[...document.querySelectorAll('.ProseMirror > p')].indexOf(p),offset:r.toString().length};""")
    assert caret == {'row':2399,'offset':len('Synthetic row 2399: A quiet signal beside Zoë and her notebook.')}, caret
    d.script("""window.exitKeys=[];window.exitRaf=[];document.querySelector('.ProseMirror').addEventListener('keydown',e=>{
      if(e.key==='x'){window.exitKeys.push({trusted:e.isTrusted,at:performance.now()});const start=performance.now();
        requestAnimationFrame(()=>window.exitRaf.push(performance.now()-start));}});""")
    subprocess.run(['wtype','-d','30','x'*120], check=True)
    # An overloaded WebKit can still be draining compositor input after the
    # helper exits. Retain the complete trace before deciding delivery failed.
    delivered = True
    try:
        d.wait(lambda: d.script('return window.exitKeys.length;') == 120, 'All 120 trusted keys observed', timeout=180)
    except AssertionError:
        delivered = False
    time.sleep(1)
    d.click('Save', actions=True)
    acknowledged = True
    try:
        d.wait(lambda: 'Saved locally' in d.body(), 'Integrated typing source acknowledged', timeout=30)
    except AssertionError:
        acknowledged = False
    expected = source[:-1] + b'x'*120 + b'\n'
    values = sorted(d.script('return window.exitRaf;'))
    keys = d.script('return window.exitKeys;')
    actual = target.read_bytes()
    metrics = {'rows':2400,'openReadyMs':open_ready_ms,'originalBytes':len(source),'originalSha256':hashlib.sha256(source).hexdigest(),
      'expectedBytes':len(expected),'expectedSha256':hashlib.sha256(expected).hexdigest(),
      'actualBytes':len(actual),'actualSha256':hashlib.sha256(actual).hexdigest(),
      'exactBytes':actual == expected,'acknowledged':acknowledged,'delivered':delivered,'keys':keys,'keyToRafSamplesMs':values,
      'protection':d.script("return document.querySelector('[aria-label=\"Protection status\"]').innerText;"),
      'keyToRafProxyMs':{'n':len(values),'p95':values[int(.95*(len(values)-1))] if values else None,
                       'max':values[-1] if values else None,'above100Ms':sum(x>100 for x in values)}}
    (d.ROOT / 'expected-latency.fountain').write_bytes(expected)
    (d.ROOT / 'integrated-latency.json').write_text(json.dumps(metrics, indent=2) + '\n')
    summary = {k:v for k,v in metrics.items() if k not in ['keys','keyToRafSamplesMs']}
    print('METRICS', json.dumps(summary), flush=True)
    d.screenshot('integrated-latency')
    assert len(keys) == 120 and all(k['trusted'] for k in keys), 'Trusted key delivery must precede any result claim'
    assert acknowledged, 'Integrated source acknowledgement failed; keep M3 exit open'
    assert actual == expected, 'Large-row source/input audit failed; keep M3 exit open'
    d.close_session()
    print('PASS exact 120 trusted physical inputs with production capture/cadence active; rAF proxy is not compositor paint', flush=True)
    print('ARTIFACTS', d.ROOT, flush=True)
