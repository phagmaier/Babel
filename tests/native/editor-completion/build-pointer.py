"""Build a disposable reference-host input helper; never part of the application."""
import hashlib
from pathlib import Path
import shlex
import subprocess
from urllib.request import urlopen

revision = 'b010a03648b88d143236de193bddbfea0c08bc84'
url = f'https://raw.githubusercontent.com/swaywm/wlr-protocols/{revision}/unstable/wlr-virtual-pointer-unstable-v1.xml'
data = urlopen(url, timeout=15).read()
assert hashlib.sha256(data).hexdigest() == '3ff6d540be0bc5228195bf072bde42117ea17945a5c2061add5d3cf97d6bb524'
xml = Path('/tmp/babel-m3-07-virtual-pointer.xml')
xml.write_bytes(data)
subprocess.run(['wayland-scanner', 'client-header', str(xml), '/tmp/babel-m3-07-virtual-pointer.h'], check=True)
subprocess.run(['wayland-scanner', 'private-code', str(xml), '/tmp/babel-m3-07-virtual-pointer.c'], check=True)
flags = shlex.split(subprocess.check_output(['pkg-config', '--cflags', '--libs', 'wayland-client'], text=True))
subprocess.run(['cc', '-Wall', '-Wextra', '-Werror', '-I/tmp', str(Path(__file__).with_name('pointer.c')),
                '/tmp/babel-m3-07-virtual-pointer.c', *flags, '-o', '/tmp/babel-m3-07-pointer'], check=True)
print('/tmp/babel-m3-07-pointer')
