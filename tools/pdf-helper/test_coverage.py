"""Independent Fontconfig/FreeType review of the build-generated cmap inventory.

Uses installed fc-query only for inspection, outside the bundled renderer.
"""
import hashlib
import json
import subprocess
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


class CoverageTest(unittest.TestCase):
    def test_independent_fontconfig_inventory_and_pins(self):
        coverage = json.loads((REPO / 'src/domain/publicationCoverage.json').read_text())
        profile = REPO / 'tools/pdf-helper/profiles/us-letter-draft-v1.json'
        self.assertEqual(hashlib.sha256(profile.read_bytes()).hexdigest(), coverage['profileSha256'])
        for font in coverage['fonts']:
            path = REPO / 'target/pdf-helper/runtime/app/lib/screenplain/export/courier_prime' / font['file']
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), font['sha256'])
            independent = set()
            text = subprocess.check_output(['fc-query', '--format=%{charset}', str(path)], text=True)
            for item in text.split():
                ends = item.split('-')
                start = int(ends[0], 16)
                end = int(ends[-1], 16)
                independent.update(range(start, end + 1))
            generated = {code for start, end in font['ranges'] for code in range(start, end + 1)}
            # Fontconfig omits cmap entries for NUL and CR. ReportLab exposes
            # these control slots; CR is layout syntax, NUL is explicitly refused.
            self.assertEqual(generated - {0, 13}, independent, font['file'])
            self.assertTrue({ord(c) for c in 'Café Zoë Ångström — € ©'} <= generated)
            self.assertFalse({ord(c) for c in '中文😀אבג'} & generated)


if __name__ == '__main__':
    unittest.main()
