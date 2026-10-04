# Retained M1 PDF proof inputs

AUDIT-SLP-B retired `render.py`, `inspect_pdf.py` and the `pdf-lib` fallback
program/dependency. Original M1-03 commands require the pre-deletion Git
snapshot; historical [evidence](../../docs/test-evidence/M1.md#m1-03--pdf-renderer-proof)
and [coverage/limitations](COVERAGE.md) remain unchanged.

Keep `corpus/`, `COVERAGE.md` and `requirements.txt`: the independent conformance
renderer and production helper tests still consume these inputs. No manuscript
or production entry point uses this directory as its renderer.

The retained proof stack pins Screenplain 0.12.0 (MIT), ReportLab 4.4.7
(BSD), Courier Prime (OFL), plus exact inspection/transitive versions in
`requirements.txt`. Install only into a disposable venv when using the
[production corpus comparison](../fountain-conformance/README.md).

Production preview/export uses the separate bundled pinned
[PDF helper](../../tools/pdf-helper/README.md). Original M1 observations do not
close installed/platform/fidelity gates or transfer a performance claim.
Ignored `out/` artifacts are retained; they are historical observations, not
committed goldens or expectations generated for current tests.
