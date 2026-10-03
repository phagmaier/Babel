"""us-letter-draft-v1: a bounded patch layer over pinned Screenplain/Platypus.

Paragraph owns wrapping/splitting, BaseDocTemplate owns frame/page breaking.
This module owns screenplay-specific grouping, continuation artifacts and
style/template policy. It never serializes or writes Fountain.
"""
import hashlib
import io
import json
import os
import re

from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import BaseDocTemplate, Flowable, PageBreak, Paragraph, Spacer
from screenplain import types
from screenplain.export import pdf
from screenplain.richstring import RichString, Segment, Italic, plain

HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, 'profiles', 'us-letter-draft-v1.json'), encoding='utf-8') as handle:
    PROFILE = json.load(handle)


class UnsupportedPublication(Exception):
    def __init__(self, feature):
        super().__init__('unsupported-publication:' + feature)


def settings():
    font = PROFILE['fontPoints']
    leading = PROFILE['leadingPoints']
    x, y, width, height = PROFILE['framePoints']
    s = pdf.Settings(font_size=font, line_height=leading, lines_per_page=height // leading,
                     characters_per_line=width / 7.2, page_size=PROFILE['pagePoints'])
    s.left_margin, s.bottom_margin, s.frame_width, s.frame_height = x, y, width, height
    s.title_frame_width = PROFILE['titleFramePoints'][2]
    s.title_style.fontSize = PROFILE['titlePoints']
    s.title_style.leading = PROFILE['titleLeadingPoints']
    s.dual_dialog_table_style.add('FONT', (0, 0), (-1, -1), s.font_settings.family_name, font, leading)
    # All coordinates are relative to the zero-padding frame at (108, 72).
    s.character_style.leftIndent = PROFILE['cuePoints'][0] - x
    s.dialog_style.leftIndent = PROFILE['dialoguePoints'][0] - x
    s.dialog_style.rightIndent = width - s.dialog_style.leftIndent - PROFILE['dialoguePoints'][1]
    s.parenthentical_style.leftIndent = PROFILE['parentheticalPoints'][0] - x
    s.parenthentical_style.rightIndent = width - s.parenthentical_style.leftIndent - PROFILE['parentheticalPoints'][1]
    for style in (s.default_style, s.character_style, s.dialog_style,
                  s.parenthentical_style, s.action_style, s.centered_action_style,
                  s.slug_style, s.transition_style, s.title_style, s.contact_style):
        style.hyphenationLang = None
        style.embeddedHyphenation = 0
        style.splitLongWords = 1
        style.allowOrphans = 0
        style.allowWidows = 0
    return s


def _height(flowable, width):
    return flowable.wrap(width, 10000000)[1]


def _paragraph(html, style):
    # Spacing/grouping belongs to Dialogue, not its nested paragraphs.
    return Paragraph(html, ParagraphStyle('speech-part', style, spaceBefore=0,
                                        spaceAfter=0, keepWithNext=0))


class Dialogue(Flowable):
    """Compound speech split by Platypus, delegating text splits to Paragraph."""
    def __init__(self, cue, parts, s, continued=False, footer=False):
        super().__init__()
        self.cue = cue
        self.parts = parts  # (role, flowable, authored-more) tuples
        self.settings = s
        self.continued = continued
        self.footer = footer
        text = str(cue)
        html = cue.to_html()
        if continued and not re.search(r"\(CONT['’]D\)", text, re.I):
            html += ' ' + plain(PROFILE['continued']).to_html()
        self.header = _paragraph(html, s.character_style)
        self.more = _paragraph(PROFILE['more'], s.character_style)
        self.spaceBefore = 0 if continued else s.line_height
        self.spaceAfter = 0

    def wrap(self, width, height):
        self.width = width
        self.height = _height(self.header, width) + sum(_height(f, width) for _, f, _ in self.parts)
        if self.footer:
            self.height += _height(self.more, width)
        return width, self.height

    def draw(self):
        y = self.height
        children = [self.header, *(f for _, f, _ in self.parts)]
        if self.footer:
            children.append(self.more)
        for child in children:
            h = _height(child, self.width)
            y -= h
            child.drawOn(self.canv, 0, y)

    def split(self, width, height):
        header_height = _height(self.header, width)
        footer_height = _height(self.more, width)
        full = self.settings.frame_height
        # Oversized cues cannot be repeated faithfully with a spoken line.
        if header_height + footer_height + PROFILE['minimumSpeechLines'] * self.settings.line_height > full:
            raise UnsupportedPublication('cue-exceeds-page')
        room = height - header_height - footer_height
        if room < PROFILE['minimumSpeechLines'] * self.settings.line_height:
            return []
        head = []
        tail = []
        for index, (role, child, authored_more) in enumerate(self.parts):
            h = _height(child, width)
            if h <= room + 0.001:
                head.append((role, child, authored_more))
                room -= h
                continue
            # Use the reserved footer slot for an authored (MORE), once.
            if authored_more and h <= room + footer_height + 0.001:
                head.append((role, child, authored_more))
                tail = self.parts[index + 1:]
                break
            pieces = child.split(width, max(0, room))
            if pieces:
                head.append((role, pieces[0], False))
                tail = [(role, p, False) for p in pieces[1:]] + self.parts[index + 1:]
            else:
                tail = self.parts[index:]
            break
        # A terminal parenthetical travels with the last spoken text rather
        # than becoming a continued cue with no speech on a new page.
        if tail and not any(role == 'dialogue' for role, _, _ in tail):
            while head:
                part = head.pop()
                tail.insert(0, part)
                if part[0] == 'dialogue':
                    break
        # Move trailing parenthetical/blank chains with the next spoken text.
        while head and head[-1][0] != 'dialogue' and not head[-1][2]:
            tail.insert(0, head.pop())
        spoken = sum(_height(f, width) for role, f, _ in head if role == 'dialogue')
        if tail and spoken < PROFILE['minimumSpeechLines'] * self.settings.line_height and height < full - .001:
            return []
        if not head:
            if height >= full - 0.001:
                raise UnsupportedPublication('parenthetical-exceeds-page')
            return []
        if not tail:
            return [Dialogue(self.cue, head, self.settings, self.continued)]
        return [Dialogue(self.cue, head, self.settings, self.continued,
                         footer=not head[-1][2]),
                PageBreak(), Dialogue(self.cue, tail, self.settings, continued=True)]


def add_dialog(story, dialog, s):
    parts = []
    for parenthetical, line in dialog.blocks:
        if not str(line):
            parts.append(('blank', Spacer(1, s.line_height), False))
        else:
            role = 'parenthetical' if parenthetical else 'dialogue'
            style = s.parenthentical_style if parenthetical else s.dialog_style
            parts.append((role, _paragraph(line.to_html(), style), str(line).strip() == PROFILE['more']))
    story.append(Dialogue(dialog.character, parts, s))


class WholeDual(pdf.platypus.Table):
    def split(self, width, height):
        return []  # Whole pair moves to the next frame; tall pairs are refused below.


def add_dual(story, dual, s):
    width = s.frame_width / 2
    left = pdf._dialog_to_flowables(dual.left, s, column_width=width)
    right = pdf._dialog_to_flowables(dual.right, s, column_width=width)
    # Align first spoken baselines including wrapped cues and asymmetric
    # leading parentheticals/blank lines. Keep each cue at the column top.
    prefixes = []
    for dialog, side in ((dual.left, left), (dual.right, right)):
        index = next((i + 1 for i, (parenthetical, line) in enumerate(dialog.blocks)
                      if not parenthetical and str(line)), len(side))
        prefixes.append((side, index, sum(_height(f, width) for f in side[:index])))
    prefix_height = max(h for _, _, h in prefixes)
    for side, index, h in prefixes:
        if prefix_height > h:
            side.insert(index, Spacer(1, prefix_height - h))
    table = WholeDual([[left, right]], colWidths=[width, width],
                      spaceBefore=s.line_height, style=s.dual_dialog_table_style)
    if _height(table, s.frame_width) > s.frame_height:
        raise UnsupportedPublication('dual-dialogue-overflow')
    story.append(table)


class NumberedHeading(pdf.SlugWithSceneNumbers):
    def __init__(self, paragraph, number, s):
        # Scene identifiers are literal text, not Paragraph HTML.
        super().__init__(paragraph, number, s)
        self.number = number
        self.scene_number = str(number)
        from reportlab.pdfbase.pdfmetrics import stringWidth
        if stringWidth(self.scene_number, s.font_settings.family_name, s.font_size) > 54:
            raise UnsupportedPublication('scene-number-width')

    def wrap(self, width, height):
        self.width, self.height = self.slug_paragraph.wrap(width, height)
        return self.width, self.height

    def split(self, width, height):
        pieces = self.slug_paragraph.split(width, height)
        if not pieces:
            return []
        first = NumberedHeading(pieces[0], self.number, self.settings)
        first.keepWithNext = 0
        # Only the first fragment carries scene numbers. Paragraph owns every
        # text split; the final fragment retains its following-content keep.
        return [first, *pieces[1:]]

    def draw(self):
        self.slug_paragraph.drawOn(self.canv, 0, 0)
        self.canv.saveState()
        self.canv.setFont(self.settings.font_settings.family_name, self.settings.font_size)
        y = self.height - self.settings.line_height
        self.canv.drawString(-54, y, self.scene_number)
        self.canv.drawRightString(self.settings.frame_width, y, self.scene_number)
        self.canv.restoreState()


def _strip_prefix(line, marker):
    segments = list(line.segments)
    if segments and segments[0].text.startswith(marker):
        first = segments[0]
        segments[0] = Segment(first.text[len(marker):], first.styles)
    return RichString(*(Segment(segment.text, segment.styles | {Italic}) for segment in segments))


def parse(text):
    from screenplain.parsers import fountain
    title_parser = fountain.parse_title_page
    action_parser = fountain.InputParagraph.append_action
    emphasis_parser = fountain.parse_emphasis
    def emphasis(source):
        # Protect literal escapes before upstream emphasis parsing, then restore
        # each segment's exact text/styles. Tokens are absent from this input;
        # no authored private-use character can be mistaken for a placeholder.
        literals = {}
        tokens = {}
        occupied = set(source)
        next_token = 0xF0000
        def escape(match):
            nonlocal next_token
            value = match.group(1)
            if value in tokens:
                return tokens[value]
            while chr(next_token) in occupied:
                next_token += 1
            token = chr(next_token)
            next_token += 1
            literals[token] = value
            tokens[value] = token
            return token
        protected = re.sub(r'\\([\\*_\[\]])', escape, source)
        rich = emphasis_parser(protected)
        return RichString(*(Segment(''.join(literals.get(char, char) for char in segment.text),
                                    segment.styles) for segment in rich.segments))
    def title(lines):
        # An explicit Fountain force marker cannot start a title-field key.
        if lines and lines[0].startswith(('!', '@', '~', '.', '>', '#', '=')):
            return None
        return title_parser(lines)
    def action(self, paragraphs):
        result = action_parser(self, paragraphs)
        paragraphs[-1].lyric_indices = [index for index, line in enumerate(self.lines)
                                       if line.startswith('~')]
        return result
    fountain.parse_emphasis = emphasis
    fountain.parse_title_page = title
    fountain.InputParagraph.append_action = action
    try:
        screenplay = fountain.parse(io.StringIO(text, newline=None))
        # Upstream title values are lazily parsed after this temporary patch has
        # been restored. Capture their rich values with the same escape policy.
        attributes = {key: [emphasis(line) for line in lines]
                      for key, lines in screenplay.title_page.items()}
        screenplay.get_rich_attribute = lambda name, default=(): attributes.get(name, default)
        return screenplay
    finally:
        fountain.parse_emphasis = emphasis_parser
        fountain.parse_title_page = title_parser
        fountain.InputParagraph.append_action = action_parser


def prepare(screenplay):
    # Lyrics are parsed as Action upstream; strip only semantic leading ~,
    # retain escaped literal markers and every rich segment/style.
    for paragraph in screenplay:
        if isinstance(paragraph, types.Action) and not paragraph.centered:
            lyrics = getattr(paragraph, 'lyric_indices', ())
            paragraph.lines = [_strip_prefix(line, '~') if index in lyrics else line
                               for index, line in enumerate(paragraph.lines)]
        if isinstance(paragraph, types.Dialog) and str(paragraph.character).endswith('^'):
            raise UnsupportedPublication('unpaired-dual-dialogue')


def validate_glyphs(screenplay, s):
    from reportlab.pdfbase import pdfmetrics
    rich = []
    for key in ('Title', 'Credit', 'Author', 'Authors', 'Source', 'Draft date', 'Contact', 'Copyright'):
        rich.extend(screenplay.get_rich_attribute(key))
    for paragraph in screenplay:
        if isinstance(paragraph, types.DualDialog):
            dialogs = [paragraph.left, paragraph.right]
        elif isinstance(paragraph, types.Dialog):
            dialogs = [paragraph]
        else:
            dialogs = []
            if getattr(paragraph, 'scene_number', None):
                rich.append(paragraph.scene_number)
            if hasattr(paragraph, 'lines'):
                rich.extend(paragraph.lines)
        for dialog in dialogs:
            rich.append(dialog.character)
            rich.extend(line for _, line in dialog.blocks)
    from screenplain.richstring import Bold
    for line in rich:
        for segment in line.segments:
            suffix = (' Bold Italic' if Bold in segment.styles and Italic in segment.styles else
                      ' Bold' if Bold in segment.styles else ' Italic' if Italic in segment.styles else '')
            characters = pdfmetrics.getFont(s.font_settings.family_name + suffix).face.charToGlyph
            for char in segment.text:
                if char.isspace():
                    continue
                code = ord(char)
                if code not in characters or 0x0590 <= code <= 0x08FF:
                    raise UnsupportedPublication('glyph-coverage-or-shaping')


class DraftTemplate(pdf.DocTemplate):
    last = None
    def __init__(self, *args, **kwargs):
        DraftTemplate.last = self
        self.body_pages = 0
        super().__init__(*args, **kwargs)
        if not self.has_title_page:
            self._firstPageTemplateIndex = 1

    def build(self, story, **kwargs):
        kwargs['canvasmaker'] = DraftCanvas
        return super().build(story, **kwargs)

    def handle_pageBegin(self):
        # Let Platypus select the page template/frame first; title overflow
        # can span any number of physical pages and never earns a body number.
        BaseDocTemplate.handle_pageBegin(self)
        self.canv.setFont(self.settings.font_settings.family_name, PROFILE['fontPoints'],
                          leading=PROFILE['leadingPoints'])
        if self.pageTemplate.id == 'standard':
            self.body_pages += 1
            if self.body_pages >= 2:
                self.canv.drawRightString(*PROFILE['numberPoints'], f'{self.body_pages}.')


class DraftCanvas(Canvas):
    def __init__(self, *args, **kwargs):
        # Avoid ReportLab's default Helvetica preamble/resource altogether.
        kwargs['initialFontName'] = 'Courier Prime'
        super().__init__(*args, **kwargs)


def render(screenplay, output):
    library = os.path.join(HERE, 'lib')
    for relative, expected in PROFILE['upstreamSha256'].items():
        with open(os.path.join(library, relative), 'rb') as handle:
            if hashlib.sha256(handle.read()).hexdigest() != expected:
                raise UnsupportedPublication('patch-boundary-integrity')
    s = settings()
    prepare(screenplay)
    validate_glyphs(screenplay, s)
    # ReportLab 4.4.7 emits one bfchar block for its entire subset. PDF CMap
    # blocks permit at most 100 entries; retain every mapping, only chunk it.
    from reportlab.pdfbase import ttfonts
    original_cmap = ttfonts.makeToUnicodeCMap
    def cmap(fontname, subset):
        lines = original_cmap(fontname, subset).splitlines()
        start = next(i for i, line in enumerate(lines) if line.endswith(' beginbfchar'))
        end = lines.index('endbfchar', start)
        mappings = lines[start + 1:end]
        blocks = []
        for offset in range(0, len(mappings), 100):
            group = mappings[offset:offset + 100]
            blocks.extend([f'{len(group)} beginbfchar', *group, 'endbfchar'])
        return '\n'.join([*lines[:start], *blocks, *lines[end + 1:]])
    ttfonts.makeToUnicodeCMap = cmap
    pdf.SlugWithSceneNumbers = NumberedHeading
    pdf.add_dialog = add_dialog
    pdf.add_dual_dialog = add_dual
    printable = (types.Dialog, types.DualDialog, types.Action, types.Slug,
                 types.Transition, types.PageBreak)
    if not pdf.get_title_page_story(screenplay, s) and not any(isinstance(p, printable) for p in screenplay):
        # Empty/omitted-only derivatives still have one real, blank page.
        screenplay.append(types.Action([plain('')]))
    pdf.to_pdf(screenplay, output, template_constructor=DraftTemplate, settings=s)
    return DraftTemplate.last.page


def warnings(screenplay, source):
    """Report known upstream omissions; M5-04 owns complete codec assessment."""
    from screenplain.parsers import fountain
    unsupported = set()
    if fountain.boneyard_re.search(source): unsupported.add('boneyards')
    if fountain.note_re.search(source): unsupported.add('notes')
    if any(isinstance(p, types.Section) for p in screenplay): unsupported.add('sections')
    if any(getattr(p, 'synopsis', None) for p in screenplay): unsupported.add('synopses')
    visible = {'Title', 'Credit', 'Author', 'Authors', 'Source', 'Draft date', 'Contact', 'Copyright'}
    if screenplay.title_page.keys() - visible: unsupported.add('unknown-title-fields')
    return [{'code': 'unsupported-publication:' + feature,
             'message': 'This profile omits ' + feature + '; export assessment is required.'}
            for feature in sorted(unsupported)]
