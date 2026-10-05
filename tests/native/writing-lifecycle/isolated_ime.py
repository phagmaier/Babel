"""Run a native drill with verified, unpacked Fcitx packages; no installation.
The caller verifies package signatures and supplies the disposable prefix.
Only the private IME root is writable in the daemon's mount namespace.
"""
import argparse
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time


def build_usr_view(system_usr, package_usr, system_alias, view):
    """Read-only namespace union without kernel overlayfs or host mutation.

    Only package-intersecting directories are materialized. Other system
    entries link through a separately bound /usr, so links cannot loop through
    the replacement /usr. Package precedence matches the former overlay.
    """
    view.mkdir()
    names = {p.name for p in system_usr.iterdir()} if system_usr.is_dir() and not system_usr.is_symlink() else set()
    names.update(p.name for p in package_usr.iterdir())
    for name in sorted(names):
        package = package_usr / name
        system = system_usr / name
        destination = view / name
        if package.is_dir() and not package.is_symlink():
            build_usr_view(system, package, system_alias / name, destination)
        elif package.exists() or package.is_symlink():
            destination.symlink_to(package)
        else:
            destination.symlink_to(system_alias / name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('prefix', type=Path)
    parser.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    prefix = args.prefix.resolve(strict=True)
    command = args.command
    if command[:1] == ['--']:
        command = command[1:]
    if not command:
        parser.error('a drill command is required after the prefix')
    for path in ['usr/bin/fcitx5', 'usr/bin/fcitx5-remote',
                 'usr/lib/gtk-3.0/3.0.0/immodules/im-fcitx5.so',
                 'usr/lib/mozc/mozc_server',
                 'usr/share/fcitx5/inputmethod/pinyin.conf',
                 'usr/share/fcitx5/inputmethod/mozc.conf']:
        if not (prefix / path).is_file():
            parser.error('missing native prerequisite: ' + str(prefix / path))
    # Never replace an unrelated running input service or use an owner profile.
    owner = subprocess.check_output(['gdbus', 'call', '--session', '--dest',
        'org.freedesktop.DBus', '--object-path', '/org/freedesktop/DBus', '--method',
        'org.freedesktop.DBus.NameHasOwner', 'org.fcitx.Fcitx5'], text=True)
    if owner.strip() != '(false,)':
        parser.error('Fcitx service already owned; do not replace it')
    if (Path.home() / '.mozc').exists():
        parser.error('legacy personal Mozc profile exists; isolation not assured')
    # The retained /usr view uses many inodes. A task-owned Btrfs root avoids
    # exhausting tmpfs without deleting earlier evidence or widening mounts.
    temp_root = Path(os.environ.get('BABEL_NATIVE_IME_TEMP_ROOT', '/tmp')).resolve(strict=True)
    root = Path(tempfile.mkdtemp(prefix='babel-native-ime-', dir=temp_root))
    for name in ['config/fcitx5', 'data', 'cache']:
        (root / name).mkdir(parents=True)
    profile = '[Groups/0]\nName=Default\nDefault Layout=us\nDefaultIM=keyboard-us\n'
    for index, name in enumerate(['keyboard-us', 'pinyin', 'mozc']):
        profile += f'\n[Groups/0/Items/{index}]\nName={name}\nLayout=\n'
    (root / 'config/fcitx5/profile').write_text(profile + '\n[GroupOrder]\n0=Default\n')
    env = os.environ.copy()
    env.update(LD_LIBRARY_PATH=str(prefix / 'usr/lib'),
               PATH=str(prefix / 'usr/bin') + ':/tmp:' + env.get('PATH', ''),
               GTK_IM_MODULE='fcitx', GTK_IM_MODULE_FILE=str(root / 'immodules.cache'))
    module = prefix / 'usr/lib/gtk-3.0/3.0.0/immodules/im-fcitx5.so'
    with (root / 'immodules.cache').open('w') as cache:
        subprocess.run(['gtk-query-immodules-3.0', str(module)], env=env,
                       stdout=cache, check=True)
    daemon_env = env.copy()
    daemon_env.update(XDG_CONFIG_HOME=str(root / 'config'),
                      XDG_DATA_HOME=str(root / 'data'), XDG_CACHE_HOME=str(root / 'cache'))
    system_alias = root / 'system-usr'
    system_alias.mkdir()
    usr_view = root / 'usr-view'
    build_usr_view(Path('/usr'), prefix / 'usr', system_alias, usr_view)
    daemon_cmd = ['bwrap', '--die-with-parent', '--unshare-pid',
        '--ro-bind', '/', '/', '--proc', '/proc', '--bind', str(root), str(root),
        '--ro-bind', '/usr', str(system_alias),
        '--ro-bind', str(usr_view), '/usr',
        # Mozc validates /proc/<pid>/exe against its compiled server path.
        # The union's leaf symlinks fail that check; bind the verified directory
        # read-only at the expected path without widening writable mounts.
        '--ro-bind', str(prefix / 'usr/lib/mozc'), '/usr/lib/mozc', '/usr/bin/fcitx5', '-D', '-k', '--disable', 'all',
        '--enable', 'keyboard,dbus,dbusfrontend,pinyin,punctuation,mozc,classicui,wayland',
        '--ui', 'classicui']
    # Read-only bind view makes compiled engine paths available without overlayfs.
    # No xcb/waylandim/global keyboard frontend, cloud engine or autostart.
    (root / 'command.json').write_text(json.dumps({
        'prefix': str(prefix), 'daemon': daemon_cmd, 'drill': command}, indent=2) + '\n')
    print('IME ARTIFACTS', root, flush=True)
    daemon = None
    try:
        with (root / 'daemon.log').open('w') as log:
            daemon = subprocess.Popen(daemon_cmd, env=daemon_env, stdout=log,
                                      stderr=log, start_new_session=True)
            until = time.monotonic() + 15
            while True:
                if daemon.poll() is not None:
                    raise RuntimeError('isolated Fcitx exited; see daemon.log')
                owner = subprocess.check_output(['gdbus', 'call', '--session', '--dest',
                    'org.freedesktop.DBus', '--object-path', '/org/freedesktop/DBus',
                    '--method', 'org.freedesktop.DBus.NameHasOwner', 'org.fcitx.Fcitx5'], text=True)
                if owner.strip() == '(true,)':
                    break
                if time.monotonic() >= until:
                    raise RuntimeError('isolated Fcitx service did not start')
                time.sleep(.1)
            return subprocess.run(command, env=env).returncode
    finally:
        if daemon and daemon.poll() is None:
            os.killpg(daemon.pid, signal.SIGTERM)
            try:
                daemon.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(daemon.pid, signal.SIGKILL)
                daemon.wait()
        # The PID namespace also removes owned Mozc children on daemon exit.
        # Retain synthetic profiles/logs for independent audit; no deletion.


if __name__ == '__main__':
    sys.exit(main())
