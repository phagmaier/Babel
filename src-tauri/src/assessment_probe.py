"""Embedded read-only layout probe; only the native host supplies the app path.

Uses the frozen pipeline with BytesIO, never a destination or page-count result.
Each codec-selected construct is tested independently, so one refusal cannot
hide another. No bytecode, file writes, sockets or child processes are allowed.
"""
import importlib
import io
import json
import os
import sys

app = sys.argv[1]
sys.path[:0] = [app, os.path.join(app, 'lib')]
import babel_pdf_helper as helper
helper._limit_resources()


def audit(event, args):
    if event == 'open':
        mode, flags = args[1:3]
        if (isinstance(mode, str) and any(c in mode for c in 'wax+')) or (flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND)):
            raise OSError('assessment is read-only')
    if event.startswith(('socket.', 'subprocess.', 'os.exec', 'os.spawn')) or event in ('os.mkdir', 'os.remove', 'os.rename', 'os.rmdir'):
        raise OSError('assessment effect denied')


sys.addaudithook(audit)
helper._verify_fonts()
from reportlab.pdfbase import ttfonts
from screenplain.export import pdf
import frozen_profile
original_cmap = ttfonts.makeToUnicodeCMap
sources = json.load(sys.stdin)
results = []
for source in sources:
    # Restore private patch seams between probes in this one bounded process.
    ttfonts.makeToUnicodeCMap = original_cmap
    importlib.reload(pdf)
    importlib.reload(frozen_profile)
    screenplay = frozen_profile.parse(source)
    try:
        frozen_profile.render(screenplay, io.BytesIO())
        results.append(None)
    except frozen_profile.UnsupportedPublication as error:
        results.append(str(error).removeprefix('unsupported-publication:'))
print(json.dumps(results))
