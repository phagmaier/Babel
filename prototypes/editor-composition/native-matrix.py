"""Run owned native proof processes; caller supplies an already running localhost Vite server."""
import hashlib
import json
import os
from pathlib import Path
import struct
import subprocess
import time

repo = Path(__file__).resolve().parents[2]
proof = Path(__file__).resolve().parent
results = []

def reports(log):
    return [json.loads(line.split(' ', 1)[1]) for line in log.read_text().splitlines()
            if line.startswith('M1_COMPOSITION_PROOF ')]

def wait_report(log, event, before):
    end = time.monotonic() + 10
    while time.monotonic() < end:
        for report in reports(log)[before:]:
            if report['event'] == event:
                assert report['nativeHost'] and 'AppleWebKit' in report['userAgent']
                return report
        time.sleep(0.1)
    raise AssertionError(f'No native report for {event}')

def journal(root, identity):
    raw = (root / 'app-data' / 'recovery' / (identity['documentId'] + '.journal')).read_bytes()
    records, start = [], 0
    while start < len(raw):
        assert raw[start:start+8] == b'BBLREC01'
        schema, metadata_length, source_length = struct.unpack_from('<IIQ', raw, start+8)
        assert schema == 1
        end = start + 24 + metadata_length + source_length
        assert hashlib.sha256(raw[start:end]).digest() == raw[end:end+32]
        metadata = json.loads(raw[start+24:start+24+metadata_length])
        source = raw[start+24+metadata_length:end]
        assert hashlib.sha256(source).hexdigest() == metadata['sourceSha256']
        records.append((metadata, source))
        start = end + 32
    assert start == len(raw)
    return records

for name, base, external in [('crlf', '/tmp', False), ('no-final-newline', str(repo), False),
                             ('lf', '/tmp', True), ('crlf', str(repo), True)]:
    seed = json.loads(subprocess.check_output(['python3', str(proof/'seed.py'), base], text=True))
    root = Path(seed['root'])
    label = ('external-' if external else '') + name
    log = Path(f'/tmp/babel-m1-06-matrix-{label}.log')
    env = {**os.environ, 'BABEL_EDITOR_COMPOSITION_ROOT': str(root), 'XDG_DATA_HOME': str(root/'data')}
    with log.open('w') as output:
        child = subprocess.Popen([str(repo/'target/debug/babel-desktop')], cwd=repo, env=env, stdout=output, stderr=subprocess.STDOUT)
        try:
            end = time.monotonic() + 10
            while time.monotonic() < end:
                clients = json.loads(subprocess.check_output(['hyprctl', '-j', 'clients']))
                owned = next((c for c in clients if c.get('pid') == child.pid), None)
                if owned:
                    assert owned['title'] == 'babel M1-06 synthetic composition proof', owned['title']
                    address = owned['address']
                    assert address.startswith('0x') and all(c in '0123456789abcdef' for c in address[2:])
                    subprocess.run(['hyprctl', 'eval', 'hl.dispatch(hl.dsp.focus({window="address:' + address + '"}))'], check=True)
                    active = json.loads(subprocess.check_output(['hyprctl', '-j', 'activewindow']))
                    if active.get('pid') == child.pid:
                        break
                assert child.poll() is None, 'Owned native process exited during startup'
                time.sleep(0.1)
            else: raise AssertionError('Owned proof must have focus; no input sent')
            time.sleep(0.6)
            index = ['lf', 'crlf', 'no-final-newline'].index(name)
            for _ in range(index): subprocess.run(['wtype', '-k', 'F4'], check=True)
            before = len(reports(log))
            subprocess.run(['wtype', '-k', 'F1'], check=True)
            opened = wait_report(log, 'opened', before)
            assert opened['fixture'] == name
            if not external:
                driver_log = Path(f'/tmp/babel-m1-06-native-input-{name}.log')
                with driver_log.open('w') as driver_output:
                    subprocess.run(['python3', str(proof/'native-input.py'), str(log), str(root), name],
                                   cwd=repo, stdout=driver_output, stderr=subprocess.STDOUT, check=True)
                saved = [r for r in reports(log) if r['event'] == 'saved'][-1]
                records = journal(root, saved['identity'])
                assert records[-1][1] == (proof/'fixtures'/f'{name}-edited.fountain').read_bytes()
                assert records[-1][0]['version'] == saved['detail']['version']
                outcome = 'native no-op/edit/selection/undo/redo/save/reopen passed'
            else:
                subprocess.run(['wtype', '-k', 'F7'], check=True)
                subprocess.run(['wtype', '-d', '90', ' é🚀'], check=True)
                time.sleep(0.5)
                destination = root/f'{name}.fountain'
                destination.write_bytes(b'external author bytes\n')
                before = len(reports(log))
                subprocess.run(['wtype', '-k', 'F2'], check=True)
                refused = wait_report(log, 'save-refused', before)
                failure = refused['detail']
                assert failure['error']['code'] == 'sourceChanged'
                assert failure['replacement'] == 'sourceUnchanged'
                assert refused['persistence']['externalChange']
                assert refused['persistence']['fileSavedVersion'] == 0
                expected = (proof/'fixtures'/f'{name}-edited.fountain').read_bytes()
                assert destination.read_bytes() == b'external author bytes\n'
                records = journal(root, refused['identity'])
                assert records[-1][1] == expected
                assert records[-1][0]['version'] == failure['recovery']['version'] == refused['snapshot']['version']
                outcome = 'native external-change refusal; independent source/recovery bytes and checksums passed'
            result = {'case': label, 'root': str(root), 'seed': seed['fixtures'], 'outcome': outcome, 'log': str(log)}
            results.append(result)
            print(json.dumps(result), flush=True)
        finally:
            child.terminate()
            try: child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                child.kill(); child.wait()
Path('/tmp/babel-m1-06-matrix-results.json').write_text(json.dumps(results, indent=2)+'\n')
