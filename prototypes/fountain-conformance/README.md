# Independent Fountain corpus and renderer tooling

The application imports none of this directory. AUDIT-SLP-B retired the M1
codec, prototype-only contract suites and old comparison program after porting
corrupt-hash/literal/path/topic guards and original fixture no-op bytes to the
production codec suite. Literal/hash/semantic oracles remain unchanged.

`corpus.ts` loads and hash-checks independently authored data; its types now use
production `FountainKind` without invoking a parser. `renderer.py` remains the
independent pinned Screenplain 0.12.0 AST/bare HTML inspector used by the
[production comparison tool](../../tests/tooling/fountain-complex-compare.ts).
[Oracle definitions](../../fixtures/expected/README.md) retain named renderer
exclusions and required semantics.

Run from the repository root with the pinned Node/Python dependencies:

```sh
python3 -m venv /tmp/babel-m3-conformance-venv
/tmp/babel-m3-conformance-venv/bin/pip install -r prototypes/pdf/requirements.txt
pnpm exec vitest run tests/contract/production-fountain.test.ts tests/contract/fountain-complex.test.ts
node tests/tooling/fountain-complex-compare.ts /tmp/babel-m3-conformance-venv/bin/python /tmp/babel-production-comparison-new
```

The comparison is offline after installation, accepts an explicit interpreter
and output directory, and sends synthetic source as JSON stdin without shell
interpolation. Missing/wrong pins, malformed responses and byte/semantic/HTML
mismatches fail. It does not certify native input, PDF fidelity or persistence.
Screenplain is MIT; [retained PDF inputs](../pdf/README.md) own proof pins.
Historical [M3 evidence](../../docs/test-evidence/M3.md#m3-01--independent-conformance-corpus-and-oracle)
remains available; original prototype commands require Git history.
