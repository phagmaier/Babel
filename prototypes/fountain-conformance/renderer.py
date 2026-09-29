"""Pinned Screenplain AST + actual bare HTML renderer, isolated from the app.

Reads JSON from stdin, never executes manuscript text or opens manuscript paths.
BOM removal is decoding policy for this derived comparison only, not a source save.
"""
from __future__ import annotations

import io
import json
import sys
from html.parser import HTMLParser
from importlib.metadata import version


class RenderedHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.text = []
        self.styles = []
        self.stack = []
        self.counts = {}

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        classes = attributes.get("class", "").split()
        for name in [tag, *classes]:
            self.counts[name] = self.counts.get(name, 0) + 1
        if tag not in ("br", "img", "hr", "meta", "link", "input"):
            self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if not self.stack or self.stack.pop() != tag:
            raise ValueError("Unbalanced renderer HTML")

    def handle_data(self, data):
        if not self.stack and not data.strip():  # whitespace between formatter elements
            return
        self.text.append(data)
        styles = sorted({{"em": "italic", "strong": "bold", "u": "underline"}[t]
                         for t in self.stack if t in ("em", "strong", "u")})
        if styles:
            self.styles.append({"text": data, "styles": styles})


def project(screenplay):
    from screenplain import types
    atoms, rich_lines = [], []

    def emit(kind, rich, **fields):
        atoms.append(dict(kind=kind, text=str(rich), **fields))
        rich_lines.append([dict(text=s.text, styles=sorted(x.name() for x in s.styles))
                           for s in rich.segments])

    def speech(dialog, dual_with=None):
        speaker = len(atoms)
        emit("character", dialog.character,
             **({} if dual_with is None else {"dualWith": dual_with}))
        for parenthetical, line in dialog.blocks:
            emit("parenthetical" if parenthetical else "dialogue", line)
        return speaker

    for para in screenplay:
        if isinstance(para, types.Slug):
            emit("sceneHeading", para.line,
                 **({"sceneNumber": str(para.scene_number)} if para.scene_number else {}))
            if para.synopsis:
                atoms.append(dict(kind="synopsis", text=para.synopsis))
        elif isinstance(para, types.Section):
            emit("section", para.text, sectionLevel=para.level)
            if para.synopsis:
                atoms.append(dict(kind="synopsis", text=para.synopsis))
        elif isinstance(para, types.Action):
            for line in para.lines:
                emit("centered" if para.centered else "action", line)
        elif isinstance(para, types.DualDialog):
            left = speech(para.left)
            speech(para.right, left)
        elif isinstance(para, types.Dialog):
            speech(para)
        elif isinstance(para, types.Transition):
            emit("transition", para.line)
        elif isinstance(para, types.PageBreak):
            atoms.append(dict(kind="pageBreak", text="==="))
        else:
            raise ValueError(f"Unprojected renderer type: {type(para).__name__}")
    return atoms, rich_lines


def main():
    try:
        from screenplain.parsers import fountain
        from screenplain.export import html
    except ImportError as exc:
        print(f"Missing pinned renderer: {exc}", file=sys.stderr)
        return 2
    if version("screenplain") != "0.12.0":
        print("Expected screenplain==0.12.0", file=sys.stderr)
        return 2
    response = []
    for entry in json.load(sys.stdin):
        screenplay = fountain.parse(io.StringIO(entry["source"].removeprefix("\ufeff")))
        atoms, runs = project(screenplay)
        output = io.StringIO()
        html.convert(screenplay, output, bare=True)
        rendered = RenderedHTML()
        rendered.feed(output.getvalue())
        rendered.close()
        if rendered.stack:
            raise ValueError("Unclosed renderer HTML")
        response.append(dict(id=entry["id"], atoms=atoms, title=screenplay.title_page,
                             runs=runs, htmlText="".join(rendered.text),
                             htmlStyles=rendered.styles, htmlCounts=rendered.counts,
                             html=output.getvalue()))
    json.dump(dict(renderer=version("screenplain"), entries=response), sys.stdout,
              ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
