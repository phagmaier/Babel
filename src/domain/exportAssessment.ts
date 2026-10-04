import { parseFountain } from './fountainCodec';
import { parseInline } from './fountainInline';
import { isEscaped, unescapedIndex } from './fountainSyntax';
import coverage from './publicationCoverage.json';
import type {
  StyledText,
  FountainDocument,
  HiddenRegion,
} from './fountainModel';
import type { CheckIssue } from './scriptCheck';

export const PUBLICATION_ASSESSMENT_IDENTITY: AssessmentIdentity =
  Object.freeze({
    profile: coverage.profile,
    profileSha256: coverage.profileSha256,
    fontSet: coverage.fontSet,
    renderer: Object.freeze({ ...coverage.renderer }),
    fonts: Object.freeze(
      coverage.fonts.map(({ file, sha256 }) => Object.freeze({ file, sha256 })),
    ),
  });
export interface AssessmentIdentity {
  readonly profile: string;
  readonly profileSha256: string;
  readonly fontSet: string;
  readonly renderer: { python: string; screenplain: string; reportlab: string };
  readonly fonts: readonly { file: string; sha256: string }[];
}
export interface LayoutProbe {
  readonly line: number;
  readonly endLine: number;
  readonly source: string;
}
export type OmissionKind = 'note' | 'boneyard' | 'section' | 'synopsis';
export interface OmissionTotal {
  /** Omitted elements of this kind. */
  readonly count: number;
  /** Physical source lines those elements touch. */
  readonly lines: number;
}
/** Content Fountain defines as non-printing and the frozen renderer omits.
 * Reported once; it is not an issue and needs no acknowledgement. */
export interface PublicationOmissions {
  readonly notes: OmissionTotal;
  readonly boneyards: OmissionTotal;
  readonly sections: OmissionTotal;
  readonly synopses: OmissionTotal;
  /** Every omitted element in document order. */
  readonly ranges: readonly {
    readonly kind: OmissionKind;
    readonly line: number;
    readonly endLine: number;
  }[];
}
export type ExportAssessment =
  | {
      readonly status: 'unavailable';
      readonly reason: string;
      readonly provenance: string;
    }
  | {
      readonly status: 'verified';
      readonly provenance: AssessmentIdentity;
      readonly version: number;
      readonly sourceSha256: string;
      readonly issues: readonly CheckIssue[];
      readonly truncated: boolean;
      readonly omissions: PublicationOmissions;
      /** Content assessment is not an exported PDF or a page-count receipt. */
      readonly layout: 'verified' | 'unavailable';
    };
const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;
/** One sentence for panels; empty when nothing is omitted. */
export function describeOmissions(omissions: PublicationOmissions): string {
  const hidden = (total: OmissionTotal, one: string, many: string) =>
    total.count
      ? `${plural(total.count, one, many)} (${plural(total.lines, 'line', 'lines')})`
      : '';
  const parts = [
    hidden(omissions.notes, 'note', 'notes'),
    hidden(omissions.boneyards, 'boneyard', 'boneyards'),
    omissions.sections.count
      ? plural(omissions.sections.count, 'section heading', 'section headings')
      : '',
    omissions.synopses.count
      ? plural(omissions.synopses.count, 'synopsis', 'synopses')
      : '',
  ].filter(Boolean);
  return parts.length
    ? `Not printed by this profile: ${parts.join(', ')}.`
    : '';
}
export interface AssessmentContext {
  readonly identity: AssessmentIdentity | null;
  readonly version: number;
  readonly sourceSha256: string;
  readonly layout?: readonly (string | null)[];
}
export function matchingAssessmentIdentity(
  identity: AssessmentIdentity | null,
): boolean {
  try {
    return (
      !!identity &&
      identity.profile === coverage.profile &&
      identity.profileSha256 === coverage.profileSha256 &&
      identity.fontSet === coverage.fontSet &&
      Object.entries(coverage.renderer).every(
        ([key, value]) =>
          identity.renderer[key as keyof typeof coverage.renderer] === value,
      ) &&
      identity.fonts.length === coverage.fonts.length &&
      coverage.fonts.every(
        (expected) =>
          identity.fonts.filter(
            (font) =>
              font.file === expected.file && font.sha256 === expected.sha256,
          ).length === 1,
      )
    );
  } catch {
    return false;
  }
}

const hiddenMarkers = ['[[', ']]', '/*', '*/'] as const;
export interface AssessmentView {
  /** The document as the frozen renderer reads it. Line indexes match the
   * original; byte offsets do not, so issue targets use the original lines. */
  readonly document: FountainDocument;
  /** Lines whose closed single-line hidden spans were read through. */
  readonly stripped: ReadonlySet<number>;
}
const views = new WeakMap<FountainDocument, AssessmentView>();
/** The codec protects any line mixing hidden and visible text as raw. The
 * renderer simply drops closed notes and boneyards, so assessment (never the
 * editor or the source) reads such a line without them when they follow visible
 * text and close on that line. Everything else stays raw and gated. */
export function assessmentView(document: FountainDocument): AssessmentView {
  const cached = views.get(document);
  if (cached) return cached;
  let view: AssessmentView = { document, stripped: new Set() };
  if (!document.readOnlyReason && document.hiddenRegions.length) {
    const inline = new Map<number, HiddenRegion[]>();
    const excluded = new Set<number>();
    for (const region of document.hiddenRegions) {
      const single = region.count === 1 && region.closed && !region.ambiguous;
      for (let at = region.from; at < region.from + region.count; at++) {
        if (!single) excluded.add(at);
        else inline.set(at, [...(inline.get(at) ?? []), region]);
      }
    }
    const bytes = document.bytes;
    const decoder = new TextDecoder();
    const cuts: HiddenRegion[] = [];
    const stripped = new Set<number>();
    for (const [index, regions] of inline) {
      const line = document.lines[index]!;
      const lead = line.sourceText.trimStart();
      if (
        line.kind !== 'raw' ||
        excluded.has(index) ||
        lead.startsWith('[[') ||
        lead.startsWith('/*')
      )
        continue;
      let from = line.sourceStart;
      let rest = '';
      for (const region of regions) {
        rest += decoder.decode(bytes.subarray(from, region.sourceStart));
        from = region.sourceEnd;
      }
      rest += decoder.decode(bytes.subarray(from, line.contentEnd));
      if (
        rest.trim() === '' ||
        rest.includes('{{') ||
        hiddenMarkers.some((marker) => unescapedIndex(rest, marker) >= 0)
      )
        continue;
      stripped.add(index);
      cuts.push(...regions);
    }
    if (cuts.length) {
      cuts.sort((a, b) => a.sourceStart - b.sourceStart);
      const kept = new Uint8Array(
        bytes.length -
          cuts.reduce((sum, cut) => sum + cut.sourceEnd - cut.sourceStart, 0),
      );
      let from = 0;
      let to = 0;
      for (const cut of cuts) {
        kept.set(bytes.subarray(from, cut.sourceStart), to);
        to += cut.sourceStart - from;
        from = cut.sourceEnd;
      }
      kept.set(bytes.subarray(from), to);
      const parsed = parseFountain(kept);
      if (
        !parsed.readOnlyReason &&
        parsed.lines.length === document.lines.length
      )
        view = { document: parsed, stripped };
    }
  }
  views.set(document, view);
  return view;
}

/** Layout-dependent constructs are checked by the same frozen pipeline in memory.
 * The codec owns boundaries; the renderer cannot choose or omit the targets. */
export function assessmentLayoutProbes(
  source: FountainDocument,
): readonly LayoutProbe[] {
  const document = assessmentView(source).document;
  const probes: LayoutProbe[] = [];
  const paired = new Set<string>();
  for (const group of document.dialogueGroups) {
    if (paired.has(group.id)) continue;
    const partner = document.dialogueGroups.find(
      (other) => other.id === group.dualWith || other.dualWith === group.id,
    );
    if (partner) {
      paired.add(group.id);
      paired.add(partner.id);
    }
    const line = partner ? Math.min(group.from, partner.from) : group.from;
    const endLine = partner
      ? Math.max(group.from + group.count, partner.from + partner.count) - 1
      : group.from + group.count - 1;
    probes.push({
      line,
      endLine,
      source: document.lines
        .slice(line, endLine + 1)
        .map((row) => row.sourceText + row.newline)
        .join(''),
    });
  }
  document.lines.forEach((row, line) => {
    if (row.kind === 'sceneHeading' && row.sceneNumber)
      probes.push({
        line,
        endLine: line,
        source: row.sourceText + '\n\n!Layout probe.\n',
      });
  });
  return probes;
}

// Declared shaping restrictions, distinct from cmap coverage. No Unicode
// category decides glyph support. The profile has no bidi/complex shaper.
const shapingRanges = [
  [0x0300, 0x036f],
  [0x0590, 0x08ff],
  [0x0900, 0x109f],
  [0x1780, 0x17ff],
  [0x1900, 0x1cff],
  [0xa800, 0xabff],
  [0xfb1d, 0xfdff],
  [0xfe70, 0xfeff],
  [0x1e800, 0x1eeff],
];
const titleKeys = new Set([
  'title',
  'credit',
  'author',
  'authors',
  'source',
  'draft date',
  'contact',
  'copyright',
]);
const inRanges = (code: number, ranges: readonly (readonly number[])[]) =>
  ranges.some(([from, to]) => code >= from! && code <= to!);
const LIMIT = 1000;
const layoutFeatures = new Set([
  'dual-dialogue-overflow',
  'cue-exceeds-page',
  'parenthetical-exceeds-page',
  'unpaired-dual-dialogue',
  'scene-number-width',
  'glyph-coverage-or-shaping',
]);
// Hidden text the pinned renderer removes although the codec shows it as
// printed. Its boneyard pattern matches anywhere, including title fields, and
// its note pattern matches within a paragraph; neither honours a backslash
// before the two-character marker. Escaping each bracket separately is
// honoured by both and is not reported.
function rendererOnlyHidden(
  document: FountainDocument,
  paragraphAt: ReadonlyMap<number, readonly number[]>,
): { message: string; line: number; endLine: number }[] {
  const lines = document.lines;
  if (
    !lines.some(
      (row) =>
        ((row.kind === 'title' || row.kind === 'titleContinuation') &&
          row.sourceText.includes('/*')) ||
        hiddenMarkers.some((marker) => row.sourceText.includes('\\' + marker)),
    )
  )
    return [];
  const found: { message: string; line: number; endLine: number }[] = [];
  const scan = (
    rows: readonly number[],
    pattern: RegExp,
    describe: (titled: boolean) => string,
  ) => {
    const starts: number[] = [];
    let text = '';
    for (const row of rows) {
      starts.push(text.length);
      text += lines[row]!.sourceText + '\n';
    }
    const rowAt = (offset: number) => {
      let low = 0;
      let high = starts.length - 1;
      while (low < high) {
        const middle = (low + high + 1) >> 1;
        if (starts[middle]! <= offset) low = middle;
        else high = middle - 1;
      }
      return rows[low]!;
    };
    for (const match of text.matchAll(pattern)) {
      const end = match.index + match[0].length;
      const first = rowAt(match.index);
      const titled = ['title', 'titleContinuation'].includes(
        lines[first]!.kind,
      );
      if (titled || isEscaped(text, match.index) || isEscaped(text, end - 2))
        found.push({
          message: describe(titled),
          line: first,
          endLine: rowAt(end - 1),
        });
    }
  };
  scan(
    lines.map((_, index) => index),
    /\/\*[\s\S]*?\*\//g,
    (titled) =>
      titled
        ? 'The profile removes boneyard text even inside a title field; this field would not print as written.'
        : 'The profile ignores the backslash before a boneyard marker and would drop this text up to the next closing marker.',
  );
  for (const rows of new Set(paragraphAt.values()))
    if (!['title', 'titleContinuation'].includes(lines[rows[0]!]!.kind))
      scan(
        rows,
        /\[\[[\s\S]*?\]\]/g,
        () =>
          'The profile ignores the backslash before a note marker and would drop this text up to the next closing marker.',
      );
  return found;
}

/** Mirrors the pinned renderer's section rule: 1–6 `#` at the line start. */
const rendererSection = /^(#{1,6})\s*([^#].*)$/;
const blankSource = (text: string) => text === '' || text === ' ';
export function evaluateExportAssessment(
  source: FountainDocument,
  context?: AssessmentContext,
): ExportAssessment {
  if (
    !context ||
    !matchingAssessmentIdentity(context.identity) ||
    !Number.isSafeInteger(context.version) ||
    context.version <= 0 ||
    !/^[a-f0-9]{64}$/.test(context.sourceSha256) ||
    source.readOnlyReason
  )
    return Object.freeze({
      status: 'unavailable',
      reason:
        'SC005/SC008 need a matching verified renderer, profile and pinned font identity.',
      provenance:
        'ADR 0037 / us-letter-draft-v1; no export success is implied.',
    });
  // Roles come from the renderer's reading; byte targets from the author's source.
  const { document, stripped } = assessmentView(source);
  const issues: CheckIssue[] = [];
  let truncated = false;
  const add = (
    code: 'SC005' | 'SC008',
    message: string,
    line: number,
    endLine = line,
  ) => {
    if (issues.length >= LIMIT) {
      truncated = true;
      return;
    }
    const first = source.lines[line]!;
    const last = source.lines[endLine]!;
    issues.push(
      Object.freeze({
        code,
        severity: 'blocking',
        key: `${code}:${line}:${endLine}:${message}`,
        message,
        explanation:
          code === 'SC005'
            ? 'This publication profile cannot faithfully represent this content. Review the limitation before export; source and Save remain available.'
            : 'The pinned font tables or declared shaping policy cannot faithfully render this text. Unicode source is preserved; no font is substituted.',
        line,
        endLine,
        sourceStart: first.sourceStart,
        sourceEnd: last.contentEnd,
        hasFix: false,
      }),
    );
  };
  // The profile parses physical paragraphs. Primary-codec force markers can
  // appear without blank separators; those source-safe cases need an explicit
  // limitation instead of letting the renderer silently change their roles.
  const paragraphAt = new Map<number, readonly number[]>();
  for (let from = 0; from < document.lines.length;) {
    if (blankSource(document.lines[from]!.sourceText)) {
      from++;
      continue;
    }
    let end = from + 1;
    while (
      end < document.lines.length &&
      !blankSource(document.lines[end]!.sourceText)
    )
      end++;
    const rows = Array.from({ length: end - from }, (_, i) => from + i);
    for (const row of rows) paragraphAt.set(row, rows);
    from = end;
  }
  // The renderer's hidden-text patterns ignore backslashes and title fields.
  const escaped = new Set<number>();
  for (const found of rendererOnlyHidden(source, paragraphAt)) {
    add('SC005', found.message, found.line, found.endLine);
    for (let at = found.line; at <= found.endLine; at++) escaped.add(at);
  }
  const ranges: { kind: OmissionKind; line: number; endLine: number }[] = [];
  const omitted = new Set<number>();
  for (const region of source.hiddenRegions) {
    const last = region.from + region.count - 1;
    let complete = region.closed && !region.ambiguous;
    for (let at = region.from; complete && at <= last; at++) {
      const kind = source.lines[at]!.kind;
      complete =
        !escaped.has(at) &&
        (kind === 'note' || kind === 'boneyard' || stripped.has(at));
    }
    if (complete)
      ranges.push({ kind: region.kind, line: region.from, endLine: last });
    else
      add(
        'SC005',
        `This ${region.kind} is unclosed, ambiguous or shares a line with printed text; the profile may print or drop text around it.`,
        region.from,
        last,
      );
    for (let at = region.from; at <= last; at++)
      if (document.lines[at]!.kind !== 'raw' && !stripped.has(at))
        omitted.add(at);
  }
  // Sections and synopses are summarised only where the renderer omits them
  // too: a paragraph made only of section lines and the synopses that follow
  // them, or a one-line synopsis directly after a heading or such a paragraph.
  const sectionParagraphs = new Set<readonly number[]>();
  for (const rows of new Set(paragraphAt.values()))
    if (
      rows.every(
        (row, index) =>
          rendererSection.test(document.lines[row]!.sourceText) ||
          (index > 0 && document.lines[row]!.sourceText.startsWith('=')),
      )
    )
      sectionParagraphs.add(rows);
  const attachable = new Set<number>();
  document.lines.forEach((row, line) => {
    if (omitted.has(line) || row.kind === 'blank') return;
    const rows = paragraphAt.get(line) ?? [line];
    const inSections = sectionParagraphs.has(rows);
    if (row.kind === 'raw') {
      add('SC005', 'The profile cannot verify raw content.', line);
      return;
    }
    if (row.kind === 'section' || row.kind === 'synopsis') {
      let previous = line - 1;
      while (previous >= 0 && blankSource(document.lines[previous]!.sourceText))
        previous--;
      const renderedAway =
        inSections ||
        (row.kind === 'synopsis' &&
          rows.length === 1 &&
          row.sourceText.startsWith('=') &&
          attachable.has(previous));
      if (renderedAway) {
        ranges.push({ kind: row.kind, line, endLine: line });
        omitted.add(line);
        attachable.add(line);
      } else
        add(
          'SC005',
          row.kind === 'section'
            ? 'The profile would print this section marker as text: start it at the line start with 1–6 # and keep section lines in their own paragraph.'
            : 'The profile would print this synopsis as text: place it directly after a scene heading or section.',
          line,
        );
      return;
    }
    if (
      row.kind === 'sceneHeading' &&
      rows.length === 1 &&
      !/^\s/.test(row.sourceText)
    )
      attachable.add(line);
    if (row.kind === 'title' || row.kind === 'titleContinuation') return;
    if (inSections)
      add(
        'SC005',
        'The profile would treat this line as a section heading and omit it.',
        line,
      );
    else if (
      row.kind !== 'pageBreak' &&
      rows.length === 1 &&
      row.sourceText.startsWith('=')
    )
      add(
        'SC005',
        'The profile may treat this line as a synopsis and omit it.',
        line,
      );
  });
  for (const field of document.titleFields) {
    const key = field.key.toLowerCase();
    if (!titleKeys.has(key)) {
      add(
        'SC005',
        `The profile omits unknown or extra title field “${field.key}”.`,
        field.from,
        field.from + field.count - 1,
      );
      for (let i = field.from; i < field.from + field.count; i++)
        omitted.add(i);
    }
  }
  const titleEnd = document.titleFields.at(-1);
  if (titleEnd) {
    const next = document.lines[titleEnd.from + titleEnd.count];
    if (next && next.sourceText !== '') {
      for (const field of document.titleFields)
        if (!omitted.has(field.from))
          add(
            'SC005',
            'The profile needs an empty line between title fields and the body.',
            field.from,
            field.from + field.count - 1,
          );
    }
  }
  for (const group of document.dialogueGroups) {
    const rows = paragraphAt.get(group.from) ?? [];
    if (
      document.lines[group.from]!.text.trim() &&
      (rows[0] !== group.from || rows.length !== group.count || group.count < 2)
    )
      add(
        'SC005',
        'The profile needs a separate speech paragraph for this cue and its dialogue.',
        group.from,
        group.from + group.count - 1,
      );
  }
  document.lines.forEach((row, line) => {
    const rows = paragraphAt.get(line) ?? [];
    if (
      ['sceneHeading', 'transition', 'pageBreak'].includes(row.kind) &&
      rows.length !== 1
    )
      add(
        'SC005',
        `The profile needs a separate paragraph for this ${row.kind}.`,
        line,
      );
    if (
      row.kind === 'centered' &&
      rows.some((index) => document.lines[index]!.kind !== 'centered')
    )
      add(
        'SC005',
        'The profile needs centered content in its own paragraph.',
        line,
      );
    if (
      (row.kind === 'action' || row.kind === 'lyrics') &&
      rows[0] !== undefined &&
      document.lines[rows[0]]!.kind === 'character'
    )
      add(
        'SC005',
        'The profile would absorb this content into the preceding speech paragraph.',
        line,
      );
    if (row.sceneNumber && !/^[\p{L}\p{N}_\-.]+$/u.test(row.sceneNumber))
      add(
        'SC005',
        'The profile cannot represent this scene-number syntax.',
        line,
      );
  });
  const sourceBytes = document.hiddenRegions.length ? document.bytes : null;
  document.lines.forEach((row, line) => {
    if (omitted.has(line) || row.kind === 'blank' || row.kind === 'pageBreak')
      return;
    let runs: readonly StyledText[] = row.inline?.runs ?? [
      { text: row.text, styles: [] },
    ];
    if (row.hiddenOf) {
      const regions = document.hiddenRegions.filter(
        (region) =>
          region.sourceStart < row.contentEnd &&
          region.sourceEnd > row.sourceStart,
      );
      const bytes = sourceBytes!;
      let from = row.sourceStart;
      const visible: string[] = [];
      const decoder = new TextDecoder();
      for (const region of regions) {
        visible.push(
          decoder.decode(bytes.slice(from, Math.max(from, region.sourceStart))),
        );
        from = Math.max(from, region.sourceEnd);
      }
      if (from < row.contentEnd)
        visible.push(decoder.decode(bytes.slice(from, row.contentEnd)));
      runs = parseInline(visible.join('')).runs;
    }
    const misses = new Set<string>();
    for (const run of [
      ...runs,
      ...(row.sceneNumber ? [{ text: row.sceneNumber, styles: [] }] : []),
    ]) {
      const bold = run.styles.includes('bold');
      const italic = run.styles.includes('italic') || row.kind === 'lyrics';
      const suffix = bold
        ? italic
          ? ' Bold Italic'
          : ' Bold'
        : italic
          ? ' Italic'
          : '';
      const font = coverage.fonts.find(
        (font) => font.file === `Courier Prime${suffix}.ttf`,
      )!;
      for (const char of run.text) {
        const code = char.codePointAt(0)!;
        // Renderer layout consumes these separators; other spaces need cmap coverage.
        if (char === ' ' || char === '\t' || char === '\r' || char === '\n')
          continue;
        if (code === 0)
          misses.add('U+0000 is an unsupported nonprinting control');
        else if (inRanges(code, shapingRanges))
          misses.add(
            `U+${code.toString(16).toUpperCase().padStart(4, '0')} requires unsupported shaping`,
          );
        else if (!inRanges(code, font.ranges))
          misses.add(
            `U+${code.toString(16).toUpperCase().padStart(4, '0')} is missing from ${font.file}`,
          );
      }
    }
    for (const miss of misses) add('SC008', miss + '.', line);
  });
  const probes = assessmentLayoutProbes(source);
  const layoutCurrent =
    Array.isArray(context.layout) &&
    context.layout.length === probes.length &&
    context.layout.every(
      (feature) => feature === null || layoutFeatures.has(feature),
    );
  if (layoutCurrent)
    context.layout!.forEach((feature, index) => {
      if (feature) {
        const probe = probes[index]!;
        add(
          feature === 'glyph-coverage-or-shaping' ? 'SC008' : 'SC005',
          `The frozen layout refuses ${feature}.`,
          probe.line,
          probe.endLine,
        );
      }
    });
  issues.sort((a, b) => a.line! - b.line! || a.code.localeCompare(b.code));
  ranges.sort((a, b) => a.line - b.line || a.endLine - b.endLine);
  const total = (kind: OmissionKind): OmissionTotal => {
    const lines = new Set<number>();
    let count = 0;
    for (const range of ranges)
      if (range.kind === kind) {
        count++;
        for (let at = range.line; at <= range.endLine; at++) lines.add(at);
      }
    return Object.freeze({ count, lines: lines.size });
  };
  return Object.freeze({
    status: 'verified',
    provenance: PUBLICATION_ASSESSMENT_IDENTITY,
    version: context.version,
    sourceSha256: context.sourceSha256,
    issues: Object.freeze(issues),
    truncated,
    omissions: Object.freeze({
      notes: total('note'),
      boneyards: total('boneyard'),
      sections: total('section'),
      synopses: total('synopsis'),
      ranges: Object.freeze(ranges.map((range) => Object.freeze(range))),
    }),
    layout: layoutCurrent ? 'verified' : 'unavailable',
  });
}
