"""Default-release real WebView IPC publication smoke; synthetic captures only."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import urllib.request
import urllib.error

REPO = Path(__file__).resolve().parents[3]
ROOT = Path(tempfile.mkdtemp(prefix='babel-publication-native-', dir=Path(sys.argv[1]).resolve()))
PORT = 4459
ENV = os.environ.copy()
ENV.update(TAURI_WEBVIEW_AUTOMATION='true', XDG_DATA_HOME=str(ROOT/'data'),
           XDG_CONFIG_HOME=str(ROOT/'config'), XDG_CACHE_HOME=str(ROOT/'cache'),
           GSETTINGS_BACKEND='memory', GTK_IM_MODULE='gtk-im-context-simple')


def request(method, path, payload=None):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(f'http://127.0.0.1:{PORT}{path}', data=data,
                                 method=method, headers={'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.load(response)['value']
    except urllib.error.HTTPError as error:
        raise RuntimeError(error.read().decode()) from error


def wait(check):
    deadline = time.monotonic()+30
    while time.monotonic()<deadline:
        try:
            result=check()
            if result: return result
        except (OSError, KeyError): pass
        time.sleep(.1)
    raise AssertionError('native IPC smoke deadline')


log = (ROOT/'webdriver.log').open('w')
driver = subprocess.Popen(['WebKitWebDriver',f'--port={PORT}'],env=ENV,stdout=log,stderr=log)
session = None
started=time.monotonic()
try:
    wait(lambda: request('GET','/status'))
    session=request('POST','/session',{'capabilities':{'alwaysMatch':{'webkitgtk:browserOptions':{'binary':str(REPO/'target/release/babel-desktop')}}}})['sessionId']
    def script(code):
        return request('POST',f'/session/{session}/execute/sync',{'script':code,'args':[]})
    def invoke(cmd, body):
        script(f"window.publicationReply=null;window.__TAURI_INTERNALS__.invoke({json.dumps(cmd)},{json.dumps(body)}).then(value=>window.publicationReply={{ok:true,value}},error=>window.publicationReply={{ok:false,error}});")
        reply=wait(lambda:script('return window.publicationReply;'))
        assert reply['ok'], reply
        return reply['value']
    wait(lambda:script('return !!window.__TAURI_INTERNALS__ && document.body.innerText.includes("Start writing");'))
    opened=invoke('create_unsaved_draft',{'request':{}})
    source=b'\xef\xbb\xbfTitle: Synthetic IPC\r\n\r\nINT. ROOM - DAY\r\n\r\nA lamp glows.\r\n'
    digest=hashlib.sha256(source).hexdigest()
    envelope={'identity':opened['identity'],'requestId':1,'version':1,'source':list(source),
              'sourceSha256':digest,'profile':'screenplain-baseline',
              'fontSet':'courier-prime-screenplain-0.12.0','options':{}}
    result=invoke('render_publication',{'request':envelope})
    assert result['version']==1 and result['sourceSha256']==digest and result['sourceBytes']==len(source)
    assert result['profileFrozen'] is False and result['sourceMap']=='unsupported'
    assert result['pageCount']==2 and '/' not in result['artifact']
    artifact=ROOT/'cache/app.babel.screenwriter/publication'/f"{result['artifact']}.pdf"
    assert artifact.read_bytes().startswith(b'%PDF-')
    info=subprocess.check_output(['pdfinfo',str(artifact)],text=True)
    actual_pages=int(next(line.split(':',1)[1] for line in info.splitlines() if line.startswith('Pages:')))
    assert actual_pages==result['pageCount'], 'actual PDF and IPC count disagree'
    artifact_sha=hashlib.sha256(artifact.read_bytes()).hexdigest()
    assert artifact.stat().st_mode & 0o777 == 0o600
    assert len(list(artifact.parent.glob('*.pdf')))==1
    second={**envelope,'requestId':2,'version':2}
    result2=invoke('render_publication',{'request':second})
    assert result2['version']==2 and not artifact.exists()
    artifact2=artifact.parent/f"{result2['artifact']}.pdf"
    assert artifact2.exists()
    invoke('cancel_publication',{'request':{'identity':opened['identity'],'requestId':1}})
    assert artifact2.exists(), 'stale cancel removed current artifact'
    invoke('release_open_document',{'request':opened['identity']})
    assert not list(artifact.parent.glob('*.pdf')), 'close must clean artifact'
    assert not list((ROOT/'data').rglob('*.fountain')), 'publication must not save a manuscript'
    # IPC-only registration left UI on Home. Quit through the ordinary native close path.
    script("window.__TAURI_INTERNALS__.invoke('plugin:window|close',{label:'main'});")
    time.sleep(.5)
    report={'ok':True,'root':str(ROOT),'elapsedSeconds':round(time.monotonic()-started,3),
            'sourceSha256':digest,'pdfinfoPages':actual_pages,'artifactSha256':artifact_sha,'result':result,'nextResult':result2,
            'binarySha256':hashlib.sha256((REPO/'target/release/babel-desktop').read_bytes()).hexdigest(),
            'coverage':'real release WebKit IPC; synthetic capture; cache supersede/stale cancel/registration close'}
    (ROOT/'result.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2),flush=True)
finally:
    # Session teardown is test-only; ordinary-close result above precedes it.
    if session:
        try: request('DELETE',f'/session/{session}')
        except (OSError, KeyError): pass
    driver.terminate()
    try: driver.wait(timeout=5)
    except subprocess.TimeoutExpired: driver.kill(); driver.wait()
    log.close()
    print('ARTIFACTS',ROOT,flush=True)
