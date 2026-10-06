"""Mount the local AppImage with FUSE, then drive its AppRun offline.

Mounting stays outside the user namespace: fusermount cannot run there after
capabilities are dropped. The writing app and driver have loopback only and no
DAC override. Uses owned native harnesses and disposable profiles, never xdrive.

`--hide-development` and `--mask` change only what the app can see: it starts
through bubblewrap with those folders empty and development programs
unreadable. The driver and input helpers keep the ordinary view.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import selectors
import shlex
import subprocess
import sys
from tempfile import mkdtemp
import time


DEVELOPMENT_PROGRAMS = ['python*', 'node', 'npm', 'npx', 'pnpm', 'cargo', 'rustc', 'rustup', 'git', 'mise']


def masked_launcher(path, appdir, directories, hide_development, repo):
    """Write the app-only bubblewrap start script; return what it hides."""
    home = Path.home()
    files = []
    if hide_development:
        directories = directories + [d for d in [home / '.cargo', home / '.rustup', home / '.local/share/mise',
                                                 home / '.local/share/pnpm', home / '.cache', repo / 'node_modules',
                                                 repo / 'src', repo / 'src-tauri', repo / 'crates', repo / 'tools',
                                                 repo / 'dist'] if d.is_dir()]
        files = sorted({str(f.resolve()) for pattern in DEVELOPMENT_PROGRAMS
                        for f in Path('/usr/bin').glob(pattern) if f.is_file()})
    directories = [str(d) for d in directories]
    # A forced WebDriver teardown kills the process it started, which is this
    # wrapper: without --die-with-parent the app behind it would survive.
    mounts = ['--die-with-parent', '--bind', '/', '/', '--dev-bind', '/dev', '/dev', '--proc', '/proc']
    for directory in directories:
        mounts += ['--tmpfs', directory]
    for file in files:
        mounts += ['--ro-bind', '/dev/null', file]
    # The app itself proves the masks before the package starts.
    audit = ('set -eu; ' + ''.join(f'test -z "$(ls -A {shlex.quote(d)})"; ' for d in directories)
             + ''.join(f'test ! -s {shlex.quote(f)}; ' for f in files) + 'exec "$@"')
    path.write_text('#!/bin/sh\nexec /usr/bin/bwrap ' + ' '.join(shlex.quote(m) for m in mounts)
                    + (' --setenv PATH /usr/bin' if hide_development else '')
                    + ' -- /bin/sh -c ' + shlex.quote(audit) + ' masked-package '
                    + shlex.quote(str(appdir / 'AppRun')) + ' "$@"\n')
    path.chmod(0o700)
    return {'directories': directories, 'files': files}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--modes', nargs='+', default=['typed-export', 'recovery-shutdown', 'local-pilot'])
    parser.add_argument('--appimage', type=Path, help='default: the release bundle; pass an installed package')
    parser.add_argument('--hide-development', action='store_true',
                        help='hide toolchains, caches, sources and system interpreters from the app')
    parser.add_argument('--mask', nargs='+', type=Path, default=[], metavar='DIRECTORY',
                        help='absolute system folders the app sees as empty')
    args = parser.parse_args()
    repo = Path(__file__).resolve().parent.parent
    assert args.root.is_absolute() and args.root.is_dir(), 'Existing absolute disposable root required'
    assert all(m.is_absolute() and m.is_dir() for m in args.mask), 'Masks must be existing absolute folders'
    args.output.mkdir(parents=True, exist_ok=False)
    image = (args.appimage or repo / 'target/release/bundle/appimage/babel_0.0.1_amd64.AppImage').absolute()
    report = {'appImage': str(image), 'sha256': hashlib.sha256(image.read_bytes()).hexdigest(),
              'method': 'FUSE mount outside namespace; mounted AppRun + WebKitWebDriver offline, capabilities dropped',
              'error': None}
    env = os.environ.copy()
    env.pop('APPIMAGE_EXTRACT_AND_RUN', None)
    with (args.output / 'mount.log').open('w') as log:
        mount = subprocess.Popen([str(image), '--appimage-mount'], env=env, stdout=subprocess.PIPE, stderr=log, text=True)
        try:
            with selectors.DefaultSelector() as selector:
                selector.register(mount.stdout, selectors.EVENT_READ)
                assert selector.select(30), 'FUSE mount did not provide its path'
                appdir = Path(mount.stdout.readline().strip())
            assert appdir.is_absolute() and appdir.name.startswith('.mount_') and (appdir / 'AppRun').is_file(), appdir
            report['mount'] = str(appdir)
            report['mountFilesystem'] = subprocess.check_output(['stat', '-f', '-c', '%T', str(appdir)], text=True).strip()
            assert report['mountFilesystem'].startswith('fuse'), report
            env.update(BABEL_NATIVE_BINARY=str(appdir / 'AppRun'), BABEL_SHUTDOWN_MODE='ordinary',
                       GTK_IM_MODULE='gtk-im-context-simple')
            if args.hide_development or args.mask:
                launcher = args.output.resolve() / 'masked-launch.sh'
                report['hiddenFromApp'] = masked_launcher(launcher, appdir, args.mask, args.hide_development, repo)
                env.update(BABEL_NATIVE_BINARY=str(launcher),
                           BABEL_MASKED_DIRECTORIES=os.pathsep.join(report['hiddenFromApp']['directories']))
            # A different filesystem is useful restore evidence, but still the
            # same laptop. It is explicitly not an independent physical backup.
            backup = Path(mkdtemp(prefix='babel-m6-16-backup-', dir='/tmp'))
            env['BABEL_PILOT_BACKUP_ROOT'] = str(backup)
            report['backupDestination'] = str(backup)
            cmd = ['unshare', '--user', '--map-current-user', '--keep-caps', '--net', '/bin/sh', '-c',
                   'ip link set lo up && exec setpriv --bounding-set=-all --inh-caps=-all --ambient-caps=-all "$@"',
                   'm6-16-offline', sys.executable, str(repo / 'tests/native/writing-lifecycle/integrated_exit.py'),
                   str(args.root), '--output', str(args.output / 'native'), '--modes', *args.modes]
            report['command'] = cmd
            started = time.monotonic()
            report['exitCode'] = subprocess.run(cmd, env=env, cwd=repo).returncode
            report['seconds'] = round(time.monotonic() - started, 3)
            assert report['exitCode'] == 0, 'Packaged native gate failed; retain native logs'
        except Exception as error:
            report['error'] = repr(error)
        finally:
            mount.terminate()
            mount.wait(timeout=15)
            mount.stdout.close()
    (args.output / 'package.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    return 1 if report['error'] else 0


if __name__ == '__main__':
    sys.exit(main())
