import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { undo, redo } from 'prosemirror-history';
import { TextSelection, type EditorState } from 'prosemirror-state';
import {
  createEditorState,
  applyEditorTransaction,
  sourceTitleTransaction,
} from '../../src/editor/state';
import { captureEditor } from '../../src/editor/sourceBridge';
import { screenplaySchema } from '../../src/editor/schema';
import { toggleEditorMark } from '../../src/editor/formatting';
import {
  FountainEditError,
  parseFountain,
  replaceKnownSourceContext,
  replaceLine,
  replaceLineWithBreaks,
  replaceTitleField,
  semanticView,
  serializeFountain,
  setDualDialogue,
} from '../../src/domain/fountainCodec';
import {
  parseInline,
  richView,
  sourceForInline,
} from '../../src/domain/fountainInline';
import type {
  FountainDocument,
  SourceLineEdit,
  StyledText,
} from '../../src/domain/fountainModel';
import {
  digest,
  fixtureBytes,
  loadCorpus,
} from '../../prototypes/fountain-conformance/corpus';

const encode = (text: string) => new Uint8Array(new TextEncoder().encode(text));
const parse = (text: string) => parseFountain(encode(text));

it('preserves a large unmatched-marker draft literally with a bounded capture cost', () => {
  const source = '*a '.repeat(8000);
  const started = performance.now();
  const inline = parseInline(source);
  expect(inline.complete).toBe(false);
  expect(inline.delimiters).toEqual([]);
  expect(inline.runs.map((run) => run.text).join('')).toBe(source);
  expect(performance.now() - started).toBeLessThan(1500);
  expect(serializeFountain(parse(source))).toEqual(encode(source));
});
const source = (document: FountainDocument) =>
  new TextDecoder('utf-8', { ignoreBOM: true }).decode(document.bytes);
const corpus = loadCorpus();
interface ComplexOracle {
  id: string;
  source: string;
  sourceSha256: string;
  edited: string;
  editedSha256: string;
  operation: {
    type: string;
    field?: number;
    key?: string;
    values?: string[];
    region?: number;
    content?: string[];
    left?: number;
    right?: number;
    line?: number;
    runs?: StyledText[];
    texts?: string[];
    from?: number;
    count?: number;
    edits?: SourceLineEdit[];
  };
  before: {
    title?: { key: string; values: string[] }[];
    hidden?: { kind: string; content: string; closed: boolean }[];
    groups?: { cue: number; speech: number[]; dual: number | null }[];
    runs?: StyledText[][];
    breaks?: { from: number; to: number; kind: string; newline: string }[];
  };
  after: ComplexOracle['before'];
  renderer: { shared: boolean; gaps: string[] };
}
const complex: { schema: number; cases: ComplexOracle[] } = JSON.parse(
  readFileSync('fixtures/expected/m3-complex.json', 'utf8'),
);
const failure = (operation: () => unknown, code: FountainEditError['code']) => {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(FountainEditError);
    expect((error as FountainEditError).code).toBe(code);
    return;
  }
  throw new Error(`Missing refusal ${code}`);
};
const project = (
  document: FountainDocument,
  oracle: ComplexOracle['before'],
) => {
  const index = (id: string) =>
    document.lines.findIndex((line) => line.id === id);
  return {
    ...(oracle.title
      ? {
          title: document.titleFields.map((field) => ({
            key: field.key,
            values: field.values.map((value) => value.text),
          })),
        }
      : {}),
    ...(oracle.hidden
      ? {
          hidden: document.hiddenRegions.map(({ kind, content, closed }) => ({
            kind,
            content,
            closed,
          })),
        }
      : {}),
    ...(oracle.groups
      ? {
          groups: document.dialogueGroups.map((group) => ({
            cue: group.cueLine,
            speech: group.lineIds.slice(1).map(index),
            dual: group.dualWith ? index(group.dualWith) : null,
          })),
        }
      : {}),
    ...(oracle.runs
      ? {
          runs: document.lines
            .filter((line) => line.inline)
            .map((line) => richView(line.inline!.runs)),
        }
      : {}),
    ...(oracle.breaks
      ? {
          breaks: document.sourceBreaks.map((br) => ({
            from: index(br.fromId),
            to: index(br.toId),
            kind: br.kind,
            newline: br.newline,
          })),
        }
      : {}),
  };
};
// Synthetic requests enter the same guarded state and deferred capture as typing.
function rowStart(state: EditorState, index: number) {
  return (
    1 +
    state.doc.content.content
      .slice(0, index)
      .reduce((size, row) => size + row.nodeSize, 0)
  );
}
function editRuns(
  document: FountainDocument,
  index: number,
  runs: readonly StyledText[],
) {
  const state = createEditorState(document.bytes, document.recovery);
  const row = state.doc.child(index);
  const from = rowStart(state, index);
  const content = runs
    .filter((run) => run.text)
    .map((run) =>
      screenplaySchema.text(
        run.text,
        run.styles.map((style) => screenplaySchema.marks[style]!.create()),
      ),
    );
  const applied = applyEditorTransaction(
    state,
    state.tr.replaceWith(from, from + row.content.size, content),
  );
  if (!applied.accepted)
    throw new FountainEditError(
      'protected-region',
      'Live editor refused the request',
    );
  return captureEditor(applied.state).document;
}
function editLiteralRow(
  document: FountainDocument,
  index: number,
  text: string,
) {
  return editRuns(document, index, [{ text, styles: [] }]);
}
const apply = (
  document: FountainDocument,
  entry: ComplexOracle,
): FountainDocument => {
  const op = entry.operation;
  switch (op.type) {
    case 'title':
      return replaceTitleField(
        document,
        document.titleFields[op.field!]!.id,
        op.key!,
        op.values!,
      );
    case 'hidden':
      return editLiteralRow(
        document,
        document.hiddenRegions[op.region!]!.from,
        '[[A better note.',
      );
    case 'dual':
      return setDualDialogue(
        document,
        document.dialogueGroups[op.right!]!.id,
        document.dialogueGroups[op.left!]!.id,
      );
    case 'inline':
      return editRuns(document, op.line!, op.runs!);
    case 'break':
      return replaceLineWithBreaks(document, op.line!, op.texts!);
    case 'conversion':
      // Retired recipe remains an independent parser sample, never a live conversion.
      failure(
        () =>
          replaceKnownSourceContext(document, op.from!, op.count!, op.edits!),
        'protected-region',
      );
      return parse(entry.edited);
    default:
      throw new Error('Unknown literal operation');
  }
};

describe('M3-03 independent source/complex-meaning expectations', () => {
  it.each(complex.cases)(
    '$id preserves exact original and matches independent bytes/meaning (raw conversion is parser-only)',
    (entry) => {
      expect(complex.schema).toBe(1);
      expect(digest(encode(entry.source))).toBe(entry.sourceSha256);
      expect(digest(encode(entry.edited))).toBe(entry.editedSha256);
      const before = parse(entry.source);
      expect(source(before)).toBe(entry.source);
      expect(project(before, entry.before)).toEqual(entry.before);
      const after = apply(before, entry);
      expect(source(after)).toBe(entry.edited);
      expect(project(after, entry.after)).toEqual(entry.after);
      expect(project(parseFountain(after.bytes), entry.after)).toEqual(
        entry.after,
      );
      expect(semanticView(parseFountain(after.bytes))).toEqual(
        semanticView(after),
      );
      expect(source(before)).toBe(entry.source);
      const physical = [
        ...entry.edited
          .replace(/^\ufeff/, '')
          .matchAll(/([^\r\n]*)(\r\n|\r|\n|$)/g),
      ].filter((match) => match[0]);
      expect(after.lines).toHaveLength(physical.length);
      let offset = after.bom ? 3 : 0;
      for (const [index, match] of physical.entries()) {
        expect(after.lines[index]!.sourceStart).toBe(offset);
        offset += encode(match[0]).length;
        expect(after.lines[index]!.sourceEnd).toBe(offset);
      }
      expect(offset).toBe(after.bytes.length);
    },
  );

  it.each(corpus.cases)(
    '$id original/edited M3-01 source remains unchanged by complex projection',
    (entry) => {
      for (const oracle of [entry, ...(entry.edit ? [entry.edit] : [])]) {
        const bytes = fixtureBytes(oracle);
        expect(serializeFountain(parseFountain(bytes))).toEqual(bytes);
      }
    },
  );

  it('M3-01 inline runs expose all independent emphasis/literal semantics before and after its original edit', () => {
    const entry = corpus.cases.find(
      (candidate) => candidate.id === 'emphasis',
    )!;
    for (const oracle of [entry, entry.edit!]) {
      const document = parseFountain(fixtureBytes(oracle));
      expect(
        document.lines
          .filter((line) => line.inline)
          .map((line) => richView(line.inline!.runs)),
      ).toEqual(oracle.renderer!.runs);
    }
  });

  it('M3-01 title values/unknown fields and explicit dual groups are ordered structures', () => {
    const title = parseFountain(
      fixtureBytes(corpus.cases.find((entry) => entry.id === 'title')!),
    );
    expect(
      title.titleFields.map((field) => ({
        key: field.key,
        values: field.values.map((value) => value.text),
        unknown: field.unknown,
      })),
    ).toEqual([
      {
        key: 'Title',
        values: ['', 'Quiet Tide', 'Second Line'],
        unknown: false,
      },
      { key: 'Authors', values: ['N. Example'], unknown: false },
      { key: 'Unmapped field', values: ['retain this value'], unknown: true },
      {
        key: 'Contact',
        values: ['', 'Box 9', 'Harbor Office'],
        unknown: false,
      },
    ]);
    const dual = parseFountain(
      fixtureBytes(corpus.cases.find((entry) => entry.id === 'dual')!),
    );
    expect(dual.dialogueGroups).toHaveLength(2);
    expect(dual.dialogueGroups[1]!.dualWith).toBe(dual.dialogueGroups[0]!.id);
    expect(dual.dialogueGroups.every((group) => group.complete)).toBe(true);
  });
});

describe('title/hidden ownership and delimiter boundaries', () => {
  it('preserves duplicate/unknown title fields, mixed endings and original continuation indentation across size changes', () => {
    const before = parse(
      'Title: Tide\r\nAuthor: One\nAuthor: Two\r\nPrivate Field:\n\tkeep\r\n\n!Body.',
    );
    const field = before.titleFields[3]!;
    const after = replaceTitleField(before, field.id, field.key, [
      '',
      'keep',
      'more',
    ]);
    expect(source(after)).toBe(
      'Title: Tide\r\nAuthor: One\nAuthor: Two\r\nPrivate Field:\n\tkeep\r\n    more\n\n!Body.',
    );
    expect(after.titleFields.map((item) => item.key)).toEqual([
      'Title',
      'Author',
      'Author',
      'Private Field',
    ]);
    expect(after.titleFields[3]!.id).toBe(field.id);
    expect(after.lines.at(-1)!.id).toBe(before.lines.at(-1)!.id);
    expect(after.titleFields[3]!.unknown).toBe(true);
    expect(parseFountain(after.bytes, after.recovery).titleFields).toEqual(
      after.titleFields,
    );
  });

  it('refuses partial title ownership and a continuation that would attach to an undeclared field', () => {
    const before = parse('Title:\n    Tide\nAuthor: One\n\n!Body.\n');
    failure(
      () =>
        replaceKnownSourceContext(before, 1, 1, [
          { source: '    Changed', kind: 'titleContinuation', text: 'Changed' },
        ]),
      'protected-region',
    );
    failure(
      () =>
        replaceKnownSourceContext(before, 2, 1, [
          {
            source: '    Changes previous title',
            kind: 'titleContinuation',
            text: 'Changes previous title',
          },
        ]),
      'neighbor-drift',
    );
    expect(source(before)).toBe('Title:\n    Tide\nAuthor: One\n\n!Body.\n');
  });

  it('allows explicit full-field context changes while preserving all undeclared title/body bytes', () => {
    const before = parse('Title:\n    Tide\nAuthor: One\n\n!Body.\n');
    const after = replaceKnownSourceContext(before, 0, 3, [
      { source: 'Title: Tide', kind: 'title', text: 'Tide', titleKey: 'Title' },
      {
        source: 'Private: One',
        kind: 'title',
        text: 'One',
        titleKey: 'Private',
      },
    ]);
    expect(source(after)).toBe('Title: Tide\nPrivate: One\n\n!Body.\n');
    expect(after.titleFields[1]!.unknown).toBe(true);
  });

  it('editing note/boneyard content preserves blank rows, untouched hidden regions and EOF convention', () => {
    const before = parse(
      '\ufeff\n/*\r\nEXT. OLD ROAD - NIGHT\r\n\r\nKeep.\r\n*/',
    );
    const region = before.hiddenRegions[0]!;
    const after = replaceKnownSourceContext(before, region.from, region.count, [
      { source: '/*', kind: 'boneyard', text: '/*' },
      {
        source: 'EXT. NEW ROAD - NIGHT',
        kind: 'boneyard',
        text: 'EXT. NEW ROAD - NIGHT',
      },
      { source: '', kind: 'boneyard', text: '' },
      { source: 'Keep.', kind: 'boneyard', text: 'Keep.' },
      { source: '*/', kind: 'boneyard', text: '*/' },
    ]);
    expect(source(after)).toBe(
      '\ufeff\n/*\r\nEXT. NEW ROAD - NIGHT\r\n\r\nKeep.\r\n*/',
    );
    expect(after.hiddenRegions[0]!.content).toBe(
      '\r\nEXT. NEW ROAD - NIGHT\r\n\r\nKeep.\r\n',
    );
    expect(after.hiddenRegions[0]!.id).toBe(region.id);
    const copy = after.bytes;
    for (const value of [
      after.hiddenRegions,
      after.hiddenRegions[0],
      after.titleFields,
      after.dialogueGroups,
      after.sourceBreaks,
    ])
      expect(Object.isFrozen(value)).toBe(true);
    copy.fill(0);
    expect(source(after)).toContain('EXT. NEW ROAD');
  });

  it('preserves mixed hidden/visible parser samples and refuses live edits of their raw rows', () => {
    const original = '\nVisible [[old\n  \ntail]] suffix [[keep]].\n\n!Body.\n';
    const before = parse(original);
    expect(before.hiddenRegions.map((region) => region.content)).toEqual([
      'old\n  \ntail',
      'keep',
    ]);
    const sample = '\nVisible [[new\n  \ntail]] suffix [[keep]].\n\n!Body.\n';
    expect(parse(sample).hiddenRegions.map((region) => region.content)).toEqual(
      ['new\n  \ntail', 'keep'],
    );
    expect(source(parse(sample))).toBe(sample);
    failure(
      () => editLiteralRow(before, 1, 'Visible [[new'),
      'protected-region',
    );
    failure(
      () =>
        replaceKnownSourceContext(before, 1, 3, [
          { source: '!discard note', kind: 'action', text: 'discard note' },
        ]),
      'protected-region',
    );
    expect(source(before)).toBe(original);
  });

  it('hidden byte spans include Unicode exactly, exclude delimiters from content and never expose omitted text as emphasis', () => {
    const before = parse('\ufeff\n[[Zoë 🚀 **note**]]\n\n/*\n漢字\n*/\n');
    for (const region of before.hiddenRegions) {
      const raw = new TextDecoder().decode(
        before.bytes.subarray(region.sourceStart, region.sourceEnd),
      );
      expect(raw).toBe(
        region.kind === 'note' ? '[[Zoë 🚀 **note**]]' : '/*\n漢字\n*/',
      );
      expect(
        new TextDecoder().decode(
          before.bytes.subarray(region.contentStart, region.contentEnd),
        ),
      ).toBe(region.content);
    }
    expect(before.lines[1]!.inline).toBeUndefined();
  });

  it('refuses nested/unclosed/double-blank hidden edits and delimiter injection, with an exact copy route', () => {
    for (const text of [
      '\n[[unclosed\ntail',
      '\n/*unclosed\n\ntail',
      '\n[[a [[nested]] tail]]\n',
      '\n[[a\n\nb]]\n',
    ]) {
      const document = parse(text);
      const region = document.hiddenRegions[0]!;
      expect(region.closed && !region.ambiguous).toBe(false);
      failure(
        () =>
          replaceKnownSourceContext(document, region.from, region.count, [
            { source: '[[change]]', kind: 'note', text: '[[change]]' },
          ]),
        'protected-region',
      );
      expect(source(document)).toBe(text);
    }
    const before = parse('\n[[a\n  \nb]]\n\n!Tail.\n');
    failure(
      () =>
        replaceKnownSourceContext(before, 1, 1, [
          { source: '[[changed]]', kind: 'note', text: '[[changed]]' },
        ]),
      'protected-region',
    );
    for (const [rows, code] of [
      [['[[unsafe ]] suffix]]'], 'round-trip'],
      [['[[a', '', 'b]]'], 'unrepresentable'],
    ] as const) {
      failure(
        () =>
          replaceKnownSourceContext(
            before,
            1,
            3,
            rows.map((text) => ({ source: text, text, kind: 'note' as const })),
          ),
        code,
      );
    }
  });

  it('refuses deleting a closer while undeclared tail text remains through known context', () => {
    const before = parse('\n/*\nold\n*/\n\n!Visible.\n');
    failure(
      () =>
        replaceKnownSourceContext(before, 1, 2, [
          { source: '/*', kind: 'boneyard', text: '/*' },
          { source: 'old', kind: 'boneyard', text: 'old' },
        ]),
      'protected-region',
    );
    failure(
      () =>
        replaceKnownSourceContext(before, 1, 3, [
          { source: '/*', kind: 'boneyard', text: '/*' },
          { source: 'new', kind: 'boneyard', text: 'new' },
        ]),
      'unrepresentable',
    );
    expect(source(before)).toBe('\n/*\nold\n*/\n\n!Visible.\n');
  });
});

describe('dialogue groups, incomplete input and protected source', () => {
  it('sets/removes a dual relationship, preserving speech/parentheticals/IDs and rejecting overlap', () => {
    const before = parse('\n@Mara\nFirst.\n\n@Ivo\nReply.\n\n@Zoë\nLast.\n');
    const pair = setDualDialogue(
      before,
      before.dialogueGroups[1]!.id,
      before.dialogueGroups[0]!.id,
    );
    expect(pair.dialogueGroups[1]!.dualWith).toBe(before.dialogueGroups[0]!.id);
    expect(pair.lines.map((line) => line.id)).toEqual(
      before.lines.map((line) => line.id),
    );
    failure(
      () =>
        setDualDialogue(
          pair,
          pair.dialogueGroups[2]!.id,
          pair.dialogueGroups[1]!.id,
        ),
      'unrepresentable',
    );
    const cleared = setDualDialogue(pair, pair.dialogueGroups[1]!.id, null);
    expect(source(cleared)).toBe(source(before));
    expect(
      cleared.dialogueGroups.every((group) => group.dualWith === undefined),
    ).toBe(true);
  });

  it('refuses nonadjacent/incomplete pairings and diagnoses imported chained groups without dropping content', () => {
    const text = '\n@Mara\nFirst.\n\n!Action.\n\n@Ivo\nReply.\n';
    const before = parse(text);
    failure(
      () =>
        setDualDialogue(
          before,
          before.dialogueGroups[1]!.id,
          before.dialogueGroups[0]!.id,
        ),
      'unrepresentable',
    );
    const partial = parse('\n@Mara\nFirst.\n\n@Ivo\n(waiting)\n');
    expect(partial.dialogueGroups[1]!.complete).toBe(false);
    failure(
      () =>
        setDualDialogue(
          partial,
          partial.dialogueGroups[1]!.id,
          partial.dialogueGroups[0]!.id,
        ),
      'unrepresentable',
    );
    const chained = parse(
      '\n@Mara\nFirst.\n\n@Ivo ^\nReply.\n\n@Zoë ^\nLast.\n',
    );
    expect(
      chained.diagnostics.some((item) => item.code === 'ambiguous-dual'),
    ).toBe(true);
    expect(source(chained)).toContain('@Zoë ^\nLast.\n');
  });

  it('raw edits stay refused after unrelated live edits and owned copy mutation', () => {
    const before = parse('\n{{raw}}\n\n!Body.\n');
    const edits: SourceLineEdit[] = [
      { source: '!Converted.', kind: 'action', text: 'Converted.' },
    ];
    failure(
      () => replaceKnownSourceContext(before, 1, 1, edits),
      'protected-region',
    );
    failure(() => editLiteralRow(before, 1, 'Converted.'), 'protected-region');
    before.bytes.fill(0);
    const newer = editLiteralRow(before, 3, 'Newer body.');
    failure(
      () => replaceKnownSourceContext(newer, 1, 1, edits),
      'protected-region',
    );
    expect(source(before)).toBe('\n{{raw}}\n\n!Body.\n');
    expect(source(newer)).toBe('\n{{raw}}\n\n!Newer body.\n');
  });

  it('complete ownership cannot convert unclosed regions or imported malformed parentheticals', () => {
    for (const [original, from, count, edits] of [
      [
        '\n[[unfinished\ntail',
        1,
        2,
        [
          { source: '[[reviewed', kind: 'note', text: '[[reviewed' },
          { source: 'tail]]', kind: 'note', text: 'tail]]' },
        ],
      ],
      [
        '\n@Zoë\n(unfinished\n',
        2,
        1,
        [{ source: '(waiting)', kind: 'parenthetical', text: '(waiting)' }],
      ],
      [
        '\n{{raw}}\n',
        1,
        1,
        [{ source: '{{still raw}}', kind: 'raw', text: '{{still raw}}' }],
      ],
    ] as const) {
      const before = parse(original);
      failure(
        () => replaceKnownSourceContext(before, from, count, edits),
        'protected-region',
      );
      expect(source(before)).toBe(original);
    }
  });
});

describe('inline formatting/literals and intentional physical breaks', () => {
  it('models nested distinct emphasis and every run/delimiter span while keeping unmatched text literal', () => {
    const markup =
      'A _low *gentle* **bright** bell_ and ***quiet*** \\*star\\*.';
    const parsed = parseInline(markup);
    expect(parsed.complete).toBe(true);
    expect(parsed.text).toBe('A low gentle bright bell and quiet *star*.');
    expect(richView(parsed.runs)).toEqual([
      { text: 'A ', styles: [] },
      { text: 'low ', styles: ['underline'] },
      { text: 'gentle', styles: ['italic', 'underline'] },
      { text: ' ', styles: ['underline'] },
      { text: 'bright', styles: ['bold', 'underline'] },
      { text: ' bell', styles: ['underline'] },
      { text: ' and ', styles: [] },
      { text: 'quiet', styles: ['bold', 'italic'] },
      { text: ' *star*.', styles: [] },
    ]);
    for (const delimiter of parsed.delimiters) {
      expect(markup.slice(delimiter.start, delimiter.end)).toBe(
        delimiter.marker,
      );
      expect(markup.slice(delimiter.closingStart, delimiter.closingEnd)).toBe(
        delimiter.marker,
      );
    }
    for (const literal of [
      'unfinished *text',
      'He dialed *69 and *23.',
      '****uncertain****',
      'cross *a _b* c_',
    ]) {
      const incomplete = parseInline(literal);
      expect(incomplete.complete).toBe(false);
      expect(source(parse(`\n!${literal}\n`))).toBe(`\n!${literal}\n`);
    }
  });

  it('edits nested formatting while preserving neighboring syntax and literal stars/underscores/backslashes', () => {
    const before = parse('\ufeff\n!A bell.\r\n\r\n!Tail.');
    const runs: StyledText[] = [
      { text: 'A ', styles: [] },
      { text: 'low ', styles: ['underline'] },
      { text: 'gentle', styles: ['italic', 'underline'] },
      { text: ' bell', styles: ['underline'] },
      { text: ' *literal* _plain_ \\ end.', styles: [] },
    ];
    const after = editRuns(before, 1, runs);
    expect(source(after)).toBe(
      '\ufeff\n!A _low *gentle* bell_ \\*literal\\* \\_plain\\_ \\ end.\r\n\r\n!Tail.',
    );
    expect(richView(after.lines[1]!.inline!.runs)).toEqual(richView(runs));
    expect(editRuns(after, 1, runs).bytes).toEqual(after.bytes);
    expect(source(before)).toBe('\ufeff\n!A bell.\r\n\r\n!Tail.');
  });

  it('title inline editing owns its complete field, preserves unknown values and freezes nested structures', () => {
    const before = parse(
      'Title:\n    Quiet Tide\n    Part Two\nPrivate: Keep\n\n!Body.\n',
    );
    const state = createEditorState(before.bytes, before.recovery);
    const field = before.titleFields[0]!;
    const transaction = sourceTitleTransaction(state, {
      kind: 'edit',
      id: field.id,
      key: field.key,
      values: [
        '',
        sourceForInline([{ text: 'Quiet Light', styles: ['bold'] }]),
        'Part Two',
      ],
    });
    expect(transaction).not.toBeNull();
    const applied = applyEditorTransaction(state, transaction!);
    expect(applied.accepted).toBe(true);
    const after = captureEditor(applied.state).document;
    expect(source(after)).toBe(
      'Title:\n    **Quiet Light**\n    Part Two\nPrivate: Keep\n\n!Body.\n',
    );
    expect(after.titleFields[1]!.unknown).toBe(true);
    for (const item of [
      after.titleFields[0],
      after.titleFields[0]!.values,
      after.titleFields[0]!.values[1],
      after.lines[1]!.inline,
      after.lines[1]!.inline!.runs,
      after.lines[1]!.inline!.runs[0]!.styles,
    ])
      expect(Object.isFrozen(item)).toBe(true);
  });

  it('explicit formatting refuses styled whitespace; guarded edits refuse newlines/raw and capture refuses grammar drift', () => {
    let state = createEditorState(encode('\n! leading \n'));
    const start = rowStart(state, 1);
    state = applyEditorTransaction(
      state,
      state.tr.setSelection(
        TextSelection.create(
          state.doc,
          start,
          start + state.doc.child(1).content.size,
        ),
      ),
    ).state;
    expect(toggleEditorMark(state, 'bold').transaction).toBeUndefined();
    expect(source(captureEditor(state).document)).toBe('\n! leading \n');
    const before = parse('\n!Body.\n');
    failure(
      () => editRuns(before, 1, [{ text: 'two\nlines', styles: [] }]),
      'protected-region',
    );
    const dialogue = parse('\n@Zoë\nSignal.\n');
    failure(
      () => editRuns(dialogue, 2, [{ text: '@Someone', styles: [] }]),
      'round-trip',
    );
    failure(
      () =>
        editRuns(parse('\n{{raw}}\n'), 1, [
          { text: 'changed', styles: ['italic'] },
        ]),
      'protected-region',
    );
    expect(source(before)).toBe('\n!Body.\n');
    expect(source(dialogue)).toBe('\n@Zoë\nSignal.\n');
  });

  it('preserves authored blank dialogue/action on breaks and refuses cross-line emphasis/parenthetical breaks', () => {
    const before = parse('\n@Zoë\nFirst last.');
    const after = replaceLineWithBreaks(before, 2, ['First.', '', 'Last.']);
    expect(source(after)).toBe('\n@Zoë\nFirst.\n  \nLast.');
    expect(after.sourceBreaks.map((br) => br.kind)).toEqual([
      'dialogue',
      'dialogue',
    ]);
    failure(
      () => replaceLineWithBreaks(before, 2, ['*First', 'last*']),
      'unrepresentable',
    );
    failure(
      () =>
        replaceLineWithBreaks(parse('\n@Zoë\n(waiting)\n'), 2, [
          '(wait',
          'ing)',
        ]),
      'unrepresentable',
    );
    expect(
      source(replaceLineWithBreaks(parse('\n!Body.'), 1, ['Body.', ''])),
    ).toBe('\n!Body.\n!');
    expect(source(before)).toBe('\n@Zoë\nFirst last.');
  });

  it('invalid UTF-8 retains an emergency copy for every complex path', () => {
    const input = new Uint8Array([0xff, 0x0a]);
    const document = parseFountain(input);
    failure(
      () =>
        replaceKnownSourceContext(document, 0, 0, [
          { source: '!Body.', kind: 'action', text: 'Body.' },
        ]),
      'read-only',
    );
    expect(serializeFountain(document)).toEqual(input);
  });

  it('512 deterministic malformed delimiter/encoding mutations never crash or drop source bytes/spans', () => {
    let random = 0x4d3303;
    for (let count = 0; count < 512; count++) {
      const input = encode(complex.cases[count % complex.cases.length]!.source);
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      input[random % input.length] = random >>> 24;
      const parsed = parseFountain(input);
      expect(serializeFountain(parsed)).toEqual(input);
      if (!parsed.readOnlyReason)
        for (const region of parsed.hiddenRegions) {
          expect(region.sourceStart).toBeGreaterThanOrEqual(parsed.bom ? 3 : 0);
          expect(region.sourceEnd).toBeLessThanOrEqual(input.length);
          expect(
            new TextDecoder('utf8', { fatal: true }).decode(
              input.subarray(region.contentStart, region.contentEnd),
            ),
          ).toBe(region.content);
        }
    }
  });

  it('escaped hidden closers do not end a region or turn visible literal delimiters into hidden content', () => {
    const before = parse('\n[[first \\]] literal\nend]]\n\n!Tail.\n');
    expect(before.hiddenRegions[0]!.content).toBe('first \\]] literal\nend');
    expect(before.lines[2]!.kind).toBe('note');
    const literal = editRuns(parse('\n!Body.\n'), 1, [
      { text: '/*literal*/ [[note]] _literal_ *star*', styles: [] },
    ]);
    expect(literal.hiddenRegions).toEqual([]);
    expect(literal.lines[1]!.inline!.text).toBe(
      '/*literal*/ [[note]] _literal_ *star*',
    );
  });

  it('overlapping escaped delimiters agree between physical classification and region spans', () => {
    const unfinished =
      String.raw`\[[[unfinished` + '\nKeep the protected tail.\n';
    const original = parse(unfinished);
    expect(original.hiddenRegions[0]).toMatchObject({
      sourceStart: 2,
      closed: false,
      count: 2,
    });
    expect(original.lines.every((line) => !line.editable)).toBe(true);
    failure(
      () => replaceLine(original, 1, { kind: 'action', text: 'Changed.' }),
      'protected-region',
    );
    expect(source(original)).toBe(unfinished);

    const complete = parse(String.raw`\[[[hidden \]]]` + '\n');
    expect(complete.hiddenRegions[0]).toMatchObject({
      sourceStart: 2,
      closed: true,
      content: String.raw`hidden \]`,
    });
    failure(
      () => editLiteralRow(complete, 0, String.raw`\[[[Changed.]]`),
      'protected-region',
    );
    expect(source(parse(String.raw`\[[[Changed.]]` + '\n'))).toBe(
      String.raw`\[[[Changed.]]` + '\n',
    );
    expect(source(complete)).toBe(String.raw`\[[[hidden \]]]` + '\n');
  });

  it('concrete draft completion clears recovery-only intent and restores complete group semantics', () => {
    const before = parse('\n@Zoë\n(waiting)\nSignal.\n');
    const draft = replaceLine(before, 2, { kind: 'parenthetical', text: '(' });
    const complete = replaceKnownSourceContext(draft, 2, 1, [
      { source: '(waiting)', kind: 'parenthetical', text: '(waiting)' },
    ]);
    expect(complete.lines[2]!.intendedKind).toBeUndefined();
    expect(complete.dialogueGroups[0]!.complete).toBe(true);
    expect(parseFountain(complete.bytes, complete.recovery).lines).toEqual(
      complete.lines,
    );
  });

  it('an explicit dual target still refuses a transaction that owns only the right cue', () => {
    const before = parse('\n@Mara\nFirst.\n\n@Ivo\nReply.\n');
    failure(
      () =>
        replaceLine(before, 4, {
          kind: 'character',
          text: 'Ivo',
          dualWith: before.lines[1]!.id,
        }),
      'unrepresentable',
    );
    expect(source(before)).toBe('\n@Mara\nFirst.\n\n@Ivo\nReply.\n');
  });

  it('128 independent Unicode/literal rich requests round-trip or produce a typed refusal with original bytes intact', () => {
    const before = parse('\n!Body.\n\n!Tail.');
    const values = [
      'Café',
      '漢字',
      '🚀',
      '*literal*',
      '_literal_',
      '\\route',
      '[[literal note]]',
      '/*literal omit*/',
    ];
    const styleSets: StyledText['styles'][] = [
      [],
      ['bold'],
      ['italic'],
      ['underline'],
      ['bold', 'italic'],
      ['bold', 'underline'],
      ['italic', 'underline'],
      ['bold', 'italic', 'underline'],
    ];
    let successful = 0;
    const refusals = new Set<string>();
    for (let count = 0; count < 128; count++) {
      const runs: StyledText[] = [
        { text: 'A ', styles: [] },
        {
          text: values[count % values.length]!,
          styles: styleSets[(count * 3) % styleSets.length]!,
        },
        { text: ' bell.', styles: [] },
      ];
      try {
        const result = editRuns(before, 1, runs);
        successful++;
        expect(richView(result.lines[1]!.inline!.runs)).toEqual(richView(runs));
        expect(richView(parseInline(sourceForInline(runs)).runs)).toEqual(
          richView(runs),
        );
        expect(result.bytes.subarray(result.lines[1]!.sourceEnd)).toEqual(
          before.bytes.subarray(before.lines[1]!.sourceEnd),
        );
      } catch (error) {
        expect(error).toBeInstanceOf(FountainEditError);
        refusals.add(`${count % 8}:${(error as FountainEditError).code}`);
      }
      expect(source(before)).toBe('\n!Body.\n\n!Tail.');
    }
    expect(successful).toBe(112);
    // The styled boneyard literal retains the production grammar refusal, not a generic catch-all.
    expect([...refusals]).toEqual(['7:round-trip']);
  });
});

it('AUDIT-C356 emits ordinary brackets and paths literally while protecting note pairs', () => {
  const before = parse('\ufeff\n!Before.\r\n\r\n!Tail.');
  for (const [text, spelling] of [
    [
      'He reads [the sign] aloud. to_do a\\b',
      'He reads [the sign] aloud. to\\_do a\\b',
    ],
    ['[[note]]', '\\[\\[note\\]\\]'],
    ['a\\_b', 'a\\\\\\_b'],
    ['a\\[b]', 'a\\\\[b]'],
  ]) {
    const after = editRuns(before, 1, [{ text: text!, styles: [] }]);
    expect(source(after)).toBe(`\ufeff\n!${spelling}\r\n\r\n!Tail.`);
    expect(after.lines[1]!.inline!.text).toBe(text);
    expect(source(before)).toBe('\ufeff\n!Before.\r\n\r\n!Tail.');
  }
});

it('live inline and standalone-note changes preserve exact original bytes through Undo/Redo', () => {
  for (const [original, row, text, edited] of [
    [
      '\ufeff\n!Before.\r\n\r\n!Tail.',
      1,
      '[the sign] a\\b',
      '\ufeff\n![the sign] a\\b\r\n\r\n!Tail.',
    ],
    [
      '\n[[A note.\r\n  \r\nKeep the tail.]]\r\n\r\n{{raw}}',
      1,
      '[[A better note.',
      '\n[[A better note.\r\n  \r\nKeep the tail.]]\r\n\r\n{{raw}}',
    ],
  ] as const) {
    const state = createEditorState(encode(original));
    const from = rowStart(state, row);
    const changed = applyEditorTransaction(
      state,
      state.tr.insertText(text, from, from + state.doc.child(row).content.size),
    );
    expect(changed.accepted).toBe(true);
    let current = changed.state;
    expect(source(captureEditor(current).document)).toBe(edited);
    expect(
      undo(current, (transaction) => {
        current = applyEditorTransaction(current, transaction).state;
      }),
    ).toBe(true);
    expect(source(captureEditor(current).document)).toBe(original);
    expect(
      redo(current, (transaction) => {
        current = applyEditorTransaction(current, transaction).state;
      }),
    ).toBe(true);
    expect(source(captureEditor(current).document)).toBe(edited);
  }
});
