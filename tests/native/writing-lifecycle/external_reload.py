"""AUDIT-D08A production Reload with literal disk/snapshot/history oracles."""
import json
import subprocess
import time


def run(d):
    original = b'.INT. RELOAD - DAY\n!Original draft.\n'
    outside = b'.INT. OUTSIDE - NIGHT\n!External generation.\n'
    target = d.ROOT / 'files' / 'reload.fountain'
    target.write_bytes(original)
    d.click('Open Fountain', actions=True)
    d.picker(target)
    d.wait(lambda: d.script("return !document.querySelector('#writing-save')?.disabled && !!document.querySelector('.outline-target:not(:disabled)');"), 'Opened writable source', timeout=60)
    d.click('Save', actions=True)
    d.wait(lambda: 'Saved locally' in d.body(), 'Initial exact source receipt')

    def panel():
        return d.script("return !!document.querySelector('section[aria-label=\"External source change\"]');")

    def ready():
        d.wait(lambda: d.script("return !document.querySelector('#writing-save')?.disabled;"), 'Reload thawed')

    def protections(expected):
        store = d.ROOT / 'data' / 'app.babel.screenwriter'
        blobs = list((store / 'snapshots').rglob('*.fountain'))
        assert any(p.read_bytes() == expected for p in blobs), 'Exact pre-Reload snapshot bytes'
        repositories = list((store / 'history').rglob('HEAD'))
        retained = []
        for head in repositories:
            repo = head.parent
            revisions = subprocess.check_output(['git', '--git-dir=' + str(repo), 'rev-list', '--all'], text=True).splitlines()
            for commit in revisions:
                paths = subprocess.check_output(['git', '--git-dir=' + str(repo), 'ls-tree', '-r', '--name-only', commit], text=True).splitlines()
                for path in paths:
                    if path.endswith('.fountain'):
                        retained.append(subprocess.check_output(['git', '--git-dir=' + str(repo), 'show', commit + ':' + path]))
        assert expected in retained, 'Exact safety revision bytes'
        print(json.dumps({'protectedLength': len(expected), 'snapshotBlobs': len(blobs), 'historySources': len(retained)}), flush=True)

    # Metadata-only atomic replacement re-anchors without showing a Reload prompt.
    sibling = target.with_suffix('.replacement')
    sibling.write_bytes(original)
    sibling.replace(target)
    d.click('Check external changes', actions=True)
    d.wait(lambda: 'No external content change detected.' in d.body(), 'Identical content check')
    assert not panel()
    d.click('Save', actions=True)
    d.audit(target, original)
    d.wait(lambda: 'Saved locally' in d.body(), 'Save after metadata-only reanchor')
    print('PASS native identical-byte atomic replacement / explicit recheck / subsequent Save', flush=True)

    sibling.write_bytes(outside)
    sibling.replace(target)
    inode = target.stat().st_ino
    d.wait(panel, 'Periodic watcher offers clean Reload', timeout=20)
    assert 'The source file changed outside Babel.' in d.body()
    assert 'Original draft.' in d.editor_text()
    d.click('Reload reviewed source')
    d.wait(lambda: 'External generation.' in d.editor_text(), 'Reload adopted outside generation')
    ready()
    assert target.read_bytes() == outside and target.stat().st_ino == inode
    protections(original)
    d.audit(target, outside)
    d.wait(lambda: 'Saved locally' in d.body(), 'Reload exact source receipt')
    print('PASS native clean Reload / unchanged disk inode / literal snapshot and revision', flush=True)

    # Undo Reload is an owned editor edit; explicit Save gives that version its own receipt.
    d.type_text('\ue009z\ue000')
    d.wait(lambda: 'Original draft.' in d.editor_text(), 'One-step Reload Undo')
    d.click('Save', actions=True)
    d.audit(target, original)
    d.wait(lambda: 'Saved locally' in d.body(), 'Undo version independently saved')
    print('PASS native one-step Reload Undo / later exact source Save', flush=True)

    # Dirty conflict: use trusted editor input, then outside bytes stop autosave.
    target.write_bytes(outside)
    d.type_text('Local ')
    d.wait(panel, 'Dirty conflict offered')
    d.wait(lambda: 'Your draft and the source file differ.' in d.body(), 'Dirty explanation')
    local_records = d.wait(lambda: [source for _, source in d.journal_records() if b'Local ' in source], 'Latest dirty recovery')
    local = local_records[-1]
    d.click('Keep editing')
    assert not panel()
    time.sleep(5.5)
    assert not panel(), 'Keep editing remains dismissed for the same generation'
    assert target.read_bytes() == outside
    d.click('Reload source', actions=True)
    d.click('Reload reviewed source')
    d.wait(lambda: 'External generation.' in d.editor_text() and 'Local ' not in d.editor_text(), 'Explicit dirty Reload')
    ready()
    protections(local)
    assert target.read_bytes() == outside
    print('PASS native dirty comparison / Keep editing / protected explicit Reload', flush=True)
    d.close_session()
    print('PASS native Reload protected close', flush=True)
    d.release_session()
