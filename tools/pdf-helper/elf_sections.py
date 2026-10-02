"""Hash the code and data sections of an ELF64 file.

AppImage packaging (linuxdeploy/patchelf) rewrites loader metadata such as
RUNPATH and may move dynamic sections, so whole-file hashes of packaged ELF
files change. Matching hashes of these sections show the program code and
constant data are unchanged.
"""

import hashlib
import struct

SECTIONS = ('.init', '.text', '.fini', '.rodata', '.data')


def is_elf(path):
    with open(path, 'rb') as handle:
        return handle.read(4) == b'\x7fELF'


def section_hashes(path):
    with open(path, 'rb') as handle:
        data = handle.read()
    if data[:4] != b'\x7fELF' or data[4] != 2 or data[5] != 1:
        raise ValueError(f'{path}: not a little-endian ELF64 file')
    shoff, = struct.unpack_from('<Q', data, 0x28)
    shentsize, shnum, shstrndx = struct.unpack_from('<HHH', data, 0x3A)
    headers = [struct.unpack_from('<IIQQQQ', data, shoff + i * shentsize) for i in range(shnum)]
    names_offset = headers[shstrndx][4]
    result = {}
    for name_index, kind, _flags, _addr, offset, size in headers:
        end = data.index(b'\0', names_offset + name_index)
        name = data[names_offset + name_index:end].decode()
        if name in SECTIONS:
            # NOBITS sections (type 8) have no file content.
            content = b'' if kind == 8 else data[offset:offset + size]
            result[name] = hashlib.sha256(content).hexdigest()
    return result
