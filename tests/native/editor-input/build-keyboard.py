"""Disposable US physical-key helper, no app dependency or compositor setting changes."""
import hashlib
from pathlib import Path
import shlex
import subprocess
from urllib.request import urlopen
revision='d71be3a7b3f93b534a2823fd68cabd7ac2a02359'
data=urlopen(f'https://raw.githubusercontent.com/atx/wtype/{revision}/protocol/virtual-keyboard-unstable-v1.xml',timeout=15).read()
assert hashlib.sha256(data).hexdigest()=='7ad7870003ecd592cae47dc19d277a609b7f18fd7b7be012623cf3225a7294f5'
xml=Path('/tmp/babel-m3-08-virtual-keyboard.xml');xml.write_bytes(data)
subprocess.run(['wayland-scanner','client-header',str(xml),'/tmp/babel-m3-08-virtual-keyboard.h'],check=True)
subprocess.run(['wayland-scanner','private-code',str(xml),'/tmp/babel-m3-08-virtual-keyboard.c'],check=True)
keymap=Path('/tmp/babel-m3-08-us.xkb');keymap.write_bytes(subprocess.check_output(['xkbcli','compile-keymap','--layout','us'])+b'\0');keymap.chmod(0o600)
flags=shlex.split(subprocess.check_output(['pkg-config','--cflags','--libs','wayland-client'],text=True))
subprocess.run(['cc','-Wall','-Wextra','-Werror','-I/tmp',str(Path(__file__).with_name('keyboard.c')),'/tmp/babel-m3-08-virtual-keyboard.c',*flags,'-o','/tmp/babel-m3-08-keyboard'],check=True)
print('/tmp/babel-m3-08-keyboard')
