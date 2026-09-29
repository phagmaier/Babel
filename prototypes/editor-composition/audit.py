"""Independent byte/receipt/origin audit of the completed native logs and literal fixtures."""
import hashlib
import json
from pathlib import Path

proof = Path(__file__).resolve().parent
base = 'INT. TEST LAB - DAY #1#\n\nA lamp glows beside Zoë.\n\n@Mira\nWait for the signal.\n\n{{opaque: keep  two spaces}}\n\n'
expected = base.replace('A lamp glows beside Zoë.', '!A lamp glows beside Zoë. é🚀')
for name, original, edited in [('lf', base.encode(), expected.encode()),
        ('crlf', b'\xef\xbb\xbf'+base.replace('\n','\r\n').encode(), b'\xef\xbb\xbf'+expected.replace('\n','\r\n').encode()),
        ('no-final-newline', base.rstrip('\n').encode(), expected.rstrip('\n').encode())]:
    assert (proof/'fixtures'/f'{name}.fountain').read_bytes() == original
    assert (proof/'fixtures'/f'{name}-edited.fountain').read_bytes() == edited
    log = Path('/tmp/babel-m1-06-native-webview-final.log' if name == 'lf' else f'/tmp/babel-m1-06-matrix-{name}.log')
    reports = [json.loads(line.split(' ',1)[1]) for line in log.read_text().splitlines() if line.startswith('M1_COMPOSITION_PROOF ')]
    saved = [r for r in reports if r['event'] == 'saved']
    for report, oracle in [(saved[0], original), (saved[-1], edited)]:
        receipt = report['detail']
        assert report['nativeHost'] and 'AppleWebKit' in report['userAgent']
        assert bytes(report['snapshot']['source']) == oracle
        assert receipt['identity'] == receipt['recovery']['identity'] == report['identity']
        assert receipt['version'] == receipt['recovery']['version'] == report['snapshot']['version']
        assert receipt['sourceSha256'] == receipt['recovery']['sourceSha256'] == receipt['fingerprint']['sha256'] == hashlib.sha256(oracle).hexdigest()
        assert receipt['fingerprint']['byteLength'] == len(oracle)
        assert receipt['protection'] == 'sourceFile' and receipt['recovery']['protection'] == 'recoveryCheckpoint'
    reopened = [r for r in reports if r['event'] == 'reopened'][-1]
    assert bytes(reopened['detail']['nativeSource']) == edited
    kinds = ['sceneHeading','blank','action','blank','character','dialogue','blank','raw']
    if name != 'no-final-newline': kinds.append('blank')
    assert [line['kind'] for line in saved[-1]['snapshot']['semantics']] == kinds
    bom_length = 3 if name == 'crlf' else 0
    start = bom_length
    ranges = []
    for line in edited[bom_length:].splitlines(keepends=True):
        ranges.append({'from': start, 'to': start+len(line)})
        start += len(line)
    assert saved[-1]['snapshot']['ranges'] == ranges
    caret = saved[-1]['snapshot']['selection']['head']
    text = 'A lamp glows beside Zoë. é🚀'
    assert caret['id'] == 'line-2' and caret['utf16Offset'] == len(text.encode('utf-16-le'))//2
    assert caret['byteOffset'] == edited.index(b'!A lamp') + 1 + len(text.encode())
    print(f'Passed: {name} literal bytes, typed semantics/ranges, Unicode anchor, exact native identity/version/hash/length/receipts and reopen')
print('All independent native audits passed')
