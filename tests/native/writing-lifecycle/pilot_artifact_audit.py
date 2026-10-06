"""Read M6-16 output independently: exact copies, Screenplain order and frame data.

Usage: python3 tests/native/writing-lifecycle/pilot_artifact_audit.py <pilot-root>
The native drill independently authors its literal source expectations. This
auditor pins that expected final digest and calls the verified pinned parser,
without Babel's codec, UI or native IPC. It never rewrites author artifacts.
"""
import hashlib
import json
from pathlib import Path
import statistics
import subprocess
import sys

EXPECTED = '7c98f3cddcb85cd62e8d46709f1738533c46fde6b8d3418c2962a2088c9f5136'
REPO = Path(__file__).resolve().parents[3]


def main():
    root = Path(sys.argv[1]).resolve(strict=True)
    report = json.loads((root / 'local-pilot.json').read_text())
    assert report['finalSha256'] == EXPECTED
    exported = list((root / 'copies/independent').glob('*.fountain'))
    assert len(exported) == 1
    files = [Path(report['restored']), Path(report['backup']), exported[0],
             root / 'retained-unavailable-files/working.fountain']
    assert all(hashlib.sha256(p.read_bytes()).hexdigest() == EXPECTED for p in files)
    runtime = REPO / 'target/pdf-helper/runtime'
    subprocess.run([sys.executable, str(REPO / 'tools/pdf-helper/verify_runtime.py'),
                    str(runtime), '--exact'], check=True, capture_output=True)
    script = '''import sys,json
sys.path[:0]=[sys.argv[1],sys.argv[2]]
import frozen_profile as f
from screenplain import types as t
s=f.parse(sys.stdin.read());f.prepare(s)
print(json.dumps({'title':{k:[str(x) for x in v] for k,v in s.title_page.items()},
'headings':[str(p.line) for p in s if isinstance(p,t.Slug)],
'dialogue':[str(x) for p in s if isinstance(p,t.Dialog) for parenthetical,x in p.blocks if not parenthetical]}))
'''
    parsed = subprocess.run([str(runtime / 'python/bin/python3.13'), '-I', '-S', '-B', '-c', script,
                             str(runtime / 'app'), str(runtime / 'app/lib')],
                            input=exported[0].read_bytes().decode('utf-8-sig'), text=True,
                            capture_output=True, check=True, timeout=30)
    reading = json.loads(parsed.stdout)
    assert reading['headings'] == ['EXT. FERRY PIER - NIGHT', 'INT. SIGNAL CABIN - NIGHT', 'INT. SIGNAL CABIN - DAWN']
    assert reading['title']['Title'] == ['Listen twice']
    assert reading['title']['X-private'] == ['retain  ']
    assert reading['dialogue'] == ['It came. We were listening in the wrong place.', 'Trust the second bell.',
                                  'And if it never comes?', 'Tomorrow, we start by listening.']
    frames = report['inputFrames']
    assert frames and all(sample['trusted'] for sample in frames)
    values = sorted(sample['ms'] for sample in frames)
    result = {'sourceSha256': EXPECTED, 'matchingFiles': [str(p) for p in files], 'independentReading': reading,
              'inputFrameSamples': len(values), 'medianMs': statistics.median(values),
              'p95Ms': values[int(.95 * (len(values) - 1))], 'maxMs': max(values),
              'measurement': 'Trusted WebView keydown to next animation frame; excludes physical input latency/full S13',
              'sessionSeconds': report['seconds'], 'typedCharacters': report['typedCharacters'],
              'authoredWords': report['authoredWords']}
    (root / 'artifact-audit.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
