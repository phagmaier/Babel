"""M6-03 production UI retention; synthetic disk fixtures are explicitly labelled.

No native command is mocked and no fault-hook/path API is used. The orphan case
models a post-record-prune state; it does not claim a process was interrupted.
Actual owned-child SIGKILL evidence belongs to the separate core drill.
"""
import hashlib
import json
import os
from pathlib import Path
import stat
import struct
import time
import uuid


NOTICE = 'Local snapshots and history can share the source disk.'
ATTENTION = 'Interrupted or damaged snapshot material needs inspection.'
FAILURE = 'Protection failed or its result could not be confirmed.'
COMPLETE = 'Retention completed; named and pre-destructive versions remain protected.'


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def compact(value):
    # SnapshotRecord field order is inherited from the native published record.
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()


def private_file(path, raw):
    with path.open('xb') as stream:
        os.chmod(path, 0o600)
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())


def files(directory):
    result = {}
    for path in sorted(directory.iterdir()):
        info = path.lstat()
        assert stat.S_ISREG(info.st_mode) and info.st_nlink == 1
        assert info.st_uid == os.geteuid() and stat.S_IMODE(info.st_mode) == 0o600
        raw = path.read_bytes()
        result[path.name] = {'bytes': len(raw), 'sha256': digest(raw),
                             'device': info.st_dev, 'inode': info.st_ino,
                             'mode': stat.S_IMODE(info.st_mode), 'uid': info.st_uid}
    return result


def recovery_records(directory, document_id):
    records = []
    for path in sorted(directory.glob(document_id + '.*')):
        if path.suffix not in ('.journal', '.previous'):
            continue
        data = path.read_bytes()
        offset = 0
        while offset < len(data):
            assert data[offset:offset + 8] == b'BBLREC01'
            schema, metadata_length, source_length = struct.unpack_from('<IIQ', data, offset + 8)
            assert schema == 1
            end = offset + 24 + metadata_length + source_length
            assert hashlib.sha256(data[offset:end]).digest() == data[end:end + 32]
            metadata = json.loads(data[offset + 24:offset + 24 + metadata_length])
            source = data[offset + 24 + metadata_length:end]
            assert metadata['documentId'] == document_id
            assert metadata['sourceSha256'] == digest(source)
            records.append((metadata, source, str(path)))
            offset = end + 32
        assert offset == len(data)
    return records


def seed(directory, template, label, source, created, kind='rolling', name=None):
    record = dict(template)
    record.update(snapshotId=str(uuid.uuid4()), sourceSha256=digest(source),
                  byteLength=len(source), createdSeconds=created, kind=kind, name=name)
    blob = directory / (record['sourceSha256'] + '.fountain')
    if blob.exists():
        assert blob.read_bytes() == source
    else:
        private_file(blob, source)
    envelope = {'record': record, 'recordSha256': digest(compact(record))}
    private_file(directory / (record['snapshotId'] + '.json'), compact(envelope))
    return {'label': label, 'provenance': 'synthetic external fixture, not native publication',
            'record': record, 'recordSha256': envelope['recordSha256']}


def sync_directory(directory):
    fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def run(d):
    report = {'mode': 'snapshot-retention', 'passed': False, 'cases': [],
              'fixtureDisclosure': 'External synthetic records/blobs; named publication, Save, list and retention are real UI/IPC.',
              'interruptionDisclosure': 'UI orphan simulation only; no kill claim. Separate core drill owns SIGKILL evidence.'}
    client = next(client for client in d.owned_clients() if client.get('class') == 'babel-desktop')
    executable = Path(os.readlink(f'/proc/{client["pid"]}/exe'))
    status = Path(f'/proc/{client["pid"]}/status').read_text().splitlines()
    credentials = {line.split(':')[0]: line.split(':')[1].strip()
                   for line in status if line.startswith(('Uid:', 'Cap'))}
    assert all(int(uid) == os.geteuid() != 0 for uid in credentials['Uid'].split())
    assert all(int(value, 16) == 0 for key, value in credentials.items() if key.startswith('Cap'))
    report['nativeProcess'] = {'pid': client['pid'], 'executable': str(executable),
                               'sha256': digest(executable.read_bytes()), 'credentials': credentials}
    # Tauri 2.12 defines invoke as a non-writable property. Observe its fetch
    # transport instead: return the original promise/response without alteration,
    # decode a clone, and never retain transport headers or the invoke key.
    d.script("""window.retentionNative=[];
      window.retentionOriginalFetch=window.fetch;
      window.fetch=function(input,options,...rest){
        const promise=window.retentionOriginalFetch.call(this,input,options,...rest);
        const command=new URL(String(input),location.href).pathname.split('/').pop();
        if(command.includes('snapshot') || command==='save_document' || command==='checkpoint_document'){
          const payload=JSON.parse(options.body);
          const entry={command,request:payload.request};window.retentionNative.push(entry);
          promise.then(response=>response.clone().json().then(value=>{
            const ok=response.headers.get('Tauri-Response')==='ok';
            entry[ok?'result':'error']=value;entry.ok=ok;
          }),error=>{entry.transportError=String(error);});
        }return promise;};""")

    def ready():
        d.wait(lambda: d.script("return document.querySelector('.ProseMirror')?.getAttribute('contenteditable')==='true' && document.querySelector('#writing-save')?.disabled===false;"),
               'Protected writable source Save ready', timeout=60)

    def events():
        return d.script('return window.retentionNative;')

    def mark():
        return len(events())

    def reply(command, start):
        return d.wait(lambda: next((event for event in events()[start:]
                                   if event['command'] == command and 'ok' in event), None),
                      'Observed native ' + command + ' completion', timeout=60)

    def panel():
        return d.script("return document.querySelector('section[aria-labelledby=\"snapshots-heading\"]')?.innerText;")

    def screenshot(label):
        selector = ('[role="alert"]' if 'orphan' in label else
                    '[role="status"]' if label.endswith(('completed', 'refusal')) else 'h2')
        visible = d.script("""const panel=document.querySelector('section[aria-labelledby="snapshots-heading"]');
          const target=panel.querySelector(arguments[0]);target.scrollIntoView({block:'center'});
          const rect=target.getBoundingClientRect();return rect.top>=90 && rect.bottom<=innerHeight;""", [selector])
        assert visible, 'Screenshot target is clipped or hidden behind sticky controls'
        d.screenshot(label)

    def refresh():
        start = mark()
        d.click('Refresh snapshots')
        event = reply('list_snapshots', start)
        assert event['ok'], event
        return event['result']

    def save(target, raw, store, identity=None):
        ready(); start = mark(); d.click('Save', actions=True)
        event = reply('save_document', start)
        assert event['ok'], event
        receipt = event['result']
        assert receipt['protection'] == 'sourceFile' and receipt['sourceSha256'] == digest(raw)
        assert receipt['fingerprint']['sha256'] == digest(raw)
        assert receipt['fingerprint']['byteLength'] == len(raw)
        recovered = receipt['recovery']
        assert recovered['identity'] == receipt['identity']
        assert recovered['version'] == receipt['version']
        assert recovered['sourceSha256'] == digest(raw) and recovered['protection'] == 'recoveryCheckpoint'
        if identity:
            assert receipt['identity'] == identity
        d.audit(target, raw)
        d.wait(lambda: 'Saved locally' in d.body(), 'Source Save independently acknowledged')
        ready()
        matches = d.wait(lambda: [(metadata, path) for metadata, source, path in
                                  recovery_records(store / 'recovery', receipt['identity']['documentId'])
                                  if source == raw and metadata['version'] == receipt['version'] and
                                  metadata['sessionId'] == receipt['identity']['sessionId']],
                         'Independent exact-byte native recovery journal', timeout=60)
        return {'source': {'path': str(target), 'bytes': len(raw), 'sha256': digest(raw)},
                'nativeSave': event, 'recovery': [{'metadata': metadata, 'path': path} for metadata, path in matches]}

    def open_named(target, raw, store, label):
        d.click('Open Fountain', actions=True); d.picker(target); ready()
        saved = save(target, raw, store)
        d.wait(lambda: NOTICE in (panel() or ''), 'Visible same-disk backup warning')
        d.set_input('Snapshot name', label)
        d.wait(lambda: d.script("return [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Keep named snapshot'&&!b.disabled);"), 'Named snapshot publication ready')
        start = mark(); d.click('Keep named snapshot')
        event = reply('create_snapshot', start)
        assert event['ok'] and event['result'], event
        record = event['result']['record']
        assert record['kind'] == 'named' and record['name'] == label
        assert record['sourceSha256'] == digest(raw) and record['byteLength'] == len(raw)
        assert record['documentId'] == saved['nativeSave']['result']['identity']['documentId']
        d.wait(lambda: 'Named snapshot protected' in (panel() or ''), 'Visible native named snapshot receipt')
        directory = store / 'snapshots' / record['documentId']
        assert directory.is_dir() and directory.is_relative_to(store)
        envelope = json.loads((directory / (record['snapshotId'] + '.json')).read_bytes())
        assert envelope['record'] == record
        assert envelope['recordSha256'] == digest(compact(envelope['record']))
        assert event['result']['selection']['recordSha256'] == envelope['recordSha256']
        assert (directory / (digest(raw) + '.fountain')).read_bytes() == raw
        ready()
        return saved, event, directory

    try:
        case = {'case': 'retention-and-orphan-attention'}
        report['cases'].append(case)
        target = d.ROOT / 'files' / 'snapshot-retention.fountain'
        raw = b'!Retention source.\r\n'
        private_file(target, raw)
        store = d.ROOT / 'data' / 'app.babel.screenwriter'
        saved, published, directory = open_named(target, raw, store, 'UI retained named draft')
        case.update(initialSave=saved, nativeNamedPublication=published, snapshotStore=str(directory))
        # WebDriver object transport does not preserve JS property order.
        # The native disk envelope owns the canonical serialized record order.
        template = json.loads((directory / (published['result']['record']['snapshotId'] + '.json')).read_bytes())['record']
        now = int(time.time())
        old = now - 40 * 86400
        safety = b'!Synthetic protected pre-destructive bytes.\r\n'
        fixtures = [
            seed(directory, template, 'expired-unique-a', b'!Synthetic expired unique A.\n', old),
            seed(directory, template, 'expired-unique-b', b'!Synthetic expired unique B.\n', old + 1),
            seed(directory, template, 'expired-shared-native-named', raw, old + 2),
            seed(directory, template, 'protected-old-named', b'!Synthetic named protected.\n', old + 3,
                 'named', 'Synthetic old named protection'),
            seed(directory, template, 'protected-old-preDestructive', safety, old + 4, 'preDestructive'),
            seed(directory, template, 'expired-shared-preDestructive', safety, old + 5),
            seed(directory, template, 'future-clock-protected', b'!Synthetic future clock.\n', now + 86400),
            seed(directory, template, 'newest-record-protected', b'!Synthetic newest record.\n', now + 2 * 86400),
        ]
        sync_directory(directory)
        case['syntheticFixtures'] = fixtures
        case['newestFixtureAlsoFuture'] = True
        before = files(directory)
        catalog = refresh()
        assert not catalog['needsAttention'] and catalog['orphanBlobs'] == 0
        expected_ids = {path.removesuffix('.json') for path in before if path.endswith('.json')}
        assert {entry['record']['snapshotId'] for entry in catalog['entries']} == expected_ids
        case.update(beforeFiles=before, beforeCatalog=catalog)
        screenshot('snapshot-retention-before')
        start = mark(); d.click('Apply retention')
        pruned = reply('prune_snapshots', start)
        assert pruned['ok'] and not pruned['result']['needsAttention'], pruned
        d.wait(lambda: COMPLETE in (panel() or ''), 'Visible successful retention receipt')
        removed = {fixture['record']['snapshotId'] + '.json' for fixture in fixtures
                   if fixture['label'].startswith('expired-')}
        removed.update(fixture['record']['sourceSha256'] + '.fountain' for fixture in fixtures
                       if fixture['label'].startswith('expired-unique-'))
        expected = {name: fact for name, fact in before.items() if name not in removed}
        after = files(directory)
        assert after == expected, 'Retention exact file set/identities/digests differs'
        assert {entry['record']['snapshotId'] + '.json' for entry in pruned['result']['entries']} == {
            name for name in expected if name.endswith('.json')}
        d.audit(target, raw)
        assert recovery_records(store / 'recovery', template['documentId'])
        case.update(nativePrune=pruned, afterFiles=after, expectedDeletedFiles=sorted(removed),
                    retainedFileOracle='Exact names, bytes, digest, device, inode, permissions and owner unchanged',
                    sameDiskNotice=NOTICE)
        screenshot('snapshot-retention-completed')

        # An orphan blob is a legitimate possible state after record deletion and
        # before blob deletion. We add one, rather than pretending UI caused a kill.
        orphan = b'!Synthetic orphan simulating interrupted post-record-prune state.\n'
        orphan_path = directory / (digest(orphan) + '.fountain')
        private_file(orphan_path, orphan); sync_directory(directory)
        orphan_before = files(directory)
        attention_catalog = refresh()
        assert attention_catalog['needsAttention'] and attention_catalog['orphanBlobs'] == 1
        assert attention_catalog['unresolvedArtifacts'] == 0
        d.wait(lambda: ATTENTION in (panel() or '') and 'Pruning is blocked' in (panel() or ''),
               'Visible orphan inspection warning and blocked prune')
        assert d.script("return [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Apply retention')?.disabled;") is True
        assert files(directory) == orphan_before, 'Refresh automatically repaired orphan material'
        screenshot('snapshot-retention-orphan-attention')
        ready(); d.editor_home(); d.type_text('Edited with orphan. ')
        changed = b'!Edited with orphan. Retention source.\r\n'
        orphan_save = save(target, changed, store, saved['nativeSave']['result']['identity'])
        assert files(directory) == orphan_before, 'Ordinary Save changed snapshot attention material'
        assert ATTENTION in (panel() or '') and NOTICE in (panel() or '')
        case['orphan'] = {'provenance': 'synthetic post-record-prune orphan simulation; no actual interruption claim',
                          'path': str(orphan_path), 'sha256': digest(orphan), 'bytes': len(orphan),
                          'catalog': attention_catalog, 'beforeFiles': orphan_before,
                          'afterIndependentSaveFiles': files(directory), 'independentSave': orphan_save,
                          'applyRetentionDisabled': True, 'automaticRepairObserved': False}
        screenshot('snapshot-retention-orphan-save')
        d.close_session(); d.audit(target, changed)

        low = {'case': 'native-low-space-prune-refusal'}
        report['cases'].append(low)
        value = os.environ.get('BABEL_RETENTION_LOW_SPACE_ROOT')
        assert value, 'Parent must mount a private 48MiB tmpfs and set BABEL_RETENTION_LOW_SPACE_ROOT'
        low_root = Path(value)
        assert low_root.is_absolute()
        low_root = low_root.resolve(strict=True)
        assert low_root.is_dir(), 'Parent-owned directory on a private pre-mounted tmpfs required'
        info = low_root.stat()
        assert info.st_uid == os.geteuid() and stat.S_IMODE(info.st_mode) == 0o700
        fs = os.statvfs(low_root)
        capacity = fs.f_blocks * fs.f_frsize
        available = fs.f_bavail * fs.f_frsize
        mounts = [line.split() for line in Path('/proc/self/mountinfo').read_text().splitlines()]
        enclosing = [fields for fields in mounts if low_root.is_relative_to(Path(fields[4]))]
        mount = max(enclosing, key=lambda fields: len(Path(fields[4]).parts), default=None)
        assert mount and mount[mount.index('-') + 1] == 'tmpfs', 'Private tmpfs required, not global /tmp capacity'
        assert Path(mount[4]) != Path('/tmp'), 'Never consume global /tmp capacity'
        assert capacity == 48 * 1024 * 1024 and available < 64 * 1024 * 1024
        assert low_root.stat().st_dev != d.ROOT.stat().st_dev, 'Main driver profile must stay on a spacious normal filesystem'
        assert os.statvfs(d.ROOT).f_bavail * os.statvfs(d.ROOT).f_frsize >= 64 * 1024 * 1024
        project = low_root / ('ui-managed-' + str(uuid.uuid4()))
        project.mkdir(mode=0o700)
        aux = project / '.screenwriter'; aux.mkdir(mode=0o700)
        target = project / 'source.fountain'
        raw = b'!Low space source.\r\n'
        private_file(target, raw)
        project_id = str(uuid.uuid4())
        metadata = {'schemaVersion': 1, 'projectId': project_id,
                    'sourceFilename': target.name, 'pdfProfile': 'us-letter-draft'}
        private_file(aux / 'project.json', compact(metadata))
        low.update(root=str(low_root), managedProjectMetadata={'provenance': 'synthetic managed-project fixture',
                   'path': str(aux / 'project.json'), 'value': metadata},
                   mountInfo=' '.join(mount), capacityBytes=capacity, initialAvailableBytes=available,
                   nativePruneMinimumAvailableBytes=64 * 1024 * 1024)
        saved, published, directory = open_named(target, raw, aux, 'UI low-space named draft')
        assert published['result']['record']['documentId'] == project_id
        assert directory.stat().st_dev == target.stat().st_dev == low_root.stat().st_dev
        assert (aux / 'recovery').stat().st_dev == low_root.stat().st_dev
        low.update(initialSave=saved, nativeNamedPublication=published, snapshotStore=str(directory))
        template = json.loads((directory / (published['result']['record']['snapshotId'] + '.json')).read_bytes())['record']
        fixture = seed(directory, template, 'expired-low-space-unique',
                       b'!Synthetic expired low-space candidate.\n', int(time.time()) - 40 * 86400)
        sync_directory(directory)
        catalog = refresh()
        assert not catalog['needsAttention'] and not catalog['atLimit']
        before = files(directory)
        space = os.statvfs(directory)
        prune_available = space.f_bavail * space.f_frsize
        assert prune_available < 64 * 1024 * 1024
        low.update(syntheticFixtures=[fixture], beforeCatalog=catalog, beforeFiles=before,
                   availableBytesBeforePrune=prune_available)
        start = mark(); d.click('Apply retention')
        refused = reply('prune_snapshots', start)
        assert refused['ok'] is False and refused['error'] == {'code': 'snapshotNeedsAttention', 'action': 'retry'}, refused
        d.wait(lambda: FAILURE in (panel() or ''), 'Visible native low-space retention refusal')
        assert 'Existing source and recovery status remain separate.' in panel()
        assert NOTICE in panel()
        assert files(directory) == before, 'Low-space prune mutated snapshot files'
        d.audit(target, raw)
        low.update(nativePruneRefusal=refused, refusalPanelText=panel(), afterRefusalFiles=files(directory))
        screenshot('snapshot-retention-low-space-refusal')
        ready(); d.editor_home(); d.type_text('Still saves. ')
        changed = b'!Still saves. Low space source.\r\n'
        low['independentSave'] = save(target, changed, aux, saved['nativeSave']['result']['identity'])
        assert files(directory) == before, 'Independent low-space Save changed retained snapshots'
        assert refresh() == catalog, 'Refusal or source Save altered native snapshot catalog'
        low.update(afterIndependentSaveFiles=files(directory), afterIndependentSaveCatalog=catalog)
        screenshot('snapshot-retention-low-space-save')
        d.close_session(); d.audit(target, changed)
        assert files(directory) == before
        report['passed'] = True
        print('PASS native UI exact retention / shared protected blobs / orphan inspection without repair / typed <64MiB refusal / independent source and recovery Save', flush=True)
    finally:
        report['nativeCommands'] = events()
        (d.ROOT / 'snapshot-retention-result.json').write_text(json.dumps(report, indent=2) + '\n')
        d.script('window.fetch=window.retentionOriginalFetch;')
        print('ARTIFACTS', d.ROOT, flush=True)
