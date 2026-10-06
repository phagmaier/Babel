"""Install or remove the babel AppImage for the current user (M6-14).

Writes only below the chosen install directory and one desktop entry in the
user's XDG applications folder. No root, system package, MIME default or
global setting. Every distinct package keeps its own file, so an update never
overwrites the previous one. Screenplays and app data are never touched.

    python3 tools/install-desktop.py install
    python3 tools/install-desktop.py status
    python3 tools/install-desktop.py uninstall
"""
import argparse
import configparser
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parent.parent
DEFAULT_IMAGE = REPO / 'target/release/bundle/appimage/babel_0.0.1_amd64.AppImage'
ENTRY_NAME = 'babel-desktop.desktop'
MANIFEST = 'install.json'
PACKAGE_ENTRY = 'usr/share/applications/babel.desktop'


def sha256(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as stream:
        for block in iter(lambda: stream.read(1 << 20), b''):
            digest.update(block)
    return digest.hexdigest()


def checked_path(path):
    """Desktop entries are line based: refuse paths they cannot represent.

    GLib checks the program in Exec before it expands `%%`, so a registered
    entry whose path contains `%` never loads in GIO-based launchers.
    """
    text = str(path)
    if not Path(text).is_absolute() or '%' in text or any(ord(c) < 32 or ord(c) == 127 for c in text):
        raise SystemExit(f'Unsupported path for a desktop entry (control character or %): {text!r}; '
                         'choose another --install-dir')
    return text


def entry_string(value):
    """Desktop Entry string escaping: only the backslash needs doubling here."""
    return value.replace('\\', '\\\\')


def exec_value(path):
    """Quote one program path for Exec: shell quoting, then string escaping."""
    quoted = '"' + ''.join('\\' + c if c in '"`$\\' else c for c in checked_path(path)) + '"'
    return entry_string(quoted)


def desktop_entry(name, wm_class, image, icon, digest):
    return ''.join(line + '\n' for line in [
        '[Desktop Entry]',
        'Type=Application',
        'Name=' + entry_string(name),
        'GenericName=Screenwriting',
        'Comment=Local-first screenwriting',
        'Exec=' + exec_value(image),
        'TryExec=' + entry_string(checked_path(image)),
        'Icon=' + entry_string(checked_path(icon)),
        'Terminal=false',
        'Categories=Office;WordProcessor;',
        'StartupWMClass=' + entry_string(wm_class),
        'X-Babel-Package-SHA256=' + digest,
    ])


def data_home(env):
    value = env.get('XDG_DATA_HOME', '')
    return Path(value) if Path(value).is_absolute() else Path(env['HOME']) / '.local/share'


def locations(args, env):
    install = args.install_dir or Path(env['HOME']) / '.local/opt/babel'
    return install.absolute(), data_home(env) / 'applications' / ENTRY_NAME


def package_metadata(image, work):
    """Read name, window class and icon from the package's own desktop entry."""
    def extract(member):
        subprocess.run([str(image), '--appimage-extract', member], cwd=work, check=True,
                       stdout=subprocess.DEVNULL)
        path = work / 'squashfs-root' / member
        if not path.is_file():
            raise SystemExit(f'Package has no {member}')
        return path
    parser = configparser.RawConfigParser(interpolation=None)
    parser.optionxform = str
    parser.read_string(extract(PACKAGE_ENTRY).read_text(encoding='utf-8'))
    entry = parser['Desktop Entry']
    icon = extract(f'usr/share/icons/hicolor/256x256/apps/{entry["Icon"]}.png')
    return entry['Name'], entry['StartupWMClass'], icon


def write_new(path, data, mode):
    """Create through a synced temporary file, then rename over the destination."""
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix='.' + path.name + '.', dir=path.parent)
    try:
        with os.fdopen(handle, 'wb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    except BaseException:
        Path(temporary).unlink(missing_ok=True)
        raise


def read_manifest(install):
    path = install / MANIFEST
    if not path.is_file():
        return None
    manifest = json.loads(path.read_text(encoding='utf-8'))
    if manifest.get('schemaVersion') != 1:
        raise SystemExit(f'Unknown install record {path}; nothing was changed')
    return manifest


def install(args, env):
    image = args.appimage.absolute()
    if not image.is_file():
        raise SystemExit(f'No AppImage at {image}; build it with `pnpm tauri build`')
    directory, entry_path = locations(args, env)
    checked_path(directory)  # refuse before anything is written
    previous = read_manifest(directory)
    if entry_path.exists() and not (previous and previous['entry']['path'] == str(entry_path)
                                    and sha256(entry_path) == previous['entry']['sha256']):
        raise SystemExit(f'{entry_path} exists and was not written by this installer; nothing was changed')
    digest = sha256(image)
    package = directory / f'{image.stem}-{digest[:12]}{image.suffix}'
    directory.mkdir(parents=True, exist_ok=True)
    if package.exists():
        if sha256(package) != digest:
            raise SystemExit(f'{package} differs from its recorded content; nothing was changed')
    else:
        with tempfile.NamedTemporaryFile(prefix='.package.', dir=directory, delete=False) as stream:
            temporary = Path(stream.name)
        try:
            shutil.copyfile(image, temporary)
            if sha256(temporary) != digest:
                raise SystemExit('Copied package does not match its source; nothing was installed')
            temporary.chmod(0o755)
            with open(temporary, 'rb') as stream:
                os.fsync(stream.fileno())
            os.replace(temporary, package)
        finally:
            temporary.unlink(missing_ok=True)
    with tempfile.TemporaryDirectory(prefix='.metadata.', dir=directory) as work:
        name, wm_class, icon_source = package_metadata(package, Path(work))
        icon_bytes = icon_source.read_bytes()
    icon = directory / f'{wm_class}-{digest[:12]}.png'
    write_new(icon, icon_bytes, 0o644)
    entry = desktop_entry(name, wm_class, package, icon, digest).encode()
    packages = [p for p in (previous or {}).get('packages', []) if p['path'] != str(package)]
    packages.append({'path': str(package), 'sha256': digest, 'icon': str(icon),
                     'iconSha256': hashlib.sha256(icon_bytes).hexdigest()})
    manifest = {'schemaVersion': 1, 'current': str(package), 'packages': packages,
                'entry': {'path': str(entry_path), 'sha256': hashlib.sha256(entry).hexdigest()}}
    # Record first: an interrupted install leaves files the record can remove.
    write_new(directory / MANIFEST, (json.dumps(manifest, indent=2) + '\n').encode(), 0o644)
    write_new(entry_path, entry, 0o644)
    if shutil.which('update-desktop-database'):
        subprocess.run(['update-desktop-database', str(entry_path.parent)], check=False)
    print(json.dumps({'installed': str(package), 'sha256': digest, 'entry': str(entry_path),
                      'retainedPackages': len(packages) - 1, 'fuseHelper': fuse_helper()}, indent=2, ensure_ascii=False))
    if not fuse_helper():
        print('Warning: no fusermount3/fusermount found; the AppImage cannot mount itself.', file=sys.stderr)


def fuse_helper():
    return shutil.which('fusermount3') or shutil.which('fusermount')


def status(args, env):
    directory, entry_path = locations(args, env)
    manifest = read_manifest(directory)
    report = {'installDirectory': str(directory), 'entry': str(entry_path), 'installed': bool(manifest),
              'fuseHelper': fuse_helper()}
    if manifest:
        current = Path(manifest['current'])
        expected = next(p['sha256'] for p in manifest['packages'] if p['path'] == manifest['current'])
        report.update(current=str(current), packages=len(manifest['packages']),
                      packageIntact=current.is_file() and sha256(current) == expected,
                      entryIntact=entry_path.is_file() and sha256(entry_path) == manifest['entry']['sha256'])
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if not manifest or (report['packageIntact'] and report['entryIntact']) else 1


def uninstall(args, env):
    directory, entry_path = locations(args, env)
    manifest = read_manifest(directory)
    if not manifest:
        raise SystemExit(f'No install record in {directory}; nothing was removed')
    removed, kept = [], []
    owned = [(manifest['entry']['path'], manifest['entry']['sha256'])]
    for package in manifest['packages']:
        owned += [(package['path'], package['sha256']), (package['icon'], package['iconSha256'])]
    for name, digest in owned:
        path = Path(name)
        if not path.is_file():
            continue
        # A file changed since installation is not ours to delete.
        if sha256(path) == digest:
            path.unlink()
            removed.append(name)
        else:
            kept.append(name)
    if not kept:
        (directory / MANIFEST).unlink()
        try:
            directory.rmdir()
        except OSError:
            pass
    if shutil.which('update-desktop-database') and entry_path.parent.is_dir():
        subprocess.run(['update-desktop-database', str(entry_path.parent)], check=False)
    print(json.dumps({'removed': removed, 'keptChanged': kept,
                      'note': 'Screenplays, recovery data and preferences were not touched.'}, indent=2, ensure_ascii=False))
    return 1 if kept else 0


def main(argv=None, env=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('action', choices=['install', 'status', 'uninstall'])
    parser.add_argument('--appimage', type=Path, default=DEFAULT_IMAGE, help='package to install')
    parser.add_argument('--install-dir', type=Path, help='default: ~/.local/opt/babel')
    args = parser.parse_args(argv)
    return {'install': install, 'status': status, 'uninstall': uninstall}[args.action](args, env or os.environ) or 0


if __name__ == '__main__':
    sys.exit(main())
