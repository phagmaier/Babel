"""Namespace view structure only; not an IME or mount acceptance claim."""
from pathlib import Path
import tempfile
import unittest

from isolated_ime import build_usr_view


class UsrViewTest(unittest.TestCase):
    def test_merges_intersecting_directories_and_keeps_inputs_unchanged(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            system, package, view = (root / name for name in ['system', 'package', 'view'])
            for path in [system / 'bin', system / 'lib/host-only', package / 'bin',
                         package / 'lib/fcitx5', package / 'share/new']:
                path.mkdir(parents=True)
            (system / 'bin/tool').write_text('system')
            (system / 'bin/shared').write_text('old')
            (system / 'lib/host-only/library').write_text('host')
            (package / 'bin/shared').write_text('package')
            (package / 'lib/fcitx5/addon').write_text('addon')
            (package / 'share/new/data').write_text('data')
            before = {p: p.read_bytes() for tree in [system, package]
                      for p in tree.rglob('*') if p.is_file()}
            build_usr_view(system, package, system, view)
            self.assertEqual((view / 'bin/tool').read_text(), 'system')
            self.assertEqual((view / 'bin/shared').read_text(), 'package')
            self.assertEqual((view / 'lib/fcitx5/addon').read_text(), 'addon')
            self.assertEqual((view / 'share/new/data').read_text(), 'data')
            self.assertTrue((view / 'lib/host-only').is_symlink())
            self.assertEqual(before, {p: p.read_bytes() for p in before})
            (view / 'bin/tool').unlink()
            self.assertEqual((system / 'bin/tool').read_text(), 'system')

    def test_package_symlink_shadow_and_dangling_links_are_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            system, package, view = (root / name for name in ['system', 'package', 'view'])
            system.mkdir(); package.mkdir()
            (system / 'choice').mkdir()
            (system / 'host-target').mkdir()
            (system / 'host-target/extra').write_text('host only')
            (system / 'directory-link').symlink_to('host-target')
            (package / 'directory-link').mkdir()
            (package / 'directory-link/private').write_text('private directory')
            (package / 'target').write_text('private')
            (package / 'choice').symlink_to('target')
            (package / 'missing').symlink_to('not-present')
            build_usr_view(system, package, system, view)
            self.assertTrue((view / 'choice').is_symlink())
            self.assertEqual((view / 'choice').read_text(), 'private')
            self.assertTrue((view / 'missing').is_symlink())
            self.assertFalse((view / 'missing').exists())
            self.assertTrue((system / 'choice').is_dir())
            self.assertEqual((package / 'choice').readlink(), Path('target'))
            self.assertEqual((view / 'directory-link/private').read_text(), 'private directory')
            self.assertFalse((view / 'directory-link/extra').exists())


if __name__ == '__main__':
    unittest.main()
