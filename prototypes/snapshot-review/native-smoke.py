"""Real Wayland F2 -> native WebKit commands; independent literal byte/checksum audit."""
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import sys
import time

log, root = Path(sys.argv[1]), Path(sys.argv[2])

def reports():
    return [json.loads(line.split(' ', 1)[1]) for line in log.read_text().splitlines()
            if line.startswith('M1_COMPOSITION_PROOF ') and json.loads(line.split(' ', 1)[1]).get('task') == 'M2-05C']

def wait(event):
    end = time.monotonic() + 20
    while time.monotonic() < end:
        for report in reports():
            assert report['nativeHost'] and 'AppleWebKit' in report['userAgent']
            assert report['event'] != 'failed', 'Native drill failed; keep synthetic root'
            if report['event'] == event:
                return report['detail']
        time.sleep(0.1)
    raise AssertionError(f'Timed out waiting for {event}')

ready = wait('ready')
active = json.loads(subprocess.check_output(['hyprctl', '-j', 'activewindow']))
assert active['title'] == 'babel M2-05C synthetic snapshot proof', 'Owned proof window must have focus'
subprocess.run(['wtype', '-k', 'F2'], check=True)
detail = wait('completed')
original = (Path(__file__).parent.parent / 'editor-composition/fixtures/lf.fountain').read_bytes()
edited = original + b'\n!Snapshot restore target.\n'
live = original + b'\n!Unsaved local protection.\n'
sha = lambda b: hashlib.sha256(b).hexdigest()
assert bytes(ready['current']['source']) == original
assert (root / 'lf.fountain').read_bytes() == edited
assert bytes(detail['reopened']['source']) == edited
assert bytes(detail['preview']['source']) == edited
assert detail['receipt']['version'] == 22 and detail['receipt']['sourceSha256'] == sha(edited)
assert detail['receipt']['protection'] == 'sourceFile'
assert detail['receipt']['recovery']['protection'] == 'recoveryCheckpoint'
assert detail['receipt']['recovery']['version'] == 22
assert detail['receipt']['recovery']['sourceSha256'] == sha(edited)
assert detail['reopened']['identity']['sessionId'] != ready['current']['identity']['sessionId']
assert detail['copied']['version'] == 21 and detail['copied']['sourceSha256'] == sha(original)
assert detail['copied']['storageRelation'] == 'sameFilesystem'
assert (root / 'data' / detail['copied']['fileName']).read_bytes() == original
identity = ready['current']['identity']
snapshot_dir = root / 'app-data/snapshots' / identity['documentId']
records = []
for path in snapshot_dir.glob('*.json'):
    envelope = json.loads(path.read_bytes())
    record = envelope['record']
    canonical = json.dumps(record, separators=(',', ':'), ensure_ascii=False).encode()
    assert sha(canonical) == envelope['recordSha256']
    data = (snapshot_dir / (record['sourceSha256'] + '.fountain')).read_bytes()
    assert sha(data) == record['sourceSha256'] and len(data) == record['byteLength']
    records.append(record)
assert len(records) == 3
assert {r['sourceSha256'] for r in records} == {sha(original), sha(edited), sha(live)}
assert any(r['kind'] == 'preDestructive' and r['version'] == 21 and r['sourceSha256'] == sha(live) for r in records)
assert any(r['kind'] == 'preDestructive' and r['version'] is None and r['sourceSha256'] == sha(original) for r in records)
assert detail['catalog']['sourceBytes'] == len(original) + len(edited) + len(live)
assert not detail['catalog']['needsAttention']
assert (root / 'app-data/source-save' / identity['documentId'] / 'previous').read_bytes() == original
journal = (root / 'app-data/recovery' / (identity['documentId'] + '.journal')).read_bytes()
frames = []
offset = 0
while offset < len(journal):
    assert journal[offset:offset+8] == b'BBLREC01'
    schema, meta_len, source_len = struct.unpack_from('<IIQ', journal, offset+8)
    assert schema == 1
    end = offset + 24 + meta_len + source_len
    assert hashlib.sha256(journal[offset:end]).digest() == journal[end:end+32]
    metadata = json.loads(journal[offset+24:offset+24+meta_len])
    source = journal[offset+24+meta_len:end]
    assert sha(source) == metadata['sourceSha256']
    frames.append((metadata, source))
    offset = end+32
assert frames[-1][0]['version'] == 22 and frames[-1][1] == edited
print(json.dumps({'nativeWebKit': True, 'root': str(root), 'originalSha256': sha(original), 'editedSha256': sha(edited), 'liveSha256': sha(live), 'snapshotRecords': len(records), 'sourceReadableBlobs': len(list(snapshot_dir.glob('*.fountain'))), 'copiedVersion': 21, 'restoredVersion': 22, 'reopenedSessionChanged': True, 'recoveryFrames': len(frames), 'independentAudit': 'passed'}, indent=2))
