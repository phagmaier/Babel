#!/usr/bin/env python3
"""Batch report the verified bundled helper's omission warnings for JSON sources; no PDFs or writes."""
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
# This oracle calls the helper's own warnings(), not Babel's assessment.
script = r'''
import sys,json
sys.path[:0]=[sys.argv[1],sys.argv[2]]
import frozen_profile as f

def read(source):
    try:
        # As the helper does: a leading BOM is source metadata, not text.
        text=source.removeprefix('\ufeff')
        return [w['code'] for w in f.warnings(f.parse(text),text)]
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
