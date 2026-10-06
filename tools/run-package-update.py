"""M6-14 two installed AppImages, one disposable profile, native update/readback.

Desktop launches self-mount through GIO. Writing phases use the installed
files through the offline, development-hidden FUSE runner. Never owner data.
The old package cannot Add a word (no provider); a labelled dictionary fixture
is read and republished by its actual preferences UI before the update.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / 'tests/native/writing-lifecycle'))
from installed_launch import SESSION, launch_registered  # noqa: E402


def hashes(roots):
    return {str(p): hashlib.sha256(p.read_bytes()).hexdigest()
            for root in roots for p in sorted(root.rglob('*')) if p.is_file()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path)
    parser.add_argument('--previous', required=True, type=Path)
    parser.add_argument('--next', dest='next_image', type=Path,
                        default=REPO / 'target/release/bundle/appimage/babel_0.0.1_amd64.AppImage')
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    assert args.root.is_absolute() and args.root.is_dir(), 'Existing absolute disposable root required'
    args.output.mkdir(parents=True, exist_ok=False)
    profile = Path(tempfile.mkdtemp(prefix='babel-update-', dir=args.root)) / 'Zoë Writer'
    home = profile / 'home'; home.mkdir(parents=True)
    data = profile / 'data'; app = data / 'app.babel.screenwriter'; app.mkdir(parents=True, mode=0o700)
    install = home / 'Apps é/babel'
    env = {k: os.environ[k] for k in SESSION if k in os.environ}
    env.update(HOME=str(home), PATH='/usr/bin', XDG_DATA_HOME=str(data),
               XDG_CONFIG_HOME=str(profile / 'config'), XDG_CACHE_HOME=str(profile / 'cache'),
               GSETTINGS_BACKEND='memory')
    settings = {'enabled': True, 'language': 'en_US', 'added': [{'language': 'en_US', 'word': 'Zøëvexia'}]}
    encoded = json.dumps(settings, separators=(',', ':'), ensure_ascii=False).encode()
    seed = app / 'spellcheck-1.json'
    seed.write_text(json.dumps({'schemaVersion': 1, 'generation': 1, 'settings': settings,
                               'sha256': hashlib.sha256(encoded).hexdigest()}, ensure_ascii=False))
    seed.chmod(0o600)
    (profile / 'update-profile.json').write_text(json.dumps({'dictionaryFixture': settings}) + '\n')
    report = {'profile': str(profile), 'filesystem': subprocess.check_output(
        ['stat', '-f', '-c', '%T', str(profile)], text=True).strip(), 'dictionaryFixture': settings, 'error': None}
    report['tooling'] = hashes([REPO / 'tests/native/writing-lifecycle'])
    report['tooling'][str(Path(__file__).resolve())] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()

    def save():
        (args.output / 'update.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')

    def tool(action, image=None, expect=0):
        cmd = [sys.executable, str(REPO / 'tools/install-desktop.py'), action, '--install-dir', str(install)]
        if image:
            cmd += ['--appimage', str(image.resolve(strict=True))]
        result = subprocess.run(cmd, env=env, cwd=home, capture_output=True, text=True)
        assert (result.returncode == 0) == (expect == 0), result.stdout + result.stderr
        return json.loads(result.stdout) if expect == 0 else result.stderr.strip()

    def phase(mode, installed):
        phase_env = os.environ.copy()
        phase_env['BABEL_UPDATE_PROFILE_ROOT'] = str(profile)
        cmd = [sys.executable, str(REPO / 'tools/run-packaged-pilot.py'), str(args.root),
               '--output', str(args.output / mode), '--appimage', installed,
               '--hide-development', '--modes', mode]
        with (args.output / (mode + '.log')).open('w') as log:
            result = subprocess.run(cmd, env=phase_env, cwd=REPO, stdout=log, stderr=subprocess.STDOUT)
        # The next stage intentionally shares app state, but never replaces
        # its predecessor's raw driver/session/shutdown/screenshot evidence.
        artifacts = args.output / mode / 'profile-artifacts'; artifacts.mkdir()
        for path in profile.iterdir():
            if path.is_file() and path.suffix in ['.json', '.log', '.png']:
                shutil.copy2(path, artifacts / path.name)
        assert result.returncode == 0, f'{mode} failed; retain {log.name}'
        report[mode] = str(args.output / mode)
        save()

    try:
        report['previous'] = tool('install', args.previous)
        previous = Path(report['previous']['installed'])
        report['previousDesktop'] = launch_registered(env, home, install, args.output / 'previous-desktop')
        phase('update-prepare', str(previous))
        # Keep a literal pre-update backup as well as each app's original data.
        backup = args.output / 'pre-update-data'
        for name in ['files', 'data', 'config']:
            if (profile / name).exists():
                shutil.copytree(profile / name, backup / name)
        roots = [profile / 'files', app, profile / 'config']
        before = hashes(roots)
        report['beforeInstall'] = before
        report['next'] = tool('install', args.next_image)
        assert report['next']['sha256'] != report['previous']['sha256'], 'Two distinct packages required'
        assert report['next']['retainedPackages'] == 1 and hashes(roots) == before, 'Install changed app data'
        assert hashlib.sha256(previous.read_bytes()).hexdigest() == report['previous']['sha256']
        report['nextStatus'] = tool('status')
        save()
        report['nextDesktop'] = launch_registered(env, home, install, args.output / 'next-desktop')
        phase('update-verify', report['next']['installed'])
        # Installer's own unknown-future record must also refuse all mutations.
        manifest = install / 'install.json'; original = manifest.read_bytes()
        future = json.loads(original); future['schemaVersion'] = 999
        manifest.write_text(json.dumps(future))
        before_future = hashes([install, profile / 'files', data, profile / 'config'])
        report['futureInstaller'] = {action: tool(action, args.next_image if action == 'install' else None, expect=1)
                                     for action in ['install', 'status', 'uninstall']}
        assert hashes([install, profile / 'files', data, profile / 'config']) == before_future
        report['futureInstallerPreserved'] = True
        manifest.write_bytes(original)  # only undo this drill's explicit mutation
        before_uninstall = hashes(roots)
        report['uninstall'] = tool('uninstall')
        assert hashes(roots) == before_uninstall and not install.exists()
        assert not (data / 'applications/babel-desktop.desktop').exists()
        report['uninstallPreservedData'] = True
    except Exception as error:
        report['error'] = repr(error)
    save()
    print(json.dumps({'profile': str(profile), 'filesystem': report['filesystem'],
                      'error': report['error'], 'report': str(args.output / 'update.json')}, ensure_ascii=False))
    return 1 if report['error'] else 0


if __name__ == '__main__':
    sys.exit(main())
