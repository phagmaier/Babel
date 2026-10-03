"""Run integrated publication from an extracted AppImage, offline/no dev runtime.

The driver/app share an isolated loopback-only network; only the app enters the
mount namespace hiding development runtimes. No installation/settings change.
"""
import argparse
import json
import os
from pathlib import Path
import shlex
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('package', type=Path, help='extracted squashfs-root')
    parser.add_argument('filesystem', type=Path)
    args = parser.parse_args()
    package = args.package.resolve()
    assert (package / 'AppRun').is_file()
    assert (package / 'usr/lib/babel/pdf-helper/python/bin/python3.13').is_file()
    root = Path(tempfile.mkdtemp(prefix='babel-offline-launch-', dir=args.filesystem.resolve()))
    # Hide home-installed toolchains and temp caches, plus system interpreters.
    masked = sorted({str(p.resolve()) for pattern in ['python*', 'node', 'npm', 'npx', 'pnpm', 'cargo', 'rustc']
                     for p in Path('/usr/bin').glob(pattern) if p.is_file()})
    mounts = ['--ro-bind', '/', '/', '--proc', '/proc', '--dev-bind', '/dev', '/dev', '--tmpfs', '/home', '--tmpfs', '/tmp', '--tmpfs', '/opt',
              '--ro-bind', str(package), '/opt/babel-publication-package']
    for path in masked:
        mounts.extend(['--ro-bind', '/dev/null', path])
    for path in Path('/usr/lib').glob('python*'):
        if path.is_dir():
            mounts.extend(['--tmpfs', str(path)])
    # XDG_DATA_HOME is the fresh root chosen by drill.py, never an owner profile.
    audit = ('set -eu; root="$1"; shift; '
             + ''.join('test ! -s ' + shlex.quote(path) + '; ' for path in masked)
             + 'test ! -e /home/phagmaier/.local/share/mise; '
             + 'readlink /proc/self/ns/net > "$root/offline-network-namespace.txt"; '
             + 'cat /proc/net/route > "$root/offline-routes.txt"; '
             + 'exec /opt/babel-publication-package/AppRun "$@"')
    launcher = root / 'launch.sh'
    launcher.write_text('#!/bin/sh\nset -eu\nroot="${XDG_DATA_HOME%/data}"\nexec /usr/bin/bwrap '
        + ' '.join(shlex.quote(value) for value in mounts)
        + ' --bind "$root" "$root" --chdir /opt/babel-publication-package --setenv HOME "$root"'
        + ' --setenv PATH /usr/bin:/bin -- /bin/sh -c ' + shlex.quote(audit)
        + ' offline-publication "$root" "$@"\n')
    launcher.chmod(0o700)
    report = {'package': str(package), 'launcher': str(launcher), 'maskedSystemRuntimes': masked,
              'hostNetworkNamespace': os.readlink('/proc/self/ns/net'),
              'coverage': 'extracted AppRun; loopback-only network for app/driver; app home/temp toolchains hidden; host inspection external'}
    (root / 'launch.json').write_text(json.dumps(report, indent=2) + '\n')
    env = os.environ.copy()
    env['BABEL_NATIVE_BINARY'] = str(launcher)
    print('OFFLINE_LAUNCH', root, flush=True)
    # WebKit automation uses loopback between driver and app. Isolate both in
    # one network namespace, with only lo enabled; hide runtimes only in the app.
    result = subprocess.run(['unshare', '--user', '--map-current-user', '--keep-caps', '--net', '/bin/sh', '-c',
                             'ip link set lo up && exec setpriv --inh-caps=-all --ambient-caps=-all --bounding-set=-all -- "$@"', 'offline-publication',
                             os.sys.executable, str(Path(__file__).with_name('integrated_exit.py')),
                             str(args.filesystem.resolve()), '--modes', 'publication-exit',
                             '--output', str(root / 'matrix')], env=env)
    if result.returncode == 0:
        results = json.loads((root / 'matrix/results.json').read_text())
        assert len(results) == 1 and results[0]['crashAuditPassed']
        evidence = Path(results[0]['artifacts'])
        network = (evidence / 'offline-network-namespace.txt').read_text().strip()
        routes = (evidence / 'offline-routes.txt').read_text().splitlines()
        assert network != report['hostNetworkNamespace'], network
        assert all(line.split()[0] == 'lo' for line in routes[1:] if line.strip()), routes
        report.update(offlineNetworkVerified=True, appNetworkNamespace=network,
                      artifacts=str(evidence), routes=routes)
        (root / 'launch.json').write_text(json.dumps(report, indent=2) + '\n')
        print('PASS offline namespace witness, no external routes and app runtime masks', flush=True)
    raise SystemExit(result.returncode)


if __name__ == '__main__':
    main()
