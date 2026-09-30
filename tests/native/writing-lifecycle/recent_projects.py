"""M4-01 default-release WebKit IPC + real GTK pickers on synthetic files.
Home presentation remains M4-02. This driver adds no runtime/debug capability.
"""
import hashlib
import json


def run(h):
    sequence = 0

    def begin(command, request):
        nonlocal sequence
        sequence += 1
        token = sequence
        h.script("""const [cmd,req,token]=arguments;
          window.recentProbeResults??={};
          window.__TAURI_INTERNALS__.invoke(cmd,{request:req}).then(
            value=>window.recentProbeResults[token]={ok:true,value},
            error=>window.recentProbeResults[token]={ok:false,error});""", [command, request, token])
        return token

    def result(token, success=True):
        r = h.wait(lambda: h.script('return window.recentProbeResults?.[arguments[0]];', [token]), 'Native recent response')
        assert r['ok'] == success, r
        return r.get('value') if success else r['error']

    def invoke(command, request=None, success=True):
        return result(begin(command, request or {}), success)

    def pick(command, request, path=None):
        token = begin(command, request)
        h.picker(path)
        return result(token)

    def recents():
        return invoke('list_recent_projects')

    def release(opened):
        invoke('release_open_document', opened['identity'])

    assert recents() == {'entries': [], 'health': 'ready'}
    draft = invoke('create_unsaved_draft')
    raw = b'raw draft\r\n'
    checkpoint = {'identity': draft['identity'], 'version': 1, 'source': list(raw),
                  'sourceSha256': hashlib.sha256(raw).hexdigest(), 'expectedFingerprint': None,
                  'draftMetadata': {'synthetic': True}}
    invoke('checkpoint_document', checkpoint)
    assert recents()['entries'] == []
    release(draft)
    assert pick('open_source_via_picker', {}, None) is None
    assert recents()['entries'] == []

    source = h.ROOT / 'files' / 'exact.fountain'
    expected = b'\xef\xbb\xbfINT. ROOM - DAY\r\n  meaningful  \r\n'
    source.write_bytes(expected)
    source.chmod(0o600)
    opened = pick('open_source_via_picker', {}, source)
    assert bytes(opened['source']) == expected
    release(opened)
    entry = recents()['entries'][0]
    original_id = opened['identity']['documentId']
    assert entry['documentId'] == original_id and entry['availability'] == 'available'
    assert entry['fileName'] == source.name and 'path' not in entry and 'pageCount' not in entry
    before = recents()
    assert pick('locate_recent_project', {'entryId': entry['entryId']}, None) is None
    assert recents() == before
    injected = invoke('open_recent_project', {'entryId': entry['entryId'], 'path': str(source)}, False)
    assert injected  # strict decoding refuses extra path; serde text is not a source receipt
    again = invoke('open_recent_project', {'entryId': entry['entryId']})
    assert bytes(again['document']['source']) == expected
    assert again['document']['identity']['documentId'] == original_id
    release(again['document'])
    assert len(recents()['entries']) == 1

    # Restart before locating: stable on-disk entry, fresh opaque session.
    h.command('DELETE', '')
    h.SESSION = None
    h.new_session()
    sequence = 0
    assert recents()['entries'][0]['entryId'] == entry['entryId']
    moved = h.ROOT / 'files' / 'moved.fountain'
    source.rename(moved)
    assert recents()['entries'][0]['availability'] == 'missing'
    failure = invoke('open_recent_project', {'entryId': entry['entryId']}, False)
    assert failure['code'] == 'missingSource' and str(h.ROOT) not in json.dumps(failure)
    selection = pick('locate_recent_project', {'entryId': entry['entryId']}, moved)
    assert selection['contentMatchesLastKnown'] and selection['canLinkMoved']
    assert recents()['entries'][0]['fileName'] == source.name
    linked = invoke('confirm_recent_location', {'entryId': entry['entryId'], 'selectionToken': selection['selectionToken'], 'choice': 'linkMoved'})
    assert linked['document']['identity']['documentId'] == original_id
    assert linked['document']['ownership']['status'] == 'exclusive'
    assert bytes(linked['document']['source']) == expected and moved.read_bytes() == expected
    release(linked['document'])
    entry = recents()['entries'][0]
    assert entry['fileName'] == moved.name and entry['availability'] == 'available'

    readonly = h.ROOT / 'files' / 'readonly.fountain'
    readonly.write_bytes(b'INT. ELSEWHERE - NIGHT\n')
    readonly.chmod(0o400)
    selection = pick('locate_recent_project', {'entryId': entry['entryId']}, readonly)
    assert not selection['contentMatchesLastKnown'] and not selection['canLinkMoved']
    different = invoke('confirm_recent_location', {'entryId': entry['entryId'], 'selectionToken': selection['selectionToken'], 'choice': 'openDifferent'})
    assert different['document']['ownership']['status'] == 'viewOnly'
    assert different['document']['identity']['documentId'] != original_id
    release(different['document'])
    assert len(recents()['entries']) == 2
    assert moved.read_bytes() == expected

    # Native Save As cancel/rollback/success with an unsaved registration.
    draft = invoke('create_unsaved_draft')
    assert pick('select_save_destination', draft['identity'], None) is None
    before = recents()
    target = h.ROOT / 'files' / 'rollback.fountain'
    destination = pick('select_save_destination', draft['identity'], target)
    target.write_bytes(b'external occupant\n')
    target.chmod(0o600)
    checkpoint = {'identity': draft['identity'], 'version': 1, 'source': list(raw),
                  'sourceSha256': hashlib.sha256(raw).hexdigest(), 'expectedFingerprint': None, 'draftMetadata': None}
    assert invoke('save_as_copy', {'checkpoint': checkpoint, 'destinationToken': destination['token']}, False)['code'] == 'invalidDestination'
    assert recents() == before and target.read_bytes() == b'external occupant\n'
    target = h.ROOT / 'files' / 'published.fountain'
    destination = pick('select_save_destination', draft['identity'], target)
    saved = invoke('save_as_copy', {'checkpoint': checkpoint, 'destinationToken': destination['token']})
    assert target.read_bytes() == raw
    assert recents()['entries'][0]['documentId'] == saved['document']['identity']['documentId']
    release(saved['document'])
    release(draft)

    # Remove deletes only auxiliary metadata; the selected source survives.
    readonly_entry = next(e for e in recents()['entries'] if e['fileName'] == readonly.name)
    invoke('remove_recent_project', {'entryId': readonly_entry['entryId']})
    assert readonly.read_bytes() == b'INT. ELSEWHERE - NIGHT\n'
    assert not any(e['entryId'] == readonly_entry['entryId'] for e in recents()['entries'])

    # Corrupt latest registry generation: previous remains usable, removal refuses,
    # and source entry/recovery still work without an invented registry success.
    store = h.ROOT / 'data' / 'app.babel.screenwriter'
    slots = [p for p in store.glob('recents-*.json')]
    generations = [(json.loads(p.read_bytes())['generation'], p) for p in slots]
    generations.sort()
    previous_bytes = generations[-2][1].read_bytes()
    latest = generations[-1][1]
    latest.write_bytes(b'{truncated')
    assert recents()['health'] == 'needsAttention'
    remaining = recents()['entries'][0]
    assert invoke('remove_recent_project', {'entryId': remaining['entryId']}, False)['code'] == 'recentNeedsAttention'
    raw_open = pick('open_source_via_picker', {}, moved)
    assert bytes(raw_open['source']) == expected
    cp = {'identity': raw_open['identity'], 'version': 1, 'source': list(expected),
          'sourceSha256': hashlib.sha256(expected).hexdigest(), 'expectedFingerprint': raw_open['fingerprint'], 'draftMetadata': None}
    invoke('checkpoint_document', cp)
    saved_source = invoke('save_document', cp)
    assert saved_source['protection'] == 'sourceFile' and saved_source['version'] == 1
    assert saved_source['sourceSha256'] == hashlib.sha256(expected).hexdigest()
    release(raw_open)
    assert generations[-2][1].read_bytes() == previous_bytes and latest.read_bytes() == b'{truncated'
    assert moved.read_bytes() == expected
    h.command('DELETE', '')
    h.SESSION = None
    h.new_session()
    sequence = 0
    assert recents()['health'] == 'needsAttention'
    assert moved.read_bytes() == expected
    print('PASS default-release WebKit recent IPC / real picker cancel / restart / moved identity / readonly mismatch / Save As rollback / registry isolation', flush=True)
    print('ARTIFACTS', h.ROOT, flush=True)
