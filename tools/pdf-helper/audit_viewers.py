"""Audit already-rendered frozen corpus with independent Poppler/Ghostscript.

Inspection only: no app dependency, renderer or golden modification. Run after
test_profile.py, then visually review all output pages separately.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

REPO = Path(__file__).resolve().parents[2]


def command(args):
    result = subprocess.run(args, capture_output=True, check=True)
    return result.stdout


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('corpus', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=False)
    manifest = json.loads((REPO / 'fixtures/publication/manifest.json').read_text())
    report = []
    for case in manifest['cases']:
        pdf = args.corpus / (case['id'] + '.pdf')
        if 'error' in case['expected']:
            assert not pdf.exists(), case['id']
            continue
        prefix = args.output / case['id']
        result = subprocess.run(['gs', '-q', '-dSAFER', '-dBATCH', '-dNOPAUSE',
            '-sDEVICE=png16m', '-r72', '-sOutputFile=' + str(prefix) + '-%02d.png', str(pdf)], capture_output=True, check=True)
        assert not result.stderr.strip(), (case['id'], result.stderr.decode())
        images = sorted(args.output.glob(case['id'] + '-[0-9]*.png'))
        assert len(images) == case['expected']['pages'], case['id']
        text_path = args.output / (case['id'] + '.txt')
        command(['gs', '-q', '-dSAFER', '-dBATCH', '-dNOPAUSE', '-sDEVICE=txtwrite',
                 '-sOutputFile=' + str(text_path), str(pdf)])
        text = re.sub(r'\s+', ' ', text_path.read_text())
        for literal in case['expected'].get('present', []):
            assert re.sub(r'\s+', ' ', literal) in text, (case['id'], literal)
        for literal in case['expected'].get('absent', []):
            assert literal not in text, (case['id'], literal)
        fonts = command(['pdffonts', str(pdf)]).decode()
        for line in fonts.splitlines()[2:]:
            columns = line.split()
            assert 'CourierPrime' in columns[0] and columns[-5:-2] == ['yes', 'yes', 'yes'], line
        report.append({'case': case['id'], 'pages': len(images),
            'pdfSha256': hashlib.sha256(pdf.read_bytes()).hexdigest(),
            'ghostscriptSelectableText': True, 'popplerEmbeddedSubsetUnicodeFonts': True})
    summary = {'cases': report, 'pages': sum(case['pages'] for case in report),
               'ghostscript': command(['gs', '--version']).decode().strip(),
               'visualReviewRequired': True}
    (args.output / 'viewers.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps(summary), flush=True)


if __name__ == '__main__':
    main()
