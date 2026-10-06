"""M6-16 deliberate synthetic writing/revision and backup restore in the package.

Expected bytes are authored here, not captured from the editor. Native controls
and trusted keys perform every mutation. DOM scripts observe or place a caret;
they never invoke IPC or change EditorState. No personal IME configuration.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time

CTRL, SHIFT, ENTER = '\ue009', '\ue008', '\ue007'


def run(d):
    started = time.monotonic()
    report = {'checks': [], 'audits': [], 'typedCharacters': 0}
    output = d.ROOT / 'local-pilot.json'

    def record(check):
        report['checks'].append(check)
        observations = d.script('return window.pilotNative ?? [];')
        if observations:
            report['nativeObservations'] = observations
        output.write_text(json.dumps(report, indent=2) + '\n')
        print('PILOT', check, flush=True)

    client = next(c for c in d.owned_clients() if c.get('class') == 'babel-desktop')
    executable = os.readlink(f'/proc/{client["pid"]}/exe')
    assert '/.mount_' in executable, executable
    report['nativeExecutable'] = executable
    report['nativeSha256'] = hashlib.sha256(Path(executable).read_bytes()).hexdigest()
    status = Path(f'/proc/{client["pid"]}/status').read_text()
    assert next(line.split()[1] for line in status.splitlines() if line.startswith('CapEff:')) == '0000000000000000'
    routes = Path('/proc/net/route').read_text().splitlines()
    assert len(routes) == 1, routes
    record('FUSE-mounted package; loopback-only namespace; zero effective capabilities')
    d.script("""window.pilotNative=[];const original=window.__TAURI_INTERNALS__.invoke;
      window.__TAURI_INTERNALS__.invoke=function(command,args,...rest){
        const promise=original.call(this,command,args,...rest);
        if(command.includes('snapshot')){
          const entry={command,version:args?.request?.checkpoint?.version ?? args?.request?.current?.version};
          window.pilotNative.push(entry);promise.then(result=>{entry.result=result;},error=>{entry.error=error;});
        }return promise;};""")

    def ready():
        d.wait(lambda: d.script("return document.querySelector('#writing-save')?.disabled===false && !!document.querySelector('.outline-target:not(:disabled)');"), 'Current writable pilot screenplay', timeout=60)

    def chord(key, shift=False):
        d.script("document.querySelector('.ProseMirror').focus();")
        keys = [CTRL] + ([SHIFT] if shift else []) + [key]
        d.command('POST', '/actions', {'actions': [{'type': 'key', 'id': 'pilot-chord', 'actions':
            [{'type': 'keyDown', 'value': k} for k in keys] +
            [{'type': 'keyUp', 'value': k} for k in reversed(keys)]}]})

    def type_line(text, kind=None, end=True):
        if kind:
            chord(kind)
        d.type_text(text)
        report['typedCharacters'] += len(text)
        if end:
            d.type_text(ENTER)

    def save(path, expected):
        ready(); d.click('Save', actions=True); d.audit(path, expected)
        d.wait(lambda: 'Saved locally' in d.body(), 'Current exact Save receipt', timeout=60)
        d.wait(lambda: any(raw == expected for _, raw in d.journal_records()), 'Exact acknowledged recovery bytes', timeout=60)
        # Same-byte Save may display the previous receipt before the writing
        # action finishes. Wait for command readiness before a destructive step.
        ready()
        report['audits'].append({'file': str(path), 'bytes': len(expected), 'sha256': hashlib.sha256(expected).hexdigest()})

    def open_file(path):
        d.click('Open Fountain', actions=True); d.picker(path); ready()
        d.assert_identical_reopen()

    def activate(xpath):
        element = d.find(xpath)
        d.command('POST', f'/element/{element}/click', {})

    # Write a complete three-scene miniature rather than cycling a fixed soak.
    # The revisions below change its emphasis and order while preserving drafts.
    d.click('New screenplay', actions=True)
    d.wait(lambda: 'Protect draft' in d.body(), 'New screenplay opens')
    d.script("""window.pilotInput=[];const e=document.querySelector('.ProseMirror');
      e.addEventListener('keydown',event=>{if(event.key.length!==1||event.ctrlKey)return;
        const start=performance.now();requestAnimationFrame(()=>window.pilotInput.push({ms:performance.now()-start,trusted:event.isTrusted}));});""")
    a1 = 'A storm presses against the cabin windows. Nora sets a cracked brass bell beside a radio that has been silent since dawn. The ferry is overdue, but every lamp on the opposite shore is still burning.'
    a2 = 'Eli unfolds the old timetable. Someone has crossed out the last departure and written a single word beneath it: listen. Nora turns the radio knob until a thin whistle breaks through the static.'
    a3 = 'The bell sounds once without either of them touching it. Nora reaches for her coat. Eli takes the timetable and leaves the lamp on, a small promise that they intend to come back.'
    b1 = 'At the end of the pier, rain hides the far bank. A rope trails into the water. Nora pulls it in hand over hand while Eli steadies her against the wind. There is no boat attached, only a dry canvas bag.'
    b2 = 'Inside the bag is another bell, wrapped in the missing captain\'s scarf. Eli looks toward the cabin light. Nora waits. Somewhere beyond the rain, the ferry answers with two clear notes.'
    c1 = 'They return soaked and laughing. The radio now carries the captain\'s voice, calm enough to make the whole strange evening seem ordinary. Nora hangs the scarf beside the door and rings both bells together.'
    c2 = 'Outside, the ferry lamps move at last. Eli erases the crossed-out departure and writes a new time. He leaves the word listen exactly where it was.'
    type_line('INT. SIGNAL CABIN - NIGHT')
    type_line(a1); type_line(a2)
    type_line('NORA', '3'); type_line('(whispering)', '5')
    type_line('Wait for the second bell.')
    type_line('ELI', '3'); type_line('And if it never comes?')
    type_line(a3)
    type_line('EXT. FERRY PIER - NIGHT', '1')
    type_line(b1)
    type_line('NORA', '3'); type_line('It came. We were listening in the wrong place.')
    type_line(b2)
    type_line('INT. SIGNAL CABIN - DAWN', '1')
    type_line(c1)
    # Accept a real local cue suggestion, then Enter into Dialogue separately.
    chord('3'); d.type_text('NO'); report['typedCharacters'] += 2
    d.wait(lambda: d.script("return document.querySelector('.completion-popup [aria-selected=true]')?.textContent==='NORA';"), 'Established NORA completion')
    d.type_text(ENTER)
    d.wait(lambda: d.script("return [...document.querySelectorAll('.ProseMirror > p[data-kind=character]')].at(-1)?.textContent==='NORA';"), 'Completion accepted')
    d.type_text(ENTER); type_line('Tomorrow, we start by listening.')
    type_line(c2, end=False)
    scenes = [
        f'.INT. SIGNAL CABIN - NIGHT\n\n!{a1}\n\n!{a2}\n\n@NORA\n(whispering)\nWait for the second bell.\n\n@ELI\nAnd if it never comes?\n\n!{a3}\n\n',
        f'.EXT. FERRY PIER - NIGHT\n\n!{b1}\n\n@NORA\nIt came. We were listening in the wrong place.\n\n!{b2}\n\n',
        f'.INT. SIGNAL CABIN - DAWN\n\n!{c1}\n\n@NORA\nTomorrow, we start by listening.\n\n!{c2}\n',
    ]
    authored = ''.join(scenes).encode()
    draft = d.ROOT / 'files' / 'written.fountain'
    d.click('Save As', actions=True); d.picker(draft); save(draft, authored)
    report['inputFrames'] = d.script('return window.pilotInput;')
    assert report['inputFrames'] and all(x['trusted'] for x in report['inputFrames'])
    d.screenshot('pilot-written'); d.close_session()
    record('Three-scene screenplay drafted from New with smart Enter, parenthetical, dialogue and cue autocomplete; literal Save/checkpoint bytes')

    # Add independently authored BOM/CRLF, unknown title key and hidden regions
    # to a second disposable source. These must remain exact through editing.
    header = '\ufeffTitle: The second bell\r\nAuthor: Synthetic pilot\r\nX-Private: retain  \r\n\r\n'
    tail = '\r\n[[Check whether the second bell can be heard from the pier.]]\r\n/* Alternate ending: they miss the ferry. */\r\n'
    source = (header + ''.join(scenes).replace('\n', '\r\n') + tail).encode()
    target = d.ROOT / 'files' / 'working.fountain'; target.write_bytes(source)
    open_file(target); save(target, source)
    d.set_input('Snapshot name', 'Before revision'); d.click('Keep named snapshot')
    d.wait(lambda: 'Named snapshot protected' in d.body(), 'Named original retained')
    d.click('Title page', actions=True)
    activate('//button[@aria-label="Edit field 1: Title"]')
    textarea = d.find('//section[@aria-label="Title page"]//textarea')
    d.command('POST', f'/element/{textarea}/click', {})
    d.command('POST', '/actions', {'actions': [{'type': 'key', 'id': 'pilot-title', 'actions': [
        {'type':'keyDown','value':CTRL},{'type':'keyDown','value':'a'},
        {'type':'keyUp','value':'a'},{'type':'keyUp','value':CTRL},
        {'type':'keyDown','value':'\ue003'},{'type':'keyUp','value':'\ue003'}]}]})
    d.command('POST', f'/element/{textarea}/value', {'text': 'Listen twice'})
    d.click('Save', actions=True)
    assert target.read_bytes() == source, 'Staged title must not be saved'
    assert 'Uncommitted title input' in d.body()
    d.click('Apply title input'); d.click('Close title page')
    titled = source.replace(b'Title: The second bell', b'Title: Listen twice')
    save(target, titled); chord('z'); save(target, source); chord('z', True); save(target, titled)
    record('Title edit blocks Save while staged; apply, Undo and Redo retain BOM/CRLF/unknown key and hidden regions')

    d.click('Find', actions=True); d.set_input('Find text', 'Wait for the second bell.')
    d.wait(lambda: '1 match' in d.script("return document.querySelector('.find-panel [role=status]').textContent;"), 'One current dialogue match')
    d.set_input('Replace with', 'Trust the second bell.'); d.click('Replace all')
    d.wait(lambda: 'Replaced 1 match' in d.body(), 'Dialogue revision applied')
    revised = titled.replace(b'Wait for the second bell.', b'Trust the second bell.')
    d.click('Close find'); save(target, revised); chord('z'); save(target, titled); chord('z', True); save(target, revised)
    record('Dialogue rewritten with Find/Replace; exact Save/Undo/Redo')

    ready(); activate('//button[@aria-label="Move Scene 2: EXT. FERRY PIER - NIGHT up"]')
    d.wait(lambda: d.script("return !!document.querySelector('section[aria-label=\"Move preview\"]');"), 'Scene move preview')
    d.screenshot('pilot-move-preview'); d.click('Apply move')
    moved_text = header.replace('The second bell', 'Listen twice') + (scenes[1] + scenes[0] + scenes[2]).replace('Wait for the second bell.', 'Trust the second bell.').replace('\n', '\r\n') + tail
    moved = moved_text.encode()
    save(target, moved); chord('z'); save(target, revised); chord('z', True); save(target, moved)
    record('Scene 2 moved above Scene 1; exact whole-scene order, Save/Undo/Redo; authored notes/omission unchanged')

    # Restore an older snapshot, then recover the formerly current version from
    # its own pre-destructive snapshot, not just from transient editor Undo.
    activate('//li[contains(.,"Before revision")]//button[normalize-space(.)="Restore previous version"]')
    d.wait(lambda: 'Restored as new version' in d.body(), 'Older draft restored', timeout=60)
    save(target, source)
    snapshots = d.ROOT / 'data/app.babel.screenwriter/snapshots'
    assert any(p.is_file() and p.read_bytes() == moved for p in snapshots.rglob('*')), 'Formerly current draft retained on disk'
    chord('z'); save(target, moved); chord('z', True); save(target, source)
    activate('//li[contains(.,"Before replacement")]//button[normalize-space(.)="Restore previous version"]')
    d.wait(lambda: target.read_bytes() == moved, 'Formerly current draft restored from safety snapshot', timeout=60)
    save(target, moved)
    d.screenshot('pilot-restored-current')
    record('Older snapshot restored; former current bytes retained in safety snapshot; Undo/Redo and actual safety-snapshot restore recover current draft')

    # UI-only preferences must survive an ordinary native process restart.
    for label, value in [('Theme', 'dark'), ('Writing zoom', '125')]:
        activate('//select[@aria-label=' + json.dumps(label) + ']/option[@value=' + json.dumps(value) + ']')
    activate('//label[contains(.,"Typewriter scroll")]/input')
    prefs = d.script("return JSON.parse(localStorage.getItem('babel.view.v1'));")
    d.close_session(); d.release_session(); d.new_session(); open_file(target); save(target, moved)
    assert d.script("return JSON.parse(localStorage.getItem('babel.view.v1'));") == prefs
    d.screenshot('pilot-reopened')
    record('Ordinary process close/restart and exact source reopen; theme, zoom and typewriter preferences retained')

    # Fountain export is read by the system interpreter independently of Babel.
    export_dir = d.ROOT / 'copies' / 'independent'; export_dir.mkdir(mode=0o700)
    d.click('Export Fountain copy', actions=True); d.picker(export_dir)
    d.wait(lambda: any(p.is_file() and p.read_bytes() == moved for p in export_dir.iterdir()), 'Fountain export published', timeout=60)
    exports = [p for p in export_dir.iterdir() if p.is_file() and p.read_bytes() == moved]
    assert len(exports) == 1, exports
    exported = exports[0]
    d.audit(exported, moved)
    independent = exported.read_bytes().decode('utf-8-sig')
    headings = [line for line in independent.splitlines() if line.startswith(('.INT.', '.EXT.'))]
    assert headings == ['.EXT. FERRY PIER - NIGHT', '.INT. SIGNAL CABIN - NIGHT', '.INT. SIGNAL CABIN - DAWN']
    assert 'X-Private: retain  ' in independent and 'Alternate ending:' in independent and 'Trust the second bell.' in independent
    record('Exported Fountain independently decoded; title, authored text, scene order, unknown key, note and omission retained')

    backup_root = Path(os.environ['BABEL_PILOT_BACKUP_ROOT'])
    assert backup_root.is_absolute() and backup_root.is_dir()
    report['backupFilesystem'] = subprocess.check_output(['stat', '-f', '-c', '%T', str(backup_root)], text=True).strip()
    d.click('Select copy destination', actions=True); d.picker(backup_root)
    d.click('Save copy to selected destination')
    d.wait(lambda: 'Copy verified for version' in d.body(), 'Native backup copy verified', timeout=60)
    copies = [p for p in backup_root.iterdir() if p.is_file() and p.read_bytes() == moved]
    assert len(copies) == 1, copies
    backup = copies[0]; d.audit(backup, moved)
    report['backup'] = str(backup)
    d.close_session()
    # Simulate loss of the working-source directory without destroying evidence.
    missing = d.ROOT / 'retained-unavailable-files'
    target.parent.rename(missing)
    d.release_session(); d.new_session(); open_file(backup); save(backup, moved)
    restored_dir = d.ROOT / 'restored'; restored_dir.mkdir(mode=0o700)
    restored = restored_dir / 'working-restored.fountain'
    d.click('Save As', actions=True); d.picker(restored); save(restored, moved)
    d.close_session(); open_file(restored); save(restored, moved)
    assert (missing / target.name).read_bytes() == moved and backup.read_bytes() == moved
    assert any(p.is_file() and p.read_bytes() == source for p in snapshots.rglob('*'))
    d.screenshot('pilot-backup-restored'); d.close_session()
    record('Export backup to separate tmpfs destination; working directory made unavailable; restart, open backup, Save As into fresh Btrfs directory, close/reopen exact restored copy')
    report.update(seconds=round(time.monotonic() - started, 3), authoredWords=len(authored.decode().split()),
                  finalSha256=hashlib.sha256(moved).hexdigest(), restored=str(restored),
                  limitations=['Separate filesystem on same laptop, not a physically independent/power-loss durable backup',
                               'Scripted agent writing and trusted native keys; full IME/a11y/long-session performance matrix not claimed'])
    output.write_text(json.dumps(report, indent=2) + '\n')
    print('PASS M6-16 packaged writing/revision/title/move/restore/independent Fountain/backup reopen drill', flush=True)
