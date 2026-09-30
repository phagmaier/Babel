"""M4-08 transactional replace one/all; synthetic sources and owned WebKit only."""
import json


def run(d):
    def ready():
        d.wait(lambda: d.script("return !!document.querySelector('.outline-target:not(:disabled)') && !document.querySelector('#writing-save')?.disabled;"), 'Current projection', timeout=60)

    def open_source(name, source):
        target = d.ROOT / 'files' / (name + '.fountain')
        target.write_bytes(source)
        d.click('Open Fountain', actions=True)
        d.picker(target)
        ready()
        return target

    def chord(*keys):
        d.command('POST', '/actions', {'actions': [{'type': 'key', 'id': 'replace-chord', 'actions': [{'type': 'keyDown', 'value': k} for k in keys] + [{'type': 'keyUp', 'value': k} for k in reversed(keys)]}]})

    def query(text, count):
        d.set_input('Find text', text)
        d.wait(lambda: f'{count} matches' in d.script("return document.querySelector('.find-panel [role=status]').textContent;"), 'Exact current match count', timeout=30)

    def open_find():
        try:
            d.wait(lambda: d.script("return [...document.querySelectorAll('div[aria-label=\"Screenplay actions\"] button')].find(b=>b.textContent.trim()==='Find')?.disabled===false;"), 'Find toolbar enabled', timeout=30)
        except AssertionError:
            print('DIAG toolbar', d.script("return [...document.querySelectorAll('div[aria-label=\"Screenplay actions\"] button')].map(b=>({text:b.textContent.trim(),disabled:b.disabled}));"), flush=True)
            print('DIAG status', d.script("return document.querySelector('section[aria-label=\"Protection status\"]')?.innerText?.slice(0,400);"), flush=True)
            raise
        d.click('Find', actions=True)
        d.wait(lambda: d.script("return !!document.querySelector('.find-panel input[type=search]');"), 'Find panel opened', timeout=30)

    def preview(fragment):
        d.wait(lambda: fragment in d.script("return document.querySelector('.find-panel').textContent;"), 'Replace preview: ' + fragment, timeout=30)

    def enabled(name):
        d.wait(lambda: d.script(f"return [...document.querySelectorAll('.find-panel button')].find(b=>b.textContent.trim()==={json.dumps(name)})?.disabled===false;"), 'Enabled control: ' + name, timeout=30)

    def editor_selection(text=None):
        def check():
            selected = d.script("const s=getSelection();const p=(s.focusNode?.nodeType===1?s.focusNode:s.focusNode?.parentElement)?.closest('.ProseMirror > p');const r=p?.getBoundingClientRect();if(!(document.activeElement?.classList.contains('ProseMirror')&&r.top>=0&&r.bottom<=innerHeight))return null;return s.toString();")
            if selected is None:
                return None
            if text is not None and selected != text:
                return None
            return {'text': selected}
        try:
            return d.wait(check, 'Focused editor selection' + (f' {text!r}' if text is not None else ''), timeout=30)
        except AssertionError:
            print('DIAG activeElement', d.script("return document.activeElement?.outerHTML?.slice(0,200);"), flush=True)
            print('DIAG selection', d.script("const s=getSelection();return {text:s.toString(),anchor:s.anchorOffset,focus:s.focusOffset};"), flush=True)
            print('DIAG find', d.script("return {status:document.querySelector('.find-panel [role=status]')?.textContent,alert:document.querySelector('.find-panel [role=alert]')?.textContent,reveal:document.querySelector('.find-reveal')?.textContent?.slice(0,160)};"), flush=True)
            raise

    source = b'Title: moon draft\n.INT. ONE - DAY\n!The moon rises over the moon.\n[[moon]]\n!moon\n'
    after_one = b'Title: moon draft\n.INT. ONE - DAY\n!The sun rises over the moon.\n[[moon]]\n!moon\n'
    after_enter = b'Title: moon draft\n.INT. ONE - DAY\n!The sun rises over the sun.\n[[moon]]\n!moon\n'
    after_all = b'Title: moon draft\n.INT. ONE - DAY\n!The sun rises over the sun.\n[[sun]]\n!sun\n'
    target = open_source('replace', source)
    d.click('Save', actions=True); d.audit(target, source)
    d.wait(lambda: 'Saved locally' in d.body(), 'Baseline source receipt')
    open_find()
    query('moon', 5)
    d.set_input('Replace with', 'sun')
    preview('4 replaceable \u00b7 1 excluded')
    preview('Title page form')
    # The title match is selected first and its Replace control stays disabled.
    d.click('Next match')
    d.wait(lambda: d.script("return document.querySelector('.find-reveal')?.textContent.includes('Title field');"), 'Title reveal without editing affordance')
    assert d.script("return [...document.querySelectorAll('.find-panel button')].find(b=>b.textContent.trim()==='Replace match').disabled===true;"), 'Title refusal disables Replace match'
    assert target.read_bytes() == source
    # Replace-one commits through the editor, keeps focus and advances.
    d.click('Next match')
    enabled('Replace match')
    d.click('Replace match')
    selection = editor_selection('moon')
    assert selection['text'] == 'moon', selection
    d.wait(lambda: '4 matches' in d.script("return document.querySelector('.find-panel [role=status]').textContent;"), 'Refreshed count after replace-one', timeout=30)
    d.audit(target, after_one)
    # Keyboard Enter in the replacement input replaces the next match.
    d.set_input('Replace with', 'sun')
    chord('\ue007')
    selection = editor_selection('moon')
    assert selection['text'] == 'moon', selection
    d.wait(lambda: '3 matches' in d.script("return document.querySelector('.find-panel [role=status]').textContent;"), 'Refreshed count after keyboard replace', timeout=30)
    d.audit(target, after_enter)
    # Replace-all is atomic; one Undo restores the pre-all bytes.
    enabled('Replace all')
    d.screenshot('replace-preview')
    d.click('Replace all')
    d.wait(lambda: 'Replaced 2 matches in one step' in d.body(), 'Replace-all acknowledgement')
    editor_selection()
    d.wait(lambda: '1 matches' in d.script("return document.querySelector('.find-panel [role=status]').textContent;"), 'Only the refused title remains')
    d.audit(target, after_all)
    d.type_text('\ue009z\ue000')
    d.wait(lambda: '3 matches' in d.script("return document.querySelector('.find-panel [role=status]').textContent;"), 'Undo restores matches', timeout=30)
    d.audit(target, after_enter)
    # The M4-07 pattern closes find before saving: committed replacements keep
    # exact bytes through Save/close/reopen without panel state in flight.
    d.click('Close find')
    d.click('Save', actions=True)
    d.audit(target, after_enter)
    d.wait(lambda: 'Saved locally' in d.body(), 'Exact source receipt after Undo')
    # Re-apply all, save and reopen byte-exact. Current results prove the
    # replacement capture settled before the explicit Save runs.
    open_find()
    query('moon', 3)
    d.set_input('Replace with', 'sun')
    preview('2 replaceable \u00b7 1 excluded')
    enabled('Replace all')
    d.click('Replace all')
    d.wait(lambda: 'Replaced 2 matches in one step' in d.body(), 'Replace-all acknowledgement')
    d.wait(lambda: '1 matches' in d.script("return document.querySelector('.find-panel [role=status]').textContent;"), 'Settled capture after second replace-all')
    d.click('Close find')
    d.click('Save', actions=True)
    d.audit(target, after_all)
    d.wait(lambda: 'Saved locally' in d.body(), 'Exact source receipt after replace-all')
    assert 'Save failed' not in d.body(), 'Explicit Save after replace-all must not fail'
    d.screenshot('replace-applied')
    d.close_session(); d.audit(target, after_all)
    d.click('Open Fountain', actions=True)
    d.picker(target)
    ready()
    d.wait(lambda: 'sun rises over the sun' in d.editor_text(), 'Reopened replacement text')
    d.audit(target, after_all)
    # Reopening prior recovery generations needs the explicit identical-content
    # choice before the session can close, as in the main lifecycle drill.
    d.wait(lambda: 'Both generations hold identical content.' in d.body(), 'Matching previous-session recovery is discoverable')
    same = d.find("//section[.//h2[normalize-space(.)='Recovery choice']][.//p[normalize-space(.)='Both generations hold identical content.']]//button[normalize-space(.)='Keep Current File']")
    d.command('POST', f'/element/{same}/click', {})
    d.wait(lambda: 'The current file was kept.' in d.body(), 'Explicit Keep Current File reconciles the old session')
    d.close_session(); d.audit(target, after_all)
    print('PASS native replace-one/keyboard/replace-all/Undo/Save/reopen with title refusal and exact bytes', flush=True)
    print('ARTIFACTS', d.ROOT, flush=True)


def run_smoke(d):
    """Minimal isolation: one replace-all, Save, close. No Undo or re-apply."""
    def ready():
        d.wait(lambda: d.script("return !!document.querySelector('.outline-target:not(:disabled)') && !document.querySelector('#writing-save')?.disabled;"), 'Current projection', timeout=60)

    target = d.ROOT / 'files' / 'replace-smoke.fountain'
    source = b'Title: moon draft\n.INT. ONE - DAY\n!The moon rises over the moon.\n[[moon]]\n!moon\n'
    after_all = b'Title: moon draft\n.INT. ONE - DAY\n!The sun rises over the sun.\n[[sun]]\n!sun\n'
    target.write_bytes(source)
    d.click('Open Fountain', actions=True)
    d.picker(target)
    ready()
    d.click('Save', actions=True); d.audit(target, source)
    d.wait(lambda: 'Saved locally' in d.body(), 'Baseline source receipt')
    d.click('Find', actions=True)
    d.set_input('Find text', 'moon')
    d.wait(lambda: '5 matches' in d.script("return document.querySelector('.find-panel [role=status]').textContent;"), 'Exact current match count', timeout=30)
    d.set_input('Replace with', 'sun')
    d.wait(lambda: '4 replaceable' in d.script("return document.querySelector('.find-panel').textContent;"), 'Replace preview', timeout=30)
    d.wait(lambda: d.script("return [...document.querySelectorAll('.find-panel button')].find(b=>b.textContent.trim()==='Replace all')?.disabled===false;"), 'Replace all enabled', timeout=30)
    d.click('Replace all')
    d.wait(lambda: 'Replaced 4 matches in one step' in d.body(), 'Replace-all acknowledgement')
    d.wait(lambda: '1 matches' in d.script("return document.querySelector('.find-panel [role=status]').textContent;"), 'Settled capture after replace-all')
    d.click('Save', actions=True)
    d.audit(target, after_all)
    d.wait(lambda: 'Saved locally' in d.body(), 'Exact source receipt after replace-all')
    assert 'Save failed' not in d.body(), 'Explicit Save after replace-all must not fail'
    d.close_session(); d.audit(target, after_all)
    print('PASS native replace-all smoke: preview/apply/Save/close with exact bytes', flush=True)
    print('ARTIFACTS', d.ROOT, flush=True)
