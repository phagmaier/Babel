import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  parseFountain,
  serializeFountain,
} from '../../src/domain/fountainCodec';
import {
  assessmentReading,
  evaluateExportAssessment,
  PUBLICATION_ASSESSMENT_IDENTITY as identity,
} from '../../src/domain/exportAssessment';

// These literal expectations are also read by the actual pinned helper and
// checked against PDF text. They are independent of the assessment mirror.
const oracle = JSON.parse(
  readFileSync('fixtures/assessment/marker-reading.json', 'utf8'),
) as {
  cases: { name: string; source: string; paragraphs: ['Action', string[]][] }[];
  controls: {
    name: string;
    source: string;
    paragraphs: ['Action', string[]][];
  }[];
};
const context = { identity, version: 1, sourceSha256: 'a'.repeat(64) };

it.each([...oracle.cases, ...oracle.controls])(
  'AUDIT-MARKER-READING ordered removals: $name',
  ({ source, paragraphs }) => {
    const document = parseFountain(new TextEncoder().encode(source));
    const reading = assessmentReading(document);
    expect(reading.title).toBeNull();
    expect(
      reading.paragraphs.map((row) => [row.kind, row.roles.length]),
    ).toEqual(paragraphs.map(([, rows]) => ['action', rows.length]));
  },
);

it.each(oracle.cases)(
  'AUDIT-MARKER-READING ambiguous source stays byte-identical and gated: $name',
  ({ source }) => {
    for (const text of [
      source,
      '\ufeff' + source.replace(/\r\n|\r|\n/g, '\r\n'),
    ]) {
      const bytes = new TextEncoder().encode(text);
      const document = parseFountain(bytes);
      const before = serializeFountain(document);
      const result = evaluateExportAssessment(document, context);
      expect(result.status).toBe('verified');
      if (result.status !== 'verified') throw new Error('unavailable');
      expect(
        result.issues.some(
          (issue) => issue.code === 'SC005' && issue.severity === 'blocking',
        ),
      ).toBe(true);
      for (const issue of result.issues) {
        expect(issue.hasFix).toBe(false);
        expect(issue.sourceStart).toBe(
          document.lines[issue.line!]!.sourceStart,
        );
        expect(issue.sourceEnd).toBe(document.lines[issue.endLine]!.contentEnd);
      }
      expect(Array.from(document.bytes)).toEqual(Array.from(bytes));
      expect(Array.from(serializeFountain(document))).toEqual(
        Array.from(before),
      );
      expect(Array.from(before)).toEqual(Array.from(bytes));
    }
  },
);
