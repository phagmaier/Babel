"""Mount the local AppImage with FUSE, then drive its AppRun offline.

Mounting stays outside the user namespace: fusermount cannot run there after
capabilities are dropped. The writing app and driver have loopback only and no
DAC override. Uses owned native harnesses and disposable profiles, never xdrive.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import selectors
import subprocess
import sys
from tempfile import mkdtemp
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--modes', nargs='+', default=['typed-export', 'recovery-shutdown', 'local-pilot'])
    args = parser.parse_args()
    repo = Path(__file__).resolve().parent.parent
    assert args.root.is_absolute() and args.root.is_dir(), 'Existing absolute disposable root required'
    args.output.mkdir(parents=True, exist_ok=False)
    image = repo / 'target/release/bundle/appimage/babel_0.0.1_amd64.AppImage'
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
