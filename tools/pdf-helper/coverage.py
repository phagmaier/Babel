"""Build-time cmap inventory using the pinned renderer's own TrueType reader.

Run with the bundled interpreter and an extracted app/lib. Coverage is checked
against the committed frontend inventory on every helper build, never inferred
from character categories. This script does not enter the runtime tree.
"""
import hashlib
import json
import sys
from pathlib import Path


def inventory(library, profile, pins):
    sys.path.insert(0, str(library))
    from reportlab.pdfbase.ttfonts import TTFontFile
    fonts = []
    for relative, expected in sorted(pins['fonts'].items()):
        path = library / relative
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != expected:
            raise ValueError('font-integrity: ' + relative)
        # Glyph zero is .notdef, never positive coverage.
        codes = sorted(code for code, glyph in TTFontFile(str(path)).charToGlyph.items() if glyph)
        ranges = []
        for code in codes:
            if ranges and ranges[-1][1] + 1 == code:
                ranges[-1][1] = code
            else:
                ranges.append([code, code])
        fonts.append({'file': path.name, 'sha256': actual, 'ranges': ranges})
    return {'profile': 'us-letter-draft-v1',
            'profileSha256': hashlib.sha256(profile.read_bytes()).hexdigest(),
            'fontSet': 'courier-prime-screenplain-0.12.0',
            'renderer': {'python': '3.13.16', 'screenplain': '0.12.0', 'reportlab': '4.4.7'},
            'fonts': fonts}


if __name__ == '__main__':
    library, profile, pins = map(Path, sys.argv[1:])
    print(json.dumps(inventory(library, profile, json.loads(pins.read_text())), indent=2))
