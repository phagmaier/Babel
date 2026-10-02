"""Frozen-profile corpus oracle. Requires inspection-only pypdf==6.19.0 + Poppler.

Normal runs compare accepted layout and PNG goldens. --candidates writes only
under the output directory: adopting a golden requires literal and visual review.
Runtime environment override also permits testing an extracted AppImage offline.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import time
import xml.etree.ElementTree as ET

from pypdf import PdfReader
from pypdf.generic import ContentStream

REPO = Path(__file__).resolve().parents[2]
CORPUS = REPO / 'fixtures/publication'
PROFILE = 'us-letter-draft-v1'


def command(args):
    return subprocess.run(args, capture_output=True, check=True).stdout


def render(runtime, source, output):
    started = time.perf_counter()
    result = subprocess.run([str(runtime / 'python/bin/python3.13'), '-I', '-S', '-B',
                             str(runtime / 'app/babel_pdf_helper.py'),
                             json.dumps({'protocol': 1, 'profile': PROFILE, 'output': str(output)})],
                            input=source, capture_output=True, timeout=75,
                            env={'PATH': '/nonexistent', 'LANG': 'C'})
    report = json.loads(result.stdout)
    assert report['ok'] == (result.returncode == 0), (report, result.stderr)
    return report, round((time.perf_counter() - started) * 1000)


def inspect(path):
    reader = PdfReader(path)
    text = []
    positions = []
    fonts = set()
    for page in reader.pages:
        assert tuple(float(x) for x in page.mediabox) == (0, 0, 612, 792)
        resources = page['/Resources']['/Font']
        for font in resources.values():
            font = font.get_object()
            name = str(font['/BaseFont']).split('+')[-1]
            assert name.startswith('CourierPrime'), name
            assert '/FontFile2' in font['/FontDescriptor'].get_object(), name
            fonts.add(name)
            cmap = font['/ToUnicode'].get_object().get_data().decode('ascii')
            assert all(int(n) <= 100 for n in re.findall(r'(\d+) beginbfchar', cmap)), name
        for operands, operator in ContentStream(page.get_contents(), reader).operations:
            if operator == b'Tf':
                assert str(resources[operands[0]]['/BaseFont']).split('+')[-1].startswith('CourierPrime')
                assert float(operands[1]) in (12, 24), operands
        chunks = []
        def visit(value, cm, tm, font, size):
            if value.strip():
                # All patch flowables translate, never rotate/shear/scale.
                x, y = tm[4] + cm[4], tm[5] + cm[5]
                chunks.append({'text': value.strip(), 'x': round(x, 3), 'y': round(y, 3), 'size': float(size)})
        text.append(page.extract_text(visitor_text=visit))
        positions.append(chunks)
    bbox = command(['pdftotext', '-bbox-layout', str(path), '-'])
    root = ET.fromstring(bbox)
    ns = {'x': 'http://www.w3.org/1999/xhtml'}
    words = []
    for page in root.findall('.//x:page', ns):
        row = []
        for word in page.findall('.//x:word', ns):
            box = {key: round(float(word.attrib[key]), 3) for key in ('xMin', 'yMin', 'xMax', 'yMax')}
            assert 0 <= box['xMin'] < box['xMax'] <= 612.01, (path, word.text, box)
            assert 0 <= box['yMin'] < box['yMax'] <= 792.01, (path, word.text, box)
            row.append({'text': word.text, **box})
        words.append(row)
    return {'text': text, 'positions': positions, 'words': words, 'fonts': sorted(fonts)}


def oracle(case, report, layout):
    expected = case['expected']
    assert report['profile'] == PROFILE and report['profileFrozen'] is True
    assert report['sourceMap'] == 'unsupported'
    assert report['pageCount'] == len(layout['text']) == expected['pages'], case['id']
    alltext = '\n'.join(layout['text'])
    for value in expected.get('present', []): assert value in alltext, (case['id'], value)
    for value in expected.get('absent', []): assert value not in alltext, (case['id'], value)
    for value in expected.get('unwrapped', []): assert value in re.sub(r'\s+', '', alltext), value
    offsets = []
    for value in expected.get('tokens', []):
        assert alltext.count(value) == 1, (case['id'], value, alltext.count(value))
        offsets.append(alltext.index(value))
    assert offsets == sorted(offsets)
    for key, marker in [('more', '(MORE)'), ('continued', "(CONT'D)")]:
        if key in expected: assert alltext.count(marker) == expected[key], case['id']
    chunks = [chunk for page in layout['positions'] for chunk in page]
    for value, coordinates in expected.get('at', {}).items():
        chunk = next(c for c in chunks if c['text'] == value)
        for axis, target in coordinates.items(): assert abs(chunk[axis] - target) < .01, (value, chunk)
    if 'fontFaces' in expected: assert len(layout['fonts']) == expected['fontFaces']
    for page in expected.get('noNumberPages', []):
        assert not any(c['y'] == 750 for c in layout['positions'][page - 1])
    for page, number in expected.get('numbered', {}).items():
        assert any(c['text'] == number and c['y'] == 750 for c in layout['positions'][int(page) - 1])
    if 'samePage' in expected:
        assert any(all(t in p for t in expected['samePage']) for p in layout['text'])
    if 'aligned' in expected:
        assert len({next(c['y'] for c in chunks if c['text'] == t) for t in expected['aligned']}) == 1
    if expected.get('parentheticalsAttached'):
        for page in layout['positions']:
            body = [c for c in page if c['y'] != 750]
            for i, chunk in enumerate(body):
                if chunk['text'].startswith('(') and chunk['text'] != '(MORE)':
                    assert i + 1 < len(body) and body[i + 1]['text'].startswith('Speech row'), body
    if 'unsupported' in expected:
        assert {w['code'] for w in report['warnings']} == {'unsupported-publication:' + f for f in expected['unsupported']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=REPO / 'target/m5-03/profile-test')
    parser.add_argument('--candidates', action='store_true')
    args = parser.parse_args()
    runtime = Path(os.environ.get('BABEL_PDF_HELPER_RUNTIME', REPO / 'target/pdf-helper/runtime')).resolve()
    args.output = args.output.resolve()
    args.output.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((CORPUS / 'manifest.json').read_text())
    if not args.candidates:
        review = json.loads((CORPUS / 'review.json').read_text())
        assert hashlib.sha256((runtime / 'app/profiles/us-letter-draft-v1.json').read_bytes()).hexdigest() == review['profileSha256']
        assert json.loads((runtime / 'BUILD.json').read_text())['treeSha256'] == review['runtimeTreeSha256']
        for name, digest in review['goldens'].items():
            assert hashlib.sha256((CORPUS / 'goldens' / name).read_bytes()).hexdigest() == digest, name
    pages = 0
    for case in manifest['cases']:
        source = (CORPUS / case['file']).read_bytes()
        digest = hashlib.sha256(source).hexdigest()
        assert digest == case['sourceSha256'], case['id']
        path = args.output / (case['id'] + '.pdf')
        report, ms = render(runtime, source, path)
        if 'error' in case['expected']:
            assert not report['ok'] and report['error']['code'] == case['expected']['error'], report
            assert report['error']['message'].endswith('unsupported-publication:' + case['expected']['feature']), report
            assert not path.exists()
        else:
            assert report['ok'], report
            assert report['sourceSha256'] == digest and report['sourceBytes'] == len(source)
            assert oct(path.stat().st_mode & 0o777) == '0o600'
            info = command(['pdfinfo', str(path)]).decode()
            assert re.search(r'Pages:\s+' + str(case['expected']['pages']) + r'\b', info)
            layout = inspect(path)
            oracle(case, report, layout)
            second = args.output / (case['id'] + '-repeat.pdf')
            again, _ = render(runtime, source, second)
            assert again['ok'] and inspect(second) == layout, case['id']
            command(['pdftoppm', '-r', '72', '-png', str(path), str(args.output / case['id'])])
            images = sorted(args.output.glob(case['id'] + '-[0-9]*.png'))
            repeat_prefix = str(args.output / (case['id'] + '-repeat'))
            command(['pdftoppm', '-r', '72', '-png', str(second), repeat_prefix])
            for img in images:
                repeated = args.output / img.name.replace(case['id'] + '-', case['id'] + '-repeat-', 1)
                assert img.read_bytes() == repeated.read_bytes(), 'raster nondeterminism: ' + img.name
            pages += len(images)
            golden = args.output / (case['id'] + '.json') if args.candidates else CORPUS / 'goldens' / (case['id'] + '.json')
            encoded = json.dumps(layout, ensure_ascii=False, indent=2) + '\n'
            if args.candidates: golden.write_text(encoded)
            else:
                assert json.loads(golden.read_text()) == layout, 'layout changed: ' + case['id']
                for img in images:
                    assert img.read_bytes() == (CORPUS / 'goldens' / img.name).read_bytes(), 'image changed: ' + img.name
        assert (CORPUS / case['file']).read_bytes() == source
        print(f"{case['id']}: PASS {ms}ms {'refusal' if not report['ok'] else str(report['pageCount']) + ' pages'}", flush=True)
    # Degenerate and large single Paragraph splits: no shrink, missing bytes or hang.
    extra = [('empty', b'', 1), ('huge-action', ('!' + 'W' * 10000 + '\n').encode(), None),
             ('huge-speech', ('MARA\n' + 'signal ' * 2500 + '\n').encode(), None),
             ('heading-long-speech', ('\n\n'.join('!Prelude.' for _ in range(25)) +
               '\n\n.THE HELD HEADING\n\nMARA\n' + 'signal ' * 2500 + '\n').encode(), None)]
    for name, source, count in extra:
        path = args.output / (name + '.pdf')
        report, ms = render(runtime, source, path)
        assert report['ok'], report
        layout = inspect(path)
        if count: assert len(layout['text']) == count
        text = ''.join(layout['text'])
        if name == 'huge-action': assert text.count('W') == 10000
        if 'speech' in name:
            assert text.count('signal') == 2500
            for page in layout['text']:
                if 'MARA' in page: assert 'signal' in page
            if name.startswith('heading'):
                assert any('THE HELD HEADING' in page and 'signal' in page for page in layout['text'])
        print(f'{name}: PASS {ms}ms {report["pageCount"]} pages', flush=True)
    special = [
        ('asymmetric-dual', b'KIM\n(softly)\nLeft start.\n\nMARA ^\nRight start.\n', ['Left start.', 'Right start.', '(softly)'], []),
        ('terminal-parenthetical', ('MARA\n' + '\n'.join('Speech row %03d.' % i for i in range(1,54)) + '\n(final pause)\n').encode(), ['(final pause)'], []),
        ('repeated-cues', b'MARA\nFirst speech.\n\nMARA\nSecond speech.\n', ['First speech.', 'Second speech.'], []),
        ('literal-lyrics', b'!~Literal marker.\n\n~Lyric marker.\n', ['~Literal marker.', 'Lyric marker.'], ['~Lyric']),
        ('giant-heading', ('.' + 'H' * 10000 + ' #9#\n\n!Next action.\n').encode(), ['Next action.'], []),
    ]
    for name, source, present, absent in special:
        report, ms = render(runtime, source, args.output / (name + '.pdf'))
        assert report['ok'], report
        layout = inspect(args.output / (name + '.pdf'))
        text = ''.join(layout['text'])
        for value in present: assert value in text
        for value in absent: assert value not in text
        if name == 'asymmetric-dual':
            chunks = layout['positions'][0]
            assert len({next(c['y'] for c in chunks if c['text'] == t) for t in ['Left start.', 'Right start.']}) == 1
        if name == 'terminal-parenthetical':
            for page in layout['text']:
                if 'MARA' in page: assert 'Speech row' in page
        if name == 'repeated-cues': assert text.count('MARA') == 2 and "(CONT'D)" not in text
        if name == 'giant-heading': assert text.count('H') == 10000
        print(f'{name}: PASS {ms}ms {report["pageCount"]} pages', flush=True)
    refusals = [
        ('oversized-cue', ('@' + 'N' * 3000 + '\nHello.\n').encode(), 'cue-exceeds-page'),
        ('oversized-parenthetical', ('MARA\n(' + 'softly ' * 1000 + ')\nHello.\n').encode(), 'parenthetical-exceeds-page'),
        ('unpaired-dual', b'MARA ^\nHello.\n', 'unpaired-dual-dialogue'),
        ('oversized-scene-number', b'.THE SIGNAL #ZZZZZZZZZZZZ#\n\n!Next action.\n', 'scene-number-width'),
    ]
    for name, source, feature in refusals:
        path = args.output / (name + '.pdf')
        report, ms = render(runtime, source, path)
        assert not report['ok'] and report['error']['code'] == 'render-failed', report
        assert report['error']['message'].endswith('unsupported-publication:' + feature), report
        assert not path.exists()
        print(f'{name}: PASS {ms}ms declared refusal', flush=True)
    print(f'PASS: 13 corpus cases, {pages} reviewed images, 13 boundary checks')


if __name__ == '__main__': main()
