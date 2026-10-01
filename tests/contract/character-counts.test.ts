import { expect, it } from 'vitest';
import {
  parseFountain,
  serializeFountain,
} from '../../src/domain/fountainCodec';
import { buildManuscriptIndex } from '../../src/domain/manuscriptIndex';
import { buildCharacterCounts } from '../../src/domain/characterCounts';
const bytes = (text: string) => new TextEncoder().encode(text);
function facts(text: string) {
  const doc = parseFountain(bytes(text));
  return { doc, facts: buildCharacterCounts(doc, buildManuscriptIndex(doc)) };
}
it('counts independent literal inclusion/Unicode oracles and leaves BOM/CRLF/style/source bytes exact', () => {
  const source =
    '\ufeffTitle: My Story\r\n\r\n# Act One\r\n= Outline here\r\n\r\n.INT. LAB - DAY #42#\r\n!Hello **bright** café. 🚀\r\n\r\n@Zøë (V.O.)\r\n(two words)\r\nI can’t wait.\r\n\r\n[[private note]]\r\n\r\n/*omitted words*/\r\n\r\n===\r\n';
  const f = facts(source);
  // 3 heading + 3 action + 2 cue (V.O. is one word) + 2 parenthetical + 3 dialogue (can’t is one word).
  expect(f.facts.words).toEqual({
    body: 13,
    title: 2,
    note: 2,
    omitted: 2,
    raw: 0,
    outline: 4,
  });
  expect(f.facts.scenes).toBe(1);
  expect(
    f.facts.characters.map((c) => ({
      name: c.name,
      cues: c.cues,
      speechRows: c.speechRows,
    })),
  ).toEqual([{ name: 'Zøë', cues: [8], speechRows: [9, 10] }]);
  expect(Array.from(serializeFountain(f.doc))).toEqual(
    Array.from(bytes(source)),
  );
});
it('keeps exact case/normalization distinct, separates multiple extensions, excludes uppercase action/hidden cues and follows dual speech ownership', () => {
  const source =
    '@Zøë (V.O.) (CONT’D)\nFirst.\n\n@Zøë\nSecond.\n\n@zøë\nThird.\n\n@ÉVA\nFourth.\n\n@ÉVA ^\nFifth.\n\n!LOUD ACTION\n\n/*\n@HIDDEN\nOmitted.\n*/\n';
  const f = facts(source);
  expect(f.facts.characters.map((c) => [c.name, c.cues, c.speechRows])).toEqual(
    [
      ['Zøë', [0, 3], [1, 4]],
      ['zøë', [6], [7]],
      ['ÉVA', [9], [10]],
      ['ÉVA', [12], [13]],
    ],
  );
  expect(Object.isFrozen(f.facts.characters[0]?.speechRows)).toBe(true);
});
it('reports empty drafts honestly and refuses a foreign index instead of partial counts', () => {
  const empty = facts('');
  expect(empty.facts.scenes).toBe(0);
  expect(empty.facts.characters).toEqual([]);
  expect(empty.facts.words.body).toBe(0);
  expect(() =>
    buildCharacterCounts(
      parseFountain(bytes('!other\n')),
      buildManuscriptIndex(empty.doc),
    ),
  ).toThrow('Foreign index');
});
it('counts uncertain raw literal words separately from manuscript words', () => {
  const f = facts('!Visible words [[secret note]] tail\n');
  expect(f.facts.words).toEqual({
    body: 0,
    title: 0,
    note: 2,
    omitted: 0,
    raw: 3,
    outline: 0,
  });
});
