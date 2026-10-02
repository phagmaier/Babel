"""Babel offline PDF renderer helper (M5-01).

Protocol 1. The caller runs the bundled interpreter as
`python3 -I -S -B babel_pdf_helper.py <request-json>` with an argument vector
(never a shell), writes the UTF-8 Fountain source bytes to stdin and closes it.
The request is a JSON object with exactly the keys `protocol`, `profile` and
`output`. `output` is an absolute path that must not exist; its parent must.

The helper creates only that file (exclusively, mode 0600), writes the PDF and
prints one JSON result object to stdout. It never uses the network, a shell or
any other path for writing. On failure it removes the file it created, prints
`{"ok": false, "error": {...}}` and exits with status 2.
"""

import hashlib
import io
import json
import os
import resource
import socket
import sys

PROTOCOL = 1
# M5-01 renders Screenplain's own layout. It is not the frozen M5-03 profile
# and makes no fidelity claim; Script Check assessment stays unavailable.
PROFILES = ('screenplain-baseline',)
MAX_SOURCE_BYTES = 16 * 1024 * 1024
MAX_OUTPUT_BYTES = 256 * 1024 * 1024
CPU_SECONDS = 60
ADDRESS_SPACE_BYTES = 2 * 1024 * 1024 * 1024

HERE = os.path.dirname(os.path.abspath(__file__))
LIB = os.path.join(HERE, 'lib')


class HelperError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


def _deny_network(*_args, **_kwargs):
    raise OSError('network access is disabled in the Babel PDF helper')


def _limit_resources():
    for limit, value in (
        (resource.RLIMIT_CPU, CPU_SECONDS),
        (resource.RLIMIT_AS, ADDRESS_SPACE_BYTES),
        (resource.RLIMIT_FSIZE, MAX_OUTPUT_BYTES),
        (resource.RLIMIT_CORE, 0),
    ):
        soft, hard = resource.getrlimit(limit)
        if hard != resource.RLIM_INFINITY:
            value = min(value, hard)
        resource.setrlimit(limit, (value, hard))


def _parse_request(argv):
    if len(argv) != 2:
        raise HelperError('bad-request', 'expected exactly one request argument')
    try:
        request = json.loads(argv[1])
    except ValueError as error:
        raise HelperError('bad-request', f'request is not JSON: {error}') from None
    if not isinstance(request, dict) or set(request) != {'protocol', 'profile', 'output'}:
        raise HelperError('bad-request', 'request must have exactly protocol, profile and output')
    if request['protocol'] != PROTOCOL:
        raise HelperError('unsupported-protocol', f'protocol {request["protocol"]!r} is not supported')
    if request['profile'] not in PROFILES:
        raise HelperError('unsupported-profile', f'profile {request["profile"]!r} is not available')
    output = request['output']
    if not isinstance(output, str) or not os.path.isabs(output) or '\0' in output:
        raise HelperError('output-invalid', 'output must be an absolute path')
    if not os.path.isdir(os.path.dirname(output)):
        raise HelperError('output-invalid', 'output directory does not exist')
    return request


def _read_source():
    data = sys.stdin.buffer.read(MAX_SOURCE_BYTES + 1)
    if len(data) > MAX_SOURCE_BYTES:
        raise HelperError('source-too-large', f'source exceeds {MAX_SOURCE_BYTES} bytes')
    try:
        # Babel sources are UTF-8; a leading BOM is source metadata, not text.
        text = data.decode('utf-8-sig')
    except UnicodeDecodeError as error:
        raise HelperError('invalid-utf8', f'source is not valid UTF-8 at byte {error.start}') from None
    return data, text


def _verify_fonts():
    with open(os.path.join(HERE, 'pins.json'), encoding='utf-8') as handle:
        pins = json.load(handle)
    fonts = []
    for relative, expected in sorted(pins['fonts'].items()):
        path = os.path.join(LIB, relative)
        try:
            with open(path, 'rb') as handle:
                digest = hashlib.sha256(handle.read()).hexdigest()
        except OSError:
            raise HelperError('font-integrity', f'pinned font missing: {relative}') from None
        if digest != expected:
            raise HelperError('font-integrity', f'pinned font changed: {relative}')
        fonts.append({'file': os.path.basename(relative), 'sha256': digest})
    return pins, fonts


def _render(text, output):
    sys.path.insert(0, LIB)
    import reportlab
    import reportlab.rl_config as rl_config
    # Fixed creation dates and document IDs: identical inputs give identical bytes.
    rl_config.invariant = 1
    from screenplain.export import pdf as pdf_export
    from screenplain.parsers import fountain

    class CountingTemplate(pdf_export.DocTemplate):
        last = None

        def __init__(self, *args, **kwargs):
            CountingTemplate.last = self
            super().__init__(*args, **kwargs)

    screenplay = fountain.parse(io.StringIO(text, newline=None))
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_CLOEXEC', 0)
    try:
        fd = os.open(output, flags, 0o600)
    except FileExistsError:
        raise HelperError('output-exists', 'output already exists') from None
    except OSError as error:
        raise HelperError('output-invalid', f'cannot create output: {error.strerror}') from None
    try:
        with os.fdopen(fd, 'wb') as handle:
            pdf_export.to_pdf(screenplay, handle, template_constructor=CountingTemplate)
            handle.flush()
            os.fsync(handle.fileno())
        pages = CountingTemplate.last.page
    except BaseException as error:
        try:
            os.unlink(output)
        except OSError:
            pass
        if isinstance(error, HelperError):
            raise
        raise HelperError('render-failed', f'{type(error).__name__}: {error}') from None
    return pages, reportlab.Version


def main(argv):
    _limit_resources()
    # Defense in depth: ReportLab imports urllib/ssl, so no socket may connect,
    # bind, send or resolve. Methods are replaced so subclasses stay valid.
    for name in ('connect', 'connect_ex', 'bind', 'sendto', 'sendmsg'):
        setattr(socket.socket, name, _deny_network)
    socket.create_connection = _deny_network
    socket.getaddrinfo = _deny_network
    try:
        request = _parse_request(argv)
        data, text = _read_source()
        pins, fonts = _verify_fonts()
        pages, reportlab_version = _render(text, request['output'])
    except Exception as error:
        if not isinstance(error, HelperError):
            error = HelperError('internal', f'{type(error).__name__}: {error}')
        json.dump({'protocol': PROTOCOL, 'ok': False,
                   'error': {'code': error.code, 'message': error.message}}, sys.stdout)
        sys.stdout.write('\n')
        return 2
    versions = {w['name']: w['version'] for w in pins['wheels']}
    json.dump({
        'protocol': PROTOCOL,
        'ok': True,
        'profile': request['profile'],
        'profileFrozen': False,
        'pageCount': pages,
        'sourceBytes': len(data),
        'sourceSha256': hashlib.sha256(data).hexdigest(),
        'renderer': {'screenplain': versions['screenplain'], 'reportlab': reportlab_version,
                     'python': '.'.join(map(str, sys.version_info[:3]))},
        'fonts': fonts,
        'sourceMap': 'unsupported',
        'warnings': [],
    }, sys.stdout)
    sys.stdout.write('\n')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
