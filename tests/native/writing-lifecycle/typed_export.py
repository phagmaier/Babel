"""AUDIT-D07 native typed-export: the S07.2 scene typed into the real app from an
empty document, saved, and exported through the pinned renderer.

Every expectation is the hand-written fixtures/assessment/typed-scene.json that
the JSDOM oracle (tests/contract/typed-scene.test.ts) and the helper test
(tools/pdf-helper/test_helper.py) already share; the app generates none of it.
Input is trusted WebDriver keyboard and element clicks; scripts only observe.
"""
import hashlib
import json
import subprocess
import time

CTRL, ENTER, TAB, ESCAPE, END = '\ue009', '\ue007', '\ue004', '\ue00c', '\ue010'


def run(d):
    fixture = json.loads((d.REPO / 'fixtures/assessment/typed-scene.json').read_text(encoding='utf-8'))
    source = fixture['source'].encode('utf-8')
    consumed = []

    def rows():
        return d.script("""return [...document.querySelectorAll('.ProseMirror > p')].map(p => {
            const subtype = JSON.parse(p.dataset.origin).actionSubtype;
            return (p.dataset.kind === 'action' && subtype === 'shot' ? 'shot' : p.dataset.kind) + ':' + p.textContent;});""")

    def suggestions():
        # The open popup's options, selected one first; None while it is closed.
        return d.script("""const editor = document.querySelector('.ProseMirror');
            if (editor.getAttribute('aria-expanded') !== 'true') return null;
            const options = [...document.querySelectorAll('.completion-popup [role=option]')];
            return [options.find(o => o.getAttribute('aria-selected') === 'true')?.textContent ?? null,
                    options.map(o => o.textContent)];""")

    def settled():
        # Suggestions are offered on the task after each change; let it run.
        time.sleep(.2)
        return suggestions()

    def chord(key):
        print('CHORD Ctrl+' + key, flush=True)
        d.script("document.querySelector('.ProseMirror').focus();")
        d.command('POST', '/actions', {'actions': [{'type': 'key', 'id': 'typed-export-chord', 'actions': [
            {'type': 'keyDown', 'value': CTRL}, {'type': 'keyDown', 'value': key},
            {'type': 'keyUp', 'value': key}, {'type': 'keyUp', 'value': CTRL}]}]})

    def enter(identical=None):
        """One Enter. `identical` is the selected suggestion that equals the
        typed segment; it is no acceptance, so this Enter runs the S07.2 table
        (S07.6). Otherwise no suggestion may be open."""
        if identical is None:
            assert settled() is None, ('unexpected suggestions before Enter', suggestions(), rows()[-1:])
        else:
            d.wait(lambda: (suggestions() or [None])[0] == identical, f'Suggestion {identical} selected before Enter')
            consumed.append(rows()[-1])
        d.type_text(ENTER)

    def tab():
        assert settled() is None, ('unexpected suggestions before Tab', suggestions(), rows()[-1:])
        d.type_text(TAB)

    def choose(value, label):
        # The Element picker is the keyboard-free route to an unbound element.
        print('CHOOSE', label, flush=True)
        option = d.find(f'//select[@id="screenplay-element"]/option[@value="{value}"]')
        d.command('POST', '/element/' + option + '/click', {})
        d.wait(lambda: d.script("return document.querySelector('#screenplay-element').value;") == value,
               f'Element picker shows {label}')

    def last_kind(kind, description):
        d.wait(lambda: rows()[-1].split(':', 1)[0] == kind, description)

    d.click('New screenplay', actions=True)
    d.wait(lambda: 'Protect draft' in d.body(), 'New empty draft opens')
    assert d.editor_text() == ''

    chord('1')
    d.type_text('INT. KITCHEN - DAY')
    enter(identical='DAY')
    d.type_text('Maya enters.')
    enter()
    tab()
    d.type_text('MAYA')
    enter()
    tab()
    d.type_text('(quietly)')
    enter()
    d.type_text('Hello there.')
    enter()
    tab()
    d.type_text('JON')
    enter()
    d.type_text('Hi.')
    # Dual dialogue has no default shortcut: use its visible command button.
    d.script("const help=[...document.querySelectorAll('.editor-controls summary')].find(e=>e.textContent==='Commands and shortcut help');if(!help.parentElement.open)help.click();")
    button = d.find('//section[@aria-label="Writing controls"]//button[@aria-label="Run Toggle dual dialogue"]')
    d.command('POST', '/element/' + button + '/click', {})
    d.wait(lambda: d.script("const p=[...document.querySelectorAll('.ProseMirror > p[data-kind=character]')].at(-1);return JSON.parse(p.dataset.origin).dualWith!==null;"),
           'Second cue paired as dual dialogue')
    enter()
    chord('6')
    d.type_text('CUT TO:')
    enter()
    # Finding D07-F4: the empty cue offers every known name, so a second Tab
    # would accept one. Escape dismisses the offer; the next Tab moves on.
    d.type_text(TAB)
    d.wait(lambda: (suggestions() or [None, None])[1] == ['JON', 'MAYA'], 'Empty cue offers the known names')
    d.type_text(ESCAPE)
    d.wait(lambda: suggestions() is None, 'Escape dismisses the names')
    d.type_text(TAB)
    last_kind('sceneHeading', 'Second Tab reaches Scene Heading')
    d.type_text('EXT. GARDEN - NIGHT')
    enter(identical='NIGHT')
    chord('7')
    d.type_text('CLOSE ON the gate.')
    enter()
    chord('8')
    d.type_text('Row, row, row your boat')
    enter()
    d.type_text('Gently down the stream')
    enter()
    enter()  # empty Lyrics exits to Action
    d.type_text('They sing.')
    enter()
    choose('centered', 'Centered')
    d.type_text('INTERMISSION')
    enter()
    choose('section', 'Section')
    d.type_text('Act Two')
    enter()
    choose('synopsis', 'Synopsis')
    d.type_text('Maya decides.')
    enter()
    choose('pageBreak', 'Page Break')
    last_kind('pageBreak', 'Page Break row created')
    d.type_text(END)  # finding D07-F3: the choice leaves the caret before ===
    enter()
    d.type_text('The end.')
    enter()
    choose('note', 'Note')
    d.type_text('check the gate')
    enter()  # inside a note Enter inserts a note line
    d.type_text('and the lock')

    typed = rows()
    assert typed == fixture['rows'], json.dumps({'typed': typed, 'expected': fixture['rows']}, indent=1)
    assert consumed == ['sceneHeading:INT. KITCHEN - DAY', 'sceneHeading:EXT. GARDEN - NIGHT'], consumed
    pairs = d.script("""const all=[...document.querySelectorAll('.ProseMirror > p')].map(p=>JSON.parse(p.dataset.origin));
        return {dual: all[8].dualWith === all[4].id, speech: [[5,4],[6,4],[9,8]].every(([row, cue]) => all[row].speechOf === all[cue].id)};""")
    assert pairs == {'dual': True, 'speech': True}, pairs
    d.screenshot('typed-scene')

    # The bytes the real app saves are the fixture's bytes.
    target = d.ROOT / 'files' / 'typed-scene.fountain'
    d.click('Save As', actions=True)
    d.picker(target)
    try:
        d.audit(target, source)
    except AssertionError:
        print('SAVED', repr(target.read_bytes() if target.exists() else None), flush=True)
        raise
    d.wait(lambda: 'Saved locally' in d.body(), 'Typed scene saved to its new file')

    # Observe the native export receipt; nothing is mocked or delayed.
    d.script("""window.exportEvents=[];const callbacks=window.__TAURI_INTERNALS__.callbacks;
      window.exportOriginalSet=callbacks.set;callbacks.set=function(id,callback){return window.exportOriginalSet.call(this,id,data=>{
        if(data?.publication&&data?.result)window.exportEvents.push(data);callback(data);});};""")

    def panel():
        return d.script("return document.querySelector('.export-pdf-panel')?.textContent || '';")

    d.wait(lambda: d.script("return [...document.querySelectorAll('[aria-label=\"Screenplay actions\"] button')].some(b=>b.textContent==='Export PDF'&&!b.disabled);"),
           'Native Export PDF command enabled', timeout=60)
    d.click('Export PDF', actions=True)
    # A clean capture needs no review: it goes straight to the destination.
    d.wait(lambda: 'Choose a destination for version' in panel(), 'Typed scene exports without review', timeout=60)
    assert 'Review captured version' not in panel() and 'SC005' not in panel() and 'SC008' not in panel(), panel()
    assert 'Not printed by this profile: 1 note (2 lines), 1 section heading, 1 synopsis.' in panel(), panel()
    pdf = d.ROOT / 'files' / 'typed-scene.pdf'
    d.picker(pdf)
    d.wait(lambda: 'Exported typed-scene.pdf' in panel(), 'Verified native PDF receipt', timeout=90)
    d.screenshot('typed-export')
    receipt = d.script('return window.exportEvents.at(-1);')
    d.script('window.__TAURI_INTERNALS__.callbacks.set=window.exportOriginalSet;')
    assert receipt['result']['sourceSha256'] == hashlib.sha256(source).hexdigest(), receipt
    assert hashlib.sha256(pdf.read_bytes()).hexdigest() == receipt['publication']['pdfSha256']
    info = subprocess.check_output(['pdfinfo', str(pdf)], text=True)
    count = int(next(line.split(':', 1)[1] for line in info.splitlines() if line.startswith('Pages:')))
    assert count == receipt['result']['pageCount'] == len(fixture['pages']), (count, receipt['result'])
    for number, expected in enumerate(fixture['pages'], start=1):
        page = ''.join(subprocess.check_output(
            ['pdftotext', '-raw', '-f', str(number), '-l', str(number), str(pdf), '-'], text=True).split())
        at = 0
        for printed in expected:  # in order; narrow dual columns may wrap
            found = page.find(''.join(printed.split()), at)
            assert found != -1, (number, printed, page)
            at = found
        for omitted in fixture['omits']:
            assert ''.join(omitted.split()) not in page, (number, omitted, page)

    d.click('Save', actions=True)
    d.audit(target, source)
    d.close_session()
    report = {'rows': len(typed), 'identicalSuggestions': consumed, 'sourceSha256': hashlib.sha256(source).hexdigest(),
              'pages': count, 'receipt': receipt}
    (d.ROOT / 'typed-export.json').write_text(json.dumps(report, indent=2) + '\n')
    print('PASS native typed scene from empty: rows/dual pairing/S07.6 suggestions/saved bytes equal fixture/direct export/pdftotext pages and omissions', flush=True)
