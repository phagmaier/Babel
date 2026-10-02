"""Synthetic ownership and fixture tests; not native UI or shutdown evidence."""
import unittest
from unittest.mock import patch

from audit_shutdown import ORACLES
from owned_accessibility import Accessibility, descendant
from plain_presentation import fixture
import hashlib


class OwnershipTests(unittest.TestCase):
    def test_live_root_ancestry_and_reused_root(self):
        root = {'pid': 10, 'start': '100'}
        inventory = {10: {**root, 'parent': 1}, 11: {'pid': 11, 'parent': 10, 'start': '110'},
                     12: {'pid': 12, 'parent': 11, 'start': '120'},
                     13: {'pid': 13, 'parent': 1, 'start': '130'}}
        self.assertTrue(descendant(12, root, inventory))
        self.assertFalse(descendant(13, root, inventory))
        self.assertFalse(descendant(99, root, inventory))
        inventory[10]['start'] = '999'
        self.assertFalse(descendant(12, root, inventory))
        del inventory[10]
        self.assertFalse(descendant(12, root, inventory))

    def test_owner_rebinding_refuses_action(self):
        a = Accessibility.__new__(Accessibility)
        node = {'bus': ':1.4', 'path': '/button', 'owner': {'pid': 10, 'start': '100'}}
        for replacement in [{'pid': 10, 'start': '101'}, {'pid': 11, 'start': '100'}]:
            with patch.object(a, 'find', return_value=node), patch.object(a, 'owner', return_value=replacement), patch.object(a, 'call') as call:
                with self.assertRaises(AssertionError):
                    a.act('Save')
                call.assert_not_called()

    def test_unrelated_focus_refuses_keyboard_input(self):
        a = Accessibility.__new__(Accessibility)
        with patch.object(a, 'clients', return_value=[{'address': '0xabc'}]), patch('owned_accessibility.subprocess.check_output', return_value=b'{"address":"0xdef"}'), patch('owned_accessibility.subprocess.run') as run:
            with self.assertRaises(AssertionError):
                a.keys('X')
            run.assert_not_called()

    def test_selection_waits_out_old_and_new_option_states_without_retyping(self):
        a = Accessibility.__new__(Accessibility)
        node = {'bus': ':1.1', 'path': '/combo', 'owner': {'pid': 10, 'start': '100'}}
        scans = [0]
        def call(bus, path, interface, method, *args):
            if method == 'GetChildren':
                if path == '/combo':
                    scans[0] += 1
                    return [[[':1.1', '/Light'], [':1.1', '/Dark']]]
                return [[]]
            if method == 'GetState':
                return [[1 << 23 if path == '/Dark' or scans[0] == 1 else 0, 0]]
            raise AssertionError(method)
        with patch.object(a, 'find', return_value=node), patch.object(a, 'focus_window'), patch.object(a, 'focus'), patch.object(a, 'validate'), patch.object(a, 'call', side_effect=call), patch.object(a, 'name', side_effect=lambda bus, path: path[1:]), patch.object(a, 'keys') as keys, patch('owned_accessibility.time.sleep'):
            self.assertEqual(a.choose('Theme', 2, 'Dark'), 'Dark')
            self.assertEqual(scans[0], 2)
            keys.assert_called_once()

    def test_fixed_manuscripts_match_existing_independent_oracles(self):
        for name, scenes in [('typical', 150), ('stress', 1500)]:
            source = fixture(scenes)
            self.assertEqual((len(source), hashlib.sha256(source).hexdigest()), ORACLES[name][:2])


if __name__ == '__main__':
    unittest.main()
