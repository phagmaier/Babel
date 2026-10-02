"""Observe candidate WebKit mappings in owned descendants of a native command.

Run inside isolated_ime.py so its child receives both IME and candidate paths.
This observer adds polling overhead; it does not replace byte/crash assertions.
"""
import argparse
import hashlib
import json
import mmap
import os
from pathlib import Path
import re
import subprocess
import time

from process_watch import ProcessWatch


LIBRARIES = ['libwebkit2gtk-4.1.so.0', 'libjavascriptcoregtk-4.1.so.0']


def identity(path):
    path = path.resolve(strict=True)
    stat = path.stat()
    return {'path': str(path), 'device': [os.major(stat.st_dev), os.minor(stat.st_dev)],
            'inode': stat.st_ino, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


def mapped_libraries(content):
    libraries = []
    for line in content.splitlines():
        fields = line.split(None, 5)
        if len(fields) != 6:
            continue
        path = re.sub(r'\\([0-7]{3})', lambda m: chr(int(m[1], 8)), fields[5])
        name = Path(path).name
        if not any(name.startswith(lib) for lib in LIBRARIES):
            continue
        item = {'path': path, 'device': [int(n, 16) for n in fields[3].split(':')],
                'inode': int(fields[4])}
        if item not in libraries:
            libraries.append(item)
    return libraries


def mapping_identity(path):
    expected = identity(path)
    # Btrfs stat can expose a subvolume device while /proc/maps exposes the
    # mapped inode's filesystem device. Observe the latter from our own FD,
    # rather than equating it with st_dev or dropping the device check.
    with Path(expected['path']).open('rb') as file:
        stat = os.fstat(file.fileno())
        if stat.st_ino != expected['inode'] or [os.major(stat.st_dev), os.minor(stat.st_dev)] != expected['device']:
            raise RuntimeError('Library changed while opening: ' + expected['path'])
        with mmap.mmap(file.fileno(), 0, access=mmap.ACCESS_READ):
            own = [m for m in mapped_libraries(Path('/proc/self/maps').read_text())
                   if m['path'] == expected['path'] and m['inode'] == expected['inode']]
            if len(own) != 1:
                raise RuntimeError('Cannot prove library mapping device: ' + expected['path'])
            expected['mappingDevice'] = own[0]['device']
    return expected


def validate_mappings(mapped, expected):
    missing = [lib for lib in expected if not any(
        m['path'] == expected[lib]['path'] and m['device'] == expected[lib].get('mappingDevice', expected[lib]['device'])
        and m['inode'] == expected[lib]['inode'] for m in mapped)]
    unexpected = [m for m in mapped if not any(
        m['path'] == e['path'] and m['device'] == e.get('mappingDevice', e['device']) and m['inode'] == e['inode']
        for e in expected.values())]
    return missing, unexpected


def record_passed(record, expected, executables):
    def executable_matches(observation):
        executable = executables.get(observation['executable'])
        return (executable is not None
            and Path(observation['executable']).name[:15] == observation.get('name', record['name'])
            and all(observation[key] == executable[key]
                    for key in ['device', 'inode']))

    observations = record['observations']
    valid = bool(observations) and all(any(executable_matches(o)
        and (o.get('name', record['name']) == 'WebKitWebDriver'
             or not any(validate_mappings(o['libraries'], expected)))
        for o in observations if o['executable'] == path)
        for path in {o['executable'] for o in observations})
    wrong = any(not executable_matches(o) or validate_mappings(o['libraries'], expected)[1]
                for o in observations)
    return valid and not wrong


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prefix', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ['--'] else args.command
    if not command:
        parser.error('a native command is required')
    prefix = args.prefix.resolve(strict=True)
    expected = {lib: mapping_identity(prefix / 'lib' / lib) for lib in LIBRARIES}
    driver = identity(prefix / 'bin/WebKitWebDriver')
    binary = identity(Path(os.environ.get('BABEL_NATIVE_BINARY',
        str(Path(__file__).resolve().parents[3] / 'target/release/babel-desktop'))))
    native = [identity(path) for path in
              (prefix / 'libexec/webkit2gtk-4.1').glob('WebKit*Process') if path.is_file()]
    if not native:
        parser.error('candidate WebKit process executables are missing')
    executables = {e['path']: e for e in [driver, binary, *native]}
    tooling = [identity(path) for path in sorted(Path(__file__).parent.glob('*.py'))]
    args.output.mkdir(parents=True, exist_ok=False)
    env = os.environ.copy()
    env['LD_LIBRARY_PATH'] = str(prefix / 'lib') + ':' + env.get('LD_LIBRARY_PATH', '')
    env['PATH'] = str(prefix / 'bin') + ':' + env.get('PATH', '')
    reports = {}
    last_saved = 0
    with subprocess.Popen(command, env=env) as child:
        watch = ProcessWatch(child.pid, args.output / 'processes.json')
        while True:
            watch.sample()
            for token, process in watch.records.items():
                proc = Path('/proc') / str(token[0])
                try:
                    before = (proc / 'stat').read_text()
                    if before[before.rfind(')') + 2:].split()[19] != token[1]:
                        continue
                    # A fork can first be observed under its parent's comm,
                    # before exec installs the native process name.
                    name = before[before.find('(') + 1:before.rfind(')')]
                    if name != 'babel-desktop' and not name.startswith('WebKit'):
                        continue
                    executable = str((proc / 'exe').resolve(strict=True))
                    stat = (proc / 'exe').stat()
                    mapped = mapped_libraries((proc / 'maps').read_text())
                    after = (proc / 'stat').read_text()
                    if (after[after.rfind(')') + 2:].split()[19] != token[1]
                            or after[after.find('(') + 1:after.rfind(')')] != name):
                        continue
                    record = reports.setdefault(token, {'pid': token[0], 'start': token[1],
                        'firstName': name, 'name': name, 'observations': [], 'readErrors': []})
                    record['name'] = name
                    observation = {'name': name, 'executable': executable, 'libraries': mapped,
                        'device': [os.major(stat.st_dev), os.minor(stat.st_dev)], 'inode': stat.st_ino}
                    if observation not in record['observations']:
                        record['observations'].append(observation)
                    record.setdefault('firstObserved', time.time())
                    record['lastObserved'] = time.time()
                except (OSError, ValueError) as error:
                    message = str(error)
                    if token in reports and message not in reports[token]['readErrors']:
                        reports[token]['readErrors'].append(message)
            if time.monotonic() - last_saved >= 1:
                (args.output / 'stack.json').write_text(json.dumps({
                    'command': command, 'expectedLibraries': expected,
                    'expectedExecutables': executables, 'processes': list(reports.values()),
                    'expectedTooling': tooling,
                    'status': 'in progress', 'passed': None}, indent=2) + '\n')
                last_saved = time.monotonic()
            if child.poll() is not None:
                break
            time.sleep(.05)
    failed = []
    for record in reports.values():
        record['passed'] = record_passed(record, expected, executables)
        if not record['passed']:
            failed.append({'pid': record['pid'], 'start': record['start']})
    roles_present = all(any(r['name'] == name for r in reports.values())
                        for name in ['babel-desktop', 'WebKitWebDriver', 'WebKitWebProces'])
    file_errors = []
    unchanged = True
    for e in [*executables.values(), *tooling]:
        try:
            if identity(Path(e['path'])) != e:
                unchanged = False
                file_errors.append('Changed: ' + e['path'])
        except OSError as error:
            unchanged = False
            file_errors.append(str(error))
    for e in expected.values():
        try:
            if mapping_identity(Path(e['path'])) != e:
                unchanged = False
                file_errors.append('Changed library: ' + e['path'])
        except (OSError, RuntimeError) as error:
            unchanged = False
            file_errors.append(str(error))
    report = {'command': command, 'commandExit': child.returncode,
              'status': 'complete',
              'expectedLibraries': expected, 'expectedDriver': driver,
              'expectedBinary': binary,
              'expectedExecutables': executables, 'fileCheckErrors': file_errors,
              'expectedTooling': tooling,
              'processes': list(reports.values()), 'failedTokens': failed,
              'requiredRolesObserved': roles_present, 'filesUnchanged': unchanged,
              'limitation': 'Owned-process polling can miss short lifetimes/mapping changes; observations add overhead.',
              'passed': child.returncode == 0 and roles_present and unchanged and not failed}
    (args.output / 'stack.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'stackPassed': report['passed'], 'nativeTokens': len(reports),
                      'failedTokens': failed}), flush=True)
    return int(not report['passed'])


if __name__ == '__main__':
    raise SystemExit(main())
