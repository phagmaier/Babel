"""Build the bundled offline PDF renderer helper (M5-01).

Fetches the pinned artifacts in `pins.json` into `target/pdf-helper/cache`
(build-time network only, each verified by SHA-256), assembles a trimmed
standalone CPython plus the pure wheels and a refusing Pillow stub, and publishes the result at
`target/pdf-helper/runtime`. `runtime/BUILD.json` lists every file with its
SHA-256 and a tree hash, so rebuilds can be compared exactly.

Usage: python3 tools/pdf-helper/build.py [--offline]
"""

import argparse
import hashlib
import json
import os
import shutil
import stat
import subprocess
import sys
import tarfile
import urllib.request
import zipfile
from pathlib import Path

import elf_sections

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
WORK = REPO / 'target' / 'pdf-helper'
CACHE = WORK / 'cache'
RUNTIME = WORK / 'runtime'

# Not needed to render PDFs: development tools, GUI, terminal and test support.
STDLIB_REMOVE = ['test', 'idlelib', 'tkinter', 'turtledemo', 'ensurepip', 'pydoc_data',
                 'sqlite3', 'curses', 'dbm', 'venv', 'site-packages',
                 'config-3.13-x86_64-linux-gnu', 'lib-dynload/_tkinter.cpython-313-x86_64-linux-gnu.so',
                 'lib-dynload/_dbm.cpython-313-x86_64-linux-gnu.so']
# The interpreter is statically linked; only bin/python3.13 and the stdlib are kept.
PYTHON_KEEP_TOP = ['bin', 'lib']


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1 << 20), b''):
            digest.update(block)
    return digest.hexdigest()


def fetch(name, url, expected, offline):
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / name
    if not path.exists():
        if offline:
            sys.exit(f'missing cached artifact {name} (offline build)')
        partial = path.with_suffix(path.suffix + '.part')
        with urllib.request.urlopen(url, timeout=120) as response, open(partial, 'wb') as out:
            shutil.copyfileobj(response, out)
        partial.rename(path)
    actual = sha256_file(path)
    if actual != expected:
        sys.exit(f'hash mismatch for {name}: expected {expected}, got {actual}')
    return path


def safe_extract_zip(path, dest):
    with zipfile.ZipFile(path) as archive:
        for info in archive.infolist():
            target = (dest / info.filename).resolve()
            if not str(target).startswith(str(dest.resolve()) + os.sep):
                sys.exit(f'unsafe path in {path.name}: {info.filename}')
        archive.extractall(dest)


def build(offline):
    pins = json.loads((HERE / 'pins.json').read_text())
    staging = WORK / 'staging'
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir(parents=True)

    python = pins['python']
    tarball = fetch(python['file'], python['url'], python['sha256'], offline)
    with tarfile.open(tarball) as archive:
        archive.extractall(staging, filter='data')
    root = staging / 'python'
    for entry in root.iterdir():
        if entry.name not in PYTHON_KEEP_TOP:
            shutil.rmtree(entry) if entry.is_dir() else entry.unlink()
    for entry in (root / 'bin').iterdir():
        if entry.name != 'python3.13':
            entry.unlink()
    for entry in (root / 'lib').iterdir():
        if entry.name != 'python3.13':
            shutil.rmtree(entry) if entry.is_dir() and not entry.is_symlink() else entry.unlink()
    stdlib = root / 'lib' / 'python3.13'
    for relative in STDLIB_REMOVE:
        target = stdlib / relative
        if target.is_dir():
            shutil.rmtree(target)
        elif target.exists():
            target.unlink()

    app = staging / 'app'
    lib = app / 'lib'
    lib.mkdir(parents=True)
    for wheel in pins['wheels']:
        safe_extract_zip(fetch(wheel['file'], wheel['url'], wheel['sha256'], offline), lib)
    # Ignore local bytecode so stray host-Python caches never enter the runtime.
    shutil.copytree(HERE / 'stubs' / 'PIL', lib / 'PIL', ignore=shutil.ignore_patterns('__pycache__'))
    for relative, expected in pins['fonts'].items():
        if sha256_file(lib / relative) != expected:
            sys.exit(f'pinned font hash mismatch: {relative}')
    shutil.copy2(HERE / 'babel_pdf_helper.py', app / 'babel_pdf_helper.py')
    shutil.copy2(HERE / 'pins.json', app / 'pins.json')
    shutil.copy2(HERE / 'frozen_profile.py', app / 'frozen_profile.py')
    shutil.copytree(HERE / 'profiles', app / 'profiles')

    licenses = staging / 'licenses'
    licenses.mkdir()
    shutil.copy2(stdlib / 'LICENSE.txt', licenses / 'CPython-LICENSE.txt')
    for info in sorted(lib.glob('*.dist-info')):
        for item in sorted(info.rglob('*')):
            if item.is_file() and ('licen' in item.name.lower() or 'copying' in item.name.lower()):
                name = info.name.split('-')[0] + '-' + '-'.join(item.relative_to(info).parts)
                shutil.copy2(item, licenses / name)
    ofl = lib / 'screenplain' / 'export' / 'courier_prime' / 'LICENSE' / 'OFL.txt'
    shutil.copy2(ofl, licenses / 'CourierPrime-OFL.txt')
    (licenses / 'INVENTORY.json').write_text(json.dumps({
        'python': {'file': python['file'], 'license': python['license'],
                   'staticComponents': python['staticComponents']},
        'wheels': [{k: w[k] for k in ('name', 'version', 'license')} for w in pins['wheels']],
        'fonts': {'family': 'Courier Prime', 'license': 'OFL-1.1'},
        'stubs': pins['stubs'],
        'note': 'Full license texts for the statically linked components listed above must be '
                'collected and confirmed before distribution (M6).',
    }, indent=2) + '\n')

    # Generate coverage from these verified font tables at build time. A pin
    # change requires deliberate review of the committed frontend inventory.
    coverage = subprocess.check_output([
        str(root / 'bin' / 'python3.13'), '-I', '-S', '-B',
        str(HERE / 'coverage.py'), str(lib),
        str(HERE / 'profiles' / 'us-letter-draft-v1.json'), str(HERE / 'pins.json')],
        env={'PATH': '/nonexistent'})
    expected_coverage = REPO / 'src' / 'domain' / 'publicationCoverage.json'
    if json.loads(coverage) != json.loads(expected_coverage.read_text()):
        sys.exit('font coverage inventory changed: regenerate and review publicationCoverage.json')

    # Precompile with the bundled interpreter so runtime `-B` never needs to
    # write bytecode; unchecked-hash pycs embed no timestamps, keeping the tree
    # hash reproducible. Force recompilation with a canonical source prefix;
    # otherwise co_filename embeds the checkout path (or upstream cached paths).
    interpreter = root / 'bin' / 'python3.13'
    for target in (stdlib, lib):
        subprocess.run([str(interpreter), '-I', '-S', '-m', 'compileall', '-f', '-q', '-j', '1',
                        '--invalidation-mode', 'unchecked-hash', '-s', str(staging),
                        '-p', '/babel-pdf-helper', str(target)],
                       check=True, env={'PATH': '/nonexistent'})

    files = []
    for path in sorted(staging.rglob('*')):
        if path.is_symlink() or not path.is_file():
            continue
        relative = path.relative_to(staging).as_posix()
        mode = 'x' if path.stat().st_mode & stat.S_IXUSR else '-'
        entry = {'path': relative, 'sha256': sha256_file(path), 'bytes': path.stat().st_size, 'mode': mode}
        if elf_sections.is_elf(path):
            entry['elfSections'] = elf_sections.section_hashes(path)
        files.append(entry)
    tree = hashlib.sha256()
    for item in files:
        tree.update(f"{item['path']}\0{item['sha256']}\0{item['mode']}\n".encode())
    manifest = {'protocol': 1, 'pins': hashlib.sha256((HERE / 'pins.json').read_bytes()).hexdigest(),
                'helper': sha256_file(HERE / 'babel_pdf_helper.py'),
                'files': len(files), 'bytes': sum(f['bytes'] for f in files),
                'treeSha256': tree.hexdigest(), 'entries': files}
    (staging / 'BUILD.json').write_text(json.dumps(manifest, indent=2) + '\n')

    if RUNTIME.exists():
        shutil.rmtree(RUNTIME)
    staging.rename(RUNTIME)
    print(json.dumps({'runtime': str(RUNTIME), 'files': manifest['files'],
                      'bytes': manifest['bytes'], 'treeSha256': manifest['treeSha256']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--offline', action='store_true', help='use only cached artifacts')
    build(parser.parse_args().offline)
