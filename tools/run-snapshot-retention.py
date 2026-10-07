#!/usr/bin/env python3
"""M6-03 native snapshot retention: owned SIGKILL barriers and real low space.

Runs the production store in the core lib-test executable on verified tmpfs and
Btrfs roots. Fault barriers exist only in that test executable. A private 48 MiB
mount tests the actual free-space guard without filling the host filesystem.
--native also drives the production WebKit snapshot panel and ordinary Save.
All artifacts, including failures and the private mount contents, are retained.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import selectors
import shutil
import signal
import subprocess
import sys
import tempfile
import time

TEST = 'documents::linux::snapshot_store::tests::retention_drill_child'
STAGES = ['RecordRemoved', 'PruneSynced', 'BlobRemoved']
REPO = Path(__file__).resolve().parent.parent


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n')


def filesystem(path):
    return subprocess.check_output(['stat', '-f', '-c', '%T', str(path)], text=True).strip()


def run_case(binary, root, mode, output):
    env = {**os.environ, 'BABEL_RETENTION_DRILL_ROOT': str(root),
           'BABEL_RETENTION_DRILL_MODE': mode}
    cmd = [str(binary), '--exact', TEST, '--nocapture']
    report = {'mode': mode, 'root': str(root), 'filesystem': filesystem(root),
              'command': cmd, 'intentionalSigkill': mode in STAGES, 'error': None}
    started = time.monotonic()
    try:
        with (output / (mode + '.log')).open('w') as log:
            if mode not in STAGES:
                result = subprocess.run(cmd, env=env, stdout=log, stderr=subprocess.STDOUT, timeout=90)
                report['exitCode'] = result.returncode
                assert result.returncode == 0, f'{mode} child failed'
            else:
                with subprocess.Popen(cmd, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                      stderr=log) as child:
                    report['pid'] = child.pid
                    # /proc stat suffix starts at field 3; starttime is field 22.
                    report['startToken'] = Path(f'/proc/{child.pid}/stat').read_text().rsplit(')', 1)[1].split()[19]
                    deadline = time.monotonic() + 90
                    buffered = b''
                    with selectors.DefaultSelector() as selector:
                        selector.register(child.stdout, selectors.EVENT_READ)
                        try:
                            while True:
                                assert time.monotonic() < deadline, f'No {mode} barrier within 90s'
                                events = selector.select(max(0, deadline - time.monotonic()))
                                assert events, f'No {mode} barrier within 90s'
                                chunk = os.read(child.stdout.fileno(), 65536)
                                assert chunk, f'Child exited before {mode} barrier'
                                log.write(chunk.decode(errors='replace')); log.flush()
                                buffered += chunk
                                lines = buffered.split(b'\n')
                                buffered = lines.pop()
                                if ('BABEL_RETENTION_BARRIER:' + mode).encode() in lines:
                                    report['observedBarrier'] = mode
                                    child.kill()
                                    report['exitCode'] = child.wait(timeout=15)
                                    assert child.returncode == -signal.SIGKILL, 'Expected owned SIGKILL'
                                    break
                        finally:
                            if child.poll() is None:
                                child.kill(); child.wait(timeout=15)
                            child.stdin.close(); child.stdout.close()
        result_name = ('retention-fixture.json' if mode in STAGES else
                       'retention-reopen.json' if mode == 'reopen' else 'retention-low-space.json')
        oracle = json.loads((root / result_name).read_text())
        if mode not in STAGES:
            assert oracle['verified'] is True, 'Missing completed native byte oracle'
        report['nativeReport'] = str(root / result_name)
    except Exception as error:
        report['error'] = repr(error)
    report['seconds'] = round(time.monotonic() - started, 3)
    write_json(output / (mode + '.json'), report)
    print(json.dumps(report), flush=True)
    assert report['error'] is None, report['error']
    return report


def build_test(output):
    cmd = ['cargo', 'test', '-p', 'screenwriter-core', '--lib', '--locked', '--no-run', '--message-format=json']
    with (output / 'build.log').open('w') as log:
        result = subprocess.run(cmd, cwd=REPO, text=True, stdout=subprocess.PIPE, stderr=log)
    (output / 'build-artifacts.jsonl').write_text(result.stdout)
    assert result.returncode == 0, 'Core test executable build failed'
    artifacts = [json.loads(line) for line in result.stdout.splitlines() if line.startswith('{')]
    binaries = [Path(a['executable']) for a in artifacts if a.get('reason') == 'compiler-artifact'
                and a.get('executable') and a.get('profile', {}).get('test')
                and 'lib' in a.get('target', {}).get('kind', [])]
    assert len(binaries) == 1, binaries
    return binaries[0].resolve()


def private_low_space(args):
    """Internal: called only inside the private mount, with capabilities dropped."""
    mount = args.private_low_space.resolve(strict=True)
    available = os.statvfs(mount)
    assert filesystem(mount) == 'tmpfs' and available.f_bavail * available.f_frsize < 64 * 1024 * 1024
    status = Path('/proc/self/status').read_text().splitlines()
    caps = {line.split(':')[0]: line.split(':')[1].strip() for line in status if line.startswith('Cap')}
    assert all(int(value, 16) == 0 for value in caps.values()), caps
    assert os.getuid() != 0, 'Never launch GTK as root'
    write_json(args.output / 'low-space-environment.json',
               {'uid': os.getuid(), 'caps': caps, 'filesystem': filesystem(mount),
                'availableBytes': available.f_bavail * available.f_frsize, 'sizeBytes': available.f_blocks * available.f_frsize})
    try:
        core = mount / 'core'; core.mkdir(mode=0o700)
        run_case(args.test_binary, core, 'low-space', args.output)
        if args.native:
            for label, base in [('tmpfs', args.roots[0]), ('btrfs', args.roots[1])]:
                low = mount / ('ui-' + label); low.mkdir(mode=0o700)
                env = {**os.environ, 'BABEL_RETENTION_LOW_SPACE_ROOT': str(low),
                       'BABEL_SHUTDOWN_MODE': 'ordinary', 'GTK_IM_MODULE': 'gtk-im-context-simple'}
                if args.native_binary:
                    env['BABEL_NATIVE_BINARY'] = str(args.native_binary.resolve(strict=True))
                cmd = [sys.executable, str(REPO / 'tests/native/writing-lifecycle/integrated_exit.py'),
                       str(base), '--modes', 'snapshot-retention', '--output', str(args.output / ('native-' + label))]
                result = subprocess.run(cmd, env=env, cwd=REPO, timeout=300)
                manifest = args.output / ('native-' + label) / 'results.json'
                if manifest.is_file():
                    for index, case in enumerate(json.loads(manifest.read_text())):
                        if case.get('artifacts'):
                            shutil.copytree(case['artifacts'], args.output / f'native-{label}-files-{index}', symlinks=True)
                assert result.returncode == 0, f'{label} production panel drill failed'
    finally:
        shutil.copytree(mount, args.output / 'low-space-files', symlinks=True)
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('roots', nargs=2, type=Path, metavar='ROOT', help='existing absolute tmpfs and Btrfs disposable roots')
    parser.add_argument('--output', type=Path, required=True, help='fresh evidence directory')
    parser.add_argument('--test-binary', type=Path, help='prebuilt core lib-test executable; otherwise build once')
    parser.add_argument('--native', action='store_true', help='also run actual production WebKit/GTK panel drill')
    parser.add_argument('--native-binary', type=Path, help='default-release app; never a fixture-feature build')
    parser.add_argument('--private-low-space', type=Path, help=argparse.SUPPRESS)
    args = parser.parse_args()
    args.output = args.output.resolve()
    if args.private_low_space:
        return private_low_space(args)
    for root, expected in zip(args.roots, ['tmpfs', 'btrfs']):
        assert root.is_absolute() and root.is_dir(), 'Existing absolute disposable roots required'
        assert filesystem(root) == expected, f'{root} must be {expected}'
    tmp = os.statvfs('/tmp')
    assert tmp.f_favail > 4096, 'Insufficient /tmp inodes: stop before native drills'
    args.output.mkdir(parents=True, exist_ok=False)
    report = {'task': 'M6-03', 'error': None, 'tmpFreeInodes': tmp.f_favail, 'cases': []}
    started = time.monotonic()
    try:
        binary = (args.test_binary or build_test(args.output)).resolve(strict=True)
        report.update(testBinary=str(binary), testBinarySha256=hashlib.sha256(binary.read_bytes()).hexdigest())
        for label, base in zip(['tmpfs', 'btrfs'], args.roots):
            for stage in STAGES:
                root = Path(tempfile.mkdtemp(prefix='babel-retention-' + stage + '-', dir=base))
                output = args.output / (label + '-' + stage); output.mkdir()
                report['cases'].append(run_case(binary, root, stage, output))
                report['cases'].append(run_case(binary, root, 'reopen', output))
                shutil.copytree(root, output / 'retained-files', symlinks=True)
        mount = Path(tempfile.mkdtemp(prefix='babel-retention-low-space-', dir=args.roots[0]))
        child = [sys.executable, str(Path(__file__).resolve()), *map(str, args.roots),
                 '--output', str(args.output), '--test-binary', str(binary), '--private-low-space', str(mount)]
        if args.native:
            child.append('--native')
        if args.native_binary:
            child.extend(['--native-binary', str(args.native_binary.resolve(strict=True))])
        cmd = ['unshare', '--user', '--map-current-user', '--keep-caps', '--mount', '/bin/sh', '-c',
               'mount --make-rprivate / && mount -t tmpfs -o size=48m,mode=0700 tmpfs "$1" && shift && '
               'exec setpriv --bounding-set=-all --inh-caps=-all --ambient-caps=-all "$@"',
               'm6-03-private-mount', str(mount), *child]
        report['lowSpaceCommand'] = cmd
        with (args.output / 'low-space-runner.log').open('w') as log:
            result = subprocess.run(cmd, cwd=REPO, stdout=log, stderr=subprocess.STDOUT, timeout=720)
        report['lowSpaceExitCode'] = result.returncode
        assert result.returncode == 0, 'Private low-space/native drill failed; retain logs'
    except Exception as error:
        report['error'] = repr(error)
    report['seconds'] = round(time.monotonic() - started, 3)
    write_json(args.output / 'results.json', report)
    print(json.dumps(report, indent=2))
    return 1 if report['error'] else 0


if __name__ == '__main__':
    sys.exit(main())
