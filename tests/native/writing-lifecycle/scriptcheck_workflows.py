"""M4-09 non-destructive Script Check; synthetic sources and owned WebKit only."""
import json
import time


def run(d):
    def ready():
        d.wait(lambda: d.script("return !!document.querySelector('.outline-target:not(:disabled)') && !document.querySelector('#writing-save')?.disabled;"), 'Current projection', timeout=60)

    def open_panel():
        d.wait(lambda: d.script("return [...document.querySelectorAll('div[aria-label=\"Screenplay actions\"] button')].find(b=>b.textContent.trim()==='Script Check')?.disabled===false;"), 'Script Check toolbar enabled', timeout=30)
        d.click('Script Check', actions=True)
        d.wait(lambda: d.script("return !!document.querySelector('.check-panel');"), 'Check panel opened', timeout=30)

    def counts(text):
        d.wait(lambda: text in d.script("return document.querySelector('.check-panel [role=status]').textContent;"), 'Check counts: ' + text, timeout=30)

    source = b'Title: Check drill\n.INT. A - DAY #1#\n@ALICE\n(Hello?)\n!Body here.\n.INT. B - DAY #1#\n[[note]]\n!Tail.\n'
    target = d.ROOT / 'files' / 'check.fountain'
    target.write_bytes(source)
    d.click('Open Fountain', actions=True)
    d.picker(target)
    ready()
    d.click('Save', actions=True); d.audit(target, source)
    d.wait(lambda: 'Saved locally' in d.body(), 'Baseline source receipt')
    editor_before = d.editor()
    started = time.monotonic()
    open_panel()
    counts('2 warnings \u00b7 1 advisories')
    opened_ms = int((time.monotonic() - started) * 1000)
    for code in ['SC001', 'SC002', 'SC006']:
        assert code in d.script("return document.querySelector('.check-panel').textContent;"), code
    assert 'Export support assessed' in d.body(), 'Export assessment unavailable: binary has no usable pdf-helper beside it'
    assert 'export limitations' in d.body()
    panel = d.script("return document.querySelector('.check-panel').textContent;")
    assert 'SC005' in panel and 'SC008' not in panel, 'ASCII has content limitations but no glyph loss'
    assert target.read_bytes() == source
    d.screenshot('check-panel')
    # Severity filters and advisory dismissal reshape counts without edits.
    e = d.find('//label[contains(.,"Show advisories")]/input')
    d.command('POST', '/element/' + e + '/click', {})
    counts('2 warnings \u00b7 0 advisories')
    d.command('POST', '/element/' + e + '/click', {})
    counts('2 warnings \u00b7 1 advisories')
    d.click('Dismiss')
    counts('2 warnings \u00b7 0 advisories \u00b7 1 dismissed')
    assert target.read_bytes() == source
    # Go to Issue selects the cue block, focuses the editor and keeps bytes.
    d.wait(lambda: d.script("return [...document.querySelectorAll('.check-panel button')].find(b=>b.textContent.trim()==='Go to issue')?.disabled===false;"), 'Issue navigation enabled', timeout=30)
    d.click('Go to issue')
    def issue_selection():
        try:
            return d.wait(lambda: d.script("const s=getSelection();const p=(s.focusNode?.nodeType===1?s.focusNode:s.focusNode?.parentElement)?.closest('.ProseMirror > p');const r=p?.getBoundingClientRect();return document.activeElement?.classList.contains('ProseMirror')&&r.top>=0&&r.bottom<=innerHeight ? {row:[...document.querySelectorAll('.ProseMirror > p')].indexOf(p),text:s.toString()} : null;"), 'Issue selection visible', timeout=30)
        except AssertionError:
            print('DIAG activeElement', d.script("return document.activeElement?.outerHTML?.slice(0,160);"), flush=True)
            print('DIAG selection', d.script("const s=getSelection();return {text:s.toString(),anchor:s.anchorOffset,focus:s.focusOffset};"), flush=True)
            print('DIAG status', d.script("return {panel:document.querySelector('.check-panel [role=status]')?.textContent,app:document.querySelector('section[aria-label=\"Protection status\"]')?.innerText?.slice(0,300)};"), flush=True)
            raise
    selection = issue_selection()
    # Editor row 2 holds the cue: this source has no blank lines, and stable
    # ids (not bare indexes) authorize the target.
    assert selection['row'] == 2 and selection['text'] == 'ALICE', selection
    assert target.read_bytes() == source
    assert d.editor() == editor_before
    d.screenshot('check-navigate')
    # Warnings never block saving; the file stays byte-exact.
    d.click('Close Script Check')
    d.click('Save', actions=True)
    d.audit(target, source)
    d.wait(lambda: 'Saved locally' in d.body(), 'Save succeeds with warnings present')
    # Reopening re-runs against the current script; selection-only navigation
    # kept prior results current, so no stale banner appears.
    open_panel()
    # Dismissal persists across reopen; restore brings the advisory back.
    counts('2 warnings \u00b7 0 advisories \u00b7 1 dismissed')
    assert 'stale' not in d.script("return document.querySelector('.check-panel [role=status]').textContent;")
    d.click('Restore dismissed (1)')
    counts('2 warnings \u00b7 1 advisories')
    # Refresh from inside the panel focuses it, so Escape bubbles to the panel.
    d.click('Refresh check')
    counts('2 warnings \u00b7 1 advisories')
    d.command('POST', '/actions', {'actions': [{'type': 'key', 'id': 'check-escape', 'actions': [{'type': 'keyDown', 'value': '\ue00c'}, {'type': 'keyUp', 'value': '\ue00c'}]}]})
    d.wait(lambda: d.script("return !document.querySelector('.check-panel') && document.activeElement?.classList.contains('ProseMirror');"), 'Escape closes to the editor', timeout=30)
    assert target.read_bytes() == source
    d.close_session(); d.audit(target, source)
    # M5-04 independently authored omissions/glyph literals plus frozen dual
    # overflow corpus. Native identity/layout IPC is real; no file output.
    second_source = (b'Title: M5 assessment\nArchive: Extra field\n   Extra continuation\n\n'
                     b'# Section omitted\n= Synopsis omitted\n\n[[Note omitted]]\n\n'
                     b'/* Boneyard omitted */\n\n' + '!Café Zoë 中文 😀 العربية e\u0301\n\n'.encode() +
                     (d.REPO / 'fixtures/publication/dual-overflow.fountain').read_bytes())
    second = d.ROOT / 'files' / 'assessment.fountain'
    second.write_bytes(second_source)
    d.click('Open Fountain', actions=True); d.picker(second); ready()
    d.click('Save', actions=True); d.audit(second, second_source)
    d.wait(lambda: 'Saved locally' in d.body(), 'Assessment baseline source receipt')
    before = d.editor()
    open_panel()
    d.wait(lambda: 'Export support assessed' in d.body(), 'Verified production assessment', timeout=60)
    panel = d.script("return document.querySelector('.check-panel').textContent;")
    for literal in ['SC005', 'SC008', 'dual-dialogue-overflow', 'U+4E2D', 'U+1F600', 'unsupported shaping', 'us-letter-draft-v1']:
        assert literal in panel, literal
    assert 'font is substituted' in panel
    # AUDIT-D04: omitted non-printing elements are one summary, not issues.
    assert 'Not printed by this profile: 1 note (1 line), 1 boneyard (1 line), 1 section heading, 1 synopsis.' in panel, panel
    assert 'omits note content' not in panel and 'omits section content' not in panel
    assert d.editor() == before and second.read_bytes() == second_source
    assert not list((d.ROOT / 'cache').rglob('*.pdf')), 'assessment must not publish a PDF'
    # Blocking limitations remain visible when structural warnings are filtered.
    e = d.find('//label[contains(.,"Show warnings")]/input')
    d.command('POST', '/element/' + e + '/click', {})
    assert 'SC005' in d.script("return document.querySelector('.check-panel').textContent;")
    assert 'SC008' in d.script("return document.querySelector('.check-panel').textContent;")
    # Explicit native WebDriver navigation to the unknown title's exact row.
    e = d.find('//section[@aria-label="Publication content limitation issues"]//button[normalize-space(.)="Go to issue"]')
    d.command('POST', '/element/' + e + '/click', {})
    d.wait(lambda: d.script("return getSelection().toString().includes('Extra field');"), 'Unknown title target selected')
    assert d.editor() == before and second.read_bytes() == second_source
    d.screenshot('m5-04-assessment')
    d.click('Close Script Check'); d.click('Save', actions=True); d.audit(second, second_source)
    d.close_session(); d.audit(second, second_source)
    print('PASS M5-04 native codec omissions, accents, CJK/emoji/RTL/shaping, dual overflow, non-hideable blockers, title navigation and Save with exact source; no PDF writes', flush=True)
    print('OPEN_MS' , opened_ms, flush=True)
    print('PASS native check panel/filter/dismiss/navigation/save-with-warning/escape/refresh with exact bytes', flush=True)
    print('ARTIFACTS', d.ROOT, flush=True)
