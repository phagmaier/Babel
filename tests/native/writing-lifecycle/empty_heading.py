"""AUDIT-PARK-H-F2 native empty-heading intent and F1 hidden-row capture.
AUDIT-PARK-H-F3 adds the alert that names a row Fountain cannot hold.
AUDIT-PARK-H-F4-02 adds a Dialogue row emptied above the rest of its speech.
AUDIT-PARK-H-F4-03 adds speech rows that open with a parenthesis.

Empty headings save as physical blanks with source-bound recovery intent.
Trusted keys verify unrelated edits, exact journal metadata, owned SIGKILL,
explicit resume, completion, Undo/Redo and ordinary protected close. F1's
Note/Omitted material byte/journal/Undo/reopen checks remain intact.
Only disposable content and owned app processes are used.
"""
import json
import os
import signal
import time
from pathlib import Path

CTRL, SHIFT, ENTER, END, HOME, NULL = '\ue009', '\ue008', '\ue007', '\ue010', '\ue011', '\ue000'
BACKSPACE, DELETE = '\ue003', '\ue017'


def run(d):
    report = {}
    # Forced spellings, as the editor writes any row it edits.
    opened = b'.INT. ROOM - DAY\n\n!A lamp glows.\n'
    target = d.ROOT / 'files' / 'empty-heading.fountain'

    def rows():
        return d.script("return [...document.querySelectorAll('.ProseMirror > p')].map(p => p.dataset.kind + ':' + p.textContent);")

    def chord(key, shift=False):
        d.script("document.querySelector('.ProseMirror').focus();")
        actions = [{'type': 'keyDown', 'value': CTRL}]
        if shift:
            actions.append({'type': 'keyDown', 'value': SHIFT})
        actions.extend([{'type': 'keyDown', 'value': key}, {'type': 'keyUp', 'value': key}])
        if shift:
            actions.append({'type': 'keyUp', 'value': SHIFT})
        actions.append({'type': 'keyUp', 'value': CTRL})
        d.command('POST', '/actions', {'actions': [{'type': 'key', 'id': 'empty-heading-chord', 'actions': actions}]})

    def click_row(kind, text):
        row = d.find(f"//div[contains(@class,'ProseMirror')]/p[@data-kind='{kind}' and normalize-space(.)={json.dumps(text)}]")
        d.command('POST', '/element/' + row + '/click', {})

    def status():
        return d.script("return document.querySelector('[aria-label=\"Protection status\"] [role=status]')?.textContent || '';")

    def alerts():
        return d.script("return [...document.querySelectorAll('[aria-label=\"Protection status\"] [role=alert]')].map(e => e.textContent);")

    def journaled(needle):
        return any(needle in source for _, source in d.journal_records())

    def checkpoint(source, intent, after=None):
        candidates = [m for m, saved in d.journal_records()
                      if saved == source and m['draftMetadata']['drafts'] == intent
                      and (after is None or (m['documentId'] == after['documentId']
                                            and m['version'] > after['version']))]
        return max(candidates, key=lambda m: m['version'], default=None)

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
        expected = saved + b'\n\n'
        d.audit(target, expected)
        d.wait(lambda: 'Saved locally' in d.body(), 'Empty heading exact save acknowledged')
        assert not alerts(), alerts()
        return expected

    def type_elsewhere(action, marker):
        click_row('action', action)
        d.type_text(HOME + marker)
        d.wait(lambda: rows()[2] == 'action:' + marker + action, 'Author text typed in another row')
        time.sleep(4)

    # A. The empty heading keeps unrelated text saved and journaled. Metadata
    # is inspected independently from checksummed frames, before an owned kill.
    target.write_bytes(opened)
    open_file('INT. ROOM - DAYA lamp glows.')
    first = opened.replace(b'glows.', b'glows. It hums.')
    settled = empty_heading('A lamp glows.', ' It hums.', first)
    assert settled == first + b'\n\n', settled
    type_elsewhere('A lamp glows. It hums.', 'Dim. ')
    expected = settled.replace(b'!A lamp', b'!Dim. A lamp')
    d.audit(target, expected)
    intent = [{'index': 4, 'intendedKind': 'sceneHeading'}]
    record = d.wait(lambda: checkpoint(expected, intent),
                    'Exact empty-heading bytes and sparse intent journaled', timeout=30)
    d.wait(lambda: 'Saved locally' in d.body(), 'Unrelated edits saved while heading stays empty')
    assert not alerts(), alerts()
    assert rows() == ['sceneHeading:INT. ROOM - DAY', 'action:',
                      'action:Dim. A lamp glows. It hums.', 'action:', 'sceneHeading:'], rows()
    report['whileEmpty'] = {'status': status(), 'alerts': alerts(), 'sourceSaved': True,
                            'journaled': True, 'saved': expected.decode(), 'intent': intent}
    d.screenshot('empty-heading-protected')
    apps = [c for c in d.owned_clients() if c.get('class') == 'babel-desktop']
    assert apps
    owned_pid = apps[0]['pid']
    assert Path(f'/proc/{owned_pid}/comm').read_text().strip() == 'babel-desktop'
    kill = {'pid': owned_pid, 'wallTime': time.time()}
    print('OWNED_KILL', json.dumps(kill), flush=True)
    report['ownedKill'] = kill
    os.kill(owned_pid, signal.SIGKILL)
    time.sleep(.4)
    try:
        d.command('DELETE', '')
    except RuntimeError:
        pass
    d.SESSION = None
    d.new_session()
    assert target.read_bytes() == expected
    resume = d.wait(lambda: d.find(f"//li[./h3[normalize-space(.)='Draft {record['documentId']}']]/ul/li[p[contains(.,'generation {record['generation']} ·')]]//button[normalize-space(.)='Resume as new draft']"),
                    'Exact retained generation discovered after owned kill', timeout=60)
    d.command('POST', '/element/' + resume + '/click', {})
    d.wait(lambda: rows() == ['sceneHeading:INT. ROOM - DAY', 'action:',
                             'action:Dim. A lamp glows. It hums.', 'action:', 'sceneHeading:'],
           'Explicit recovery restores full text and empty heading type', timeout=60)
    d.wait(lambda: d.recovery_ready(), 'Fresh resumed draft durably protected', timeout=30)
    assert any(m['documentId'] == record['documentId'] and source == expected and
               m['draftMetadata']['drafts'] == intent for m, source in d.journal_records())
    assert any(m['documentId'] != record['documentId'] and source == expected and
               m['draftMetadata']['drafts'] == intent for m, source in d.journal_records())
    target = d.ROOT / 'files' / 'resumed-empty-heading.fountain'
    d.click('Save As', actions=True)
    d.picker(target)
    d.audit(target, expected)
    d.wait(lambda: 'Saved locally' in d.body(), 'Resumed draft source save acknowledged')
    assert rows()[-1] == 'sceneHeading:', rows()
    report['afterKill'] = {'editor': d.editor_text(), 'intentRestored': True,
                           'originalCheckpointRetained': True}
    print('PASS native empty heading: unrelated text saved and journaled; owned SIGKILL then explicit resume restores bytes and heading intent', flush=True)

    # B. Ordinary close is safe even while the heading remains empty. Opening
    # source alone shows its portable blank; no automatic metadata adoption.
    d.close_session()
    open_file('INT. ROOM - DAYDim. A lamp glows. It hums.')
    assert rows()[-1] == 'action:', rows()
    assert target.read_bytes() == expected
    d.close_session()
    report['ordinaryClose'] = {'sourceSaved': True, 'bundleRequired': False,
                               'sourceOnlyReopen': 'blank'}
    print('PASS native empty heading: ordinary protected close succeeds; source-only reopen is a blank', flush=True)

    # C. Completing, Undoing and Redoing the heading capture current bytes and
    # intent at each step; no stale recovery metadata survives completion.
    target = d.ROOT / 'files' / 'complete-empty-heading.fountain'
    target.write_bytes(opened)
    open_file('INT. ROOM - DAYA lamp glows.')
    settled = empty_heading('A lamp glows.', ' It hums.', first)
    type_elsewhere('A lamp glows. It hums.', 'Night. ')
    empty_source = settled.replace(b'!A lamp', b'!Night. A lamp')
    d.audit(target, empty_source)
    click_row('sceneHeading', '')
    d.type_text('HALL')
    complete = empty_source[:-1] + b'.HALL\n'
    d.audit(target, complete)
    complete_record = d.wait(lambda: checkpoint(complete, []),
                             'Completed heading drops sparse intent', timeout=30)
    d.type_text(CTRL + 'z' + NULL)
    d.wait(lambda: rows()[-1] == 'sceneHeading:', 'Undo returns to empty heading')
    d.audit(target, empty_source)
    undo_record = d.wait(lambda: checkpoint(empty_source, intent, complete_record),
                         'Newer Undo empty heading intent journaled', timeout=30)
    chord('z', shift=True)
    d.wait(lambda: rows()[-1] == 'sceneHeading:HALL', 'Redo completes heading again')
    d.audit(target, complete)
    redo_record = d.wait(lambda: checkpoint(complete, [], undo_record),
                         'Newer Redo completed heading journaled', timeout=30)
    d.wait(lambda: 'Saved locally' in d.body(), 'Redo exact save acknowledged')
    assert not alerts(), alerts()
    report['completed'] = {'saved': complete.decode(), 'undoSaved': empty_source.decode(),
                           'redoSaved': complete.decode(), 'completedIntent': [],
                           'versions': [complete_record['version'], undo_record['version'], redo_record['version']]}
    d.close_session()
    print('PASS native empty heading: completion and Undo/Redo save and journal exact current bytes and intent', flush=True)

    # D. AUDIT-PARK-H-F1: both new hidden row types capture, empty and
    # populated, and later edits reach source and journal. Each document uses
    # distinct markers because the recovery journal directory is shared.
    for kind, label, empty, populated, marker in [
        ('note', 'Note', '[[]]', '[[remember the storm]]', 'Dusk. '),
        ('boneyard', 'Omitted material', '/**/', '/*remember the rain*/', 'Dawn. '),
    ]:
        target = d.ROOT / 'files' / ('new-' + kind + '.fountain')
        target.write_bytes(opened)
        open_file('INT. ROOM - DAYA lamp glows.')
        click_row('action', 'A lamp glows.')
        d.type_text(END + ' It hums.')
        d.audit(target, first)
        d.wait(lambda: 'Saved locally' in d.body(), 'Ordinary edit saved before ' + label)
        d.type_text(ENTER)
        option = d.find('//select[@id="screenplay-element"]/option[@value="' + kind + '"]')
        d.command('POST', '/element/' + option + '/click', {})
        d.wait(lambda: kind + ':' + empty in rows(), 'New empty ' + label + ' row after text')
        empty_source = first + b'\n' + empty.encode() + b'\n'
        d.audit(target, empty_source)
        d.wait(lambda: journaled(empty.encode()), 'Empty ' + label + ' journaled', timeout=30)
        assert not alerts(), alerts()
        d.type_text(populated[2:-2])
        d.wait(lambda: kind + ':' + populated in rows(), 'Text typed into new ' + label)
        populated_source = first + b'\n' + populated.encode() + b'\n'
        d.audit(target, populated_source)
        type_elsewhere('A lamp glows. It hums.', marker)
        final = populated_source.replace(b'!A lamp', b'!' + marker.encode() + b'A lamp')
        d.audit(target, final)
        d.wait(lambda: journaled(marker.encode()) and journaled(populated.encode()),
               label + ' and later text journaled', timeout=30)
        d.wait(lambda: 'Saved locally' in d.body(), 'Exact save acknowledged after ' + label)
        assert not alerts(), alerts()
        captured = target.read_bytes()
        report[kind] = {'status': status(), 'alerts': alerts(), 'saved': final.decode(), 'sourceSaved': True, 'journaled': True}
        d.screenshot('new-' + kind + '-protected')
        # Removing wrappers still requires a reviewed whole-region operation.
        click_row(kind, populated)
        option = d.find('//select[@id="screenplay-element"]/option[@value="action"]')
        d.command('POST', '/element/' + option + '/click', {})
        d.wait(lambda: any('whole-region conversion' in alert for alert in alerts()),
               'Converting ' + label + ' back remains refused')
        assert kind + ':' + populated in rows() and target.read_bytes() == final
        # Every intermediate Undo state remains capturable. The existing
        # conversion refusal is separate from the protection-status alerts.
        for _ in range(40):
            if not any(row.startswith(kind + ':') for row in rows()):
                break
            d.type_text(CTRL + 'z' + NULL)
            time.sleep(.15)
        assert not any(row.startswith(kind + ':') for row in rows()), rows()
        d.wait(lambda: 'Saved locally' in d.body(), 'Save after Undo through ' + label, timeout=30)
        after_undo = first + b'\n\n'
        d.audit(target, after_undo)
        report[kind]['afterUndo'] = {'rows': rows(), 'saved': after_undo.decode()}
        d.close_session()
        # Open the independently observed captured bytes: same literal row,
        # same later edit, exact no-op source, ordinary close without a bundle.
        # A fresh path isolates reopen from the old managed file's journal and
        # source baseline after Undo; overwriting that file tests divergence.
        target = d.ROOT / 'files' / ('reopened-' + kind + '.fountain')
        target.write_bytes(captured)
        open_file('INT. ROOM - DAY' + marker + 'A lamp glows. It hums.' + populated)
        assert rows() == ['sceneHeading:INT. ROOM - DAY', 'action:',
                          'action:' + marker + 'A lamp glows. It hums.', 'action:', kind + ':' + populated], rows()
        assert target.read_bytes() == final
        d.close_session()
        assert len(list((d.ROOT / 'copies').glob('*.draft.json'))) == 0, 'Hidden rows required an emergency bundle'
        print('PASS native new ' + label + ': empty and populated rows plus later edits saved and journaled; Undo stays capturable; exact reopen and ordinary close', flush=True)
    # E. AUDIT-PARK-H-F3: text before a Parenthetical's opening parenthesis is
    # accepted by the editor but has no Fountain spelling. The alert names the
    # row and how to resume; nothing typed meanwhile reaches the file or
    # journal until then. (Text after the closing parenthesis saves: phase G.)
    speech = b'@BOB\n(beat)\nHi there.\n\n!A lamp glows.\n'
    target = d.ROOT / 'files' / 'refused-row.fountain'
    target.write_bytes(speech)
    open_file('BOB(beat)Hi there.A lamp glows.')
    paused = ('Saving and recovery are paused. Row 2, the Parenthetical \u201cx (beat)\u201d, cannot be saved '
              'as Fountain as it stands. A Parenthetical starts with an opening parenthesis. '
              'Change that row or Undo to resume. To keep the draft exactly as it is, '
              'use Close session, then Save Emergency Copy and close.')
    click_row('parenthetical', '(beat)')
    d.type_text(HOME + 'x ')
    d.wait(lambda: 'parenthetical:x (beat)' in rows(), 'Text typed before the opening parenthesis')
    d.wait(lambda: paused in alerts(), 'Refused row named with how to resume')
    click_row('action', 'A lamp glows.')
    d.type_text(HOME + 'Storm. ')
    d.wait(lambda: 'action:Storm. A lamp glows.' in rows(), 'Author text typed in another row while refused')
    time.sleep(4)
    assert target.read_bytes() == speech, target.read_bytes()
    assert not journaled(b'Storm.'), 'Refused draft reached the journal'
    assert status() == 'Changes pending', status()
    assert alerts() == ['Newer changes exist only in memory until protection is confirmed.', paused], alerts()
    report['refusedRow'] = {'status': status(), 'alerts': alerts(), 'sourceSaved': False, 'journaled': False}
    d.screenshot('refused-row-named')
    click_row('parenthetical', 'x (beat)')
    d.type_text(HOME + DELETE + DELETE)
    d.wait(lambda: 'parenthetical:(beat)' in rows(), 'Named row changed back')
    resumed = speech.replace(b'!A lamp', b'!Storm. A lamp')
    d.audit(target, resumed)
    d.wait(lambda: journaled(b'Storm.'), 'Text typed while refused journaled after resuming', timeout=30)
    d.wait(lambda: 'Saved locally' in d.body(), 'Exact save acknowledged after resuming')
    assert not alerts(), alerts()
    report['refusedRow']['resumed'] = {'status': status(), 'saved': resumed.decode(), 'journaled': True}
    d.close_session()
    assert len(list((d.ROOT / 'copies').glob('*.draft.json'))) == 0, 'Resumed draft required an emergency bundle'
    print('PASS native refused row: alert names the row and how to resume; nothing saved or journaled meanwhile; changing the row resumes with nothing lost', flush=True)

    # F. AUDIT-PARK-H-F4-02: a Dialogue row emptied above the rest of its
    # speech is written as Fountain's two-space dialogue line, so the draft
    # keeps saving and journaling. The row's element is sparse intent on it.
    speech = b'@BOB\nOne.\nTwo more.\n\n!A lamp glows.\n'
    target = d.ROOT / 'files' / 'emptied-speech-row.fountain'
    target.write_bytes(speech)
    open_file('BOBOne.Two more.A lamp glows.')
    click_row('dialogue', 'One.')
    d.type_text(END + BACKSPACE * 4)
    kept = ['character:BOB', 'dialogue:', 'dialogue:Two more.', 'action:']
    d.wait(lambda: rows() == kept + ['action:A lamp glows.'], 'First Dialogue row emptied above its speech')
    emptied = b'@BOB\n  \nTwo more.\n\n!A lamp glows.\n'
    d.audit(target, emptied)
    intent = [{'index': 1, 'intendedKind': 'dialogue'}]
    emptied_record = d.wait(lambda: checkpoint(emptied, intent),
                            'Two-space line and sparse Dialogue intent journaled', timeout=30)
    d.wait(lambda: 'Saved locally' in d.body(), 'Emptied speech row exact save acknowledged')
    assert not alerts(), alerts()
    click_row('action', 'A lamp glows.')
    d.type_text(HOME + 'Rain. ')
    d.wait(lambda: rows() == kept + ['action:Rain. A lamp glows.'], 'Author text typed in another row while the speech row is empty')
    later = emptied.replace(b'!A lamp', b'!Rain. A lamp')
    d.audit(target, later)
    later_record = d.wait(lambda: checkpoint(later, intent, emptied_record),
                          'Later text journaled with the row still empty', timeout=30)
    d.wait(lambda: 'Saved locally' in d.body(), 'Later text saved while the speech row stays empty')
    assert not alerts(), alerts()
    report['emptiedSpeechRow'] = {'status': status(), 'alerts': alerts(), 'sourceSaved': True,
                                  'journaled': True, 'saved': later.decode(), 'intent': intent}
    d.screenshot('emptied-speech-row-protected')
    # Text typed into the row replaces the two spaces and drops the intent;
    # Undo and Redo save and journal the current bytes and intent each time.
    click_row('dialogue', '')
    d.type_text('Hi.')
    d.wait(lambda: rows()[1] == 'dialogue:Hi.', 'Text typed into the emptied row')
    spoken = later.replace(b'\n  \n', b'\nHi.\n')
    d.audit(target, spoken)
    spoken_record = d.wait(lambda: checkpoint(spoken, [], later_record),
                           'Typed row drops sparse intent', timeout=30)
    d.type_text(CTRL + 'z' + NULL)
    d.wait(lambda: rows()[1] == 'dialogue:', 'Undo returns to the empty speech row')
    d.audit(target, later)
    undo_record = d.wait(lambda: checkpoint(later, intent, spoken_record),
                         'Newer Undo two-space line and intent journaled', timeout=30)
    chord('z', shift=True)
    d.wait(lambda: rows()[1] == 'dialogue:Hi.', 'Redo types the row again')
    d.audit(target, spoken)
    redo_record = d.wait(lambda: checkpoint(spoken, [], undo_record),
                         'Newer Redo ordinary speech journaled', timeout=30)
    d.wait(lambda: 'Saved locally' in d.body(), 'Redo exact save acknowledged')
    assert not alerts(), alerts()
    report['emptiedSpeechRow']['typed'] = {
        'saved': spoken.decode(), 'undoSaved': later.decode(), 'redoSaved': spoken.decode(),
        'versions': [emptied_record['version'], later_record['version'], spoken_record['version'],
                     undo_record['version'], redo_record['version']]}
    d.close_session()
    # The saved bytes alone open as the ordinary two-space Dialogue row, with
    # exact no-op source and an ordinary close; no metadata is adopted.
    target = d.ROOT / 'files' / 'reopened-emptied-speech-row.fountain'
    target.write_bytes(later)
    open_file('BOB  Two more.Rain. A lamp glows.')
    assert rows() == ['character:BOB', 'dialogue:  ', 'dialogue:Two more.', 'action:',
                      'action:Rain. A lamp glows.'], rows()
    assert target.read_bytes() == later
    d.close_session()
    report['emptiedSpeechRow']['sourceOnlyReopen'] = 'dialogue with two spaces'
    assert len(list((d.ROOT / 'copies').glob('*.draft.json'))) == 0, 'Emptied speech row required an emergency bundle'
    print('PASS native emptied speech row: two-space line and Dialogue intent saved and journaled; later text, typing, Undo and Redo save exact bytes; source-only reopen and ordinary close', flush=True)
    # G. AUDIT-PARK-H-F4-03: speech that opens with a parenthesis saves as
    # typed. Text after a Parenthetical's closing parenthesis is Fountain
    # Dialogue with sparse Parenthetical intent; a Dialogue row that is one
    # wrapped pair is Fountain's parenthetical with sparse Dialogue intent.
    speech = b'@BOB\n(beat)\nHi there.\n\n!A lamp glows.\n'
    target = d.ROOT / 'files' / 'speech-parenthesis.fountain'
    target.write_bytes(speech)
    open_file('BOB(beat)Hi there.A lamp glows.')
    click_row('parenthetical', '(beat)')
    d.type_text(END + ' softly')
    d.wait(lambda: 'parenthetical:(beat) softly' in rows(), 'Text typed after the closing parenthesis')
    after = speech.replace(b'(beat)\n', b'(beat) softly\n')
    d.audit(target, after)
    aside = [{'index': 1, 'intendedKind': 'parenthetical'}]
    after_record = d.wait(lambda: checkpoint(after, aside),
                          'Exact text and sparse Parenthetical intent journaled', timeout=30)
    d.wait(lambda: 'Saved locally' in d.body(), 'Text after the parenthesis exact save acknowledged')
    assert not alerts(), alerts()
    click_row('dialogue', 'Hi there.')
    d.type_text(END + BACKSPACE * 9 + '(laughs)')
    d.wait(lambda: 'dialogue:(laughs)' in rows(), 'Dialogue row rewritten as one wrapped pair')
    wrapped = after.replace(b'Hi there.\n', b'(laughs)\n')
    d.audit(target, wrapped)
    both = aside + [{'index': 2, 'intendedKind': 'dialogue'}]
    wrapped_record = d.wait(lambda: checkpoint(wrapped, both, after_record),
                            'Wrapped pair and sparse Dialogue intent journaled', timeout=30)
    d.wait(lambda: 'Saved locally' in d.body(), 'Wrapped Dialogue exact save acknowledged')
    assert not alerts(), alerts()
    click_row('action', 'A lamp glows.')
    d.type_text(HOME + 'Rain. ')
    d.wait(lambda: 'action:Rain. A lamp glows.' in rows(), 'Author text typed in another row meanwhile')
    later = wrapped.replace(b'!A lamp', b'!Rain. A lamp')
    d.audit(target, later)
    later_record = d.wait(lambda: checkpoint(later, both, wrapped_record),
                          'Later text journaled with both intents', timeout=30)
    d.wait(lambda: 'Saved locally' in d.body(), 'Later text saved beside the parenthesis rows')
    assert not alerts(), alerts()
    report['speechParenthesis'] = {'status': status(), 'alerts': alerts(), 'sourceSaved': True,
                                   'journaled': True, 'saved': later.decode(), 'intent': both}
    d.screenshot('speech-parenthesis-protected')
    # Typing on makes ordinary Dialogue and drops that row's intent.
    click_row('dialogue', '(laughs)')
    d.type_text(END + ' Oh no.')
    d.wait(lambda: 'dialogue:(laughs) Oh no.' in rows(), 'Text typed after the wrapped pair')
    spoken = later.replace(b'(laughs)\n', b'(laughs) Oh no.\n')
    d.audit(target, spoken)
    spoken_record = d.wait(lambda: checkpoint(spoken, aside, later_record),
                           'Ordinary Dialogue drops its sparse intent', timeout=30)
    d.wait(lambda: 'Saved locally' in d.body(), 'Ordinary Dialogue exact save acknowledged')
    assert not alerts(), alerts()
    report['speechParenthesis']['typed'] = {
        'saved': spoken.decode(),
        'versions': [after_record['version'], wrapped_record['version'], later_record['version'],
                     spoken_record['version']]}
    d.close_session()
    # The saved bytes alone open as Fountain reads them, with exact no-op
    # source. A line that begins with a closed parenthetical is editable.
    target = d.ROOT / 'files' / 'reopened-speech-parenthesis.fountain'
    target.write_bytes(spoken)
    open_file('BOB(beat) softly(laughs) Oh no.Rain. A lamp glows.')
    assert rows() == ['character:BOB', 'dialogue:(beat) softly', 'dialogue:(laughs) Oh no.', 'action:',
                      'action:Rain. A lamp glows.'], rows()
    assert target.read_bytes() == spoken
    click_row('dialogue', '(laughs) Oh no.')
    d.type_text(END + ' Why?')
    d.wait(lambda: 'dialogue:(laughs) Oh no. Why?' in rows(), 'Reopened line that begins with a closed parenthetical is editable')
    edited = spoken.replace(b'Oh no.\n', b'Oh no. Why?\n')
    d.audit(target, edited)
    d.wait(lambda: 'Saved locally' in d.body(), 'Edit to the reopened line exact save acknowledged')
    assert not alerts(), alerts()
    d.close_session()
    report['speechParenthesis']['sourceOnlyReopen'] = {'rows': 'two editable Dialogue rows', 'saved': edited.decode()}
    assert len(list((d.ROOT / 'copies').glob('*.draft.json'))) == 0, 'Speech parenthesis rows required an emergency bundle'
    print('PASS native speech parenthesis: text after a Parenthetical and a wrapped Dialogue saved and journaled with sparse intent; later text and typing on save exact bytes; source-only reopen is editable', flush=True)
    (d.ROOT / 'empty-heading.json').write_text(json.dumps(report, indent=2) + '\n')
