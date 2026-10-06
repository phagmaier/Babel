"""User-level installer behavior on disposable profiles and a synthetic package."""
import contextlib
import importlib.util
import io
import json
import os
import shutil
import subprocess
import tempfile
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('install_desktop', ROOT / 'tools/install-desktop.py')
installer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(installer)

# Stands in for the AppImage runtime: extracts the two members the installer
# reads, otherwise records how the desktop launched it.
PACKAGE = '''#!/bin/sh
if [ "$1" = --appimage-extract ]; then
  mkdir -p "squashfs-root/$(dirname "$2")"
  case "$2" in
    *.desktop) printf '[Desktop Entry]\\nName=babel\\nIcon=babel-desktop\\nStartupWMClass=babel-desktop\\nExec=babel-desktop\\n' > "squashfs-root/$2" ;;
    *babel-desktop.png) printf 'synthetic icon %s' "MARKER" > "squashfs-root/$2" ;;
  esac
  exit 0
fi
printf '%s\\n' "$0" "$#" > "$BABEL_TEST_LAUNCH_RECORD"
'''
HOSTILE = 'Zoë Writer $HOME `id` 100 "q" \\ back'


class InstallDesktopTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.home = self.root / HOSTILE / 'home'
        self.home.mkdir(parents=True)
        self.env = {'HOME': str(self.home), 'XDG_DATA_HOME': str(self.home / 'data dir')}
        self.entry = self.home / 'data dir/applications/babel-desktop.desktop'
        self.install_dir = self.home / 'apps é'
        self.image = self.package('first')

    def package(self, marker):
        path = self.root / marker / 'babel_0.0.1_amd64.AppImage'
        path.parent.mkdir()
        path.write_text(PACKAGE.replace('MARKER', marker))
        path.chmod(0o755)
        return path

    def run_tool(self, action, image=None):
        argv = [action, '--install-dir', str(self.install_dir)]
        if image:
            argv += ['--appimage', str(image)]
        output = io.StringIO()
        with contextlib.redirect_stdout(output), contextlib.redirect_stderr(io.StringIO()):
            code = installer.main(argv, self.env)
        return code, json.loads(output.getvalue())

    def test_install_status_uninstall_leave_other_files(self):
        bystander = self.home / 'data dir/app.babel.screenwriter/recovery/draft.journal'
        bystander.parent.mkdir(parents=True)
        bystander.write_bytes(b'author content')
        code, report = self.run_tool('install', self.image)
        self.assertEqual(code, 0)
        package = Path(report['installed'])
        self.assertEqual(package.read_bytes(), self.image.read_bytes())
        self.assertTrue(os.access(package, os.X_OK))
        self.assertEqual(package.parent, self.install_dir)
        self.assertIn('Categories=Office;WordProcessor;\n', self.entry.read_text())
        self.assertEqual(self.run_tool('status')[1]['packageIntact'], True)
        code, removed = self.run_tool('uninstall')
        self.assertEqual((code, removed['keptChanged']), (0, []))
        self.assertFalse(self.entry.exists() or self.install_dir.exists())
        self.assertEqual(bystander.read_bytes(), b'author content')

    def test_update_retains_previous_package_and_repoints_entry(self):
        first = Path(self.run_tool('install', self.image)[1]['installed'])
        code, report = self.run_tool('install', self.package('second'))
        second = Path(report['installed'])
        self.assertEqual((code, report['retainedPackages']), (0, 1))
        self.assertNotEqual(first, second)
        self.assertEqual(first.read_bytes(), self.image.read_bytes())
        self.assertIn(report['sha256'], self.entry.read_text())
        # Reinstalling the same package is a no-op for retained content.
        self.assertEqual(self.run_tool('install', self.package('third-copy-of-first').parent.parent / 'first/babel_0.0.1_amd64.AppImage')[1]['retainedPackages'], 1)
        self.assertEqual(sorted(p.name for p in self.install_dir.glob('*.AppImage')), sorted([first.name, second.name]))

    def test_foreign_entry_and_changed_files_are_never_overwritten_or_deleted(self):
        self.entry.parent.mkdir(parents=True)
        self.entry.write_text('[Desktop Entry]\nName=someone else\n')
        with self.assertRaises(SystemExit):
            self.run_tool('install', self.image)
        self.assertEqual(self.entry.read_text(), '[Desktop Entry]\nName=someone else\n')
        self.assertFalse(self.install_dir.exists())
        self.entry.unlink()
        self.run_tool('install', self.image)
        self.entry.write_text(self.entry.read_text() + 'X-Edited=true\n')
        code, report = self.run_tool('uninstall')
        self.assertEqual((code, report['keptChanged']), (1, [str(self.entry)]))
        self.assertTrue(self.entry.exists())
        self.assertEqual(self.run_tool('status')[0], 1)

    def test_missing_package_and_unrepresentable_path_are_refused(self):
        with self.assertRaises(SystemExit):
            self.run_tool('install', self.root / 'absent.AppImage')
        with self.assertRaises(SystemExit):
            installer.exec_value('/tmp/line\nbreak')
        self.assertFalse(self.install_dir.exists())
        # GIO rejects an entry whose program path holds a percent sign.
        self.install_dir = self.home / '100% apps'
        with self.assertRaises(SystemExit):
            self.run_tool('install', self.image)
        self.assertFalse(self.install_dir.exists() or self.entry.exists())

    @unittest.skipUnless(shutil.which('gio') and shutil.which('desktop-file-validate'),
                         'GIO launcher and desktop-file-utils are not installed')
    def test_registered_entry_validates_and_launches_exact_path_through_gio(self):
        package = Path(self.run_tool('install', self.image)[1]['installed'])
        subprocess.run(['desktop-file-validate', str(self.entry)], check=True)
        record = self.root / 'launch record'
        env = {**os.environ, **self.env, 'BABEL_TEST_LAUNCH_RECORD': str(record)}
        subprocess.run(['gio', 'launch', str(self.entry)], env=env, check=True, timeout=30)
        until = time.monotonic() + 10
        while not record.exists() and time.monotonic() < until:
            time.sleep(.05)
        # No field code, shell expansion or word splitting reached the program.
        self.assertEqual(record.read_text().splitlines(), [str(package), '0'])


if __name__ == '__main__':
    unittest.main()
