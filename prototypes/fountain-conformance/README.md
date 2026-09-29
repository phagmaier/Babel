# M3-01 codec/renderer conformance harness

Isolated test tooling. The application imports none of this directory or Screenplain. It uses the existing M1 codec unchanged and the existing pinned M1 PDF proof stack as an independent AST/bare HTML renderer. No PDF is generated and no production rendering/persistence/privilege contract changes. [Oracle definitions and coverage](../../fixtures/expected/README.md) distinguish proof support, renderer gaps and future production obligations.

## Commands

Run from the repository root with Node 26 and the existing pinned dependencies:

```sh
python3 -m venv /tmp/babel-m3-conformance-venv
/tmp/babel-m3-conformance-venv/bin/pip install -r prototypes/pdf/requirements.txt
pnpm exec vitest run tests/contract/fountain-conformance.test.ts
node prototypes/fountain-conformance/compare.ts /tmp/babel-m3-conformance-venv/bin/python /tmp/babel-m3-01-comparison
```

The comparison runs offline after installation. The Python executable and output directory are explicit CLI arguments; it reads only the repository's declared synthetic corpus. Source travels to the child as JSON stdin, never shell interpolation or manuscript-selected paths. Only `comparison.json` is written to the explicit output directory. The report contains actual renderer HTML for inspection and all named gaps. Missing dependencies, a wrong Screenplain pin, unexpected paragraph types, malformed/duplicate responses and byte/semantic/rendering mismatches fail the command; they cannot produce a success report.

Screenplain 0.12.0 is MIT; the existing proof stack pins and license/packaging limits remain in [M1 PDF README](../pdf/README.md). No new package or lockfile entry was added. Renderer APIs were checked in the exact pinned package source (`screenplain/parsers/fountain.py`, `types.py`, `richstring.py`, `export/html.py`), with [upstream](https://github.com/vilcans/screenplain) and [Fountain syntax](https://fountain.io/syntax/) as primary references. Context7 was unavailable in this session; no plugin/global setting was changed to compensate.

`corpus.ts` loads/hash-checks literal data and defines the proof/shared projections; it does not infer Fountain syntax. `compare.ts` checks exact codec output, calls the renderer and compares both with the independently authored oracles before directly comparing supported semantics. `renderer.py` flattens the library's typed output and inspects actual rendered HTML through the standard-library HTML parser without running a browser or executing markup.

The Vitest suite checks bytes, all physical source ranges/line endings, declared semantics, edits/context, invalid encoding, conservative title/note/raw refusals, incomplete drafting diagnostics, corrupt oracle detection and 128 deterministic malformed-byte mutations. It does not claim a production structured editor or native input/save test. Current proof gaps must remain visible when M3-02/03 replace this adapter with a production codec. That integration should add production assertions against the required semantics instead of redefining these oracles from its output.

[M3 evidence](../../docs/test-evidence/M3.md#m3-01--independent-conformance-corpus-and-oracle) owns exact executed commands, host, observed counts, artifacts and omissions.
