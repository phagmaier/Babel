# M1-03 disposable PDF renderer proof

Isolated prototype only. No production export UI, save path, or manuscript
is connected. Authority: SPEC S12, `docs/pdf-and-formatting.md`, TODO M1-03.

## Pins

- Primary: `screenplain==0.12.0` (MIT) + `reportlab==4.4.7` (BSD) + bundled
  Courier Prime (OFL). Transitives (`pillow`, `charset-normalizer`) are
  pinned to the versions inspected in the evidence report.
- Inspection: `pypdf==6.19.0` (BSD) + poppler `pdfinfo`/`pdftoppm` (system).
- Fallback: `pdf-lib@1.17.1` (MIT, pinned devDependency, pure JS).

See `requirements.txt`. Application code remains unlicensed pending owner
direction; third-party licenses must be collected before distribution.

## Run (offline after install)

```sh
python3 -m venv /tmp/babel-pdf-venv
/tmp/babel-pdf-venv/bin/pip install -r prototypes/pdf/requirements.txt
/tmp/babel-pdf-venv/bin/python prototypes/pdf/render.py
/tmp/babel-pdf-venv/bin/python prototypes/pdf/inspect_pdf.py
node prototypes/pdf/fallback.mjs
pdftoppm -png -r 110 prototypes/pdf/out/coverage.screenplain.pdf prototypes/pdf/out/preview-coverage
pdftoppm -png -r 110 prototypes/pdf/out/pagination.screenplain.pdf prototypes/pdf/out/preview-pagination
```

`render.py` treats Fountain source as data (library call, no shell
interpolation) and records per-file hashes, timings, title presence,
paragraph types, and source markers that currently produce no PDF warning.
`inspect_pdf.py` extracts page boxes, text order, and font names with pypdf and
cross-checks geometry with `pdfinfo`. `fallback.mjs` renders a tiny
synthetic screenplay with pdf-lib and base-14 Courier to prove the
JS-bundled path and its paginator cost.

`out/` holds generated PDFs, `manifest.json`, `inspection.json`,
`fallback.json`, and local preview PNGs. Generated files are proof
artifacts, not committed goldens. Visual review uses an independent viewer
(Chromium/Ghostscript) and the `pdftoppm` PNGs; do not regenerate expected
results from the implementation and accept them without review.

## Limits

- One Linux/WebKit host only; other OS builds, installed-app offline
  export, and Tier 1 platform matrix remain open (M6).
- Preview/export agreement and stale-job races are M5 work; this proof has
  no live editor, version token, or background worker.
- `keydown`-style timing is not applicable; render timings are background
  task measurements, never keystroke-path claims.
