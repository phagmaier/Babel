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
    assert 'Export assessment unavailable' in d.body()
    assert 'SC005' in d.body() and 'SC008' in d.body()
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
    print('OPEN_MS', opened_ms, flush=True)
    print('PASS native check panel/filter/dismiss/navigation/save-with-warning/escape/refresh with exact bytes', flush=True)
    print('ARTIFACTS', d.ROOT, flush=True)
