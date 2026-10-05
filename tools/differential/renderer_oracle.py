#!/usr/bin/env python3
"""Batch parse JSON sources with the verified bundled renderer; no PDFs or writes."""
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/pdf-helper'))
import verify_runtime  # noqa: E402

runtime = Path(os.environ.get('BABEL_PDF_HELPER_RUNTIME', ROOT / 'target/pdf-helper/runtime')).resolve()
report = verify_runtime.verify(runtime, exact=True)
if report['problems']:
    raise SystemExit(json.dumps(report['problems']))
# This oracle calls the pinned parser itself, not Babel's mirrored reading.
script = r'''
import sys,json
sys.path[:0]=[sys.argv[1],sys.argv[2]]
import frozen_profile as f
from screenplain import types as t

def speech(d):
    return ['speech', [bool(p) for p,x in d.blocks]]
def read(source):
    try:
        s=f.parse(source.removeprefix('\ufeff')); f.prepare(s)
        rows=[]
        for p in s:
            if isinstance(p,t.DualDialog): rows.extend([speech(p.left),speech(p.right)])
            elif isinstance(p,t.Dialog): rows.append(speech(p))
            elif isinstance(p,t.Action): rows.append(['centered' if p.centered else 'action',len(p.lines)])
            elif isinstance(p,t.Slug): rows.append(['heading',str(p.scene_number) if p.scene_number else None])
            elif isinstance(p,t.Transition): rows.append(['transition'])
            elif isinstance(p,t.Section): rows.append(['section'])
            elif isinstance(p,t.PageBreak): rows.append(['pageBreak'])
            else: raise ValueError(type(p).__name__)
        return {'title': bool(s.title_page), 'paragraphs':rows}
    except Exception as e:
        return {'refused':type(e).__name__}
print(json.dumps([read(source) for source in json.load(sys.stdin)]))
'''
result = subprocess.run([str(runtime / 'python/bin/python3.13'), '-I', '-S', '-B',
                         '-c', script, str(runtime / 'app'), str(runtime / 'app/lib')],
                        input=sys.stdin.buffer.read(), capture_output=True, timeout=120)
sys.stdout.buffer.write(result.stdout)
sys.stderr.buffer.write(result.stderr)
raise SystemExit(result.returncode)
