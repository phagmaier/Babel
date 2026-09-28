"""M1-03 disposable PDF render probe (Screenplain, offline).

Reads prototypes/pdf/corpus/*.fountain as data, renders one PDF per file
with pinned screenplain/reportlab, and writes a manifest with hashes,
timings, and source markers that the PDF adapter currently does not warn
about. No network, no production export path.
"""

from __future__ import annotations

import hashlib
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CORPUS = ROOT / "corpus"
OUT = ROOT / "out"


def source_markers(text: str) -> dict[str, bool]:
    lines = text.splitlines()
    return {
        "note": "[[" in text,
        "boneyard": "/*" in text,
        "section": any(line.startswith("#") for line in lines),
        "synopsis": any(
            line.startswith("=") and not line.startswith("===") for line in lines
        ),
        "unknown_title_field": "Unmapped" in text or "unmapped" in text,
        # A trailing caret is Screenplain's dual-dialogue marker; a leading
        # @ is a forced cue. The two were previously conflated in one flag.
        "dual_caret": any(
            stripped.endswith("^") and stripped.strip("^").strip()
            for stripped in (line.rstrip() for line in lines)
        ),
        "forced_cue": any(line.startswith("@") for line in lines),
    }


def main() -> int:
    try:
        from screenplain.parsers import fountain as fountain_parser
        from screenplain.export import pdf as pdf_export
        import reportlab
    except ImportError as exc:
        print(f"missing pinned dependency: {exc}", file=sys.stderr)
        print(
            "install: python3 -m venv /tmp/babel-pdf-venv && "
            "/tmp/babel-pdf-venv/bin/pip install "
            "-r prototypes/pdf/requirements.txt",
            file=sys.stderr,
        )
        return 2

    from importlib.metadata import version

    print(f"screenplain={version('screenplain')} reportlab={reportlab.Version}")

    OUT.mkdir(parents=True, exist_ok=True)
    entries = []
    for src in sorted(CORPUS.glob("*.fountain")):
        raw = src.read_bytes()
        text = raw.decode("utf-8")
        with src.open("r", encoding="utf-8") as handle:
            screenplay = fountain_parser.parse(handle)
        dest = OUT / (src.stem + ".screenplain.pdf")
        started = time.perf_counter()
        # Library call: filenames are Path objects handled as data, never shell.
        pdf_export.to_pdf(screenplay, str(dest))
        elapsed_ms = (time.perf_counter() - started) * 1000.0
        digest = hashlib.sha256(dest.read_bytes()).hexdigest()
        entries.append(
            {
                "source": src.name,
                "source_bytes": len(raw),
                "source_sha256": hashlib.sha256(raw).hexdigest(),
                "pdf": dest.name,
                "pdf_bytes": dest.stat().st_size,
                "pdf_sha256": digest,
                "render_ms": round(elapsed_ms, 1),
                "markers": source_markers(text),
                "paragraph_types": sorted({type(p).__name__ for p in screenplay}),
                "has_title_page": bool(screenplay.title_page),
            }
        )
        print(
            f"{src.name} -> {dest.name} "
            f"{dest.stat().st_size} bytes sha256={digest[:16]}… "
            f"{elapsed_ms:.0f}ms"
        )

    (OUT / "manifest.json").write_text(
        json.dumps({"entries": entries}, indent=2) + "\n",
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
