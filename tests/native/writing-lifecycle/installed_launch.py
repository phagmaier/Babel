"""Install the AppImage into a disposable profile and start it from its desktop entry.

GIO resolves the registered entry by name, as a desktop launcher does: no
terminal, dev server, WebDriver or extracted folder. The AppImage mounts itself
with FUSE. Profile, install and data paths contain spaces and non-ASCII text.
The owner's own applications folder and app data are never written.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time

from process_watch import ProcessWatch, journal_scan
from shutdown_lifecycle import processes

REPO = Path(__file__).resolve().parents[3]
INSTALLER = REPO / 'tools/install-desktop.py'
SESSION = ['WAYLAND_DISPLAY', 'DISPLAY', 'XDG_RUNTIME_DIR', 'DBUS_SESSION_BUS_ADDRESS',
           'HYPRLAND_INSTANCE_SIGNATURE', 'XDG_CURRENT_DESKTOP', 'XDG_SESSION_TYPE', 'LANG']


def wait(check, description, timeout=30):
    until = time.monotonic() + timeout
    while time.monotonic() < until:
        result = check()
        if result:
            return result
        time.sleep(.1)
    raise AssertionError(description)


def tree(directory):
    # The graphics driver's shader cache is noise, not app state.
    return sorted(name for name in (str(p.relative_to(directory)) for p in directory.rglob('*'))
                  if '/mesa_shader_cache/' not in name)


def launch_registered(env, home, install_dir, output):
    """Launch an existing disposable entry, inspect FUSE, and close ordinarily."""
    output.mkdir(parents=True, exist_ok=False)
    entry = Path(env['XDG_DATA_HOME']) / 'applications/babel-desktop.desktop'
    subprocess.run(['desktop-file-validate', str(entry)], check=True)
    report = {}
    owned_package = b'APPIMAGE=' + os.fsencode(install_dir) + b'/'

    def app_processes():
        found = []
        for pid, process in processes().items():
            try:
                variables = Path(f'/proc/{pid}/environ').read_bytes().split(b'\0')
                if process['name'] == 'babel-desktop' and any(v.startswith(owned_package) for v in variables):
                    found.append(pid)
            except OSError:
                continue
        return found

    try:
        wm_class = re.search(r'^StartupWMClass=(.+)$', entry.read_text(), re.M)[1]

        assert not app_processes(), 'This disposable package path is already running'
        started = time.time()
        with (output / 'desktop-launch.log').open('w') as log:
            launch = subprocess.run(['gtk-launch', 'babel-desktop'], env=env, cwd=home, stdout=log, stderr=log)
        assert launch.returncode == 0, 'GIO did not resolve or start the registered entry'
        pid = wait(app_processes, 'Registered entry starts the packaged app')[0]
        watch = ProcessWatch(pid, output / 'processes.json')
        watch.started = started
        client = wait(lambda: [c for c in json.loads(subprocess.check_output(['hyprctl', '-j', 'clients']))
                               if c['pid'] == pid and c.get('class') == wm_class], 'Window with the registered class')[0]
        address = client['address']
        assert re.fullmatch(r'0x[0-9a-f]+', address)
        wait(lambda: any(p['name'] == 'WebKitWebProces' and p['parent'] == pid for p in processes().values()),
             'WebKit web process')
        variables = dict(v.split(b'=', 1) for v in Path(f'/proc/{pid}/environ').read_bytes().split(b'\0') if b'=' in v)
        package = Path(os.fsdecode(variables[b'APPIMAGE']))
        assert str(package) == json.loads((install_dir / 'install.json').read_text())['current'], 'Launcher started an old package'
        appdir = Path(os.fsdecode(variables[b'APPDIR']))
        executable = Path(os.readlink(f'/proc/{pid}/exe'))
        mapped = sorted({line.split(None, 5)[5].strip() for line in Path(f'/proc/{pid}/maps').read_text().splitlines()
                         if len(line.split(None, 5)) == 6 and re.search(r'enchant|hunspell|libwebkit2gtk|libgtk-3', line)})
        report['launch'] = {
            'package': str(package), 'packageSha256': hashlib.sha256(package.read_bytes()).hexdigest(),
            'pid': pid, 'class': client['class'], 'title': client['title'], 'size': client['size'],
            'executable': str(executable), 'appDir': str(appdir),
            'appDirFilesystem': subprocess.check_output(['stat', '-f', '-c', '%T', str(appdir)], text=True).strip(),
            'workingDirectory': os.readlink(f'/proc/{pid}/cwd'), 'mappedLibraries': mapped,
            'automation': b'TAURI_WEBVIEW_AUTOMATION' in variables,
            'developmentPathEntries': [p for p in os.fsdecode(variables.get(b'PATH', b'')).split(':')
                                       if re.search(r'mise|cargo|node|pnpm|rustup', p)]}
        assert executable == appdir / 'usr/bin/babel-desktop' and report['launch']['appDirFilesystem'].startswith('fuse')
        # The package's own WebKit needs this working directory; pickers start in
        # the home folder instead (picker-start mode in the packaged runner).
        assert report['launch']['workingDirectory'] == str(appdir / 'usr') and not report['launch']['automation']
        assert variables[b'OWD'] == os.fsencode(home), 'Desktop launch starts from the home folder'
        assert not report['launch']['developmentPathEntries']
        # Let the first paint and startup services settle before inspection.
        time.sleep(3)
        watch.sample()
        owned = {p['pid'] for p in watch.records.values() if 'firstMissing' not in p}
        sockets = subprocess.run(['ss', '-H', '-t', '-u', '-a', '-n', '-p'], capture_output=True, text=True, check=True)
        report['launch']['internetSockets'] = [line for line in sockets.stdout.splitlines()
                                              if any(f'pid={owned_pid},' in line for owned_pid in owned)]
        assert not report['launch']['internetSockets'], report['launch']['internetSockets']
        subprocess.run(['hyprctl', 'dispatch', 'hl.dsp.focus({ window = "address:' + address + '" })'],
                       check=True, stdout=subprocess.DEVNULL)
        time.sleep(.5)
        client = next(c for c in json.loads(subprocess.check_output(['hyprctl', '-j', 'clients'])) if c['address'] == address)
        x, y = client['at']; width, height = client['size']
        subprocess.run(['grim', '-g', f'{x},{y} {width}x{height}', str(output / 'installed-home.png')], check=True)
        report['launch']['profileFiles'] = tree(home)
        # Ordinary compositor close: the same request a writer's close key sends.
        subprocess.run(['hyprctl', 'dispatch', 'hl.dsp.window.close({ window = "address:' + address + '" })'],
                       check=True, stdout=subprocess.DEVNULL)

        def exited():
            watch.sample()
            return all('firstMissing' in p or p['state'] == 'Z' for p in watch.records.values())
        wait(exited, 'App and helpers exit after ordinary close')
        wait(lambda: not appdir.exists(), 'FUSE mount released')
        time.sleep(3)
        scan = journal_scan(watch.save(), output / 'crash-journal.json')
        report['close'] = {'ordinaryExit': True, 'mountReleased': True,
                           'crashEvents': scan['events'], 'crashAuditRead': scan['readPassed']}
        assert scan['readPassed'] and not scan['events'], scan
    except Exception as error:
        report['error'] = repr(error)
        raise
    finally:
        for pid in app_processes():
            report.setdefault('forcedCleanup', []).append(pid)
            os.kill(pid, 15)
        (output / 'registered-launch.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path, help='existing absolute disposable directory')
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--appimage', type=Path,
                        default=REPO / 'target/release/bundle/appimage/babel_0.0.1_amd64.AppImage')
    args = parser.parse_args()
    assert args.root.is_absolute() and args.root.is_dir(), 'Existing absolute disposable root required'
    args.output.mkdir(parents=True, exist_ok=False)
    image = args.appimage.resolve(strict=True)
    home = Path(tempfile.mkdtemp(prefix='babel-installed-', dir=args.root)) / 'Zoë Writer'
    data = home / 'My Data é'
    install_dir = home / 'Apps é' / 'babel'
    home.mkdir()
    # Only the live compositor/session bus addresses are inherited. PATH has no
    # mise/cargo/node shims and HOME hides the owner's toolchain caches.
    env = {name: os.environ[name] for name in SESSION if name in os.environ}
    env.update(HOME=str(home), PATH='/usr/bin', XDG_DATA_HOME=str(data),
               XDG_CONFIG_HOME=str(home / '.config'), XDG_CACHE_HOME=str(home / '.cache'),
               GSETTINGS_BACKEND='memory')
    owner_entry = Path(os.environ['HOME']) / '.local/share/applications/babel-desktop.desktop'
    owner_entry_before = owner_entry.exists()
    report = {'appImage': str(image), 'sha256': hashlib.sha256(image.read_bytes()).hexdigest(),
              'home': str(home), 'filesystem': subprocess.check_output(
                  ['stat', '-f', '-c', '%T', str(home)], text=True).strip(),
              'environment': sorted(env), 'error': None}

    def tool(*action):
        result = subprocess.run([sys.executable, str(INSTALLER), *action, '--install-dir', str(install_dir)],
                                env=env, cwd=home, capture_output=True, text=True)
        assert result.returncode == 0, result.stderr
        return json.loads(result.stdout)

    owned_package = b'APPIMAGE=' + os.fsencode(install_dir) + b'/'

    def app_processes():
        found = []
        for pid, process in processes().items():
            try:
                variables = Path(f'/proc/{pid}/environ').read_bytes().split(b'\0')
                # Only a package under this run's own install folder is ours.
                if process['name'] == 'babel-desktop' and any(v.startswith(owned_package) for v in variables):
                    found.append(pid)
            except OSError:
                continue
        return found

    def save():
        (args.output / 'installed-launch.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')

    try:
        installed = tool('install', '--appimage', str(image))
        package = Path(installed['installed'])
        entry = Path(installed['entry'])
        assert entry == data / 'applications/babel-desktop.desktop' and installed['sha256'] == report['sha256']
        subprocess.run(['desktop-file-validate', str(entry)], check=True)
        report.update(installed=installed, entryText=entry.read_text(), status=tool('status'))
        (args.output / 'babel-desktop.desktop').write_bytes(entry.read_bytes())
        launched = launch_registered(env, home, install_dir, args.output / 'registered')
        report.update(launched)
        save()
        before = [name for name in tree(home) if not name.startswith(('Apps é', 'My Data é/applications'))]
        report['uninstall'] = tool('uninstall')
        after = tree(home)
        assert not entry.exists() and not package.exists() and not install_dir.exists()
        assert [name for name in after if not name.startswith(('Apps é', 'My Data é/applications'))] == before
        gone = subprocess.run(['gtk-launch', 'babel-desktop'], env=env, cwd=home, capture_output=True, text=True)
        assert gone.returncode != 0 and not app_processes(), 'Removed entry must not start the app'
        report['uninstall'].update(retainedProfileFiles=before, launchAfterRemoval=gone.returncode)
        assert owner_entry.exists() == owner_entry_before, 'Owner applications folder changed'
        report['ownerApplicationsEntryExists'] = owner_entry_before
    except Exception as error:
        report['error'] = repr(error)
    finally:
        # A failed probe must not leave its disposable app on the desktop.
        for leftover in app_processes():
            report.setdefault('forcedCleanup', []).append(leftover)
            os.kill(leftover, 15)
    save()
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 1 if report['error'] else 0


if __name__ == '__main__':
    sys.exit(main())
