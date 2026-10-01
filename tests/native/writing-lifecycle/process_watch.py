"""Polling descendant ledger and bounded crash journal; no lossless tracing claim."""
import json
import re
import subprocess
import time

from shutdown_lifecycle import processes


class ProcessWatch:
    def __init__(self, pid, output):
        self.pid = pid
        self.output = output
        self.started = time.time()
        self.records = {}
        self.samples = 0
        self.max_gap = 0
        self.last_sample = time.monotonic()
        self.last_saved = self.last_sample - 1
        self.sample()
        assert any(p['pid'] == pid for p in self.records.values()), 'Missing probe process'

    def sample(self):
        now = time.time()
        monotonic = time.monotonic()
        self.max_gap = max(self.max_gap, monotonic - self.last_sample)
        self.last_sample = monotonic
        current = processes()
        live = {pid for pid, p in current.items() if (pid, p['start']) in self.records}
        if not self.records and self.pid in current:
            live.add(self.pid)
        while True:
            children = {pid for pid, p in current.items() if p['parent'] in live}
            if children <= live:
                break
            live |= children
        for (pid, start), record in self.records.items():
            if pid not in current or current[pid]['start'] != start:
                record.setdefault('firstMissing', now)
        for pid in live:
            p = current[pid]
            token = (pid, p['start'])
            if token not in self.records:
                parent = current.get(p['parent'])
                self.records[token] = {**p, 'firstSeen': now, 'lastSeen': now,
                                       'parentStart': parent['start'] if parent else None}
            self.records[token].update(lastSeen=now, state=p['state'])
            self.records[token].pop('firstMissing', None)
        self.samples += 1
        if monotonic - self.last_saved >= 1:
            self.save()

    def save(self):
        self.last_saved = time.monotonic()
        report = {'rootPid': self.pid, 'started': self.started, 'ended': time.time(),
                  'samples': self.samples, 'pollSleepSeconds': .05,
                  'maxSampleGapSeconds': round(self.max_gap, 4),
                  'limitation': 'Polling can miss processes living entirely between samples.',
                  'processes': list(self.records.values())}
        self.output.write_text(json.dumps(report, indent=2) + '\n')
        return report


def journal_scan(ledger, output, *, ended=None):
    # Include crash delivery just after cleanup. Keep the queried time window
    # exact in evidence; later coredump delivery is outside this bounded scan.
    if ended is None:
        ended = time.time()
    cmd = ['journalctl', '--no-pager', '--quiet', '--output=json',
           '--since', '@' + str(ledger['started']), '--until', '@' + str(ended),
           '_TRANSPORT=kernel', '+', 'SYSLOG_IDENTIFIER=systemd-coredump']
    try:
        result = subprocess.run(cmd, text=True, capture_output=True, timeout=30)
    except (OSError, subprocess.TimeoutExpired) as error:
        result = subprocess.CompletedProcess(cmd, 1, stdout='', stderr=str(error))
    events = []
    if result.returncode == 0:
        for line in result.stdout.splitlines():
            event = json.loads(line)
            message = event.get('MESSAGE', '')
            # journalctl JSON omits oversized MESSAGE values (null). Core
            # identity fields still prove a crash; never require the backtrace.
            if not isinstance(message, str):
                message = ''
            core_pid = event.get('COREDUMP_PID')
            kernel = re.search(r'(WebKit[^\s\[]*|babel-desktop)\[(\d+)\].*(?:segfault|trap)', message, re.I)
            core = core_pid and re.search(r'WebKit|babel-desktop', event.get('COREDUMP_COMM', ''))
            if not kernel and not core:
                continue
            pid = int(core_pid if core else kernel[2])
            owned = [p for p in ledger['processes'] if p['pid'] == pid]
            # PID reuse is bounded by the tracked token and observed lifetime.
            crash_time = int(event.get('COREDUMP_TIMESTAMP', event['__REALTIME_TIMESTAMP'])) / 1e6
            owned = [p for p in owned if p['firstSeen'] <= crash_time <= p.get('firstMissing', ledger['ended'])]
            events.append({'pid': pid, 'wallTime': crash_time,
                           'journalWallTime': int(event['__REALTIME_TIMESTAMP']) / 1e6,
                           'kind': 'coredump' if core else 'kernel',
                           'signal': event.get('COREDUMP_SIGNAL'),
                           'ownedTokens': [{'pid': p['pid'], 'start': p['start']} for p in owned],
                           'attribution': 'owned' if len(owned) == 1 else 'unattributed',
                           # Do not retain unrelated journal payloads/backtraces.
                           'message': message.split('\n', 1)[0] or 'Core event; MESSAGE omitted by journalctl'})
    report = {'command': cmd, 'exitCode': result.returncode, 'stderr': result.stderr,
              'readPassed': result.returncode == 0 and not result.stderr.strip(),
              'started': ledger['started'], 'ended': ended, 'events': events,
              'limitation': 'Bounded journal scan; delayed core delivery or polling gaps may escape attribution.'}
    output.write_text(json.dumps(report, indent=2) + '\n')
    return report
