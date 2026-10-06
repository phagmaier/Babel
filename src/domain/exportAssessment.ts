import { parseFountain } from './fountainCodec';
import { parseInline } from './fountainInline';
import { isEscaped, unescapedIndex } from './fountainSyntax';
import coverage from './publicationCoverage.json';
import {
  expandTabs,
  rendererReading,
  rendererSection,
  type RendererParagraph,
  type RendererReading,
  type RendererRole,
} from './rendererReading';
import type {
  StyledText,
  FountainDocument,
  FountainKind,
  FountainLine,
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
/** What the frozen renderer leaves out, as its `unsupported-publication:*`
 * warnings name it. */
export const OMISSION_CATEGORIES = [
  'boneyards',
  'notes',
  'sections',
  'synopses',
  'unknown-title-fields',
] as const;
export type OmissionCategory = (typeof OMISSION_CATEGORIES)[number];
const summarised: Record<OmissionKind, OmissionCategory> = {
  note: 'notes',
  boneyard: 'boneyards',
  section: 'sections',
  synopsis: 'synopses',
};
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
      /** Omission categories this assessment accounts for, as the helper
       * names them: a counted omission above, a blocking issue about that
       * kind, or hidden-text syntax inside lines already told about. Export
       * stops on a renderer warning outside this set. */
      readonly announced: readonly OmissionCategory[];
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

/** Read original source in the renderer's order: global boneyards, title and
 * paragraph boundaries, then notes inside body paragraphs. The codec view is
 * for classifying shown content; pre-stripping its inline spans would change
 * how overlapping markers close and where paragraphs end. This also preserves
 * note-only title values before body-note removal (AUDIT-D04-R5). */
export function assessmentReading(source: FountainDocument): RendererReading {
  return rendererReading(source.lines);
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
interface HiddenFinding {
  message: string;
  line: number;
  endLine: number;
  omits: OmissionCategory;
}
function rendererOnlyHidden(
  document: FountainDocument,
  paragraphAt: ReadonlyMap<number, readonly number[]>,
): HiddenFinding[] {
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
  const found: HiddenFinding[] = [];
  const scan = (
    rows: readonly number[],
    pattern: RegExp,
    omits: OmissionCategory,
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
          omits,
        });
    }
  };
  scan(
    lines.map((_, index) => index),
    /\/\*[\s\S]*?\*\//g,
    'boneyards',
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
        'notes',
        () =>
          'The profile ignores the backslash before a note marker and would drop this text up to the next closing marker.',
      );
  return found;
}

// AUDIT-D04-R2. The codec reads forcing markers after indentation, page breaks
// with surrounding whitespace and cues ending in two spaces; the pinned
// renderer does not, and it prints headings and forced transitions in capitals.
const forcedMarkers: Partial<Record<FountainLine['kind'], [string, string]>> = {
  action: ['!', 'as text'],
  sceneHeading: ['.', 'and this heading as action'],
  character: ['@', 'as text and may print this speech as action'],
  transition: ['>', 'and may print this transition as action'],
  lyrics: ['~', 'and this lyric without italics'],
};
/** What the pinned renderer would print differently from the codec's reading. */
function rendererLineReading(
  row: FountainLine,
  line: number,
  paragraph: readonly number[],
): string | null {
  const text = row.sourceText;
  if (text !== text.trimStart()) {
    const forced = forcedMarkers[row.kind];
    if (forced && row.marker === forced[0])
      return `The profile reads the “${forced[0]}” marker only at the start of a line; after leading spaces or tabs it would print “${forced[0]}” ${forced[1]}.`;
    if (row.kind === 'sceneHeading')
      return 'The profile reads a scene heading only at the start of a line; it would print this indented heading as action.';
  }
  if (row.kind === 'pageBreak' && text !== text.trim())
    return 'The profile breaks the page only on a line of “=” signs with no spaces or tabs around them; it would print this line as text, or omit it as a synopsis directly after a scene heading or section.';
  // An empty “@” is a cue for the renderer only when it opens a speech
  // paragraph and something, even a space, follows the marker.
  if (
    row.kind === 'character' &&
    row.marker === '@' &&
    text.trimEnd() === '@' &&
    (text === '@' || paragraph.length === 1 || paragraph[0] !== line)
  )
    return 'The profile does not read an empty “@” cue; it would print “@” and any speech below it as action.';
  if (
    row.kind === 'character' &&
    expandTabs(text).endsWith('  ') &&
    paragraph.length > 1
  )
    return 'The profile does not read a cue that ends with two spaces or a tab that expands to them; it would print this cue, with any “@” marker, and its speech as action.';
  if (row.kind === 'transition' && text === '>')
    return 'The profile does not read an empty “>” transition; it would print “>” as text.';
  if (paragraph.length !== 1) return null;
  const capitals = (value?: string) =>
    value !== undefined && value !== value.toUpperCase();
  if (
    row.kind === 'sceneHeading' &&
    (capitals(row.text) || capitals(row.sceneNumber))
  )
    return 'The profile prints scene headings in capitals; this heading would not print as written.';
  if (row.kind === 'transition' && row.marker === '>' && capitals(row.text))
    return 'The profile prints forced transitions in capitals; this transition would not print as written.';
  return null;
}

// AUDIT-D04-R3. What the renderer prints for each codec line kind. Kinds that
// print nothing or are assessed elsewhere have no entry and are not compared.
const printedAs: Partial<Record<FountainKind, RendererRole>> = {
  sceneHeading: 'heading',
  action: 'action',
  lyrics: 'action',
  character: 'cue',
  dialogue: 'dialogue',
  parenthetical: 'parenthetical',
  transition: 'transition',
  centered: 'centered',
  section: 'section',
  synopsis: 'synopsis',
  pageBreak: 'pageBreak',
};
const roleNames: Record<RendererRole, string> = {
  heading: 'a scene heading',
  action: 'action',
  centered: 'centered text',
  cue: 'a character cue',
  dialogue: 'dialogue',
  parenthetical: 'a parenthetical',
  transition: 'a transition',
  section: 'a section heading',
  synopsis: 'a synopsis',
  pageBreak: 'a page break',
};
const quoted = (text: string) => {
  const trimmed = text.trim();
  return `“${trimmed.length > 40 ? trimmed.slice(0, 40) + '…' : trimmed}”`;
};
interface Disagreement {
  readonly message: string;
  readonly line: number;
  endLine: number;
  /** Set where the renderer reads the lines as a kind it does not print. */
  readonly omits: readonly OmissionCategory[];
}
/** Where the renderer's reading of one paragraph differs from the roles the
 * codec shows, with what the renderer would do. */
function rendererDisagreements(
  paragraph: RendererParagraph,
  lines: readonly FountainLine[],
): Disagreement[] {
  const { rows, roles, texts } = paragraph;
  const differs = (index: number) => {
    const row = lines[rows[index]!]!;
    const shown = printedAs[row.kind];
    // An empty line prints as space whatever its role.
    if (shown === undefined || texts[index]!.trim() === '') return false;
    return (
      shown !== roles[index] ||
      (shown === 'heading' &&
        (row.sceneNumber ?? '').toUpperCase() !== (paragraph.sceneNumber ?? ''))
    );
  };
  const differing = rows.map((_, index) => index).filter(differs);
  if (!differing.length) return [];
  const first = differing[0]!;
  const row = lines[rows[first]!]!;
  const readAs = (role: RendererRole) =>
    differing.some((index) => roles[index] === role);
  const whole = (message: string): Disagreement[] => [
    {
      message,
      line: rows[first]!,
      endLine: rows[differing.at(-1)!]!,
      omits: [
        ...(readAs('section') ? (['sections'] as const) : []),
        ...(readAs('synopsis') ? (['synopses'] as const) : []),
      ],
    },
  ];
  const codecBlank = (at: number) => lines[at]!.sourceText.trim() === '';
  // The two sides draw this paragraph's edges differently: the renderer reads
  // through a line of spaces or tabs, and a boneyard it deleted beside the
  // paragraph left an empty line the codec does not see.
  const joined = rows.some(codecBlank);
  const split = [rows[0]! - 1, paragraph.end + 1].some(
    (at) => at >= 0 && at < lines.length && !codecBlank(at),
  );
  const alone =
    'The profile deletes a boneyard on its own line and leaves an empty line there, so this line stands alone: ';
  const cue = quoted(texts[0]!);
  const text = texts[first]!;
  if (paragraph.kind === 'speech' && first === 0) {
    const reason = split
      ? `The profile deletes a boneyard on its own line and leaves an empty line there, so a paragraph starts at ${cue}: it would read that as a character cue and print these lines as a speech.`
      : joined
        ? `The profile ends a paragraph only at an empty line or a single space. It would read through the line of spaces or tabs here, take ${cue} as a character cue and print these lines as one speech.`
        : row.kind === 'lyrics'
          ? `The profile reads a first line in capitals as a character cue even when it is a lyric: it would print ${cue} with its “~” as a cue and the lines below it as dialogue.`
          : `The profile reads ${cue} as a character cue because the text before its first bracket is in capitals: it would print these lines as a speech.`;
    return whole(reason);
  }
  if (paragraph.kind === 'speech') {
    // The cue agrees; the renderer's bracket rule decides each line below it.
    const runs: Disagreement[] = [];
    for (const index of differing) {
      const last = runs.at(-1);
      const message =
        roles[index] === 'parenthetical' &&
        lines[rows[index]!]!.kind === 'dialogue'
          ? 'The profile treats a speech line that starts with “(”, even inside emphasis markers, as a parenthetical, and every line after it until one ends with “)”: it would print this dialogue with the parenthetical indent.'
          : `The profile reads this line as ${roleNames[roles[index]!]} inside the speech; it would not print as the script shows.`;
      if (last && last.message === message && last.endLine === rows[index - 1])
        last.endLine = rows[index]!;
      else
        runs.push({
          message,
          line: rows[index]!,
          endLine: rows[index]!,
          omits: [],
        });
    }
    return runs;
  }
  let message: string;
  if (row.kind === 'character' && first === 0)
    message = `The profile reads a character cue only where capitals come before its first bracket: it would print ${cue} and the speech below it as action.`;
  else if (paragraph.kind === 'heading' && row.kind !== 'sceneHeading')
    message = text.startsWith('.')
      ? 'The profile reads a line that starts with a single period as a scene heading: it would drop the period and print the rest in capitals as a heading.'
      : split
        ? alone + 'it would print it as a scene heading.'
        : 'The profile reads this line as a scene heading and would print it in capitals as one.';
  else if (paragraph.kind === 'heading')
    message = paragraph.sceneNumber
      ? `The profile reads “#${paragraph.sceneNumber}#” at the end of this heading as a scene number, with or without a space before it and whatever spaces follow: it would print ${paragraph.sceneNumber} in the margins and leave it out of the heading.`
      : 'The profile does not read a scene number in this heading; it would print it as part of the heading.';
  else if (paragraph.kind === 'transition')
    message = split
      ? alone + 'it would print it as a transition.'
      : 'The profile reads this line as a transition and would print it as one.';
  else if (paragraph.kind === 'sections')
    message =
      (split
        ? alone + 'it would treat it'
        : 'The profile would treat this line') +
      ' as a section heading and omit it.';
  else if (row.kind === 'sceneHeading' && rows.length === 1)
    message =
      'The profile reads a scene heading only where INT, EXT, EST, INT/EXT or I/E is followed by a period, or by a space and more text: it would print this line as action.';
  else if (row.kind === 'transition' && rows.length === 1)
    message =
      'The profile reads a transition only where capital letters come before the closing “TO:”: it would print this line as action.';
  else
    message = `The profile reads this line as ${roleNames[roles[first]!]}; it would not print as the script shows.`;
  return whole(message);
}

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
  const rendered = assessmentReading(source);
  const roleAt = new Map<number, RendererRole>();
  for (const paragraph of rendered.paragraphs)
    paragraph.rows.forEach((row, index) =>
      roleAt.set(row, paragraph.roles[index]!),
    );
  const issues: CheckIssue[] = [];
  let truncated = false;
  // AUDIT-EXPORT-WARNINGS: what the author is told the profile leaves out.
  const announced = new Set<OmissionCategory>();
  // The helper finds notes and boneyards by pattern over the raw source, so it
  // also reports hidden text inside lines the author is already told about:
  // a counted omission, any limitation, or a title value, where the renderer
  // prints note brackets as written. Those lines announce what their own text
  // holds; unverified lines may also hold a section or synopsis it omits.
  const tell = (from: number, to: number, unverified = false) => {
    const rows = source.lines.slice(from, to + 1).map((row) => row.sourceText);
    const text = rows.join('\n');
    if (/\/\*[\s\S]*?\*\//.test(text)) announced.add('boneyards');
    if (/\[\[[\s\S]*?\]\]/.test(text)) announced.add('notes');
    if (!unverified) return;
    if (rows.some((row) => rendererSection.test(row)))
      announced.add('sections');
    if (rows.some((row) => row.startsWith('='))) announced.add('synopses');
  };
  const add = (
    code: 'SC005' | 'SC008',
    message: string,
    line: number,
    endLine = line,
    omits: readonly OmissionCategory[] = [],
  ) => {
    if (issues.length >= LIMIT) {
      truncated = true;
      return;
    }
    for (const category of omits) announced.add(category);
    if (omits.length) tell(line, endLine);
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
    add('SC005', found.message, found.line, found.endLine, [found.omits]);
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
    if (complete) {
      ranges.push({ kind: region.kind, line: region.from, endLine: last });
      tell(region.from, last);
    } else {
      tell(region.from, last, true);
      add(
        'SC005',
        `This ${region.kind} is unclosed, ambiguous or shares a line with printed text; the profile may print or drop text around it.`,
        region.from,
        last,
        [summarised[region.kind]],
      );
    }
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
      tell(line, line, true);
      return;
    }
    if (row.kind === 'section' || row.kind === 'synopsis') {
      let previous = line - 1;
      while (previous >= 0 && blankSource(document.lines[previous]!.sourceText))
        previous--;
      // The renderer attaches a synopsis only to a heading or section it
      // read itself; one it reads as anything else is printed.
      const role = roleAt.get(line);
      const renderedAway =
        (inSections ||
          (row.kind === 'synopsis' &&
            rows.length === 1 &&
            row.sourceText.startsWith('=') &&
            attachable.has(previous))) &&
        (role === undefined || role === 'section' || role === 'synopsis');
      if (renderedAway) {
        ranges.push({ kind: row.kind, line, endLine: line });
        omitted.add(line);
        attachable.add(line);
      } else
        add(
          'SC005',
          role === 'section'
            ? 'The profile reads this line as a section heading and omits it after removing hidden text around it.'
            : role === 'synopsis'
              ? 'The profile attaches this synopsis to the preceding scene heading or section and omits it after skipping hidden text.'
              : row.kind === 'section'
                ? 'The profile would print this section marker as text: start it at the line start with 1–6 # and keep section lines in their own paragraph.'
                : 'The profile would print this synopsis as text: place it directly after a scene heading or section.',
          line,
          line,
          [summarised[row.kind]],
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
        line,
        // Below a section line, a line starting with “=” is its synopsis.
        [rendererSection.test(row.sourceText) ? 'sections' : 'synopses'],
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
        line,
        ['synopses'],
      );
  });
  for (const field of document.titleFields) {
    const key = field.key.toLowerCase();
    tell(field.from, field.from + field.count - 1);
    if (!titleKeys.has(key)) {
      add(
        'SC005',
        `The profile omits unknown or extra title field “${field.key}”.`,
        field.from,
        field.from + field.count - 1,
        ['unknown-title-fields'],
      );
      for (let i = field.from; i < field.from + field.count; i++)
        omitted.add(i);
    }
  }
  const titleEnd = document.titleFields.at(-1);
  // AUDIT-D04-R1: the codec and the renderer must agree on whether the opening
  // block is a title page. The renderer removes boneyards first, so one on its
  // own line ends its block early (AUDIT-D04-R3), or leaves whitespace the
  // renderer reads as a value and so joins a title block the codec does not
  // see (AUDIT-D04-R4). A boneyard the renderer removes from a title field is
  // reported above, and only then is the title-versus-body comparison skipped.
  // Separate renderer keys are checked regardless; a missing separator is
  // reported below.
  const codecTitle = titleEnd ? titleEnd.from + titleEnd.count : 0;
  const rendererTitle = rendered.title;
  const openingEnd = Math.max(codecTitle, rendererTitle?.length ?? 0);
  let hiddenReported = false;
  for (let at = 0; at < openingEnd; at++) hiddenReported ||= escaped.has(at);
  if (rendererTitle && !codecTitle)
    add(
      'SC005',
      'The profile reads this opening block as a title page and would not print it as script text.',
      0,
      rendererTitle.length - 1,
      ['unknown-title-fields'],
    );
  else if (!hiddenReported) {
    const separated = (document.lines[codecTitle]?.sourceText ?? '') === '';
    if (codecTitle && !rendererTitle && separated)
      add(
        'SC005',
        'The profile does not read these lines as a title page; it would print every field, keys included, as script text.',
        0,
        codecTitle - 1,
      );
  }
  if (rendererTitle && codecTitle) {
    // A separate renderer key can lie outside the codec's title fields, and a
    // reported boneyard in another field does not account for its omission.
    const keys = [...rendererTitle.keys];
    for (const [index, at] of keys.entries()) {
      if (document.titleFields.some((field) => field.from === at)) continue;
      const key = document.lines[at]!.sourceText.split(':')[0]!.toLowerCase();
      const unknown = !titleKeys.has(key);
      add(
        'SC005',
        unknown
          ? 'The profile reads this line as a separate title field with an unknown key and would not print it or its values.'
          : 'The profile reads this line as a separate title field and would print its value on the title page.',
        at,
        (keys[index + 1] ?? rendererTitle.length) - 1,
        unknown ? ['unknown-title-fields'] : [],
      );
    }
  }
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
    const reading = rendererLineReading(row, line, rows);
    // Its only page-break reading says the line may be omitted as a synopsis.
    if (reading)
      add(
        'SC005',
        reading,
        line,
        line,
        row.kind === 'pageBreak' ? ['synopses'] : [],
      );
  });
  // AUDIT-D04-R3: every remaining line whose printed role differs from the one
  // the script shows. A paragraph an earlier limitation already reports is
  // left to that limitation.
  const reported = issues.map((issue) => [issue.line!, issue.endLine]);
  for (const paragraph of rendered.paragraphs) {
    const [first, last] = [paragraph.rows[0]!, paragraph.end];
    if (!reported.some(([from, to]) => from! <= last && first <= to!))
      for (const found of rendererDisagreements(paragraph, document.lines))
        add('SC005', found.message, found.line, found.endLine, found.omits);
  }
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
  for (const range of ranges) announced.add(summarised[range.kind]);
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
    announced: Object.freeze(
      OMISSION_CATEGORIES.filter((category) => announced.has(category)),
    ),
    layout: layoutCurrent ? 'verified' : 'unavailable',
  });
}
