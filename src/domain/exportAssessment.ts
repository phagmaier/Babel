import { parseInline } from './fountainInline';
import coverage from './publicationCoverage.json';
import type { StyledText, FountainDocument } from './fountainModel';
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
      /** Content assessment is not an exported PDF or a page-count receipt. */
      readonly layout: 'verified' | 'unavailable';
    };
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

/** Layout-dependent constructs are checked by the same frozen pipeline in memory.
 * The codec owns boundaries; the renderer cannot choose or omit the targets. */
export function assessmentLayoutProbes(
  document: FountainDocument,
): readonly LayoutProbe[] {
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
export function evaluateExportAssessment(
  document: FountainDocument,
  context?: AssessmentContext,
): ExportAssessment {
  if (
    !context ||
    !matchingAssessmentIdentity(context.identity) ||
    !Number.isSafeInteger(context.version) ||
    context.version <= 0 ||
    !/^[a-f0-9]{64}$/.test(context.sourceSha256) ||
    document.readOnlyReason
  )
    return Object.freeze({
      status: 'unavailable',
      reason:
        'SC005/SC008 need a matching verified renderer, profile and pinned font identity.',
      provenance:
        'ADR 0037 / us-letter-draft-v1; no export success is implied.',
    });
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
    const first = document.lines[line]!;
    const last = document.lines[endLine]!;
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
  const omitted = new Set<number>();
  const unsupported = new Set([
    'section',
    'synopsis',
    'note',
    'boneyard',
    'raw',
  ]);
  for (const region of document.hiddenRegions) {
    add(
      'SC005',
      `The profile omits ${region.kind} content.`,
      region.from,
      region.from + region.count - 1,
    );
    for (let i = region.from; i < region.from + region.count; i++)
      if (document.lines[i]!.kind !== 'raw') omitted.add(i);
  }
  document.lines.forEach((row, line) => {
    if (unsupported.has(row.kind) && !omitted.has(line)) {
      add(
        'SC005',
        `The profile ${row.kind === 'raw' ? 'cannot verify raw' : 'omits ' + row.kind} content.`,
        line,
      );
      if (row.kind !== 'raw') omitted.add(line);
    }
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
  // The profile parses physical paragraphs. Primary-codec force markers can
  // appear without blank separators; those source-safe cases need an explicit
  // limitation instead of letting the renderer silently change their roles.
  const paragraphAt = new Map<number, readonly number[]>();
  for (let from = 0; from < document.lines.length;) {
    if (
      document.lines[from]!.sourceText === '' ||
      document.lines[from]!.sourceText === ' '
    ) {
      from++;
      continue;
    }
    let end = from + 1;
    while (
      end < document.lines.length &&
      document.lines[end]!.sourceText !== '' &&
      document.lines[end]!.sourceText !== ' '
    )
      end++;
    const rows = Array.from({ length: end - from }, (_, i) => from + i);
    for (const row of rows) paragraphAt.set(row, rows);
    from = end;
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
  const probes = assessmentLayoutProbes(document);
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
  return Object.freeze({
    status: 'verified',
    provenance: PUBLICATION_ASSESSMENT_IDENTITY,
    version: context.version,
    sourceSha256: context.sourceSha256,
    issues: Object.freeze(issues),
    truncated,
    layout: layoutCurrent ? 'verified' : 'unavailable',
  });
}
