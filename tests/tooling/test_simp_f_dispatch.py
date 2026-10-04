"""AST-only dispatcher checks; importing drill would start a native driver."""
import ast
import builtins
from pathlib import Path
from types import SimpleNamespace
import unittest

DRILL = Path(__file__).resolve().parents[1] / 'native/writing-lifecycle/drill.py'
EXPECTED = [
    ('--external-reload', 'external_reload', 'run'),
    ('--persistence-paths', 'persistence_paths', 'run'),
    ('--daily-session', 'integrated_workflows', 'run'),
    ('--spellcheck', 'spellcheck_workflows', 'run'),
    ('--home', 'home_workflows', 'run'),
    ('--find-timing', 'find_workflows', 'run_timing'),
    ('--find', 'find_workflows', 'run'),
    ('--replace', 'replace_workflows', 'run'),
    ('--replace-smoke', 'replace_workflows', 'run_smoke'),
    ('--commands', 'command_workflows', 'run'),
    ('--characters', 'character_workflows', 'run'),
    ('--publication-preview', 'publication_preview', 'run'),
    ('--publication-exit', 'publication_exit', 'run'),
    ('--pdf-export', 'pdf_export', 'run'),
    ('--script-check', 'scriptcheck_workflows', 'run'),
    ('--title-page', 'title_page', 'run'),
    ('--scene-moves', 'scene_moves', 'run'),
    ('--workflow-protection', 'workflow_protection', 'run'),
    ('--outline', 'outline_workflows', 'run'),
    ('--recents', 'recent_projects', 'run'),
    ('--latency-review', 'editor_exit', 'review_latency'),
    ('--capture-review', 'editor_exit', 'review_capture'),
]


def load(flags):
    tree = ast.parse(DRILL.read_text())
    table = next(n for n in tree.body if isinstance(n, ast.Assign)
                 and any(isinstance(t, ast.Name) and t.id == 'MODES' for t in n.targets))
    dispatcher = next(n for n in tree.body if isinstance(n, ast.FunctionDef)
                      and n.name == 'dispatch_modes')
    block = next(n for n in tree.body if isinstance(n, ast.Try)).body
    first = next(i for i, n in enumerate(block) if isinstance(n, ast.Expr)
                 and isinstance(n.value, ast.Call) and isinstance(n.value.func, ast.Name)
                 and n.value.func.id == 'dispatch_modes')
    last = next(i for i, n in enumerate(block) if isinstance(n, ast.If)
                and ast.unparse(n.test) == "'--editor-exit' in sys.argv")
    calls = []
    imports = []
    token = object()

    def module(name):
        imports.append(name)
        return SimpleNamespace(**{function: lambda *args, _function=function, **kwargs:
                                  calls.append((name, _function, args, kwargs))
                                  for function in ['run', 'run_timing', 'run_smoke', 'two_instances',
                                                   'audit_fixes', 'review_latency', 'review_capture']})

    def exit_(code):
        raise SystemExit(code)

    env = {'__name__': 'owned-drill', 'sys': SimpleNamespace(argv=flags, modules={'owned-drill': token}, exit=exit_),
           'importlib': SimpleNamespace(import_module=module),
           '__builtins__': {**vars(builtins), '__import__': lambda name, *args, **kwargs: module(name)}}
    exec(compile(ast.Module(body=[table, dispatcher], type_ignores=[]), str(DRILL), 'exec'), env)
    code = compile(ast.Module(body=block[first:last + 1], type_ignores=[]), str(DRILL), 'exec')
    return env, calls, imports, token, code


class DispatchTests(unittest.TestCase):
    def test_all_uniform_entries_lazy_import_exact_runner_and_owned_context(self):
        for flag, module, function in EXPECTED:
            with self.subTest(flag=flag):
                env, calls, imports, token, code = load([flag])
                self.assertEqual([x for group in env['MODES'] for x in group], EXPECTED)
                self.assertEqual(imports, [])
                with self.assertRaises(SystemExit) as exit_:
                    exec(code, env)
                self.assertEqual(exit_.exception.code, 0)
                self.assertEqual(imports, [module])
                self.assertEqual(calls, [(module, function, (token,), {})])

    def test_no_match_does_not_import_or_exit(self):
        env, calls, imports, _, code = load(['--unrelated'])
        exec(code, env)
        self.assertEqual(calls, [])
        self.assertEqual(imports, [])

    def test_first_match_priority_across_special_boundaries(self):
        for flags, expected in [
            (['--daily-session', '--persistence-two-instances-shared'], 'two_instances'),
            (['--persistence-two-instances', '--persistence-paths'], 'run'),
            (['--publication-preview', '--presentation'], 'run'),
            (['--presentation', '--characters'], 'run'),
            (['--editor-exit', '--capture-review'], 'review_capture'),
        ]:
            env, calls, _, _, code = load(flags)
            with self.assertRaises(SystemExit):
                exec(code, env)
            self.assertEqual(calls[0][1], expected)
            self.assertEqual(calls[0][0], {
                '--daily-session': 'persistence_paths', '--persistence-two-instances': 'persistence_paths',
                '--publication-preview': 'presentation_workflows', '--presentation': 'character_workflows',
                '--editor-exit': 'editor_exit',
            }[flags[0]])

    def test_special_arguments_and_fallthrough_remain_explicit(self):
        for flag, shared in [('--persistence-two-instances', False), ('--persistence-two-instances-shared', True)]:
            env, calls, _, _, code = load([flag])
            with self.assertRaises(SystemExit):
                exec(code, env)
            self.assertEqual(calls[0][3], {'shared_data': shared})
        env, calls, _, _, code = load(['--presentation', '--presentation-no-restart', '--presentation-control', 'no-zoom'])
        with self.assertRaises(SystemExit):
            exec(code, env)
        self.assertEqual(calls[0][3], {'restart': False, 'control': 'no-zoom'})
        env, calls, _, _, code = load(['--audit-fixes', '--latency-review'])
        with self.assertRaises(SystemExit):
            exec(code, env)
        self.assertEqual([c[1] for c in calls], ['audit_fixes', 'review_latency'])
        for flag, function in [('--audit-fixes', 'audit_fixes'), ('--editor-exit', 'run')]:
            env, calls, _, _, code = load([flag])
            exec(code, env)
            self.assertEqual([c[1] for c in calls], [function])


if __name__ == '__main__':
    unittest.main()
