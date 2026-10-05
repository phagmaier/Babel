export const tokens = [
  'INT. ROOF - DAY',
  'EXT. PARK #12#',
  'INT ',
  'CUT TO:',
  'TO:',
  '.hello',
  '!Alpha.',
  'MAYA',
  '@maya',
  '@',
  '(beat)',
  '(beat',
  'Bye.',
  '# Act',
  '= Sum',
  '===',
  '>CUT TO:',
  '>center<',
  '~Song',
  '/* bone */',
  '[[note]]',
  'Title: Film',
  'Title:',
  'Contact: Sam',
  '    Tel: 555',
  'FADE IN:',
  'MAYA ^',
  'A sentence.',
  '**(beat)**',
  'x #1#',

  'A [[n]] b.',
  'A /* b */ c.',
  '\\[[x]] y',
  '\\/* x */ y',
  '[[open',
  'close]]',
  '/* open',
  'close */',
  'Archive: X',
  'Notes: n',
  'Author: Me',
  'Draft date: 1',
  '=',
  '= ',
  '#',
  '## Two',
  '=== ',
  ' ===',
  '{{raw}}',
  '   indented text',
  'Sub: late',
  '[[a]] [[b]]',
  '/**/',
  '[[]]',
  'MAYA [[aside]]',
  '= [[n]]',
  '# /* x */',
  'Title: /* t */ Film',
  'Key: [[v]]',
  'text ]] and [[ more',
] as const;

export const prefixes = ['', ' ', '\t', '    '] as const;
export const suffixes = ['', ' ', '  ', '\t'] as const;
export const gaps = [
  '\n',
  '\n\n',
  '\n \n',
  '\n  \n',
  '\n\t\n',
  '\r\n',
  '\r\n\r\n',
] as const;
export const mixedSeed = 0x5eed04;
export const mixedSize = 70000;

export function mixedCorpus() {
  // Mulberry32 mixes all output bits before range selection. This separate
  // seed and vocabulary do not alter the frozen LCG in renderer.test.ts.
  let seed = mixedSeed;
  const pick = (size: number) => {
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return Math.floor((((value ^ (value >>> 14)) >>> 0) / 2 ** 32) * size);
  };
  const inputs: string[] = [];
  const coverage = {
    tokens: Array<number>(tokens.length).fill(0),
    prefixes: Array<number>(prefixes.length).fill(0),
    suffixes: Array<number>(suffixes.length).fill(0),
    gaps: Array<number>(gaps.length).fill(0),
    rowCounts: Array<number>(7).fill(0),
    tokenPairs: new Set<string>(),
    positions: tokens.map(() => Array<number>(7).fill(0)),
    openings: tokens.map(() => Array<number>(prefixes.length).fill(0)),
  };
  for (let i = 0; i < mixedSize; i++) {
    let source = '';
    const count = 1 + pick(7);
    coverage.rowCounts[count - 1]!++;
    let previous: number | undefined;
    for (let row = 0; row < count; row++) {
      if (row) {
        const gap = pick(gaps.length);
        source += gaps[gap];
        coverage.gaps[gap]!++;
      }
      const prefix = pick(prefixes.length);
      const token = pick(tokens.length);
      const suffix = pick(suffixes.length);
      source += prefixes[prefix]! + tokens[token]! + suffixes[suffix]!;
      coverage.tokens[token]!++;
      coverage.prefixes[prefix]!++;
      coverage.suffixes[suffix]!++;
      coverage.positions[token]![row]!++;
      if (!row) coverage.openings[token]![prefix]!++;
      if (previous !== undefined)
        coverage.tokenPairs.add(`${previous}:${token}`);
      previous = token;
    }
    inputs.push(source + '\n');
  }
  return { inputs, coverage };
}
