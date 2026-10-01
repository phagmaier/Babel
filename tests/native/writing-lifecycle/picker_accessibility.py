"""Accept only an owned GTK folder dialog via its AT-SPI button action.
A disappearing dialog cannot redirect this action into the editor as a key.
"""
import re
import subprocess


def accept_folder(d):
    def call(address, bus, path, method, *args):
        return subprocess.check_output(['gdbus', 'call', '--address', address,
            '--dest', bus, '--object-path', path, '--method', method, *args],
            text=True, timeout=5)
    output = subprocess.check_output(['gdbus', 'call', '--session', '--dest',
        'org.a11y.Bus', '--object-path', '/org/a11y/bus', '--method',
        'org.a11y.Bus.GetAddress'], text=True, timeout=5)
    address = re.search("'([^']+)'", output).group(1)
    parents = {int(pid): int(parent) for pid, parent in (line.split() for line in
        subprocess.check_output(['ps', '-eo', 'pid,ppid'], text=True).splitlines()[1:])}
    def owned(pid):
        seen = set()
        while pid and pid not in seen:
            if pid == d.DRIVER.pid: return True
            seen.add(pid); pid = parents.get(pid, 0)
        return False
    allowed = {}
    def owned_bus(bus):
        if bus not in allowed:
            pid = int(re.search(r'uint32 (\d+)', call(address, 'org.freedesktop.DBus',
                '/org/freedesktop/DBus', 'org.freedesktop.DBus.GetConnectionUnixProcessID', bus)).group(1))
            allowed[bus] = owned(pid)
        return allowed[bus]
    def children(bus, path):
        output = call(address, bus, path, 'org.a11y.atspi.Accessible.GetChildren')
        return re.findall(r"\('([^']+)', (?:objectpath )?'([^']+)'\)", output)
    queue = [(bus, path, False) for bus, path in children('org.a11y.atspi.Registry',
        '/org/a11y/atspi/accessible/root') if owned_bus(bus)]
    seen = set(); buttons = []
    while queue and len(seen) < 500:
        bus, path, inside = queue.pop(0)
        if (bus, path) in seen or not owned_bus(bus): continue
        seen.add((bus, path))
        props = call(address, bus, path, 'org.freedesktop.DBus.Properties.GetAll',
                     'org.a11y.atspi.Accessible')
        inside = inside or "'Name': <'Choose destination folder'>" in props
        if inside and ("'Name': <'Select'>" in props or "'Name': <'_Select'>" in props):
            buttons.append((bus, path))
        queue.extend((cb, cp, inside) for cb, cp in children(bus, path))
    assert len(buttons) == 1, ('One owned folder acceptance button required', buttons)
    bus, path = buttons[0]
    result = call(address, bus, path, 'org.a11y.atspi.Action.DoAction', '0')
    assert result.strip() == '(true,)', result
