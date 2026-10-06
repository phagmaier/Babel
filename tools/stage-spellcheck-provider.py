"""Stage the Enchant Hunspell provider for the AppImage (M6-14).

Enchant looks for provider modules beside its own library. The bundler copies
libenchant into the package but not its `enchant-2/` folder, which left the
packaged app with no spelling provider on any host. This stages the module of
the Enchant the app links, and the Hunspell library that module loads, where
`tauri.conf.json` bundles them. Dictionaries stay a host prerequisite.

    python3 tools/stage-spellcheck-provider.py
"""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

REPO = Path(__file__).resolve().parent.parent
OUTPUT = REPO / 'target/spellcheck-provider'


def pkg_config(*arguments):
    return subprocess.check_output(['pkg-config', *arguments, 'enchant-2'], text=True).strip()


def main():
    provider = Path(pkg_config('--variable=libdir')) / 'enchant-2/enchant_hunspell.so'
    if not provider.is_file():
        raise SystemExit(f'No Enchant Hunspell provider at {provider}; see docs/development.md')
    loaded = subprocess.check_output(['ldd', str(provider)], text=True)
    engines = [Path(line.split('=>')[1].split()[0]) for line in loaded.splitlines()
               if line.strip().startswith('libhunspell') and '=>' in line and 'not found' not in line]
    if len(engines) != 1:
        raise SystemExit(f'Expected one resolved Hunspell library for {provider}:\n{loaded}')
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    staged = []
    for source, destination in [(provider, 'lib/enchant-2/' + provider.name),
                                (engines[0], 'lib/' + engines[0].name)]:
        target = OUTPUT / destination
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        target.chmod(0o755)
        staged.append({'source': str(source.resolve()), 'packagePath': 'usr/' + destination,
                       'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
    manifest = {'enchant': pkg_config('--modversion'), 'files': staged}
    (OUTPUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps(manifest))


if __name__ == '__main__':
    sys.exit(main())
