"""Read-only exit observations; distinguish pre-abort waits from core dumping.

Only initial owned PID/start tokens are inspected. No ptrace, signals, or global
settings. Stderr timestamps are first-observed times, not event timestamps.
"""
import json
from pathlib import Path
import threading
import time



def observe_process(token, proc=Path('/proc')):
    path = proc / str(token['pid'])
    try:
        stat = (path / 'stat').read_text()
        fields = stat[stat.rfind(')') + 2:].split()
        if fields[19] != token['start']:
            return {'pid': token['pid'], 'identity': 'reused'}
        status = dict(line.split(':', 1) for line in (path / 'status').read_text().splitlines() if ':' in line)
        result = {'pid': token['pid'], 'state': fields[0],
                  'coreDumping': status.get('CoreDumping', '').strip(),
                  'pendingSignals': status.get('ShdPnd', '').strip(),
                  'threads': []}
        for task in sorted((path / 'task').iterdir()):
            try:
                result['threads'].append({'tid': int(task.name),
                    'name': (task / 'comm').read_text().strip(),
                    'waitChannel': (task / 'wchan').read_text().strip()})
            except OSError:
                continue  # A thread can exit between the directory and read.
        after = (path / 'stat').read_text()
        if after[after.rfind(')') + 2:].split()[19] != token['start']:
            return {'pid': token['pid'], 'identity': 'reused'}
        return result
    except FileNotFoundError:
        return {'pid': token['pid'], 'identity': 'gone'}
    except OSError as error:
        return {'pid': token['pid'], 'readError': str(error)}


class ExitObserver:
    def __init__(self, tokens, log, output):
        self.tokens, self.log, self.output = tokens, log, output
        self.stop = threading.Event()
        self.thread = threading.Thread(target=self.run, daemon=True)
        self.report = {'started': time.time(), 'intervalSeconds': .1, 'observations': []}
        self.offset = log.stat().st_size

    def __enter__(self):
        self.thread.start()
        return self

    def run(self):
        previous = None
        try:
            while True:
                current = [observe_process(p) for p in self.tokens]
                with self.log.open('rb') as stream:
                    stream.seek(self.offset)
                    lines = stream.read().decode(errors='replace')
                    self.offset = stream.tell()
                if current != previous or lines:
                    self.report['observations'].append({'wallTime': time.time(),
                        'processes': current, 'newStderr': lines})
                    self.output.write_text(json.dumps(self.report, indent=2) + '\n')
                    previous = current
                if self.stop.wait(.1):
                    break
        except Exception as error:
            self.report['error'] = repr(error)

    def __exit__(self, *_):
        self.stop.set()
        self.thread.join(timeout=5)
        self.report.update(ended=time.time(), observerStopped=not self.thread.is_alive())
        self.output.write_text(json.dumps(self.report, indent=2) + '\n')
