# Retained synthetic composition fixtures

AUDIT-SLP-B retired the M1-06 page/model/drivers, model-only contract test and
page config. The original proof can be reproduced from Git history; its
[evidence](../../docs/test-evidence/M1.md#m1-06--bounded-codeceditornative-composition-proof)
and claim limits remain unchanged.

Keep `fixtures/`, `seed.py` and the fixture `.gitignore` byte-identical. The
Rust `editor-composition-proof` feature/backend remains because production
native editor bridge/input/completion/keys drills use its fixed synthetic
fixture selector and bounded report command. The snapshot proof destination
command was retired with its two obsolete page callers.

Create an explicit private disposable root with
`python3 prototypes/editor-composition/seed.py /tmp`. The seed writes only
synthetic sources and the `SYNTHETIC-M1-06` marker. Native initialization checks
an absolute canonical private root/marker and accepts only `lf`, `crlf` and
`no-final-newline` fixture IDs; no frontend path or shell endpoint exists.
These checks protect owned diagnostic data, not against a malicious local
account racing the marker checks.

Current executable configs/drivers are under `tests/native/`, including the
[production input fixture](../../tests/native/editor-input/README.md) and
[bridge fixture](../../tests/native/editor-bridge/README.md). Default writing
continues to use production entry/pickers, not this feature.
