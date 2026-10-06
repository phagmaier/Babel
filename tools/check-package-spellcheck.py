"""Check that a built AppDir's own Enchant finds its bundled Hunspell provider.

Loads the package's libenchant the way the package does and asks it which
providers exist. No window, dictionary write or network. A dictionary for
en_US is reported, not required: dictionaries are a host prerequisite.

    python3 tools/check-package-spellcheck.py target/release/bundle/appimage/babel.AppDir
"""
import ctypes
import json
import os
from pathlib import Path
import subprocess
import sys


def probe(library):
    enchant = ctypes.CDLL(library)
    enchant.enchant_broker_init.restype = ctypes.c_void_p
    enchant.enchant_get_version.restype = ctypes.c_char_p
    enchant.enchant_broker_dict_exists.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
    describe = ctypes.CFUNCTYPE(None, ctypes.c_char_p, ctypes.c_char_p, ctypes.c_char_p, ctypes.c_void_p)
    broker = ctypes.c_void_p(enchant.enchant_broker_init())
    providers = {}
    callback = describe(lambda name, _description, file, _data: providers.update({name.decode(): os.fsdecode(file)}))
    enchant.enchant_broker_describe(broker, callback, None)
    mapped = sorted({line.split(None, 5)[5].strip() for line in Path('/proc/self/maps').read_text().splitlines()
                     if len(line.split(None, 5)) == 6 and ('enchant' in line or 'hunspell' in line)})
    print(json.dumps({'enchant': enchant.enchant_get_version().decode(), 'providers': providers, 'mapped': mapped,
                      'en_US': bool(enchant.enchant_broker_dict_exists(broker, b'en_US'))}))


def main():
    if len(sys.argv) == 3 and sys.argv[1] == '--probe':
        return probe(sys.argv[2])
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    appdir = Path(sys.argv[1]).resolve(strict=True)
    libraries = appdir / 'usr/lib'
    # The package's AppRun puts its own libraries and data first, as here.
    env = {**os.environ, 'LD_LIBRARY_PATH': str(libraries),
           'XDG_DATA_DIRS': f'{appdir}/usr/share:/usr/share'}
    result = subprocess.run([sys.executable, __file__, '--probe', str(libraries / 'libenchant-2.so.2')],
                            env=env, capture_output=True, text=True)
    if result.returncode:
        raise SystemExit(f'Package Enchant could not be loaded:\n{result.stderr}')
    report = json.loads(result.stdout.splitlines()[-1])
    report['appDir'] = str(appdir)
    print(json.dumps(report, indent=2))
    inside = [path for path in report['mapped'] if path.startswith(str(libraries) + '/')]
    if (report['providers'].get('hunspell') != str(libraries / 'enchant-2/enchant_hunspell.so')
            or not any('libhunspell' in path for path in inside) or len(inside) != len(report['mapped'])):
        raise SystemExit('Package spellcheck is not self-contained: provider or Hunspell comes from outside it')
    return 0


if __name__ == '__main__':
    sys.exit(main())
