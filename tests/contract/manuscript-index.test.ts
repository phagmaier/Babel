import { describe, expect, it } from 'vitest';
import {
  parseFountain,
  serializeFountain,
} from '../../src/domain/fountainCodec';
import {
  buildManuscriptIndex,
  logicalByteAt,
  MAX_INDEX_LINES,
} from '../../src/domain/manuscriptIndex';
const bytes = (text: string) => new TextEncoder().encode(text);
const index = (text: string) =>
  buildManuscriptIndex(parseFountain(bytes(text)));

describe('immutable manuscript index (pure source projection)', () => {
  it('closes scenes at sections and section subtrees at equal/decreasing depth', () => {
    const result = index(
      '# Act\n= Overview\n\n.INT. LAB - DAY #7#\n= First\n!Work.\n\n## Turn\n.INT. HALL - DAY #7#\n!Walk.\n# Finale\n.EXT. ROOF - NIGHT\n',
    );
    expect(
      result.items.map((item) => [
        item.kind,
        item.label,
        item.row,
        item.endRow,
        item.ordinal,
        item.sceneNumber,
      ]),
    ).toEqual([
      ['section', 'Act', 0, 10, null, null],
      ['scene', 'INT. LAB - DAY', 3, 7, 1, '7'],
      ['section', 'Turn', 7, 10, null, null],
      ['scene', 'INT. HALL - DAY', 8, 10, 2, '7'],
      ['section', 'Finale', 10, 12, null, null],
      ['scene', 'EXT. ROOF - NIGHT', 11, 12, 3, null],
    ]);
    const [act, first, turn, second, finale, last] = result.items;
    expect(act!.children).toEqual([first!.id, turn!.id]);
    expect(turn!.children).toEqual([second!.id]);
    expect(finale!.children).toEqual([last!.id]);
    expect(result.roots).toEqual([act!.id, finale!.id]);
    expect(act!.synopses).toEqual(['Overview']);
    expect(first!.synopses).toEqual(['First']);
    expect(Object.isFrozen(result.items[0]!.children)).toBe(true);
  });
  it('keeps literal ownership, marks leading/boundary blank and note ambiguity, and leaves synopsis with its preceding heading', () => {
    const result = index(
      '\n= Unowned\n.INT. ONE - DAY\n!A.\n[[note]]\n\n.INT. TWO - NIGHT\n= Two\n',
    );
    const [one, two] = result.items;
    expect(
      result.attachments.map((a) => [
        a.kind,
        a.from,
        a.ambiguous,
        a.ownerId,
        a.candidates,
      ]),
    ).toEqual([
      ['blank', 0, true, null, []],
      ['synopsis', 1, true, null, []],
      ['note', 4, true, one!.id, [one!.id, two!.id]],
      ['blank', 5, true, one!.id, [one!.id, two!.id]],
      ['synopsis', 7, false, two!.id, [two!.id]],
    ]);
    expect(result.intact.find((r) => r.kind === 'note')).toMatchObject({
      from: 4,
      to: 5,
      ambiguous: false,
    });
  });
  for (const [name, prefix, nl, ending] of [
    ['LF', '', '\n', '\n'],
    ['CRLF+BOM', '\uFEFF', '\r\n', '\r\n'],
    ['no final newline', '', '\n', ''],
  ] as const)
    it(`${name}: preserves source and maps rich Unicode and duplicate title keys exactly`, () => {
      const source = `${prefix}Title: Title${nl}${nl}!A **é🚀** \\* é.${ending}`;
      const document = parseFountain(bytes(source));
      const result = buildManuscriptIndex(document);
      const title = result.texts.find((t) => t.scope === 'title')!;
      expect(title.text).toBe('Title');
      expect(logicalByteAt(title, 0)).toBe(bytes(`${prefix}Title: `).length);
      const body = result.texts.find((t) => t.text.startsWith('A '))!;
      expect(body.text).toBe('A é🚀 * é.');
      expect(body.newline).toBe(ending);
      expect(logicalByteAt(body, 2)).toBe(
        bytes(`${prefix}Title: Title${nl}${nl}!A **`).length,
      );
      expect(logicalByteAt(body, 5)).toBe(
        bytes(`${prefix}Title: Title${nl}${nl}!A **é🚀**`).length,
      );
      expect(() => logicalByteAt(body, 4)).toThrow('Unicode');
      expect(Array.from(serializeFountain(document))).toEqual(
        Array.from(bytes(source)),
      );
      expect(result.byteLength).toBe(bytes(source).length);
    });
  it('indexes hidden author text and unknown surrounding raw text without losing wrappers or multiline regions', () => {
    const result = index(
      'Title: T\n\n!Before [[é🚀\ncontinued]] after\n/* omitted\n秘密 */\n!Tail *unfinished\n',
    );
    expect(
      result.texts
        .filter((t) => ['note', 'omitted', 'raw'].includes(t.scope))
        .map((t) => [t.scope, t.text]),
    ).toEqual([
      ['raw', '!Before '],
      ['note', 'é🚀'],
      ['note', 'continued'],
      ['raw', ' after'],
      ['omitted', ' omitted'],
      ['omitted', '秘密 '],
    ]);
    expect(
      result.intact
        .filter((r) => ['note', 'boneyard'].includes(r.kind))
        .map((r) => [r.kind, r.from, r.to]),
    ).toEqual([
      ['note', 2, 4],
      ['boneyard', 4, 6],
    ]);
    expect(result.texts.at(-1)!.text).toBe('Tail *unfinished');
    const note = result.texts.find((t) => t.scope === 'note')!;
    expect(logicalByteAt(note, 3)).toBe(
      bytes('Title: T\n\n!Before [[é🚀').length,
    );
  });
  it('represents paired dual dialogue intact and flags unclosed regions', () => {
    const result = index(
      '.INT. ROOM - DAY\n\n@A\nHello.\n\n@B ^\nGoodbye.\n\n[[unfinished',
    );
    expect(result.intact.find((r) => r.kind === 'dual')).toMatchObject({
      from: 2,
      to: 7,
      ambiguous: false,
    });
    expect(result.intact.find((r) => r.kind === 'note')).toMatchObject({
      from: 8,
      to: 9,
      ambiguous: true,
    });
    expect(result.attachments.find((a) => a.from === 8)!.ambiguous).toBe(true);
  });
  it('handles empty and no-scene drafts without inventing scenes', () => {
    expect(index('').items).toEqual([]);
    expect(index('!Draft text.\n').texts[0]!.text).toBe('Draft text.');
  });
  it('refuses whole oversized or deeply nested projections rather than returning a partial result', () => {
    const document = parseFountain(bytes('!A'));
    expect(() =>
      buildManuscriptIndex({
        ...document,
        lines: Array(MAX_INDEX_LINES + 1).fill(document.lines[0]),
      }),
    ).toThrow('line limit');
    expect(() =>
      index(
        Array.from({ length: 65 }, (_, i) => `${'#'.repeat(i + 1)} S`).join(
          '\n',
        ),
      ),
    ).toThrow('depth limit');
    expect(() =>
      buildManuscriptIndex(parseFountain(new Uint8Array([0xff]))),
    ).toThrow('encoding');
  });
});
