"""Real GTK menus/input, synthetic sole editor and a network-less owned host."""
import json
import hashlib
import os
from pathlib import Path
import queue
import subprocess
import tempfile
import threading
import time

ROOT = Path(tempfile.mkdtemp(prefix='babel-m4-11-'))
ENV = os.environ.copy()
ENV.update(ENCHANT_CONFIG_DIR=str(ROOT / 'dictionary'),
           XDG_CONFIG_HOME=str(ROOT / 'config'), XDG_DATA_HOME=str(ROOT / 'data'),
           XDG_CACHE_HOME=str(ROOT / 'cache'), GSETTINGS_BACKEND='memory')
for name in ['dictionary', 'config', 'data', 'cache']:
    (ROOT / name).mkdir(mode=0o700)
TITLE = 'babel M4-11 synthetic spellcheck'
SOURCE = '\ufeff!Zoë reads ***helllo*** beside 👩🏽‍🚀 é and שלום.  \r\n\r\n@ZORVEXIA\r\nZorvexia meets Quorvexia.\r\n\r\n!Final action.\r\n'.encode()


class Host:
    def __init__(self, env=ENV):
        self.events = []
        self.queue = queue.Queue()
        self.error = (ROOT / f'host-{time.time_ns()}.stderr').open('w')
        self.process = subprocess.Popen(
            ['unshare', '--user', '--map-root-user', '--net',
             '/tmp/babel-m4-11-host', 'babel-spell://probe/index.html'],
            env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=self.error, text=True, bufsize=1)
        threading.Thread(target=self.read, daemon=True).start()
        try:
            self.wait('loaded')
            for _ in range(50):
                if self.js('typeof spellProbe !== "undefined"'):
                    break
                time.sleep(.1)
            else:
                raise AssertionError('Editor did not initialize')
            self.network_namespace = os.readlink(f'/proc/{self.process.pid}/ns/net')
            assert self.network_namespace != os.readlink('/proc/self/ns/net')
            self.network_devices = Path(f'/proc/{self.process.pid}/net/dev').read_text()
            assert [line.split(':')[0].strip() for line in self.network_devices.splitlines()[2:]] == ['lo']
        except BaseException:
            self.close()
            raise

    def read(self):
        for line in self.process.stdout:
            try:
                event = json.loads(line)
                self.events.append(event)
                self.queue.put(event)
                print(json.dumps(event, ensure_ascii=False), flush=True)
            except ValueError:
                print(line, flush=True)

    def wait(self, kind, timeout=15):
        until = time.monotonic() + timeout
        while time.monotonic() < until:
            try:
                event = self.queue.get(timeout=.1)
            except queue.Empty:
                if self.process.poll() is not None:
                    raise AssertionError(f'Host exited: {self.process.returncode}; {self.error.name}')
                continue
            if event['kind'] == 'error':
                raise AssertionError(event)
            if event['kind'] == kind:
                return event
        raise AssertionError(f'Timed out: {kind}')

    def command(self, text, kind):
        self.process.stdin.write(text + '\n')
        self.process.stdin.flush()
        return self.wait(kind)

    def js(self, expression):
        return self.command('JS ' + expression, 'js')['value']

    def report(self):
        time.sleep(.2)  # Let the real DOM observer complete before independent capture.
        return self.js('spellProbe.report()')

    def settled(self):
        # WebKit's final DOM changes may outlive compositionend. Respect the
        # existing EditorView guard instead of sending Undo during composition.
        for _ in range(50):
            if self.js('!spellProbe.view.composing'):
                return
            time.sleep(.1)
        raise AssertionError('Native editor composition did not settle')

    def focus(self, activate=True):
        clients = json.loads(subprocess.check_output(['hyprctl', '-j', 'clients']))
        owned = [c for c in clients if c.get('pid') == self.process.pid and c.get('title') == TITLE]
        assert len(owned) == 1, (self.process.pid, clients)
        target = owned[0]['address']
        assert target.startswith('0x') and all(c in '0123456789abcdef' for c in target[2:])
        if activate:
            subprocess.run(['hyprctl', 'dispatch', 'hl.dsp.focus({ window = "address:' + target + '" })'],
                           check=True, stdout=subprocess.DEVNULL)
        active = json.loads(subprocess.check_output(['hyprctl', '-j', 'activewindow']))
        assert active.get('pid') == self.process.pid and active.get('title') == TITLE
        return owned[0]

    def key(self, *args, activate=True):
        self.focus(activate)
        subprocess.run(['wtype', *args], check=True)
        time.sleep(.25)

    def menu(self, row, offset, end=None):
        self.js(f'spellProbe.select({row}, {offset}, {end if end is not None else offset}); null')
        geometry = self.js('(() => { const s=getSelection(),r=document.createRange(); r.setStart(s.anchorNode,s.anchorOffset); r.setEnd(s.anchorNode,s.anchorOffset+1); const b=r.getBoundingClientRect(); return {x:b.x+b.width/2,y:b.y+b.height/2,width:innerWidth,height:innerHeight}; })()')
        client = self.focus()
        monitors = json.loads(subprocess.check_output(['hyprctl', '-j', 'monitors']))
        assert len(monitors) == 1 and monitors[0]['x'] == monitors[0]['y'] == 0
        monitor = monitors[0]
        assert 0 < geometry['x'] < geometry['width'] and 0 < geometry['y'] < geometry['height']
        # WebKit CSS pixels map to the owned surface's logical dimensions at 2x.
        x = client['at'][0] + geometry['x'] * client['size'][0] / geometry['width']
        y = client['at'][1] + geometry['y'] * client['size'][1] / geometry['height']
        self.menu_position = (x, y, round(monitor['width']/monitor['scale']), round(monitor['height']/monitor['scale']))
        subprocess.run(['/tmp/babel-m3-07-pointer', str(round(x)), str(round(y)),
                        str(round(monitor['width']/monitor['scale'])),
                        str(round(monitor['height']/monitor['scale'])), 'right'], check=True)
        return self.wait('menu')['items']

    def close(self):
        if self.process.poll() is None:
            self.process.stdin.write('QUIT\n')
            self.process.stdin.flush()
            self.process.wait(timeout=10)
        self.error.close()
        (ROOT / f'events-{time.time_ns()}.json').write_text(json.dumps(self.events, ensure_ascii=False, indent=2))

    def dismiss(self):
        client = self.focus(False)
        _, _, width, height = self.menu_position
        # Click the owned synthetic status area, outside the GTK popup/editor.
        subprocess.run(['/tmp/babel-m3-07-pointer', str(client['at'][0]+20),
                        str(client['at'][1]+20), str(width), str(height)], check=True)
        time.sleep(.2)

    def marked(self, row, offset):
        items = self.menu(row, offset)
        result = any(item['stock'] in [21, 22] for item in items)
        self.dismiss()
        return result

    def choose(self, items, title):
        index = next(index for index, item in enumerate(items) if item['title'] == title)
        assert items[index]['enabled'], ('Disabled native action', items[index])
        client = self.focus(False)
        x, y, width, height = self.menu_position
        positions = self.command('WIDGETS', 'widgets')['items']
        print('NATIVE GTK POSITIONS', positions, flush=True)
        chosen = next(item for item in positions if item['title'] == title)
        x = client['at'][0] + chosen['x']
        y = client['at'][1] + chosen['y']
        assert client['at'][0] <= x < client['at'][0]+client['size'][0] and client['at'][1] <= y < client['at'][1]+client['size'][1]
        subprocess.run(['/tmp/babel-m3-07-pointer', str(round(x)), str(round(y)), str(width), str(height)], check=True)
        time.sleep(.4)

    def screenshot(self, name):
        client = self.focus(False)
        time.sleep(.3)
        x, y = client['at']; width, height = client['size']
        subprocess.run(['grim', '-g', f'{x},{y} {width}x{height}', str(ROOT / f'{name}.png')], check=True)


if __name__ == '__main__':
    print('ARTIFACTS', ROOT, flush=True)
    host = Host()
    try:
        assert bytes(host.report()['source']) == SOURCE
        host.js('spellProbe.select(0, 10, 16); null')
        host.key('-d', '100', 'helllo')
        time.sleep(1)
        assert bytes(host.report()['source']) == SOURCE
        menu = host.menu(0, 13)
        assert any(item['title'] == 'hello' and item['stock'] == 21 for item in menu)
        host.screenshot('native-suggestions')
        before = host.report()
        host.choose(menu, 'hello')
        corrected = host.report()
        assert bytes(corrected['source']) == SOURCE.replace(b'helllo', b'hello'), corrected
        assert [row['attrs'] for row in corrected['rows']['content']] == [row['attrs'] for row in before['rows']['content']]
        assert corrected['rows']['content'][0]['content'][1]['marks'] == [{'type': 'bold'}, {'type': 'italic'}]
        host.key('-M', 'ctrl', '-k', 'z', '-m', 'ctrl')
        undone = host.report()
        assert bytes(undone['source']) == SOURCE, undone
        assert undone['selection'] == before['selection'], (undone['selection'], before['selection'])
        print('PASS correction/Undo/marks/origins', flush=True)
        assert host.command('LANG fr_FR', 'state')['languages'] == []
        assert not host.marked(0, 13), 'Missing language must not silently use English'
        assert bytes(host.report()['source']) == SOURCE
        assert host.command('LANG en_US-large', 'state')['languages'] == ['en_US-large']
        assert host.marked(0, 13)
        assert host.command('LANG en_US', 'state')['languages'] == ['en_US']
        scope = host.command('SCOPE', 'state')
        assert scope['languages'] == [], 'Record process-wide, not independent context scope'
        host.command('LANG en_US', 'state')
        print('PASS language/missing-resource/context scope', flush=True)
        ignored_menu = host.menu(3, 0, 8)
        assert any(item['stock'] == 23 for item in ignored_menu)
        host.choose(ignored_menu, '_Ignore Spelling')
        assert not host.marked(3, 3), 'Native Ignore must affect the active session'
        assert bytes(host.report()['source']) == SOURCE
        added_menu = host.menu(3, 15, 24)
        assert any(item['stock'] == 24 for item in added_menu)
        host.screenshot('native-learn-name')
        host.choose(added_menu, '_Learn Spelling')
        assert not host.marked(3, 18), 'Native Learn must suppress the name'
        assert bytes(host.report()['source']) == SOURCE
        personal = ROOT / 'dictionary' / 'en_US.dic'
        assert b'Quorvexia' in personal.read_bytes().splitlines(), personal
        unicode_source = SOURCE.replace(b'!Final action.', '!Żorvexía walks.'.encode())
        host.js('spellProbe.reset(' + json.dumps(unicode_source.decode()) + '); null')
        unicode_menu = host.menu(5, 0, 8)
        host.choose(unicode_menu, '_Learn Spelling')
        assert not host.marked(5, 3)
        assert 'Żorvexía'.encode() in personal.read_bytes().splitlines()
        assert bytes(host.report()['source']) == unicode_source
        host.js('spellProbe.reset(); null')
        print('PASS session Ignore / persisted Learn / unchanged source', flush=True)
        assert host.command('OFF', 'state')['enabled'] is False
        assert host.marked(0, 13), 'Native menu suggestions are independent of continuous checking'
        host.command('ON', 'state')
        assert host.marked(0, 13)
        # Actual pinyin commit/cancel with native spellchecking active.
        host.js('spellProbe.select(5, 5); null')
        host.focus()
        previous = subprocess.check_output(['fcitx5-remote', '-n'], text=True).strip()
        try:
            subprocess.run(['fcitx5-remote', '-s', 'pinyin'], check=True)
            time.sleep(.5)
            host.key('-d', '80', 'nihao')
            time.sleep(.5)
            host.screenshot('native-ime')
            host.key('-k', 'space')
            committed = host.report()
            assert bytes(committed['source']) == SOURCE.replace(b'!Final action.', '!Final你好 action.'.encode()), committed
            assert any(event['kind'] == 'compositionend' and event['trusted'] for event in committed['events'])
            host.settled()
            host.key('-M', 'ctrl', '-k', 'z', '-m', 'ctrl')
            assert bytes(host.report()['source']) == SOURCE
            host.js('spellProbe.select(5, 5); null')
            host.key('-d', '80', 'nihao')
            time.sleep(.5)
            host.key('-k', 'Escape')
            host.settled()
            cancelled = host.report()
            assert bytes(cancelled['source']) == SOURCE
            assert sum(event['kind'] == 'compositionend' and event['trusted'] for event in cancelled['events']) >= 2
        finally:
            subprocess.run(['fcitx5-remote', '-s', previous], check=True)
        print('PASS trusted pinyin commit/cancel/Undo', flush=True)
    finally:
        host.close()
    restarted = Host()
    try:
        assert restarted.marked(3, 3), 'Ignore is session-only and must not persist'
        assert not restarted.marked(3, 18), 'Learn must persist across process restart'
        restarted.js('spellProbe.suppressName(3, 0, 8); null')
        assert not restarted.marked(3, 3), 'View-only established name suppression'
        restarted.js('spellProbe.reset(); null')
        name_source = SOURCE.replace(b'@ZORVEXIA', b'@QUORVEXIA')
        restarted.js('spellProbe.reset(' + json.dumps(name_source.decode()) + '); null')
        assert not restarted.marked(2, 3), 'Learned name should cover uppercase character cue'
        restarted.js('spellProbe.reset(); null')
        assert bytes(restarted.report()['source']) == SOURCE
        print('PASS process restart: Ignore cleared / Learn retained', flush=True)
        requests = [event['value'] for event in host.events + restarted.events if event['kind'] == 'request']
        assert requests and all(uri.startswith('babel-spell://probe/') for uri in requests), requests
        report = {
            'sourceBytes': len(SOURCE), 'sourceSHA256': hashlib.sha256(SOURCE).hexdigest(),
            'requests': requests, 'profile': str(ROOT),
            'dictionaryFiles': sorted(str(path.relative_to(ROOT)) for path in (ROOT/'dictionary').rglob('*') if path.is_file()),
            'scope': scope, 'status': 'passed bounded native proof',
        }
    finally:
        restarted.close()
    fresh_env = ENV.copy()
    (ROOT / 'fresh' / 'dictionary').mkdir(parents=True, mode=0o700)
    (ROOT / 'fresh' / 'config').mkdir(mode=0o700)
    fresh_env.update(ENCHANT_CONFIG_DIR=str(ROOT/'fresh'/'dictionary'), XDG_CONFIG_HOME=str(ROOT/'fresh'/'config'))
    fresh = Host(fresh_env)
    try:
        assert fresh.marked(3, 18), 'Learn must not leak into another application profile'
        assert bytes(fresh.report()['source']) == SOURCE
        assert not list((ROOT/'config').rglob('*.dic')), 'Only the explicit Enchant profile owns learned vocabulary'
        requests += [event['value'] for event in fresh.events if event['kind'] == 'request']
        assert all(uri.startswith('babel-spell://probe/') for uri in requests)
        report.update(requests=requests, networkNamespaces=[h.network_namespace for h in [host,restarted,fresh]],
                      networkDevices=host.network_devices, freshProfileIsolated=True)
        (ROOT / 'result.json').write_text(json.dumps(report, indent=2))
        print('PASS native offline proof / fresh profile isolation / network namespace', json.dumps(report), flush=True)
    finally:
        fresh.close()
