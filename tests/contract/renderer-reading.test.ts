import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parseFountain } from '../../src/domain/fountainCodec';
import { assessmentReading } from '../../src/domain/exportAssessment';

// AUDIT-D04-R3. The shared corpus states the pinned renderer's own paragraph
// classes for these cases, and tools/pdf-helper/test_helper.py checks them
// against the real parser. The mirror the assessment uses must give the same.
const read = (source: string) =>
  assessmentReading(parseFountain(new TextEncoder().encode(source)));
type Stated =
  | ['Slug', string, string?]
  | ['Action' | 'Centered', string[]]
  | ['Dialog', string, [boolean, string][]]
  | ['DualDialog', [string, [boolean, string][]], [string, [boolean, string][]]]
  | ['Transition', string]
  | ['Section', string, number]
  | ['PageBreak'];
const oracle = JSON.parse(
  readFileSync('fixtures/assessment/oracle.json', 'utf8'),
) as {
  cases: {
    name: string;
    source: string;
    paragraphs?: Stated[];
    title?: string[];
  }[];
};
const flags = (blocks: [boolean, string][]) => blocks.map(([flag]) => flag);
const stated = oracle.cases.filter((entry) => entry.paragraphs);

it('AUDIT-D04-R3 the corpus states the renderer reading for every new case', () => {
  expect(stated.length).toBeGreaterThanOrEqual(34);
});

it.each(stated)(
  'AUDIT-D04-R3 mirror reads as the renderer: $name',
  ({ source, paragraphs, title }) => {
    const reading = read(source);
    expect(reading.title !== null).toBe((title ?? []).length > 0);
    const expected = paragraphs!.flatMap((entry): unknown[] => {
      switch (entry[0]) {
        case 'Slug':
          return [['heading', entry[2] ?? null]];
        case 'Action':
          return [['action', entry[1].length]];
        case 'Centered':
          return [['centered', entry[1].length]];
        case 'Dialog':
          return [['speech', flags(entry[2])]];
        case 'DualDialog':
          return [
            ['speech', flags(entry[1][1])],
            ['speech', flags(entry[2][1])],
          ];
        case 'Transition':
          return [['transition']];
        case 'Section':
          return [['section']];
        default:
          return [['pageBreak']];
      }
    });
    const mirrored = reading.paragraphs.flatMap((paragraph): unknown[] => {
      switch (paragraph.kind) {
        case 'heading':
          return [['heading', paragraph.sceneNumber ?? null]];
        case 'action':
        case 'centered':
          return [[paragraph.kind, paragraph.roles.length]];
        case 'speech':
          return [
            [
              'speech',
              paragraph.roles.slice(1).map((role) => role === 'parenthetical'),
            ],
          ];
        case 'sections':
          return paragraph.roles
            .filter((role) => role === 'section')
            .map(() => ['section']);
        // A synopsis the renderer attaches is not a paragraph of its own.
        case 'synopsis':
          return [];
        default:
          return [[paragraph.kind]];
      }
    });
    expect(mirrored).toEqual(expected);
  },
);

it('AUDIT-D04-R3 maps a removed multi-line span to one renderer line and keeps source rows', () => {
  // The boneyard on lines 1–2 leaves one empty line; the note on lines 5–6
  // leaves one empty line inside the speech paragraph.
  const reading = read(
    'A lamp.\n/* old\ndraft */\nMAYA\nHello.\n[[tone\ncheck]]\n(softly)\nBye.\n',
  );
  expect(
    reading.paragraphs.map(({ kind, rows, end, roles, texts }) => ({
      kind,
      rows,
      end,
      roles,
      texts,
    })),
  ).toEqual([
    {
      kind: 'action',
      rows: [0],
      end: 0,
      roles: ['action'],
      texts: ['A lamp.'],
    },
    {
      kind: 'speech',
      rows: [3, 4, 5, 7, 8],
      end: 8,
      roles: ['cue', 'dialogue', 'dialogue', 'parenthetical', 'dialogue'],
      texts: ['MAYA', 'Hello.', '', '(softly)', 'Bye.'],
    },
  ]);
});

it('AUDIT-D04-R3 reads the title block after boneyards are removed and tabs expanded', () => {
  // A boneyard-only line ends the block; the key line above it has a value.
  expect(read(' Title: Night\n/* b */\nMaya waits.\n').title).toEqual({
    length: 1,
    keys: new Set([0]),
  });
  // Without it the third line is neither a key nor a value: body text.
  expect(read(' Title: Night\nMaya waits.\n').title).toBeNull();
  // A boneyard that leaves two spaces is not an empty line: the block goes on.
  expect(read(' Title: Night\n  /* b */\nMaya waits.\n').title).toBeNull();
  // A tab-indented value under an empty key expands to four columns.
  expect(read('Title:\n\tNight Shift\n\nBody.\n').title).toEqual({
    length: 2,
    keys: new Set([0]),
  });
});
