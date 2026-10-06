"""Fail the build when a bundled library has no retained licence text (M6-14).

Reads the committed docs/third-party/package-inventory.json and verifies a
built AppDir against it. Host-independent: it checks coverage and presence,
never exact bytes or versions, so the Arch-authored manifest also gates the
Ubuntu CI package. Version/SHA drift is reported, not fatal.

    python3 tools/check-package-notices.py target/release/bundle/appimage/babel.AppDir

Fails when: an ELF binary, provider module or font in the package matches no
manifest entry; a referenced notice text is missing from
docs/third-party/package-licenses/; the in-package notice file is absent;
the pdf-helper licence files are absent; the pdf-helper pins changed without
regenerating notices.
"""

import hashlib
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DOCS = REPO / "docs" / "third-party"
TEXTS = DOCS / "package-licenses"
HELPER_LICENSES = [
    "licenses/CPython-LICENSE.txt",
    "licenses/CourierPrime-OFL.txt",
    "licenses/screenplain-licenses-LICENSE.txt",
    "licenses/reportlab-licenses-LICENSE",
    "licenses/charset_normalizer-licenses-LICENSE",
    "app/lib/reportlab/fonts/bitstream-vera-license.txt",
    "app/lib/reportlab/fonts/DarkGarden-copying.txt",
    "app/lib/reportlab/fonts/DarkGarden-copying-gpl.txt",
]
SKIP_PREFIXES = ("usr/share/icons/", "usr/share/applications/")
SKIP_SUFFIXES = (".desktop", ".png", ".svg")


def stem(name):
    return name.split(".so")[0] if ".so" in name else name


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    appdir = Path(sys.argv[1]).resolve(strict=True)
    inventory = json.loads((DOCS / "package-inventory.json").read_text())
    failures, warnings = [], []

    exact, stems = set(), set()
    for entry in inventory["entries"]:
        stems.update(entry.get("stems", []))
        for item in entry.get("bundled", []):
            exact.add(item["path"])
    helper_tree = appdir / "usr/lib/babel/pdf-helper"
    helper_tree_rel = helper_tree.relative_to(appdir).as_posix()
    notice_rel = inventory["noticeFile"]

    for path in sorted(appdir.rglob("*")):
        if path.is_symlink() or not path.is_file():
            continue
        rel = path.relative_to(appdir).as_posix()
        if rel == notice_rel:
            continue
        if rel.startswith(helper_tree_rel + "/"):
            continue
        if rel.startswith(SKIP_PREFIXES) or rel.endswith(SKIP_SUFFIXES):
            continue
        with open(path, "rb") as handle:
            magic = handle.read(4)
        is_elf = magic == b"\x7fELF"
        is_font = path.suffix.lower() in (".ttf", ".otf", ".pfb", ".afm", ".woff", ".woff2")
        if not (is_elf or is_font):
            continue
        name = path.name
        if rel in exact or stem(name) in stems or name in stems:
            continue
        failures.append(f"bundled {'library' if is_elf else 'font'} has no notice entry: {rel}")

    for entry in inventory["entries"]:
        for text in entry.get("texts", []):
            if not (TEXTS / text["file"]).is_file():
                failures.append(f"retained text missing: {text['file']} ({entry['package']})")
        for ref in entry.get("refs", []):
            if not (DOCS / ref).is_file():
                failures.append(f"referenced notice missing: {ref} ({entry['package']})")

    notice = appdir / notice_rel
    if not notice.is_file() or notice.stat().st_size == 0:
        failures.append(f"in-package notice file missing or empty: {notice_rel}")
    for name in HELPER_LICENSES:
        if not (helper_tree / name).is_file():
            failures.append(f"pdf-helper licence file missing from package: {name}")
    recorded = next((b.get("pinsSha256") for e in inventory["entries"]
                     for b in e.get("bundled", []) if "pinsSha256" in b), None)
    current_pins = hashlib.sha256((REPO / "tools/pdf-helper/pins.json").read_bytes()).hexdigest()
    if recorded != current_pins:
        failures.append("pdf-helper pins changed without regenerating notices "
                        "(run tools/build-package-notices.py)")

    # Drift is informational: another host legitimately ships other versions.
    for entry in inventory["entries"]:
        if entry.get("kind") != "native":
            continue
        for item in entry.get("bundled", []):
            candidate = appdir / item["path"]
            if candidate.is_file() and not candidate.is_symlink():
                digest = hashlib.sha256(candidate.read_bytes()).hexdigest()
                if digest != item.get("sha256"):
                    warnings.append(f"version drift (not fatal): {item['path']}")
                    break

    report = {"appDir": str(appdir), "failures": failures, "warnings": warnings}
    print(json.dumps(report, indent=2))
    if failures:
        raise SystemExit("Package notices incomplete:\n" + "\n".join(failures))
    return 0


if __name__ == "__main__":
    sys.exit(main())
