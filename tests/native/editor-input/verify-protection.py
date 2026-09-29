"""Independently inspect exact bytes in the diagnostic's native safety ref and source file."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
log=Path(sys.argv[1]);root=Path(sys.argv[2]);original=b'\n@MAYA\nHello world.\n'
reports=[json.loads(line.split(' ',1)[1]) for line in log.read_text().splitlines() if line.startswith('M1_COMPOSITION_PROOF ')]
record=next(r for r in reports if r.get('imported',{}).get('status')=='imported')
receipt=record['imported']['protection'];rev=receipt['revision'];project=rev['documentId']
assert re.fullmatch('[a-f0-9-]{36}',project)
assert re.fullmatch('[a-f0-9]{40}',rev['commitId'])
assert rev['safetyRef']=='refs/safety/'+rev['commitId']
repo=root/'app-data/history'/f'{project}.git'
blob=subprocess.check_output(['git','--git-dir',str(repo),'show',rev['safetyRef']+':screenplay.fountain'])
assert blob==original
assert receipt['checkpoint']['sourceSha256']==hashlib.sha256(original).hexdigest()==rev['sourceSha256']
for name in ['lf','crlf','no-final-newline']:
    assert (root/f'{name}.fountain').read_bytes()==Path(f'prototypes/editor-composition/fixtures/{name}.fountain').read_bytes()
print(json.dumps({'safetyRef':rev['safetyRef'],'liveDraftSha256':rev['sourceSha256'],'nativeSourceFilesUnchanged':True}))
