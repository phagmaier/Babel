"""Create an explicit private disposable native root from independently authored fixture bytes."""
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile

base = sys.argv[1] if len(sys.argv) > 1 else '/tmp'
root = Path(tempfile.mkdtemp(prefix='babel-editor-composition-', dir=base))
root.chmod(0o700)
marker = root / 'SYNTHETIC-M1-06'
marker.write_bytes(b'babel M1-06 disposable synthetic fixtures\n')
marker.chmod(0o600)
fixtures = Path(__file__).resolve().parent / 'fixtures'
report = {}
for name in ['lf', 'crlf', 'no-final-newline']:
    data = (fixtures / f'{name}.fountain').read_bytes()
    destination = root / f'{name}.fountain'
    destination.write_bytes(data)
    destination.chmod(0o600)
    report[name] = {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
(root / 'data').mkdir(mode=0o700)
print(json.dumps({'root': str(root), 'fixtures': report}, indent=2))
