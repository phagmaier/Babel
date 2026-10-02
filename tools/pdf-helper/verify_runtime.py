"""Verify a built or packaged PDF helper runtime against its BUILD.json.

Non-ELF files must be byte-identical. ELF files must keep identical code and
data sections (packagers may rewrite loader metadata) and executable bits.
No file may be missing or added.

Usage: python3 tools/pdf-helper/verify_runtime.py <runtime-dir> [--exact]
"""

import hashlib
import json
import os
import stat
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import elf_sections  # noqa: E402


def verify(root, exact=False):
    root = Path(root)
    manifest = json.loads((root / 'BUILD.json').read_text())
    problems, patched = [], []
    listed = set()
    for entry in manifest['entries']:
        path = root / entry['path']
        listed.add(entry['path'])
        if not path.is_file():
            problems.append(f"missing {entry['path']}")
            continue
        if entry['mode'] == 'x' and not os.stat(path).st_mode & stat.S_IXUSR:
            problems.append(f"not executable {entry['path']}")
        if hashlib.sha256(path.read_bytes()).hexdigest() == entry['sha256']:
            continue
        if not exact and 'elfSections' in entry and \
                elf_sections.section_hashes(path) == entry['elfSections']:
            patched.append(entry['path'])
            continue
        problems.append(f"changed {entry['path']}")
    for path in root.rglob('*'):
        relative = path.relative_to(root).as_posix()
        if path.is_file() and relative != 'BUILD.json' and relative not in listed:
            problems.append(f'unexpected {relative}')
    return {'treeSha256': manifest['treeSha256'], 'files': len(listed),
            'elfMetadataPatched': patched, 'problems': problems}


if __name__ == '__main__':
    report = verify(sys.argv[1], exact='--exact' in sys.argv)
    print(json.dumps(report, indent=2))
    sys.exit(1 if report['problems'] else 0)
