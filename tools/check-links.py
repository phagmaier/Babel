#!/usr/bin/env python3
"""check-links.py — verify Markdown relative links resolve.

Default scope is the Tier 1 gate from docs/development.md: tracked `*.md`
files changed versus HEAD (staged, unstaged, and untracked). Historical
evidence keeps known-stale links (e.g. M4.md `../src/...` targets); the
changed-link scope leaves prior evidence untouched. Pass `--all` for a
whole-repo sweep, or explicit paths to check only those files.

Inline `[text](target)` / `![alt](target)` links are checked. External URLs
(`http:`, `https:`, `mailto:`) are skipped. For relative targets the file
must exist; `#anchor` links (same-file or cross-file into a tracked
`.md` target) must match a heading slug or an explicit `<a id>` / `id=` /
`name=` anchor in that file.

Read-only; exit 1 with a list when anything is broken.
Usage: python3 tools/check-links.py [--all] [--] [path ...]
"""

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LINK_RE = re.compile(r"!?\[[^\]]*\]\(([^)\s]+(?:\s+\"[^\"]*\")?)\)")
HEADING_RE = re.compile(r"^#{1,6}\s+(.+?)\s*#*\s*$")
ID_RE = re.compile(r"(?:id|name)\s*=\s*\"([^\"]+)\"")
EXTERNAL = ("http://", "https://", "mailto:", "ftp://", "data:")


def slugify(heading: str) -> str:
    # GitHub heading anchors: strip tags, lowercase, drop punctuation
    # (anything that is not a word char, whitespace, or hyphen), then turn
    # each remaining whitespace character into one hyphen (no collapsing,
    # so "M4-01 — Native" becomes "m4-01--native").
    slug = re.sub(r"<[^>]+>", "", heading).strip().lower()
    slug = re.sub(r"[^\w\s-]", "", slug, flags=re.UNICODE)
    return re.sub(r"\s", "-", slug).strip("-")


def anchors_of(path: Path) -> set[str]:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return set()
    found = {
        slugify(m.group(1))
        for m in (HEADING_RE.match(l) for l in text.splitlines())
        if m
    }
    found.update(ID_RE.findall(text))
    return found


def changed_markdown() -> list[Path]:
    status = subprocess.run(
        ["git", "status", "--short"], capture_output=True, text=True, cwd=ROOT
    )
    if status.returncode != 0:
        return []
    files = []
    for line in status.stdout.splitlines():
        path = line[3:] if len(line) > 3 else ""
        if path.endswith(".md") and (ROOT / path).is_file():
            files.append(ROOT / path)
    return files


def all_markdown() -> list[Path]:
    out = subprocess.run(
        ["git", "ls-files", "*.md"], capture_output=True, text=True, cwd=ROOT
    )
    if out.returncode != 0:
        print("check-links: `git ls-files` failed; pass paths explicitly.")
        raise SystemExit(2)
    return [ROOT / line for line in out.stdout.splitlines() if line.strip()]


def targets() -> tuple[list[Path], str]:
    args = [a for a in sys.argv[1:] if a != "--"]
    if "--all" in args:
        return all_markdown(), "all tracked"
    explicit = [a for a in args if a != "--all"]
    if explicit:
        return [Path(a) for a in explicit], "explicit paths"
    return changed_markdown(), "changed vs HEAD"


def main() -> int:
    broken: list[str] = []
    checked = 0
    docs, scope = targets()
    for md in docs:
        if md.is_dir():
            continue
        try:
            text = md.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            broken.append(f"{md}: unreadable ({exc})")
            continue
        anchors = anchors_of(md)
        for match in LINK_RE.finditer(text):
            raw = match.group(1).split('"')[0].strip()
            checked += 1
            if not raw or raw.startswith(EXTERNAL):
                continue
            file_part, _, anchor = raw.partition("#")
            if not file_part:
                if anchor and anchor not in anchors:
                    broken.append(f"{md}: #{anchor} (no such heading)")
                continue
            dest = (md.parent / file_part).resolve()
            try:
                dest.relative_to(ROOT)
            except ValueError:
                broken.append(f"{md}: {raw} (escapes repo root)")
                continue
            if not dest.exists():
                broken.append(f"{md}: {raw} (missing file)")
                continue
            if anchor and dest.suffix == ".md":
                if anchor not in anchors_of(dest):
                    broken.append(f"{md}: {raw} (no such heading in target)")
    print(f"check-links [{scope}]: {checked} links checked.")
    if broken:
        print(f"check-links: {len(broken)} BROKEN:")
        for line in broken:
            print(f"  {line}")
        return 1
    print("check-links: all resolve.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
