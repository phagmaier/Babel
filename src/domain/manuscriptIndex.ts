/** Immutable, advisory source projection. No parser, editor, disk or UI authority. */
import type { FountainDocument, FountainKind } from './fountainModel';

export const MAX_INDEX_LINES = 50_000;
export const MAX_OUTLINE_ITEMS = 10_000;
export const MAX_SECTION_DEPTH = 64;
export const MAX_TEXT_LOCATIONS = 100_000;
export const MAX_LOGICAL_RUNS = 200_000;
export type TextScope = 'body' | 'title' | 'note' | 'omitted' | 'raw';
export interface LogicalRun {
  readonly from: number;
  readonly to: number;
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly source: string;
  readonly escaped: boolean;
}
export interface LogicalText {
  readonly id: string;
  readonly rowId: string;
  readonly row: number;
  readonly kind: FountainKind;
  readonly scope: TextScope;
  readonly text: string;
  readonly newline: string;
  readonly runs: readonly LogicalRun[];
}
export interface OutlineItem {
  readonly id: string;
  readonly kind: 'section' | 'scene';
  readonly label: string;
  readonly row: number;
  readonly endRow: number;
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly parentId: string | null;
  readonly children: readonly string[];
  readonly level: number;
  readonly ordinal: number | null;
  readonly sceneNumber: string | null;
  readonly synopses: readonly string[];
}
export interface Attachment {
  readonly kind: 'synopsis' | 'note' | 'blank';
  readonly from: number;
  readonly to: number;
  readonly ownerId: string | null;
  readonly candidates: readonly string[];
  readonly ambiguous: boolean;
}
export interface IntactRange {
  readonly id: string;
  readonly kind: 'title' | 'note' | 'boneyard' | 'raw' | 'dual';
  readonly from: number;
  readonly to: number;
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly ambiguous: boolean;
  readonly members: readonly string[];
}
export interface ManuscriptIndex {
  readonly items: readonly OutlineItem[];
  readonly roots: readonly string[];
  readonly texts: readonly LogicalText[];
  readonly attachments: readonly Attachment[];
  readonly intact: readonly IntactRange[];
  readonly lineCount: number;
  readonly byteLength: number;
}

const indexedDocuments = new WeakMap<ManuscriptIndex, FountainDocument>();
export function indexDescribesDocument(
  index: ManuscriptIndex,
  document: FountainDocument,
): boolean {
  return indexedDocuments.get(index) === document;
}

/** Marker-aware content start in the retained physical source line. */
export function extractedContentStart(
  line: import('./fountainModel').FountainLine,
): number {
  if (line.sourceText === line.text) return 0;
  let from = line.sourceText.length - line.sourceText.trimStart().length;
  if (line.kind === 'title') {
    from = line.sourceText.indexOf(':') + 1;
    if (/[ \t]/.test(line.sourceText[from] ?? '')) from++;
  } else if (line.marker && line.kind !== 'pageBreak') {
    from += line.marker === '><' ? 1 : line.marker.length;
    if (line.kind === 'section' || line.kind === 'synopsis')
      while (/\s/.test(line.sourceText[from] ?? '')) from++;
  }
  return line.text ? line.sourceText.indexOf(line.text, from) : from;
}

function utf8Length(text: string): number {
  let size = 0;
  for (const scalar of text) {
    const code = scalar.codePointAt(0)!;
    size += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return size;
}
/** Exact source byte boundary, right affinity at run joins; split scalars refuse. */
export function logicalByteAt(location: LogicalText, offset: number): number {
  if (!Number.isInteger(offset) || offset < 0 || offset > location.text.length)
    throw new RangeError('Invalid logical offset');
  if (
    offset > 0 &&
    offset < location.text.length &&
    /[\uD800-\uDBFF]/.test(location.text[offset - 1]!) &&
    /[\uDC00-\uDFFF]/.test(location.text[offset]!)
  )
    throw new RangeError('Logical offset splits a Unicode scalar');
  const run = location.runs.find(
    (run) =>
      offset >= run.from &&
      (offset < run.to ||
        (offset === location.text.length && offset === run.to)),
  );
  if (!run) throw new RangeError('Empty logical location has no byte anchor');
  return run.escaped
    ? offset === run.from
      ? run.sourceStart
      : run.sourceEnd
    : run.sourceStart + utf8Length(run.source.slice(0, offset - run.from));
}

function logicalTexts(document: FountainDocument): LogicalText[] {
  const result: LogicalText[] = [];
  let runCount = 0;
  let regionAt = 0;
  for (const [row, line] of document.lines.entries()) {
    const offsets = new Uint32Array(line.sourceText.length + 1);
    let byte = line.sourceStart;
    for (let at = 0; at < line.sourceText.length;) {
      offsets[at] = byte;
      const code = line.sourceText.codePointAt(at)!;
      if (code > 0xffff) offsets[at + 1] = byte;
      at += code > 0xffff ? 2 : 1;
      byte += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
    }
    offsets[line.sourceText.length] = byte;
    const add = (
      scope: TextScope,
      slices: readonly { source: string; at: number; decode: boolean }[],
    ) => {
      const runs: LogicalRun[] = [];
      let text = '';
      for (const slice of slices) {
        for (let at = 0; at < slice.source.length;) {
          const escaped =
            slice.decode &&
            slice.source[at] === '\\' &&
            /[\\*_[\]]/.test(slice.source[at + 1] ?? '');
          let end = at + (escaped ? 2 : 1);
          if (!escaped) {
            while (
              end < slice.source.length &&
              !(
                slice.decode &&
                slice.source[end] === '\\' &&
                /[\\*_[\]]/.test(slice.source[end + 1] ?? '')
              )
            )
              end++;
          }
          const source = slice.source.slice(at, end);
          const decoded = escaped ? source.slice(1) : source;
          if (++runCount > MAX_LOGICAL_RUNS)
            throw new RangeError(
              'Logical run limit exceeded; no partial result',
            );
          runs.push(
            Object.freeze({
              from: text.length,
              to: text.length + decoded.length,
              sourceStart: offsets[slice.at + at]!,
              sourceEnd: offsets[slice.at + end]!,
              source,
              escaped,
            }),
          );
          text += decoded;
          at = end;
        }
      }
      if (result.length >= MAX_TEXT_LOCATIONS)
        throw new RangeError(
          'Logical location limit exceeded; no partial result',
        );
      result.push(
        Object.freeze({
          id: `${line.id}:${result.length}`,
          rowId: line.id,
          row,
          kind: line.kind,
          scope,
          text,
          newline: line.newline,
          runs: Object.freeze(runs),
        }),
      );
    };
    while (
      regionAt < document.hiddenRegions.length &&
      document.hiddenRegions[regionAt]!.sourceEnd <= line.sourceStart
    )
      regionAt++;
    const regions = [];
    for (
      let at = regionAt;
      at < document.hiddenRegions.length &&
      document.hiddenRegions[at]!.sourceStart < line.contentEnd;
      at++
    )
      regions.push(document.hiddenRegions[at]!);
    if (regions.length) {
      // Partition mixed/protected rows. Region wrappers stay in intact ranges,
      // hidden body and surrounding unknown text get separate logical locations.
      let cursor = 0;
      const charAtByte = (value: number) => {
        let low = 0,
          high = offsets.length - 1;
        while (low < high) {
          const middle = Math.floor((low + high) / 2);
          if (offsets[middle]! < value) low = middle + 1;
          else high = middle;
        }
        if (offsets[low] === value) return low;
        throw new RangeError(
          'Hidden source boundary is not a Unicode boundary',
        );
      };
      for (const region of regions) {
        const start = charAtByte(
          Math.max(line.sourceStart, region.sourceStart),
        );
        if (start > cursor)
          add('raw', [
            {
              source: line.sourceText.slice(cursor, start),
              at: cursor,
              decode: false,
            },
          ]);
        const from = charAtByte(
          Math.max(
            line.sourceStart,
            Math.min(line.contentEnd, region.contentStart),
          ),
        );
        const to = charAtByte(
          Math.max(
            line.sourceStart,
            Math.min(line.contentEnd, region.contentEnd),
          ),
        );
        add(region.kind === 'note' ? 'note' : 'omitted', [
          { source: line.sourceText.slice(from, to), at: from, decode: false },
        ]);
        cursor = charAtByte(Math.min(line.contentEnd, region.sourceEnd));
      }
      if (cursor < line.sourceText.length)
        add('raw', [
          { source: line.sourceText.slice(cursor), at: cursor, decode: false },
        ]);
    } else {
      const scope = line.titleOf
        ? 'title'
        : line.kind === 'raw'
          ? 'raw'
          : 'body';
      const from = extractedContentStart(line);
      if (from < 0)
        throw new RangeError('Logical text cannot be located in source');
      const slices = line.inline?.complete
        ? line.inline.runs.map((run) => ({
            source: line.text.slice(run.start, run.end),
            at: from + run.start,
            decode: true,
          }))
        : [{ source: line.text, at: from, decode: false }];
      add(scope, slices);
    }
  }
  return result;
}

export function buildManuscriptIndex(
  document: FountainDocument,
): ManuscriptIndex {
  if (document.readOnlyReason)
    throw new RangeError('No Unicode index for unsupported source encoding');
  const lines = document.lines;
  if (lines.length > MAX_INDEX_LINES)
    throw new RangeError(
      'Manuscript index line limit exceeded; no partial result',
    );
  type MutableItem = {
    -readonly [K in keyof OutlineItem]: K extends 'children' | 'synopses'
      ? string[]
      : OutlineItem[K];
  };
  const items: MutableItem[] = [];
  const roots: string[] = [];
  const sections: MutableItem[] = [];
  const owners: (string | null)[] = [];
  let scene: MutableItem | null = null;
  let ordinal = 0;
  const bytes = lines.at(-1)?.sourceEnd ?? (document.bom ? 3 : 0);
  if (bytes > 16 * 1024 * 1024)
    throw new RangeError(
      'Manuscript index byte limit exceeded; no partial result',
    );
  const close = (item: MutableItem, row: number) => {
    item.endRow = row;
    item.sourceEnd = lines[row]?.sourceStart ?? bytes;
  };
  for (const [row, line] of lines.entries()) {
    if (line.kind === 'section' || line.kind === 'sceneHeading') {
      if (scene) {
        close(scene, row);
        scene = null;
      }
      const level = line.kind === 'section' ? (line.sectionLevel ?? 1) : 0;
      if (level)
        while (sections.length && sections.at(-1)!.level >= level)
          close(sections.pop()!, row);
      const parent = sections.at(-1);
      if (level && sections.length >= MAX_SECTION_DEPTH)
        throw new RangeError('Section depth limit exceeded; no partial result');
      const item: MutableItem = {
        id: line.id,
        kind: level ? 'section' : 'scene',
        label: line.inline?.complete ? line.inline.text : line.text,
        row,
        endRow: lines.length,
        sourceStart: line.sourceStart,
        sourceEnd: bytes,
        parentId: parent?.id ?? null,
        children: [],
        level,
        ordinal: level ? null : ++ordinal,
        sceneNumber: line.sceneNumber ?? null,
        synopses: [],
      };
      if (items.length >= MAX_OUTLINE_ITEMS)
        throw new RangeError('Outline item limit exceeded; no partial result');
      items.push(item);
      if (parent) parent.children.push(item.id);
      else roots.push(item.id);
      if (level) sections.push(item);
      else scene = item;
    }
    const owner = scene ?? sections.at(-1);
    owners[row] = owner?.id ?? null;
    if (line.kind === 'synopsis' && owner)
      owner.synopses.push(line.inline?.complete ? line.inline.text : line.text);
  }
  const nextBoundary: (string | null)[] = [];
  let following: string | null = null;
  for (let row = lines.length - 1; row >= 0; row--) {
    nextBoundary[row] = following;
    const line = lines[row]!;
    following = ['sceneHeading', 'section'].includes(line.kind)
      ? line.id
      : ['blank', 'note'].includes(line.kind)
        ? following
        : null;
  }
  const ambiguousNotes = new Set<number>();
  for (const region of document.hiddenRegions)
    if (!region.closed || region.ambiguous)
      for (let row = region.from; row < region.from + region.count; row++)
        ambiguousNotes.add(row);
  const attachments: Attachment[] = [];
  for (let row = 0; row < lines.length; row++) {
    const line = lines[row]!;
    if (!['blank', 'note', 'synopsis'].includes(line.kind)) continue;
    const ownerId = owners[row] ?? null;
    const next = line.kind === 'synopsis' ? null : nextBoundary[row];
    const candidates = [
      ...new Set([ownerId, next].filter((id): id is string => Boolean(id))),
    ];
    attachments.push(
      Object.freeze({
        kind: line.kind as Attachment['kind'],
        from: row,
        to: row + 1,
        ownerId,
        candidates: Object.freeze(candidates),
        ambiguous:
          !ownerId ||
          Boolean(next && next !== ownerId) ||
          (line.kind === 'note' && ambiguousNotes.has(row)),
      }),
    );
  }
  const intact: IntactRange[] = [];
  for (const field of document.titleFields)
    intact.push(
      Object.freeze({
        id: field.id,
        kind: 'title',
        from: field.from,
        to: field.from + field.count,
        sourceStart: field.sourceStart,
        sourceEnd: field.sourceEnd,
        ambiguous: false,
        members: Object.freeze(field.values.map((value) => value.lineId)),
      }),
    );
  for (const region of document.hiddenRegions)
    intact.push(
      Object.freeze({
        id: region.id,
        kind: region.kind,
        from: region.from,
        to: region.from + region.count,
        sourceStart: region.sourceStart,
        sourceEnd: region.sourceEnd,
        ambiguous: !region.closed || region.ambiguous,
        members: Object.freeze(
          lines
            .slice(region.from, region.from + region.count)
            .map((line) => line.id),
        ),
      }),
    );
  for (const [row, line] of lines.entries())
    if (line.kind === 'raw')
      intact.push(
        Object.freeze({
          id: line.id,
          kind: 'raw',
          from: row,
          to: row + 1,
          sourceStart: line.sourceStart,
          sourceEnd: line.sourceEnd,
          ambiguous: true,
          members: Object.freeze([line.id]),
        }),
      );
  const groups = new Map(
    document.dialogueGroups.map((group) => [group.id, group]),
  );
  const seen = new Set<string>();
  for (const group of document.dialogueGroups) {
    if (!group.dualWith || seen.has(group.id)) continue;
    const partner = groups.get(group.dualWith);
    if (!partner) continue;
    seen.add(group.id);
    seen.add(partner.id);
    const from = Math.min(group.from, partner.from);
    const to = Math.max(group.from + group.count, partner.from + partner.count);
    intact.push(
      Object.freeze({
        id: `dual:${partner.id}:${group.id}`,
        kind: 'dual',
        from,
        to,
        sourceStart: lines[from]!.sourceStart,
        sourceEnd: lines[to - 1]!.sourceEnd,
        ambiguous:
          !group.complete ||
          !partner.complete ||
          owners[from] !== owners[to - 1],
        members: Object.freeze([partner.id, group.id]),
      }),
    );
  }
  const result = Object.freeze({
    items: Object.freeze(
      items.map((item) =>
        Object.freeze({
          ...item,
          children: Object.freeze(item.children),
          synopses: Object.freeze(item.synopses),
        }),
      ),
    ),
    roots: Object.freeze(roots),
    texts: Object.freeze(logicalTexts(document)),
    attachments: Object.freeze(attachments),
    intact: Object.freeze(intact),
    lineCount: lines.length,
    byteLength: bytes,
  });
  indexedDocuments.set(result, document);
  return result;
}
