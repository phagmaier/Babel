import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import * as baselineCodec from '@baseline/domain/fountainCodec';
import { rendererReading as baselineReading } from '@baseline/domain/rendererReading';
import * as baseAssessment from '@baseline/domain/exportAssessment';
import * as assessment from '../../src/domain/exportAssessment';
import { parseFountain } from '../../src/domain/fountainCodec';
import type { FountainDocument } from '../../src/domain/fountainModel';
import {
  rendererReading,
  type RendererReading,
} from '../../src/domain/rendererReading';

function facts(reading: RendererReading) {
  return {
    title: reading.title !== null,
    paragraphs: reading.paragraphs.flatMap((p): unknown[] => {
      if (p.kind === 'heading') return [['heading', p.sceneNumber ?? null]];
      if (p.kind === 'action' || p.kind === 'centered')
        return [[p.kind, p.roles.length]];
      if (p.kind === 'speech')
        return [['speech', p.roles.slice(1).map((r) => r === 'parenthetical')]];
      if (p.kind === 'sections')
        return p.roles.filter((r) => r === 'section').map(() => ['section']);
      if (p.kind === 'synopsis') return [];
      return [[p.kind]];
    }),
  };
}
function differs(document: FountainDocument, reading: RendererReading) {
  const kinds: Record<string, string> = {
    heading: 'sceneHeading',
    cue: 'character',
  };
  if (document.titleFields.length > 0 !== (reading.title !== null)) return true;
  return reading.paragraphs.some((p) =>
    p.rows.some((row, i) => {
      const line = document.lines[row]!;
      if (['blank', 'note', 'boneyard'].includes(line.kind)) return false;
      const role = p.roles[i]!;
      return (
        line.kind !== (kinds[role] ?? role) ||
        (role === 'heading' &&
          (line.sceneNumber?.toUpperCase() ?? null) !== (p.sceneNumber ?? null))
      );
    }),
  );
}

// Fixed seed and ASCII token vocabulary: reproducible source-grammar coverage,
// not the lost original scratch generator and not layout/emphasis/pixel proof.
function sources() {
  const tokens = [
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
  ];
  const prefixes = ['', '', ' ', '\t'];
  const suffixes = ['', '', ' ', '  ', '\t'];
  const gaps = ['\n', '\n\n', '\n \n', '\n  \n', '\n\t\n'];
  let seed = 0x104d04;
  const pick = (size: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % size;
  };
  const generated: string[] = [];
  for (let i = 0; i < 70000; i++) {
    let source = '';
    const count = 1 + pick(6);
    for (let row = 0; row < count; row++)
      source +=
        (row ? gaps[pick(gaps.length)]! : '') +
        prefixes[pick(prefixes.length)]! +
        tokens[pick(tokens.length)]! +
        suffixes[pick(suffixes.length)]!;
    generated.push(source + '\n');
  }
  return generated;
}

it('shared corpus and 70,000 generated sources introduce no pinned-parser reading disagreement', () => {
  const corpus = JSON.parse(
    readFileSync('fixtures/assessment/oracle.json', 'utf8'),
  ) as { cases: { source: string }[] };
  const inputs = [...corpus.cases.map((c) => c.source), ...sources()];
  const oracle = JSON.parse(
    execFileSync('python3', ['tools/differential/renderer_oracle.py'], {
      input: JSON.stringify(inputs),
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: 150000,
    }),
  ) as ({ title: boolean; paragraphs: unknown[] } | { refused: string })[];
  expect(oracle).toHaveLength(inputs.length);
  const regressions: unknown[] = [];
  const falseGates: unknown[] = [];
  const assessmentRegressions: unknown[] = [];
  let baselineRoleCandidates = 0;
  const baselineRoleExamples: unknown[] = [];
  // Report only: every occurrence, so review can deduplicate and account for
  // each one. It changes no predicate, assertion, seed or baseline.
  const baselineRoleOccurrences: unknown[] = [];
  const existing: unknown[] = [];
  let equal = 0,
    refused = 0;
  for (const [index, source] of inputs.entries()) {
    const actual = oracle[index]!;
    if ('refused' in actual) {
      refused++;
      continue;
    }
    const bytes = new TextEncoder().encode(source);
    const oldDoc = baselineCodec.parseFountain(bytes);
    const nowDoc = parseFountain(bytes);
    const oldView = baseAssessment.assessmentView(oldDoc).document;
    const nowView = assessment.assessmentView(nowDoc).document;
    const oldReading = baselineReading(oldView.lines);
    const nowReading = rendererReading(nowView.lines);
    const old = facts(oldReading);
    const now = facts(nowReading);
    const context = {
      identity: assessment.PUBLICATION_ASSESSMENT_IDENTITY,
      version: 1,
      sourceSha256: 'a'.repeat(64),
    };
    const oldCheck = baseAssessment.evaluateExportAssessment(oldDoc, context);
    const nowCheck = assessment.evaluateExportAssessment(nowDoc, context);
    const clean = (check: typeof nowCheck) =>
      check.status === 'verified' &&
      !check.issues.some((issue) => issue.severity === 'blocking');
    if (
      clean(oldCheck) &&
      JSON.stringify(old) === JSON.stringify(actual) &&
      !clean(nowCheck)
    )
      falseGates.push(source);
    const oldCleanDifference =
      clean(oldCheck) &&
      (JSON.stringify(old) !== JSON.stringify(actual) ||
        differs(oldView, oldReading));
    const nowCleanDifference =
      clean(nowCheck) &&
      (JSON.stringify(now) !== JSON.stringify(actual) ||
        differs(nowView, nowReading));
    if (oldCleanDifference) {
      baselineRoleCandidates++;
      baselineRoleOccurrences.push({
        index,
        origin: index < corpus.cases.length ? 'oracle' : 'generated',
        source,
        current: nowCleanDifference,
      });
      if (baselineRoleExamples.length < 5)
        baselineRoleExamples.push({
          source,
          lines: oldView.lines.map((l) => [l.kind, l.text, l.sceneNumber]),
          reading: oldReading,
        });
    }
    if (nowCleanDifference && !oldCleanDifference)
      assessmentRegressions.push(source);
    const expected = JSON.stringify(actual);
    if (JSON.stringify(old) === expected) {
      equal++;
      if (JSON.stringify(now) !== expected)
        regressions.push({ source, actual, now });
    } else if (JSON.stringify(now) !== expected)
      existing.push({ source, actual, now });
  }
  console.log(
    JSON.stringify({
      sources: inputs.length,
      equal,
      refused,
      existing: existing.length,
      newDisagreements: regressions.length,
    }),
  );
  if (existing.length)
    console.log(
      'Frozen-control disagreements (not new):',
      JSON.stringify(existing.slice(0, 5)),
    );
  expect(equal).toBeGreaterThan(50000);
  expect(refused).toBe(0);
  expect(existing.slice(0, 10)).toEqual([]);
  expect(regressions.slice(0, 10)).toEqual([]);
  expect(falseGates.slice(0, 10)).toEqual([]);
  expect(assessmentRegressions.slice(0, 10)).toEqual([]);
  if (process.env.BABEL_DIFFERENTIAL_REPORT)
    writeFileSync(
      process.env.BABEL_DIFFERENTIAL_REPORT + '.renderer.json',
      JSON.stringify({
        sources: inputs.length,
        uniqueSources: new Set(inputs).size,
        equal,
        refused,
        existing: existing.length,
        newDisagreements: regressions.length,
        newFalseGates: falseGates.length,
        newCleanDisagreements: assessmentRegressions.length,
        existingExamples: existing.slice(0, 5),
        baselineRoleCandidates,
        baselineRoleExamples,
        baselineRoleOccurrences,
      }),
      { flag: 'wx' },
    );
});
