"""M1-03 disposable PDF inspection probe (offline).

Reads prototypes/pdf/out/*.screenplain.pdf plus manifest.json, extracts
page boxes, text order, and font names with pinned pypdf, cross-checks page
geometry with pdfinfo when available, and writes inspection.json. Rendered
PNGs for visual review are produced separately with pdftoppm (see README).
"""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "out"
LETTER_W_PT = 612.0
LETTER_H_PT = 792.0


def pdfinfo_pages(pdf: Path) -> dict | None:
    if shutil.which("pdfinfo") is None:
        return None
    proc = subprocess.run(
        ["pdfinfo", str(pdf)], capture_output=True, text=True, check=False
    )
    if proc.returncode != 0:
        return {"error": proc.stderr.strip()[-500:]}
    info: dict[str, str] = {}
    for line in proc.stdout.splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            info[key.strip()] = value.strip()
    return info


def main() -> int:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        print(f"missing pinned dependency: {exc}", file=sys.stderr)
        return 2
    manifest_path = OUT / "manifest.json"
    if not manifest_path.exists():
        print("run render.py first (out/manifest.json missing)", file=sys.stderr)
        return 2
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    results = []
    for entry in manifest["entries"]:
        pdf = OUT / entry["pdf"]
        data = pdf.read_bytes()
        reader = PdfReader(str(pdf))
        pages = []
        fonts: set[str] = set()
        for index, page in enumerate(reader.pages):
            box = page.mediabox
            w, h = float(box.width), float(box.height)
            text = page.extract_text() or ""
            for font_ref in page.get("/Resources", {}).get("/Font", {}).values():
                try:
                    font = font_ref.get_object()
                    name = str(font.get("/BaseFont", ""))
                    if name:
                        fonts.add(name)
                except Exception:
                    continue
            pages.append(
                {
                    "index": index,
                    "width_pt": round(w, 2),
                    "height_pt": round(h, 2),
                    "is_letter": abs(w - LETTER_W_PT) < 1.0
                    and abs(h - LETTER_H_PT) < 1.0,
                    "chars": len(text),
                    "first_line": text.strip().splitlines()[0][:120]
                    if text.strip()
                    else "",
                }
            )
        # Determinism probe: re-extract after re-read; byte IDs may vary,
        # layout text must be stable for identical inputs (checked across
        # two render runs in the evidence report).
        full_text = "\n".join(
            (reader.pages[i].extract_text() or "") for i in range(len(reader.pages))
        )
        results.append(
            {
                "pdf": entry["pdf"],
                "source": entry["source"],
                "pdf_bytes": len(data),
                "pdf_sha256": hashlib.sha256(data).hexdigest(),
                "page_count": len(reader.pages),
                "pages": pages,
                "fonts": sorted(fonts),
                "text_chars": len(full_text),
                "pdfinfo": pdfinfo_pages(pdf),
            }
        )
        print(
            f"{entry['pdf']}: {len(reader.pages)} pages, "
            f"fonts={sorted(fonts)}, text_chars={len(full_text)}"
        )
    (OUT / "inspection.json").write_text(
        json.dumps({"results": results}, indent=2) + "\n", encoding="utf-8"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
