#!/usr/bin/env python3
"""Check hot-path budgets, navigation drift and canonical ADR status prefixes."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUDGETS = {'AGENTS.md': (8192, None), 'map.md': (8192, None),
           'docs/current-state.md': (8192, 120), 'TODO.md': (12288, None)}
STATUSES = ('Accepted direction', 'Pending proof', 'Deferred', 'Superseded')


def check(root):
    errors = []
    exceptions = json.loads((root / 'tools/guidance-exceptions.json').read_text())
    for name, entry in exceptions.items():
        if name not in BUDGETS or not isinstance(entry, dict) or not all(
                isinstance(entry.get(key), str) and entry[key].strip()
                for key in ('reason', 'reviewed_by', 'date')):
            errors.append(f'{name}: exception needs a budgeted path, reason, reviewer and date')
    for name, (size, lines) in BUDGETS.items():
        data = (root / name).read_bytes()
        count = len(data.splitlines())
        if len(data) > size or (lines is not None and count > lines):
            if name not in exceptions:
                errors.append(f'{name}: {len(data)} bytes/{count} lines exceeds {size} bytes/{lines or "unlimited"} lines')
    state = (root / 'docs/current-state.md').read_text()
    if state.count('## Next action') != 1:
        errors.append('current-state must contain exactly one Next action section')
    for name in ('map.md', 'docs/index.md', 'TODO.md', 'docs/tasks/AUDIT-TRACKER.md'):
        text = (root / name).read_text()
        if re.search(r'(?i)current snapshot|next (?:bounded continuation|agent-executable task)|next:\s*(?:M\d|AUDIT)', text):
            errors.append(f'{name}: duplicated task/snapshot pointer')
        if 'current-state' not in text:
            errors.append(f'{name}: missing canonical continuation link')
    for path in sorted((root / 'docs/decisions').glob('[0-9][0-9][0-9][0-9]-*.md')):
        match = re.search(r'(?mi)^\**Status:\**\s*(.+)$', path.read_text())
        value = match[1].replace('**', '').strip() if match else ''
        if not value.startswith(STATUSES):
            errors.append(f'{path.name}: status must begin with a canonical vocabulary term')
    return errors


if __name__ == '__main__':
    problems = check(ROOT)
    for problem in problems:
        print(f'FAIL {problem}')
    print(f'check-guidance: {len(problems)} problem(s)')
    raise SystemExit(bool(problems))
