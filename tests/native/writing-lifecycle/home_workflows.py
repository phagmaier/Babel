"""M4-02 actual default-app Home controls, native pickers and exact byte oracles.
No injected ports or JavaScript calls to native commands in this mode.
"""
import hashlib
import json
import time


def run(h):
    def home_ready():
        return 'Start writing' in h.body() and 'Reading recent metadata' not in h.body() and 'Checking local recovery' not in h.body()

    def click_action(label):
        h.wait(lambda: h.script("return [...document.querySelectorAll('[aria-label=\"Screenplay actions\"] button')].some(b => b.textContent.trim() === arguments[0] && !b.disabled);", [label]), 'Action ready: '+label)
        h.click(label, actions=True)

    def close_session():
        h.wait(lambda: h.script("return [...document.querySelectorAll('[aria-label=\"Screenplay actions\"] button')].some(b => b.textContent.trim() === 'Close session' && !b.disabled);"), 'Writing ready before protected close')
        h.close_session()

    def keep_identical():
        h.wait(lambda: 'Both generations hold identical content.' in h.body(), 'Explicit identical recovery comparison')
        element = h.find("//section[.//h2[normalize-space(.)='Recovery choice']][.//p[normalize-space(.)='Both generations hold identical content.']]//button[normalize-space(.)='Keep Current File']")
        h.command('POST', f'/element/{element}/click', {})
        h.wait(lambda: 'The current file was kept.' in h.body(), 'Explicit Keep Current File')

    h.wait(home_ready, 'Home bounded reads complete')
    warm_launch_ms = (time.monotonic() - h.SESSION_STARTED) * 1000
    initial_ms = h.script('return performance.now();')
    assert h.script("return document.activeElement?.textContent.trim();") == 'New screenplay'
    # Trusted WebKit keyboard navigation across entry controls.
    def key(value):
        h.command('POST', '/actions', {'actions': [{'type': 'key', 'id': 'home-keys', 'actions': [
            {'type': 'keyDown', 'value': value}, {'type': 'keyUp', 'value': value}]}]})
    key('\ue004')
    assert h.script("return document.activeElement?.textContent.trim();") == 'New with destination'
    key('\ue004')
    assert h.script("return document.activeElement?.textContent.trim();") == 'Open Fountain'
    key('\ue007')
    h.picker(None)
    h.wait(home_ready, 'Open cancellation returns Home')
    assert 'Open cancelled' in h.body()

    click_action('New with destination')
    h.picker(None)
    h.wait(lambda: 'Destination cancelled' in h.body(), 'Destination cancel retains draft')
    assert 'Protect draft' in h.body()
    assert any(source == b'' for _, source in h.journal_records())
    h.type_text('Home draft survives.')
    click_action('Protect draft')
    expected_draft = b'!Home draft survives.\n'
    h.wait(lambda: any(source == expected_draft for _, source in h.journal_records()), 'New draft exact recovery')
    before = time.monotonic()
    click_action('Home')
    h.click('Retry save and close')
    h.wait(home_ready, 'Protected Home return')
    home_ms = (time.monotonic() - before) * 1000
    assert 'No recent screenplays yet' in h.body()
    assert 'Resume as new draft' in h.body()
    original = [(m, s) for m, s in h.journal_records() if s == expected_draft][-1]
    original_id = original[0]['documentId']
    h.command('DELETE', '')
    h.SESSION = None
    h.new_session()
    h.wait(home_ready, 'Recovery remains discoverable on restart')
    def draft_button(document_id, label, generation=None):
        candidate = f"/ul/li[p[contains(.,'generation {generation} ·')]]" if generation is not None else ''
        # Route adoption precedes the asynchronous native recovery inventory.
        # Wait for this exact retained document/generation, not any draft row.
        return h.wait(lambda:h.find(f"//li[h3[normalize-space(.)='Draft {document_id}']]{candidate}//button[normalize-space(.)={json.dumps(label)}]"),
                      'Exact recovery candidate ready: ' + document_id + ' / ' + label)
    el = draft_button(original_id, 'Resume as new draft', original[0]['generation'])
    h.command('POST', f'/element/{el}/click', {})
    h.wait(lambda: h.editor_text() == 'Home draft survives.', 'Resume full original bytes')
    click_action('Protect draft')
    h.wait(lambda: len({m['documentId'] for m,s in h.journal_records() if s == expected_draft}) >= 2, 'Resume uses fresh identity and preserves original')
    close_session()

    target = h.ROOT / 'files' / 'new-home.fountain'
    click_action('New with destination')
    h.picker(target)
    h.wait(lambda: 'New screenplay published' in h.body(), 'New destination publication')
    h.audit(target, b'')
    h.type_text('Destination story.')
    click_action('Save')
    expected = b'!Destination story.\n'
    h.audit(target, expected)
    close_session()
    h.wait(home_ready, 'Published screenplay listed')
    assert 'Last known local modification:' in h.body()
    assert h.script('return Math.abs(Date.parse(document.querySelector("time").dateTime) / 1000 - arguments[0]) < 0.002;', [target.stat().st_mtime])
    for label in ['New with destination', 'Open Fountain', 'Open new-home.fountain', 'Locate new-home.fountain', 'Remove new-home.fountain from Recents']:
        key('\ue004')
        assert h.script("return document.activeElement?.textContent.trim();") == label
    h.script("document.querySelector('[aria-labelledby=\"recent-heading\"]').scrollIntoView({block:'start'});")
    h.screenshot('home-recents')
    h.click('Open new-home.fountain')
    h.wait(lambda: h.editor_text() == 'Destination story.', 'Recent opens exact content')
    keep_identical()
    close_session()
    moved = target.with_name('moved-home.fountain')
    target.rename(moved)
    h.click('Open new-home.fountain')
    h.wait(lambda: 'Could not open the screenplay' in h.body(), 'Stale recent availability safely refuses missing source')
    h.click('Back')
    h.wait(home_ready, 'Failed recent open returns usable Home')
    h.click('Refresh Recents')
    h.wait(lambda: 'Missing file' in h.body(), 'Missing file is visible')
    h.click('Locate new-home.fountain')
    h.picker(None)
    h.wait(lambda: 'Locate cancelled' in h.body(), 'Locate cancellation preserves mapping')
    h.click('Locate new-home.fountain')
    h.picker(moved)
    h.wait(lambda: 'Confirm selected file: moved-home.fountain' in h.body(), 'Explicit comparison visible')
    assert 'Matching bytes alone do not establish identity' in h.body()
    h.script("document.querySelector('[aria-labelledby=\"locate-heading\"]').scrollIntoView({block:'start'});")
    h.screenshot('home-locate-comparison')
    h.click('Cancel linking')
    assert 'new-home.fountain' in h.body()
    h.click('Locate new-home.fountain')
    h.picker(moved)
    h.wait(lambda: 'Link moved screenplay' in h.body(), 'Explicit link offered')
    h.click('Link moved screenplay')
    h.wait(lambda: h.editor_text() == 'Destination story.', 'Moved source adopted')
    h.audit(moved, expected)
    keep_identical()
    close_session()
    h.wait(home_ready, 'Moved entry listed')
    retained_recovery = {p: p.read_bytes() for p in (h.ROOT / 'data' / 'app.babel.screenwriter' / 'recovery').iterdir() if p.suffix in ('.journal', '.previous')}
    h.click('Remove moved-home.fountain from Recents')
    h.wait(lambda: 'Removed from Recents' in h.body(), 'Metadata-only removal visible')
    h.audit(moved, expected)
    assert all(p.read_bytes() == data for p, data in retained_recovery.items())
    print('PASS native Home New/Open/Recent/Locate/link/cancel/metadata-only Remove/restart Resume', flush=True)

    # Mismatch / explicit different / read-only source and writable Save As.
    click_action('Open Fountain')
    h.picker(moved)
    h.wait(lambda: h.editor_text() == 'Destination story.', 'Re-register selected source')
    keep_identical()
    close_session()
    missing = moved.with_name('gone-home.fountain')
    moved.rename(missing)
    other = moved.with_name('other-home.fountain')
    other_bytes = b'Other screenplay.\r\n'
    other.write_bytes(other_bytes)
    other.chmod(0o400)
    h.click('Refresh Recents')
    h.wait(lambda: 'Missing file' in h.body(), 'Missing moved entry')
    h.click('Locate moved-home.fountain')
    h.picker(other)
    h.wait(lambda: 'Bytes differ from the last known source' in h.body(), 'Mismatch explained')
    h.click('Open as different screenplay')
    h.wait(lambda: 'Save As can preserve a separate copy' in h.body(), 'Different source read-only state')
    assert h.editor_text() == 'Other screenplay.'
    copy = h.ROOT / 'files' / 'readonly-copy.fountain'
    click_action('Save As')
    h.picker(copy)
    h.audit(copy, other_bytes)
    h.audit(other, other_bytes)
    close_session()
    assert 'moved-home.fountain' in h.body()
    print('PASS native Home mismatch/different/read-only/Save As preserves original', flush=True)

    # Recover an independently authored >preview-limit checkpoint, then retain
    # both generations under external divergence and failed protected Home switch.
    long_source = h.ROOT / 'files' / 'long-home.fountain'
    long_bytes = b'LONG ' + b'A' * 70000 + b' FULL END\r\n'
    long_source.write_bytes(long_bytes)
    long_source.chmod(0o600)
    click_action('Open Fountain')
    h.picker(long_source)
    h.wait(lambda: h.editor_text() == long_bytes.decode().rstrip('\r\n'), 'Large source fully loaded')
    click_action('Save')
    h.wait(lambda: any(s == long_bytes for _,s in h.journal_records()), 'Large full-byte checkpoint')
    close_session()
    long_meta = [m for m,s in h.journal_records() if s == long_bytes][-1]
    el = draft_button(long_meta['documentId'], 'Inspect published journal generation '+str(long_meta['generation']))
    h.command('POST', f'/element/{el}/click', {})
    h.wait(lambda: 'Only the beginning is shown' in h.body(), 'Preview truncation explained')
    assert not h.script("return document.querySelector('.recovery-preview pre').textContent.includes(' FULL END');")
    el = draft_button(long_meta['documentId'], 'Resume as new draft', long_meta['generation'])
    h.command('POST', f'/element/{el}/click', {})
    h.wait(lambda: h.editor_text() == long_bytes.decode().rstrip('\r\n'), 'Resume adopts full bytes beyond preview')
    click_action('Protect draft')
    h.wait(lambda: len({m['documentId'] for m,s in h.journal_records() if s == long_bytes}) >= 2, 'Large resume full bytes independently audited')
    close_session()
    h.click('Open long-home.fountain')
    h.wait(lambda: h.editor_text() == long_bytes.decode().rstrip('\r\n'), 'Recent large source reopened')
    # Resolve identical previous-session material before generating divergence.
    h.wait(lambda: 'Both generations hold identical content.' in h.body(), 'Recovery comparison ready')
    el = h.find("//section[.//h2[normalize-space(.)='Recovery choice']][.//p[normalize-space(.)='Both generations hold identical content.']]//button[normalize-space(.)='Keep Current File']")
    h.command('POST', f'/element/{el}/click', {})
    h.wait(lambda: 'The current file was kept.' in h.body(), 'Keep explicit current source')
    outside = b'External version remains.\n'
    long_source.write_bytes(outside)
    h.type_text('LOCAL ')
    local_text = h.editor_text()
    click_action('Home')
    h.click('Retry save and close')
    h.wait(lambda: 'Close stopped.' in h.body(), 'Failed switch stays in writing session')
    assert h.editor_text() == local_text
    h.audit(long_source, outside)
    assert any(s == long_bytes for _,s in h.journal_records())
    h.screenshot('home-failed-switch')
    click_action('Select copy destination')
    h.picker(h.ROOT / 'copies')
    h.wait(lambda: h.script("return [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save Emergency Copy and close')?.disabled === false;"), 'Copy enabled')
    h.click('Save Emergency Copy and close')
    h.wait(home_ready, 'Emergency copy permits protected Home return')
    copies = list((h.ROOT / 'copies').glob('*.fountain'))
    assert len(copies) == 1
    # Insertion occurs at the initial caret (source metadata); independently
    # require exact known prefix and unchanged long tail, preserving CRLF.
    local_bytes = b'!LOCAL ' + long_bytes
    h.audit(copies[0], local_bytes)
    h.audit(long_source, outside)
    assert any(s == local_bytes for _,s in h.journal_records())
    h.screenshot('home-recovery')
    # An unsafe auxiliary catalog must not block normal writing protection.
    store = h.ROOT / 'data' / 'app.babel.screenwriter'
    slots = sorted((json.loads(p.read_bytes())['generation'], p) for p in store.glob('recents-*.json'))
    prior_bytes = slots[-2][1].read_bytes()
    slots[-1][1].write_bytes(b'{truncated')
    h.click('Refresh Recents')
    h.wait(lambda: 'Recent metadata needs attention' in h.body(), 'Registry attention visible on Home')
    h.click('Remove long-home.fountain from Recents')
    h.wait(lambda: 'Removal could not be confirmed.' in h.body(), 'Registry failure reports removal refusal')
    h.audit(long_source, outside)
    click_action('New screenplay')
    h.wait(lambda: 'Unsaved draft protected by local recovery' in h.body(), 'Registry failure leaves draft checkpoint available')
    assert slots[-2][1].read_bytes() == prior_bytes
    assert slots[-1][1].read_bytes() == b'{truncated'
    close_session()
    h.wait(home_ready, 'Home remains usable with corrupt catalog')
    h.script("document.querySelector('[aria-labelledby=\"recent-heading\"]').scrollIntoView({block:'start'});")
    h.screenshot('home-registry-attention')
    print('PASS native Home registry failure isolation', flush=True)
    report = {'warm_launch_home_ms': warm_launch_ms, 'initial_observed_home_ms': initial_ms, 'protected_return_home_ms': home_ms,
              'long_fixture_bytes': len(long_bytes), 'long_fixture_sha256': hashlib.sha256(long_bytes).hexdigest(),
              'method': 'Warm launch measured from WebDriver session creation to bounded Home reads (including release-CSP probe/polling); WebKit performance.now sampled after reads; protected-return elapsed includes close/checkpoint/release + WebDriver polling; no compositor paint claim'}
    (h.ROOT / 'home-measurements.json').write_text(json.dumps(report, indent=2))
    print('PASS native Home large-preview/full-resume/Keep/failed switch/emergency-copy exact generations', flush=True)
    print('HOME MEASUREMENTS', json.dumps(report), flush=True)
    print('ARTIFACTS', h.ROOT, flush=True)
