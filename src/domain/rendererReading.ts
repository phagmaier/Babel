import type { FountainLine } from './fountainModel';

/** AUDIT-D04-R3. How the pinned renderer (Screenplain's Fountain parser behind
 * the frozen profile) reads a source, mirrored rule for rule and in its order.
 * Assessment compares this with the codec's line kinds; nothing here decides
 * what the editor shows or what is saved. */
export type RendererRole =
  | 'heading'
  | 'action'
  | 'centered'
  | 'cue'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'section'
  | 'synopsis'
  | 'pageBreak';
export interface RendererParagraph {
  readonly kind:
    | 'heading'
    | 'action'
    | 'centered'
    | 'speech'
    | 'transition'
    | 'sections'
    | 'synopsis'
    | 'pageBreak';
  /** Source line of each renderer line. A hidden span the renderer removes
   * across lines leaves one line, counted at its first source line. */
  readonly rows: readonly number[];
  /** Last source line the paragraph covers. */
  readonly end: number;
  /** The lines as the renderer reads them: tabs expanded, hidden text gone. */
  readonly texts: readonly string[];
  readonly roles: readonly RendererRole[];
  /** Capitalised, as the renderer prints it in the margins. */
  readonly sceneNumber?: string;
}
export interface RendererReading {
  /** Source lines the renderer takes as the title page, and those it reads as
   * keys; null where it reads the opening lines as body text. */
  readonly title: {
    readonly length: number;
    readonly keys: ReadonlySet<number>;
  } | null;
  readonly paragraphs: readonly RendererParagraph[];
}

/** Python's `str.expandtabs(4)`: the pinned renderer expands every line's
 * tabs to four-column stops before it reads the line. */
export function expandTabs(text: string): string {
  let expanded = '';
  let column = 0;
  for (const char of text) {
    const width = char === '\t' ? 4 - (column % 4) : 1;
    expanded += char === '\t' ? ' '.repeat(width) : char;
    column += width;
  }
  return expanded;
}

/** Mirrors the pinned renderer's section rule: 1–6 `#` at the line start. */
export const rendererSection = /^(#{1,6})\s*([^#].*)$/;

interface Line {
  readonly text: string;
  readonly row: number;
  readonly last: number;
}
/** Removes every match the way the renderer does, on the joined text: a match
 * that crosses line ends merges those lines into one. */
function removeSpans(lines: readonly Line[], pattern: RegExp): Line[] {
  const source = lines.map((line) => line.text).join('\n');
  const result: Line[] = [];
  let index = 0;
  let first = 0;
  let text = '';
  const take = (chunk: string) => {
    for (const [part, piece] of chunk.split('\n').entries()) {
      if (part) {
        result.push({ text, row: lines[first]!.row, last: lines[index]!.last });
        first = ++index;
        text = '';
      }
      text += piece;
    }
  };
  let at = 0;
  for (const match of source.matchAll(pattern)) {
    take(source.slice(at, match.index));
    index += match[0].split('\n').length - 1;
    at = match.index + match[0].length;
  }
  take(source.slice(at));
  result.push({ text, row: lines[first]!.row, last: lines[index]!.last });
  return result;
}

/** Python's `str.isupper()`: a cased character, and none lower or title case. */
const isUpper = (text: string) =>
  /\p{Uppercase}/u.test(text) && !/[\p{Lowercase}\p{Lt}]/u.test(text);

/** Text of the first and last styled segment of a speech line. The renderer
 * tests those, not the raw line, for an opening and a closing bracket, so
 * paired emphasis markers around a bracket do not hide it. */
function emphasisEdges(source: string): [string, string] {
  const segments = source
    // The frozen profile protects literal escapes before emphasis is parsed.
    .replace(/\\[\\*_[\]]/g, '\uf8ff')
    .replace(/\*\*(?=\S)(.+?[*_]*)(?<=\S)\*\*/gs, '\ue702$1\ue703')
    .replace(/\*([^\s].*?)\*(?!\*)/gs, '\ue700$1\ue701')
    .replace(/_(?=\S)([^_]+)(?<=\S)_/g, '\ue704$1\ue705')
    .split(/[\ue700-\ue705]/)
    .filter(Boolean);
  return [segments[0] ?? '', segments.at(-1) ?? ''];
}

const slugPrefixes = [
  /^(INT|EXT|EST)[ .]/,
  /^(INT\.?\/EXT\.?)[ .]/,
  /^I\/E[ .]/,
];
type Read = Pick<RendererParagraph, 'kind' | 'roles' | 'sceneNumber'>;
/** One paragraph, tried in the renderer's order: forced action, page break,
 * synopsis, sections, scene heading, centered, speech, transition, action. */
function readParagraph(texts: readonly string[], attachable: boolean): Read {
  const first = texts[0]!;
  const all = (role: RendererRole) => texts.map(() => role);
  if (first.startsWith('!')) return { kind: 'action', roles: all('action') };
  if (texts.length === 1 && /^={3,}$/.test(first))
    return { kind: 'pageBreak', roles: ['pageBreak'] };
  if (texts.length === 1 && first.startsWith('=') && attachable)
    return { kind: 'synopsis', roles: ['synopsis'] };
  const sections: RendererRole[] = [];
  for (const text of texts) {
    if (rendererSection.test(text)) sections.push('section');
    else if (text.startsWith('=') && sections.length) sections.push('synopsis');
    else break;
  }
  if (sections.length === texts.length)
    return { kind: 'sections', roles: sections };
  // A heading is one line: a period and then text, or a known prefix followed
  // by a space or period once trailing whitespace is gone. It prints in
  // capitals, and a closing `#n#` is its scene number.
  const slug =
    texts.length === 1 ? /^(?:(\.)(?=[^.])\s*)?(\S.*?)\s*$/s.exec(first) : null;
  if (slug) {
    const text = slug[2]!.toUpperCase();
    if (slug[1] || slugPrefixes.some((prefix) => prefix.test(text)))
      return {
        kind: 'heading',
        roles: ['heading'],
        sceneNumber: /^(.*?)\s*#([\p{L}\p{N}_\-.]+)#\s*$/su.exec(text)?.[2],
      };
  }
  if (texts.every((text) => /^\s*>\s*(.*?)\s*<\s*$/s.test(text)))
    return { kind: 'centered', roles: all('centered') };
  if (
    texts.length >= 2 &&
    !first.endsWith('  ') &&
    ((first.startsWith('@') && first.length >= 2) ||
      isUpper(first.split('(')[0]!))
  ) {
    const roles: RendererRole[] = ['cue'];
    let inside = false;
    for (const line of texts.slice(1)) {
      const [head, tail] = emphasisEdges(line.trim());
      if (head.startsWith('(')) inside = true;
      roles.push(inside ? 'parenthetical' : 'dialogue');
      if (tail.endsWith(')')) inside = false;
    }
    return { kind: 'speech', roles };
  }
  if (texts.length === 1) {
    const transition = /^(>?)\s*(.+?)(TO:)?$/s.exec(first);
    if (
      transition &&
      (transition[1] || (transition[3] && isUpper(transition[2]!)))
    )
      return { kind: 'transition', roles: ['transition'] };
  }
  return { kind: 'action', roles: all('action') };
}

/** The renderer's title-page reading of the opening block (its lines up to
 * the first empty line): every line is `Key: value` or an indented value under
 * an empty key, a force marker cannot start it, and at least one value
 * results. Returns how many lines the block holds and which it reads as keys. */
function titleBlock(
  lines: readonly Line[],
): { count: number; keys: number[] } | null {
  const block: string[] = [];
  for (const line of lines) {
    if (line.text === '') break;
    block.push(line.text);
  }
  if (!block.length || /^[!@~.>#=]/.test(block[0]!)) return null;
  const keys: number[] = [];
  let values = 0;
  for (let at = 0; at < block.length;) {
    const field = /^([^:]+):\s*(.*)$/.exec(block[at]!);
    if (!field) return null;
    keys.push(at++);
    if (field[2]) values++;
    else
      while (at < block.length && /^\s{3,}./.test(block[at]!)) {
        values++;
        at++;
      }
  }
  return values ? { count: block.length, keys } : null;
}

const isBlank = (text: string) => text === '' || text === ' ';
export function rendererReading(
  source: readonly FountainLine[],
): RendererReading {
  if (!source.length) return { title: null, paragraphs: [] };
  // Boneyards go first, from the whole text, before lines are split: one on
  // its own line leaves an empty line, which ends a paragraph and the title
  // block. Tabs are expanded on what remains.
  let lines: Line[] = source.map((line, row) => ({
    text: line.sourceText,
    row,
    last: row,
  }));
  if (lines.some((line) => line.text.includes('/*')))
    lines = removeSpans(lines, /\/\*[\s\S]*?\*\//g);
  lines = lines.map((line) => ({ ...line, text: expandTabs(line.text) }));
  const block = titleBlock(lines);
  const paragraphs: RendererParagraph[] = [];
  // A synopsis attaches to the scene heading or section printed before it.
  let attachable = false;
  for (let from = block ? block.count + 1 : 0; from < lines.length;) {
    if (isBlank(lines[from]!.text)) {
      from++;
      continue;
    }
    let to = from + 1;
    while (to < lines.length && !isBlank(lines[to]!.text)) to++;
    // Notes are removed inside a paragraph, after paragraphs are formed.
    let rows = lines.slice(from, to);
    if (rows.some((line) => line.text.includes('[[')))
      rows = removeSpans(rows, /\[\[[\s\S]*?\]\]/g);
    from = to;
    const texts = rows.map((line) => line.text);
    if (isBlank(texts.join('\n'))) continue;
    const read = readParagraph(texts, attachable);
    if (read.kind !== 'synopsis')
      attachable = read.kind === 'heading' || read.kind === 'sections';
    paragraphs.push({
      ...read,
      rows: rows.map((line) => line.row),
      end: rows.at(-1)!.last,
      texts,
    });
  }
  return {
    title: block && {
      length: lines[block.count - 1]!.last + 1,
      keys: new Set(block.keys.map((at) => lines[at]!.row)),
    },
    paragraphs,
  };
}
