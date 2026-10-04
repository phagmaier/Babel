#!/usr/bin/env python3
"""Verify the bounded SIMP-N structural and frozen retention boundary."""
import json
import re
import subprocess
from pathlib import Path

BASE = '653f037'


def main():
    failures = []
    host = Path('src-tauri/src/lib.rs').read_text()
    if host.count('generate_handler![') != 1:
        failures.append('production handler list is not unique')
    for name in ['snapshot_host', 'recent_projects_host']:
        text = Path(f'src-tauri/src/{name}.rs').read_text()
        if 'fn snapshot_worker' in text or 'fn recent_operation' in text:
            failures.append(f'old worker helper: {name}')
    if not Path('src-tauri/src/document_worker.rs').exists():
        failures.append('shared cost-aware worker missing')
    for name in ['create_private', 'private_dir', 'writable_private_destination', 'storage_relation']:
        if not re.search(r'fn ' + name + r'\(', Path('crates/screenwriter-core/src/documents/linux.rs').read_text()):
            failures.append(f'missing primitive: {name}')
    if not Path('tests/support/test_root.rs').exists():
        failures.append('shared test root missing')
    if not Path('src-tauri/src/test_support.rs').exists():
        failures.append('shared IPC support missing')
    def handlers(text):
        return re.findall(r'generate_handler!\[([\s\S]*?)\n    \]\);', text)

    def commands(body, linux, feature):
        result = []
        enabled = True
        for line in body.splitlines():
            line = line.strip()
            if line.startswith('#[cfg('):
                if 'editor-composition-proof' in line:
                    enabled = linux and feature
                else:
                    enabled = linux
            elif re.fullmatch(r'[a-z_]+,?', line):
                if enabled:
                    result.append(line.rstrip(','))
                enabled = True
        return result
    old_host = subprocess.check_output(['git', 'show', f'{BASE}:src-tauri/src/lib.rs'], text=True)
    old_lists, new_lists = handlers(old_host), handlers(host)
    parity = {}
    if len(old_lists) == 2 and len(new_lists) == 1:
        for linux in [False, True]:
            for feature in [False, True]:
                previous = commands(old_lists[1 if linux and feature else 0], linux, feature)
                current = commands(new_lists[0], linux, feature)
                label = f'{"linux" if linux else "non-linux"}-feature-{feature}'
                parity[label] = len(current)
                if previous != current:
                    failures.append(f'handler cfg parity changed: {label}')
    else:
        failures.append('handler shape not comparable yet')
    # Sensitive worker/lease policies are outside this refactor, including cancellation locking.
    for name, methods in {
        'src-tauri/src/lib.rs': ['release', 'release_at_risk'],
        'src-tauri/src/persistence_host.rs': ['reserve', 'checkpoint', 'save', 'release_worker', 'release_at_risk_worker'],
        'src-tauri/src/recovery_choices_host.rs': ['recover'],
        'src-tauri/src/document_entry_host.rs': ['open_picked', 'pick_destination'],
        'src-tauri/src/save_as_host.rs': ['pick_save_target'],
        'crates/screenwriter-core/src/documents/linux.rs': ['lease'],
    }.items():
        before = subprocess.check_output(['git', 'show', f'{BASE}:{name}'], text=True)
        after = Path(name).read_text()
        for method in methods:
            pattern = rf'^    (?:pub\([^)]*\) )?(?:async )?fn {method}\([\s\S]*?^    \}}'
            old_method = re.search(pattern, before, re.M)
            new_method = re.search(pattern, after, re.M)
            if not old_method or not new_method or old_method[0] != new_method[0]:
                failures.append(f'protected worker/lease changed: {name}:{method}')
    # Retain independent literals and all frontend/runtime protocol pins.
    names = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', BASE], text=True).splitlines()
    retained = [name for name in names if name.startswith(('fixtures/', 'src/', 'tests/native/'))
                or name in ['AUDIT.md', 'Cargo.lock', 'package.json', 'pnpm-lock.yaml',
                            'src-tauri/Cargo.toml', 'crates/screenwriter-core/Cargo.toml']]
    for name in retained:
        old = subprocess.check_output(['git', 'show', f'{BASE}:{name}'])
        if not Path(name).is_file() or Path(name).read_bytes() != old:
            failures.append(f'retained bytes changed: {name}')
    # Existing test oracles must stay verbatim, even as fixture setup moves.
    assertions = 0
    for name in names:
        if not name.endswith('.rs') or not ('test' in name or name.endswith('persistence_host.rs')):
            continue
        old = subprocess.check_output(['git', 'show', f'{BASE}:{name}'], text=True)
        current = Path(name).read_text()
        pattern = r'\bassert(?:_eq|_ne)?!\([\s\S]*?\);'
        expected = re.findall(pattern, old)
        actual = re.findall(pattern, current)
        if any(item not in actual for item in expected):
            failures.append(f'existing assertion changed: {name}')
        assertions += len(expected)
    print(json.dumps({'base': BASE, 'retained_files': len(retained),
                      'existing_assertions': assertions, 'handler_parity': parity, 'failures': failures}, indent=2))
    return bool(failures)


if __name__ == '__main__':
    raise SystemExit(main())
