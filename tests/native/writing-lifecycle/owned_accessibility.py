"""Scoped AT-SPI operations for a disposable app, without WebDriver or JS.

A node retains its bus owner's PID/start token. Revalidate it immediately before
mutation; reject disappeared/reused processes and unrelated applications.
"""
import json
import re
import subprocess
import time

from shutdown_lifecycle import processes


def descendant(pid, root, inventory):
    if root['pid'] not in inventory or inventory[root['pid']]['start'] != root['start']:
        return False
    seen = set()
    while pid in inventory and pid not in seen:
        if pid == root['pid']:
            return True
        seen.add(pid)
        pid = inventory[pid]['parent']
    return False


class Accessibility:
    def __init__(self, pid):
        self.root = processes()[pid]
        self.address = self.json(['--user', 'call', 'org.a11y.Bus', '/org/a11y/bus',
                                 'org.a11y.Bus', 'GetAddress'])[0]
        self.last_tree = []

    @staticmethod
    def json(args):
        result = subprocess.run(['busctl', '--json=short', '--timeout=3', *args],
                                check=True, capture_output=True, text=True, timeout=5)
        return json.loads(result.stdout)['data']

    def call(self, bus, path, interface, method, *args):
        return self.json(['--address=' + self.address, 'call', bus, path,
                          'org.a11y.atspi.' + interface, method, *args])

    def owner(self, bus):
        pid = self.json(['--address=' + self.address, 'call', 'org.freedesktop.DBus',
            '/org/freedesktop/DBus', 'org.freedesktop.DBus',
            'GetConnectionUnixProcessID', 's', bus])[0]
        inventory = processes()
        assert descendant(pid, self.root, inventory), 'Unowned accessibility bus'
        return {'pid': pid, 'start': inventory[pid]['start']}

    def validate(self, node):
        assert self.owner(node['bus']) == node['owner'], 'Accessibility owner changed'

    def name(self, bus, path):
        return self.json(['--address=' + self.address, 'get-property', bus, path,
                          'org.a11y.atspi.Accessible', 'Name'])

    def tree(self):
        queue = self.call('org.a11y.atspi.Registry', '/org/a11y/atspi/accessible/root',
                          'Accessible', 'GetChildren')[0]
        seen = set(); owners = {}; result = []
        while queue:
            bus, path = queue.pop(0)
            if (bus, path) in seen:
                continue
            seen.add((bus, path))
            if bus not in owners:
                try:
                    owners[bus] = self.owner(bus)
                except (AssertionError, subprocess.SubprocessError):
                    owners[bus] = None
            if owners[bus] is None:
                continue
            name = self.name(bus, path)
            role = self.call(bus, path, 'Accessible', 'GetRole')[0]
            node = {'bus': bus, 'path': path, 'owner': owners[bus], 'name': name, 'role': role}
            result.append(node)
            # Keep traversal bounded: editor paragraphs/outline rows are queried
            # explicitly when needed, not materialized into retained references.
            if name in ['Screenplay text', 'Manuscript outline', 'Screenplay outline'] or role == 34:
                continue  # Native menu bar is not the WebView toolbar.
            if len(result) >= 600:
                raise AssertionError('Accessibility traversal exceeded bounded controls')
            queue.extend(self.call(bus, path, 'Accessible', 'GetChildren')[0])
        self.last_tree = result
        return result

    def find(self, name, role=None, timeout=30):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            try:
                matches = [n for n in self.tree() if n['name'] == name and (role is None or n['role'] == role)]
            except subprocess.SubprocessError:
                # Adoption replaces accessibility objects. Retry discovery only;
                # mutations are never retried after an ambiguous bus failure.
                time.sleep(.1)
                continue
            if len(matches) == 1:
                return matches[0]
            assert len(matches) < 2, ('Ambiguous accessible', name, matches)
            time.sleep(.1)
        raise AssertionError('Accessible not found: ' + name)

    def act(self, name, role=43):
        node = self.find(name, role)
        deadline = time.monotonic() + 10
        while True:
            self.validate(node)
            if self.call(node['bus'], node['path'], 'Accessible', 'GetState')[0][0] & (1 << 8):
                break  # ATSPI_STATE_ENABLED; await an in-flight app operation.
            assert time.monotonic() < deadline, 'Control stayed disabled: ' + name
            time.sleep(.1)
        assert self.call(node['bus'], node['path'], 'Action', 'DoAction', 'i', '0') == [True]
        return node

    def focus(self, node):
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            self.validate(node)
            if self.call(node['bus'], node['path'], 'Component', 'GrabFocus') == [True]:
                return
            time.sleep(.1)
        raise AssertionError('Owned component did not accept focus: ' + node['name'])

    def clients(self):
        inventory = processes()
        return [c for c in json.loads(subprocess.check_output(['hyprctl', '-j', 'clients']))
                if descendant(c['pid'], self.root, inventory)]

    def focus_window(self, title=None):
        clients = [c for c in self.clients() if c.get('title') == title] if title else [
            c for c in self.clients() if c.get('class') == 'babel-desktop' and c.get('title') == 'babel']
        assert len(clients) == 1, ('One owned window required', title, clients)
        address = clients[0]['address']
        assert re.fullmatch('0x[0-9a-f]+', address)
        subprocess.run(['hyprctl', 'dispatch', 'hl.dsp.focus({ window = "address:' + address + '" })'],
                       check=True, stdout=subprocess.DEVNULL)
        self.assert_focus()
        return clients[0]

    def assert_focus(self):
        active = json.loads(subprocess.check_output(['hyprctl', '-j', 'activewindow']))
        assert any(c['address'] == active.get('address') for c in self.clients()), 'Focus left owned app'

    def keys(self, *args):
        self.assert_focus()
        subprocess.run(['wtype', *args], check=True, timeout=15)

    def choose(self, name, index, expected):
        node = self.find(name, 11)
        self.focus_window(); self.focus(node)
        self.keys('-k', 'Home', *sum((['-k', 'Down'] for _ in range(index)), []), '-k', 'Tab')
        self.validate(node)
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            self.validate(node)
            queue = self.call(node['bus'], node['path'], 'Accessible', 'GetChildren')[0]
            selected = set()
            while queue:
                bus, path = queue.pop(0)
                state = self.call(bus, path, 'Accessible', 'GetState')[0]
                if state[0] & (1 << 23):  # ATSPI_STATE_SELECTED
                    selected.add(self.name(bus, path))
                queue.extend(self.call(bus, path, 'Accessible', 'GetChildren')[0])
            if selected == {expected}:
                return expected
            time.sleep(.1)
        raise AssertionError(('Expected selected option did not settle', expected, selected))
