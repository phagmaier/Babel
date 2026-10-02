"""Observe owned native processes around two distinct shutdown entry points."""
import json
import os
from pathlib import Path
import re
import subprocess
import time


def processes():
    result = {}
    for path in Path('/proc').glob('[0-9]*/stat'):
        try:
            data = path.read_text()
            fields = data[data.rfind(')') + 2:].split()
            result[int(path.parent.name)] = {
                'pid': int(path.parent.name), 'parent': int(fields[1]),
                'state': fields[0], 'start': fields[19],
                'name': data[data.find('(') + 1:data.rfind(')')],
            }
        except (FileNotFoundError, ProcessLookupError):
            continue
    return result


def release(d, mode):
    assert mode in ['ordinary', 'forced'], mode
    # Both arms begin at Home after the exact source/checkpoint/document-close
    # assertions. Never request ordinary exit over a live authoring session.
    assert 'Start writing' in d.body()
    assert not d.script("return !!document.querySelector('.ProseMirror');")
    clients = [c for c in d.owned_clients() if c.get('class') == 'babel-desktop']
    assert len(clients) == 1, clients
    client = clients[0]
    address = client['address']
    assert re.fullmatch(r'0x[0-9a-f]+', address), address
    inventory = processes()
    owned = {client['pid']}
    while True:
        children = {pid for pid, p in inventory.items() if p['parent'] in owned}
        if children <= owned:
            break
        owned |= children
    assert any(inventory[pid]['name'] == 'WebKitWebProces' for pid in owned), inventory[client['pid']]
    record = {'mode': mode, 'session': d.SESSION, 'wallTime': time.time(),
              'processes': [inventory[pid] for pid in sorted(owned)], 'phases': []}
    output = d.ROOT / 'shutdown-phases.json'
    records = json.loads(output.read_text()) if output.exists() else []
    records.append(record)

    def phase(name):
        record['phases'].append({'name': name, 'wallTime': time.time()})
        output.write_text(json.dumps(records, indent=2) + '\n')
        d.DRIVER_LOG.write(f'HARNESS shutdown {mode} {name} {d.SESSION}\n')
        d.DRIVER_LOG.flush()

    preparation = os.environ.get('BABEL_SHUTDOWN_PREPARATION', 'none')
    assert preparation in ['none', 'idle', 'blank'], preparation
    record['preparation'] = preparation
    if preparation == 'blank':
        d.command('POST', '/url', {'url': 'about:blank'})
        d.wait(lambda: d.script('return location.href;') == 'about:blank', 'Blank navigation committed')
    if preparation != 'none':
        time.sleep(5)
    from shutdown_observer import ExitObserver
    observer = ExitObserver(record['processes'], d.ROOT / 'webdriver.log',
                            d.ROOT / f'shutdown-observations-{len(records)}.json')
    with observer:
        _exit(d, mode, address, inventory, owned, phase)


def _exit(d, mode, address, inventory, owned, phase):
    phase('request')
    if mode == 'ordinary':
        subprocess.run(['hyprctl', 'dispatch',
            'hl.dsp.window.close({ window = "address:' + address + '" })'],
            check=True, stdout=subprocess.DEVNULL)
    else:
        d.command('DELETE', '')

    def exited():
        current = processes()
        return all(pid not in current or current[pid]['start'] != inventory[pid]['start']
                   or current[pid]['state'] == 'Z' for pid in owned)

    d.wait(exited, 'Owned app and WebKit descendants exit before driver cleanup', timeout=30)
    phase('owned-processes-exited')
    # Observe late stderr before touching the driver's stale session bookkeeping.
    time.sleep(1)
    if mode == 'ordinary':
        phase('delete-stale-session-after-exit')
        d.command('DELETE', '')
    phase('complete')
