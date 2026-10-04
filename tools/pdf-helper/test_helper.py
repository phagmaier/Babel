"""Self-test for the built offline PDF renderer helper (M5-01).

Run after `python3 tools/pdf-helper/build.py`:
    python3 tools/pdf-helper/test_helper.py
Set BABEL_PDF_HELPER_RUNTIME to test a packaged runtime (for example the
`usr/lib/babel/pdf-helper` directory of an extracted AppImage).
Oracles are independent of the helper's own report: M1-03's recorded corpus
page counts, Poppler `pdfinfo`/`pdffonts`, and file-system observation.
"""

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BUILT = REPO / 'target' / 'pdf-helper' / 'runtime'
RUNTIME = Path(os.environ.get('BABEL_PDF_HELPER_RUNTIME', BUILT)).resolve()
PYTHON = RUNTIME / 'python' / 'bin' / 'python3.13'
sys.path.insert(0, str(Path(__file__).resolve().parent))
import verify_runtime  # noqa: E402
CORPUS = REPO / 'prototypes' / 'pdf' / 'corpus'
# M1-03 evidence: coverage/pagination/title-overflow/unicode render 2/6/3/2 Letter pages.
M1_PAGES = {'coverage.fountain': 2, 'pagination.fountain': 6,
            'title-overflow.fountain': 3, 'unicode.fountain': 2}
TIMINGS = []


def request(output, **overrides):
    value = {'protocol': 1, 'profile': 'screenplain-baseline', 'output': str(output)}
    value.update(overrides)
    return json.dumps(value)


def run(argument, source, *, runtime=RUNTIME, cwd=None, home=None, wrapper=()):
    env = {'PATH': '/nonexistent', 'LANG': 'C'}
    if home:
        env.update(HOME=str(home), TMPDIR=str(home))
    python = runtime / 'python' / 'bin' / 'python3.13'
    helper = runtime / 'app' / 'babel_pdf_helper.py'
    started = time.perf_counter()
    result = subprocess.run([*wrapper, str(python), '-I', '-S', '-B', str(helper), argument],
                            input=source, capture_output=True, env=env, cwd=cwd, timeout=120)
    TIMINGS.append(round((time.perf_counter() - started) * 1000))
    return result.returncode, json.loads(result.stdout or b'null'), result.stderr


def pdfinfo(path):
    out = subprocess.run(['pdfinfo', str(path)], capture_output=True, text=True, check=True).stdout
    return dict(line.split(':', 1) for line in out.splitlines() if ':' in line)


def tree_state(root):
    return {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(root.rglob('*')) if p.is_file() and not p.is_symlink()}


class HelperTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not PYTHON.exists():
            raise unittest.SkipTest('build the helper first: python3 tools/pdf-helper/build.py')
        report = verify_runtime.verify(RUNTIME, exact=RUNTIME == BUILT.resolve())
        assert not report['problems'], report['problems']
        cls.before = tree_state(RUNTIME)

    @classmethod
    def tearDownClass(cls):
        assert tree_state(RUNTIME) == cls.before, 'helper runs modified the runtime tree'

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix='babel-pdf-helper-test-'))
        self.out_dir = self.tmp / 'out'
        self.out_dir.mkdir()
        self.home = self.tmp / 'home'
        self.home.mkdir()
        self.cwd = self.tmp / 'cwd'
        self.cwd.mkdir()

    def tearDown(self):
        self.assertEqual(list(self.home.iterdir()), [], 'helper wrote into HOME/TMPDIR')
        self.assertEqual(list(self.cwd.iterdir()), [], 'helper wrote into its working directory')
        shutil.rmtree(self.tmp)

    def render(self, source, name='out.pdf', **kwargs):
        output = self.out_dir / name
        return output, *run(request(output), source, cwd=self.cwd, home=self.home, **kwargs)

    def test_m1_corpus_pages_size_fonts(self):
        for name, pages in M1_PAGES.items():
            source = (CORPUS / name).read_bytes()
            output, code, result, stderr = self.render(source, name + '.pdf')
            self.assertEqual(code, 0, stderr)
            self.assertTrue(result['ok'])
            info = pdfinfo(output)
            self.assertEqual(int(info['Pages']), pages, name)
            self.assertEqual(result['pageCount'], pages, name)
            self.assertIn('612 x 792 pts (letter)', info['Page size'])
            self.assertEqual(result['sourceSha256'], hashlib.sha256(source).hexdigest())
            self.assertEqual(result['sourceMap'], 'unsupported')
            self.assertFalse(result['profileFrozen'])
            self.assertEqual(oct(output.stat().st_mode & 0o777), '0o600')
            fonts = subprocess.run(['pdffonts', str(output)], capture_output=True, text=True,
                                   check=True).stdout
            self.assertIn('CourierPrime', fonts)
        self.assertEqual(len(result['fonts']), 4)

    def test_frozen_profile_literal_escapes(self):
        source = (r'!He walks. \[O.S.\] to\_do a\\b \_this\_ \*stars\* '
                  r'\[\[note\]\] [beat] a\b **bold** _under_ *italic*' + '\n').encode()
        output = self.out_dir / 'escapes.pdf'
        code, result, stderr = run(request(output, profile='us-letter-draft-v1'), source)
        self.assertEqual(code, 0, stderr)
        self.assertTrue(result['profileFrozen'])
        text = subprocess.run(['pdftotext', '-raw', str(output), '-'], capture_output=True,
                              text=True, check=True).stdout
        self.assertIn(r'He walks. [O.S.] to_do a\b _this_ *stars* [[note]] [beat] a\b',
                      text.replace('\n', ' '))
        self.assertIn('bold under italic', text.replace('\n', ' '))

    def test_frozen_escape_styles_and_title(self):
        source = (r'Title: \_Literal\_ [title] a\\b' + '\n\n' +
                  r'!\_this\_ _under_ **bold** *italic* \*stars\*' + '\n').encode()
        output = self.out_dir / 'escape-title.pdf'
        code, _, stderr = run(request(output, profile='us-letter-draft-v1'), source)
        self.assertEqual(code, 0, stderr)
        text = subprocess.run(['pdftotext', '-raw', str(output), '-'], capture_output=True,
                              text=True, check=True).stdout
        self.assertIn(r'_Literal_ [title] a\b', text)
        self.assertIn('_this_ under bold italic *stars*', text)
        program = ("import sys,json; sys.path[:0]=[sys.argv[1],sys.argv[2]]; "
                   "import frozen_profile as f; "
                   "s=f.parse(sys.stdin.read()); "
                   "print(json.dumps([(x.text, sorted(t.__name__ for t in x.styles)) "
                   "for x in s.paragraphs[0].lines[0].segments]))")
        result = subprocess.run([str(PYTHON), '-I', '-S', '-B', '-c', program,
                                 str(RUNTIME / 'app'), str(RUNTIME / 'app/lib')],
                                input=source, capture_output=True, check=True)
        self.assertEqual(json.loads(result.stdout), [
            ['_this_ ', []], ['under', ['Underline']], [' ', []],
            ['bold', ['Bold']], [' ', []], ['italic', ['Italic']], [' *stars*', []]])

    def test_assessment_oracle_printed_text(self):
        # AUDIT-D04: the shared corpus states what the frozen pipeline prints and
        # omits. Babel's export assessment is checked against the same cases.
        corpus = json.loads((REPO / 'fixtures/assessment/oracle.json').read_text(encoding='utf-8'))
        for index, case in enumerate(corpus['cases']):
            with self.subTest(case=case['name']):
                output = self.out_dir / f'oracle-{index}.pdf'
                code, _, stderr = run(request(output, profile=corpus['profile']),
                                      case['source'].encode('utf-8'))
                self.assertEqual(code, 0, stderr)
                text = ' '.join(subprocess.run(['pdftotext', '-raw', str(output), '-'],
                                               capture_output=True, text=True,
                                               check=True).stdout.split())
                for printed in case['prints']:
                    self.assertIn(' '.join(printed.split()), text)
                for omitted in case['omits']:
                    self.assertNotIn(omitted, text)

    def test_typed_scene_oracle(self):
        # AUDIT-D07: the bytes Babel's editor produces when the S07.2 sequence is
        # typed from empty (tests/contract/typed-scene.test.ts). Expectations are
        # hand-written from Fountain semantics, not generated by either side.
        fixture = json.loads((REPO / 'fixtures/assessment/typed-scene.json').read_text(encoding='utf-8'))
        source = fixture['source'].encode('utf-8')
        program = ("import sys,json; sys.path[:0]=[sys.argv[1],sys.argv[2]]; "
                   "import frozen_profile as f; from screenplain import types as t\n"
                   "s=f.parse(sys.stdin.read()); f.prepare(s)\n"
                   "speech=lambda d: [str(d.character), [[p, str(x)] for p, x in d.blocks]]\n"
                   "def row(p):\n"
                   "    if isinstance(p, t.DualDialog): return ['DualDialog', speech(p.left), speech(p.right)]\n"
                   "    if isinstance(p, t.Dialog): return ['Dialog', *speech(p)]\n"
                   "    if isinstance(p, t.Action):\n"
                   "        return ['Centered' if p.centered else 'Action', [str(x) for x in p.lines]]\n"
                   "    if isinstance(p, (t.Slug, t.Transition)): return [type(p).__name__, str(p.line)]\n"
                   "    if isinstance(p, t.Section): return ['Section', str(p.text), p.level]\n"
                   "    return [type(p).__name__]\n"
                   "print(json.dumps({'title': list(s.title_page), 'paragraphs': [row(p) for p in s]}))")
        parsed = subprocess.run([str(PYTHON), '-I', '-S', '-B', '-c', program,
                                 str(RUNTIME / 'app'), str(RUNTIME / 'app/lib')],
                                input=source, capture_output=True, check=True)
        self.assertEqual(json.loads(parsed.stdout),
                         {'title': [], 'paragraphs': fixture['paragraphs']})
        output = self.out_dir / 'typed-scene.pdf'
        code, result, stderr = run(request(output, profile=fixture['profile']), source)
        self.assertEqual(code, 0, stderr)
        self.assertEqual(result['pageCount'], len(fixture['pages']))
        for number, expected in enumerate(fixture['pages'], start=1):
            page = ''.join(subprocess.run(['pdftotext', '-raw', '-f', str(number), '-l', str(number),
                                           str(output), '-'], capture_output=True, text=True,
                                          check=True).stdout.split())
            at = 0
            for printed in expected:  # in order; narrow dual columns may wrap
                found = page.find(''.join(printed.split()), at)
                self.assertNotEqual(found, -1, (number, printed))
                at = found
            for omitted in fixture['omits']:
                self.assertNotIn(''.join(omitted.split()), page, (number, omitted))

    def test_scene_headings_keep_source_order(self):
        for name in M1_PAGES:
            source = (CORPUS / name).read_bytes()
            headings = [line.split(' #')[0] for line in source.decode('utf-8').splitlines()
                        if line.startswith(('INT. ', 'EXT. '))]
            output, code, _, stderr = self.render(source, name + '.pdf')
            self.assertEqual(code, 0, stderr)
            text = subprocess.run(['pdftotext', '-raw', str(output), '-'], capture_output=True,
                                  text=True, check=True).stdout
            positions = [text.find(heading) for heading in headings]
            self.assertNotIn(-1, positions, (name, headings))
            self.assertEqual(positions, sorted(positions), name)

    def test_identical_input_gives_identical_bytes(self):
        source = (CORPUS / 'pagination.fountain').read_bytes()
        first, *_ = self.render(source, 'a.pdf')
        second, *_ = self.render(source, 'b.pdf')
        self.assertEqual(first.read_bytes(), second.read_bytes())

    def test_bom_and_crlf_render_like_lf(self):
        source = (CORPUS / 'coverage.fountain').read_bytes()
        plain, *_ = self.render(source, 'plain.pdf')
        variant = b'\xef\xbb\xbf' + source.replace(b'\n', b'\r\n')
        crlf, code, result, _ = self.render(variant, 'crlf.pdf')
        self.assertEqual(code, 0)
        self.assertEqual(result['sourceSha256'], hashlib.sha256(variant).hexdigest())
        self.assertEqual(plain.read_bytes(), crlf.read_bytes())

    def test_offline_network_namespace(self):
        unshare = shutil.which('unshare')
        if not unshare:
            self.skipTest('unshare unavailable')
        probe = subprocess.run([unshare, '--user', '--net', 'true'], capture_output=True)
        if probe.returncode:
            self.skipTest('unprivileged network namespace unavailable')
        output, code, result, stderr = self.render((CORPUS / 'coverage.fountain').read_bytes(),
                                                   wrapper=(unshare, '--user', '--net'))
        self.assertEqual(code, 0, stderr)
        self.assertEqual(int(pdfinfo(output)['Pages']), 2)

    def assert_refused(self, argument, source, code, *, output=None, runtime=RUNTIME):
        status, result, _ = run(argument, source, runtime=runtime, cwd=self.cwd, home=self.home)
        self.assertEqual(status, 2)
        self.assertFalse(result['ok'])
        self.assertEqual(result['error']['code'], code)
        if output is not None:
            self.assertFalse(output.exists(), 'refused render left an output file')

    def test_request_refusals(self):
        out = self.out_dir / 'x.pdf'
        cases = [
            ('not json', 'bad-request'),
            (json.dumps({'protocol': 1, 'profile': 'screenplain-baseline'}), 'bad-request'),
            (request(out, extra=True), 'bad-request'),
            (request(out, protocol=2), 'unsupported-protocol'),
            (request(out, profile='us-letter-draft-v2'), 'unsupported-profile'),
            (request('relative.pdf'), 'output-invalid'),
            (request(self.tmp / 'missing' / 'x.pdf'), 'output-invalid'),
        ]
        for argument, code in cases:
            with self.subTest(code=code, argument=argument[:40]):
                self.assert_refused(argument, b'INT. ROOM - DAY\n', code, output=out)

    def test_existing_output_is_never_overwritten(self):
        out = self.out_dir / 'keep.pdf'
        out.write_bytes(b'previous export')
        self.assert_refused(request(out), b'INT. ROOM - DAY\n', 'output-exists')
        self.assertEqual(out.read_bytes(), b'previous export')

    def test_symlinked_output_is_refused(self):
        target = self.tmp / 'elsewhere.pdf'
        link = self.out_dir / 'link.pdf'
        link.symlink_to(target)
        self.assert_refused(request(link), b'INT. ROOM - DAY\n', 'output-exists')
        self.assertFalse(target.exists())

    def test_source_refusals_leave_no_output(self):
        out = self.out_dir / 'x.pdf'
        self.assert_refused(request(out), b'INT. ROOM\n\xff\xfe\n', 'invalid-utf8', output=out)
        big = b'A' * (16 * 1024 * 1024 + 1)
        self.assert_refused(request(out), big, 'source-too-large', output=out)

    def test_image_support_is_refused(self):
        code = ("import sys; sys.path.insert(0, sys.argv[1]); import PIL.Image\n"
                "try:\n    PIL.Image.open\nexcept ImportError as e:\n    print('refused', e)")
        result = subprocess.run([str(PYTHON), '-I', '-S', '-B', '-c', code, str(RUNTIME / 'app' / 'lib')],
                                capture_output=True, text=True, env={'PATH': '/nonexistent'},
                                cwd=self.cwd)
        self.assertIn('refused image support is not bundled', result.stdout, result.stderr)

    def test_changed_font_is_refused(self):
        copy = self.tmp / 'runtime'
        shutil.copytree(RUNTIME, copy, symlinks=True)
        font = copy / 'app' / 'lib' / 'screenplain' / 'export' / 'courier_prime' / 'Courier Prime.ttf'
        font.write_bytes(font.read_bytes()[:-1] + b'\0')
        out = self.out_dir / 'x.pdf'
        self.assert_refused(request(out), b'INT. ROOM - DAY\n', 'font-integrity', output=out,
                            runtime=copy)


if __name__ == '__main__':
    try:
        program = unittest.main(verbosity=2, exit=False)
        sys.exit(0 if program.result.wasSuccessful() else 1)
    finally:
        if TIMINGS:
            ordered = sorted(TIMINGS)
            print(json.dumps({'helperRuns': len(ordered), 'medianMs': ordered[len(ordered) // 2],
                              'maxMs': ordered[-1]}))
