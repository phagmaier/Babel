"""Read-only SIMP-F structural, dispatch and frozen-byte boundary."""
import ast
import json
from pathlib import Path
import subprocess

BASE = 'ef0ff02'
SOURCES = {
    'src/app/Outline.tsx', 'src/app/WritingView.tsx', 'src/app/checkSession.ts', 'src/app/findSession.ts',
    'src/application/documents.ts', 'src/application/find.ts', 'src/application/manuscriptProjection.ts',
    'src/application/persistenceState.ts', 'src/application/publicationPreview.ts',
    'src/application/scriptCheck.ts', 'src/application/spellcheck.ts',
    *('src/editor/' + n + '.ts' for n in ['state', 'find', 'scriptCheck', 'outlineNavigation', 'replace',
                                       'sceneMoves', 'spellcheck', 'recentPosition', 'characterFocus', 'completion']),
}
DRILL = 'tests/native/writing-lifecycle/drill.py'
ALLOWED = SOURCES | {DRILL, 'TODO.md', 'docs/current-state.md', 'docs/test-evidence/AUDIT.md'}


def baseline(name):
    return subprocess.check_output(['git', 'show', f'{BASE}:{name}'], text=True)


def special(tree):
    return [ast.dump(n, include_attributes=False) for n in next(n for n in tree.body if isinstance(n, ast.Try)).body
            if isinstance(n, ast.If) and any(s in ast.unparse(n.test) for s in
                                            ['--persistence-two-instances', '--presentation', '--audit-fixes', '--editor-exit'])]


def main():
    failures = []
    names = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', BASE], text=True).splitlines()
    changed = subprocess.check_output(['git', 'diff', BASE, '--name-only'], text=True).splitlines()
    failures.extend('outside boundary: ' + n for n in changed if n not in ALLOWED)
    files = {n: Path(n).read_text() for n in SOURCES}
    for name, symbol in [('src/editor/state.ts', 'stampOf'), ('src/editor/state.ts', 'isCurrent'),
                         ('src/application/manuscriptProjection.ts', 'sameStamp')]:
        if 'export function ' + symbol + '(' not in files[name]:
            failures.append('missing helper: ' + symbol)
    if 'export const DOCUMENT_ERROR_CODES' not in files['src/application/documents.ts']:
        failures.append('missing error-code constant')
    if 'const errorCodes:' in files['src/application/persistenceState.ts']:
        failures.append('duplicate persistence allow-list')
    view = files['src/app/WritingView.tsx']
    if view.count('exclusive(async () =>') != 3 or view.count('      disposePosition();') != 1:
        failures.append('cleanup/throwing lock not deduplicated')
    # Each partial condition is deliberately outside the full-stamp substitution.
    partials = {
        'src/editor/spellcheck.ts': ['entry?.version === editorVersion(state)', 'scan.doc === view.state.doc', 'scan.version === editorVersion(view.state)'],
        'src/editor/completion.ts': ['offer.session !== editorOrigin(state).session', 'offer.version !== editorVersion(state)', 'issuedOffers.get(offer)!.doc !== state.doc', 'this.offer.session !== editorOrigin(view.state).session', 'this.offer.version !== editorVersion(view.state)'],
        'src/application/scriptCheck.ts': ['projection.session === retained.session', 'projection.doc === retained.doc', 'current.session !== projection.session', 'current.doc !== projection.doc'],
        'src/app/WritingView.tsx': ['current.doc !== view.state.doc', 'current.session !== editorOrigin(view.state).session', 'started.session === previous.session', 'started.doc === previous.doc'],
        'src/editor/characterFocus.ts': ['entry?.session === editorOrigin(state).session', 'entry.version === editorVersion(state)'],
        'src/application/manuscriptProjection.ts': ['previous.session === stamp.session', 'previous.doc === stamp.doc', 'previous.sourceSha256 === snapshot.sourceSha256'],
    }
    for name, values in partials.items():
        for value in values:
            if value not in files[name]:
                failures.append('partial guard changed: ' + name + ':' + value)
    before = ast.parse(baseline(DRILL))
    after = ast.parse(Path(DRILL).read_text())
    old_uniform = []
    for n in next(n for n in before.body if isinstance(n, ast.Try)).body:
        if isinstance(n, ast.If) and isinstance(n.test, ast.Compare) and len(n.body) == 3 and isinstance(n.body[0], ast.ImportFrom) and ast.unparse(n.body[-1]) == 'sys.exit(0)':
            old_uniform.append((n.test.left.value, n.body[0].module, n.body[0].names[0].name))
    tables = [n for n in after.body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'MODES' for t in n.targets)]
    if not tables or [item for group in ast.literal_eval(tables[0].value) for item in group] != old_uniform:
        failures.append('uniform dispatch changed or absent')
    if special(before) != special(after):
        failures.append('special dispatch branches changed')
    asserts = lambda tree: [ast.dump(n, include_attributes=False) for n in ast.walk(tree) if isinstance(n, ast.Assert)]
    if asserts(before) != asserts(after):
        failures.append('native drill assertions changed')
    evidence = baseline('docs/test-evidence/AUDIT.md')
    if not Path('docs/test-evidence/AUDIT.md').read_text().startswith(evidence):
        failures.append('earlier audit evidence changed')
    print(json.dumps({'base': BASE, 'retained_files': len([n for n in names if n not in ALLOWED]),
                      'uniform_modes': len(old_uniform), 'partial_guards': sum(map(len, partials.values())),
                      'native_assertions': len(asserts(before)), 'failures': failures}, indent=2))
    return bool(failures)


if __name__ == '__main__':
    raise SystemExit(main())
