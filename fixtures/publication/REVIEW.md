# Publication corpus and golden review

Original synthetic Fountain, authored for M5-03 on 2026-10-02; no real manuscript
or borrowed screenplay. [Manifest](manifest.json) records byte hashes, encodings
and literal expectations. `elements.fountain` deliberately has BOM/CRLF.
[Review identities](review.json) bind the profile, runtime and accepted goldens.

The literals, counts, marker counts and selected coordinates were written before
rendering. One oracle was corrected after reading the leading explicit break:
`empty-breaks` intentionally has two body pages, not one; the first is blank,
the second is numbered `2.`, and the trailing break adds no page. This decision
is frozen in ADR 0037. No fixture bytes were changed to obtain a passing render.

Generated expectations were independently checked against those literal
oracles using pypdf 6.19.0 and Poppler 26.08.0 (`pdfinfo`, `pdftotext -bbox-layout`,
`pdffonts`). The editing agent visually inspected all 22 full page renders in
four labeled contact sheets and the separate Ghostscript element page. The final asymmetric dual regression page was also
visually checked after aligning its leading parenthetical with the other
column’s first speech. This is
independent tool/visual review, not a claim of a second human reviewer.
Review found no clipping, overlap, lost rows, marker leaks or stranded cues in
the accepted corpus. Baselines, columns, emphasis, title-overflow numbering,
scene numbers and dual alignment agree with ADR 0037. Ghostscript 10.08.0
rendered all 22 pages without errors/warnings after the bounded CMap patch.

`goldens/*.json` contain page text, text origins/font sizes, word bounding boxes
and embedded font names. `goldens/*.png` are 72-dpi Poppler renders. Repeated
inputs must produce identical inspected layout/text and exact PNGs. Raster
comparison is bound to this Poppler/font/platform stack; a different viewer
version needs review rather than blind regeneration. PDF checksums are not the
regression oracle. Negative dual-overflow and glyph/shaping fixtures must fail
with their declared feature and leave no PDF. Known omissions require all five
structured warnings; they do not earn fidelity credit.

Run with inspection-only dependencies, outside the runtime:

```sh
python3 -m venv /tmp/babel-profile-inspect
/tmp/babel-profile-inspect/bin/pip install -r tools/pdf-helper/requirements-test.txt
/tmp/babel-profile-inspect/bin/python tools/pdf-helper/test_profile.py --output target/profile-check-new
```

Use a fresh output directory. `--candidates` writes only there, never overwrites
accepted goldens. Review literals, bounding boxes and every rendered page before
adopting candidates and updating `review.json`. `BABEL_PDF_HELPER_RUNTIME` selects
an extracted packaged copy. Thirteen additional synthetic checks cover empty
input, giant action/speech/numbered-heading splitting, heading plus long speech,
terminal parentheticals, repeated cues, literal lyric markers, asymmetric dual
leading parentheticals, and declared
refusals for impossible cue/parenthetical/scene-number geometry and unpaired dual. The source
bytes, save/recovery state and live editor are outside renderer authority.
