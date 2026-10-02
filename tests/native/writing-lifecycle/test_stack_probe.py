"""Synthetic mapping/identity checks, not native WebKit verification."""
import os
from pathlib import Path
import tempfile
import unittest

from stack_probe import identity, mapped_libraries, mapping_identity, record_passed, validate_mappings


class StackTests(unittest.TestCase):
    def test_mapping_paths_devices_inodes_and_segment_deduplication(self):
        maps = ('100-200 r--p 0 08:0a 123 /candidate/libwebkit2gtk-4.1.so.0.1\n'
                '200-300 r-xp 1 08:0a 123 /candidate/libwebkit2gtk-4.1.so.0.1\n'
                '300-400 r-xp 0 08:0a 456 /candidate/libjavascriptcoregtk-4.1.so.0.1\n'
                '400-500 rw-p 0 00:00 0\n'
                '500-600 r-xp 0 08:0a 999 /usr/lib/libc.so.6\n')
        libraries = mapped_libraries(maps)
        self.assertEqual(len(libraries), 2)
        self.assertEqual(libraries[0], {'path': '/candidate/libwebkit2gtk-4.1.so.0.1',
                                      'device': [8, 10], 'inode': 123})

    def test_escaped_paths_and_deleted_mapping_are_not_normalized_away(self):
        libraries = mapped_libraries('100-200 r-xp 0 01:02 3 /a\\040b/libwebkit2gtk-4.1.so.0 (deleted)')
        self.assertEqual(libraries[0]['path'], '/a b/libwebkit2gtk-4.1.so.0 (deleted)')
        expected = {'webkit': {**libraries[0], 'path': '/a b/libwebkit2gtk-4.1.so.0'}}
        missing, unexpected = validate_mappings(libraries, expected)
        self.assertEqual(missing, ['webkit'])
        self.assertEqual(unexpected, libraries)

    def test_same_path_different_inode_or_device_fails(self):
        expected = {'webkit': {'path': '/candidate/libwebkit2gtk-4.1.so.0',
                               'device': [8, 1], 'inode': 5, 'sha256': 'hash'}}
        for changes in [{'inode': 6}, {'device': [8, 2]}, {'path': '/usr/lib/libwebkit2gtk-4.1.so.0'}]:
            mapped = [{**expected['webkit'], **changes}]
            missing, unexpected = validate_mappings(mapped, expected)
            self.assertEqual(missing, ['webkit'])
            self.assertEqual(unexpected, mapped)

    def test_all_libraries_required_and_unexpected_parallel_copy_fails(self):
        webkit = {'path': '/candidate/libwebkit2gtk-4.1.so.0', 'device': [8, 1], 'inode': 1}
        jsc = {'path': '/candidate/libjavascriptcoregtk-4.1.so.0', 'device': [8, 1], 'inode': 2}
        expected = {'webkit': webkit, 'jsc': jsc}
        self.assertEqual(validate_mappings([webkit, jsc], expected), ([], []))
        self.assertEqual(validate_mappings([webkit], expected), (['jsc'], []))
        other = {**webkit, 'path': '/usr/lib/libwebkit2gtk-4.1.so.0'}
        self.assertEqual(validate_mappings([webkit, jsc, other], expected), ([], [other]))

    def test_identity_hash_and_inode_detect_replacement(self):
        with tempfile.TemporaryDirectory(dir=os.environ.get('BABEL_STACK_TEST_ROOT')) as folder:
            path = Path(folder) / 'library'
            path.write_bytes(b'first')
            link = Path(folder) / 'link'
            link.symlink_to(path)
            first = identity(link)
            self.assertEqual(first, identity(path))
            replacement = Path(folder) / 'replacement'
            replacement.write_bytes(b'second')
            os.replace(replacement, path)
            second = identity(link)
            self.assertEqual(first['path'], second['path'])
            self.assertNotEqual(first['inode'], second['inode'])
            self.assertNotEqual(first['sha256'], second['sha256'])

    def test_real_read_only_mapping_retains_stat_and_mapping_devices(self):
        with tempfile.TemporaryDirectory(dir=os.environ.get('BABEL_STACK_TEST_ROOT')) as folder:
            path = Path(folder) / 'libwebkit2gtk-4.1.so.0'
            path.write_bytes(b'independent synthetic library bytes')
            before = path.read_bytes()
            expected = mapping_identity(path)
            self.assertEqual({k: v for k, v in expected.items() if k != 'mappingDevice'}, identity(path))
            self.assertEqual(path.read_bytes(), before)
            self.assertEqual(mapping_identity(path), expected)
            mapped = {**expected, 'device': expected['mappingDevice']}
            self.assertEqual(validate_mappings([mapped], {'webkit': expected}), ([], []))

    def test_distinct_stat_and_mapping_devices_do_not_disable_device_check(self):
        expected = {'webkit': {'path': '/libwebkit2gtk-4.1.so.0', 'device': [0, 30],
                              'mappingDevice': [0, 28], 'inode': 5}}
        mapped = [{**expected['webkit'], 'device': [0, 28]}]
        self.assertEqual(validate_mappings(mapped, expected), ([], []))
        mapped[0]['device'] = [0, 31]
        missing, unexpected = validate_mappings(mapped, expected)
        self.assertEqual(missing, ['webkit'])
        self.assertEqual(unexpected, mapped)

    def test_exec_transition_keeps_each_observation_associated_with_its_name(self):
        library = {'path': '/candidate/libwebkit2gtk-4.1.so.0', 'device': [8, 1], 'inode': 5}
        app = {'path': '/candidate/babel-desktop', 'device': [8, 1], 'inode': 6}
        web = {'path': '/candidate/WebKitWebProcess', 'device': [8, 1], 'inode': 7}
        observations = [{**e, 'name': name, 'executable': e['path'], 'libraries': [library]}
                        for e, name in [(app, 'babel-desktop'), (web, 'WebKitWebProces')]]
        record = {'name': 'WebKitWebProces', 'firstName': 'babel-desktop', 'observations': observations}
        expected, executables = {'webkit': library}, {e['path']: e for e in [app, web]}
        self.assertTrue(record_passed(record, expected, executables))
        for changes in [{'name': 'babel-desktop'}, {'libraries': []}, {'inode': 8}]:
            self.assertFalse(record_passed({**record, 'observations': [
                observations[0], {**observations[1], **changes}]}, expected, executables))

    def test_driver_phase_cannot_substitute_for_missing_web_process_mappings(self):
        library = {'path': '/candidate/libwebkit2gtk-4.1.so.0', 'device': [8, 1], 'inode': 5}
        driver = {'path': '/candidate/WebKitWebDriver', 'device': [8, 1], 'inode': 6}
        web = {'path': '/candidate/WebKitWebProcess', 'device': [8, 1], 'inode': 7}
        observations = [{**e, 'name': name, 'executable': e['path'], 'libraries': []}
                        for e, name in [(driver, 'WebKitWebDriver'), (web, 'WebKitWebProces')]]
        record = {'name': 'WebKitWebProces', 'observations': observations}
        self.assertFalse(record_passed(record, {'webkit': library},
                                      {e['path']: e for e in [driver, web]}))

    def test_executable_identity_and_every_observed_library_copy_are_required(self):
        library = {'path': '/candidate/libwebkit2gtk-4.1.so.0', 'device': [8, 1], 'inode': 5}
        expected = {'webkit': library}
        executable = {'path': '/candidate/WebKitWebProcess', 'device': [8, 1], 'inode': 6}
        executables = {executable['path']: executable}
        good = {**executable, 'executable': executable['path'], 'libraries': [library]}
        record = {'name': 'WebKitWebProces', 'observations': [good]}
        self.assertTrue(record_passed(record, expected, executables))
        for changes in [{'executable': '/usr/lib/WebKitWebProcess'}, {'inode': 7},
                        {'libraries': [{**library, 'inode': 8}]}]:
            self.assertFalse(record_passed({**record, 'observations': [good, {**good, **changes}]},
                                          expected, executables))
        self.assertFalse(record_passed({**record, 'observations': []}, expected, executables))
        self.assertFalse(record_passed({**record, 'observations': [{**good, 'libraries': []}]},
                                      expected, executables))
        self.assertFalse(record_passed({'name': 'WebKitWebDriver',
            'observations': [{**good, 'libraries': []}]}, expected, executables))
        driver = {**executable, 'path': '/candidate/WebKitWebDriver'}
        self.assertTrue(record_passed({'name': 'WebKitWebDriver', 'observations': [
            {**good, 'executable': driver['path'], 'libraries': []}]}, expected,
            {driver['path']: driver}))


if __name__ == '__main__':
    unittest.main()
