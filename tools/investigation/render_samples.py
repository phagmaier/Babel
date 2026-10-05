#!/usr/bin/env python3
"""Render JSON samples with the verified bundled helper and report what prints.

Investigation only. Reads [{"id", "source"}] on stdin. For every sample it
writes the source bytes, the PDF, the helper receipt and stderr, and Poppler's
layout text and XML into the existing directory named by the first argument.
Each file is created exclusively, so a directory serves one run. Prints one
JSON report; it never writes outside that directory.
"""
import json
import os
import subprocess
import sys
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/pdf-helper'))
import verify_runtime  # noqa: E402

# The pinned parser's own reading in the shape tools/pdf-helper/test_helper.py
# states it, with title values and the lines the profile will print as lyrics.
READING = r'''
import sys, json
sys.path[:0] = [sys.argv[1], sys.argv[2]]
import frozen_profile as f
from screenplain import types as t
s = f.parse(sys.stdin.buffer.read().decode('utf-8-sig'))
title = {key: [str(value) for value in values] for key, values in s.title_page.items()}
lyrics = [list(getattr(p, 'lyric_indices', ())) for p in s]
f.prepare(s)
speech = lambda d: [str(d.character), [[p, str(x)] for p, x in d.blocks]]
def row(p):
    if isinstance(p, t.DualDialog): return ['DualDialog', speech(p.left), speech(p.right)]
    if isinstance(p, t.Dialog): return ['Dialog', *speech(p)]
    if isinstance(p, t.Action):
        return ['Centered' if p.centered else 'Action', [str(x) for x in p.lines]]
    if isinstance(p, t.Slug):
        return ['Slug', str(p.line), *([str(p.scene_number)] if p.scene_number else [])]
    if isinstance(p, t.Transition): return ['Transition', str(p.line)]
    if isinstance(p, t.Section): return ['Section', str(p.text), p.level]
    return [type(p).__name__]
print(json.dumps({'title': title, 'paragraphs': [row(p) for p in s], 'lyrics': lyrics}))
'''


def create(path, data):
    with path.open('xb') as handle:
        handle.write(data)


def printed_lines(xml):
    """Each text run Poppler finds: page, left edge in points, face and text.

    Poppler drops the style from the family name and wraps styled text in
    <i>/<b>, so the face is read from those elements.
    """
    lines = []
    for page in ElementTree.fromstring(xml).iter('page'):
        scale = 612 / float(page.get('width'))
        for text in page.iter('text'):
            lines.append({'page': int(page.get('number')),
                          'left': round(float(text.get('left')) * scale),
                          'italic': text.find('.//i') is not None,
                          'bold': text.find('.//b') is not None,
                          'text': ''.join(text.itertext())})
    return lines


def embedded_fonts(pdf):
    listing = subprocess.run(['pdffonts', str(pdf)], capture_output=True, text=True,
                             check=True).stdout.splitlines()[2:]
    return sorted(line.split()[0].split('+')[-1] for line in listing if line.strip())


def main():
    out = Path(sys.argv[1]).resolve()
    if not out.is_dir():
        raise SystemExit('the output root must be an existing directory')
    runtime = Path(os.environ.get('BABEL_PDF_HELPER_RUNTIME',
                                  ROOT / 'target/pdf-helper/runtime')).resolve()
    report = verify_runtime.verify(runtime, exact=True)
    if report['problems']:
        raise SystemExit(json.dumps(report['problems']))
    python = [str(runtime / 'python/bin/python3.13'), '-I', '-S', '-B']
    results = []
    for sample in json.load(sys.stdin):
        name = sample['id']
        source = sample['source'].encode('utf-8')
        create(out / f'{name}.fountain', source)
        pdf = out / f'{name}.pdf'
        request = {'protocol': 1, 'profile': 'us-letter-draft-v1', 'output': str(pdf)}
        helper = subprocess.run([*python, str(runtime / 'app/babel_pdf_helper.py'),
                                 json.dumps(request)], input=source, capture_output=True,
                                env={'PATH': '/nonexistent', 'LANG': 'C'}, timeout=90)
        create(out / f'{name}.receipt.json', helper.stdout)
        create(out / f'{name}.stderr.log', helper.stderr)
        reading = subprocess.run([*python, '-c', READING, str(runtime / 'app'),
                                  str(runtime / 'app/lib')], input=source,
                                 capture_output=True, check=True, timeout=90)
        result = {'id': name, 'exit': helper.returncode,
                  'receipt': json.loads(helper.stdout or b'null'),
                  'parser': json.loads(reading.stdout), 'text': '', 'lines': [], 'fonts': []}
        if helper.returncode == 0:
            layout = subprocess.run(['pdftotext', '-layout', str(pdf), '-'],
                                    capture_output=True, check=True).stdout
            create(out / f'{name}.txt', layout)
            # The helper's own tests compare collapsed raw text the same way.
            raw = subprocess.run(['pdftotext', '-raw', str(pdf), '-'], capture_output=True,
                                 text=True, check=True).stdout
            xml = subprocess.run(['pdftohtml', '-xml', '-i', '-stdout', str(pdf)],
                                 capture_output=True, check=True).stdout
            create(out / f'{name}.xml', xml)
            result['text'] = ' '.join(raw.split())
            result['lines'] = printed_lines(xml)
            result['fonts'] = embedded_fonts(pdf)
        results.append(result)
    json.dump({'runtime': report['treeSha256'], 'samples': results}, sys.stdout)


if __name__ == '__main__':
    main()
