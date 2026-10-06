import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  parseFountain,
  serializeFountain,
} from '../../src/domain/fountainCodec';
import {
  evaluateExportAssessment,
  PUBLICATION_ASSESSMENT_IDENTITY as identity,
} from '../../src/domain/exportAssessment';

const { warningCases } = JSON.parse(
  readFileSync('fixtures/assessment/marker-reading.json', 'utf8'),
) as {
  warningCases: {
    name: string;
    source: string;
    warnings: string[];
    missing: string;
    kind: string;
    line: number;
    endLine: number;
  }[];
};
const context = { identity, version: 1, sourceSha256: 'a'.repeat(64) };

it.each(warningCases)(
  'AUDIT-MARKER-WARNINGS original span is located, blocking and byte-preserving: $name',
  ({ source, warnings, missing, kind, line, endLine }) => {
    for (const text of [
      source,
      '\ufeff' + source.replace(/\r\n|\r|\n/g, '\r\n'),
    ]) {
      const bytes = new TextEncoder().encode(text);
      const document = parseFountain(bytes);
      const result = evaluateExportAssessment(document, context);
      if (result.status !== 'verified') throw new Error('unavailable');
      // The helper's raw-source warning needs its own visible review; a
      // different category or an unlocated blanket announcement cannot cover it.
      expect(result.announced).toEqual(expect.arrayContaining(warnings));
      const issue = result.issues.find((i) =>
        i.message.startsWith(`The profile reports ${kind} syntax across`),
      );
      expect(issue).toMatchObject({
        code: 'SC005',
        severity: 'blocking',
        line,
        endLine,
        hasFix: false,
        sourceStart: document.lines[line]!.sourceStart,
        sourceEnd: document.lines[endLine]!.contentEnd,
      });
      expect(issue!.message).toContain('Review what prints before export.');
      expect(result.omissions[missing as 'notes' | 'boneyards'].count).toBe(0);
      expect(Array.from(document.bytes)).toEqual(Array.from(bytes));
      expect(Array.from(serializeFountain(document))).toEqual(
        Array.from(bytes),
      );
    }
  },
);

it('AUDIT-MARKER-WARNINGS exhausting the issue limit cannot announce an unseen span', () => {
  const source = '{{raw}}\n'.repeat(1000) + warningCases[0]!.source;
  const result = evaluateExportAssessment(
    parseFountain(new TextEncoder().encode(source)),
    context,
  );
  if (result.status !== 'verified') throw new Error('unavailable');
  expect(result.truncated).toBe(true);
  expect(result.issues).toHaveLength(1000);
  expect(result.announced).not.toContain('boneyards');
});
