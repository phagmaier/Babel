"""AUDIT-PARK-H native confirmation on disposable content: rows the editor
cannot capture.

An empty Scene Heading row created after text (Enter, Ctrl+1) has no Fountain
spelling, so the draft cannot be captured until the row has text (phases A-C).
A new Note row in a screenplay opened from a file cannot be captured even with
text in it (phase D, found while confirming the first).

Pinned as found, not as wanted. The drill answers what the real app does with
text typed elsewhere meanwhile: source save, recovery journal, an owned
SIGKILL, protected close, and resumption. Synthetic text only; only this
driver's own app is killed. Input is trusted; scripts only observe.
"""
import json
import os
import signal
import time
from pathlib import Path

CTRL, ENTER, END, HOME, NULL = '\ue009', '\ue007', '\ue010', '\ue011', '\ue000'
REFUSAL = 'cannot round-trip unambiguously'
NOTE_REFUSAL = 'Hidden conversion lost its contiguous source ownership'


def run(d):
    report = {}
    # Forced spellings, as the editor writes any row it edits.
    opened = b'.INT. ROOM - DAY\n\n!A lamp glows.\n'
    target = d.ROOT / 'files' / 'empty-heading.fountain'

    def rows():
        return d.script("return [...document.querySelectorAll('.ProseMirror > p')].map(p => p.dataset.kind + ':' + p.textContent);")

    def chord(key):
        d.script("document.querySelector('.ProseMirror').focus();")
        d.command('POST', '/actions', {'actions': [{'type': 'key', 'id': 'empty-heading-chord', 'actions': [
            {'type': 'keyDown', 'value': CTRL}, {'type': 'keyDown', 'value': key},
            {'type': 'keyUp', 'value': key}, {'type': 'keyUp', 'value': CTRL}]}]})

    def click_row(kind, text):
        row = d.find(f"//div[contains(@class,'ProseMirror')]/p[@data-kind='{kind}' and normalize-space(.)={json.dumps(text)}]")
        d.command('POST', '/element/' + row + '/click', {})

    def status():
        return d.script("return document.querySelector('[aria-label=\"Protection status\"] [role=status]')?.textContent || '';")

    def alerts():
        return d.script("return [...document.querySelectorAll('[aria-label=\"Protection status\"] [role=alert]')].map(e => e.textContent);")

    def journaled(needle):
        return any(needle in source for _, source in d.journal_records())

    def open_file(expected_text):
        d.click('Open Fountain', actions=True)
        d.picker(target)
        d.wait(lambda: d.editor_text() == expected_text, 'Disposable screenplay opens', timeout=60)
        d.wait(lambda: d.script("return [...document.querySelectorAll('[aria-label=\"Screenplay actions\"] button')].some(b=>b.textContent==='Close session'&&!b.disabled);"),
               'Opened session ready', timeout=60)

    def empty_heading(action, typed, saved):
        """Type `typed` at the end of the action row, wait for its exact save,
        then Enter and Ctrl+1. Returns the bytes on disk once they settle."""
        click_row('action', action)
        d.type_text(END + typed)
        d.audit(target, saved)
        d.wait(lambda: 'Saved locally' in d.body(), 'Ordinary edit saved before the empty row')
        d.type_text(ENTER)
        chord('1')
        d.wait(lambda: 'sceneHeading:' in rows(), 'Empty Scene Heading row after text')
        d.wait(lambda: any(REFUSAL in alert for alert in alerts()), 'Capture refusal is shown to the author')
        # Past the cadence's two-second ceiling: whatever will be saved, is.
        time.sleep(3)
        return target.read_bytes()

    def type_elsewhere(action, marker):
        click_row('action', action)
        d.type_text(HOME + marker)
        d.wait(lambda: rows()[2] == 'action:' + marker + action, 'Author text typed in another row')
        time.sleep(4)

    # A. Text typed elsewhere while the row is empty is neither saved nor
    # journaled; an owned SIGKILL then loses it. The file keeps its last save.
    target.write_bytes(opened)
    open_file('INT. ROOM - DAYA lamp glows.')
    first = opened.replace(b'glows.', b'glows. It hums.')
    settled = empty_heading('A lamp glows.', ' It hums.', first)
    report['settledAfterEmptyRow'] = settled.decode()
    assert settled.startswith(first.rstrip(b'\n')), settled
    type_elsewhere('A lamp glows. It hums.', 'Dim. ')
    assert target.read_bytes() == settled, target.read_bytes()
    assert not journaled(b'Dim. '), 'text typed while the row is empty reached the journal'
    assert any(REFUSAL in alert for alert in alerts()), alerts()
    report['whileEmpty'] = {'status': status(), 'alerts': alerts(), 'sourceSaved': False, 'journaled': False}
    d.screenshot('empty-heading-unprotected')
    apps = [c for c in d.owned_clients() if c.get('class') == 'babel-desktop']
    assert apps
    owned_pid = apps[0]['pid']
    assert Path(f'/proc/{owned_pid}/comm').read_text().strip() == 'babel-desktop'
    os.kill(owned_pid, signal.SIGKILL)
    time.sleep(.4)
    try:
        d.command('DELETE', '')
    except RuntimeError:
        pass
    d.SESSION = None
    d.new_session()
    assert target.read_bytes() == settled and not journaled(b'Dim. ')
    d.click('Open Fountain', actions=True)
    d.picker(target)
    d.wait(lambda: 'A lamp glows. It hums.' in (d.editor_text() or ''), 'Reopened after the owned kill', timeout=60)
    assert 'Dim.' not in d.editor_text() and 'Dim.' not in d.body()
    report['afterKill'] = {'editor': d.editor_text(), 'lost': 'Dim. '}
    print('PASS native empty heading row: text typed elsewhere is not saved or journaled; owned SIGKILL loses it; last save intact', flush=True)

    # B. Protected close refuses to drop the same text; the designed draft
    # bundle preserves it without marking the source saved.
    d.wait(lambda: d.script("return [...document.querySelectorAll('[aria-label=\"Screenplay actions\"] button')].some(b=>b.textContent==='Close session'&&!b.disabled);"),
           'Reopened session ready', timeout=60)
    reopened = d.editor_text()
    second_action = 'A lamp glows. It hums.'
    second = settled.replace(b'It hums.', b'It hums. Still.')
    settled = empty_heading(second_action, ' Still.', second)
    type_elsewhere(second_action + ' Still.', 'Dim. ')
    assert target.read_bytes() == settled and not journaled(b'Dim. ')
    d.click('Close session', actions=True)
    d.wait(lambda: 'Close stopped.' in d.body(), 'Protected close stops')
    assert 'Newer changes exist only in memory' in d.body()
    assert 'Dim. ' + second_action in d.editor_text()
    d.screenshot('empty-heading-close-stopped')
    d.click('Select copy destination', actions=True)
    d.picker(d.ROOT / 'copies')
    d.wait(lambda: d.script("return [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save Emergency Copy and close')?.disabled === false;"),
           'Native emergency destination selected')
    d.click('Save Emergency Copy and close')
    d.wait(lambda: 'Start writing' in d.body(), 'Draft bundle allows close', timeout=60)
    bundles = [path for path in (d.ROOT / 'copies').iterdir() if path.name.endswith('.draft.json')]
    assert len(bundles) == 1, list((d.ROOT / 'copies').iterdir())
    bundle = json.loads(bundles[0].read_text(encoding='utf-8'))
    assert bundle['schema'] == 'babel-draft-copy-v1'
    assert 'Dim. ' + second_action + ' Still.' in json.dumps(bundle['rows'])
    assert target.read_bytes() == settled
    report['closeStopped'] = {'bundle': bundles[0].name, 'rows': len(bundle['rows']), 'sourceUnchanged': True, 'reopenedText': reopened}
    print('PASS native empty heading row: close stops; draft bundle holds the unsaved text; source not marked saved', flush=True)

    # C. One heading typed into the row makes the draft capturable again and
    # everything typed meanwhile is saved.
    open_file(reopened.replace('It hums.', 'It hums. Still.'))
    third_action = second_action + ' Still.'
    third = settled.replace(b'Still.', b'Still. Again.')
    settled = empty_heading(third_action, ' Again.', third)
    type_elsewhere(third_action + ' Again.', 'Dim. ')
    assert target.read_bytes() == settled and not journaled(b'Dim. ')
    click_row('sceneHeading', '')
    d.type_text('HALL')
    # A heading typed without a prefix is saved with the forced spelling.
    wanted = [b'\n!Dim. A lamp glows. It hums. Still. Again.\n', b'\n.HALL\n']
    try:
        d.wait(lambda: all(part in target.read_bytes() for part in wanted), 'Everything typed meanwhile reaches the source file', timeout=30)
    except AssertionError:
        print('SAVED', repr(target.read_bytes()), flush=True)
        raise
    final = target.read_bytes()
    d.wait(lambda: not any(REFUSAL in alert for alert in alerts()), 'Capture refusal clears')
    d.wait(lambda: 'Saved locally' in d.body(), 'Resumed save acknowledged')
    assert journaled(b'Dim. ')
    report['resumed'] = {'saved': final.decode()}
    d.close_session()
    print('PASS native empty heading row: one heading typed resumes capture and saves everything typed meanwhile', flush=True)

    # D. Found while confirming A-C: in a screenplay opened from a file, a new
    # Note row stays uncapturable even with text in it. Nothing typed after it
    # is saved or journaled, and only Undo back past the note restores capture.
    target = d.ROOT / 'files' / 'new-note.fountain'
    target.write_bytes(opened)
    open_file('INT. ROOM - DAYA lamp glows.')
    click_row('action', 'A lamp glows.')
    d.type_text(END + ' It hums.')
    d.audit(target, first)
    d.wait(lambda: 'Saved locally' in d.body(), 'Ordinary edit saved before the note')
    d.type_text(ENTER)
    option = d.find('//select[@id="screenplay-element"]/option[@value="note"]')
    d.command('POST', '/element/' + option + '/click', {})
    d.wait(lambda: 'note:[[]]' in rows(), 'New Note row after text')
    d.type_text('remember the storm')
    d.wait(lambda: 'note:[[remember the storm]]' in rows(), 'Text typed into the new note')
    d.wait(lambda: any(NOTE_REFUSAL in alert for alert in alerts()), 'Capture refusal is shown to the author')
    time.sleep(3)
    settled = target.read_bytes()
    assert b'remember' not in settled and settled.startswith(first.rstrip(b'\n')), settled
    # The journal directory is shared by this drill's documents: use text
    # no earlier phase typed.
    type_elsewhere('A lamp glows. It hums.', 'Dusk. ')
    assert target.read_bytes() == settled
    assert not journaled(b'Dusk. ') and not journaled(b'remember the storm')
    report['newNote'] = {'status': status(), 'alerts': alerts(), 'settled': settled.decode(), 'sourceSaved': False, 'journaled': False}
    d.screenshot('new-note-unprotected')
    # Converting the note back is refused, so the text cannot be kept that way.
    click_row('note', '[[remember the storm]]')
    option = d.find('//select[@id="screenplay-element"]/option[@value="action"]')
    d.command('POST', '/element/' + option + '/click', {})
    d.wait(lambda: any('whole-region conversion' in alert for alert in alerts()), 'Converting the new note back is refused')
    assert 'note:[[remember the storm]]' in rows()
    # Undo until the note row is gone: capture resumes without the note or the
    # text typed after it.
    for _ in range(40):
        if not any(row.startswith('note:') for row in rows()):
            break
        d.type_text(CTRL + 'z' + NULL)
        time.sleep(.15)
    assert not any(row.startswith('note:') for row in rows()), rows()
    d.wait(lambda: not any(NOTE_REFUSAL in alert for alert in alerts()), 'Capture refusal clears after Undo', timeout=30)
    d.wait(lambda: 'Saved locally' in d.body(), 'Capture and save resume after Undo', timeout=30)
    after_undo = target.read_bytes()
    assert b'remember' not in after_undo and b'Dusk.' not in after_undo, after_undo
    report['newNote']['afterUndo'] = {'rows': rows(), 'saved': after_undo.decode()}
    d.close_session()
    (d.ROOT / 'empty-heading.json').write_text(json.dumps(report, indent=2) + '\n')
    print('PASS native new note row in an opened screenplay: never captured; nothing after it saved or journaled; convert-back refused; only Undo resumes', flush=True)
